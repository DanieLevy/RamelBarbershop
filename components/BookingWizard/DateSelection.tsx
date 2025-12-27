'use client'

import { useBookingStore } from '@/store/useBookingStore'
import type { WorkDay, BarbershopSettings, BarbershopClosure, BarberSchedule, BarberClosure } from '@/types/database'
import { getNextWeekDates, cn } from '@/lib/utils'
import { FaChevronRight } from 'react-icons/fa'

interface DateSelectionProps {
  workDays: WorkDay[]
  shopSettings?: BarbershopSettings | null
  shopClosures?: BarbershopClosure[]
  barberSchedule?: BarberSchedule | null
  barberClosures?: BarberClosure[]
}

export function DateSelection({ 
  workDays, 
  shopSettings, 
  shopClosures = [], 
  barberSchedule, 
  barberClosures = [] 
}: DateSelectionProps) {
  const { date: selectedDate, setDate, nextStep, prevStep } = useBookingStore()
  
  // Get next 14 days with all the proper metadata
  const dates = getNextWeekDates(14)

  // Check if a date is available
  const checkAvailability = (dateOption: typeof dates[0]): { available: boolean; reason?: string } => {
    const { dayKey, dateString } = dateOption
    
    // Check if shop is open on this day of week
    if (shopSettings?.open_days && !shopSettings.open_days.includes(dayKey)) {
      return { available: false, reason: 'המספרה סגורה' }
    }
    
    // Check shop closures (date range)
    const shopClosure = shopClosures.find(c => 
      dateString >= c.start_date && dateString <= c.end_date
    )
    if (shopClosure) {
      return { available: false, reason: shopClosure.reason || 'המספרה סגורה' }
    }
    
    // Check if barber works on this day (from barber_schedules)
    if (barberSchedule?.work_days && barberSchedule.work_days.length > 0) {
      if (!barberSchedule.work_days.includes(dayKey)) {
        return { available: false, reason: 'הספר לא עובד' }
      }
    } else {
      // Fallback to legacy work_days from users table
      const legacyWorkDay = workDays.find((wd) => wd.day_of_week.toLowerCase() === dayKey)
      if (!legacyWorkDay?.is_working) {
        return { available: false, reason: 'הספר לא עובד' }
      }
    }
    
    // Check barber closures (personal days off)
    const barberClosure = barberClosures.find(c => 
      dateString >= c.start_date && dateString <= c.end_date
    )
    if (barberClosure) {
      return { available: false, reason: barberClosure.reason || 'הספר לא זמין' }
    }
    
    return { available: true }
  }

  const handleSelect = (dateOption: typeof dates[0]) => {
    const { available } = checkAvailability(dateOption)
    if (!available) return
    
    setDate({ 
      dayName: dateOption.dayName, 
      dayNum: dateOption.dayNum, 
      dateTimestamp: dateOption.dateTimestamp 
    })
    nextStep()
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h2 className="text-xl sm:text-2xl text-foreground-light font-medium">
          בחר תאריך
        </h2>
        <p className="text-foreground-muted text-sm mt-1">
          ב-14 הימים הקרובים
        </p>
      </div>
      
      {/* Mobile: 2 columns, Tablet: 3 columns, Desktop: 4 columns */}
      <div className="grid grid-cols-2 xs:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3">
        {dates.map((dateOption) => {
          const availability = checkAvailability(dateOption)
          const isSelected = selectedDate?.dateTimestamp === dateOption.dateTimestamp
          
          return (
            <button
              key={dateOption.dateTimestamp}
              onClick={() => handleSelect(dateOption)}
              disabled={!availability.available}
              title={!availability.available ? availability.reason : ''}
              className={cn(
                'flex flex-col items-center gap-1 p-3 sm:p-4 rounded-xl backdrop-blur-lg border transition-all relative min-h-[80px] justify-center',
                'active:scale-95',
                !availability.available
                  ? 'bg-background-card/30 border-white/5 opacity-40 cursor-not-allowed'
                  : isSelected
                  ? 'bg-accent-gold/10 border-accent-gold shadow-gold'
                  : 'bg-background-card border-white/10 hover:border-white/30 cursor-pointer hover:scale-[1.02]'
              )}
            >
              <span className={cn(
                'font-medium text-sm sm:text-base',
                isSelected ? 'text-accent-gold' : 'text-foreground-light'
              )}>
                {dateOption.dayName}
              </span>
              <span className="text-foreground-muted text-xs sm:text-sm">
                {dateOption.dayNum}
              </span>
              
              {/* Unavailable reason badge */}
              {!availability.available && availability.reason && (
                <span className="text-[9px] text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded mt-1">
                  {availability.reason}
                </span>
              )}
            </button>
          )
        })}
      </div>
      
      {/* Back button */}
      <button
        onClick={prevStep}
        className="flex items-center justify-center gap-2 text-foreground-muted hover:text-foreground-light transition-colors text-sm py-2"
      >
        <FaChevronRight className="w-3 h-3" />
        <span>חזור לבחירת שירות</span>
      </button>
    </div>
  )
}
