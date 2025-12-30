'use client'

import { useRef, useState, useEffect } from 'react'
import { BarberCard } from '@/components/BarberCard'
import { SectionContainer, SectionHeader, SectionContent } from './SectionContainer'
import { cn } from '@/lib/utils'
import type { BarberWithWorkDays } from '@/types/database'

interface TeamSectionProps {
  barbers: BarberWithWorkDays[] | null
}

/**
 * Team Section with horizontal scroll on mobile and grid on desktop
 * 
 * Features:
 * - RTL-aware auto-scroll animation on mobile (pauses on interaction)
 * - Smooth swipe gestures
 * - Grid layout on desktop (responsive)
 * - Infinite loop with duplicated items
 */
export const TeamSection = ({ barbers }: TeamSectionProps) => {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [isPaused, setIsPaused] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const scrollPositionRef = useRef(0)

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

  // RTL-aware auto-scroll effect for mobile
  useEffect(() => {
    const container = scrollRef.current
    if (!container || !isMobile || isPaused || barberCount < 2) return

    const scrollSpeed = 0.4 // pixels per frame
    let animationId: number
    const isRTL = document.documentElement.dir === 'rtl' || document.documentElement.lang === 'he'
    
    const autoScroll = () => {
      if (!container) return
      
      // Increment our tracked position
      scrollPositionRef.current += scrollSpeed
      
      // Reset when we've scrolled the width of original items (half of duplicated)
      const resetPoint = (barberCount * 296) // card width (280) + gap (16)
      if (scrollPositionRef.current >= resetPoint) {
        scrollPositionRef.current = 0
        container.scrollLeft = isRTL ? 0 : 0
      } else {
        // In RTL, we need to scroll in the negative direction
        if (isRTL) {
          container.scrollLeft = -scrollPositionRef.current
        } else {
          container.scrollLeft = scrollPositionRef.current
        }
      }
      
      animationId = requestAnimationFrame(autoScroll)
    }

    // Initialize scroll position
    scrollPositionRef.current = isRTL ? 0 : container.scrollLeft

    animationId = requestAnimationFrame(autoScroll)
    
    return () => cancelAnimationFrame(animationId)
  }, [isMobile, isPaused, barberCount])

  const handleInteractionStart = () => setIsPaused(true)
  const handleInteractionEnd = () => {
    // Sync our ref with actual scroll position when user finishes interacting
    if (scrollRef.current) {
      const isRTL = document.documentElement.dir === 'rtl' || document.documentElement.lang === 'he'
      scrollPositionRef.current = isRTL ? -scrollRef.current.scrollLeft : scrollRef.current.scrollLeft
    }
    setIsPaused(false)
  }

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
        {/* Gradient masks for edge fade effect */}
        <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-background-dark to-transparent z-[1] pointer-events-none" />
        <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-background-dark to-transparent z-[1] pointer-events-none" />

        {/* Carousel container - smooth touch scrolling */}
        <div 
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto scrollbar-hide px-4 py-2 snap-x snap-mandatory"
          style={{ 
            scrollPaddingInline: '16px',
            WebkitOverflowScrolling: 'touch',
            scrollBehavior: 'auto',
          }}
        >
          {displayBarbers.map((barber, index) => (
            <div 
              key={`${barber.id}-${index}`}
              className="flex-shrink-0 w-[280px] snap-center"
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
