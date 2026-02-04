'use client'

import { useEffect, useState } from 'react'
import { useBookingStore } from '@/store/useBookingStore'
import { createClient } from '@/lib/supabase/client'
import { formatTime, cn, parseTimeString, generateTimeSlots, getIsraelDayStart, getIsraelDayEnd, getDayKeyInIsrael, nowInIsrael, getSlotKey, timestampToIsraelDate, israelDateToTimestamp } from '@/lib/utils'
import type { TimeSlot, BarbershopSettings, WorkDay, BarberBookingSettings, DayOfWeek, BarberBreakout } from '@/types/database'
import { ChevronRight, ChevronDown, ChevronUp, Clock, Repeat, Coffee } from 'lucide-react'
import { ScissorsLoader } from '@/components/ui/ScissorsLoader'
import { useBugReporter } from '@/hooks/useBugReporter'
import { getWorkHours as getWorkHoursFromService, workDaysToMap } from '@/lib/services/availability.service'
import { withSupabaseRetry } from '@/lib/utils/retry'
import { getRecurringForDay } from '@/lib/services/recurring.service'
import { getBreakoutsForDate, isSlotInBreakout } from '@/lib/services/breakout.service'

interface TimeSelectionProps {
  barberId: string
  shopSettings?: BarbershopSettings | null
  barberWorkDays?: WorkDay[]
  barberBookingSettings?: BarberBookingSettings | null
}

interface EnrichedTimeSlot extends TimeSlot {
  reservedBy?: string
  tooSoon?: boolean // True if slot is within min_hours_before_booking
  isRecurring?: boolean // True if slot is reserved by a recurring appointment
  isBreakout?: boolean // True if slot is blocked by a barber breakout
  breakoutReason?: string // Optional reason for breakout (e.g., "צהריים")
}

