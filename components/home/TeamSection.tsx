'use client'

import { useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { BarberCard } from '@/components/BarberCard'
import { SectionContainer, SectionHeader, SectionContent } from './SectionContainer'
import { cn } from '@/lib/utils'
import type { BarberWithWorkDays } from '@/types/database'

// Test Barber ID - hidden from public view, accessible via easter egg
const TEST_BARBER_ID = 'd24889ae-b221-4dce-bfb9-fc911a4f8ca9'

/** Auto-scroll speed: pixels per interval tick */
const AUTO_SCROLL_SPEED = 0.6
/** Auto-scroll interval in ms */
const AUTO_SCROLL_INTERVAL = 16
/** Pause duration after user interaction in ms */
const PAUSE_AFTER_INTERACTION = 4000

interface TeamSectionProps {
  barbers: BarberWithWorkDays[] | null
}

/**
 * Team Section - Horizontal snap-scroll carousel of barber cards
 *
 * Features:
 * - Horizontal scrollable carousel with snap-to-card
 * - Auto-scrolling that pauses on user interaction
 * - Peek next card visible for scroll affordance
 * - RTL-aware layout
 * - Desktop grid fallback for larger screens
 * - Secret 5-click easter egg on title to access test barber
 */
export const TeamSection = ({ barbers }: TeamSectionProps) => {
  const router = useRouter()
  const clickCountRef = useRef(0)
  const clickTimerRef = useRef<NodeJS.Timeout | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const autoScrollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pauseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isManualScrollRef = useRef(false)

  // Filter out test barber from public view
  const visibleBarbers = barbers?.filter((b) => b.id !== TEST_BARBER_ID) ?? null

  // Easter egg: 5 clicks on title navigates to test barber
  const handleTitleClick = useCallback(() => {
    clickCountRef.current++

    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current)
    }
    clickTimerRef.current = setTimeout(() => {
      clickCountRef.current = 0
    }, 2000)

    if (clickCountRef.current >= 5) {
      router.push('/barber/test')
      clickCountRef.current = 0
    }
  }, [router])

  // ── Auto-scroll logic ──
  const startAutoScroll = useCallback(() => {
    if (autoScrollRef.current) return
    const container = scrollContainerRef.current
    if (!container) return

    autoScrollRef.current = setInterval(() => {
      if (!container || isManualScrollRef.current) return

      // In RTL, scrollLeft is negative (or inverted depending on browser)
      // We scroll in the "forward" direction (left in RTL = negative scrollLeft)
      const maxScroll = container.scrollWidth - container.clientWidth

      // For RTL, we need to handle scroll direction properly
      // scrollLeft in RTL: 0 = rightmost (start), negative = scrolled left
      const currentScroll = Math.abs(container.scrollLeft)
      if (currentScroll >= maxScroll - 1) {
        // Reset to start
        container.scrollTo({ left: 0, behavior: 'auto' })
      } else {
        container.scrollLeft -= AUTO_SCROLL_SPEED
      }
    }, AUTO_SCROLL_INTERVAL)
  }, [])

  const stopAutoScroll = useCallback(() => {
    if (autoScrollRef.current) {
      clearInterval(autoScrollRef.current)
      autoScrollRef.current = null
    }
  }, [])

  const pauseAndResumeAutoScroll = useCallback(() => {
    isManualScrollRef.current = true
    stopAutoScroll()

    if (pauseTimeoutRef.current) {
      clearTimeout(pauseTimeoutRef.current)
    }

    pauseTimeoutRef.current = setTimeout(() => {
      isManualScrollRef.current = false
      startAutoScroll()
    }, PAUSE_AFTER_INTERACTION)
  }, [startAutoScroll, stopAutoScroll])

  // Start auto-scroll on mount
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container || !visibleBarbers || visibleBarbers.length <= 1) return

    // Small delay to let layout settle
    const startTimer = setTimeout(() => {
      startAutoScroll()
    }, 2000)

    return () => {
      clearTimeout(startTimer)
      stopAutoScroll()
      if (pauseTimeoutRef.current) {
        clearTimeout(pauseTimeoutRef.current)
      }
    }
  }, [visibleBarbers, startAutoScroll, stopAutoScroll])

  // Handle user touch/mouse interaction to pause auto-scroll
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const handleInteractionStart = () => {
      pauseAndResumeAutoScroll()
    }

    container.addEventListener('touchstart', handleInteractionStart, { passive: true })
    container.addEventListener('mousedown', handleInteractionStart)
    container.addEventListener('wheel', handleInteractionStart, { passive: true })

    return () => {
      container.removeEventListener('touchstart', handleInteractionStart)
      container.removeEventListener('mousedown', handleInteractionStart)
      container.removeEventListener('wheel', handleInteractionStart)
    }
  }, [pauseAndResumeAutoScroll])

  // Cleanup timers on unmount
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
      <SectionContent maxWidth="full">
        <SectionHeader
          title="הצוות שלנו"
          subtitle="בחר ספר לקביעת תור"
          onTitleClick={handleTitleClick}
        />

        {/* ── Mobile: Horizontal Carousel ── */}
        <div className="md:hidden relative">
          <div
            ref={scrollContainerRef}
            className={cn(
              'flex gap-3.5 overflow-x-auto scroll-smooth',
              'snap-x snap-mandatory',
              'pb-4 -mb-4',
              // Hide scrollbar
              'scrollbar-hide',
              // RTL: items flow right-to-left naturally
              'px-4'
            )}
            style={{
              WebkitOverflowScrolling: 'touch',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
            }}
            dir="rtl"
          >
            {visibleBarbers.map((barber, index) => (
              <div
                key={barber.id}
                className="snap-center shrink-0 first:mr-0 last:ml-0"
              >
                <BarberCard barber={barber} index={index} />
              </div>
            ))}
            {/* Spacer for peek affordance */}
            <div className="shrink-0 w-2" aria-hidden="true" />
          </div>

          {/* Scroll indicator dots */}
          {visibleBarbers.length > 1 && (
            <div className="flex items-center justify-center gap-1.5 mt-4">
              {visibleBarbers.map((b) => (
                <div
                  key={b.id}
                  className="w-1 h-1 rounded-full bg-white/20"
                  aria-hidden="true"
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Desktop: Grid Layout ── */}
        <div
          className={cn(
            'hidden md:grid gap-5 justify-items-center',
            visibleBarbers.length <= 2 && 'md:grid-cols-2 max-w-2xl mx-auto',
            visibleBarbers.length >= 3 && 'md:grid-cols-3 max-w-4xl mx-auto',
          )}
        >
          {visibleBarbers.map((barber, index) => (
            <BarberCard key={barber.id} barber={barber} index={index} />
          ))}
        </div>
      </SectionContent>
    </SectionContainer>
  )
}

export default TeamSection
