/**
 * useTimelineItems Hook
 *
 * Generates the timeline items list for the reservations page.
 * Merges reservations with empty time slots for single-day views.
 */

'use client'

import { useMemo } from 'react'
import {
  generateTimeSlots,
  parseTimeString,
  getSlotKey,
  getDayKeyInIsrael,
  normalizeTimestampFormat,
} from '@/lib/utils'
import type { Reservation, Service, BarbershopSettings, WorkDay } from '@/types/database'

interface ReservationWithService extends Reservation {
  services?: Service
  isRecurring?: boolean
}

export type TimelineItem =
  | { type: 'reservation'; data: ReservationWithService; isPast: boolean }
  | { type: 'empty'; timestamp: number; time: string }
  | { type: 'divider'; label: string }

type QuickDateType = 'today' | 'tomorrow' | 'week' | 'all' | 'custom'
type ViewMode = 'all' | 'upcoming_only' | 'cancelled'

// Module-level alias for timestamp normalization
const normalizeTs = normalizeTimestampFormat

interface UseTimelineItemsOptions {
  filteredReservations: ReservationWithService[]
  pastReservations: ReservationWithService[]
  upcomingReservations: ReservationWithService[]
  quickDate: QuickDateType
  customDate: Date | null
  viewMode: ViewMode
  showEmptySlots: boolean
  shopSettings: BarbershopSettings | null
  barberWorkDays: WorkDay[]
  now: number
  selectedDate: Date | null
}

export const useTimelineItems = ({
  filteredReservations,
  pastReservations,
  upcomingReservations,
  quickDate,
  viewMode,
  showEmptySlots,
  shopSettings,
  barberWorkDays,
  now,
  selectedDate,
}: UseTimelineItemsOptions): TimelineItem[] => {
  return useMemo((): TimelineItem[] => {
    const items: TimelineItem[] = []

    // For unified view ('all'), build a timeline with past, divider, and upcoming
    if (viewMode === 'all') {
      // Add past reservations
      pastReservations.forEach((res) => {
        items.push({ type: 'reservation', data: res, isPast: true })
      })

      // Add divider between past and upcoming if both exist
      if (pastReservations.length > 0 && upcomingReservations.length > 0) {
        items.push({ type: 'divider', label: 'תורים קרובים' })
      } else if (pastReservations.length > 0 && upcomingReservations.length === 0) {
        items.push({ type: 'divider', label: 'אין תורים נוספים היום' })
      }

      // Add upcoming reservations with empty slots if enabled
      if (
        showEmptySlots &&
        (quickDate === 'today' || quickDate === 'tomorrow' || quickDate === 'custom')
      ) {
        if (!selectedDate) {
          // Just add upcoming without empty slots
          upcomingReservations.forEach((res) => {
            items.push({ type: 'reservation', data: res, isPast: false })
          })
          return items
        }

        // Get work hours
        const dayKey = getDayKeyInIsrael(selectedDate.getTime())
        const barberDaySettings = barberWorkDays.find((wd) => wd.day_of_week === dayKey)

        let workStart: string
        let workEnd: string

        if (
          barberDaySettings &&
          barberDaySettings.is_working &&
          barberDaySettings.start_time &&
          barberDaySettings.end_time
        ) {
          workStart = barberDaySettings.start_time
          workEnd = barberDaySettings.end_time
        } else if (barberDaySettings && !barberDaySettings.is_working) {
          // Barber not working - show reservations without empty slots
          upcomingReservations.forEach((res) => {
            items.push({ type: 'reservation', data: res, isPast: false })
          })
          return items
        } else {
          workStart = shopSettings?.work_hours_start || '09:00'
          workEnd = shopSettings?.work_hours_end || '19:00'
        }

        const { hour: startHour, minute: startMinute } = parseTimeString(workStart)
        const { hour: endHour, minute: endMinute } = parseTimeString(workEnd)

        const allSlots = generateTimeSlots(
          selectedDate.getTime(),
          startHour,
          startMinute,
          endHour,
          endMinute,
          30
        )

        // Track which reservations have been added to avoid duplicates
        const addedReservationIds = new Set<string>()

        // Build slot key map for fast lookup
        const reservationsBySlotKey = new Map<string, ReservationWithService>()
        for (const res of upcomingReservations) {
          const slotKey = getSlotKey(normalizeTs(res.time_timestamp))
          reservationsBySlotKey.set(slotKey, res)
        }

        for (const slot of allSlots) {
          // Only show future slots
          if (slot.timestamp <= now) continue

          // Use slot key matching (robust, ignores milliseconds)
          const slotKey = getSlotKey(slot.timestamp)
          const reservation = reservationsBySlotKey.get(slotKey)

          if (reservation) {
            items.push({ type: 'reservation', data: reservation, isPast: false })
            addedReservationIds.add(reservation.id)
          } else {
            items.push({ type: 'empty', timestamp: slot.timestamp, time: slot.time })
          }
        }

        // Add any reservations that fall OUTSIDE work hours (weren't matched to slots)
        const orphanReservations = upcomingReservations.filter(
          (res) => !addedReservationIds.has(res.id)
        )
        if (orphanReservations.length > 0) {
          for (const orphan of orphanReservations) {
            const orphanTs = normalizeTs(orphan.time_timestamp)
            let insertIndex = items.length
            for (let i = 0; i < items.length; i++) {
              const item = items[i]
              if (item.type === 'divider') continue
              const itemTs =
                item.type === 'reservation'
                  ? normalizeTs(item.data.time_timestamp)
                  : item.timestamp
              if (orphanTs < itemTs) {
                insertIndex = i
                break
              }
            }
            items.splice(insertIndex, 0, { type: 'reservation', data: orphan, isPast: false })
          }
        }
      } else {
        // No empty slots, just add upcoming
        upcomingReservations.forEach((res) => {
          items.push({ type: 'reservation', data: res, isPast: false })
        })
      }

      return items
    }

    // For other views, just map the filtered reservations
    return filteredReservations.map((res) => ({
      type: 'reservation' as const,
      data: res,
      isPast: normalizeTs(res.time_timestamp) <= now,
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    filteredReservations,
    pastReservations,
    upcomingReservations,
    quickDate,
    viewMode,
    shopSettings,
    barberWorkDays,
    showEmptySlots,
    now,
  ])
}
