'use client'

import { useBookingStore } from '@/store/useBookingStore'
import type { WorkDay } from '@/types/database'
import { getNextWeekDates, getDayOfWeek, cn } from '@/lib/utils'

interface DateSelectionProps {
  workDays: WorkDay[]
}

export function DateSelection({ workDays }: DateSelectionProps) {
  const { date: selectedDate, setDate, nextStep, prevStep } = useBookingStore()
  
  const dates = getNextWeekDates()

  // Check if barber works on this day
  const isWorking = (dateTimestamp: number): boolean => {
    const dayName = getDayOfWeek(dateTimestamp)
    const workDay = workDays.find((wd) => wd.day_of_week === dayName)
    return workDay?.is_working ?? false
  }

  const handleSelect = (dayName: string, dayNum: string, dateTimestamp: number) => {
    if (!isWorking(dateTimestamp)) return
    setDate({ dayName, dayNum, dateTimestamp })
    nextStep()
  }

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-xl text-center text-foreground-light font-medium">
        בחר תאריך
      </h2>
      
      <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
        {dates.map((date) => {
          const working = isWorking(date.dateTimestamp)
          return (
            <button
              key={date.dateTimestamp}
              onClick={() => handleSelect(date.dayName, date.dayNum, date.dateTimestamp)}
              disabled={!working}
              className={cn(
                'flex flex-col items-center gap-1 p-3 rounded-xl backdrop-blur-lg border transition-all',
                !working
                  ? 'bg-background-card/50 border-white/5 opacity-40 cursor-not-allowed'
                  : selectedDate?.dateTimestamp === date.dateTimestamp
                  ? 'bg-accent-gold/10 border-accent-gold'
                  : 'bg-background-card border-white/10 hover:border-white/30 cursor-pointer'
              )}
            >
              <span className="text-foreground-light font-medium text-sm">{date.dayName}</span>
              <span className="text-foreground-muted text-xs">{date.dayNum}</span>
            </button>
          )
        })}
      </div>
      
      <button
        onClick={prevStep}
        className="text-foreground-muted hover:text-foreground-light transition-colors text-sm mt-2"
      >
        ← חזור לבחירת שירות
      </button>
    </div>
  )
}

