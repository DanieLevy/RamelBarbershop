'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuthStore } from '@/store/useAuthStore'
import { createClient } from '@/lib/supabase/client'
import { cn, formatTime } from '@/lib/utils'
import { format, isSameDay, addDays } from 'date-fns'
import { he } from 'date-fns/locale'
import { Calendar, Clock, ChevronLeft, Scissors } from 'lucide-react'
import type { Reservation, Service, User } from '@/types/database'

interface ReservationWithDetails extends Reservation {
  services?: Service
  users?: User
}

export function UpcomingAppointmentBanner() {
  const { customer, isLoggedIn, isInitialized } = useAuthStore()
  const [nextAppointment, setNextAppointment] = useState<ReservationWithDetails | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isInitialized && isLoggedIn && customer?.id) {
      fetchNextAppointment()
    } else if (isInitialized) {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitialized, isLoggedIn, customer?.id])

  const fetchNextAppointment = async () => {
    if (!customer?.id && !customer?.phone) {
      setLoading(false)
      return
    }
    
    try {
      const supabase = createClient()
      const now = Date.now()
      
      let query = supabase
        .from('reservations')
        .select('*, services(*), users(*)')
        .eq('status', 'confirmed')
        .gt('time_timestamp', now)
        .order('time_timestamp', { ascending: true })
        .limit(1)
      
      if (customer.id) {
        query = query.eq('customer_id', customer.id)
      } else if (customer.phone) {
        query = query.eq('customer_phone', customer.phone)
      }
      
      const { data } = await query
      
      if (data && data.length > 0) {
        setNextAppointment(data[0] as ReservationWithDetails)
      }
    } catch (err) {
      console.error('Error fetching next appointment:', err)
    } finally {
      setLoading(false)
    }
  }

  // Don't show if not logged in or no upcoming appointment
  if (!isInitialized || loading || !isLoggedIn || !nextAppointment) {
    return null
  }

  // Format smart date
  const getSmartDate = (timestamp: number): string => {
    const date = new Date(timestamp)
    const today = new Date()
    const tomorrow = addDays(today, 1)
    
    if (isSameDay(date, today)) {
      return 'היום'
    } else if (isSameDay(date, tomorrow)) {
      return 'מחר'
    } else {
      return format(date, 'EEEE d/M', { locale: he })
    }
  }

  const smartDate = getSmartDate(nextAppointment.time_timestamp)
  const timeStr = formatTime(nextAppointment.time_timestamp)
  const isToday = isSameDay(new Date(nextAppointment.time_timestamp), new Date())

  return (
    <Link
      href="/my-appointments"
      className={cn(
        'block w-full py-2 px-4 transition-colors',
        'bg-accent-gold/10 hover:bg-accent-gold/15 border-b border-accent-gold/20'
      )}
    >
      <div className="container-mobile flex items-center justify-between gap-3">
        {/* Info */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Icon */}
          <div className={cn(
            'w-8 h-8 rounded-full flex items-center justify-center shrink-0',
            isToday ? 'bg-accent-gold/30' : 'bg-accent-gold/20'
          )}>
            <Calendar size={14} className="text-accent-gold" />
          </div>
          
          {/* Details */}
          <div className="min-w-0 flex-1">
            <p className="text-xs text-accent-gold font-medium truncate">
              התור הקרוב שלך
            </p>
            <p className="text-xs text-foreground-muted flex items-center gap-1.5 truncate">
              <span className={cn(isToday && 'text-accent-gold font-medium')}>{smartDate}</span>
              <Clock size={10} />
              <span dir="ltr">{timeStr}</span>
              <span className="text-foreground-muted/50">•</span>
              <Scissors size={10} />
              <span className="truncate">{nextAppointment.services?.name_he}</span>
            </p>
          </div>
        </div>
        
        {/* Arrow */}
        <ChevronLeft size={16} className="text-accent-gold/60 shrink-0" />
      </div>
    </Link>
  )
}

