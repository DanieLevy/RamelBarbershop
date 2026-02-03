'use client'

import { cn, formatDateHebrew, formatTime as formatTimeUtil } from '@/lib/utils'
import { X, Calendar, Scissors, User, Phone, AlertCircle, CheckCircle, XCircle, History, StickyNote } from 'lucide-react'
import type { Reservation, Service, User as UserType, Customer } from '@/types/database'
import { Portal } from '@/components/ui/Portal'

interface ReservationWithDetails extends Reservation {
  services?: Service
  users?: UserType
  customers?: Customer
}

interface AppointmentDetailModalProps {
  isOpen: boolean
  onClose: () => void
  reservation: ReservationWithDetails | null
  variant?: 'barber' | 'customer'
}

export function AppointmentDetailModal({
  isOpen,
  onClose,
  reservation,
  variant = 'barber'
}: AppointmentDetailModalProps) {
  if (!isOpen || !reservation) return null

  const isCancelled = reservation.status === 'cancelled'
  const isCompleted = reservation.status === 'completed'
  const isPast = reservation.time_timestamp < Date.now()

  // Status styling
  const getStatusConfig = () => {
    if (isCancelled) {
      return {
        icon: XCircle,
        label: 'בוטל',
        bgColor: 'bg-red-500/10',
        textColor: 'text-red-400',
        borderColor: 'border-red-500/20'
      }
    }
    if (isCompleted) {
      return {
        icon: CheckCircle,
        label: 'הושלם',
        bgColor: 'bg-green-500/10',
        textColor: 'text-green-400',
        borderColor: 'border-green-500/20'
      }
    }
    if (isPast) {
      return {
        icon: History,
        label: 'עבר',
        bgColor: 'bg-foreground-muted/10',
        textColor: 'text-foreground-muted',
        borderColor: 'border-foreground-muted/20'
      }
    }
    return {
      icon: CheckCircle,
      label: 'מאושר',
      bgColor: 'bg-accent-gold/10',
      textColor: 'text-accent-gold',
      borderColor: 'border-accent-gold/20'
    }
  }

  const status = getStatusConfig()
  const StatusIcon = status.icon

  // Format date for created_at
  const formatCreatedDate = (dateStr: string): string => {
    const date = new Date(dateStr)
    const day = date.getDate().toString().padStart(2, '0')
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const year = date.getFullYear()
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')
    return `${day}/${month}/${year} בשעה ${hours}:${minutes}`
  }

  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="relative w-full max-w-md bg-background-card border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-fade-in-up">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="text-lg font-medium text-foreground-light">פרטי התור</h2>
          <button
            onClick={onClose}
            className="icon-btn p-2 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="סגור"
          >
            <X className="w-5 h-5 text-foreground-muted" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Status Badge */}
          <div className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-xl border',
            status.bgColor,
            status.borderColor
          )}>
            <StatusIcon className={cn('w-5 h-5', status.textColor)} />
            <span className={cn('font-medium', status.textColor)}>{status.label}</span>
          </div>

          {/* Appointment Details */}
          <div className="space-y-3">
            {/* Date & Time */}
            <div className="flex items-start gap-3 p-3 bg-white/[0.03] rounded-xl">
              <Calendar className="w-5 h-5 text-accent-gold mt-0.5" />
              <div>
                <p className="text-sm text-foreground-muted">תאריך ושעה</p>
                <p className="font-medium text-foreground-light">
                  {formatDateHebrew(reservation.date_timestamp)}
                </p>
                <p className="text-sm text-foreground-muted">
                  {formatTimeUtil(reservation.time_timestamp)}
                </p>
              </div>
            </div>

            {/* Service */}
            <div className="flex items-start gap-3 p-3 bg-white/[0.03] rounded-xl">
              <Scissors className="w-5 h-5 text-accent-gold mt-0.5" />
              <div>
                <p className="text-sm text-foreground-muted">שירות</p>
                <p className="font-medium text-foreground-light">
                  {reservation.services?.name_he || 'שירות'}
                </p>
                {reservation.services?.price && (
                  <p className="text-sm text-foreground-muted">
                    ₪{reservation.services.price}
                  </p>
                )}
              </div>
            </div>

            {/* Customer (for barber view) / Barber (for customer view) */}
            <div className="flex items-start gap-3 p-3 bg-white/[0.03] rounded-xl">
              <User className="w-5 h-5 text-accent-gold mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-foreground-muted">
                  {variant === 'barber' ? 'לקוח' : 'ספר'}
                </p>
                <p className="font-medium text-foreground-light">
                  {variant === 'barber' 
                    ? reservation.customer_name 
                    : (reservation.users?.fullname || 'ספר')}
                </p>
                {variant === 'barber' && reservation.customer_phone && (
                  <a
                    href={`tel:${reservation.customer_phone}`}
                    className="flex items-center gap-1 text-sm text-accent-gold hover:underline mt-1"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    {reservation.customer_phone}
                  </a>
                )}
              </div>
            </div>

            {/* Barber Notes */}
            {variant === 'barber' && reservation.barber_notes && (
              <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                <StickyNote className="w-5 h-5 text-amber-400 mt-0.5" />
                <div>
                  <p className="text-sm text-amber-400/80">הערות הספר</p>
                  <p className="font-medium text-foreground-light text-sm whitespace-pre-wrap">
                    {reservation.barber_notes}
                  </p>
                </div>
              </div>
            )}

            {/* Booking Info */}
            {reservation.created_at && (
              <div className="flex items-start gap-3 p-3 bg-white/[0.03] rounded-xl">
                <History className="w-5 h-5 text-accent-gold mt-0.5" />
                <div>
                  <p className="text-sm text-foreground-muted">נקבע בתאריך</p>
                  <p className="font-medium text-foreground-light text-sm">
                    {formatCreatedDate(reservation.created_at)}
                  </p>
                </div>
              </div>
            )}

            {/* Cancellation Info */}
            {isCancelled && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-red-400/80">פרטי ביטול</p>
                    <p className="font-medium text-red-400">
                      בוטל ע״י {reservation.cancelled_by === 'barber' ? 'הספר' : 'הלקוח'}
                    </p>
                    {reservation.cancellation_reason && (
                      <p className="text-sm text-red-400/80 mt-1">
                        סיבה: {reservation.cancellation_reason}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10">
          <button
            onClick={onClose}
            className="w-full py-3 px-4 bg-white/[0.05] hover:bg-white/[0.1] rounded-xl font-medium text-foreground-light transition-colors"
          >
            סגור
          </button>
        </div>
        </div>
      </div>
    </Portal>
  )
}

