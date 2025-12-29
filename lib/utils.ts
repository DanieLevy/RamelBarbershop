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
 * Get current timestamp in milliseconds (Israel-aware)
 * Use this instead of Date.now() when comparing with Israel dates
 */
export function nowInIsraelMs(): number {
  return Date.now()
}

/**
 * Check if a timestamp is today in Israel timezone
 */
export function isTodayInIsrael(timestamp: number): boolean {
  const nowIsrael = nowInIsrael()
  const dateIsrael = timestampToIsraelDate(timestamp)
  return format(nowIsrael, 'yyyy-MM-dd') === format(dateIsrael, 'yyyy-MM-dd')
}

/**
 * Check if a timestamp is in the past (Israel timezone aware)
 */
export function isPastInIsrael(timestamp: number): boolean {
  return timestamp < Date.now()
}

/**
 * Check if a date string (YYYY-MM-DD) is today in Israel
 */
export function isDateStringToday(dateString: string): boolean {
  const nowIsrael = nowInIsrael()
  return format(nowIsrael, 'yyyy-MM-dd') === dateString
}

/**
 * Get today's date string in Israel timezone (YYYY-MM-DD)
 */
export function getTodayDateString(): string {
  return format(nowInIsrael(), 'yyyy-MM-dd')
}

/**
 * Get ISO date string for a timestamp in Israel timezone
 */
export function getIsraelDateString(timestamp: number): string {
  const date = timestampToIsraelDate(timestamp)
  return format(date, 'yyyy-MM-dd')
}

/**
 * Compare two timestamps by date only (ignoring time) in Israel timezone
 */
export function isSameDayInIsrael(timestamp1: number, timestamp2: number): boolean {
  return getIsraelDateString(timestamp1) === getIsraelDateString(timestamp2)
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

/**
 * Format price with currency symbol
 */
export function formatPrice(price: number): string {
  return `₪${price.toLocaleString('he-IL')}`
}

/**
 * Hebrew day letter mapping
 */
const hebrewDayLetters: Record<string, string> = {
  sunday: "א'",
  monday: "ב'",
  tuesday: "ג'",
  wednesday: "ד'",
  thursday: "ה'",
  friday: "ו'",
  saturday: "ש'",
}

/**
 * Day order for sorting
 */
const dayOrder = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

export interface OpenDayRange {
  range: string
  isSingleDay: boolean
}

/**
 * Format open days into grouped ranges
 * e.g., ['sunday', 'tuesday', 'wednesday', 'thursday', 'friday'] 
 *   => ["א'", "ג'-ה'", "ו'"] (if friday is open)
 *   or smartly grouped consecutive days
 */
export function formatOpenDaysRanges(openDays: string[]): OpenDayRange[] {
  if (!openDays || openDays.length === 0) return []
  
  // Sort days by their order in the week
  const sortedDays = [...openDays].sort((a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b))
  
  const ranges: OpenDayRange[] = []
  let rangeStart = ''
  let rangeEnd = ''
  
  for (let i = 0; i < sortedDays.length; i++) {
    const currentDay = sortedDays[i]
    const currentIndex = dayOrder.indexOf(currentDay)
    
    if (!rangeStart) {
      rangeStart = currentDay
      rangeEnd = currentDay
    } else {
      const prevIndex = dayOrder.indexOf(rangeEnd)
      // Check if current day is consecutive
      if (currentIndex === prevIndex + 1) {
        rangeEnd = currentDay
      } else {
        // End current range and start a new one
        if (rangeStart === rangeEnd) {
          ranges.push({ range: hebrewDayLetters[rangeStart], isSingleDay: true })
        } else {
          ranges.push({ range: `${hebrewDayLetters[rangeStart]}-${hebrewDayLetters[rangeEnd]}`, isSingleDay: false })
        }
        rangeStart = currentDay
        rangeEnd = currentDay
      }
    }
  }
  
  // Don't forget the last range
  if (rangeStart) {
    if (rangeStart === rangeEnd) {
      ranges.push({ range: hebrewDayLetters[rangeStart], isSingleDay: true })
    } else {
      ranges.push({ range: `${hebrewDayLetters[rangeStart]}-${hebrewDayLetters[rangeEnd]}`, isSingleDay: false })
    }
  }
  
  return ranges
}

/**
 * Format opening hours display with proper day grouping
 * Returns array of { days: string, hours: string, isClosed?: boolean }
 */
export interface OpeningHoursDisplay {
  days: string
  hours: string
  isClosed?: boolean
}

export function formatOpeningHours(
  openDays: string[],
  workStart: string,
  workEnd: string,
  fridayEnd?: string
): OpeningHoursDisplay[] {
  const result: OpeningHoursDisplay[] = []
  
  // Separate Friday and Saturday from regular days (they often have different hours or closed)
  const regularDays = openDays.filter(d => d !== 'friday' && d !== 'saturday')
  const hasFriday = openDays.includes('friday')
  const hasSaturday = openDays.includes('saturday')
  
  // Format regular weekdays
  if (regularDays.length > 0) {
    const ranges = formatOpenDaysRanges(regularDays)
    const daysStr = ranges.map(r => r.range).join(', ')
    result.push({
      days: daysStr,
      hours: `${workStart} - ${workEnd}`
    })
  }
  
  // Check for closed weekdays (except Friday/Saturday)
  const allWeekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday']
  const closedWeekdays = allWeekdays.filter(d => !openDays.includes(d))
  if (closedWeekdays.length > 0 && closedWeekdays.length < 5) {
    const closedRanges = formatOpenDaysRanges(closedWeekdays)
    const closedStr = closedRanges.map(r => r.range).join(', ')
    result.push({
      days: closedStr,
      hours: 'סגור',
      isClosed: true
    })
  }
  
  // Friday
  if (hasFriday) {
    result.push({
      days: "ו'",
      hours: `${workStart} - ${fridayEnd || '14:00'}`
    })
  } else {
    result.push({
      days: "ו'",
      hours: 'סגור',
      isClosed: true
    })
  }
  
  // Saturday
  if (hasSaturday) {
    result.push({
      days: "ש'",
      hours: `${workStart} - ${workEnd}`
    })
  } else {
    result.push({
      days: "ש'",
      hours: 'סגור',
      isClosed: true
    })
  }
  
  return result
}
