'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '@/store/useAuthStore'
import { useBarberAuthStore } from '@/store/useBarberAuthStore'
import { findCustomerByPhone, getCustomerAuthMethod, checkEmailDuplicate, findCustomerByEmail } from '@/lib/services/customer.service'
import { 
  sendSmsOtp, 
  verifySmsOtp, 
  cleanupSmsSession, 
  isTestUser, 
  TEST_USER, 
  setSkipDebugMode,
  type OtpSession 
} from '@/lib/sms/sms-service'
import { 
  getStoredDeviceToken, 
  saveDeviceToken 
} from '@/lib/services/trusted-device.service'
import { sendEmailOtp, verifyEmailOtp, isValidEmail } from '@/lib/auth/email-auth'
import { showToast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { X, Scissors, AlertTriangle, Mail, Phone, ArrowRight, MessageSquare } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useBugReporter } from '@/hooks/useBugReporter'
import { Portal } from '@/components/ui/Portal'
import { useHaptics } from '@/hooks/useHaptics'
import { Button, InputOTP, REGEXP_ONLY_DIGITS } from '@heroui/react'

interface LoginModalProps {
  isOpen: boolean
  onClose: () => void
}

type Step = 
  | 'phone' 
  | 'name' 
  | 'otp' 
  | 'debug-choice' 
  | 'blocked' 
  | 'email-fallback'  // Show email input after SMS failure
  | 'email-otp'       // Verify email OTP
  | 'email-signup'    // New user email signup (name + email)
  | 'auth-choice'     // User with both methods - choose SMS or Email

// SMS provider widget container ID - will be used if new provider requires a UI element
const SMS_WIDGET_CONTAINER_ID = 'login-sms-widget-container'

