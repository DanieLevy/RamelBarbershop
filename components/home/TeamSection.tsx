'use client'

import { useRef } from 'react'
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
 * - Smooth native touch swipe gestures on mobile
 * - Snap scrolling for precise card positioning
 * - Grid layout on desktop (responsive)
 * - No auto-scroll (per user request)
 */
export const TeamSection = ({ barbers }: TeamSectionProps) => {
  const scrollRef = useRef<HTMLDivElement>(null)

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

  return (
    <SectionContainer id="team" variant="dark" animate={true}>
      <SectionContent>
        <SectionHeader 
          title="הצוות שלנו" 
          subtitle="בחר ספר לקביעת תור"
        />
      </SectionContent>

      {/* Mobile: Horizontal scroll carousel with smooth swipe */}
      <div className="md:hidden relative">
        {/* Gradient masks for edge fade effect */}
        <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background-dark to-transparent z-[1] pointer-events-none" />
        <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-background-dark to-transparent z-[1] pointer-events-none" />

        {/* Carousel container - smooth native touch scrolling */}
        <div 
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto scrollbar-hide px-4 py-2 snap-x snap-mandatory overscroll-x-contain"
          style={{ 
            scrollPaddingInline: '16px',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {barbers.map((barber, index) => (
            <div 
              key={barber.id}
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
