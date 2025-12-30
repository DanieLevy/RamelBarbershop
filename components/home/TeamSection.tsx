'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { BarberCard } from '@/components/BarberCard'
import { SectionContainer, SectionHeader, SectionContent } from './SectionContainer'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { BarberWithWorkDays } from '@/types/database'

interface TeamSectionProps {
  barbers: BarberWithWorkDays[] | null
}

/**
 * Team Section with horizontal scroll on mobile and grid on desktop
 * 
 * Features:
 * - Auto-scroll animation on mobile (pauses on interaction)
 * - Horizontal scroll carousel on mobile
 * - Grid layout on desktop (responsive)
 * - Scroll arrows for navigation
 */
export const TeamSection = ({ barbers }: TeamSectionProps) => {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [isPaused, setIsPaused] = useState(false)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  const barberCount = barbers?.length || 0

  // Check if mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Check scroll position for arrow visibility
  const checkScroll = useCallback(() => {
    const container = scrollRef.current
    if (!container) return
    
    const { scrollLeft, scrollWidth, clientWidth } = container
    setCanScrollLeft(scrollLeft > 10)
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10)
  }, [])

  // Auto-scroll effect for mobile
  useEffect(() => {
    const container = scrollRef.current
    if (!container || !isMobile || isPaused || barberCount < 2) return

    const scrollSpeed = 0.3 // Slow auto-scroll
    let animationId: number

    const autoScroll = () => {
      if (!container) return
      
      const { scrollLeft, scrollWidth, clientWidth } = container
      const maxScroll = scrollWidth - clientWidth
      
      // Reset to start when reaching end
      if (scrollLeft >= maxScroll - 1) {
        container.scrollLeft = 0
      } else {
        container.scrollLeft += scrollSpeed
      }
      
      animationId = requestAnimationFrame(autoScroll)
    }

    animationId = requestAnimationFrame(autoScroll)
    
    return () => cancelAnimationFrame(animationId)
  }, [isMobile, isPaused, barberCount])

  useEffect(() => {
    const container = scrollRef.current
    if (!container || !isMobile) return

    checkScroll()
    container.addEventListener('scroll', checkScroll, { passive: true })
    return () => container.removeEventListener('scroll', checkScroll)
  }, [isMobile, barbers, checkScroll])

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return
    const cardWidth = 300
    const scrollAmount = direction === 'left' ? -cardWidth : cardWidth
    scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' })
  }

  const handleInteractionStart = () => setIsPaused(true)
  const handleInteractionEnd = () => setIsPaused(false)

  if (!barbers || barbers.length === 0) {
    return (
      <SectionContainer id="team" variant="dark">
        <SectionContent>
          <SectionHeader title="הצוות שלנו" />
          <div className="text-center py-12">
            <p className="text-foreground-muted">אין ספרים זמינים כרגע</p>
          </div>
        </SectionContent>
      </SectionContainer>
    )
  }

  // Duplicate barbers for seamless loop effect on mobile
  const displayBarbers = isMobile && barberCount > 1 ? [...barbers, ...barbers] : barbers

  return (
    <SectionContainer id="team" variant="dark" animate={true}>
      <SectionContent>
        <SectionHeader 
          title="הצוות שלנו" 
          subtitle="בחר ספר לקביעת תור"
        />
      </SectionContent>

      {/* Mobile: Horizontal scroll carousel */}
      <div 
        className="md:hidden relative"
        onMouseEnter={handleInteractionStart}
        onMouseLeave={handleInteractionEnd}
        onTouchStart={handleInteractionStart}
        onTouchEnd={handleInteractionEnd}
      >
        {/* Scroll arrows */}
        {canScrollRight && (
          <button
            onClick={() => scroll('right')}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-background-dark/90 border border-white/10 flex items-center justify-center text-foreground-light hover:text-accent-gold hover:border-accent-gold/50 transition-all shadow-lg backdrop-blur-sm"
            aria-label="הבא"
          >
            <ChevronLeft size={20} strokeWidth={2} />
          </button>
        )}
        {canScrollLeft && (
          <button
            onClick={() => scroll('left')}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-background-dark/90 border border-white/10 flex items-center justify-center text-foreground-light hover:text-accent-gold hover:border-accent-gold/50 transition-all shadow-lg backdrop-blur-sm"
            aria-label="הקודם"
          >
            <ChevronRight size={20} strokeWidth={2} />
          </button>
        )}

        {/* Gradient masks */}
        <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background-dark to-transparent z-[1] pointer-events-none" />
        <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-background-dark to-transparent z-[1] pointer-events-none" />

        {/* Carousel container */}
        <div 
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto scrollbar-hide px-4 py-2"
          style={{ 
            scrollPaddingInline: '16px',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {displayBarbers.map((barber, index) => (
            <div 
              key={`${barber.id}-${index}`}
              className="flex-shrink-0 w-[280px]"
            >
              <BarberCard barber={barber} index={index % barberCount} />
            </div>
          ))}
        </div>
      </div>

      {/* Desktop: Grid layout */}
      <SectionContent className="hidden md:block">
        <div className={cn(
          'grid gap-6 lg:gap-8 justify-items-center',
          barbers.length === 1 && 'grid-cols-1 max-w-sm mx-auto',
          barbers.length === 2 && 'grid-cols-2 max-w-3xl mx-auto',
          barbers.length >= 3 && 'grid-cols-2 lg:grid-cols-3'
        )}>
          {barbers.map((barber, index) => (
            <div
              key={barber.id}
              className="w-full max-w-sm"
            >
              <BarberCard barber={barber} index={index} />
            </div>
          ))}
        </div>
      </SectionContent>
    </SectionContainer>
  )
}

export default TeamSection
