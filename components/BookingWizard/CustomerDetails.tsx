'use client'

import { useState } from 'react'
import { useBookingStore } from '@/store/useBookingStore'
import { cn } from '@/lib/utils'

export function CustomerDetails() {
  const { customer, setCustomer, nextStep, prevStep } = useBookingStore()
  const [errors, setErrors] = useState<{ fullname?: string; phone?: string }>({})

  const validateAndSubmit = () => {
    const newErrors: typeof errors = {}
    
    if (!customer.fullname.trim()) {
      newErrors.fullname = 'נא להזין שם מלא'
    }
    
    // Validate Israeli phone number (10 digits starting with 05)
    const phoneClean = customer.phone.replace(/\D/g, '')
    if (!phoneClean || phoneClean.length !== 10 || !phoneClean.startsWith('05')) {
      newErrors.phone = 'נא להזין מספר טלפון ישראלי תקין (05XXXXXXXX)'
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }
    
    // Update phone to clean format
    setCustomer({ phone: phoneClean })
    nextStep()
  }

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-xl text-center text-foreground-light font-medium">
        פרטים אישיים
      </h2>
      
      <div className="flex flex-col gap-4">
        {/* Full Name */}
        <div className="flex flex-col gap-2">
          <label htmlFor="fullname" className="text-foreground-light text-sm">
            שם מלא
          </label>
          <input
            id="fullname"
            type="text"
            value={customer.fullname}
            onChange={(e) => {
              setCustomer({ fullname: e.target.value })
              setErrors((prev) => ({ ...prev, fullname: undefined }))
            }}
            placeholder="הזן את שמך המלא"
            className={cn(
              'w-full p-3 rounded-xl bg-background-card border text-foreground-light placeholder:text-foreground-muted/50 outline-none focus:ring-2 focus:ring-accent-gold transition-all',
              errors.fullname ? 'border-red-400' : 'border-white/10'
            )}
          />
          {errors.fullname && (
            <span className="text-red-400 text-xs">{errors.fullname}</span>
          )}
        </div>
        
        {/* Phone */}
        <div className="flex flex-col gap-2">
          <label htmlFor="phone" className="text-foreground-light text-sm">
            מספר טלפון
          </label>
          <input
            id="phone"
            type="tel"
            dir="ltr"
            value={customer.phone}
            onChange={(e) => {
              setCustomer({ phone: e.target.value })
              setErrors((prev) => ({ ...prev, phone: undefined }))
            }}
            placeholder="05XXXXXXXX"
            className={cn(
              'w-full p-3 rounded-xl bg-background-card border text-foreground-light placeholder:text-foreground-muted/50 outline-none focus:ring-2 focus:ring-accent-gold transition-all text-left',
              errors.phone ? 'border-red-400' : 'border-white/10'
            )}
          />
          {errors.phone && (
            <span className="text-red-400 text-xs">{errors.phone}</span>
          )}
          <span className="text-foreground-muted text-xs">
            קוד אימות יישלח למספר זה
          </span>
        </div>
      </div>
      
      <button
        onClick={validateAndSubmit}
        className="w-full py-3 px-4 rounded-xl bg-accent-gold text-background-dark font-medium hover:bg-accent-gold/90 transition-all"
      >
        המשך לאימות
      </button>
      
      <button
        onClick={prevStep}
        className="text-foreground-muted hover:text-foreground-light transition-colors text-sm"
      >
        ← חזור לבחירת שעה
      </button>
    </div>
  )
}

