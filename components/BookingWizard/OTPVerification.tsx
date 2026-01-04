'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useBookingStore } from '@/store/useBookingStore'
import { useAuthStore } from '@/store/useAuthStore'
import { sendPhoneOtp, verifyOtp, clearRecaptchaVerifier, isTestUser, TEST_USER } from '@/lib/firebase/config'
import { sendEmailOtp, verifyEmailOtp, isValidEmail } from '@/lib/auth/email-auth'
import { getOrCreateCustomer, getOrCreateCustomerWithEmail, checkEmailDuplicate, findCustomerByPhone, getCustomerAuthMethod } from '@/lib/services/customer.service'
import { createReservation as createReservationService } from '@/lib/services/booking.service'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useBugReporter } from '@/hooks/useBugReporter'
import { useHaptics } from '@/hooks/useHaptics'
import { Mail, Phone, AlertTriangle } from 'lucide-react'

const RECAPTCHA_CONTAINER_ID = 'recaptcha-container'
const RESEND_COOLDOWN_SECONDS = 60
const MAX_RETRY_ATTEMPTS = 3

type VerificationMode = 'sms' | 'email'

export function OTPVerification() {
  const {
    customer,
    barberId,
    service,
    date,
    timeTimestamp,
    otpConfirmation,
    setOtpConfirmation,
    nextStep,
    prevStep,
    lockFlow,
    unlockFlow,
  } = useBookingStore()
  
  const { login, loginWithEmail } = useAuthStore()
  const { report } = useBugReporter('OTPVerification')
  const haptics = useHaptics()

  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [countdown, setCountdown] = useState(0)
  const [retryCount, setRetryCount] = useState(0)
  
  // Email fallback state
  const [mode, setMode] = useState<VerificationMode>('sms')
  const [email, setEmail] = useState('')
  const [smsError, setSmsError] = useState<string | null>(null)
  const [showEmailFallback, setShowEmailFallback] = useState(false)
  
  // Auth choice state for users with both methods
  const [showAuthChoice, setShowAuthChoice] = useState(false)
  const [customerAuthMethod, setCustomerAuthMethod] = useState<'phone' | 'email' | 'both' | null>(null)
  const [customerEmail, setCustomerEmail] = useState<string | null>(null)
  
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])
  const hasSentRef = useRef(false)
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true
    // Lock the flow to prevent auth sync from disrupting the wizard
    lockFlow()
    return () => {
      isMountedRef.current = false
      clearRecaptchaVerifier()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Check customer's auth method on mount
  useEffect(() => {
    const checkAuthMethod = async () => {
      if (!customer?.phone) return
      
      try {
        const authMethod = await getCustomerAuthMethod(customer.phone)
        setCustomerAuthMethod(authMethod)
        
        if (authMethod === 'both' || authMethod === 'email') {
          // Get customer details for email
          const existingCustomer = await findCustomerByPhone(customer.phone)
          const existingEmail = existingCustomer?.email
          if (existingEmail) {
            setCustomerEmail(existingEmail)
            
            if (authMethod === 'both') {
              // Show auth choice for users with both methods
              setShowAuthChoice(true)
              return
            } else if (authMethod === 'email') {
              // Auto-send email OTP for email-only users
              setMode('email')
              setEmail(existingEmail)
              hasSentRef.current = true
              setTimeout(() => handleSendEmailOtpDirect(existingEmail), 500)
              return
            }
          }
        }
        
        // Default: send SMS OTP
        if (!hasSentRef.current && !sent && !sending) {
          hasSentRef.current = true
          setTimeout(() => handleSendSmsOtp(), 500)
        }
      } catch (err) {
        console.error('Error checking auth method:', err)
        // Fall back to SMS
        if (!hasSentRef.current && !sent && !sending) {
          hasSentRef.current = true
          setTimeout(() => handleSendSmsOtp(), 500)
        }
      }
    }
    
    checkAuthMethod()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => {
        if (isMountedRef.current) {
          setCountdown(countdown - 1)
        }
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [countdown])

  const formatPhoneNumber = useCallback((phone: string): string => {
    const cleaned = phone.replace(/\D/g, '')
    if (cleaned.startsWith('0')) {
      return `+972${cleaned.slice(1)}`
    }
    if (cleaned.startsWith('972')) {
      return `+${cleaned}`
    }
    return `+972${cleaned}`
  }, [])

  const handleSendSmsOtp = useCallback(async () => {
    if (countdown > 0 || sending) return
    if (retryCount >= MAX_RETRY_ATTEMPTS) {
      setError('יותר מדי ניסיונות נכשלו. נסה באימייל במקום.')
      setShowEmailFallback(true)
      return
    }
    
    setSending(true)
    setError(null)
    
    const phoneNumber = formatPhoneNumber(customer.phone)
    
    try {
      const result = await sendPhoneOtp(phoneNumber, RECAPTCHA_CONTAINER_ID)
      
      if (!isMountedRef.current) return
      
      if (result.success && result.confirmation) {
        setOtpConfirmation(result.confirmation)
        setSent(true)
        setCountdown(RESEND_COOLDOWN_SECONDS)
        setRetryCount(0)
        setSmsError(null)
        haptics.light()
        toast.success('קוד אימות נשלח בהצלחה!')
        setTimeout(() => inputRefs.current[0]?.focus(), 100)
      } else {
        const errorMsg = result.error || 'שגיאה בשליחת קוד האימות'
        setSmsError(errorMsg)
        setError(errorMsg)
        setRetryCount(prev => prev + 1)
        setShowEmailFallback(true)
        toast.error('שגיאה בשליחת SMS - נסה באימייל')
      }
    } catch (err) {
      console.error('Unexpected OTP send error:', err)
      await report(err, 'Sending OTP during booking wizard')
      if (isMountedRef.current) {
        setSmsError('שגיאה בלתי צפויה')
        setError('שגיאה בלתי צפויה - נסה באימייל')
        setRetryCount(prev => prev + 1)
        setShowEmailFallback(true)
      }
    }
    
    if (isMountedRef.current) {
      setSending(false)
    }
  }, [countdown, sending, customer.phone, setOtpConfirmation, formatPhoneNumber, retryCount, report, haptics])

  const handleSendEmailOtp = async () => {
    if (!isValidEmail(email)) {
      setError('נא להזין כתובת אימייל תקינה')
      return
    }
    
    setSending(true)
    setError(null)
    
    try {
      const customerPhone = customer?.phone || ''
      
      // Check if this email is already registered to a different phone
      const duplicateCheck = await checkEmailDuplicate(email.trim().toLowerCase(), customerPhone)
      
      if (duplicateCheck.isDuplicate) {
        setError(duplicateCheck.message || 'כתובת האימייל כבר רשומה במערכת')
        setSending(false)
        return
      }
      
      // Check if phone already has a different email registered
      if (customerPhone) {
        const existingByPhone = await findCustomerByPhone(customerPhone)
        if (existingByPhone && existingByPhone.email && existingByPhone.email !== email.trim().toLowerCase()) {
          setError(`מספר הטלפון כבר רשום לאימייל אחר: ${existingByPhone.email}`)
          setSending(false)
          return
        }
      }
      
      const result = await sendEmailOtp(email.trim().toLowerCase())
      
      if (!isMountedRef.current) return
      
      if (result.success) {
        setMode('email')
        setSent(true)
        setCountdown(RESEND_COOLDOWN_SECONDS)
        haptics.light()
        toast.success('קוד אימות נשלח לאימייל!')
        setTimeout(() => inputRefs.current[0]?.focus(), 100)
      } else {
        setError(result.error || 'שגיאה בשליחת האימייל')
        toast.error(result.error || 'שגיאה בשליחת האימייל')
      }
    } catch (err) {
      console.error('Email OTP send error:', err)
      await report(err, 'Sending email OTP during booking wizard')
      if (isMountedRef.current) {
        setError('שגיאה בשליחת האימייל')
      }
    }
    
    if (isMountedRef.current) {
      setSending(false)
    }
  }

  // Direct email OTP send (used when auto-selecting email for email-only users)
  const handleSendEmailOtpDirect = async (targetEmail: string) => {
    setSending(true)
    setError(null)
    
    try {
      const result = await sendEmailOtp(targetEmail.trim().toLowerCase())
      
      if (!isMountedRef.current) return
      
      if (result.success) {
        setMode('email')
        setSent(true)
        setCountdown(RESEND_COOLDOWN_SECONDS)
        haptics.light()
        toast.success('קוד אימות נשלח לאימייל!')
        setTimeout(() => inputRefs.current[0]?.focus(), 100)
      } else {
        setError(result.error || 'שגיאה בשליחת האימייל')
        toast.error(result.error || 'שגיאה בשליחת האימייל')
      }
    } catch (err) {
      console.error('Email OTP send error:', err)
      await report(err, 'Sending email OTP (direct)')
      if (isMountedRef.current) {
        setError('שגיאה בשליחת האימייל')
      }
    }
    
    if (isMountedRef.current) {
      setSending(false)
    }
  }

  // Auth choice handlers for users with both methods
  const handleAuthChoiceSms = async () => {
    setShowAuthChoice(false)
    hasSentRef.current = true
    await handleSendSmsOtp()
  }

  const handleAuthChoiceEmail = async () => {
    if (!customerEmail) {
      setError('שגיאה - אימייל לא נמצא')
      return
    }
    setShowAuthChoice(false)
    setMode('email')
    setEmail(customerEmail)
    hasSentRef.current = true
    await handleSendEmailOtpDirect(customerEmail)
  }

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return
    
    const newOtp = [...otp]
    newOtp[index] = value.slice(-1)
    setOtp(newOtp)
    
    if (error) setError(null)
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!otp[index] && index > 0) {
        inputRefs.current[index - 1]?.focus()
      } else {
        const newOtp = [...otp]
        newOtp[index] = ''
        setOtp(newOtp)
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus()
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pastedData) {
      const newOtp = [...otp]
      for (let i = 0; i < 6; i++) {
        newOtp[i] = pastedData[i] || ''
      }
      setOtp(newOtp)
      const focusIndex = Math.min(pastedData.length, 5)
      inputRefs.current[focusIndex]?.focus()
    }
  }

  const handleVerifySmsOtp = async () => {
    const code = otp.join('')
    
    if (code.length !== 6) {
      setError('נא להזין קוד בן 6 ספרות')
      return
    }
    
    if (!otpConfirmation) {
      setError('לא נמצא קוד אימות פעיל - בקש קוד חדש')
      return
    }
    
    setVerifying(true)
    setError(null)
    
    try {
      const result = await verifyOtp(otpConfirmation, code)
      
      if (!isMountedRef.current) return
      
      if (result.success) {
        toast.info('מאמת ויוצר תור...')
        
        // Get or create customer and log them in
        const customerRecord = await getOrCreateCustomer(
          customer.phone.replace(/\D/g, ''),
          customer.fullname,
          result.firebaseUid
        )
        
        if (!customerRecord) {
          setError('שגיאה ביצירת משתמש')
          setVerifying(false)
          return
        }
        
        // Log the user in (saves to localStorage)
        await login(customer.phone.replace(/\D/g, ''), customer.fullname, result.firebaseUid)
        
        // Create reservation using the centralized booking service
        const reservationResult = await handleCreateReservation(customerRecord.id)
        
        if (!isMountedRef.current) return
        
        if (reservationResult.success) {
          haptics.success()
          toast.success('התור נקבע בהצלחה!')
          nextStep()
        } else {
          setError(reservationResult.message || 'שגיאה ביצירת התור - נסה שוב')
          toast.error(reservationResult.message || 'שגיאה ביצירת התור')
        }
      } else {
        setError(result.error || 'קוד שגוי, נסה שוב')
        toast.error('קוד שגוי')
        setOtp(['', '', '', '', '', ''])
        inputRefs.current[0]?.focus()
      }
    } catch (err) {
      console.error('Unexpected verify error:', err)
      if (isMountedRef.current) {
        setError('שגיאה בלתי צפויה - נסה שוב')
      }
    }
    
    if (isMountedRef.current) {
      setVerifying(false)
    }
  }

  const handleVerifyEmailOtp = async () => {
    const code = otp.join('')
    
    if (code.length !== 6) {
      setError('נא להזין קוד בן 6 ספרות')
      return
    }
    
    setVerifying(true)
    setError(null)
    
    try {
      const result = await verifyEmailOtp(email, code)
      
      if (!isMountedRef.current) return
      
      if (result.success) {
        toast.info('מאמת ויוצר תור...')
        
        // Get or create customer with email and log them in
        const customerRecord = await getOrCreateCustomerWithEmail(
          customer.phone.replace(/\D/g, ''),
          customer.fullname,
          email.trim().toLowerCase(),
          result.supabaseUserId
        )
        
        if (!customerRecord) {
          setError('שגיאה ביצירת משתמש')
          setVerifying(false)
          return
        }
        
        // Log the user in via email
        await loginWithEmail(
          customer.phone.replace(/\D/g, ''),
          customer.fullname,
          email.trim().toLowerCase(),
          result.supabaseUserId
        )
        
        // Create reservation using the centralized booking service
        const reservationResult = await handleCreateReservation(customerRecord.id)
        
        if (!isMountedRef.current) return
        
        if (reservationResult.success) {
          haptics.success()
          toast.success('התור נקבע בהצלחה!')
          nextStep()
        } else {
          setError(reservationResult.message || 'שגיאה ביצירת התור - נסה שוב')
          toast.error(reservationResult.message || 'שגיאה ביצירת התור')
        }
      } else {
        setError(result.error || 'קוד שגוי, נסה שוב')
        toast.error('קוד שגוי')
        setOtp(['', '', '', '', '', ''])
        inputRefs.current[0]?.focus()
      }
    } catch (err) {
      console.error('Email verify error:', err)
      await report(err, 'Verifying email OTP during booking wizard')
      if (isMountedRef.current) {
        setError('שגיאה בלתי צפויה - נסה שוב')
      }
    }
    
    if (isMountedRef.current) {
      setVerifying(false)
    }
  }

  const handleVerify = () => {
    if (mode === 'email') {
      handleVerifyEmailOtp()
    } else {
      handleVerifySmsOtp()
    }
  }

  const handleCreateReservation = async (customerId: string): Promise<{ success: boolean; reservationId?: string; message?: string }> => {
    if (!barberId || !service || !date || !timeTimestamp) {
      console.error('[OTP Booking] Missing required data:', { barberId, service, date, timeTimestamp })
      return { success: false, message: 'חסרים נתונים ליצירת התור' }
    }
    
    // Use the centralized booking service with atomic database function
    const result = await createReservationService({
      barberId: barberId,
      serviceId: service.id,
      customerId: customerId,
      customerName: customer.fullname,
      customerPhone: customer.phone,
      dateTimestamp: date.dateTimestamp,
      timeTimestamp: timeTimestamp,
      dayName: date.dayName,
      dayNum: date.dayNum,
    })
    
    if (!result.success) {
      console.error('[OTP Booking] Creation failed:', result.error)
      return { success: false, message: result.message }
    }
    
    // Send push notification to barber (fire and forget)
    if (result.reservationId) {
      console.log('[OTP Booking] Sending push notification to barber:', barberId)
      fetch('/api/push/notify-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reservationId: result.reservationId,
          customerId,
          barberId,
          customerName: customer.fullname,
          serviceName: service.name_he,
          appointmentTime: timeTimestamp
        })
      })
        .then(res => res.json())
        .then(data => console.log('[OTP Booking] Push notification result:', data))
        .catch(err => console.error('[OTP Booking] Push notification error:', err))
    }
    
    return { success: true, reservationId: result.reservationId }
  }

  const handleSwitchToEmail = () => {
    setShowEmailFallback(true)
    setMode('email')
    setSent(false)
    setOtp(['', '', '', '', '', ''])
    setError(null)
  }

  const handleSwitchToSms = () => {
    setShowEmailFallback(false)
    setMode('sms')
    setSent(false)
    setOtp(['', '', '', '', '', ''])
    setError(null)
    setRetryCount(0)
    hasSentRef.current = false
    setTimeout(() => handleSendSmsOtp(), 100)
  }

  const otpCode = otp.join('')
  const canVerify = otpCode.length === 6 && !verifying && (mode === 'email' || !!otpConfirmation)
  const canResend = countdown === 0 && !sending

  // Auth choice view for users with both SMS and Email methods
  if (showAuthChoice && customerAuthMethod === 'both' && customerEmail) {
    return (
      <div className="flex flex-col gap-6">
        <div className="text-center">
          <h2 className="text-xl text-foreground-light font-medium">בחר אופן אימות</h2>
          <p className="text-foreground-muted text-sm mt-2">
            שלום <span className="font-semibold text-accent-gold">{customer.fullname}</span>! 👋
          </p>
          <p className="text-foreground-muted text-xs mt-1">
            יש לך שתי אפשרויות להתחבר
          </p>
        </div>
        
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
            <p className="text-red-400 text-sm text-center">{error}</p>
          </div>
        )}
        
        {/* SMS Option */}
        <button
          onClick={handleAuthChoiceSms}
          disabled={sending}
          className={cn(
            'w-full py-3.5 rounded-xl font-medium transition-all flex items-center justify-center gap-3 border',
            sending
              ? 'bg-foreground-muted/30 text-foreground-muted cursor-not-allowed border-foreground-muted/30'
              : 'bg-accent-gold text-background-dark hover:bg-accent-gold/90 border-transparent'
          )}
        >
          <Phone size={20} />
          <div className="flex flex-col items-start">
            <span>קוד SMS לטלפון</span>
            <span className="text-xs opacity-75" dir="ltr">{customer.phone}</span>
          </div>
        </button>
        
        {/* Email Option */}
        <button
          onClick={handleAuthChoiceEmail}
          disabled={sending}
          className={cn(
            'w-full py-3.5 rounded-xl font-medium transition-all flex items-center justify-center gap-3 border',
            sending
              ? 'bg-foreground-muted/30 text-foreground-muted cursor-not-allowed border-foreground-muted/30'
              : 'bg-transparent text-foreground-light border-white/20 hover:border-accent-gold/50 hover:bg-white/5'
          )}
        >
          <Mail size={20} />
          <div className="flex flex-col items-start">
            <span>קוד לאימייל</span>
            <span className="text-xs opacity-75">{customerEmail}</span>
          </div>
        </button>
        
        {sending && (
          <p className="text-foreground-muted text-xs text-center animate-pulse">
            שולח קוד אימות...
          </p>
        )}
        
        <button
          onClick={() => {
            clearRecaptchaVerifier()
            unlockFlow()
            prevStep()
          }}
          className="text-sm text-foreground-muted hover:text-foreground-light transition-colors"
        >
          ← חזור לפרטים אישיים
        </button>
      </div>
    )
  }

  // Email fallback input view
  if (showEmailFallback && mode === 'email' && !sent) {
    return (
      <div className="flex flex-col gap-6">
        <div className="text-center">
          <h2 className="text-xl text-foreground-light font-medium">התחברות באימייל</h2>
          <p className="text-foreground-muted text-sm mt-2">
            הזן את כתובת האימייל שלך לקבלת קוד אימות
          </p>
        </div>
        
        {/* SMS Error Notice */}
        {smsError && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
            <div className="flex items-center gap-2 text-amber-400 text-sm">
              <AlertTriangle size={18} />
              <span>שגיאה בשליחת SMS</span>
            </div>
            <p className="text-amber-400/80 text-xs mt-1">
              ניתן להתחבר באמצעות אימייל במקום
            </p>
          </div>
        )}
        
        <div className="flex flex-col gap-2">
          <label htmlFor="email-fallback" className="text-foreground-light text-sm">
            אימייל
          </label>
          <input
            id="email-fallback"
            type="email"
            dir="ltr"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              setError(null)
            }}
            placeholder="your@email.com"
            className={cn(
              'w-full p-3.5 rounded-xl bg-background-card border text-foreground-light placeholder:text-foreground-muted/50 outline-none focus:ring-2 focus:ring-accent-gold transition-all text-left text-base',
              error ? 'border-red-400' : 'border-white/10'
            )}
          />
          {error && <p className="text-red-400 text-xs">{error}</p>}
        </div>
        
        <button
          onClick={handleSendEmailOtp}
          disabled={sending}
          className={cn(
            'w-full py-3.5 px-4 rounded-xl font-medium transition-all text-lg flex items-center justify-center gap-2',
            sending
              ? 'bg-foreground-muted/20 text-foreground-muted cursor-not-allowed'
              : 'bg-accent-gold text-background-dark hover:bg-accent-gold/90 cursor-pointer'
          )}
        >
          <Mail size={20} />
          {sending ? 'שולח קוד...' : 'שלח קוד לאימייל'}
        </button>
        
        {/* Switch back to SMS */}
        <button
          onClick={handleSwitchToSms}
          className="w-full py-2.5 text-sm text-foreground-muted hover:text-accent-gold transition-colors flex items-center justify-center gap-2"
        >
          <Phone size={16} />
          נסה שוב ב-SMS
        </button>
        
        <button
          onClick={() => {
            clearRecaptchaVerifier()
            unlockFlow()
            prevStep()
          }}
          disabled={verifying}
          className="text-sm text-foreground-muted hover:text-foreground-light transition-colors"
        >
          ← חזור לפרטים אישיים
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h2 className="text-xl text-foreground-light font-medium">
          {mode === 'email' ? 'אימות אימייל' : 'אימות מספר טלפון'}
        </h2>
        <p className="text-foreground-muted text-sm mt-2">
          {sending && !sent 
            ? mode === 'email' ? 'שולח קוד לאימייל...' : 'שולח קוד אימות...'
            : sent 
              ? mode === 'email' 
                ? `קוד אימות נשלח ל-${email}`
                : `קוד אימות נשלח ל-${customer.phone}`
              : 'מכין שליחת קוד...'
          }
        </p>
        <p className="text-foreground-muted/70 text-xs mt-1">
          אימות הכרחי להשלמת ההזמנה
        </p>
        
        {/* Test user hint - only in development for SMS mode */}
        {process.env.NODE_ENV === 'development' && mode === 'sms' && isTestUser(customer.phone || '') && (
          <div className="mt-3 px-4 py-2 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <p className="text-blue-400 text-xs">
              🧪 משתמש בדיקה - הקוד הוא: <span className="font-mono font-bold">{TEST_USER.otpCode}</span>
            </p>
          </div>
        )}
      </div>
      
      <div id={RECAPTCHA_CONTAINER_ID} className="flex justify-center" />
      
      {sending && !sent && (
        <div className="flex flex-col items-center gap-3 py-6">
          <div className="w-10 h-10 border-3 border-accent-gold border-t-transparent rounded-full animate-spin" />
          <p className="text-foreground-muted text-sm">
            {mode === 'email' ? 'שולח אימייל...' : 'שולח SMS...'}
          </p>
        </div>
      )}
      
      {!sending && !sent && !error && mode === 'sms' && (
        <div className="flex flex-col items-center gap-3 py-4">
          <p className="text-foreground-muted text-sm">לא נשלח אוטומטית?</p>
          <button
            onClick={handleSendSmsOtp}
            className="px-6 py-2 bg-accent-gold text-background-dark rounded-lg font-medium hover:bg-accent-gold/90 transition-colors"
          >
            שלח קוד עכשיו
          </button>
        </div>
      )}
      
      {(sent || error) && !sending && (
        <>
          <div className="flex flex-col items-center gap-4">
            <p className="text-foreground-light text-sm">הזן את הקוד בן 6 הספרות:</p>
            
            <div 
              className="flex justify-center gap-2" 
              dir="ltr"
              onPaste={handlePaste}
            >
              {otp.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => { inputRefs.current[index] = el }}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  disabled={verifying}
                  aria-label={`ספרה ${index + 1} מתוך 6`}
                  className={cn(
                    'w-12 h-14 text-center text-xl font-bold rounded-lg bg-background-card border-2 text-foreground-light outline-none focus:ring-2 focus:ring-accent-gold focus:border-accent-gold transition-all',
                    error ? 'border-red-400' : digit ? 'border-accent-gold/50' : 'border-white/20',
                    verifying && 'opacity-50 cursor-not-allowed'
                  )}
                />
              ))}
            </div>
          </div>
          
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
              <p className="text-center text-red-400 text-sm">{error}</p>
            </div>
          )}
          
          <button
            onClick={handleVerify}
            disabled={!canVerify}
            className={cn(
              'w-full py-3.5 px-4 rounded-xl font-medium transition-all text-lg',
              canVerify
                ? 'bg-accent-gold text-background-dark hover:bg-accent-gold/90 cursor-pointer'
                : 'bg-foreground-muted/20 text-foreground-muted cursor-not-allowed'
            )}
          >
            {verifying ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-5 h-5 border-2 border-background-dark border-t-transparent rounded-full animate-spin" />
                מאמת...
              </span>
            ) : (
              'אמת וקבע תור'
            )}
          </button>
          
          <div className="text-center">
            {countdown > 0 ? (
              <p className="text-foreground-muted text-sm">
                לא קיבלת? ניתן לשלוח שוב בעוד <span className="text-accent-gold font-medium">{countdown}</span> שניות
              </p>
            ) : retryCount >= MAX_RETRY_ATTEMPTS && mode === 'sms' ? (
              <p className="text-red-400 text-sm">
                יותר מדי ניסיונות. נסה באימייל במקום.
              </p>
            ) : (
              <button
                onClick={mode === 'email' ? handleSendEmailOtp : handleSendSmsOtp}
                disabled={!canResend}
                className={cn(
                  'text-sm transition-colors',
                  canResend 
                    ? 'text-accent-gold hover:underline cursor-pointer' 
                    : 'text-foreground-muted cursor-not-allowed'
                )}
              >
                {sending ? 'שולח...' : 'לא קיבלת? שלח קוד חדש'}
              </button>
            )}
          </div>
          
          {/* Email fallback option - only show for SMS mode */}
          {mode === 'sms' && (
            <div className="border-t border-white/10 pt-3 mt-2">
              <button
                onClick={handleSwitchToEmail}
                className="w-full text-sm text-foreground-muted hover:text-accent-gold transition-colors flex items-center justify-center gap-2"
              >
                <Mail size={16} />
                לא מקבל SMS? המשך באימייל
              </button>
            </div>
          )}
          
          {/* Switch back to SMS option - only show for email mode */}
          {mode === 'email' && (
            <div className="border-t border-white/10 pt-3 mt-2">
              <button
                onClick={handleSwitchToSms}
                className="w-full text-sm text-foreground-muted hover:text-accent-gold transition-colors flex items-center justify-center gap-2"
              >
                <Phone size={16} />
                נסה שוב ב-SMS
              </button>
            </div>
          )}
        </>
      )}
      
      <button
        onClick={() => {
          clearRecaptchaVerifier()
          unlockFlow() // Allow auth sync again when going back
          prevStep()
        }}
        disabled={verifying}
        className={cn(
          'text-sm transition-colors',
          verifying 
            ? 'text-foreground-muted/50 cursor-not-allowed' 
            : 'text-foreground-muted hover:text-foreground-light'
        )}
      >
        ← חזור לפרטים אישיים
      </button>
    </div>
  )
}
