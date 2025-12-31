'use client'

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useBookingStore } from '@/store/useBookingStore'
import type { WorkDay, BarbershopSettings, BarbershopClosure, BarberSchedule, BarberClosure } from '@/types/database'
import { cn, nowInIsrael, getIsraelDayStart, getDayIndexInIsrael } from '@/lib/utils'
import { ChevronRight, ChevronLeft, X } from 'lucide-react'

/**
 * Monthly Calendar Picker Component
 * 
 * A reusable, accessible calendar for date selection with:
 * - RTL Hebrew layout support
 * - Grid-based layout (7 columns, 5-6 dynamic rows)
 * - Clear date states (default, selected, today, disabled, outside-month)
 * - Keyboard navigation (arrow keys, Enter/Space)
 * - ARIA grid roles for accessibility
 * - Single-date selection logic
 * - Month navigation
 * - Responsive design (mobile-first)
 */

interface DateSelectionProps {
  workDays: WorkDay[]
  shopSettings?: BarbershopSettings | null
  shopClosures?: BarbershopClosure[]
  barberSchedule?: BarberSchedule | null
  barberClosures?: BarberClosure[]
}

// Hebrew weekday labels (RTL order: Sunday first on right)
const WEEKDAY_LABELS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳']
const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

// Hebrew month names
const HEBREW_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
]

interface CalendarDay {
  date: Date
  dayNum: number
  dayKey: string
  dateString: string
  dateTimestamp: number
  isCurrentMonth: boolean
  isToday: boolean
  isPast: boolean
}

interface UnavailableInfo {
  show: boolean
  reason: string
}