export function TimeSelection({ barberId, shopSettings, barberWorkDays = [], barberBookingSettings }: TimeSelectionProps) {
  const { date, timeTimestamp, setTime, nextStep, prevStep } = useBookingStore()
  const [availableSlots, setAvailableSlots] = useState<EnrichedTimeSlot[]>([])
  const [reservedSlots, setReservedSlots] = useState<EnrichedTimeSlot[]>([])
  const [tooSoonSlots, setTooSoonSlots] = useState<EnrichedTimeSlot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showReserved, setShowReserved] = useState(false)
  const [showTooSoon, setShowTooSoon] = useState(false)
  const { report } = useBugReporter('TimeSelection')

  // Get work hours for a specific day - uses day-specific hours from work_days
  const getWorkHoursForDay = (dateTimestamp: number): { start: string; end: string } => {
    const dayName = getDayKeyInIsrael(dateTimestamp)
    const workDaysMap = workDaysToMap(barberWorkDays)
    return getWorkHoursFromService(shopSettings || null, dayName, workDaysMap)
  }

  useEffect(() => {
    const fetchTimeSlots = async () => {
      if (!date) return
      
      setLoading(true)
      setError(null)
      
      try {
        const supabase = createClient()
        // Get day-specific work hours for the selected date
        const workHours = getWorkHoursForDay(date.dateTimestamp)
        const { hour: startHour, minute: startMinute } = parseTimeString(workHours.start)
        const { hour: endHour, minute: endMinute } = parseTimeString(workHours.end)
        
        // Generate all possible time slots - fixed 30-minute intervals
        // Service duration is informational only, all bookings use one 30-min slot
        const allSlots = generateTimeSlots(
          date.dateTimestamp,
          startHour,
          startMinute,
          endHour,
          endMinute,
          30 // Fixed 30 minute intervals - each booking takes exactly one slot
        )
        
        // Get date range for query - USING ISRAEL TIMEZONE
        const dayStartMs = getIsraelDayStart(date.dateTimestamp)
        const dayEndMs = getIsraelDayEnd(date.dateTimestamp)
        
        // Fetch existing reservations with retry logic for Safari/iOS "Load failed" errors
        // Each reservation blocks exactly one 30-minute slot
        let reservations: { time_timestamp: number; customer_name: string; status: string | null }[] | null = null
        
        try {
          const result = await withSupabaseRetry(async () => {
            const res = await supabase
              .from('reservations')
              .select('time_timestamp, customer_name, status')
              .eq('barber_id', barberId)
              .gte('time_timestamp', dayStartMs)
              .lte('time_timestamp', dayEndMs)
              .neq('status', 'cancelled')
            if (res.error) throw new Error(res.error.message)
            return res
          })
          reservations = result.data as { time_timestamp: number; customer_name: string; status: string | null }[] | null
        } catch (resError) {
          console.error('[TimeSelection] Error fetching reservations:', resError)
          await report(new Error((resError as Error)?.message || 'Unknown reservation fetch error'), 'Fetching reservations for time slots')
          // Don't fail entirely - show slots without reservation data
          // User will see a more accurate view on retry
        }
        
        // Create slot key map for fast lookup
        // Using slot keys (e.g., "2026-02-04-17-30") instead of raw timestamps
        // This is MUCH more robust than millisecond comparison
        const reservedSlotKeys = new Set<string>()
        const reservedMap = new Map<string, string>() // slot key -> customer name
        
        if (reservations) {
          for (const res of reservations) {
            // Convert stored timestamp to slot key - handles any dirty timestamps
            const slotKey = getSlotKey(res.time_timestamp)
            reservedSlotKeys.add(slotKey)
            reservedMap.set(slotKey, res.customer_name)
          }
        }
        
        // Helper function to check if a slot is reserved using slot key comparison
        const isSlotReserved = (slotTs: number): { reserved: boolean; reservedBy?: string } => {
          const slotKey = getSlotKey(slotTs)
          if (reservedSlotKeys.has(slotKey)) {
            return { reserved: true, reservedBy: reservedMap.get(slotKey) }
          }
          return { reserved: false }
        }
        
        // Fetch recurring appointments for this day
        // These are pre-set appointments that repeat every week
        const dayKey = getDayKeyInIsrael(date.dateTimestamp) as DayOfWeek
        let recurringSlots: Array<{ time_slot: string; customer_name: string }> = []
        
        try {
          recurringSlots = await getRecurringForDay(barberId, dayKey)
        } catch (recError) {
          console.error('[TimeSelection] Error fetching recurring slots:', recError)
          // Continue without recurring data
        }
        
        // Convert recurring time_slot (HH:MM) to slot keys for the selected date
        const recurringSlotKeys = new Set<string>()
        const recurringMap = new Map<string, string>() // slot key -> customer name
        
        for (const rec of recurringSlots) {
          const { hour, minute } = parseTimeString(rec.time_slot)
          // Create timestamp using Israel timezone properly (handles DST)
          const israelDate = timestampToIsraelDate(date.dateTimestamp)
          const recTimestamp = israelDateToTimestamp(
            israelDate.getFullYear(),
            israelDate.getMonth() + 1,
            israelDate.getDate(),
            hour,
            minute
          )
          
          // Use slot key for consistent matching
          const slotKey = getSlotKey(recTimestamp)
          recurringSlotKeys.add(slotKey)
          recurringMap.set(slotKey, `${rec.customer_name} (קבוע)`)
        }
        
        // Helper function to check if a slot is reserved by recurring using slot key
        const isSlotRecurring = (slotTs: number): { reserved: boolean; reservedBy?: string } => {
          const slotKey = getSlotKey(slotTs)
          if (recurringSlotKeys.has(slotKey)) {
            return { reserved: true, reservedBy: recurringMap.get(slotKey) }
          }
          return { reserved: false }
        }
        
        // Fetch breakouts for this date
        // These are barber breaks (lunch, early departure, etc.)
        let breakouts: BarberBreakout[] = []
        
        try {
          breakouts = await getBreakoutsForDate(barberId, date.dateTimestamp)
        } catch (breakoutError) {
          console.error('[TimeSelection] Error fetching breakouts:', breakoutError)
          // Continue without breakout data
        }
        
        // Get work hours end time for "until end of day" breakouts
        const workDayEndTime = workHours.end
        
        // Helper function to check if a slot is blocked by a breakout
        const checkBreakout = (slotTs: number): { blocked: boolean; reason?: string } => {
          if (breakouts.length === 0) return { blocked: false }
          return isSlotInBreakout(slotTs, breakouts, workDayEndTime)
        }
        
        // Calculate minimum booking time threshold
        // min_hours_before_booking: how many hours before the slot must you book
        const minHoursBefore = barberBookingSettings?.min_hours_before_booking ?? 1
        const nowMs = nowInIsrael().getTime()
        const minBookingTimeMs = nowMs + (minHoursBefore * 60 * 60 * 1000)
        
        // Split slots into available, reserved, and too soon
        const available: EnrichedTimeSlot[] = []
        const reserved: EnrichedTimeSlot[] = []
        const tooSoon: EnrichedTimeSlot[] = []
        
        for (const slot of allSlots) {
          // Check if slot is reserved using slot key matching (robust, ignores milliseconds)
          const reservationCheck = isSlotReserved(slot.timestamp)
          
          if (reservationCheck.reserved) {
            reserved.push({
              time_timestamp: slot.timestamp,
              is_available: false,
              reservedBy: reservationCheck.reservedBy,
            })
          } else {
            // Check if slot is reserved by recurring appointment using slot key matching
            const recurringCheck = isSlotRecurring(slot.timestamp)
            
            if (recurringCheck.reserved) {
              // Slot is blocked by a recurring appointment
              reserved.push({
                time_timestamp: slot.timestamp,
                is_available: false,
                reservedBy: recurringCheck.reservedBy,
                isRecurring: true,
              })
            } else {
              // Check if slot is blocked by a barber breakout
              const breakoutCheck = checkBreakout(slot.timestamp)
              
              if (breakoutCheck.blocked) {
                // Slot is blocked by a breakout (lunch, early departure, etc.)
                reserved.push({
                  time_timestamp: slot.timestamp,
                  is_available: false,
                  reservedBy: breakoutCheck.reason || 'הפסקה',
                  isBreakout: true,
                  breakoutReason: breakoutCheck.reason,
                })
              } else if (slot.timestamp < minBookingTimeMs) {
                // Slot is within min_hours_before_booking window - can't book
                tooSoon.push({
                  time_timestamp: slot.timestamp,
                  is_available: false,
                  tooSoon: true,
                })
              } else {
                available.push({
                  time_timestamp: slot.timestamp,
                  is_available: true,
                })
              }
            }
          }
        }
        
        setAvailableSlots(available)
        setReservedSlots(reserved)
        setTooSoonSlots(tooSoon)
      } catch (err) {
        console.error('Error fetching time slots:', err)
        await report(err, 'Fetching time slots (exception)')
        setError('שגיאה בטעינת השעות')
      } finally {
        setLoading(false)
      }
    }

    fetchTimeSlots()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barberId, date, barberWorkDays, barberBookingSettings])

  const handleSelect = (timestamp: number) => {
    setTime(timestamp)
    nextStep()
  }

  if (!date) return null

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h2 className="text-xl sm:text-2xl text-foreground-light font-medium">בחר שעה</h2>
        <p className="text-foreground-muted text-sm mt-1">
          {date.dayName} {date.dayNum}
        </p>
      </div>
      
      {loading ? (
        <div className="flex justify-center py-12">
          <ScissorsLoader size="md" text="טוען שעות פנויות..." />
        </div>
      ) : error ? (
        <div className="text-center py-8">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="text-accent-gold hover:underline text-sm"
          >
            נסה שוב
          </button>
        </div>
      ) : availableSlots.length === 0 && reservedSlots.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-foreground-muted">אין שעות זמינות ביום זה</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Available Slots */}
          {availableSlots.length > 0 ? (
            <div>
              <p className="text-sm text-foreground-muted mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                שעות פנויות ({availableSlots.length})
              </p>
              {/* Mobile: 3 columns, Tablet: 4 columns, Desktop: 5 columns */}
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                {availableSlots.map((slot) => (
                  <button
                    key={slot.time_timestamp}
                    onClick={() => handleSelect(slot.time_timestamp)}
                    className={cn(
                      'py-3 px-2 rounded-xl text-sm font-medium transition-all cursor-pointer',
                      'flex items-center justify-center',
                      'active:scale-95 hover:scale-[1.02]',
                      timeTimestamp === slot.time_timestamp
                        ? 'bg-accent-gold text-background-dark shadow-gold'
                        : 'bg-background-card border border-white/10 text-foreground-light hover:border-accent-gold'
                    )}
                    dir="ltr"
                  >
                    {formatTime(slot.time_timestamp)}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-foreground-muted">אין שעות פנויות ביום זה</p>
            </div>
          )}
          
          {/* Too Soon Slots (expandable) - within min booking window */}
          {tooSoonSlots.length > 0 && (
            <div className="mt-2">
              <button
                onClick={() => setShowTooSoon(!showTooSoon)}
                className="flex items-center gap-2 text-sm text-foreground-muted hover:text-foreground-light transition-colors py-2"
              >
                {showTooSoon ? (
                  <ChevronUp size={12} strokeWidth={1.5} />
                ) : (
                  <ChevronDown size={12} strokeWidth={1.5} />
                )}
                <Clock size={12} strokeWidth={1.5} className="text-orange-400" />
                <span className="text-orange-400/80">
                  ניתן להירשם עד {barberBookingSettings?.min_hours_before_booking ?? 1} שעות לפני ({tooSoonSlots.length})
                </span>
              </button>
              
              {showTooSoon && (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 mt-2 animate-fade-in">
                  {tooSoonSlots.map((slot) => (
                    <div
                      key={slot.time_timestamp}
                      className="py-3 px-2 rounded-xl text-sm font-medium bg-orange-500/10 border border-orange-500/20 text-orange-400/60 cursor-not-allowed text-center"
                      title={`ניתן להירשם עד ${barberBookingSettings?.min_hours_before_booking ?? 1} שעות לפני התור`}
                    >
                      {formatTime(slot.time_timestamp)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Reserved Slots (expandable) */}
          {reservedSlots.length > 0 && (
            <div className="mt-2">
              <button
                onClick={() => setShowReserved(!showReserved)}
                className="flex items-center gap-2 text-sm text-foreground-muted hover:text-foreground-light transition-colors py-2"
              >
                {showReserved ? (
                  <ChevronUp size={12} strokeWidth={1.5} />
                ) : (
                  <ChevronDown size={12} strokeWidth={1.5} />
                )}
                <span className="w-2 h-2 rounded-full bg-red-400" />
                שעות תפוסות ({reservedSlots.length})
              </button>
              
              {showReserved && (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 mt-2 animate-fade-in">
                  {reservedSlots.map((slot) => (
                    <div
                      key={slot.time_timestamp}
                      className={cn(
                        "py-3 px-2 rounded-xl text-sm font-medium cursor-not-allowed text-center relative",
                        slot.isBreakout
                          ? "bg-amber-500/10 text-amber-400/60 border border-amber-500/20"
                          : slot.isRecurring
                          ? "bg-purple-500/10 text-purple-400/60 border border-purple-500/20"
                          : "bg-background-card/30 text-foreground-muted/50 line-through"
                      )}
                      title={slot.isBreakout ? `הפסקה: ${slot.breakoutReason || 'הפסקה'}` : slot.reservedBy ? `תפוס: ${slot.reservedBy}` : 'תפוס'}
                    >
                      {formatTime(slot.time_timestamp)}
                      {slot.isBreakout && (
                        <Coffee size={10} className="absolute top-1 left-1 text-amber-400/60" />
                      )}
                      {slot.isRecurring && !slot.isBreakout && (
                        <Repeat size={10} className="absolute top-1 left-1 text-purple-400/60" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
      
      {/* Back button */}
      <button
        onClick={prevStep}
        className="flex items-center justify-center gap-2 text-foreground-muted hover:text-foreground-light transition-colors text-sm py-2"
      >
        <ChevronRight size={12} strokeWidth={1.5} />
        <span>חזור לבחירת תאריך</span>
      </button>
    </div>
  )
}
