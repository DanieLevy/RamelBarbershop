'use client'

import { useState, useTransition, useCallback, useMemo, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import type { BarberWithWorkDays } from '@/types/database'
import { ArrowLeft, ArrowRight, Instagram, Scissors } from 'lucide-react'
import { cn, getPreferredBarberSlug, isTimeWithinBusinessHours } from '@/lib/utils'
import { openExternalLink } from '@/lib/utils/external-link'
import { Spinner } from '@heroui/react'

interface BarberCardProps {
  barber: BarberWithWorkDays
  /** Index for staggered animation */
  index?: number
}

type AvailabilityStatus = 'available' | 'later' | 'off'

interface AvailabilityInfo {
  status: AvailabilityStatus
  label: string
  hours: string | null
}

/**
 * Premium Barber Card - dark themed vertical card for carousel
 *
 * Features:
 * - 4:3 barber image at top with rounded corners
 * - Instagram icon overlay on top-left of image
 * - Barber name + status indicator + working hours
 * - Divider + centered "Book Now" CTA (transparent bg, white text)
 * - Hover/press micro-interactions
 */
export const BarberCard = ({ barber, index = 0 }: BarberCardProps) => {
  const [isPending, startTransition] = useTransition()
  const [isNavigating, setIsNavigating] = useState(false)
  const [isImageHovered, setIsImageHovered] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  const showLoader = isPending || isNavigating

  // Time-aware availability check using work_days (no extra API call)
  const availability: AvailabilityInfo = useMemo(() => {
    const now = new Date()
    const israelOptions = { timeZone: 'Asia/Jerusalem' } as const

    const todayName = now
      .toLocaleDateString('en-US', { weekday: 'long', ...israelOptions })
      .toLowerCase()

    const todayWorkDay = barber.work_days?.find(
      (d) => d.day_of_week === todayName && d.is_working
    )

    if (!todayWorkDay) {
      return { status: 'off' as const, label: 'סגור היום', hours: null }
    }

    const currentTime = now.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      ...israelOptions,
    })

    const start = todayWorkDay.start_time?.slice(0, 5) || '09:00'
    const end = todayWorkDay.end_time?.slice(0, 5) || '20:00'

    const hoursStr = `${start} - ${end}`

    if (isTimeWithinBusinessHours(currentTime, start, end)) {
      return { status: 'available' as const, label: 'עובד כעת', hours: hoursStr }
    }

    const currentMinutes = parseInt(currentTime.split(':')[0]) * 60 + parseInt(currentTime.split(':')[1])
    const startMinutes = parseInt(start.split(':')[0]) * 60 + parseInt(start.split(':')[1])

    if (currentMinutes < startMinutes) {
      return { status: 'later' as const, label: `נפתח ב-${start}`, hours: hoursStr }
    }

    return { status: 'off' as const, label: 'סגור כעת', hours: hoursStr }
  }, [barber.work_days])

  const handleNavigation = useCallback(() => {
    setIsNavigating(true)
    startTransition(() => {
      // Navigation happens via Link
    })
  }, [])

  // Build URL using preferred slug
  const preferredSlug = getPreferredBarberSlug(
    (barber as { name_en?: string | null }).name_en,
    barber.username
  )
  const barberUrl = preferredSlug ? `/barber/${preferredSlug}` : `/barber/${barber.id}`

  const handleInstagramClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const url = (barber as { instagram_url?: string | null }).instagram_url
      if (url) {
        openExternalLink(url)
      }
    },
    [barber]
  )

  const instagramUrl = (barber as { instagram_url?: string | null }).instagram_url
  const imgX = (barber as { img_position_x?: number }).img_position_x ?? 50
  const imgY = (barber as { img_position_y?: number }).img_position_y ?? 30

  return (
    <div
      ref={cardRef}
      className={cn(
        'group relative flex-shrink-0 w-[220px] rounded-[18px] overflow-hidden',
        'bg-[#141414]',
        'shadow-[0_6px_20px_rgba(0,0,0,0.3)]',
        'transition-all duration-250 ease-out',
        'hover:shadow-[0_12px_32px_rgba(0,0,0,0.45)] hover:scale-[1.02]',
        'active:scale-[0.98]',
        'select-none'
      )}
      style={{
        animationDelay: `${index * 80}ms`,
        animationFillMode: 'both',
      }}
    >
      {/* Loading overlay */}
      {showLoader && (
        <div className="absolute inset-0 z-30 bg-[#141414]/80 backdrop-blur-sm flex items-center justify-center rounded-[18px]">
          <Spinner size="sm" color="warning" />
        </div>
      )}

      {/* ── Image Section (4:3 aspect ratio) ── */}
      <Link
        href={barberUrl}
        prefetch={true}
        onClick={handleNavigation}
        className="block relative aspect-[4/3] overflow-hidden mb-0"
        aria-label={`הזמן תור אצל ${barber.fullname}`}
        onMouseEnter={() => setIsImageHovered(true)}
        onMouseLeave={() => setIsImageHovered(false)}
      >
        <Image
          src={barber.img_url || '/icon.png'}
          alt={barber.fullname}
          fill
          className={cn(
            'object-cover transition-transform duration-300 ease-out ',
            isImageHovered && 'scale-105'
          )}
          style={{ objectPosition: `${imgX}% ${imgY}%` }}
          sizes="220px"
        />
        
        {/* ── Top-left (visual left in RTL): Instagram icon ── */}
        {instagramUrl && (
          <div className="absolute top-2 left-2 z-10">
            <button
              type="button"
              onClick={handleInstagramClick}
              className={cn(
                'min-w-6 min-h-6 rounded-sm flex items-center justify-center',
                'bg-black/30 backdrop-blur-sm',
                'border border-white/10',
                'transition-all duration-200',
                'hover:bg-black/50 active:scale-90'
              )}
              aria-label={`עקוב אחרי ${barber.fullname} באינסטגרם`}
              tabIndex={0}
            >
              <Instagram size={16} strokeWidth={1.5} className="text-white/80" />
            </button>
          </div>
        )}
      </Link>

      {/* ── Content Section ── */}
      <div
        className="px-3 pt-2.5 pb-0"
        style={{
          background: '#141414',
          borderTopLeftRadius: '18px',
          borderTopRightRadius: '18px',
          borderBottomLeftRadius: '0px',
          borderBottomRightRadius: '0px',
          marginTop: '-18px', // Go up substantially over the image, enough for status/name
          position: 'relative',
          zIndex: 3,
        }}
      >
        {/* Status indicator + Working hours */}
        <div className="flex items-center gap-1.5 mb-0.5">
          <span
            className={cn(
              'inline-flex items-center gap-1 text-[10px] font-medium',
              availability.status === 'available' && 'text-accent-gold',
              availability.status === 'later' && 'text-amber-400/80',
              availability.status === 'off' && 'text-foreground-muted/50'
            )}
          >
            {availability.status === 'available' && (
              <span className="w-1.5 h-1.5 rounded-full bg-accent-gold animate-pulse" />
            )}
            {availability.label}
          </span>
          {availability.hours && (
            <>
              <span className="text-foreground-muted/30 text-[10px]">•</span>
              <span className="text-[10px] text-foreground-muted/50 font-medium">
                {availability.hours}
              </span>
            </>
          )}
        </div>

        {/* Barber name */}
        <h3 className="text-[15px] font-semibold text-white truncate">
          {barber.fullname}
        </h3>
      </div>

      {/* ── Divider ── */}
      <div className="mx-3 my-2">
        <div className="h-px bg-[#2a2a2a]/80" />
      </div>

      {/* ── CTA Section - transparent bg, white text ── */}
      {/* Add scissors icon to the left of the text with nice moving animation */}
      <Link
        href={barberUrl}
        prefetch={true}
        onClick={handleNavigation}
        className={cn(
          'block py-2.5 mx-3 mb-3 rounded-xl',
          'text-white text-[14px] font-medium',
          'transition-all duration-200',
          'hover:bg-white/[0.06] active:scale-[0.97]'
        )}
        tabIndex={0}
        aria-label={`הזמן תור אצל ${barber.fullname}`}
      >
        <div className="flex items-center gap-2 justify-between">
          {/* Icon, text, and arrow at the end */}
          <div className="flex items-center gap-2">
            <Scissors size={16} strokeWidth={1.5} className="text-accent-gold animate-pulse" />
            <span className="text-white text-[14px] font-medium">הזמן עכשיו</span>
          </div>
          <ArrowLeft size={16} strokeWidth={1.5} className="text-accent-gold" />
        </div>
      </Link>
    </div>
  )
}

export default BarberCard
