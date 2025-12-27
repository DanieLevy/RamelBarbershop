'use client'

import { useEffect, useState } from 'react'
import { useBookingStore } from '@/store/useBookingStore'
import { createClient } from '@/lib/supabase/client'
import { formatTime, cn } from '@/lib/utils'
import type { TimeSlot } from '@/types/database'

interface TimeSelectionProps {
  barberId: string
}

export function TimeSelection({ barberId }: TimeSelectionProps) {
  const { date, timeTimestamp, setTime, nextStep, prevStep } = useBookingStore()
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchTimeSlots = async () => {
      if (!date) return
      
      setLoading(true)
      setError(null)
      
      try {
        const supabase = createClient()
        
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error: rpcError } = await (supabase.rpc as any)('get_available_time_slots', {
          p_barber_id: barberId,
          p_date_timestamp: date.dateTimestamp,
        }) as { data: TimeSlot[] | null; error: unknown }
        
        if (rpcError) {
          console.error('RPC error:', rpcError)
          // Fall back to generating slots client-side
          const slots = generateFallbackSlots(date.dateTimestamp)
          setTimeSlots(slots)
          return
        }
        
        setTimeSlots(data || [])
      } catch (err) {
        console.error('Error fetching time slots:', err)
        setError('שגיאה בטעינת השעות')
      } finally {
        setLoading(false)
      }
    }

    fetchTimeSlots()
  }, [barberId, date])

  const handleSelect = (timestamp: number) => {
    setTime(timestamp)
    nextStep()
  }

  if (!date) return null

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h2 className="text-xl text-foreground-light font-medium">בחר שעה</h2>
        <p className="text-foreground-muted text-sm mt-1">
          {date.dayName} {date.dayNum}
        </p>
      </div>
      
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-8 h-8 border-2 border-accent-gold border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <p className="text-center text-red-400">{error}</p>
      ) : timeSlots.length === 0 ? (
        <p className="text-center text-foreground-muted">אין שעות פנויות ביום זה</p>
      ) : (
        <div className="grid grid-cols-4 gap-2">
          {timeSlots.map((slot) => (
            <button
              key={slot.time_timestamp}
              onClick={() => slot.is_available && handleSelect(slot.time_timestamp)}
              disabled={!slot.is_available}
              className={cn(
                'p-3 rounded-lg text-sm font-medium transition-all',
                !slot.is_available
                  ? 'bg-background-card/50 text-foreground-muted/50 cursor-not-allowed line-through'
                  : timeTimestamp === slot.time_timestamp
                  ? 'bg-accent-gold text-background-dark'
                  : 'bg-background-card border border-white/10 text-foreground-light hover:border-accent-gold cursor-pointer'
              )}
            >
              {formatTime(slot.time_timestamp)}
            </button>
          ))}
        </div>
      )}
      
      <button
        onClick={prevStep}
        className="text-foreground-muted hover:text-foreground-light transition-colors text-sm mt-2"
      >
        ← חזור לבחירת תאריך
      </button>
    </div>
  )
}

// Fallback function to generate time slots if RPC fails
function generateFallbackSlots(dateTimestamp: number): TimeSlot[] {
  const slots: TimeSlot[] = []
  const baseDate = new Date(dateTimestamp * 1000)
  baseDate.setHours(9, 0, 0, 0)
  
  for (let hour = 9; hour < 20; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const slotDate = new Date(baseDate)
      slotDate.setHours(hour, minute, 0, 0)
      slots.push({
        time_timestamp: Math.floor(slotDate.getTime() / 1000),
        is_available: true,
      })
    }
  }
  
  return slots
}