export function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const router = useRouter()
  const { login, loginWithEmail } = useAuthStore()
  const { isLoggedIn: isBarberLoggedIn, barber, logout: barberLogout } = useBarberAuthStore()
  const { report } = useBugReporter('LoginModal')
  const haptics = useHaptics()
  
  // Core state
  const [step, setStep] = useState<Step>('phone')
  const [phone, setPhone] = useState('')
  const [fullname, setFullname] = useState('')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [isNewUser, setIsNewUser] = useState(false)
  const [confirmation, setConfirmation] = useState<OtpSession | null>(null)
  const [countdown, setCountdown] = useState(0)
  
  // Email fallback state
  const [smsError, setSmsError] = useState<string | null>(null)
  const [existingEmail, setExistingEmail] = useState<string | null>(null) // Email from existing user
  const [customerAuthMethod, setCustomerAuthMethod] = useState<'phone' | 'email' | 'both' | null>(null)
  

  // Check if barber is logged in and show blocked state
  useEffect(() => {
    if (isOpen && isBarberLoggedIn) {
      setStep('blocked')
    }
  }, [isOpen, isBarberLoggedIn])

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setStep('phone')
      setPhone('')
      setFullname('')
      setEmail('')
      setOtp('')
      setError(null)
      setLoading(false)
      setIsNewUser(false)
      setConfirmation(null)
      setCountdown(0)
      setSmsError(null)
      setExistingEmail(null)
      setCustomerAuthMethod(null)
      cleanupSmsSession()
    }
  }, [isOpen])

  // Countdown timer
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [countdown])

  const formatPhoneNumber = useCallback((phoneStr: string): string => {
    const cleaned = phoneStr.replace(/\D/g, '')
    if (cleaned.startsWith('0')) {
      return `+972${cleaned.slice(1)}`
    }
    if (cleaned.startsWith('972')) {
      return `+${cleaned}`
    }
    return `+972${cleaned}`
  }, [])

  const handlePhoneSubmit = async () => {
    const phoneClean = phone.replace(/\D/g, '')
    
    // Detailed validation with specific error messages
    if (!phoneClean) {
      setError('נא להזין מספר טלפון')
      return
    }
    
    if (!phoneClean.startsWith('05')) {
      setError('מספר הטלפון חייב להתחיל ב-05')
      return
    }
    
    if (phoneClean.length !== 10) {
      setError(`מספר הטלפון חייב להכיל 10 ספרות (הזנת ${phoneClean.length})`)
      return
    }
    
    setLoading(true)
    setError(null)
    
    try {
      // Check for trusted device token first (skip OTP if valid)
      const storedToken = getStoredDeviceToken()
      if (storedToken) {
        try {
          const deviceResponse = await fetch('/api/auth/validate-device', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone: phoneClean, deviceToken: storedToken }),
          })
          
          const deviceData = await deviceResponse.json()
          
          if (deviceData.success && deviceData.customer) {
            // Device is trusted - login directly without OTP
            console.log('[LoginModal] Trusted device found, logging in directly')
            const customer = await login(
              deviceData.customer.phone,
              deviceData.customer.fullname
            )
            
            if (customer) {
              haptics.success()
              showToast.success(`שלום ${customer.fullname}!`)
              onClose()
              return
            }
          }
          // If device validation failed, continue with normal flow
          console.log('[LoginModal] Device validation failed, proceeding with OTP')
        } catch (deviceErr) {
          // Device validation error - continue with normal flow
          console.log('[LoginModal] Device validation error, proceeding with OTP:', deviceErr)
        }
      }
      
      // Check if customer exists and their auth method
      const existingCustomer = await findCustomerByPhone(phoneClean)
      const authMethod = await getCustomerAuthMethod(phoneClean)
      setCustomerAuthMethod(authMethod)
      
      if (existingCustomer) {
        // Existing customer - welcome back!
        setFullname(existingCustomer.fullname)
        setExistingEmail(existingCustomer.email || null)
        setIsNewUser(false)
        
        // If user originally signed up with email only, go directly to email OTP
        if (authMethod === 'email' && existingCustomer.email) {
          setEmail(existingCustomer.email)
          await sendEmailOtpToUser(existingCustomer.email)
          return
        }
        
        // If user has both methods, let them choose
        if (authMethod === 'both' && existingCustomer.email) {
          setEmail(existingCustomer.email)
          setStep('auth-choice')
          setLoading(false)
          return
        }
      } else {
        // New customer - need to ask for name
        setIsNewUser(true)
        setStep('name')
        setLoading(false)
        return
      }
      
      // Check if it's a test user in development - offer choice
      if (process.env.NODE_ENV === 'development' && isTestUser(phoneClean)) {
        setStep('debug-choice')
        setLoading(false)
        return
      }
      
      // Send SMS OTP (for phone-only users)
      await sendOtpToPhone(phoneClean)
    } catch (err) {
      console.error('Phone check error:', err)
      await report(err, 'Customer phone check/lookup')
      
      // Provide specific error messages based on error type
      const errorMsg = err instanceof Error ? err.message : String(err)
      if (errorMsg.toLowerCase().includes('network') || 
          errorMsg.toLowerCase().includes('load failed') ||
          errorMsg.toLowerCase().includes('fetch')) {
        setError('בעיית תקשורת. בדוק את החיבור לאינטרנט ונסה שוב.')
      } else {
        setError('שגיאה בבדיקת המספר. נסה שוב.')
      }
      setLoading(false)
    }
  }
  
  const handleDebugChoice = async (useDebug: boolean) => {
    setSkipDebugMode(!useDebug)
    setLoading(true)
    await sendOtpToPhone(phone.replace(/\D/g, ''), !useDebug)
  }

  // Handle auth method choice for users with both SMS and Email
  const handleAuthChoiceSms = async () => {
    setLoading(true)
    setError(null)
    await sendOtpToPhone(phone.replace(/\D/g, ''))
  }

  const handleAuthChoiceEmail = async () => {
    if (!email) {
      setError('שגיאה - אימייל לא נמצא')
      return
    }
    setLoading(true)
    setError(null)
    await sendEmailOtpToUser(email)
  }

  const handleNameSubmit = async () => {
    if (!fullname.trim()) {
      setError('נא להזין שם מלא')
      return
    }
    
    setLoading(true)
    setError(null)
    
    await sendOtpToPhone(phone.replace(/\D/g, ''))
  }

  const sendOtpToPhone = async (phoneClean: string, forceRealOtp: boolean = false) => {
    try {
      const formattedPhone = formatPhoneNumber(phoneClean)
      const result = await sendSmsOtp(formattedPhone, SMS_WIDGET_CONTAINER_ID, forceRealOtp)
      
      if (result.success && result.session) {
        setConfirmation(result.session)
        setStep('otp')
        setCountdown(60)
        setSmsError(null)
        haptics.light()
        if (process.env.NODE_ENV === 'development' && result.isTestMode) {
          showToast.success('מצב בדיקה - קוד: ' + TEST_USER.otpCode)
        } else {
          showToast.success('קוד אימות נשלח!')
        }
        // Focus handled by InputOTP autoFocus
      } else {
        // SMS failed - offer email fallback
        const errorMsg = result.error || 'שגיאה בשליחת הקוד'
        setSmsError(errorMsg)
        
        // Show email fallback after any SMS failure
        setStep('email-fallback')
        showToast.error('שגיאה בשליחת SMS - נסה באמצעות אימייל')
      }
    } catch (err) {
      console.error('OTP send error:', err)
      await report(err, 'Sending OTP to customer phone')
      setSmsError('שגיאה בשליחת הקוד')
      setStep('email-fallback')
    }
    
    setLoading(false)
  }

  const sendEmailOtpToUser = async (emailAddress: string) => {
    try {
      const result = await sendEmailOtp(emailAddress)
      
      if (result.success) {
        setStep('email-otp')
        setCountdown(60)
        haptics.light()
        showToast.success('קוד אימות נשלח לאימייל!')
        // Focus handled by InputOTP autoFocus
      } else {
        setError(result.error || 'שגיאה בשליחת האימייל')
        showToast.error(result.error || 'שגיאה בשליחת האימייל')
      }
    } catch (err) {
      console.error('Email OTP send error:', err)
      await report(err, 'Sending email OTP to customer')
      setError('שגיאה בשליחת האימייל')
    }
    
    setLoading(false)
  }

  const handleEmailFallbackSubmit = async () => {
    if (!isValidEmail(email)) {
      setError('נא להזין כתובת אימייל תקינה')
      return
    }
    
    setLoading(true)
    setError(null)
    
    // Check if this email is already registered to a different phone
    const duplicateCheck = await checkEmailDuplicate(email, phone)
    if (duplicateCheck.isDuplicate) {
      setError(duplicateCheck.message || 'כתובת האימייל כבר רשומה במערכת')
      setLoading(false)
      return
    }
    
    // If email exists with same phone, this is an existing user - just verify
    if (duplicateCheck.existingCustomer) {
      await sendEmailOtpToUser(duplicateCheck.existingCustomer.email || email.trim().toLowerCase())
      return
    }
    
    await sendEmailOtpToUser(email.trim().toLowerCase())
  }

  const handleEmailSignupSubmit = async () => {
    if (!fullname.trim()) {
      setError('נא להזין שם מלא')
      return
    }
    if (!isValidEmail(email)) {
      setError('נא להזין כתובת אימייל תקינה')
      return
    }
    
    setLoading(true)
    setError(null)
    
    // Check if this email is already in use
    const existingByEmail = await findCustomerByEmail(email)
    if (existingByEmail) {
      // Email already exists - check if same phone
      const normalizedPhone = phone.replace(/\D/g, '')
      if (existingByEmail.phone !== normalizedPhone) {
        setError('כתובת האימייל כבר רשומה למספר טלפון אחר')
        setLoading(false)
        return
      }
      // Same user - set their name and proceed
      setFullname(existingByEmail.fullname)
    }
    
    // Check if phone already has a different email
    const existingByPhone = await findCustomerByPhone(phone)
    if (existingByPhone && existingByPhone.email && existingByPhone.email !== email.trim().toLowerCase()) {
      setError(`מספר הטלפון כבר רשום לאימייל אחר: ${existingByPhone.email}`)
      setLoading(false)
      return
    }
    
    await sendEmailOtpToUser(email.trim().toLowerCase())
  }

  const handleVerifyOtp = async (codeOverride?: string) => {
    const code = codeOverride || otp
    
    if (!code) {
      setError('נא להזין את קוד האימות')
      return
    }
    
    if (code.length !== 6) {
      setError(`הקוד חייב להכיל 6 ספרות (הזנת ${code.length})`)
      return
    }
    
    if (!confirmation) {
      setError('פג תוקף הקוד. נא לבקש קוד חדש.')
      return
    }
    
    setLoading(true)
    setError(null)
    
    try {
      const result = await verifySmsOtp(confirmation, code)
      
      if (result.success) {
        // Login successful - save to store
        // providerUid is stored in provider_uid column (e.g., "o19-0501234567")
        const customer = await login(phone.replace(/\D/g, ''), fullname, result.providerUid)
        
        if (customer) {
          // Create trusted device for future logins (30-day expiration)
          try {
            const trustResponse = await fetch('/api/auth/trust-device', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                customerId: customer.id,
                phone: customer.phone,
              }),
            })
            
            const trustData = await trustResponse.json()
            if (trustData.success && trustData.deviceToken) {
              saveDeviceToken(trustData.deviceToken)
              console.log('[LoginModal] Trusted device created for future logins')
            }
          } catch (trustErr) {
            // Don't fail login if trusted device creation fails
            console.error('[LoginModal] Failed to create trusted device:', trustErr)
          }
          
          haptics.success()
          showToast.success(`שלום ${customer.fullname}!`)
          onClose()
        } else {
          setError('שגיאה בהתחברות. נסה שוב.')
        }
      } else {
        // Provide specific error messages based on error type
        const errorMessage = result.error?.toLowerCase() || ''
        if (errorMessage.includes('expired') || errorMessage.includes('timeout')) {
          setError('פג תוקף הקוד. נא לבקש קוד חדש.')
        } else if (errorMessage.includes('invalid') || errorMessage.includes('wrong') || errorMessage.includes('incorrect')) {
          setError('הקוד שהוזן שגוי. נסה שוב.')
        } else if (errorMessage.includes('attempts') || errorMessage.includes('limit') || errorMessage.includes('blocked')) {
          setError('יותר מדי ניסיונות שגויים. נסה שוב מאוחר יותר.')
        } else {
          setError(result.error || 'הקוד שגוי. נסה שוב.')
        }
        setOtp('')
        haptics.light()
      }
    } catch (err) {
      console.error('Verify error:', err)
      await report(err, 'Verifying customer OTP code')
      
      const errorMsg = err instanceof Error ? err.message : String(err)
      if (errorMsg.toLowerCase().includes('network') || 
          errorMsg.toLowerCase().includes('load failed')) {
        setError('בעיית תקשורת. בדוק את החיבור לאינטרנט.')
      } else {
        setError('שגיאה באימות הקוד. נסה שוב.')
      }
    }
    
    setLoading(false)
  }

  const handleVerifyEmailOtp = async (codeOverride?: string) => {
    const code = codeOverride || otp
    
    if (!code) {
      setError('נא להזין את קוד האימות')
      return
    }
    
    if (code.length !== 6) {
      setError(`הקוד חייב להכיל 6 ספרות (הזנת ${code.length})`)
      return
    }
    
    setLoading(true)
    setError(null)
    
    try {
      const result = await verifyEmailOtp(email, code)
      
      if (result.success) {
        // Email verification successful - login/signup via email
        const customer = await loginWithEmail(
          phone.replace(/\D/g, ''), 
          fullname, 
          email.trim().toLowerCase(),
          result.supabaseUserId
        )
        
        if (customer) {
          haptics.success()
          showToast.success(`שלום ${customer.fullname}!`)
          onClose()
        } else {
          setError('שגיאה בהתחברות. נסה שוב.')
        }
      } else {
        // Provide specific error messages
        const errorMessage = result.error?.toLowerCase() || ''
        if (errorMessage.includes('expired') || errorMessage.includes('timeout')) {
          setError('פג תוקף הקוד. נא לבקש קוד חדש.')
        } else if (errorMessage.includes('invalid') || errorMessage.includes('wrong') || errorMessage.includes('incorrect')) {
          setError('הקוד שהוזן שגוי. נסה שוב.')
        } else if (errorMessage.includes('attempts') || errorMessage.includes('limit')) {
          setError('יותר מדי ניסיונות שגויים. נסה שוב מאוחר יותר.')
        } else {
          setError(result.error || 'הקוד שגוי. נסה שוב.')
        }
        setOtp('')
        haptics.light()
      }
    } catch (err) {
      console.error('Email verify error:', err)
      await report(err, 'Verifying customer email OTP code')
      
      const errorMsg = err instanceof Error ? err.message : String(err)
      if (errorMsg.toLowerCase().includes('network') || 
          errorMsg.toLowerCase().includes('load failed')) {
        setError('בעיית תקשורת. בדוק את החיבור לאינטרנט.')
      } else {
        setError('שגיאה באימות הקוד. נסה שוב.')
      }
    }
    
    setLoading(false)
  }

  const handleResendOtp = async () => {
    if (countdown > 0) return
    
    setLoading(true)
    setOtp('')
    await sendOtpToPhone(phone.replace(/\D/g, ''))
  }

  const handleResendEmailOtp = async () => {
    if (countdown > 0) return
    
    setLoading(true)
    setOtp('')
    await sendEmailOtpToUser(email)
  }

  const handleUseEmailInstead = () => {
    // Navigate to email fallback
    setError(null)
    setOtp('')
    
    // If existing customer has email, pre-fill it
    if (existingEmail) {
      setEmail(existingEmail)
    }
    
    // If new user, go to email signup, otherwise to email fallback
    if (isNewUser) {
      setStep('email-signup')
    } else {
      setStep('email-fallback')
    }
  }

  const handleTrySmsAgain = async () => {
    setLoading(true)
    setError(null)
    setStep('phone')
    await sendOtpToPhone(phone.replace(/\D/g, ''))
  }

  if (!isOpen) return null

  return (
    <Portal>
      <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="relative w-full sm:max-w-md sm:mx-4 bg-background-darker sm:bg-background-dark border-t sm:border border-white/10 sm:rounded-2xl rounded-t-2xl p-5 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto animate-slide-in-up sm:animate-fade-in">
        {/* Close button */}
        <Button
          variant="ghost"
          isIconOnly
          onPress={onClose}
          className="absolute top-4 left-4 w-10 h-10"
          aria-label="סגור"
        >
          <X size={20} strokeWidth={1.5} />
        </Button>
        
        {/* SMS provider widget container - hidden by default */}
        <div id={SMS_WIDGET_CONTAINER_ID} className="hidden" />
        
        {/* Title */}
        <h2 className="text-xl font-medium text-foreground-light text-center mb-6">
          {step === 'phone' && 'התחברות'}
          {step === 'name' && 'הרשמה'}
          {step === 'otp' && 'אימות טלפון'}
          {step === 'debug-choice' && '🧪 מצב בדיקה'}
          {step === 'blocked' && 'לא ניתן להתחבר'}
          {step === 'email-fallback' && 'התחברות באימייל'}
          {step === 'email-otp' && 'אימות אימייל'}
          {step === 'email-signup' && 'הרשמה באימייל'}
          {step === 'auth-choice' && 'בחר אופן אימות'}
        </h2>
        
        {/* Phone Step */}
        {step === 'phone' && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="phone" className="text-foreground-light text-sm">
                מספר טלפון
              </label>
                <input
                  id="phone"
                  type="tel"
                  dir="ltr"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value)
                    setError(null)
                  }}
                  placeholder="05XXXXXXXX"
                  className={cn(
                    'w-full p-3.5 rounded-xl bg-background-card border text-foreground-light placeholder:text-foreground-muted/50 outline-none focus:ring-2 focus:ring-accent-gold transition-all text-left text-base',
                    error ? 'border-red-400' : 'border-white/10'
                  )}
                />
              {error && <p className="text-red-400 text-xs">{error}</p>}
            </div>
            
            <Button
              variant="primary"
              onPress={handlePhoneSubmit}
              isDisabled={loading}
              className="w-full"
            >
              <Phone size={18} />
              {loading ? 'בודק...' : 'המשך עם SMS'}
            </Button>
            
            {/* Dev helper - fill test user */}
            {process.env.NODE_ENV === 'development' && (
              <Button
                variant="ghost"
                size="sm"
                onPress={() => {
                  setPhone(TEST_USER.phoneRaw)
                  setError(null)
                }}
                className="text-xs text-blue-400 hover:text-blue-300 w-full"
              >
                🧪 מלא טלפון בדיקה
              </Button>
            )}
          </div>
        )}
        
        {/* Name Step (new users only) */}
        {step === 'name' && (
          <div className="flex flex-col gap-4">
            <p className="text-foreground-muted text-sm text-center">
              לא מצאנו את המספר {phone} במערכת.
              <br />נא להזין את שמך להרשמה.
            </p>
            
            <div className="flex flex-col gap-2">
              <label htmlFor="fullname" className="text-foreground-light text-sm">
                שם מלא
              </label>
                <input
                  id="fullname"
                  type="text"
                  value={fullname}
                  onChange={(e) => {
                    setFullname(e.target.value)
                    setError(null)
                  }}
                  placeholder="הזן את שמך"
                  className={cn(
                    'w-full p-3.5 rounded-xl bg-background-card border text-foreground-light placeholder:text-foreground-muted/50 outline-none focus:ring-2 focus:ring-accent-gold transition-all text-base',
                    error ? 'border-red-400' : 'border-white/10'
                  )}
                />
              {error && <p className="text-red-400 text-xs">{error}</p>}
            </div>
            
            <Button
              variant="primary"
              onPress={handleNameSubmit}
              isDisabled={loading}
              className="w-full"
            >
              <Phone size={18} />
              {loading ? 'שולח קוד...' : 'קבל קוד ב-SMS'}
            </Button>
            
            {/* Email alternative */}
            <Button
              variant="ghost"
              onPress={() => setStep('email-signup')}
              className="w-full text-sm"
            >
              <Mail size={16} />
              העדף הרשמה באימייל
            </Button>
            
            <Button
              variant="ghost"
              onPress={() => setStep('phone')}
              className="w-full text-sm"
            >
              ← חזור
            </Button>
          </div>
        )}
        
        {/* Email Signup Step (new user email registration) */}
        {step === 'email-signup' && (
          <div className="flex flex-col gap-4">
            <p className="text-foreground-muted text-sm text-center">
              הרשמה באמצעות אימייל
            </p>
            
            <div className="flex flex-col gap-2">
              <label htmlFor="fullname-email" className="text-foreground-light text-sm">
                שם מלא
              </label>
              <input
                id="fullname-email"
                type="text"
                value={fullname}
                onChange={(e) => {
                  setFullname(e.target.value)
                  setError(null)
                }}
                placeholder="הזן את שמך"
                className={cn(
                  'w-full p-3.5 rounded-xl bg-background-card border text-foreground-light placeholder:text-foreground-muted/50 outline-none focus:ring-2 focus:ring-accent-gold transition-all text-base',
                  error && !fullname.trim() ? 'border-red-400' : 'border-white/10'
                )}
              />
            </div>
            
            <div className="flex flex-col gap-2">
              <label htmlFor="email-signup" className="text-foreground-light text-sm">
                אימייל
              </label>
              <input
                id="email-signup"
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
                  error && !isValidEmail(email) ? 'border-red-400' : 'border-white/10'
                )}
              />
              {error && <p className="text-red-400 text-xs">{error}</p>}
            </div>
            
            <Button
              variant="primary"
              onPress={handleEmailSignupSubmit}
              isDisabled={loading}
              className="w-full"
            >
              <Mail size={18} />
              {loading ? 'שולח קוד...' : 'קבל קוד לאימייל'}
            </Button>
            
            <Button
              variant="ghost"
              onPress={() => setStep('name')}
              className="w-full text-sm"
            >
              ← חזור להרשמה ב-SMS
            </Button>
          </div>
        )}
        
        {/* Debug Choice Step - only in development */}
        {process.env.NODE_ENV === 'development' && step === 'debug-choice' && (
          <div className="flex flex-col gap-4">
            <p className="text-foreground-muted text-sm text-center">
              זוהה משתמש בדיקה. איך תרצה להמשיך?
            </p>
            
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
              <p className="text-blue-400 text-sm text-center mb-2">
                <strong>מצב בדיקה:</strong> ללא שליחת SMS אמיתי
              </p>
              <p className="text-blue-400/80 text-xs text-center">
                קוד: <span className="font-mono font-bold">{TEST_USER.otpCode}</span>
              </p>
            </div>
            
            <Button
              variant="primary"
              onPress={() => handleDebugChoice(true)}
              isDisabled={loading}
              className="w-full"
            >
              {loading ? 'טוען...' : '🧪 השתמש במצב בדיקה'}
            </Button>
            
            <Button
              variant="secondary"
              onPress={() => handleDebugChoice(false)}
              isDisabled={loading}
              className="w-full"
            >
              {loading ? 'טוען...' : '📱 שלח SMS אמיתי'}
            </Button>
            
            <Button
              variant="ghost"
              onPress={() => setStep('phone')}
              className="w-full text-sm"
            >
              ← חזור
            </Button>
          </div>
        )}
        
        {/* Auth Choice Step - for users with both SMS and Email */}
        {step === 'auth-choice' && (
          <div className="flex flex-col gap-4">
            <div className="text-center mb-2">
              <p className="text-foreground-light text-sm">
                שלום <span className="font-semibold text-accent-gold">{fullname}</span>! 👋
              </p>
              <p className="text-foreground-muted text-xs mt-1">
                איך תרצה להתחבר הפעם?
              </p>
            </div>
            
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                <p className="text-red-400 text-sm text-center">{error}</p>
              </div>
            )}
            
            {/* SMS Option */}
            <Button
              variant="primary"
              onPress={handleAuthChoiceSms}
              isDisabled={loading}
              className="w-full py-3.5"
            >
              <MessageSquare size={20} />
              <div className="flex flex-col items-start">
                <span>קוד SMS לטלפון</span>
                <span className="text-xs opacity-75" dir="ltr">{phone}</span>
              </div>
            </Button>
            
            {/* Email Option */}
            <Button
              variant="secondary"
              onPress={handleAuthChoiceEmail}
              isDisabled={loading}
              className="w-full py-3.5"
            >
              <Mail size={20} />
              <div className="flex flex-col items-start">
                <span>קוד לאימייל</span>
                <span className="text-xs opacity-75">{email}</span>
              </div>
            </Button>
            
            {loading && (
              <p className="text-foreground-muted text-xs text-center animate-pulse">
                שולח קוד אימות...
              </p>
            )}
            
            <Button
              variant="ghost"
              onPress={() => {
                setStep('phone')
                setEmail('')
                setError(null)
              }}
              className="w-full text-sm"
            >
              ← חזור
            </Button>
          </div>
        )}
        
        {/* SMS OTP Step */}
        {step === 'otp' && (
          <div className="flex flex-col gap-4">
            <p className="text-foreground-muted text-sm text-center">
              קוד אימות נשלח ל-{phone}
            </p>
            
            {/* Test user hint - only in development */}
            {process.env.NODE_ENV === 'development' && isTestUser(phone) && (
              <div className="px-4 py-2 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <p className="text-blue-400 text-xs text-center">
                  🧪 משתמש בדיקה - הקוד הוא: <span className="font-mono font-bold">{TEST_USER.otpCode}</span>
                </p>
              </div>
            )}
            
            <div className="flex justify-center" dir="ltr">
              <InputOTP
                maxLength={6}
                value={otp}
                onChange={(value) => {
                  setOtp(value)
                  if (error) setError(null)
                }}
                onComplete={(code) => {
                  if (!loading && confirmation) {
                    handleVerifyOtp(code)
                  }
                }}
                isDisabled={loading}
                isInvalid={!!error}
                pattern={REGEXP_ONLY_DIGITS}
                autoFocus
              >
                <InputOTP.Group className="gap-2">
                  {[0, 1, 2, 3, 4, 5].map((index) => (
                    <InputOTP.Slot
                      key={index}
                      index={index}
                      className={cn(
                        'w-10 h-12 xs:w-11 xs:h-13 text-lg font-bold rounded-lg bg-background-card border-2 text-foreground-light',
                        error ? 'border-red-400' : 'border-white/20 data-[filled=true]:border-accent-gold/50 data-[active=true]:border-accent-gold data-[active=true]:ring-2 data-[active=true]:ring-accent-gold/30'
                      )}
                    />
                  ))}
                </InputOTP.Group>
              </InputOTP>
            </div>
            
            {error && (
              <p className="text-red-400 text-xs text-center">{error}</p>
            )}
            
            <Button
              variant="primary"
              onPress={() => handleVerifyOtp()}
              isDisabled={loading || otp.length !== 6}
              className="w-full"
            >
              {loading ? 'מאמת...' : 'התחבר'}
            </Button>
            
            <div className="text-center">
              {countdown > 0 ? (
                <p className="text-foreground-muted text-sm">
                  ניתן לשלוח שוב בעוד {countdown} שניות
                </p>
              ) : (
                <Button
                  variant="ghost"
                  onPress={handleResendOtp}
                  isDisabled={loading}
                  size="sm"
                  className="text-accent-gold hover:underline"
                >
                  שלח קוד חדש
                </Button>
              )}
            </div>
            
            {/* Email fallback option - always visible */}
            <div className="border-t border-white/10 pt-3 mt-2">
              <Button
                variant="ghost"
                onPress={handleUseEmailInstead}
                className="w-full text-sm"
              >
                <Mail size={16} />
                לא מקבל SMS? המשך באימייל
              </Button>
            </div>
            
            <Button
              variant="ghost"
              onPress={() => setStep('phone')}
              className="w-full text-sm"
            >
              ← חזור
            </Button>
          </div>
        )}
        
        {/* Email Fallback Step (after SMS failure) */}
        {step === 'email-fallback' && (
          <div className="flex flex-col gap-4">
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
            
            <p className="text-foreground-muted text-sm text-center">
              {existingEmail 
                ? `נשלח קוד לאימייל שלך: ${existingEmail}`
                : 'הזן את כתובת האימייל שלך לקבלת קוד אימות'
              }
            </p>
            
            <div className="flex flex-col gap-2">
              <label htmlFor="email" className="text-foreground-light text-sm">
                אימייל
              </label>
              <input
                id="email"
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
            
            <Button
              variant="primary"
              onPress={handleEmailFallbackSubmit}
              isDisabled={loading}
              className="w-full"
            >
              <Mail size={18} />
              {loading ? 'שולח קוד...' : 'שלח קוד לאימייל'}
            </Button>
            
            {/* Try SMS again option */}
            <Button
              variant="ghost"
              onPress={handleTrySmsAgain}
              isDisabled={loading}
              className="w-full text-sm"
            >
              <Phone size={16} />
              נסה שוב ב-SMS
            </Button>
            
            <Button
              variant="ghost"
              onPress={() => setStep('phone')}
              className="w-full text-sm"
            >
              ← חזור
            </Button>
          </div>
        )}
        
        {/* Email OTP Verification Step */}
        {step === 'email-otp' && (
          <div className="flex flex-col gap-4">
            <p className="text-foreground-muted text-sm text-center">
              קוד אימות נשלח ל-{email}
            </p>
            
            <div className="flex justify-center" dir="ltr">
              <InputOTP
                maxLength={6}
                value={otp}
                onChange={(value) => {
                  setOtp(value)
                  if (error) setError(null)
                }}
                onComplete={(code) => {
                  if (!loading) {
                    handleVerifyEmailOtp(code)
                  }
                }}
                isDisabled={loading}
                isInvalid={!!error}
                pattern={REGEXP_ONLY_DIGITS}
                autoFocus
              >
                <InputOTP.Group className="gap-2">
                  {[0, 1, 2, 3, 4, 5].map((index) => (
                    <InputOTP.Slot
                      key={index}
                      index={index}
                      className={cn(
                        'w-10 h-12 xs:w-11 xs:h-13 text-lg font-bold rounded-lg bg-background-card border-2 text-foreground-light',
                        error ? 'border-red-400' : 'border-white/20 data-[filled=true]:border-accent-gold/50 data-[active=true]:border-accent-gold data-[active=true]:ring-2 data-[active=true]:ring-accent-gold/30'
                      )}
                    />
                  ))}
                </InputOTP.Group>
              </InputOTP>
            </div>
            
            {error && (
              <p className="text-red-400 text-xs text-center">{error}</p>
            )}
            
            <Button
              variant="primary"
              onPress={() => handleVerifyEmailOtp()}
              isDisabled={loading || otp.length !== 6}
              className="w-full"
            >
              {loading ? 'מאמת...' : 'התחבר'}
            </Button>
            
            <div className="text-center">
              {countdown > 0 ? (
                <p className="text-foreground-muted text-sm">
                  ניתן לשלוח שוב בעוד {countdown} שניות
                </p>
              ) : (
                <Button
                  variant="ghost"
                  onPress={handleResendEmailOtp}
                  isDisabled={loading}
                  size="sm"
                  className="text-accent-gold hover:underline"
                >
                  שלח קוד חדש
                </Button>
              )}
            </div>
            
            <Button
              variant="ghost"
              onPress={() => {
                setOtp('')
                setError(null)
                if (customerAuthMethod === 'email') {
                  setStep('email-fallback')
                } else {
                  setStep('otp')
                }
              }}
              className="w-full text-sm"
            >
              ← חזור
            </Button>
          </div>
        )}
        
        {/* Blocked Step - Barber is already logged in */}
        {step === 'blocked' && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center">
                <AlertTriangle size={32} strokeWidth={1.5} className="text-amber-400" />
              </div>
              <p className="text-foreground-light text-center font-medium">
                אתה מחובר כספר
              </p>
              <p className="text-foreground-muted text-sm text-center">
                {barber?.fullname || barber?.email}
              </p>
            </div>
            
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
              <p className="text-amber-400 text-sm text-center">
                לא ניתן להתחבר לשני סוגי חשבונות בו-זמנית.
                <br />
                יש להתנתק מחשבון הספר כדי להתחבר כלקוח.
              </p>
            </div>
            
            <Button
              variant="danger"
              onPress={() => {
                barberLogout()
                setStep('phone')
              }}
              className="w-full"
            >
              התנתק מחשבון הספר
            </Button>
            
            <Button
              variant="secondary"
              onPress={onClose}
              className="w-full"
            >
              סגור
            </Button>
          </div>
        )}
        
        {/* Barber Login Link - hide when blocked */}
        {step !== 'blocked' && (
          <div className="mt-6 pt-4 border-t border-white/10">
            <Button
              variant="ghost"
              onPress={() => {
                onClose()
                router.push('/barber/login')
              }}
              className="w-full text-sm"
            >
              <Scissors size={14} strokeWidth={1.5} />
              <span>כניסה לספרים</span>
              <ArrowRight size={14} strokeWidth={1.5} />
            </Button>
          </div>
        )}
        </div>
      </div>
    </Portal>
  )
}
