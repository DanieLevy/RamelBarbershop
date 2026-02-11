/**
 * ReservationRow Component
 *
 * Renders a single reservation in the timeline view.
 * Displays customer info, time, service, and action buttons.
 */

'use client'

import { cn } from '@/lib/utils'
import { getExternalLinkProps } from '@/lib/utils/external-link'
import { Phone, X, MessageCircle, Pencil } from 'lucide-react'
import { Button } from '@heroui/react'
import type { Reservation, Service } from '@/types/database'

interface ReservationWithService extends Reservation {
  services?: Service
  isRecurring?: boolean
}

interface ReservationRowProps {
  reservation: ReservationWithService
  smartDate: { date: string; time: string; isToday: boolean }
  isUpcoming: boolean
  isCancelled: boolean
  isPast: boolean
  isHighlighted: boolean
  updatingId: string | null
  onDetail: (reservation: ReservationWithService) => void
  onCancel: (reservation: ReservationWithService) => void
  onEdit?: (reservation: ReservationWithService) => void
  formatPhoneForWhatsApp: (phone: string) => string
}

export const ReservationRow = ({
  reservation: res,
  smartDate,
  isUpcoming,
  isCancelled,
  isPast,
  isHighlighted,
  updatingId,
  onDetail,
  onCancel,
  onEdit,
  formatPhoneForWhatsApp,
}: ReservationRowProps) => {
  return (
    <div
      onClick={() => onDetail(res)}
      className={cn(
        'flex items-center gap-3 px-3 sm:px-4 py-3 transition-all cursor-pointer hover:bg-white/[0.03]',
        isPast && 'opacity-50 bg-white/[0.01]',
        isCancelled && 'opacity-60',
        isHighlighted && 'bg-accent-gold/10 ring-2 ring-accent-gold/50 ring-inset animate-pulse'
      )}
      role="button"
      tabIndex={0}
      aria-label={`תור של ${res.customer_name}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onDetail(res)
        }
      }}
    >
      {/* Time Display */}
      <div className="flex flex-col items-center shrink-0 w-12">
        <span
          className={cn(
            'text-lg font-medium tabular-nums',
            isUpcoming
              ? 'text-accent-gold'
              : isPast
                ? 'text-foreground-muted/60'
                : 'text-foreground-muted'
          )}
        >
          {smartDate.time}
        </span>
        <span className="text-[10px] text-foreground-muted/70">
          {smartDate.isToday ? 'היום' : smartDate.date}
        </span>
      </div>

      {/* Status Line */}
      <div
        className={cn(
          'w-1 h-10 rounded-full shrink-0',
          isCancelled ? 'bg-red-500/60' : isUpcoming ? 'bg-accent-gold' : 'bg-foreground-muted/20'
        )}
      />

      {/* Main Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p
            className={cn(
              'text-foreground-light font-medium text-sm truncate',
              isCancelled && 'line-through decoration-foreground-muted/50'
            )}
          >
            {res.customer_name}
          </p>
          {/* Past indicator badge */}
          {isPast && !isCancelled && (
            <span className="px-1.5 py-0.5 rounded bg-white/[0.08] text-foreground-muted/60 text-[10px] shrink-0">
              הסתיים
            </span>
          )}
        </div>
        <p
          className={cn(
            'text-foreground-muted text-xs truncate',
            isCancelled && 'line-through decoration-foreground-muted/30'
          )}
        >
          {res.services?.name_he || 'שירות'}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        {/* WhatsApp */}
        {res.customer_phone && (
          <a
            {...getExternalLinkProps(
              `https://wa.me/${formatPhoneForWhatsApp(res.customer_phone)}`
            )}
            onClick={(e) => {
              e.stopPropagation()
              const linkProps = getExternalLinkProps(
                `https://wa.me/${formatPhoneForWhatsApp(res.customer_phone)}`
              )
              if (linkProps.onClick) linkProps.onClick(e)
            }}
            className="icon-btn p-1.5 rounded-lg hover:bg-green-500/10 transition-colors"
            aria-label="שלח הודעה בוואטסאפ"
            title="וואטסאפ"
          >
            <MessageCircle size={15} strokeWidth={1.5} className="text-green-500" />
          </a>
        )}

        {/* Phone */}
        <a
          href={`tel:${res.customer_phone}`}
          onClick={(e) => e.stopPropagation()}
          className="icon-btn p-1.5 rounded-lg hover:bg-accent-gold/10 transition-colors"
          aria-label="התקשר"
          title="התקשר"
        >
          <Phone size={15} strokeWidth={1.5} className="text-accent-gold" />
        </a>

        {/* Edit - Only for upcoming confirmed appointments */}
        {res.status === 'confirmed' && isUpcoming && onEdit && (
          <div onClick={(e) => e.stopPropagation()}>
            <Button
              onPress={() => onEdit(res)}
              isDisabled={updatingId === res.id}
              isIconOnly
              variant="ghost"
              className={cn(
                'icon-btn p-1 rounded-lg transition-colors min-w-[28px] w-7 h-7',
                updatingId === res.id
                  ? 'opacity-50 cursor-not-allowed'
                  : 'hover:bg-accent-gold/10 text-accent-gold/70'
              )}
              aria-label="ערוך תור"
            >
              <Pencil size={13} strokeWidth={1.5} />
            </Button>
          </div>
        )}

        {/* Cancel - Only for upcoming appointments */}
        {res.status === 'confirmed' && isUpcoming && (
          <div onClick={(e) => e.stopPropagation()}>
            <Button
              onPress={() => onCancel(res)}
              isDisabled={updatingId === res.id}
              isIconOnly
              variant="ghost"
              className={cn(
                'icon-btn p-1 rounded-lg transition-colors min-w-[28px] w-7 h-7',
                updatingId === res.id
                  ? 'opacity-50 cursor-not-allowed'
                  : 'hover:bg-red-500/10 text-red-400'
              )}
              aria-label="בטל"
            >
              <X size={14} strokeWidth={1.5} />
            </Button>
          </div>
        )}

        {/* Cancelled Badge */}
        {isCancelled && (
          <span className="px-2 py-1 rounded-lg bg-red-500/15 text-red-400 text-xs shrink-0">
            בוטל
          </span>
        )}
      </div>
    </div>
  )
}
