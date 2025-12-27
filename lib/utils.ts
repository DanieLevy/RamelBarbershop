import { format, addDays } from 'date-fns'
import { he } from 'date-fns/locale'

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
  }
  return days[dayName] || dayName
}

export interface DateOption {
  dayName: string
  dayNum: string
  dateTimestamp: number
  isWorking?: boolean
}

/**
 * Get next 7 days with Hebrew day names
 */
export function getNextWeekDates(): DateOption[] {
  const dates: DateOption[] = []
  const today = new Date()

  for (let i = 0; i < 7; i++) {
    const date = addDays(today, i)
    const dayNameEn = format(date, 'EEEE', { locale: he })
    const dayNum = format(date, 'dd/MM')
    const dateTimestamp = Math.floor(date.getTime() / 1000)

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
    })
  }

  return dates
}

/**
 * Format unix timestamp to time string (HH:mm)
 */
export function formatTime(timestamp: number): string {
  const date = new Date(timestamp * 1000)
  return format(date, 'HH:mm')
}

/**
 * Get day of week name from timestamp (lowercase english)
 */
export function getDayOfWeek(timestamp: number): string {
  const date = new Date(timestamp * 1000)
  return format(date, 'EEEE').toLowerCase()
}

/**
 * Check if a date is disabled for booking (past dates, etc.)
 */
export function isDateDisabled(date: Date): boolean {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return date < today
}

/**
 * Combine utility classes
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}

