'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useBookingStore } from '@/store/useBookingStore'
import { useAuthStore } from '@/store/useAuthStore'
import { sendPhoneOtp, verifyOtp, clearRecaptchaVerifier, isTestUser, TEST_USER } from '@/lib/firebase/config'
import { createClient } from '@/lib/supabase/client'
import { getOrCreateCustomer } from '@/lib/services/customer.service'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useBugReporter } from '@/hooks/useBugReporter'

const RECAPTCHA_CONTAINER_ID = 'recaptcha-container'
const RESEND_COOLDOWN_SECONDS = 60
const MAX_RETRY_ATTEMPTS = 3

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
  
  const { login } = useAuthStore()
  const { report } = useBugReporter('OTPVerification')

  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [countdown, setCountdown] = useState(0)
  const [retryCount, setRetryCount] = useState(0)
  
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

  useEffect(() => {
    if (!hasSentRef.current && !sent && !sending) {
      hasSentRef.current = true
      const timer = setTimeout(() => {
        if (isMountedRef.current) {
          handleSendOtp()
        }
      }, 500)
      return () => clearTimeout(timer)
    }
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

  const handleSendOtp = useCallback(async () => {
    if (countdown > 0 || sending) return
    if (retryCount >= MAX_RETRY_ATTEMPTS) {
      setError('יותר מדי ניסיונות נכשלו. נסה שוב מאוחר יותר.')
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
        toast.success('קוד אימות נשלח בהצלחה!')
        setTimeout(() => inputRefs.current[0]?.focus(), 100)
      } else {
        setError(result.error || 'שגיאה בשליחת קוד האימות')
        setRetryCount(prev => prev + 1)
        toast.error('שגיאה בשליחת הקוד')
      }
    } catch (err) {
      console.error('Unexpected OTP send error:', err)
      await report(err, 'Sending OTP during booking wizard')
      if (isMountedRef.current) {
        setError('שגיאה בלתי צפויה - נסה שוב')
        setRetryCount(prev => prev + 1)
      }
    }
    
    if (isMountedRef.current) {
      setSending(false)
    }
  }, [countdown, sending, customer.phone, setOtpConfirmation, formatPhoneNumber, retryCount, report])

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

  const handleVerify = async () => {
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
        
        // Create reservation with customer_id
        const reservationCreated = await createReservation(customerRecord.id)
        
        if (!isMountedRef.current) return
        
        if (reservationCreated) {
          toast.success('התור נקבע בהצלחה!')
          nextStep()
        } else {
          setError('שגיאה ביצירת התור - נסה שוב')
          toast.error('שגיאה ביצירת התור')
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

  const createReservation = async (customerId: string): Promise<boolean> => {
    if (!barberId || !service || !date || !timeTimestamp) {
      return false
    }
    
    try {
      const supabase = createClient()
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: insertError } = await (supabase.from('reservations') as any).insert({
        barber_id: barberId,
        service_id: service.id,
        customer_id: customerId,
        customer_name: customer.fullname,
        customer_phone: customer.phone,
        date_timestamp: date.dateTimestamp,
        time_timestamp: timeTimestamp,
        day_name: date.dayName,
        day_num: date.dayNum,
        status: 'confirmed',
      })
      
      if (insertError) {
        console.error('Error creating reservation:', insertError)
        return false
      }
      
      return true
    } catch (err) {
      console.error('Error creating reservation:', err)
      return false
    }
  }

  const otpCode = otp.join('')
  const canVerify = otpCode.length === 6 && !!otpConfirmation && !verifying
  const canResend = countdown === 0 && !sending && retryCount < MAX_RETRY_ATTEMPTS

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h2 className="text-xl text-foreground-light font-medium">אימות מספר טלפון</h2>
        <p className="text-foreground-muted text-sm mt-2">
          {sending && !sent 
            ? 'שולח קוד אימות...'
            : sent 
              ? `קוד אימות נשלח ל-${customer.phone}`
              : 'מכין שליחת קוד...'
          }
        </p>
        <p className="text-foreground-muted/70 text-xs mt-1">
          אימות הטלפון הכרחי להשלמת ההזמנה
        </p>
        
        {/* Test user hint */}
        {isTestUser(customer.phone || '') && (
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
          <p className="text-foreground-muted text-sm">שולח SMS...</p>
        </div>
      )}
      
      {!sending && !sent && !error && (
        <div className="flex flex-col items-center gap-3 py-4">
          <p className="text-foreground-muted text-sm">לא נשלח אוטומטית?</p>
          <button
            onClick={handleSendOtp}
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
            ) : retryCount >= MAX_RETRY_ATTEMPTS ? (
              <p className="text-red-400 text-sm">
                יותר מדי ניסיונות. נסה שוב מאוחר יותר.
              </p>
            ) : (
              <button
                onClick={handleSendOtp}
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
