'use client'

import { useState, useTransition, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import type { BarberWithWorkDays } from '@/types/database'
import { Calendar, ChevronLeft, Instagram } from 'lucide-react'
import { cn, getPreferredBarberSlug } from '@/lib/utils'
import { openExternalLink } from '@/lib/utils/external-link'
import { Chip, Spinner } from '@heroui/react'

interface BarberCardProps {
  barber: BarberWithWorkDays
  /** Index for staggered animation */
  index?: number
  /** Variant: 'default' for home page, 'compact' for lists */
  variant?: 'default' | 'compact'
}

/**
 * Modern Barber Card with clean design and smooth interactions
 * 
 * Features:
 * - Clean, minimal design with focus on barber image
 * - Availability status chip
 * - Quick action button with hover effect
 * - Instagram quick link
 * - Smooth loading states
 * - Accessible with keyboard navigation
 */
export function BarberCard({ barber, index = 0, variant: _variant = 'default' }: BarberCardProps) {
  const [isPending, startTransition] = useTransition()
  const [isNavigating, setIsNavigating] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  
  const showLoader = isPending || isNavigating

  // Check if barber is available today
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
  const isAvailableToday = barber.work_days?.some(
    (day) => day.day_of_week === today && day.is_working
  )

  const handleNavigation = () => {
    setIsNavigating(true)
    startTransition(() => {
      // Navigation happens via Link
    })
  }

  // Build URL using preferred slug
  const preferredSlug = getPreferredBarberSlug(
    (barber as { name_en?: string | null }).name_en,
    barber.username
  )
  const barberUrl = preferredSlug ? `/barber/${preferredSlug}` : `/barber/${barber.id}`

  const handleInstagramClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const instagramUrl = (barber as { instagram_url?: string | null }).instagram_url
    if (instagramUrl) {
      openExternalLink(instagramUrl)
    }
  }, [barber])

  return (
    <Link
      href={barberUrl}
      prefetch={true}
      onClick={handleNavigation}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        'group relative block w-full',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold focus-visible:ring-offset-2 focus-visible:ring-offset-background-dark rounded-2xl',
        'animate-reveal-up'
      )}
      style={{ 
        animationDelay: `${index * 80}ms`,
        animationFillMode: 'both',
      }}
      aria-label={`קבע תור אצל ${barber.fullname}`}
    >
      {/* Loading overlay */}
      {showLoader && (
        <div className="absolute inset-0 z-30 bg-background-dark/90 backdrop-blur-sm rounded-2xl flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <Spinner size="lg" color="warning" />
            <span className="text-accent-gold text-sm font-medium">טוען...</span>
          </div>
        </div>
      )}
      
      {/* Card Container */}
      <div 
        className={cn(
          'relative overflow-hidden rounded-2xl',
          'bg-zinc-900/80 border border-white/[0.06]',
          'transition-all duration-300 ease-out',
          'hover:border-accent-gold/30',
          'hover:shadow-[0_0_40px_rgba(255,170,61,0.08)]',
        )}
      >
        {/* Image Section */}
        <div className="relative aspect-[4/5] overflow-hidden">
          {/* Background Image */}
          <div 
            className={cn(
              'absolute inset-0 transition-transform duration-500 ease-out',
              isHovered && 'scale-105'
            )}
          >
            <Image
              src={barber.img_url || '/icon.png'}
              alt={barber.fullname}
              fill
              className="object-cover"
              style={{ 
                objectPosition: `${(barber as { img_position_x?: number }).img_position_x ?? 50}% ${(barber as { img_position_y?: number }).img_position_y ?? 30}%` 
              }}
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 400px"
            />
          </div>
          
          {/* Gradient Overlays */}
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-zinc-900/20 to-transparent" />
          <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-zinc-900/40 to-transparent" />
          
          {/* Top Row - Status & Instagram */}
          <div className="absolute top-3 left-3 right-3 flex items-start justify-between z-10">
            {/* Availability Status */}
            <Chip
              variant="soft"
              size="sm"
              className={cn(
                '!bg-zinc-900/80 backdrop-blur-sm !border-0 px-2 py-1',
                isAvailableToday ? 'text-emerald-400' : 'text-amber-400'
              )}
            >
              <span className={cn(
                'w-1.5 h-1.5 rounded-full mr-1.5 inline-block',
                isAvailableToday 
                  ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]' 
                  : 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.6)]'
              )} />
              <span className="text-[10px] font-medium">
                {isAvailableToday ? 'זמין היום' : 'לא זמין היום'}
              </span>
            </Chip>
            
            {/* Instagram Button */}
            {(barber as { instagram_url?: string | null }).instagram_url && (
              <button
                type="button"
                onClick={handleInstagramClick}
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center',
                  'bg-zinc-900/80 backdrop-blur-sm border border-white/10',
                  'hover:bg-pink-500/20 hover:border-pink-500/30',
                  'transition-all duration-200',
                  'active:scale-95'
                )}
                aria-label={`עקוב אחרי ${barber.fullname} באינסטגרם`}
              >
                <Instagram size={14} strokeWidth={1.5} className="text-white/80" />
              </button>
            )}
          </div>
          
          {/* Bottom Content - Name & CTA */}
          <div className="absolute bottom-0 left-0 right-0 p-4 z-10">
            {/* Barber Name */}
            <h3 className="text-xl sm:text-2xl font-bold text-white mb-3 drop-shadow-lg">
              {barber.fullname}
            </h3>
            
            {/* CTA Button */}
            <div 
              className={cn(
                'flex items-center justify-between w-full py-2.5 px-4 rounded-xl',
                'bg-accent-gold/90 backdrop-blur-sm',
                'transition-all duration-300',
                'group-hover:bg-accent-gold'
              )}
            >
              <div className="flex items-center gap-2">
                <Calendar size={16} strokeWidth={2} className="text-zinc-900" />
                <span className="font-semibold text-sm text-zinc-900">
                  קבע תור עכשיו
                </span>
              </div>
              <ChevronLeft 
                size={16} 
                strokeWidth={2.5} 
                className={cn(
                  'text-zinc-900/60',
                  'transition-transform duration-300',
                  'group-hover:-translate-x-1 group-hover:text-zinc-900'
                )}
              />
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}

