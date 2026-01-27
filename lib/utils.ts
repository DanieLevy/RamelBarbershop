import { format, addDays, startOfDay, setHours, setMinutes } from 'date-fns'
import { toZonedTime, fromZonedTime } from 'date-fns-tz'
import { he } from 'date-fns/locale'

// ============================================================
// ISRAEL TIMEZONE CONSTANTS
// ============================================================

/**
 * Israel timezone identifier - USE THIS CONSTANT EVERYWHERE
 * Never hardcode 'Asia/Jerusalem' elsewhere
 */
export const ISRAEL_TIMEZONE = 'Asia/Jerusalem'

// ============================================================
// CORE TIMEZONE CONVERSION FUNCTIONS
// ============================================================

/**
 * Get current time in Israel timezone
 * This is the PRIMARY function for getting "now" in Israel
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
 * IMPORTANT: This converts UTC timestamp to Israel local representation
 */
export function timestampToIsraelDate(timestamp: number): Date {
  return toZonedTime(new Date(timestamp), ISRAEL_TIMEZONE)
}

/**
 * Create a Date in Israel timezone and get its UTC timestamp
 * Use when you have year/month/day/hour/minute in Israel local time
 * and need the UTC timestamp for storage
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
 * Get current timestamp in milliseconds
 * Note: Date.now() is timezone-agnostic (always UTC)
 * Use this for comparisons with stored timestamps
 */
export function nowInIsraelMs(): number {
  return Date.now()
}

// ============================================================
// ISRAEL DAY BOUNDARY FUNCTIONS
// Critical for queries that filter by date
// ============================================================

/**
 * Get start of day (00:00:00.000) in Israel timezone as UTC timestamp
 * USE THIS for database queries filtering by day start
 */
export function getIsraelDayStart(date: Date | number): number {
  const israelDate = typeof date === 'number' 
    ? timestampToIsraelDate(date) 
    : toIsraelTime(date)
  
  const year = israelDate.getFullYear()
  const month = israelDate.getMonth() + 1 // getMonth is 0-indexed
  const day = israelDate.getDate()
  
  return israelDateToTimestamp(year, month, day, 0, 0)
}

/**
 * Get end of day (23:59:59.999) in Israel timezone as UTC timestamp
 * USE THIS for database queries filtering by day end
 */
export function getIsraelDayEnd(date: Date | number): number {
  const dayStart = getIsraelDayStart(date)
  // Add 24 hours minus 1 millisecond
  return dayStart + (24 * 60 * 60 * 1000) - 1
}

/**
 * Get start of day as Date object in Israel timezone
 */
export function startOfDayInIsrael(date: Date | number): Date {
  const timestamp = getIsraelDayStart(date)
  return timestampToIsraelDate(timestamp)
}

/**
 * Get end of day as Date object in Israel timezone
 */
export function endOfDayInIsrael(date: Date | number): Date {
  const timestamp = getIsraelDayEnd(date)
  return timestampToIsraelDate(timestamp)
}

// ============================================================
// DAY OF WEEK FUNCTIONS (ISRAEL TIMEZONE)
// ============================================================

/**
 * Get day of week (0-6, Sunday=0) for a timestamp in Israel timezone
 * ALWAYS use this instead of new Date(timestamp).getDay()
 */
export function getDayIndexInIsrael(timestamp: number): number {
  const israelDate = timestampToIsraelDate(timestamp)
  return israelDate.getDay()
}

/**
 * Get day key (lowercase string) for a timestamp in Israel timezone
 */
export function getDayKeyInIsrael(timestamp: number): string {
  const dayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  return dayKeys[getDayIndexInIsrael(timestamp)]
}

// ============================================================
// DATE COMPARISON FUNCTIONS
// ============================================================

/**
 * Check if a timestamp is today in Israel timezone
 */
export function isTodayInIsrael(timestamp: number): boolean {
  const nowIsrael = nowInIsrael()
  const dateIsrael = timestampToIsraelDate(timestamp)
  return format(nowIsrael, 'yyyy-MM-dd') === format(dateIsrael, 'yyyy-MM-dd')
}

/**
 * Check if a timestamp is in the past
 * Note: This is timezone-agnostic as it compares UTC timestamps
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
  const nowIsrael = nowInIsrael()
  const todayStart = startOfDay(nowIsrael)
  return date < todayStart
}

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
  const startDate = setMinutes(setHours(baseDate, startHour), startMinute)
  
  // Handle midnight (00:00) as end of day (24:00)
  // If endHour is 0 and endMinute is 0, treat it as 24:00 (next day midnight)
  let endDate: Date
  if (endHour === 0 && endMinute === 0) {
    // Set to 23:59 to generate slots up to the last slot before midnight
    endDate = setMinutes(setHours(baseDate, 23), 59)
  } else {
    endDate = setMinutes(setHours(baseDate, endHour), endMinute)
  }
  
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
 * Convert time string to minutes for proper numeric comparison
 * @param time Time string in HH:mm or HH:mm:ss format
 * @param treatMidnightAsEndOfDay If true, "00:00" is treated as 24:00 (1440 minutes)
 */
export function timeToMinutes(time: string, treatMidnightAsEndOfDay = false): number {
  const parts = time.split(':').map(Number)
  const hours = parts[0] || 0
  const minutes = parts[1] || 0
  const totalMinutes = hours * 60 + minutes
  
  // If it's midnight and we should treat it as end of day
  if (treatMidnightAsEndOfDay && totalMinutes === 0) {
    return 24 * 60 // 1440 minutes = end of day
  }
  
  return totalMinutes
}

