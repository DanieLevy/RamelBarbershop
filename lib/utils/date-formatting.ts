/**
 * Date Formatting and Time Slot Generation
 *
 * Functions for formatting dates/times in Israel timezone,
 * generating time slots, and date utility functions.
 */

import { format, addDays, startOfDay, setHours, setMinutes, setSeconds, setMilliseconds } from 'date-fns'
import { he } from 'date-fns/locale'
import { timestampToIsraelDate, nowInIsrael } from './timezone'
import { getDayNameInHebrew } from './hebrew'

// ============================================================
// DATE OPTION TYPE
// ============================================================

export interface DateOption {
  dayName: string
  dayNum: string
  dateTimestamp: number // ALWAYS in milliseconds
  dateString: string // ISO date string YYYY-MM-DD for comparisons
  dayKey: string // lowercase day name: 'sunday', 'monday', etc.
  isWorking?: boolean
}

// ============================================================
// TIMESTAMP VALIDATION
// ============================================================

/**
 * Validate if a timestamp is valid for formatting
 */
function isValidTimestamp(timestamp: unknown): timestamp is number {
  if (typeof timestamp !== 'number') return false
  if (isNaN(timestamp)) return false
  if (!isFinite(timestamp)) return false
  // Check if timestamp creates a valid date (reasonable range: 1970-2100)
  if (timestamp < 0 || timestamp > 4102444800000) return false
  const date = new Date(timestamp)
  return !isNaN(date.getTime())
}

// ============================================================
// DATE/TIME FORMATTING
// ============================================================

/**
 * Format timestamp (milliseconds) to time string (HH:mm) in Israel timezone
 */
export function formatTime(timestamp: number): string {
  if (!isValidTimestamp(timestamp)) {
    console.warn('[formatTime] Invalid timestamp:', timestamp)
    return '--:--'
  }
  const date = timestampToIsraelDate(timestamp)
  return format(date, 'HH:mm')
}

/**
 * Format timestamp (milliseconds) to full date in Hebrew
 */
export function formatDateHebrew(timestamp: number): string {
  if (!isValidTimestamp(timestamp)) {
    console.warn('[formatDateHebrew] Invalid timestamp:', timestamp)
    return 'תאריך לא זמין'
  }
  const date = timestampToIsraelDate(timestamp)
  return format(date, "EEEE, d בMMMM yyyy", { locale: he })
}

/**
 * Format timestamp (milliseconds) to short date
 */
export function formatDateShort(timestamp: number): string {
  if (!isValidTimestamp(timestamp)) {
    console.warn('[formatDateShort] Invalid timestamp:', timestamp)
    return '--/--/----'
  }
  const date = timestampToIsraelDate(timestamp)
  return format(date, 'dd/MM/yyyy')
}

/**
 * Get day of week name from timestamp (lowercase english)
 */
export function getDayOfWeek(timestamp: number): string {
  const date = timestampToIsraelDate(timestamp)
  const dayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  return dayKeys[date.getDay()]
}

/**
 * Get day key from Date object (lowercase)
 */
export function getDayKey(date: Date): string {
  const dayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  return dayKeys[date.getDay()]
}

/**
 * Check if a date is disabled for booking (past dates, etc.)
 */
export function isDateDisabled(date: Date): boolean {
  const nowIsraelDate = nowInIsrael()
  const todayStart = startOfDay(nowIsraelDate)
  return date < todayStart
}

// ============================================================
// TIME SLOT GENERATION
// ============================================================

/**
 * Generate time slots for a given date (Israel timezone)
 * Note: If endHour is 0 (midnight), it's treated as 24:00 (end of day)
 */
export function generateTimeSlots(
  dateTimestamp: number,
  startHour: number,
  startMinute: number,
  endHour: number,
  endMinute: number,
  intervalMinutes = 30
): { timestamp: number; time: string }[] {
  const slots: { timestamp: number; time: string }[] = []
  
  const baseDate = timestampToIsraelDate(dateTimestamp)
  let startDate = setMinutes(setHours(baseDate, startHour), startMinute)
  // CRITICAL: Zero out seconds and milliseconds for clean slot timestamps
  startDate = setSeconds(setMilliseconds(startDate, 0), 0)
  
  // Handle midnight (00:00) as end of day (24:00)
  let endDate: Date
  if (endHour === 0 && endMinute === 0) {
    endDate = setMinutes(setHours(baseDate, 23), 59)
  } else {
    endDate = setMinutes(setHours(baseDate, endHour), endMinute)
  }
  endDate = setSeconds(setMilliseconds(endDate, 0), 0)
  
  let currentTime = startDate.getTime()
  const endTime = endDate.getTime()
  const nowMs = Date.now()
  const isToday = format(baseDate, 'yyyy-MM-dd') === format(nowInIsrael(), 'yyyy-MM-dd')
  
  while (currentTime < endTime) {
    // Skip past slots for today
    if (!isToday || currentTime > nowMs) {
      slots.push({
        timestamp: currentTime,
        time: formatTime(currentTime),
      })
    }
    currentTime += intervalMinutes * 60 * 1000
  }
  
  return slots
}

// ============================================================
// TIME PARSING AND COMPARISON
// ============================================================

/**
 * Parse time string (HH:mm) to hours and minutes
 */
export function parseTimeString(timeStr: string): { hour: number; minute: number } {
  const [hour, minute] = timeStr.split(':').map(Number)
  return { hour: hour || 0, minute: minute || 0 }
}

/**
 * Convert time string to minutes for proper numeric comparison
 * @param time Time string in HH:mm or HH:mm:ss format
 * @param treatMidnightAsEndOfDay If true, "00:00" is treated as 24:00 (1440 minutes)
 */
export function timeToMinutes(time: string, treatMidnightAsEndOfDay = false): number {
  const parts = time.split(':').map(Number)
  const hours = parts[0] || 0
  const minutes = parts[1] || 0
  const totalMinutes = hours * 60 + minutes
  
  if (treatMidnightAsEndOfDay && totalMinutes === 0) {
    return 24 * 60 // 1440 minutes = end of day
  }
  
  return totalMinutes
}

/**
 * Check if a current time is within business hours
 * Properly handles midnight (00:00) as end of day
 */
export function isTimeWithinBusinessHours(currentTime: string, startTime: string, endTime: string): boolean {
  const current = timeToMinutes(currentTime)
  const start = timeToMinutes(startTime)
  const end = timeToMinutes(endTime, true) // Treat 00:00 as 24:00
  
  return current >= start && current < end
}

// ============================================================
// DATE GENERATION
// ============================================================

/**
 * Get next 14 days with Hebrew day names (Israel timezone)
 */
export function getNextWeekDates(daysCount = 14): DateOption[] {
  const dates: DateOption[] = []
  const nowIsraelDate = nowInIsrael()
  const todayStart = startOfDay(nowIsraelDate)

  const dayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

  for (let i = 0; i < daysCount; i++) {
    const date = addDays(todayStart, i)
    const dayNum = format(date, 'dd/MM')
    const dateString = format(date, 'yyyy-MM-dd')
    const dayKey = dayKeys[date.getDay()]
    
    // Store timestamp in MILLISECONDS
    const dateTimestamp = date.getTime()

    let dayName: string
    if (i === 0) {
      dayName = 'היום'
    } else if (i === 1) {
      dayName = 'מחר'
    } else {
      dayName = getDayNameInHebrew(format(date, 'EEEE'))
    }

    dates.push({
      dayName,
      dayNum,
      dateTimestamp,
      dateString,
      dayKey,
    })
  }

  return dates
}
