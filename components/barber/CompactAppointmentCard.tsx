'use client'

import { cn, formatTime as formatTimeUtil } from '@/lib/utils'
import { Phone, X, Clock, Scissors, User, AlertCircle } from 'lucide-react'
import type { Reservation, Service, User as UserType } from '@/types/database'

interface ReservationWithService extends Reservation {
  services?: Service
  users?: UserType
}

interface CompactAppointmentCardProps {
  reservation: ReservationWithService
  onCancel?: (id: string) => void
  onCall?: (phone: string) => void
  onClick?: (reservation: ReservationWithService) => void
  isCancelling?: boolean
  showBarberName?: boolean
  variant?: 'barber' | 'customer'
}

export function CompactAppointmentCard({
  reservation,
  onCancel,
  onCall,
  onClick,
  isCancelling,
  showBarberName = false,
  variant = 'barber'
}: CompactAppointmentCardProps) {
  const now = Date.now()
  const isPast = reservation.time_timestamp < now
  const isCancelled = reservation.status === 'cancelled'

  // Format smart date/time
  const formatSmartDateTime = (timestamp: number): string => {
    const date = new Date(timestamp)
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const timeStr = formatTimeUtil(timestamp)

    if (date.toDateString() === today.toDateString()) {
      return `היום ${timeStr}`
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return `מחר ${timeStr}`
    } else {
      const day = date.getDate().toString().padStart(2, '0')
      const month = (date.getMonth() + 1).toString().padStart(2, '0')
      return `${day}/${month} ${timeStr}`
    }
  }

  return (
    <div
      onClick={() => onClick?.(reservation)}
      className={cn(
        'group relative flex items-center gap-3 p-3 rounded-xl transition-all duration-200',
        'bg-white/[0.03] border border-white/[0.06]',
        onClick && 'cursor-pointer hover:bg-white/[0.06] hover:border-white/[0.1]',
        isCancelled && 'opacity-60',
        isPast && !isCancelled && 'opacity-70'
      )}
    >
      {/* Status indicator line */}
      <div
        className={cn(
          'absolute right-0 top-2 bottom-2 w-1 rounded-full',
          isCancelled ? 'bg-red-500/60' : isPast ? 'bg-foreground-muted/30' : 'bg-accent-gold/60'
        )}
      />

      {/* Main content */}
      <div className="flex-1 min-w-0 pr-2">
        {/* Customer/Barber name & Service */}
        <div className="flex items-center gap-2 mb-1">
          <User className="w-3.5 h-3.5 text-foreground-muted shrink-0" />
          <span className="font-medium text-foreground-light text-sm truncate">
            {variant === 'barber' ? reservation.customer_name : (reservation.users?.fullname || 'ספר')}
          </span>
          {showBarberName && reservation.users && (
            <>
              <span className="text-foreground-muted text-xs">•</span>
              <span className="text-foreground-muted text-xs truncate">{reservation.users.fullname}</span>
            </>
          )}
        </div>

        {/* Service & Time */}
        <div className="flex items-center gap-3 text-xs text-foreground-muted">
          <span className="flex items-center gap-1">
            <Scissors className="w-3 h-3" />
            <span className="truncate max-w-[80px]">{reservation.services?.name_he || 'שירות'}</span>
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>{formatSmartDateTime(reservation.time_timestamp)}</span>
          </span>
        </div>

        {/* Cancelled info */}
        {isCancelled && reservation.cancelled_by && (
          <div className="flex items-center gap-1 mt-1.5 text-xs text-red-400/80">
            <AlertCircle className="w-3 h-3" />
            <span>
              בוטל ע״י {reservation.cancelled_by === 'barber' ? 'הספר' : 'הלקוח'}
            </span>
          </div>
        )}
      </div>

      {/* Actions */}
      {!isCancelled && !isPast && (
        <div className="flex items-center gap-1 shrink-0">
          {/* Phone button */}
          {onCall && variant === 'barber' && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onCall(reservation.customer_phone)
              }}
              className="icon-btn p-2 rounded-lg bg-white/[0.05] hover:bg-accent-gold/20 text-foreground-muted hover:text-accent-gold transition-all"
              aria-label="התקשר ללקוח"
            >
              <Phone className="w-4 h-4" />
            </button>
          )}

          {/* Cancel button */}
          {onCancel && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onCancel(reservation.id)
              }}
              disabled={isCancelling}
              className={cn(
                'icon-btn p-2 rounded-lg transition-all',
                'bg-white/[0.05] hover:bg-red-500/20 text-foreground-muted hover:text-red-400',
                isCancelling && 'opacity-50 pointer-events-none'
              )}
              aria-label="בטל תור"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}

