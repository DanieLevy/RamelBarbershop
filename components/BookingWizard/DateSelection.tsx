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

// Availability result types for enhanced UX
type UnavailabilityType = 'past' | 'out_of_range' | 'shop_closed' | 'shop_closure' | 'barber_not_working' | 'barber_closure'

interface AvailabilityResult {
  available: boolean
  reason?: string
  type?: UnavailabilityType
  closureReason?: string // Custom reason from barber/shop closure
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
      
      // Format date as YYYY-MM-DD in LOCAL timezone (not UTC!)
      // toISOString() uses UTC which causes off-by-one errors in Israel timezone
      const localDateString = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`
      
      days.push({
        date: new Date(current),
        dayNum: current.getDate(),
        dayKey: DAY_KEYS[dayOfWeek],
        dateString: localDateString,
        dateTimestamp: currentStartMs, // Use Israel day start
        isCurrentMonth: current.getMonth() === month,
        isToday: currentStartMs === todayStartMs,
        isPast: currentStartMs < todayStartMs,
      })
      
      current.setDate(current.getDate() + 1)
    }
    
    return days
  }, [currentMonth])

  // Calculate max booking date based on settings
  const maxBookingDate = useMemo(() => {
    const maxDays = shopSettings?.max_booking_days_ahead || 21
    const today = nowInIsrael()
    const maxDate = new Date(today)
    maxDate.setDate(maxDate.getDate() + maxDays)
    return getIsraelDayStart(maxDate)
  }, [shopSettings?.max_booking_days_ahead])

  // Check if a date is available with structured response
  const checkAvailability = useCallback((day: CalendarDay): AvailabilityResult => {
    // 1. Check if past
    if (day.isPast) {
      return { available: false, reason: 'תאריך עבר', type: 'past' }
    }
    
    // 2. Check if today is past working hours
    if (day.isToday) {
      const now = nowInIsrael()
      const currentHour = now.getHours()
      const currentMinute = now.getMinutes()
      
      let endTimeStr = barberSchedule?.work_hours_end || shopSettings?.work_hours_end || '19:00'
      if (endTimeStr.includes(':')) {
        endTimeStr = endTimeStr.split(':').slice(0, 2).join(':')
      }
      const [endHour, endMinute] = endTimeStr.split(':').map(Number)
      
      if (currentHour > endHour || (currentHour === endHour && currentMinute >= endMinute)) {
        return { available: false, reason: 'שעות העבודה הסתיימו להיום', type: 'past' }
      }
    }
    
    // 3. Check if out of booking range
    if (day.dateTimestamp > maxBookingDate) {
      const maxDays = shopSettings?.max_booking_days_ahead || 21
      return { 
        available: false, 
        reason: `ניתן לקבוע תור עד ${maxDays} ימים מראש`, 
        type: 'out_of_range' 
      }
    }
    
    // 4. Check if shop is closed on this day
    if (shopSettings?.open_days && !shopSettings.open_days.includes(day.dayKey)) {
      return { available: false, reason: 'המספרה סגורה', type: 'shop_closed' }
    }
    
    // 5. Check shop closure with optional reason
    const shopClosure = shopClosures.find(c => 
      day.dateString >= c.start_date && day.dateString <= c.end_date
    )
    if (shopClosure) {
      return { 
        available: false, 
        reason: shopClosure.reason || 'המספרה סגורה', 
        type: 'shop_closure',
        closureReason: shopClosure.reason || undefined
      }
    }
    
    // 6. Check if barber works on this day
    // Priority: work_days table (day-specific) > barberSchedule (legacy global)
    const workDay = workDays.find((wd) => wd.day_of_week.toLowerCase() === day.dayKey)
    if (workDay) {
      // Use day-specific work_days table (new method)
      if (!workDay.is_working) {
        return { available: false, reason: 'הספר לא עובד', type: 'barber_not_working' }
      }
    } else if (barberSchedule?.work_days && barberSchedule.work_days.length > 0) {
      // Fallback to legacy barberSchedule
      if (!barberSchedule.work_days.includes(day.dayKey)) {
        return { available: false, reason: 'הספר לא עובד', type: 'barber_not_working' }
      }
    }
    
    // 7. Check barber closure with optional reason
    const barberClosure = barberClosures.find(c => 
      day.dateString >= c.start_date && day.dateString <= c.end_date
    )
    if (barberClosure) {
      return { 
        available: false, 
        reason: barberClosure.reason || 'הספר לא זמין', 
        type: 'barber_closure',
        closureReason: barberClosure.reason || undefined
      }
    }
    
    return { available: true }
  }, [shopSettings, shopClosures, barberSchedule, barberClosures, workDays, maxBookingDate])

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

  // Check if can go to previous month - use Israel timezone for accurate month check
  const canGoPrev = useMemo(() => {
    const now = nowInIsrael()
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

  // Get closures visible in the current month that have custom reasons
  const visibleClosures = useMemo(() => {
    const closures: { type: 'shop' | 'barber'; reason: string; startDate: string; endDate: string }[] = []
    
    // Get date range of visible calendar
    const firstDay = calendarDays[0]?.dateString
    const lastDay = calendarDays[calendarDays.length - 1]?.dateString
    
    if (!firstDay || !lastDay) return closures
    
    // Shop closures with reasons
    shopClosures.forEach(c => {
      if (c.reason && c.start_date <= lastDay && c.end_date >= firstDay) {
        closures.push({
          type: 'shop',
          reason: c.reason,
          startDate: c.start_date,
          endDate: c.end_date
        })
      }
    })
    
    // Barber closures with reasons
    barberClosures.forEach(c => {
      if (c.reason && c.start_date <= lastDay && c.end_date >= firstDay) {
        closures.push({
          type: 'barber',
          reason: c.reason,
          startDate: c.start_date,
          endDate: c.end_date
        })
      }
    })
    
    return closures
  }, [calendarDays, shopClosures, barberClosures])

  // Format date range for legend display
  const formatDateRange = (startDate: string, endDate: string): string => {
    const start = new Date(startDate)
    const end = new Date(endDate)
    const startDay = start.getDate()
    const endDay = end.getDate()
    const startMonth = HEBREW_MONTHS[start.getMonth()]
    const endMonth = HEBREW_MONTHS[end.getMonth()]
    
    if (startDate === endDate) {
      return `${startDay} ${startMonth}`
    }
    if (start.getMonth() === end.getMonth()) {
      return `${startDay}-${endDay} ${startMonth}`
    }
    return `${startDay} ${startMonth} - ${endDay} ${endMonth}`
  }

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
                const isClickable = availability.available && !day.isPast
                
                // Determine visual style based on unavailability type
                const isOutOfRange = availability.type === 'out_of_range'
                const isClosure = availability.type === 'shop_closure' || availability.type === 'barber_closure'
                const hasClosure = isClosure && availability.closureReason
                
                return (
                  <button
                    key={dayIndex}
                    ref={el => { cellRefs.current[globalIndex] = el }}
                    role="gridcell"
                    aria-selected={isSelected}
                    aria-disabled={!isClickable}
                    aria-label={`${day.dayNum} ${HEBREW_MONTHS[day.date.getMonth()]}${isUnavailable ? ` - ${availability.reason}` : ''}`}
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
                      
                      // Out of range - dashed border, very muted
                      isOutOfRange && [
                        'bg-white/[0.01] cursor-not-allowed border border-dashed border-white/10',
                        isOutsideMonth ? 'text-foreground-muted/10' : 'text-foreground-muted/25'
                      ].filter(Boolean).join(' '),
                      
                      // Closures with custom reason - colored indicator
                      isClosure && !isOutOfRange && [
                        'bg-white/[0.03] cursor-not-allowed',
                        isOutsideMonth ? 'text-foreground-muted/15' : 'text-foreground-muted/40',
                        'before:absolute before:inset-1 before:rounded-lg',
                        'before:bg-[repeating-linear-gradient(135deg,transparent,transparent_3px,rgba(255,255,255,0.05)_3px,rgba(255,255,255,0.05)_6px)]'
                      ].filter(Boolean).join(' '),
                      
                      // Other unavailable states (past, shop closed, barber not working)
                      isUnavailable && !isOutOfRange && !isClosure && [
                        'bg-white/[0.03] cursor-not-allowed',
                        isOutsideMonth ? 'text-foreground-muted/15' : 'text-foreground-muted/40',
                        'before:absolute before:inset-1 before:rounded-lg',
                        'before:bg-[repeating-linear-gradient(135deg,transparent,transparent_3px,rgba(255,255,255,0.05)_3px,rgba(255,255,255,0.05)_6px)]'
                      ].filter(Boolean).join(' '),
                      
                      // Available state (clickable)
                      !isUnavailable && !isSelected && [
                        isOutsideMonth ? 'bg-white/[0.03] text-foreground-muted/60' : 'bg-white/5 text-foreground-light',
                        'hover:bg-white/10 hover:scale-[1.05]',
                        'active:scale-95 cursor-pointer'
                      ].filter(Boolean).join(' '),
                      
                      // Selected state
                      isSelected && [
                        'bg-accent-gold text-background-dark font-bold',
                        'scale-[1.05] shadow-lg shadow-accent-gold/30',
                        'ring-2 ring-accent-gold ring-offset-2 ring-offset-background-dark'
                      ].filter(Boolean).join(' '),
                      
                      // Today indicator
                      day.isToday && !isSelected && !isUnavailable && 'ring-1 ring-accent-gold/50'
                    )}
                  >
                    {day.dayNum}
                    {/* Closure indicator dot */}
                    {hasClosure && !isOutOfRange && (
                      <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-orange-400" />
                    )}
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
      <div className="flex flex-col gap-3">
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
            <div className="w-5 h-5 rounded-md bg-white/[0.03] border border-dashed border-white/10" />
            <span>מחוץ לטווח</span>
          </div>
        </div>
        
        {/* Closure reasons legend - only show if there are closures with reasons */}
        {visibleClosures.length > 0 && (
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3 space-y-2">
            {visibleClosures.map((closure, index) => (
              <div key={index} className="flex items-center gap-2 text-xs">
                <span className="w-2 h-2 rounded-full bg-orange-400 shrink-0" />
                <span className="text-foreground-muted">
                  {closure.type === 'shop' ? 'המספרה' : 'הספר'} - {closure.reason}
                </span>
                <span className="text-foreground-muted/60 mr-auto">
                  ({formatDateRange(closure.startDate, closure.endDate)})
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col gap-3">
        {/* Selected Date Display */}
        {selectedDate && (
          <div className="text-center py-2">
            <p className="text-foreground-muted text-sm">
              תאריך נבחר:{' '}
              <span className="text-accent-gold font-medium">
                יום {selectedDate.dayName},{' '}
                {selectedDate.dayNum} {selectedDate.dateTimestamp ? 
                  HEBREW_MONTHS[new Date(selectedDate.dateTimestamp).getMonth()] : ''}{' '}
                {selectedDate.dateTimestamp ? new Date(selectedDate.dateTimestamp).getFullYear() : ''}
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