/**
 * Compact variant for lists and smaller displays
 */
export function BarberCardCompact({ barber, index = 0 }: Omit<BarberCardProps, 'variant'>) {
  const [isPending, startTransition] = useTransition()
  const [isNavigating, setIsNavigating] = useState(false)
  
  const showLoader = isPending || isNavigating

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
  const isAvailableToday = barber.work_days?.some(
    (day) => day.day_of_week === today && day.is_working
  )

  const handleNavigation = () => {
    setIsNavigating(true)
    startTransition(() => {})
  }

  const preferredSlug = getPreferredBarberSlug(
    (barber as { name_en?: string | null }).name_en,
    barber.username
  )
  const barberUrl = preferredSlug ? `/barber/${preferredSlug}` : `/barber/${barber.id}`

  return (
    <Link
      href={barberUrl}
      prefetch={true}
      onClick={handleNavigation}
      className={cn(
        'group relative flex items-center gap-4 p-3 rounded-xl',
        'bg-white/[0.03] border border-white/[0.06]',
        'hover:bg-white/[0.05] hover:border-accent-gold/20',
        'transition-all duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold',
        'animate-reveal-up'
      )}
      style={{ 
        animationDelay: `${index * 60}ms`,
        animationFillMode: 'both',
      }}
      aria-label={`קבע תור אצל ${barber.fullname}`}
    >
      {/* Avatar */}
      <div className="relative w-14 h-14 rounded-full overflow-hidden ring-2 ring-accent-gold/20 flex-shrink-0">
        <Image
          src={barber.img_url || '/icon.png'}
          alt={barber.fullname}
          fill
          className="object-cover"
        />
      </div>
      
      {/* Info */}
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-foreground-light truncate">
          {barber.fullname}
        </h3>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={cn(
            'w-1.5 h-1.5 rounded-full',
            isAvailableToday ? 'bg-emerald-400' : 'bg-amber-400'
          )} />
          <span className="text-xs text-foreground-muted">
            {isAvailableToday ? 'זמין היום' : 'לא זמין היום'}
          </span>
        </div>
      </div>
      
      {/* Action */}
      <div className="flex items-center gap-2">
        {showLoader ? (
          <Spinner size="sm" color="warning" />
        ) : (
          <ChevronLeft 
            size={18} 
            className="text-foreground-muted group-hover:text-accent-gold group-hover:-translate-x-1 transition-all" 
          />
        )}
      </div>
    </Link>
  )
}

export default BarberCard
