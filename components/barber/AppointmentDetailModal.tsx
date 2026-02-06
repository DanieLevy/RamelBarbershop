'use client'

import { cn, formatDateHebrew, formatTime as formatTimeUtil } from '@/lib/utils'
import { Calendar, Scissors, User, Phone, AlertCircle, CheckCircle, XCircle, History, StickyNote } from 'lucide-react'
import type { Reservation, Service, User as UserType, Customer } from '@/types/database'
import { Button, Modal } from '@heroui/react'

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
  if (!reservation) return null

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
    <Modal>
      <Modal.Backdrop
        variant="blur"
        isOpen={isOpen}
        onOpenChange={(open) => !open && onClose()}
        className="z-50"
      >
        <Modal.Container placement="center" size="md">
          <Modal.Dialog className="bg-background-card border border-white/10 rounded-2xl overflow-hidden">
            <Modal.CloseTrigger className="text-foreground-muted hover:text-foreground-light" />
            
            <Modal.Header className="border-b border-white/10">
              <Modal.Heading className="text-lg font-medium text-foreground-light">פרטי התור</Modal.Heading>
            </Modal.Header>

            <Modal.Body className="p-4 space-y-4">
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
            </Modal.Body>

            <Modal.Footer className="border-t border-white/10">
              <Button
                variant="secondary"
                slot="close"
                className="w-full"
              >
                סגור
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  )
}

