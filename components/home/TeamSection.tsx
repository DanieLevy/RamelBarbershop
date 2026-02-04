'use client'

import { useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { BarberCard } from '@/components/BarberCard'
import { SectionContainer, SectionHeader, SectionContent } from './SectionContainer'
import { cn } from '@/lib/utils'
import type { BarberWithWorkDays } from '@/types/database'

// Test Barber ID - hidden from public view, accessible via easter egg
const TEST_BARBER_ID = 'd24889ae-b221-4dce-bfb9-fc911a4f8ca9'

interface TeamSectionProps {
  barbers: BarberWithWorkDays[] | null
}

/**
 * Team Section with horizontal scroll on mobile and grid on desktop
 * 
 * Features:
 * - Smooth native touch swipe gestures on mobile
 * - Snap scrolling for precise card positioning
 * - Grid layout on desktop (responsive)
 * - No auto-scroll (per user request)
 * - Secret 5-click easter egg on title to access test barber
 */
export const TeamSection = ({ barbers }: TeamSectionProps) => {
  const scrollRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const clickCountRef = useRef(0)
  const clickTimerRef = useRef<NodeJS.Timeout | null>(null)
  
  // Filter out test barber from public view
  const visibleBarbers = barbers?.filter(b => b.id !== TEST_BARBER_ID) ?? null
  
  // Easter egg: 5 clicks on title navigates to test barber
  const handleTitleClick = useCallback(() => {
    clickCountRef.current++
    
    // Reset click count after 2 seconds of inactivity
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current)
    }
    clickTimerRef.current = setTimeout(() => {
      clickCountRef.current = 0
    }, 2000)
    
    // Navigate to test barber on 5th click
    if (clickCountRef.current >= 5) {
      router.push('/barber/test')
      clickCountRef.current = 0
    }
  }, [router])

  // Scroll to start (right side in RTL) on mount to show first barber
  useEffect(() => {
    if (scrollRef.current && visibleBarbers && visibleBarbers.length > 0) {
      // In RTL, scroll to the end (which is the start visually)
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth
    }
  }, [visibleBarbers])
  
  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current)
      }
    }
  }, [])

  if (!visibleBarbers || visibleBarbers.length === 0) {
    return (
      <SectionContainer id="team" variant="dark">
        <SectionContent>
          <SectionHeader title="הצוות שלנו" onTitleClick={handleTitleClick} />
          <div className="text-center py-12">
            <p className="text-foreground-muted">אין ספרים זמינים כרגע</p>
          </div>
        </SectionContent>
      </SectionContainer>
    )
  }

  return (
    <SectionContainer id="team" variant="dark" animate={true} className="index-body">
      <SectionContent>
        <SectionHeader 
          title="הצוות שלנו" 
          subtitle="בחר ספר לקביעת תור"
          onTitleClick={handleTitleClick}
        />
      </SectionContent>

      {/* Mobile: Horizontal scroll carousel with smooth swipe */}
      <div className="md:hidden relative">
        {/* Gradient masks for edge fade effect */}
        <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background-dark to-transparent z-[1] pointer-events-none" />
        <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-background-dark to-transparent z-[1] pointer-events-none" />

        {/* Carousel container - smooth native touch scrolling */}
        {/* Using dir="rtl" ensures first item (lowest display_order) appears on the right */}
        <div 
          ref={scrollRef}
          dir="rtl"
          className="flex gap-4 overflow-x-auto scrollbar-hide px-4 py-2 snap-x snap-mandatory overscroll-x-contain"
          style={{ 
            scrollPaddingInline: '16px',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {visibleBarbers.map((barber, index) => (
            <div 
              key={barber.id}
              dir="rtl"
              className="flex-shrink-0 w-[280px] snap-center"
            >
              <BarberCard barber={barber} index={index} />
            </div>
          ))}
        </div>
      </div>

      {/* Desktop: Grid layout */}
      <SectionContent className="hidden md:block">
        <div className={cn(
          'grid gap-6 lg:gap-8 justify-items-center',
          visibleBarbers.length === 1 && 'grid-cols-1 max-w-sm mx-auto',
          visibleBarbers.length === 2 && 'grid-cols-2 max-w-3xl mx-auto',
          visibleBarbers.length >= 3 && 'grid-cols-2 lg:grid-cols-3'
        )}>
          {visibleBarbers.map((barber, index) => (
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
