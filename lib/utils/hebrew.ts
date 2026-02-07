/**
 * Hebrew Formatting Utilities
 *
 * Hebrew number formatting with proper grammar,
 * day name translations, and opening hours display formatting.
 */

// ============================================================
// HEBREW DAY NAME TRANSLATION
// ============================================================

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

// ============================================================
// HEBREW NUMBER FORMATTING
// Proper Hebrew grammar for numbers with time units
// ============================================================

/**
 * Format minutes with proper Hebrew grammar
 * 1 → דקה / דקה אחת
 * 2 → שתי דקות
 * 3-10 → X דקות
 * 11+ → X דקות
 */
export function formatHebrewMinutes(minutes: number, includeNumber = true): string {
  if (minutes === 1) return includeNumber ? 'דקה אחת' : 'דקה'
  if (minutes === 2) return 'שתי דקות'
  return `${minutes} דקות`
}

/**
 * Format hours with proper Hebrew grammar
 * 1 → שעה / שעה אחת
 * 2 → שעתיים
 * 3-10 → X שעות
 * 11 → אחת עשרה שעות
 * 12 → שתים עשרה שעות
 * 13+ → X שעות
 */
export function formatHebrewHours(hours: number, includeNumber = true): string {
  if (hours === 1) return includeNumber ? 'שעה אחת' : 'שעה'
  if (hours === 2) return 'שעתיים'
  if (hours === 11) return 'אחת עשרה שעות'
  if (hours === 12) return 'שתים עשרה שעות'
  return `${hours} שעות`
}

/**
 * Format days with proper Hebrew grammar
 * 1 → יום / יום אחד
 * 2 → יומיים
 * 3-10 → X ימים
 */
export function formatHebrewDays(days: number, includeNumber = true): string {
  if (days === 1) return includeNumber ? 'יום אחד' : 'יום'
  if (days === 2) return 'יומיים'
  return `${days} ימים`
}

/**
 * Format a duration intelligently (auto-selects best unit)
 * @param minutes Total minutes
 * @param style 'full' = "בעוד שעתיים", 'ago' = "לפני שעתיים", 'bare' = "שעתיים"
 */
export function formatHebrewDuration(minutes: number, style: 'full' | 'ago' | 'bare' = 'bare'): string {
  let result: string
  
  if (minutes < 1) {
    result = 'פחות מדקה'
  } else if (minutes < 60) {
    // Use minutes
    result = formatHebrewMinutes(Math.round(minutes))
  } else if (minutes < 60 * 24) {
    // Use hours
    const hours = Math.round(minutes / 60)
    result = formatHebrewHours(hours)
  } else {
    // Use days
    const days = Math.round(minutes / (60 * 24))
    result = formatHebrewDays(days)
  }
  
  if (style === 'full') return `בעוד ${result}`
  if (style === 'ago') return `לפני ${result}`
  return result
}

/**
 * Format relative time (like "2 hours ago" or "in 3 minutes")
 * @param diffMinutes Difference in minutes (positive = past, negative = future)
 */
export function formatHebrewRelativeTime(diffMinutes: number): string {
  const absDiff = Math.abs(diffMinutes)
  const isPast = diffMinutes > 0
  
  if (absDiff < 1) return 'עכשיו'
  
  const formatted = formatHebrewDuration(absDiff)
  return isPast ? `לפני ${formatted}` : `בעוד ${formatted}`
}

// ============================================================
// HEBREW DAY RANGES AND OPENING HOURS
// ============================================================

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
  
  // Separate Friday and Saturday from regular days
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
