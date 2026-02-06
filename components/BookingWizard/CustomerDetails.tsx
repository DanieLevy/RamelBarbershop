'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useBookingStore } from '@/store/useBookingStore'
import { cn } from '@/lib/utils'
import { TEST_USER } from '@/lib/sms/sms-service'
import { findCustomerByPhone } from '@/lib/services/customer.service'
import { Loader2, User, CheckCircle, Check } from 'lucide-react'
import { Button } from '@heroui/react'

type Step = 'phone' | 'name'

export function CustomerDetails() {
  const { customer, setCustomer, nextStep, prevStep } = useBookingStore()
  const [step, setStep] = useState<Step>('phone')
  const [phone, setPhone] = useState(customer.phone || '')
  const [fullname, setFullname] = useState(customer.fullname || '')
  const [existingCustomerName, setExistingCustomerName] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [privacyConsent, setPrivacyConsent] = useState(false)
  
  // Helper to fill test user phone
  const fillTestPhone = () => {
    setPhone(TEST_USER.phoneRaw)
    setError(null)
  }

  // Validate Israeli phone number
  const validatePhone = (phoneStr: string): string | null => {
    const phoneClean = phoneStr.replace(/\D/g, '')
    if (!phoneClean || phoneClean.length !== 10 || !phoneClean.startsWith('05')) {
      return 'נא להזין מספר טלפון ישראלי תקין (05XXXXXXXX)'
    }
    return null
  }

  // Handle phone submission - check if user exists
  const handlePhoneSubmit = async () => {
    const phoneClean = phone.replace(/\D/g, '')
    const phoneError = validatePhone(phoneClean)
    
    if (phoneError) {
      setError(phoneError)
      return
    }
    
    setLoading(true)
    setError(null)
    
    try {
      const existingCustomer = await findCustomerByPhone(phoneClean)
      
      if (existingCustomer) {
        // User exists - show welcome and proceed
        setExistingCustomerName(existingCustomer.fullname)
        setCustomer({ 
          phone: phoneClean, 
          fullname: existingCustomer.fullname 
        })
        // Short delay to show welcome message before proceeding
        setTimeout(() => {
          nextStep()
        }, 1500)
      } else {
        // User doesn't exist - ask for name
        setCustomer({ phone: phoneClean, fullname: '' })
        setStep('name')
      }
    } catch (err) {
      console.error('Error checking phone:', err)
      setError('שגיאה בבדיקת המספר, נסה שנית')
    } finally {
      setLoading(false)
    }
  }

  // Handle name submission for new users
  const handleNameSubmit = () => {
    if (!fullname.trim()) {
      setError('נא להזין שם מלא')
      return
    }
    if (!privacyConsent) {
      setError('יש לאשר את מדיניות הפרטיות')
      return
    }
    
    setCustomer({ 
      phone: phone.replace(/\D/g, ''), 
      fullname: fullname.trim() 
    })
    nextStep()
  }

  // If showing welcome back message
  if (existingCustomerName) {
    return (
      <div className="flex flex-col gap-6 items-center justify-center py-8">
        <div className="w-16 h-16 rounded-full bg-accent-gold/20 flex items-center justify-center">
          <CheckCircle className="w-8 h-8 text-accent-gold" />
        </div>
        <div className="text-center">
          <h2 className="text-xl text-foreground-light font-medium mb-2">
            שלום, {existingCustomerName}! 👋
          </h2>
          <p className="text-foreground-muted text-sm">
            ממשיך לאימות...
          </p>
        </div>
        <Loader2 className="w-6 h-6 text-accent-gold animate-spin" />
      </div>
    )
  }

  // Phone input step
  if (step === 'phone') {
    return (
      <div className="flex flex-col gap-6">
        <h2 className="text-xl text-center text-foreground-light font-medium">
          הזן מספר טלפון
        </h2>
        
        <p className="text-foreground-muted text-sm text-center">
          נבדוק אם יש לך חשבון קיים
        </p>
        
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
              disabled={loading}
              className={cn(
                'w-full p-3.5 rounded-xl bg-background-card border text-foreground-light placeholder:text-foreground-muted/50 outline-none focus:ring-2 focus:ring-accent-gold transition-all text-left text-base',
                error ? 'border-red-400' : 'border-white/10',
                loading && 'opacity-60'
              )}
              onKeyDown={(e) => e.key === 'Enter' && handlePhoneSubmit()}
            />
            {error && (
              <span className="text-red-400 text-xs">{error}</span>
            )}
            <span className="text-foreground-muted text-xs">
              קוד אימות יישלח למספר זה
            </span>
          </div>
        </div>
        
        <Button
          variant="primary"
          onPress={handlePhoneSubmit}
          isDisabled={loading}
          className="w-full"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              בודק...
            </span>
          ) : (
            'המשך'
          )}
        </Button>
        
        <Button
          variant="ghost"
          onPress={prevStep}
          isDisabled={loading}
          className="w-full text-sm"
        >
          ← חזור לבחירת שעה
        </Button>
        
        {/* Dev helper - fill test user phone */}
        {process.env.NODE_ENV === 'development' && (
          <Button
            variant="ghost"
            size="sm"
            onPress={fillTestPhone}
            className="mt-2 text-xs text-blue-400 hover:text-blue-300 w-full"
          >
            🧪 מלא טלפון בדיקה
          </Button>
        )}
      </div>
    )
  }

  // Name input step (for new users)
  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-xl text-center text-foreground-light font-medium">
        הרשמה
      </h2>
      
      <div className="flex items-center gap-3 p-3 rounded-xl bg-background-card/50 border border-white/10">
        <div className="w-10 h-10 rounded-full bg-accent-gold/20 flex items-center justify-center">
          <User className="w-5 h-5 text-accent-gold" />
        </div>
        <div>
          <p className="text-foreground-muted text-xs">מספר טלפון</p>
          <p className="text-foreground-light text-sm font-medium" dir="ltr">{phone}</p>
        </div>
      </div>
      
      <p className="text-foreground-muted text-sm text-center">
        לא מצאנו את המספר במערכת.
        <br />
        נא להזין את שמך להרשמה.
      </p>
      
      <div className="flex flex-col gap-4">
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
            placeholder="הזן את שמך המלא"
            className={cn(
              'w-full p-3.5 rounded-xl bg-background-card border text-foreground-light placeholder:text-foreground-muted/50 outline-none focus:ring-2 focus:ring-accent-gold transition-all text-base',
              error && !fullname.trim() ? 'border-red-400' : 'border-white/10'
            )}
            onKeyDown={(e) => e.key === 'Enter' && handleNameSubmit()}
            autoFocus
          />
        </div>
        
        {/* Privacy Consent Checkbox */}
        <label className="flex items-start gap-3 cursor-pointer group">
          <button
            type="button"
            role="checkbox"
            aria-checked={privacyConsent}
            onClick={() => {
              setPrivacyConsent(!privacyConsent)
              setError(null)
            }}
            className={cn(
              'w-5 h-5 rounded border flex items-center justify-center shrink-0 mt-0.5 transition-all',
              privacyConsent
                ? 'bg-accent-gold border-accent-gold'
                : error && !privacyConsent
                  ? 'border-red-400 bg-transparent'
                  : 'border-white/30 bg-transparent group-hover:border-white/50'
            )}
          >
            {privacyConsent && <Check size={14} className="text-background-dark" strokeWidth={3} />}
          </button>
          <span className="text-foreground-muted text-sm leading-relaxed">
            אני מסכים/ה ל
            <Link 
              href="/privacy-policy" 
              target="_blank"
              className="text-accent-gold hover:underline mx-1"
              onClick={(e) => e.stopPropagation()}
            >
              מדיניות הפרטיות
            </Link>
            ולקבלת הודעות תזכורת בנוגע לתורים
          </span>
        </label>
        
        {error && (
          <span className="text-red-400 text-xs">{error}</span>
        )}
      </div>
      
      <Button
        variant="primary"
        onPress={handleNameSubmit}
        className="w-full"
      >
        המשך לאימות
      </Button>
      
      <Button
        variant="ghost"
        onPress={() => {
          setStep('phone')
          setError(null)
        }}
        className="w-full text-sm"
      >
        ← חזור
      </Button>
    </div>
  )
}
