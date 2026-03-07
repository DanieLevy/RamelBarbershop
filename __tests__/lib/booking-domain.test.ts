import { describe, expect, it } from 'vitest'

import {
  doesBreakoutApplyToDate,
  doesRecurringApplyToDate,
  getCanonicalReservationDayFields,
  isBlockingReservationStatus,
} from '@/lib/utils'
import { israelDateToTimestamp } from '@/lib/utils/timezone'

describe('booking-domain helpers', () => {
  it('treats only confirmed reservations as blocking', () => {
    expect(isBlockingReservationStatus('confirmed')).toBe(true)
    expect(isBlockingReservationStatus('cancelled')).toBe(false)
    expect(isBlockingReservationStatus('completed')).toBe(false)
    expect(isBlockingReservationStatus(null)).toBe(false)
  })

  it('derives canonical reservation day fields from Israel time', () => {
    const timestamp = israelDateToTimestamp(2026, 3, 9, 9, 0)
    expect(getCanonicalReservationDayFields(timestamp)).toEqual({
      dateStr: '2026-03-09',
      dayKey: 'monday',
      dayName: 'ב׳',
      dayNum: '9',
    })
  })

  it('matches biweekly recurring only on active alternating weeks', () => {
    const recurring = {
      day_of_week: 'monday' as const,
      frequency: 'biweekly',
      start_date: '2026-03-09',
    }

    expect(doesRecurringApplyToDate(recurring, '2026-03-09', 'monday')).toBe(true)
    expect(doesRecurringApplyToDate(recurring, '2026-03-16', 'monday')).toBe(false)
    expect(doesRecurringApplyToDate(recurring, '2026-03-23', 'monday')).toBe(true)
  })

  it('matches breakout applicability consistently across breakout types', () => {
    expect(
      doesBreakoutApplyToDate(
        { breakout_type: 'single', start_date: '2026-03-09', start_time: '09:00' },
        '2026-03-09',
        'monday'
      )
    ).toBe(true)

    expect(
      doesBreakoutApplyToDate(
        {
          breakout_type: 'date_range',
          start_date: '2026-03-09',
          end_date: '2026-03-11',
          start_time: '09:00',
        },
        '2026-03-10',
        'tuesday'
      )
    ).toBe(true)

    expect(
      doesBreakoutApplyToDate(
        { breakout_type: 'recurring', day_of_week: 'monday', start_time: '09:00' },
        '2026-03-09',
        'monday'
      )
    ).toBe(true)
  })
})
