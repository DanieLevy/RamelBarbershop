'use client'

import { useState, useEffect, useRef } from 'react'
import { useBookingStore } from '@/store/useBookingStore'
import { showToast } from '@/lib/toast'
import type { BarberWithWorkDays } from '@/types/database'
import { cn, formatTime, formatDateHebrew } from '@/lib/utils'
import { Check, Calendar, Clock, Scissors, User, Phone } from 'lucide-react'
import { Button } from '@heroui/react'
import { useBugReporter } from '@/hooks/useBugReporter'
import { useHaptics } from '@/hooks/useHaptics'
import { BlockedUserModal } from './BlockedUserModal'
import { Confetti } from '@/components/ui/Confetti'
import { createReservation as createReservationService, checkCustomerEligibility } from '@/lib/services/booking.service'

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
  const { report } = useBugReporter('LoggedInConfirmation')
  const haptics = useHaptics()
  
  const [isCreating, setIsCreating] = useState(false)
  const [isCreated, setIsCreated] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isBlocked, setIsBlocked] = useState(false)
  
  const hasCreatedRef = useRef(false)

  // Auto-create reservation when component mounts
  useEffect(() => {
    if (!hasCreatedRef.current && !isCreated && !isCreating) {
      hasCreatedRef.current = true
      handleCreateReservation()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleCreateReservation = async () => {
    if (!service || !date || !timeTimestamp || !loggedInCustomer) {
      setError('חסרים נתונים ליצירת התור')
      return
    }
    
    setIsCreating(true)
    setError(null)
    
    try {
      // First check customer eligibility (blocked status, booking limits)
      const eligibility = await checkCustomerEligibility(loggedInCustomer.id)
      
      if (eligibility.isBlocked) {
        setIsBlocked(true)
        setIsCreating(false)
        return
      }
      
      if (!eligibility.eligible) {
        setError(eligibility.limits.message || 'לא ניתן לקבוע תור כרגע')
        showToast.error(eligibility.limits.message || 'הגעת למקסימום התורים המותרים')
        hasCreatedRef.current = false
        setIsCreating(false)
        return
      }
      
      // Use the centralized booking service with atomic database function
      const result = await createReservationService({
        barberId: barber.id,
        serviceId: service.id,
        customerId: loggedInCustomer.id,
        customerName: loggedInCustomer.fullname,
        customerPhone: loggedInCustomer.phone,
        dateTimestamp: date.dateTimestamp,
        timeTimestamp: timeTimestamp,
        dayName: date.dayName,
        dayNum: date.dayNum,
      })
      
      if (!result.success) {
        console.error('[Booking] Creation failed:', result.error)
        setError(result.message || 'שגיאה ביצירת התור')
        showToast.error(result.message || 'שגיאה ביצירת התור')
        hasCreatedRef.current = false
        setIsCreating(false)
        return
      }
      
      // Send push notification to barber (fire and forget)
      if (result.reservationId) {
        fetch('/api/push/notify-booking', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reservationId: result.reservationId,
            customerId: loggedInCustomer.id,
            barberId: barber.id,
            customerName: loggedInCustomer.fullname,
            barberName: barber.fullname,
            serviceName: service.name_he,
            appointmentTime: timeTimestamp
          })
        }).catch(err => console.log('Push notification error:', err))
      }
      
      setIsCreated(true)
      haptics.success() // Haptic feedback for successful booking
      showToast.success('התור נקבע בהצלחה!')
    } catch (err) {
      console.error('Unexpected error creating reservation:', err)
      await report(err, 'Creating reservation (exception)')
      setError('שגיאה בלתי צפויה. נסה שוב.')
      hasCreatedRef.current = false
    } finally {
      setIsCreating(false)
    }
  }

  // Show blocked modal if customer is blocked
  if (isBlocked) {
    return <BlockedUserModal isOpen={true} />
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
        
        <Button
          variant="primary"
          onPress={() => {
            hasCreatedRef.current = false
            handleCreateReservation()
          }}
          className="w-full"
        >
          נסה שוב
        </Button>
        
        <Button
          variant="ghost"
          onPress={prevStep}
          className="text-sm"
        >
          ← חזור
        </Button>
      </div>
    )
  }

  if (!isCreated) {
    return null
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Confetti celebration */}
      <Confetti />
      
      {/* Success Icon */}
      <div className="flex justify-center">
        <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center">
          <Check size={40} strokeWidth={1.5} className="text-green-500" />
        </div>
      </div>
      
      <div className="text-center">
        <h2 className="text-2xl text-foreground-light font-medium">התור נקבע בהצלחה!</h2>
        <p className="text-foreground-muted mt-2">
          תודה {loggedInCustomer?.fullname}! נשמח לראותך 💈
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
              {date?.dateTimestamp ? formatDateHebrew(date.dateTimestamp) : `${date?.dayName} ${date?.dayNum}`}
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
        
        <Button
          variant="primary"
          onPress={() => {
            reset()
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }}
          className="w-full"
        >
          הזמן תור נוסף
        </Button>
      </div>
    </div>
  )
}
