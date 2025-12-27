import { format, addDays, startOfDay, setHours, setMinutes } from 'date-fns'
import { toZonedTime, fromZonedTime } from 'date-fns-tz'
import { he } from 'date-fns/locale'

// Israel timezone constant
export const ISRAEL_TIMEZONE = 'Asia/Jerusalem'

/**
 * Get current time in Israel timezone
 */
export function nowInIsrael(): Date {
  return toZonedTime(new Date(), ISRAEL_TIMEZONE)
}

/**
 * Convert a Date to Israel timezone
 */
export function toIsraelTime(date: Date): Date {
  return toZonedTime(date, ISRAEL_TIMEZONE)
}

/**
 * Convert a timestamp (milliseconds) to Israel timezone Date
 */
export function timestampToIsraelDate(timestamp: number): Date {
  return toZonedTime(new Date(timestamp), ISRAEL_TIMEZONE)
}

/**
 * Create a Date in Israel timezone and get its UTC timestamp
 */
export function israelDateToTimestamp(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0
): number {
  const israelDate = fromZonedTime(
    new Date(year, month - 1, day, hour, minute, 0, 0),
    ISRAEL_TIMEZONE
  )
  return israelDate.getTime()
}

/**
 * Generate a random ID
 */
export function makeId(length = 6): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

/**
 * Get Hebrew day name from English
 */
export function getDayNameInHebrew(dayName: string): string {
  const days: Record<string, string> = {
    Sunday: 'ראשון',
    Monday: 'שני',
    Tuesday: 'שלישי',
    Wednesday: 'רביעי',
    Thursday: 'חמישי',
    Friday: 'שישי',
    Saturday: 'שבת',
    sunday: 'ראשון',
    monday: 'שני',
    tuesday: 'שלישי',
    wednesday: 'רביעי',
    thursday: 'חמישי',
    friday: 'שישי',
    saturday: 'שבת',
  }
  return days[dayName] || dayName
}

export interface DateOption {
  dayName: string
  dayNum: string
  dateTimestamp: number // ALWAYS in milliseconds
  dateString: string // ISO date string YYYY-MM-DD for comparisons
  dayKey: string // lowercase day name: 'sunday', 'monday', etc.
  isWorking?: boolean
}

/**
 * Get next 14 days with Hebrew day names (Israel timezone)
 */
export function getNextWeekDates(daysCount = 14): DateOption[] {
  const dates: DateOption[] = []
  const nowIsrael = nowInIsrael()
  const todayStart = startOfDay(nowIsrael)

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

/**
 * Format timestamp (milliseconds) to time string (HH:mm) in Israel timezone
 */
export function formatTime(timestamp: number): string {
  const date = timestampToIsraelDate(timestamp)
  return format(date, 'HH:mm')
}

/**
 * Format timestamp (milliseconds) to full date in Hebrew
 */
export function formatDateHebrew(timestamp: number): string {
  const date = timestampToIsraelDate(timestamp)
  return format(date, "EEEE, d בMMMM yyyy", { locale: he })
}

/**
 * Format timestamp (milliseconds) to short date
 */
export function formatDateShort(timestamp: number): string {
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
  const nowIsrael = nowInIsrael()
  const todayStart = startOfDay(nowIsrael)
  return date < todayStart
}

/**
 * Generate time slots for a given date (Israel timezone)
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
  const startDate = setMinutes(setHours(baseDate, startHour), startMinute)
  const endDate = setMinutes(setHours(baseDate, endHour), endMinute)
  
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

/**
 * Parse time string (HH:mm) to hours and minutes
 */
export function parseTimeString(timeStr: string): { hour: number; minute: number } {
  const [hour, minute] = timeStr.split(':').map(Number)
  return { hour: hour || 0, minute: minute || 0 }
}

/**
 * Combine utility classes
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}
