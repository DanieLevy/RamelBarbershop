'use client'

import { useState, useEffect, useRef } from 'react'
import { useBookingStore } from '@/store/useBookingStore'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { BarberWithWorkDays } from '@/types/database'
import { cn, formatTime } from '@/lib/utils'
import { Check, Calendar, Clock, Scissors, User, Phone } from 'lucide-react'

interface LoggedInConfirmationProps {
  barber: BarberWithWorkDays
}

export function LoggedInConfirmation({ barber }: LoggedInConfirmationProps) {
  const {
    service,
    date,
    timeTimestamp,
    loggedInCustomer,
    prevStep,
    reset,
  } = useBookingStore()
  
  const [isCreating, setIsCreating] = useState(false)
  const [isCreated, setIsCreated] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const hasCreatedRef = useRef(false)

  // Auto-create reservation when component mounts
  useEffect(() => {
    if (!hasCreatedRef.current && !isCreated && !isCreating) {
      hasCreatedRef.current = true
      createReservation()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const createReservation = async () => {
    if (!service || !date || !timeTimestamp || !loggedInCustomer) {
      setError('חסרים נתונים ליצירת התור')
      return
    }
    
    setIsCreating(true)
    setError(null)
    
    try {
      const supabase = createClient()
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: insertError } = await (supabase.from('reservations') as any).insert({
        barber_id: barber.id,
        service_id: service.id,
        customer_id: loggedInCustomer.id,
        customer_name: loggedInCustomer.fullname,
        customer_phone: loggedInCustomer.phone,
        date_timestamp: date.dateTimestamp,
        time_timestamp: timeTimestamp,
        day_name: date.dayName,
        day_num: date.dayNum,
        status: 'confirmed',
      })
      
      if (insertError) {
        console.error('Error creating reservation:', insertError)
        setError('שגיאה ביצירת התור. נסה שוב.')
        toast.error('שגיאה ביצירת התור')
        hasCreatedRef.current = false
        return
      }
      
      setIsCreated(true)
      toast.success('התור נקבע בהצלחה!')
    } catch (err) {
      console.error('Unexpected error creating reservation:', err)
      setError('שגיאה בלתי צפויה. נסה שוב.')
      hasCreatedRef.current = false
    } finally {
      setIsCreating(false)
    }
  }

  if (isCreating) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <div className="w-10 h-10 border-3 border-accent-gold border-t-transparent rounded-full animate-spin" />
        <p className="text-foreground-light text-lg">יוצר את התור...</p>
        <p className="text-foreground-muted text-sm">רק רגע...</p>
      </div>
    )
  }

  if (error && !isCreated) {
    return (
      <div className="flex flex-col gap-6">
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-center">
          <p className="text-red-400">{error}</p>
        </div>
        
        <button
          onClick={() => {
            hasCreatedRef.current = false
            createReservation()
          }}
          className="w-full py-3 bg-accent-gold text-background-dark rounded-xl font-medium hover:bg-accent-gold/90 transition-colors"
        >
          נסה שוב
        </button>
        
        <button
          onClick={prevStep}
          className="text-foreground-muted hover:text-foreground-light text-sm transition-colors"
        >
          ← חזור
        </button>
      </div>
    )
  }

  if (!isCreated) {
    return null
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Success Icon */}
      <div className="flex justify-center">
        <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center">
          <Check size={40} strokeWidth={1.5} className="text-green-500" />
        </div>
      </div>
      
      <div className="text-center">
        <h2 className="text-2xl text-foreground-light font-medium">התור נקבע בהצלחה!</h2>
        <p className="text-foreground-muted mt-2">
          {loggedInCustomer?.fullname}, להתראות!
        </p>
      </div>
      
      {/* Booking Details Card */}
      <div className="bg-background-card border border-white/10 rounded-xl p-5 space-y-4">
        <h3 className="text-foreground-light font-medium text-center border-b border-white/10 pb-3">
          פרטי התור
        </h3>
        
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <User size={16} strokeWidth={1.5} className="text-accent-gold" />
            <span className="text-foreground-muted">ספר:</span>
            <span className="text-foreground-light font-medium">{barber.fullname}</span>
          </div>
          
          <div className="flex items-center gap-3">
            <Scissors size={16} strokeWidth={1.5} className="text-accent-gold" />
            <span className="text-foreground-muted">שירות:</span>
            <span className="text-foreground-light font-medium">{service?.name_he}</span>
          </div>
          
          <div className="flex items-center gap-3">
            <Calendar size={16} strokeWidth={1.5} className="text-accent-gold" />
            <span className="text-foreground-muted">תאריך:</span>
            <span className="text-foreground-light font-medium">
              {date?.dayName} {date?.dayNum}
            </span>
          </div>
          
          <div className="flex items-center gap-3">
            <Clock size={16} strokeWidth={1.5} className="text-accent-gold" />
            <span className="text-foreground-muted">שעה:</span>
            <span className="text-foreground-light font-medium" dir="ltr">
              {timeTimestamp && formatTime(timeTimestamp)}
            </span>
          </div>
          
          <div className="flex items-center gap-3">
            <Phone size={16} strokeWidth={1.5} className="text-accent-gold" />
            <span className="text-foreground-muted">טלפון:</span>
            <span className="text-foreground-light font-medium" dir="ltr">
              {loggedInCustomer?.phone}
            </span>
          </div>
        </div>
        
        {service?.price && (
          <div className="border-t border-white/10 pt-3 mt-3">
            <div className="flex justify-between items-center">
              <span className="text-foreground-muted">מחיר:</span>
              <span className="text-accent-gold font-bold text-lg">₪{service.price}</span>
            </div>
          </div>
        )}
      </div>
      
      {/* Actions */}
      <div className="flex flex-col gap-3">
        <a
          href="/my-appointments"
          className={cn(
            'w-full py-3 px-4 rounded-xl font-medium text-center transition-all',
            'bg-accent-gold/10 border border-accent-gold/30 text-accent-gold hover:bg-accent-gold/20'
          )}
        >
          צפה בכל התורים שלי
        </a>
        
        <button
          onClick={() => {
            reset()
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }}
          className="w-full py-3 px-4 rounded-xl font-medium bg-accent-gold text-background-dark hover:bg-accent-gold/90 transition-colors"
        >
          הזמן תור נוסף
        </button>
      </div>
    </div>
  )
}
