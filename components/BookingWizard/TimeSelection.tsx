'use client'

import { useEffect, useState } from 'react'
import { useBookingStore } from '@/store/useBookingStore'
import { createClient } from '@/lib/supabase/client'
import { formatTime, cn, parseTimeString, generateTimeSlots } from '@/lib/utils'
import type { TimeSlot, BarbershopSettings, BarberSchedule } from '@/types/database'
import { ChevronRight, ChevronDown, ChevronUp } from 'lucide-react'
import { ScissorsLoader } from '@/components/ui/ScissorsLoader'

interface TimeSelectionProps {
  barberId: string
  shopSettings?: BarbershopSettings | null
  barberSchedule?: BarberSchedule | null
}

interface EnrichedTimeSlot extends TimeSlot {
  reservedBy?: string
}

export function TimeSelection({ barberId, shopSettings, barberSchedule }: TimeSelectionProps) {
  const { date, timeTimestamp, setTime, nextStep, prevStep, service } = useBookingStore()
  const [availableSlots, setAvailableSlots] = useState<EnrichedTimeSlot[]>([])
  const [reservedSlots, setReservedSlots] = useState<EnrichedTimeSlot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showReserved, setShowReserved] = useState(false)

  // Get work hours from barber schedule or shop settings
  const getWorkHours = (): { start: string; end: string } => {
    if (barberSchedule?.work_hours_start && barberSchedule?.work_hours_end) {
      return {
        start: barberSchedule.work_hours_start,
        end: barberSchedule.work_hours_end,
      }
    }
    if (shopSettings?.work_hours_start && shopSettings?.work_hours_end) {
      return {
        start: shopSettings.work_hours_start,
        end: shopSettings.work_hours_end,
      }
    }
    return { start: '09:00', end: '19:00' }
  }

  useEffect(() => {
    const fetchTimeSlots = async () => {
      if (!date) return
      
      setLoading(true)
      setError(null)
      
      try {
        const supabase = createClient()
        const workHours = getWorkHours()
        const { hour: startHour, minute: startMinute } = parseTimeString(workHours.start)
        const { hour: endHour, minute: endMinute } = parseTimeString(workHours.end)
        
        // Generate all possible time slots
        const allSlots = generateTimeSlots(
          date.dateTimestamp,
          startHour,
          startMinute,
          endHour,
          endMinute,
          30 // 30 minute intervals
        )
        
        // Get date string for query
        const dayStart = new Date(date.dateTimestamp)
        dayStart.setHours(0, 0, 0, 0)
        const dayEnd = new Date(date.dateTimestamp)
        dayEnd.setHours(23, 59, 59, 999)
        
        // Fetch existing reservations for this barber and date
        const { data: reservations, error: resError } = await supabase
          .from('reservations')
          .select('time_timestamp, customer_name, status')
          .eq('barber_id', barberId)
          .gte('time_timestamp', dayStart.getTime())
          .lte('time_timestamp', dayEnd.getTime())
          .neq('status', 'cancelled') as { data: { time_timestamp: number; customer_name: string; status: string }[] | null; error: unknown }
        
        if (resError) {
          console.error('Error fetching reservations:', resError)
        }
        
        // Create a set of reserved timestamps
        const reservedTimestamps = new Set<number>()
        const reservedMap = new Map<number, string>()
        
        if (reservations) {
          for (const res of reservations) {
            reservedTimestamps.add(res.time_timestamp)
            reservedMap.set(res.time_timestamp, res.customer_name)
          }
        }
        
        // Split slots into available and reserved
        const available: EnrichedTimeSlot[] = []
        const reserved: EnrichedTimeSlot[] = []
        
        for (const slot of allSlots) {
          if (reservedTimestamps.has(slot.timestamp)) {
            reserved.push({
              time_timestamp: slot.timestamp,
              is_available: false,
              reservedBy: reservedMap.get(slot.timestamp),
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
      } catch (err) {
        console.error('Error fetching time slots:', err)
        setError('שגיאה בטעינת השעות')
      } finally {
        setLoading(false)
      }
    }

    fetchTimeSlots()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barberId, date, service])

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
                      'active:scale-95 hover:scale-[1.02]',
                      timeTimestamp === slot.time_timestamp
                        ? 'bg-accent-gold text-background-dark shadow-gold'
                        : 'bg-background-card border border-white/10 text-foreground-light hover:border-accent-gold'
                    )}
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
