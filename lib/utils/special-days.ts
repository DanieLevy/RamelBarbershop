import type { DayOfWeek } from '@/types/database'

export interface SpecialDayLike {
  date: string
  start_time: string
  end_time: string
  reason?: string | null
}

export interface WorkDayLike {
  isWorking?: boolean | null
  startTime?: string | null
  endTime?: string | null
}

export type WorkDaysMapLike = Record<string, WorkDayLike | undefined>

export interface EffectiveWorkHours {
  isWorking: boolean
  startTime: string | null
  endTime: string | null
  source: 'special_day' | 'work_day' | 'none'
}

export const findSpecialDayByDate = <T extends { date: string }>(
  specialDays: readonly T[] | undefined,
  dateStr: string
): T | null => {
  return specialDays?.find((specialDay) => specialDay.date === dateStr) ?? null
}

export const isShopOpenOnDate = ({
  dateStr,
  dayKey,
  shopOpenDays,
  shopSpecialDays = [],
  barberSpecialDays = [],
}: {
  dateStr: string
  dayKey: DayOfWeek
  shopOpenDays: readonly string[]
  shopSpecialDays?: readonly SpecialDayLike[]
  barberSpecialDays?: readonly SpecialDayLike[]
}): boolean => {
  if (
    findSpecialDayByDate(shopSpecialDays, dateStr) ||
    findSpecialDayByDate(barberSpecialDays, dateStr)
  ) {
    return true
  }

  return shopOpenDays.length === 0 || shopOpenDays.includes(dayKey)
}

export const resolveBarberWorkHoursForDate = ({
  dateStr,
  dayKey,
  workDaysMap,
  barberSpecialDays = [],
}: {
  dateStr: string
  dayKey: DayOfWeek
  workDaysMap: WorkDaysMapLike
  barberSpecialDays?: readonly SpecialDayLike[]
}): EffectiveWorkHours => {
  const specialDay = findSpecialDayByDate(barberSpecialDays, dateStr)
  if (specialDay) {
    return {
      isWorking: true,
      startTime: specialDay.start_time,
      endTime: specialDay.end_time,
      source: 'special_day',
    }
  }

  const workDay = workDaysMap[dayKey]
  if (!workDay?.isWorking) {
    return {
      isWorking: false,
      startTime: null,
      endTime: null,
      source: 'none',
    }
  }

  return {
    isWorking: true,
    startTime: workDay.startTime ?? null,
    endTime: workDay.endTime ?? null,
    source: 'work_day',
  }
}
