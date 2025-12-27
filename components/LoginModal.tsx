'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useAuthStore } from '@/store/useAuthStore'
import { findCustomerByPhone } from '@/lib/services/customer.service'
import { sendPhoneOtp, verifyOtp, clearRecaptchaVerifier, isTestUser, TEST_USER } from '@/lib/firebase/config'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { FaTimes, FaCut } from 'react-icons/fa'
import { useRouter } from 'next/navigation'
import type { ConfirmationResult } from 'firebase/auth'

interface LoginModalProps {
  isOpen: boolean
  onClose: () => void
}

type Step = 'phone' | 'name' | 'otp'

const RECAPTCHA_CONTAINER_ID = 'login-recaptcha-container'

export function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const router = useRouter()
  const { login } = useAuthStore()
  
  const [step, setStep] = useState<Step>('phone')
  const [phone, setPhone] = useState('')
  const [fullname, setFullname] = useState('')
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [isNewUser, setIsNewUser] = useState(false)
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null)
  const [countdown, setCountdown] = useState(0)
  
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([])

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setStep('phone')
      setPhone('')
      setFullname('')
      setOtp(['', '', '', '', '', ''])
      setError(null)
      setLoading(false)
      setIsNewUser(false)
      setConfirmation(null)
      setCountdown(0)
      clearRecaptchaVerifier()
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
    
    if (!phoneClean || phoneClean.length !== 10 || !phoneClean.startsWith('05')) {
      setError('נא להזין מספר טלפון ישראלי תקין (05XXXXXXXX)')
      return
    }
    
    setLoading(true)
    setError(null)
    
    try {
      // Check if customer exists
      const existingCustomer = await findCustomerByPhone(phoneClean)
      
      if (existingCustomer) {
        // Existing customer - use their name
        setFullname(existingCustomer.fullname)
        setIsNewUser(false)
      } else {
        // New customer - need to ask for name
        setIsNewUser(true)
        setStep('name')
        setLoading(false)
        return
      }
      
      // Send OTP
      await sendOtpToPhone(phoneClean)
    } catch (err) {
      console.error('Phone check error:', err)
      setError('שגיאה בבדיקת המספר')
      setLoading(false)
    }
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

  const sendOtpToPhone = async (phoneClean: string) => {
    try {
      const formattedPhone = formatPhoneNumber(phoneClean)
      const result = await sendPhoneOtp(formattedPhone, RECAPTCHA_CONTAINER_ID)
      
      if (result.success && result.confirmation) {
        setConfirmation(result.confirmation)
        setStep('otp')
        setCountdown(60)
        toast.success('קוד אימות נשלח!')
        setTimeout(() => otpInputRefs.current[0]?.focus(), 100)
      } else {
        setError(result.error || 'שגיאה בשליחת הקוד')
        toast.error('שגיאה בשליחת הקוד')
      }
    } catch (err) {
      console.error('OTP send error:', err)
      setError('שגיאה בשליחת הקוד')
    }
    
    setLoading(false)
  }

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return
    
    const newOtp = [...otp]
    newOtp[index] = value.slice(-1)
    setOtp(newOtp)
    
    if (error) setError(null)
    if (value && index < 5) {
      otpInputRefs.current[index + 1]?.focus()
    }
  }

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus()
    }
  }

  const handleVerifyOtp = async () => {
    const code = otp.join('')
    
    if (code.length !== 6) {
      setError('נא להזין קוד בן 6 ספרות')
      return
    }
    
    if (!confirmation) {
      setError('נא לבקש קוד חדש')
      return
    }
    
    setLoading(true)
    setError(null)
    
    try {
      const result = await verifyOtp(confirmation, code)
      
      if (result.success) {
        // Login successful - save to store
        const customer = await login(phone.replace(/\D/g, ''), fullname, result.firebaseUid)
        
        if (customer) {
          toast.success(`שלום ${customer.fullname}!`)
          onClose()
        } else {
          setError('שגיאה בהתחברות')
        }
      } else {
        setError(result.error || 'קוד שגוי')
        setOtp(['', '', '', '', '', ''])
        otpInputRefs.current[0]?.focus()
      }
    } catch (err) {
      console.error('Verify error:', err)
      setError('שגיאה באימות')
    }
    
    setLoading(false)
  }

  const handleResendOtp = async () => {
    if (countdown > 0) return
    
    setLoading(true)
    await sendOtpToPhone(phone.replace(/\D/g, ''))
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative w-full sm:max-w-md sm:mx-4 bg-background-darker sm:bg-background-dark border-t sm:border border-white/10 sm:rounded-2xl rounded-t-2xl p-5 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto animate-slide-in-up sm:animate-fade-in">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 left-4 text-foreground-muted hover:text-foreground-light transition-colors"
          aria-label="סגור"
        >
          <FaTimes className="w-5 h-5" />
        </button>
        
        {/* reCAPTCHA container */}
        <div id={RECAPTCHA_CONTAINER_ID} />
        
        {/* Title */}
        <h2 className="text-xl font-medium text-foreground-light text-center mb-6">
          {step === 'phone' && 'התחברות'}
          {step === 'name' && 'הרשמה'}
          {step === 'otp' && 'אימות טלפון'}
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
            
            <button
              onClick={handlePhoneSubmit}
              disabled={loading}
              className={cn(
                'w-full py-3 rounded-xl font-medium transition-all',
                loading
                  ? 'bg-foreground-muted/30 text-foreground-muted cursor-not-allowed'
                  : 'bg-accent-gold text-background-dark hover:bg-accent-gold/90'
              )}
            >
              {loading ? 'בודק...' : 'המשך'}
            </button>
            
            {/* Dev helper - fill test user */}
            {process.env.NODE_ENV === 'development' && (
              <button
                onClick={() => {
                  setPhone(TEST_USER.phoneRaw)
                  setError(null)
                }}
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors flex items-center justify-center gap-1"
              >
                🧪 מלא טלפון בדיקה
              </button>
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
            
            <button
              onClick={handleNameSubmit}
              disabled={loading}
              className={cn(
                'w-full py-3 rounded-xl font-medium transition-all',
                loading
                  ? 'bg-foreground-muted/30 text-foreground-muted cursor-not-allowed'
                  : 'bg-accent-gold text-background-dark hover:bg-accent-gold/90'
              )}
            >
              {loading ? 'שולח קוד...' : 'המשך'}
            </button>
            
            <button
              onClick={() => setStep('phone')}
              className="text-foreground-muted hover:text-foreground-light text-sm transition-colors"
            >
              ← חזור
            </button>
          </div>
        )}
        
        {/* OTP Step */}
        {step === 'otp' && (
          <div className="flex flex-col gap-4">
            <p className="text-foreground-muted text-sm text-center">
              קוד אימות נשלח ל-{phone}
            </p>
            
            {/* Test user hint */}
            {isTestUser(phone) && (
              <div className="px-4 py-2 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <p className="text-blue-400 text-xs text-center">
                  🧪 משתמש בדיקה - הקוד הוא: <span className="font-mono font-bold">{TEST_USER.otpCode}</span>
                </p>
              </div>
            )}
            
            <div className="flex justify-center gap-2 xs:gap-3" dir="ltr">
              {otp.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => { otpInputRefs.current[index] = el }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(index, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(index, e)}
                  disabled={loading}
                  className={cn(
                    'w-10 h-12 xs:w-11 xs:h-13 text-center text-lg font-bold rounded-lg bg-background-card border-2 text-foreground-light outline-none focus:ring-2 focus:ring-accent-gold transition-all',
                    error ? 'border-red-400' : digit ? 'border-accent-gold/50' : 'border-white/20'
                  )}
                />
              ))}
            </div>
            
            {error && (
              <p className="text-red-400 text-xs text-center">{error}</p>
            )}
            
            <button
              onClick={handleVerifyOtp}
              disabled={loading || otp.join('').length !== 6}
              className={cn(
                'w-full py-3 rounded-xl font-medium transition-all',
                loading || otp.join('').length !== 6
                  ? 'bg-foreground-muted/30 text-foreground-muted cursor-not-allowed'
                  : 'bg-accent-gold text-background-dark hover:bg-accent-gold/90'
              )}
            >
              {loading ? 'מאמת...' : 'התחבר'}
            </button>
            
            <div className="text-center">
              {countdown > 0 ? (
                <p className="text-foreground-muted text-sm">
                  ניתן לשלוח שוב בעוד {countdown} שניות
                </p>
              ) : (
                <button
                  onClick={handleResendOtp}
                  disabled={loading}
                  className="text-accent-gold hover:underline text-sm"
                >
                  שלח קוד חדש
                </button>
              )}
            </div>
            
            <button
              onClick={() => setStep('phone')}
              className="text-foreground-muted hover:text-foreground-light text-sm transition-colors"
            >
              ← חזור
            </button>
          </div>
        )}
        
        {/* Barber Login Link */}
        <div className="mt-6 pt-4 border-t border-white/10">
          <button
            onClick={() => {
              onClose()
              router.push('/barber/login')
            }}
            className="w-full flex items-center justify-center gap-2 py-2.5 text-sm text-foreground-muted hover:text-accent-gold transition-colors"
          >
            <FaCut className="w-3.5 h-3.5" />
            <span>כניסה לספרים</span>
          </button>
        </div>
      </div>
    </div>
  )
}