/**
 * Check if a current time is within business hours
 * Properly handles midnight (00:00) as end of day
 * @param currentTime Current time string (HH:mm)
 * @param startTime Business start time (HH:mm)
 * @param endTime Business end time (HH:mm) - 00:00 is treated as midnight/end of day
 */
export function isTimeWithinBusinessHours(currentTime: string, startTime: string, endTime: string): boolean {
  const current = timeToMinutes(currentTime)
  const start = timeToMinutes(startTime)
  const end = timeToMinutes(endTime, true) // Treat 00:00 as 24:00
  
  return current >= start && current < end
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

// ============================================================
// BARBER SLUG UTILITIES
// ============================================================

/**
 * Hebrew to Latin transliteration map for URL-safe slugs
 */
const hebrewToLatinMap: Record<string, string> = {
  'א': 'a', 'ב': 'b', 'ג': 'g', 'ד': 'd', 'ה': 'h',
  'ו': 'v', 'ז': 'z', 'ח': 'ch', 'ט': 't', 'י': 'y',
  'כ': 'k', 'ך': 'k', 'ל': 'l', 'מ': 'm', 'ם': 'm',
  'נ': 'n', 'ן': 'n', 'ס': 's', 'ע': 'a', 'פ': 'p',
  'ף': 'p', 'צ': 'tz', 'ץ': 'tz', 'ק': 'k', 'ר': 'r',
  'ש': 'sh', 'ת': 't',
}

/**
 * Generate a URL-safe slug from a name (supports Hebrew and English)
 * @param name The name to convert (e.g., "רמאל" or "Ramel")
 * @returns URL-safe slug (e.g., "ramal" or "ramel")
 */
export function generateSlugFromName(name: string): string {
  if (!name || typeof name !== 'string') return ''
  
  let result = name.toLowerCase().trim()
  
  // Transliterate Hebrew characters
  result = result
    .split('')
    .map(char => hebrewToLatinMap[char] || char)
    .join('')
  
  // Remove any remaining non-alphanumeric characters except spaces and hyphens
  result = result.replace(/[^a-z0-9\s-]/g, '')
  
  // Replace spaces with hyphens
  result = result.replace(/\s+/g, '-')
  
  // Remove consecutive hyphens
  result = result.replace(/-+/g, '-')
  
  // Remove leading/trailing hyphens
  result = result.replace(/^-+|-+$/g, '')
  
  return result
}

/**
 * Check if a string is a valid UUID v4
 * @param str The string to check
 * @returns true if it's a valid UUID
 */
export function isValidUUID(str: string): boolean {
  if (!str || typeof str !== 'string') return false
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(str)
}

/**
 * Check if a string is a valid barber slug
 * Valid slugs: lowercase letters, numbers, and hyphens, 2-50 chars
 * @param str The string to check
 * @returns true if it's a valid slug format
 */
export function isValidSlug(str: string): boolean {
  if (!str || typeof str !== 'string') return false
  const slugRegex = /^[a-z0-9][a-z0-9-]{0,48}[a-z0-9]$|^[a-z0-9]{1,2}$/
  return slugRegex.test(str) && !str.includes('--')
}

/**
 * Normalize a slug for consistent comparison
 * @param slug The slug to normalize
 * @returns Lowercase, trimmed slug
 */
export function normalizeSlug(slug: string): string {
  if (!slug || typeof slug !== 'string') return ''
  return slug.toLowerCase().trim()
}

/**
 * Generate a unique slug by appending a number if needed
 * @param baseSlug The base slug
 * @param existingSlugs Array of existing slugs to check against
 * @returns A unique slug
 */
export function makeUniqueSlug(baseSlug: string, existingSlugs: string[]): string {
  const slug = normalizeSlug(baseSlug)
  if (!existingSlugs.includes(slug)) return slug
  
  let counter = 2
  while (existingSlugs.includes(`${slug}-${counter}`)) {
    counter++
  }
  return `${slug}-${counter}`
}

/**
 * Build a barber profile URL using slug
 * @param slug The barber's URL slug (username)
 * @returns Full path to barber profile
 */
export function buildBarberProfileUrl(slug: string): string {
  return `/barber/${encodeURIComponent(normalizeSlug(slug))}`
}

/**
 * Build a barber booking URL with optional service pre-selection
 * @param slug The barber's URL slug
 * @param serviceId Optional service ID to pre-select
 * @returns Full path to booking page
 */
export function buildBarberBookingUrl(slug: string, serviceId?: string): string {
  const base = `/barber/${encodeURIComponent(normalizeSlug(slug))}/book`
  if (serviceId) {
    return `${base}?service=${encodeURIComponent(serviceId)}`
  }
  return base
}

/**
 * Build a shareable barber link with optional deep-link to homepage
 * @param slug The barber's URL slug
 * @param baseUrl The base URL of the site (e.g., "https://ramelbarbershop.com")
 * @returns Full shareable URL
 */
export function buildShareableBarberLink(slug: string, baseUrl: string): string {
  const normalizedSlug = normalizeSlug(slug)
  // Remove trailing slash from baseUrl if present
  const cleanBaseUrl = baseUrl.replace(/\/$/, '')
  return `${cleanBaseUrl}/barber/${encodeURIComponent(normalizedSlug)}`
}
