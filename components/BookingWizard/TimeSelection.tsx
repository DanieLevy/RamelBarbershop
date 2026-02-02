'use client'

import { useEffect, useState } from 'react'
import { useBookingStore } from '@/store/useBookingStore'
import { createClient } from '@/lib/supabase/client'
import { formatTime, cn, parseTimeString, generateTimeSlots, getIsraelDayStart, getIsraelDayEnd, getDayKeyInIsrael, nowInIsrael } from '@/lib/utils'
import type { TimeSlot, BarbershopSettings, BarberSchedule, WorkDay, BarberBookingSettings } from '@/types/database'
import { ChevronRight, ChevronDown, ChevronUp, Clock } from 'lucide-react'
import { ScissorsLoader } from '@/components/ui/ScissorsLoader'
import { useBugReporter } from '@/hooks/useBugReporter'
import { getWorkHours as getWorkHoursFromService, workDaysToMap } from '@/lib/services/availability.service'

interface TimeSelectionProps {
  barberId: string
  shopSettings?: BarbershopSettings | null
  barberSchedule?: BarberSchedule | null
  barberWorkDays?: WorkDay[]
}

interface EnrichedTimeSlot extends TimeSlot {
  reservedBy?: string
  tooSoon?: boolean // True if slot is within min_hours_before_booking
}

export function TimeSelection({ barberId, shopSettings, barberSchedule, barberWorkDays }: TimeSelectionProps) {
  const { date, timeTimestamp, setTime, nextStep, prevStep } = useBookingStore()
  const [availableSlots, setAvailableSlots] = useState<EnrichedTimeSlot[]>([])
  const [reservedSlots, setReservedSlots] = useState<EnrichedTimeSlot[]>([])
  const [tooSoonSlots, setTooSoonSlots] = useState<EnrichedTimeSlot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showReserved, setShowReserved] = useState(false)
  const [showTooSoon, setShowTooSoon] = useState(false)
  const [workDays, setWorkDays] = useState<WorkDay[]>(barberWorkDays || [])
  const [barberBookingSettings, setBarberBookingSettings] = useState<BarberBookingSettings | null>(null)
  const { report } = useBugReporter('TimeSelection')

  // Fetch barber booking settings
  useEffect(() => {
    const fetchBookingSettings = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('barber_booking_settings')
        .select('*')
        .eq('barber_id', barberId)
        .single()
      
      if (data) {
        setBarberBookingSettings(data as BarberBookingSettings)
      }
    }
    
    fetchBookingSettings()
  }, [barberId])

  // Fetch work days if not provided as prop
  useEffect(() => {
    const fetchWorkDays = async () => {
      if (barberWorkDays && barberWorkDays.length > 0) {
        setWorkDays(barberWorkDays)
        return
      }
      
      const supabase = createClient()
      const { data } = await supabase
        .from('work_days')
        .select('*')
        .eq('user_id', barberId)
      
      if (data) {
        setWorkDays(data as WorkDay[])
      }
    }
    
    fetchWorkDays()
  }, [barberId, barberWorkDays])

  // Get work hours for a specific day - uses day-specific hours from work_days
  const getWorkHoursForDay = (dateTimestamp: number): { start: string; end: string } => {
    const dayName = getDayKeyInIsrael(dateTimestamp)
    const workDaysMap = workDaysToMap(workDays)
    return getWorkHoursFromService(shopSettings || null, barberSchedule || null, dayName, workDaysMap)
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
        
        // Fetch existing reservations - simple query, no duration needed
        // Each reservation blocks exactly one 30-minute slot
        const { data: reservations, error: resError } = await supabase
          .from('reservations')
          .select('time_timestamp, customer_name, status')
          .eq('barber_id', barberId)
          .gte('time_timestamp', dayStartMs)
          .lte('time_timestamp', dayEndMs)
          .neq('status', 'cancelled') as { 
            data: { 
              time_timestamp: number
              customer_name: string
              status: string
            }[] | null
            error: unknown 
          }
        
        if (resError) {
          console.error('Error fetching reservations:', resError)
          await report(new Error((resError as Error)?.message || 'Unknown reservation fetch error'), 'Fetching reservations for time slots')
        }
        
        // Create a set of reserved timestamps - simple exact match
        // Each booking occupies exactly one 30-minute slot
        const reservedTimestamps = new Set<number>()
        const reservedMap = new Map<number, string>()
        
        if (reservations) {
          for (const res of reservations) {
            reservedTimestamps.add(res.time_timestamp)
            reservedMap.set(res.time_timestamp, res.customer_name)
          }
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
          if (reservedTimestamps.has(slot.timestamp)) {
            reserved.push({
              time_timestamp: slot.timestamp,
              is_available: false,
              reservedBy: reservedMap.get(slot.timestamp),
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
  }, [barberId, date, workDays, barberBookingSettings])

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
                      className="py-3 px-2 rounded-xl text-sm font-medium bg-background-card/30 text-foreground-muted/50 line-through cursor-not-allowed text-center"
                      title={slot.reservedBy ? `תפוס: ${slot.reservedBy}` : 'תפוס'}
                    >
                      {formatTime(slot.time_timestamp)}
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
