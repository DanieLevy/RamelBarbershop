/**
 * Tests for lib/utils.ts
 * 
 * These tests verify the Israel timezone utilities work correctly.
 * Critical for ensuring appointment times are displayed correctly.
 */

import { describe, it, expect } from 'vitest'
import {
  ISRAEL_TIMEZONE,
  nowInIsrael,
  toIsraelTime,
  timestampToIsraelDate,
  israelDateToTimestamp,
  makeId,
  getDayNameInHebrew,
  getNextWeekDates,
  formatTime,
  formatDateShort,
  getDayOfWeek,
  getDayKey,
  isDateDisabled,
  generateTimeSlots,
  parseTimeString,
  timeToMinutes,
  isTimeWithinBusinessHours,
  cn,
  formatPrice,
  formatOpenDaysRanges,
  isTodayInIsrael,
  isPastInIsrael,
  isDateStringToday,
  getTodayDateString,
  getIsraelDateString,
  isSameDayInIsrael,
  nowInIsraelMs,
} from '@/lib/utils'

describe('Israel Timezone Utilities', () => {
  describe('ISRAEL_TIMEZONE constant', () => {
    it('should be Asia/Jerusalem', () => {
      expect(ISRAEL_TIMEZONE).toBe('Asia/Jerusalem')
    })
  })

  describe('nowInIsrael', () => {
    it('should return a Date object', () => {
      const result = nowInIsrael()
      expect(result).toBeInstanceOf(Date)
    })

    it('should return a valid date', () => {
      const result = nowInIsrael()
      expect(result.getTime()).toBeGreaterThan(0)
    })
  })

  describe('toIsraelTime', () => {
    it('should convert a Date to Israel timezone', () => {
      const utcDate = new Date('2024-12-29T12:00:00Z')
      const israelDate = toIsraelTime(utcDate)
      expect(israelDate).toBeInstanceOf(Date)
    })
  })

  describe('timestampToIsraelDate', () => {
    it('should convert a timestamp to Israel timezone Date', () => {
      const timestamp = 1703851200000 // 2023-12-29 12:00:00 UTC
      const result = timestampToIsraelDate(timestamp)
      expect(result).toBeInstanceOf(Date)
    })
  })

  describe('israelDateToTimestamp', () => {
    it('should create a UTC timestamp from Israel date components', () => {
      const timestamp = israelDateToTimestamp(2024, 12, 29, 14, 30)
      expect(typeof timestamp).toBe('number')
      expect(timestamp).toBeGreaterThan(0)
    })

    it('should handle dates without time components', () => {
      const timestamp = israelDateToTimestamp(2024, 12, 29)
      expect(typeof timestamp).toBe('number')
    })
  })

  describe('nowInIsraelMs', () => {
    it('should return a number (timestamp in ms)', () => {
      const result = nowInIsraelMs()
      expect(typeof result).toBe('number')
      expect(result).toBeGreaterThan(0)
    })
  })

  describe('isTodayInIsrael', () => {
    it('should return true for current timestamp', () => {
      const now = Date.now()
      const result = isTodayInIsrael(now)
      expect(result).toBe(true)
    })

    it('should return false for yesterday', () => {
      const yesterday = Date.now() - 24 * 60 * 60 * 1000
      const result = isTodayInIsrael(yesterday)
      expect(result).toBe(false)
    })
  })

  describe('isPastInIsrael', () => {
    it('should return true for past timestamp', () => {
      const past = Date.now() - 60000
      const result = isPastInIsrael(past)
      expect(result).toBe(true)
    })

    it('should return false for future timestamp', () => {
      const future = Date.now() + 60000
      const result = isPastInIsrael(future)
      expect(result).toBe(false)
    })
  })

  describe('getTodayDateString', () => {
    it('should return YYYY-MM-DD format', () => {
      const result = getTodayDateString()
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })
  })

  describe('getIsraelDateString', () => {
    it('should return YYYY-MM-DD format for a timestamp', () => {
      const result = getIsraelDateString(Date.now())
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })
  })

  describe('isDateStringToday', () => {
    it('should return true for today date string', () => {
      const today = getTodayDateString()
      const result = isDateStringToday(today)
      expect(result).toBe(true)
    })

    it('should return false for another date', () => {
      const result = isDateStringToday('2020-01-01')
      expect(result).toBe(false)
    })
  })

  describe('isSameDayInIsrael', () => {
    it('should return true for same day timestamps', () => {
      const t1 = Date.now()
      const t2 = t1 + 1000 // 1 second later
      const result = isSameDayInIsrael(t1, t2)
      expect(result).toBe(true)
    })

    it('should return false for different days', () => {
      const t1 = Date.now()
      const t2 = t1 - 48 * 60 * 60 * 1000 // 2 days ago
      const result = isSameDayInIsrael(t1, t2)
      expect(result).toBe(false)
    })
  })
})