export function DateSelection({ 
  workDays, 
  shopSettings, 
  shopClosures = [], 
  barberSchedule, 
  barberClosures = [] 
}: DateSelectionProps) {
  const router = useRouter()
  const { date: selectedDate, setDate, nextStep, barberId } = useBookingStore()
  const [currentMonth, setCurrentMonth] = useState(() => new Date())
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null)
  const [unavailableInfo, setUnavailableInfo] = useState<UnavailableInfo>({ show: false, reason: '' })
  const gridRef = useRef<HTMLDivElement>(null)
  const cellRefs = useRef<(HTMLButtonElement | null)[]>([])

  // Generate calendar days for the current month view
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    
    // Start from Sunday of the week containing the first day
    const startDate = new Date(firstDay)
    startDate.setDate(startDate.getDate() - firstDay.getDay())
    
    // End on Saturday of the week containing the last day
    const endDate = new Date(lastDay)
    endDate.setDate(endDate.getDate() + (6 - lastDay.getDay()))
    
    const days: CalendarDay[] = []
    // Use Israel timezone for "today" calculation
    const todayStartMs = getIsraelDayStart(nowInIsrael())
    
    const current = new Date(startDate)
    while (current <= endDate) {
      const dayOfWeek = current.getDay()
      const currentStartMs = getIsraelDayStart(current)
      
      days.push({
        date: new Date(current),
        dayNum: current.getDate(),
        dayKey: DAY_KEYS[dayOfWeek],
        dateString: current.toISOString().split('T')[0],
        dateTimestamp: currentStartMs, // Use Israel day start
        isCurrentMonth: current.getMonth() === month,
        isToday: currentStartMs === todayStartMs,
        isPast: currentStartMs < todayStartMs,
      })
      
      current.setDate(current.getDate() + 1)
    }
    
    return days
  }, [currentMonth])

  // Check if a date is available
  const checkAvailability = useCallback((day: CalendarDay): { available: boolean; reason?: string } => {
    if (day.isPast) {
      return { available: false, reason: 'תאריך עבר' }
    }
    
    if (shopSettings?.open_days && !shopSettings.open_days.includes(day.dayKey)) {
      return { available: false, reason: 'המספרה סגורה' }
    }
    
    const shopClosure = shopClosures.find(c => 
      day.dateString >= c.start_date && day.dateString <= c.end_date
    )
    if (shopClosure) {
      return { available: false, reason: shopClosure.reason || 'המספרה סגורה' }
    }
    
    if (barberSchedule?.work_days && barberSchedule.work_days.length > 0) {
      if (!barberSchedule.work_days.includes(day.dayKey)) {
        return { available: false, reason: 'הספר לא עובד' }
      }
    } else {
      const legacyWorkDay = workDays.find((wd) => wd.day_of_week.toLowerCase() === day.dayKey)
      if (!legacyWorkDay?.is_working) {
        return { available: false, reason: 'הספר לא עובד' }
      }
    }
    
    const barberClosure = barberClosures.find(c => 
      day.dateString >= c.start_date && day.dateString <= c.end_date
    )
    if (barberClosure) {
      return { available: false, reason: barberClosure.reason || 'הספר לא זמין' }
    }
    
    return { available: true }
  }, [shopSettings, shopClosures, barberSchedule, barberClosures, workDays])

  // Handle date selection - allows clicking outside-month days if they're available
  const handleSelect = useCallback((day: CalendarDay, index: number) => {
    // Block past days
    if (day.isPast) return
    
    const availability = checkAvailability(day)
    
    if (!availability.available) {
      setUnavailableInfo({ show: true, reason: availability.reason || 'לא זמין' })
      setTimeout(() => setUnavailableInfo({ show: false, reason: '' }), 2500)
      return
    }
    
    setDate({ 
      dayName: WEEKDAY_LABELS[getDayIndexInIsrael(day.dateTimestamp)], 
      dayNum: day.dayNum.toString(), 
      dateTimestamp: day.dateTimestamp 
    })
    setFocusedIndex(index)
  }, [checkAvailability, setDate])

  // Handle continue to next step
  const handleContinue = () => {
    if (selectedDate) {
      nextStep()
    }
  }

  // Month navigation (RTL: Right = Prev, Left = Next)
  const goToPrevMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
  }

  const goToNextMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
  }

  // Check if can go to previous month
  const canGoPrev = useMemo(() => {
    const now = new Date()
    return currentMonth.getMonth() > now.getMonth() || currentMonth.getFullYear() > now.getFullYear()
  }, [currentMonth])

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent, index: number) => {
    const cols = 7
    const totalDays = calendarDays.length
    let newIndex = index

    switch (e.key) {
      case 'ArrowRight': // RTL: Move to previous day
        e.preventDefault()
        newIndex = index > 0 ? index - 1 : index
        break
      case 'ArrowLeft': // RTL: Move to next day
        e.preventDefault()
        newIndex = index < totalDays - 1 ? index + 1 : index
        break
      case 'ArrowUp':
        e.preventDefault()
        newIndex = index >= cols ? index - cols : index
        break
      case 'ArrowDown':
        e.preventDefault()
        newIndex = index + cols < totalDays ? index + cols : index
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        handleSelect(calendarDays[index], index)
        return
      default:
        return
    }

    setFocusedIndex(newIndex)
    cellRefs.current[newIndex]?.focus()
  }, [calendarDays, handleSelect])

  // Focus management
  useEffect(() => {
    if (focusedIndex !== null && cellRefs.current[focusedIndex]) {
      cellRefs.current[focusedIndex]?.focus()
    }
  }, [focusedIndex])

  // Group days into weeks
  const weeks = useMemo(() => {
    const result: CalendarDay[][] = []
    for (let i = 0; i < calendarDays.length; i += 7) {
      result.push(calendarDays.slice(i, i + 7))
    }
    return result
  }, [calendarDays])

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-xl sm:text-2xl text-foreground-light font-medium">
          בחר תאריך
        </h2>
      </div>

      {/* Calendar Card */}
      <div className="glass-card p-4 sm:p-5">
        {/* Month Navigation Header */}
        <div className="flex items-center justify-between mb-4">
          {/* Previous Month Button (Right side in RTL) */}
          <button
            onClick={goToPrevMonth}
            disabled={!canGoPrev}
            aria-label="חודש קודם"
            className={cn(
              'w-10 h-10 rounded-full flex items-center justify-center transition-all',
              canGoPrev 
                ? 'bg-white/5 hover:bg-white/10 text-foreground-light active:scale-95'
                : 'opacity-30 cursor-not-allowed text-foreground-muted'
            )}
          >
            <ChevronRight size={20} strokeWidth={1.5} />
          </button>
          
          {/* Month + Year Label */}
          <h3 className="text-base sm:text-lg font-medium text-foreground-light">
            {HEBREW_MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}
          </h3>
          
          {/* Next Month Button (Left side in RTL) */}
          <button
            onClick={goToNextMonth}
            aria-label="חודש הבא"
            className="w-10 h-10 rounded-full flex items-center justify-center transition-all bg-white/5 hover:bg-white/10 text-foreground-light active:scale-95"
          >
            <ChevronLeft size={20} strokeWidth={1.5} />
          </button>
        </div>

        {/* Weekday Labels */}
        <div 
          className="grid grid-cols-7 gap-1 sm:gap-2 mb-2"
          role="row"
          aria-label="ימי השבוע"
        >
          {WEEKDAY_LABELS.map((label, i) => (
            <div
              key={i}
              className="h-8 flex items-center justify-center text-xs sm:text-sm font-medium text-foreground-muted/70 uppercase"
              role="columnheader"
            >
              {label}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div
          ref={gridRef}
          role="grid"
          aria-label="לוח שנה"
          className="flex flex-col gap-1 sm:gap-2"
        >
          {weeks.map((week, weekIndex) => (
            <div 
              key={weekIndex} 
              role="row"
              className="grid grid-cols-7 gap-1 sm:gap-2"
            >
              {week.map((day, dayIndex) => {
                const globalIndex = weekIndex * 7 + dayIndex
                const availability = checkAvailability(day)
                const isSelected = selectedDate?.dateTimestamp === day.dateTimestamp
                const isUnavailable = !availability.available
                const isOutsideMonth = !day.isCurrentMonth
                // Clickable if available and not in the past (outside month days CAN be clicked)
                const isClickable = availability.available && !day.isPast
                
                return (
                  <button
                    key={dayIndex}
                    ref={el => { cellRefs.current[globalIndex] = el }}
                    role="gridcell"
                    aria-selected={isSelected}
                    aria-disabled={!isClickable}
                    aria-label={`${day.dayNum} ${HEBREW_MONTHS[day.date.getMonth()]}`}
                    tabIndex={isClickable ? 0 : -1}
                    onClick={() => handleSelect(day, globalIndex)}
                    onKeyDown={(e) => handleKeyDown(e, globalIndex)}
                    disabled={!isClickable}
                    className={cn(
                      // Base styles
                      'aspect-square rounded-xl flex items-center justify-center',
                      'text-sm sm:text-base font-medium',
                      'transition-all duration-200 relative',
                      'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold focus-visible:ring-offset-2 focus-visible:ring-offset-background-dark',
                      
                      // Disabled/Unavailable state (past or not available)
                      isUnavailable && [
                        'bg-white/[0.03] cursor-not-allowed',
                        isOutsideMonth ? 'text-foreground-muted/15' : 'text-foreground-muted/40',
                        'before:absolute before:inset-1 before:rounded-lg',
                        'before:bg-[repeating-linear-gradient(135deg,transparent,transparent_3px,rgba(255,255,255,0.05)_3px,rgba(255,255,255,0.05)_6px)]'
                      ].filter(Boolean).join(' '),
                      
                      // Available state (clickable) - slightly muted if outside month
                      !isUnavailable && !isSelected && [
                        isOutsideMonth ? 'bg-white/[0.03] text-foreground-muted/60' : 'bg-white/5 text-foreground-light',
                        'hover:bg-white/10 hover:scale-[1.05]',
                        'active:scale-95 cursor-pointer'
                      ].filter(Boolean).join(' '),
                      
                      // Selected state - highest emphasis
                      isSelected && [
                        'bg-accent-gold text-background-dark font-bold',
                        'scale-[1.05] shadow-lg shadow-accent-gold/30',
                        'ring-2 ring-accent-gold ring-offset-2 ring-offset-background-dark'
                      ].filter(Boolean).join(' '),
                      
                      // Today indicator (subtle outline when not selected)
                      day.isToday && !isSelected && !isUnavailable && 'ring-1 ring-accent-gold/50'
                    )}
                  >
                    {day.dayNum}
                  </button>
                )
              })}
            </div>
          ))}
        </div>

        {/* Unavailable Info Toast */}
        {unavailableInfo.show && (
          <div className="absolute left-1/2 -translate-x-1/2 bottom-4 animate-fade-in z-10">
            <div className="glass-card px-4 py-2 flex items-center gap-2 shadow-xl">
              <X size={14} className="text-red-400 flex-shrink-0" />
              <span className="text-sm text-foreground-light whitespace-nowrap">
                {unavailableInfo.reason}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 sm:gap-6 text-xs text-foreground-muted">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-white/5 border border-white/10" />
          <span>פנוי</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-accent-gold shadow-sm" />
          <span>נבחר</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-white/[0.03] border border-white/5 relative overflow-hidden">
            <div className="absolute inset-0 bg-[repeating-linear-gradient(135deg,transparent,transparent_2px,rgba(255,255,255,0.1)_2px,rgba(255,255,255,0.1)_4px)]" />
          </div>
          <span>לא זמין</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col gap-3">
        {/* Selected Date Display */}
        {selectedDate && (
          <div className="text-center py-2">
            <p className="text-foreground-muted text-sm">
              תאריך נבחר:{' '}
              <span className="text-accent-gold font-medium">
                {selectedDate.dayName} {selectedDate.dayNum}
              </span>
            </p>
          </div>
        )}

        {/* Continue Button */}
        <button
          onClick={handleContinue}
          disabled={!selectedDate}
          className={cn(
            'w-full py-4 rounded-2xl font-medium text-base transition-all',
            'flex items-center justify-center gap-2',
            selectedDate
              ? 'bg-accent-gold text-background-dark shadow-lg shadow-accent-gold/20 hover:shadow-accent-gold/30 active:scale-[0.98]'
              : 'bg-white/5 text-foreground-muted/50 cursor-not-allowed'
          )}
        >
          {selectedDate ? 'המשך לבחירת שעה' : 'בחר תאריך להמשך'}
          {selectedDate && <ChevronLeft size={18} strokeWidth={2} />}
        </button>

        {/* Back Button - Goes back to barber profile/service selection */}
        <button
          onClick={() => {
            // Navigate back to barber profile page for service selection
            if (barberId) {
              router.push(`/barber/${barberId}`)
            } else {
              router.back()
            }
          }}
          className="flex items-center justify-center gap-2 text-foreground-muted hover:text-foreground-light transition-colors text-sm py-2"
        >
          <ChevronRight size={14} strokeWidth={1.5} />
          <span>חזרה לבחירת שירות</span>
        </button>
      </div>
    </div>
  )
}
