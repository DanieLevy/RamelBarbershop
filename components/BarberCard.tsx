'use client'

import { useState, useTransition, useRef, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import type { BarberWithWorkDays } from '@/types/database'
import { Calendar, Loader2, ChevronLeft, Instagram } from 'lucide-react'
import { cn, getPreferredBarberSlug } from '@/lib/utils'
import { openExternalLink } from '@/lib/utils/external-link'

interface BarberCardProps {
  barber: BarberWithWorkDays
  /** Index for staggered animation */
  index?: number
}

/**
 * Enhanced Barber Card with 3D tilt, status indicator, and micro-interactions
 * 
 * Features:
 * - 3D tilt effect on hover (desktop)
 * - Image parallax on hover
 * - Availability status indicator
 * - Loading state with skeleton
 * - Accessible keyboard navigation
 */
export function BarberCard({ barber, index = 0 }: BarberCardProps) {
  const [isPending, startTransition] = useTransition()
  const [isNavigating, setIsNavigating] = useState(false)
  const [tilt, setTilt] = useState({ x: 0, y: 0 })
  const cardRef = useRef<HTMLAnchorElement>(null)
  
  const showLoader = isPending || isNavigating

  // Check if barber is available today
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
  const isAvailableToday = barber.work_days?.some(
    (day) => day.day_of_week === today && day.is_working
  )

  const handleNavigation = () => {
    setIsNavigating(true)
    startTransition(() => {
      // Navigation happens via Link, this just tracks the transition
    })
  }

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!cardRef.current) return
    
    const rect = cardRef.current.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width - 0.5
    const y = (e.clientY - rect.top) / rect.height - 0.5
    
    // Tilt max 8 degrees
    setTilt({
      x: y * -8,
      y: x * 8,
    })
  }, [])

  const handleMouseLeave = useCallback(() => {
    setTilt({ x: 0, y: 0 })
  }, [])

  // Build URL using preferred slug (name_en-based if available, else username, else UUID)
  const preferredSlug = getPreferredBarberSlug(
    (barber as { name_en?: string | null }).name_en,
    barber.username
  )
  const barberUrl = preferredSlug ? `/barber/${preferredSlug}` : `/barber/${barber.id}`

  return (
    <Link
      ref={cardRef}
      href={barberUrl}
      prefetch={true}
      onClick={handleNavigation}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={cn(
        'group relative w-full block animate-reveal-up',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold focus-visible:ring-offset-2 focus-visible:ring-offset-background-dark rounded-2xl'
      )}
      style={{ 
        animationDelay: `${index * 100}ms`,
        animationFillMode: 'both',
      }}
      aria-label={`קבע תור אצל ${barber.fullname}`}
    >
      {/* Loading overlay */}
      {showLoader && (
        <div className="absolute inset-0 z-20 bg-background-dark/80 backdrop-blur-sm rounded-2xl flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <Loader2 size={32} strokeWidth={1.5} className="text-accent-gold animate-spin" />
            <span className="text-accent-gold text-sm">טוען...</span>
          </div>
        </div>
      )}
      
      {/* Card container with 3D tilt */}
      <div 
        className={cn(
          'relative overflow-hidden rounded-2xl',
          'bg-gradient-to-b from-white/[0.08] to-white/[0.02]',
          'border border-white/10 transition-all duration-500 ease-out',
          'hover:border-accent-gold/40 hover:shadow-gold-lg',
          'active:scale-[0.98]'
        )}
        style={{
          transform: `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale(${tilt.x !== 0 || tilt.y !== 0 ? 1.02 : 1})`,
          transformStyle: 'preserve-3d',
          transition: 'transform 0.15s ease-out, border-color 0.5s, box-shadow 0.5s',
        }}
      >
        {/* Status indicator - Only show when unavailable */}
        {!isAvailableToday && (
          <div className="absolute top-4 right-4 z-10 flex items-center gap-2 px-3 py-1.5 rounded-full bg-background-dark/80 backdrop-blur-sm border border-white/10">
            <span className="w-2 h-2 rounded-full bg-status-busy shadow-[0_0_8px_rgba(234,179,8,0.5)]" />
            <span className="text-xs text-foreground-light">לא זמין היום</span>
          </div>
        )}
        
        {/* Hero Image Section */}
        <div className="relative h-52 sm:h-60 overflow-hidden">
          {/* Background Image with parallax */}
          <div 
            className="absolute inset-0 transition-transform duration-700 ease-out"
            style={{
              transform: `translate(${tilt.y * 2}px, ${tilt.x * -2}px) scale(1.1)`,
            }}
          >
            <Image
              src={barber.img_url || '/icon.png'}
              alt={barber.fullname}
              fill
              className="object-cover"
              style={{ 
                objectPosition: `${(barber as { img_position_x?: number }).img_position_x ?? 50}% ${(barber as { img_position_y?: number }).img_position_y ?? 30}%` 
              }}
              sizes="(max-width: 640px) 100vw, 400px"
            />
          </div>
          
          {/* Gradient Overlays */}
          <div className="absolute inset-0 bg-gradient-to-t from-background-dark via-background-dark/30 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-b from-background-dark/20 via-transparent to-transparent" />
          
          {/* Instagram Button - Top Left (using button to avoid nested <a> tags) */}
          {(barber as { instagram_url?: string | null }).instagram_url && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                openExternalLink((barber as { instagram_url?: string }).instagram_url || '')
              }}
              className="absolute top-4 left-4 z-20 w-8 h-8 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center hover:bg-white/20 hover:scale-110 active:scale-95 transition-all"
              aria-label={`עקוב אחרי ${barber.fullname} באינסטגרם`}
            >
              <Instagram size={16} strokeWidth={1.5} className="text-white/90" />
            </button>
          )}
          
          {/* Top Decorative Line */}
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-accent-gold to-transparent opacity-50 group-hover:opacity-100 transition-opacity duration-300" />
          
          {/* Barber Name Overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <h3 className="text-xl sm:text-2xl font-bold text-foreground-light drop-shadow-lg group-hover:text-accent-gold transition-colors duration-300">
              {barber.fullname}
            </h3>
          </div>

          {/* Shine effect on hover */}
          <div 
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
            style={{
              background: `linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.03) 45%, rgba(255,255,255,0.05) 50%, rgba(255,255,255,0.03) 55%, transparent 60%)`,
              transform: `translateX(${tilt.y * 30}px)`,
            }}
          />
        </div>
        
        {/* Action Section */}
        <div className="p-4 bg-background-dark/50 backdrop-blur-sm">
          <div className={cn(
            'flex items-center justify-between py-3 px-4 rounded-xl transition-all duration-300',
            'bg-accent-gold/10 border border-accent-gold/30',
            'group-hover:bg-accent-gold group-hover:border-accent-gold'
          )}>
            <div className="flex items-center gap-3">
              {showLoader ? (
                <Loader2 size={20} strokeWidth={1.5} className="text-accent-gold group-hover:text-background-dark animate-spin" />
              ) : (
                <Calendar size={20} strokeWidth={1.5} className="text-accent-gold group-hover:text-background-dark transition-colors" />
              )}
              <span className="font-medium text-accent-gold group-hover:text-background-dark transition-colors">
                {showLoader ? 'טוען...' : 'קבע תור עכשיו'}
              </span>
            </div>
            <ChevronLeft 
              size={18} 
              strokeWidth={2} 
              className="text-accent-gold/50 group-hover:text-background-dark group-hover:-translate-x-1 transition-all duration-300" 
            />
          </div>
        </div>
        
        {/* Decorative corner accents */}
        <div className="absolute top-2 left-2 w-4 h-4 border-t border-l border-transparent rounded-tl-lg group-hover:border-accent-gold/50 transition-colors duration-300" />
        <div className="absolute top-2 right-2 w-4 h-4 border-t border-r border-transparent rounded-tr-lg group-hover:border-accent-gold/50 transition-colors duration-300" />
        <div className="absolute bottom-2 left-2 w-4 h-4 border-b border-l border-transparent rounded-bl-lg group-hover:border-accent-gold/50 transition-colors duration-300" />
        <div className="absolute bottom-2 right-2 w-4 h-4 border-b border-r border-transparent rounded-br-lg group-hover:border-accent-gold/50 transition-colors duration-300" />
      </div>
    </Link>
  )
}
