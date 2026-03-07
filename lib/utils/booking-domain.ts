import type { DayOfWeek } from '@/types/database'
import { getDayKeyInIsrael, getIsraelDateString, getTodayDateString, timestampToIsraelDate } from './timezone'

export const BLOCKING_RESERVATION_STATUS = 'confirmed' as const

const DAY_KEYS: DayOfWeek[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
]

const HEBREW_DAYS_SHORT: Record<DayOfWeek, string> = {
  sunday: 'א׳',
  monday: 'ב׳',
  tuesday: 'ג׳',
  wednesday: 'ד׳',
  thursday: 'ה׳',
  friday: 'ו׳',
  saturday: 'ש׳',
}

export interface RecurringRuleLike {
  day_of_week?: DayOfWeek | null
  frequency?: string | null
  start_date?: string | null
}

export interface BreakoutLike {
  breakout_type: 'single' | 'date_range' | 'recurring'
  start_date?: string | null
  end_date?: string | null
  day_of_week?: DayOfWeek | null
  start_time: string
  end_time?: string | null
}

const DAY_MS = 24 * 60 * 60 * 1000

const toUtcDateMs = (dateStr: string): number => {
  const [year, month, day] = dateStr.split('-').map(Number)
  return Date.UTC(year, month - 1, day)
}

export function isBlockingReservationStatus(status?: string | null): boolean {
  return status === BLOCKING_RESERVATION_STATUS
}

export function parseTimeToMinutes(time: string): number {
  const [hours = '0', minutes = '0'] = time.split(':')
  return Number(hours) * 60 + Number(minutes)
}

export function getCanonicalReservationDayFields(timestamp: number): {
  dateStr: string
  dayKey: DayOfWeek
  dayName: string
  dayNum: string
} {
  const israelDate = timestampToIsraelDate(timestamp)
  const dayKey = getDayKeyInIsrael(timestamp) as DayOfWeek

  return {
    dateStr: getIsraelDateString(timestamp),
    dayKey,
    dayName: HEBREW_DAYS_SHORT[dayKey],
    dayNum: String(israelDate.getDate()),
  }
}

export function getDayKeyFromDateString(dateStr: string): DayOfWeek {
  const utcDay = new Date(toUtcDateMs(dateStr)).getUTCDay()
  return DAY_KEYS[utcDay]
}

export function addDaysToDateString(dateStr: string, days: number): string {
  return new Date(toUtcDateMs(dateStr) + (days * DAY_MS)).toISOString().slice(0, 10)
}

export function enumerateDateStringsInRange(
  startDate: string,
  endDate: string,
  maxDays = 366
): string[] {
  const dates: string[] = []
  let current = startDate
  let count = 0

  while (current <= endDate && count < maxDays) {
    dates.push(current)
    current = addDaysToDateString(current, 1)
    count += 1
  }

  return dates
}

export function getUpcomingDateStringsForDay(
  dayOfWeek: DayOfWeek,
  weeks = 4,
  fromDate = getTodayDateString()
): string[] {
  const dates: string[] = []
  let current = fromDate

  while (dates.length < weeks) {
    if (getDayKeyFromDateString(current) === dayOfWeek) {
      dates.push(current)
    }
    current = addDaysToDateString(current, 1)
  }

  return dates
}

export function isBiweeklyRecurringActiveOnDate(startDate: string | null | undefined, dateStr: string): boolean {
  if (!startDate) return true

  const diffDays = Math.round((toUtcDateMs(dateStr) - toUtcDateMs(startDate)) / DAY_MS)
  return diffDays >= 0 && diffDays % 14 === 0
}

export function doesRecurringApplyToDate(
  recurring: RecurringRuleLike,
  dateStr: string,
  dayKey: DayOfWeek = getDayKeyFromDateString(dateStr)
): boolean {
  if (!recurring.day_of_week || recurring.day_of_week !== dayKey) {
    return false
  }

  if (recurring.frequency === 'biweekly') {
    return isBiweeklyRecurringActiveOnDate(recurring.start_date, dateStr)
  }

  return true
}

export function doesBreakoutApplyToDate(
  breakout: Pick<BreakoutLike, 'breakout_type' | 'start_date' | 'end_date' | 'day_of_week'>,
  dateStr: string,
  dayKey: DayOfWeek = getDayKeyFromDateString(dateStr)
): boolean {
  switch (breakout.breakout_type) {
    case 'single':
      return breakout.start_date === dateStr
    case 'date_range':
      return Boolean(
        breakout.start_date &&
          breakout.end_date &&
          dateStr >= breakout.start_date &&
          dateStr <= breakout.end_date
      )
    case 'recurring':
      return breakout.day_of_week === dayKey
    default:
      return false
  }
}