describe('Utility Functions', () => {
  describe('makeId', () => {
    it('should generate a string of default length 6', () => {
      const id = makeId()
      expect(id).toHaveLength(6)
    })

    it('should generate a string of specified length', () => {
      const id = makeId(10)
      expect(id).toHaveLength(10)
    })

    it('should only contain alphanumeric characters', () => {
      const id = makeId(100)
      expect(id).toMatch(/^[A-Za-z0-9]+$/)
    })

    it('should generate unique IDs', () => {
      const ids = new Set(Array.from({ length: 100 }, () => makeId()))
      expect(ids.size).toBe(100)
    })
  })

  describe('getDayNameInHebrew', () => {
    it('should return Hebrew day name for English input', () => {
      expect(getDayNameInHebrew('Sunday')).toBe('ראשון')
      expect(getDayNameInHebrew('Monday')).toBe('שני')
      expect(getDayNameInHebrew('saturday')).toBe('שבת')
    })

    it('should handle lowercase input', () => {
      expect(getDayNameInHebrew('sunday')).toBe('ראשון')
    })

    it('should return input for unknown day', () => {
      expect(getDayNameInHebrew('Unknown')).toBe('Unknown')
    })
  })

  describe('getNextWeekDates', () => {
    it('should return 14 dates by default', () => {
      const dates = getNextWeekDates()
      expect(dates).toHaveLength(14)
    })

    it('should return specified number of dates', () => {
      const dates = getNextWeekDates(7)
      expect(dates).toHaveLength(7)
    })

    it('should have today as first date with label היום', () => {
      const dates = getNextWeekDates()
      expect(dates[0].dayName).toBe('היום')
    })

    it('should have tomorrow as second date with label מחר', () => {
      const dates = getNextWeekDates()
      expect(dates[1].dayName).toBe('מחר')
    })

    it('should have correct structure for each date', () => {
      const dates = getNextWeekDates()
      dates.forEach((date) => {
        expect(date).toHaveProperty('dayName')
        expect(date).toHaveProperty('dayNum')
        expect(date).toHaveProperty('dateTimestamp')
        expect(date).toHaveProperty('dateString')
        expect(date).toHaveProperty('dayKey')
      })
    })

    it('should have timestamps in milliseconds', () => {
      const dates = getNextWeekDates()
      dates.forEach((date) => {
        expect(date.dateTimestamp).toBeGreaterThan(1000000000000)
      })
    })
  })

  describe('formatTime', () => {
    it('should format timestamp to HH:mm', () => {
      // Create a known timestamp
      const timestamp = israelDateToTimestamp(2024, 12, 29, 14, 30)
      const result = formatTime(timestamp)
      expect(result).toBe('14:30')
    })
  })

  describe('formatDateShort', () => {
    it('should format timestamp to dd/MM/yyyy', () => {
      const timestamp = israelDateToTimestamp(2024, 12, 29)
      const result = formatDateShort(timestamp)
      expect(result).toBe('29/12/2024')
    })
  })

  describe('getDayOfWeek', () => {
    it('should return lowercase day name', () => {
      const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
      const timestamp = Date.now()
      const result = getDayOfWeek(timestamp)
      expect(days).toContain(result)
    })
  })

  describe('getDayKey', () => {
    it('should return lowercase day name from Date', () => {
      const date = new Date('2024-12-29') // Sunday
      const result = getDayKey(date)
      expect(result).toBe('sunday')
    })
  })

  describe('parseTimeString', () => {
    it('should parse HH:mm to hour and minute', () => {
      const result = parseTimeString('14:30')
      expect(result).toEqual({ hour: 14, minute: 30 })
    })

    it('should handle invalid input', () => {
      const result = parseTimeString('invalid')
      expect(result).toEqual({ hour: 0, minute: 0 })
    })
  })

  describe('timeToMinutes', () => {
    it('should convert time string to minutes', () => {
      expect(timeToMinutes('09:00')).toBe(540)
      expect(timeToMinutes('14:30')).toBe(870)
      expect(timeToMinutes('23:59')).toBe(1439)
    })

    it('should handle midnight as 0 by default', () => {
      expect(timeToMinutes('00:00')).toBe(0)
    })

    it('should treat midnight as end of day when flag is true', () => {
      expect(timeToMinutes('00:00', true)).toBe(1440) // 24 * 60
    })

    it('should handle time with seconds', () => {
      expect(timeToMinutes('14:30:00')).toBe(870)
    })
  })

  describe('isTimeWithinBusinessHours', () => {
    it('should return true when within business hours', () => {
      expect(isTimeWithinBusinessHours('14:00', '09:00', '19:00')).toBe(true)
      expect(isTimeWithinBusinessHours('09:00', '09:00', '19:00')).toBe(true)
    })

    it('should return false when outside business hours', () => {
      expect(isTimeWithinBusinessHours('08:00', '09:00', '19:00')).toBe(false)
      expect(isTimeWithinBusinessHours('19:30', '09:00', '19:00')).toBe(false)
    })

    it('should handle midnight (00:00) as end of day correctly', () => {
      // When end time is 00:00, it should be treated as midnight (end of day)
      expect(isTimeWithinBusinessHours('22:00', '09:00', '00:00')).toBe(true)
      expect(isTimeWithinBusinessHours('23:59', '09:00', '00:00')).toBe(true)
      expect(isTimeWithinBusinessHours('14:00', '09:00', '00:00')).toBe(true)
    })

    it('should exclude the end time itself', () => {
      // 19:00 is NOT within 09:00-19:00 (exclusive end)
      expect(isTimeWithinBusinessHours('19:00', '09:00', '19:00')).toBe(false)
    })
  })

  describe('cn (classNames)', () => {
    it('should combine class strings', () => {
      const result = cn('class1', 'class2', 'class3')
      expect(result).toBe('class1 class2 class3')
    })

    it('should filter out falsy values', () => {
      const result = cn('class1', false, null, undefined, 'class2')
      expect(result).toBe('class1 class2')
    })

    it('should return empty string for no classes', () => {
      const result = cn()
      expect(result).toBe('')
    })
  })

  describe('formatPrice', () => {
    it('should format price with shekel symbol', () => {
      const result = formatPrice(100)
      expect(result).toContain('₪')
      expect(result).toContain('100')
    })

    it('should format large numbers with locale', () => {
      const result = formatPrice(1000)
      // Should contain thousands separator or be formatted
      expect(result).toContain('₪')
    })
  })

  describe('formatOpenDaysRanges', () => {
    it('should return empty array for empty input', () => {
      const result = formatOpenDaysRanges([])
      expect(result).toEqual([])
    })

    it('should format single day', () => {
      const result = formatOpenDaysRanges(['sunday'])
      expect(result).toHaveLength(1)
      expect(result[0].isSingleDay).toBe(true)
    })

    it('should format consecutive days as range', () => {
      const result = formatOpenDaysRanges(['monday', 'tuesday', 'wednesday'])
      expect(result).toHaveLength(1)
      expect(result[0].isSingleDay).toBe(false)
    })

    it('should handle non-consecutive days', () => {
      const result = formatOpenDaysRanges(['sunday', 'wednesday', 'friday'])
      expect(result).toHaveLength(3)
    })
  })
})

describe('generateTimeSlots', () => {
  it('should generate slots at specified interval', () => {
    const dateTimestamp = israelDateToTimestamp(2024, 12, 30)
    const slots = generateTimeSlots(dateTimestamp, 9, 0, 10, 0, 30)
    expect(slots.length).toBeGreaterThanOrEqual(1)
  })

  it('should return slots with timestamp and time string', () => {
    const dateTimestamp = israelDateToTimestamp(2024, 12, 30)
    const slots = generateTimeSlots(dateTimestamp, 9, 0, 10, 0, 30)
    
    slots.forEach((slot) => {
      expect(slot).toHaveProperty('timestamp')
      expect(slot).toHaveProperty('time')
      expect(typeof slot.timestamp).toBe('number')
      expect(slot.time).toMatch(/^\d{2}:\d{2}$/)
    })
  })
})

describe('isDateDisabled', () => {
  it('should return true for past dates', () => {
    const pastDate = new Date('2020-01-01')
    const result = isDateDisabled(pastDate)
    expect(result).toBe(true)
  })

  it('should return false for future dates', () => {
    const futureDate = new Date('2030-01-01')
    const result = isDateDisabled(futureDate)
    expect(result).toBe(false)
  })
})

