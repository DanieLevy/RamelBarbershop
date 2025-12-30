'use client'

import { useRef, useState, useEffect } from 'react'
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
 * - Horizontal scroll carousel on mobile
 * - Grid layout on desktop (responsive)
 * - Scroll arrows for navigation
 * - Snap scrolling for better UX
 * - Staggered animation on reveal
 */
export const TeamSection = ({ barbers }: TeamSectionProps) => {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

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
  useEffect(() => {
    const container = scrollRef.current
    if (!container || !isMobile) return

    const checkScroll = () => {
      const { scrollLeft, scrollWidth, clientWidth } = container
      setCanScrollLeft(scrollLeft > 10)
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10)
    }

    checkScroll()
    container.addEventListener('scroll', checkScroll, { passive: true })
    return () => container.removeEventListener('scroll', checkScroll)
  }, [isMobile, barbers])

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return
    const cardWidth = 300 // Approximate card width + gap
    const scrollAmount = direction === 'left' ? -cardWidth : cardWidth
    scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' })
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

  return (
    <SectionContainer id="team" variant="dark" animate={true}>
      <SectionContent>
        <SectionHeader 
          title="הצוות שלנו" 
          subtitle="בחר ספר ותאם תור בקלות"
        />
      </SectionContent>

      {/* Mobile: Horizontal scroll carousel */}
      <div className="md:hidden relative">
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
          className="flex gap-4 overflow-x-auto scrollbar-hide snap-x snap-mandatory px-4 py-2"
          style={{ scrollPaddingInline: '16px' }}
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

        {/* Scroll indicator dots */}
        <div className="flex justify-center gap-2 mt-4">
          {barbers.map((_, index) => (
            <div
              key={index}
              className={cn(
                'w-2 h-2 rounded-full transition-all duration-300',
                'bg-white/20'
              )}
            />
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

