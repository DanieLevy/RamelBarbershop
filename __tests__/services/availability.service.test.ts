/**
 * Tests for Availability Service
 * 
 * Tests the date availability checking logic including shop closures,
 * barber work days, and work day validation.
 * All tests are READ-ONLY - no database writes.
 */

import { describe, it, expect } from 'vitest'
import { isDateAvailable, getWorkHours, workDaysToMap, type DayWorkHours } from '@/lib/services/availability.service'
import type { BarbershopSettings, BarbershopClosure, BarberClosure } from '@/types/database'
import { getIsraelDateString, getDayKeyInIsrael, israelDateToTimestamp } from '@/lib/utils'

// ============================================================
// Mock Data Factories
// ============================================================

const createShopSettings = (overrides: Partial<BarbershopSettings> = {}): BarbershopSettings => ({
  id: 'shop-settings-id',
  name: 'Test Shop',
  phone: '0501234567',
  address: 'Test Address',
  description: 'Test Description',
  work_hours_start: '09:00',
  work_hours_end: '19:00',
  open_days: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  hero_title: 'Test',
  hero_subtitle: 'Test',
  hero_description: 'Test',
  address_text: 'Test',
  address_lat: 31.7857,
  address_lng: 35.2271,
  waze_link: 'https://waze.com',
  google_maps_link: 'https://maps.google.com',
  contact_phone: '0501234567',
  contact_email: 'test@test.com',
  contact_whatsapp: '972501234567',
  social_instagram: 'https://instagram.com',
  social_facebook: 'https://facebook.com',
  social_tiktok: '',
  show_phone: true,
  show_email: true,
  show_whatsapp: true,
  show_instagram: true,
  show_facebook: true,
  show_tiktok: false,
  default_reminder_hours: 3,
  max_booking_days_ahead: 21,
  ...overrides,
})

const createBarberWorkDays = (): DayWorkHours => ({
  sunday: { isWorking: true, startTime: '10:00', endTime: '18:00' },
  monday: { isWorking: true, startTime: '10:00', endTime: '18:00' },
  tuesday: { isWorking: true, startTime: '10:00', endTime: '18:00' },
  wednesday: { isWorking: true, startTime: '10:00', endTime: '18:00' },
  thursday: { isWorking: true, startTime: '10:00', endTime: '18:00' },
  friday: { isWorking: false, startTime: null, endTime: null },
  saturday: { isWorking: false, startTime: null, endTime: null },
})

// Helper to get a date for a specific day of week (Israel-timezone aware)
const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const
const getDateForDayOfWeek = (dayIndex: number): number => {
  const targetDay = dayNames[dayIndex]
  const now = new Date()
  // Search forward up to 7 days for the target day in Israel timezone
  for (let offset = 1; offset <= 7; offset++) {
    const candidate = new Date(now.getTime() + offset * 86400000)
    const ts = candidate.getTime()
    if (getDayKeyInIsrael(ts) === targetDay) {
      // Return a timestamp at 10:00 Israel time for this date
      const dateStr = getIsraelDateString(ts)
      const [year, month, day] = dateStr.split('-').map(Number)
      return israelDateToTimestamp(year, month, day, 10, 0)
    }
  }
  return now.getTime()
}

// Helper to get a timestamp for a future weekday (guaranteed to be in open_days Sun-Fri)
const getFutureWeekdayTimestamp = (): { timestamp: number; dateStr: string } => {
  const now = new Date()
  for (let offset = 1; offset <= 7; offset++) {
    const candidate = new Date(now.getTime() + offset * 86400000)
    const ts = candidate.getTime()
    const day = getDayKeyInIsrael(ts)
    if (day !== 'saturday') {
      const dateStr = getIsraelDateString(ts)
      const [year, month, dayNum] = dateStr.split('-').map(Number)
      return {
        timestamp: israelDateToTimestamp(year, month, dayNum, 10, 0),
        dateStr,
      }
    }
  }
  return { timestamp: now.getTime(), dateStr: getIsraelDateString(now.getTime()) }
}

describe('Availability Service', () => {
  describe('isDateAvailable', () => {
    describe('Shop Open Days', () => {
      it('should return unavailable when shop is closed on specific day', () => {
        const shopSettings = createShopSettings({
          open_days: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
        })
        
        // Get a Saturday (day 6)
        const saturdayTimestamp = getDateForDayOfWeek(6)
        
        const result = isDateAvailable(
          saturdayTimestamp,
          shopSettings,
          [],
          []
        )
        
        expect(result.available).toBe(false)
        expect(result.reason).toContain('סגורה')
      })

      it('should return available when shop is open on that day', () => {
        const shopSettings = createShopSettings({
          open_days: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
        })
        const barberWorkDays = createBarberWorkDays()
        
        // Get a Sunday (day 0)
        const sundayTimestamp = getDateForDayOfWeek(0)
        
        const result = isDateAvailable(
          sundayTimestamp,
          shopSettings,
          [],
          [],
          barberWorkDays
        )
        
        expect(result.available).toBe(true)
      })
    })

    describe('Shop Closures', () => {
      it('should return unavailable during shop closure period', () => {
        // Use all 7 days open so the open_days check doesn't interfere
        const shopSettings = createShopSettings({
          open_days: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
        })
        const { timestamp, dateStr } = getFutureWeekdayTimestamp()
        
        // Create closure range that covers our test date
        const nextDay = new Date(timestamp + 86400000)
        const closureEnd = getIsraelDateString(nextDay.getTime())
        
        const shopClosures: BarbershopClosure[] = [{
          id: 'closure-1',
          start_date: dateStr,
          end_date: closureEnd,
          reason: 'Holiday',
          created_at: new Date().toISOString(),
        }]
        
        const result = isDateAvailable(
          timestamp,
          shopSettings,
          shopClosures,
          []
        )
        
        expect(result.available).toBe(false)
        expect(result.reason).toContain('Holiday')
      })

      it('should use default message when closure has no reason', () => {
        const shopSettings = createShopSettings({
          open_days: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
        })
        const { timestamp, dateStr } = getFutureWeekdayTimestamp()
        const nextDay = new Date(timestamp + 86400000)
        const closureEnd = getIsraelDateString(nextDay.getTime())
        
        const shopClosures: BarbershopClosure[] = [{
          id: 'closure-1',
          start_date: dateStr,
          end_date: closureEnd,
          reason: null,
          created_at: new Date().toISOString(),
        }]
        
        const result = isDateAvailable(
          timestamp,
          shopSettings,
          shopClosures,
          []
        )
        
        expect(result.available).toBe(false)
        expect(result.reason).toContain('סגורה')
      })
    })

    describe('Barber Work Days', () => {
      it('should return unavailable when barber does not work on that day', () => {
        const shopSettings = createShopSettings({
          open_days: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
        })
        
        const barberWorkDays = createBarberWorkDays() // Friday is not working
        
        // Get a Friday (day 5) - shop open but barber not working
        const fridayTimestamp = getDateForDayOfWeek(5)
        
        const result = isDateAvailable(
          fridayTimestamp,
          shopSettings,
          [],
          [],
          barberWorkDays
        )
        
        expect(result.available).toBe(false)
        expect(result.reason).toContain('הספר לא עובד')
      })

      it('should return available when barber works on that day', () => {
        const shopSettings = createShopSettings()
        const barberWorkDays = createBarberWorkDays()
        
        // Get a Sunday (day 0)
        const sundayTimestamp = getDateForDayOfWeek(0)
        
        const result = isDateAvailable(
          sundayTimestamp,
          shopSettings,
          [],
          [],
          barberWorkDays
        )
        
        expect(result.available).toBe(true)
      })
    })

    describe('Barber Closures', () => {
      it('should return unavailable during barber closure period', () => {
        // Use all 7 days open so the open_days check doesn't interfere
        const shopSettings = createShopSettings({
          open_days: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
        })
        // Use barber work days where all 7 days are working
        const barberWorkDays: DayWorkHours = {
          sunday: { isWorking: true, startTime: '10:00', endTime: '18:00' },
          monday: { isWorking: true, startTime: '10:00', endTime: '18:00' },
          tuesday: { isWorking: true, startTime: '10:00', endTime: '18:00' },
          wednesday: { isWorking: true, startTime: '10:00', endTime: '18:00' },
          thursday: { isWorking: true, startTime: '10:00', endTime: '18:00' },
          friday: { isWorking: true, startTime: '10:00', endTime: '18:00' },
          saturday: { isWorking: true, startTime: '10:00', endTime: '18:00' },
        }
        const { timestamp, dateStr } = getFutureWeekdayTimestamp()
        const nextWeek = new Date(timestamp + 7 * 86400000)
        const closureEnd = getIsraelDateString(nextWeek.getTime())
        
        const barberClosures: BarberClosure[] = [{
          id: 'barber-closure-1',
          barber_id: 'barber-id',
          start_date: dateStr,
          end_date: closureEnd,
          reason: 'בחופשה',
          created_at: new Date().toISOString(),
        }]
        
        const result = isDateAvailable(
          timestamp,
          shopSettings,
          [],
          barberClosures,
          barberWorkDays
        )
        
        expect(result.available).toBe(false)
        expect(result.reason).toContain('בחופשה')
      })

      it('should use default message when barber closure has no reason', () => {
        const shopSettings = createShopSettings({
          open_days: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
        })
        const barberWorkDays: DayWorkHours = {
          sunday: { isWorking: true, startTime: '10:00', endTime: '18:00' },
          monday: { isWorking: true, startTime: '10:00', endTime: '18:00' },
          tuesday: { isWorking: true, startTime: '10:00', endTime: '18:00' },
          wednesday: { isWorking: true, startTime: '10:00', endTime: '18:00' },
          thursday: { isWorking: true, startTime: '10:00', endTime: '18:00' },
          friday: { isWorking: true, startTime: '10:00', endTime: '18:00' },
          saturday: { isWorking: true, startTime: '10:00', endTime: '18:00' },
        }
        const { timestamp, dateStr } = getFutureWeekdayTimestamp()
        const nextDay = new Date(timestamp + 86400000)
        const closureEnd = getIsraelDateString(nextDay.getTime())
        
        const barberClosures: BarberClosure[] = [{
          id: 'barber-closure-1',
          barber_id: 'barber-id',
          start_date: dateStr,
          end_date: closureEnd,
          reason: null,
          created_at: new Date().toISOString(),
        }]
        
        const result = isDateAvailable(
          timestamp,
          shopSettings,
          [],
          barberClosures,
          barberWorkDays
        )
        
        expect(result.available).toBe(false)
        expect(result.reason).toContain('הספר לא זמין')
      })
    })

    describe('Combined Scenarios', () => {
      it('should check shop closure before barber closure', () => {
        // Use all 7 days open so the open_days check doesn't interfere
        const shopSettings = createShopSettings({
          open_days: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
        })
        const barberWorkDays: DayWorkHours = {
          sunday: { isWorking: true, startTime: '10:00', endTime: '18:00' },
          monday: { isWorking: true, startTime: '10:00', endTime: '18:00' },
          tuesday: { isWorking: true, startTime: '10:00', endTime: '18:00' },
          wednesday: { isWorking: true, startTime: '10:00', endTime: '18:00' },
          thursday: { isWorking: true, startTime: '10:00', endTime: '18:00' },
          friday: { isWorking: true, startTime: '10:00', endTime: '18:00' },
          saturday: { isWorking: true, startTime: '10:00', endTime: '18:00' },
        }
        const { timestamp, dateStr } = getFutureWeekdayTimestamp()
        const nextDay = new Date(timestamp + 86400000)
        const closureEnd = getIsraelDateString(nextDay.getTime())
        
        const shopClosures: BarbershopClosure[] = [{
          id: 'shop-closure-1',
          start_date: dateStr,
          end_date: closureEnd,
          reason: 'Shop Holiday',
          created_at: new Date().toISOString(),
        }]
        
        const barberClosures: BarberClosure[] = [{
          id: 'barber-closure-1',
          barber_id: 'barber-id',
          start_date: dateStr,
          end_date: closureEnd,
          reason: 'Barber Vacation',
          created_at: new Date().toISOString(),
        }]
        
        const result = isDateAvailable(
          timestamp,
          shopSettings,
          shopClosures,
          barberClosures,
          barberWorkDays
        )
        
        expect(result.available).toBe(false)
        // Shop closure takes priority
        expect(result.reason).toContain('Shop Holiday')
      })

      it('should handle null shop settings gracefully', () => {
        const sundayTimestamp = getDateForDayOfWeek(0)
        
        const result = isDateAvailable(
          sundayTimestamp,
          null,
          [],
          []
        )
        
        // When shop settings are null, should still work
        expect(result.available).toBe(true)
      })
    })
  })

  describe('getWorkHours', () => {
    it('should return barber work day hours when available', () => {
      const shopSettings = createShopSettings({
        work_hours_start: '09:00',
        work_hours_end: '19:00',
      })
      
      const barberWorkDays = createBarberWorkDays()
      
      const result = getWorkHours(shopSettings, 'sunday', barberWorkDays)
      
      expect(result.start).toBe('10:00')
      expect(result.end).toBe('18:00')
    })

    it('should fall back to shop settings when no barber work days', () => {
      const shopSettings = createShopSettings({
        work_hours_start: '09:00',
        work_hours_end: '19:00',
      })
      
      const result = getWorkHours(shopSettings)
      
      expect(result.start).toBe('09:00')
      expect(result.end).toBe('19:00')
    })

    it('should return default hours when no settings available', () => {
      const result = getWorkHours(null)
      
      expect(result.start).toBe('09:00')
      expect(result.end).toBe('19:00')
    })
  })

  describe('workDaysToMap', () => {
    it('should convert WorkDay array to DayWorkHours map', () => {
      const workDays = [
        { id: '1', user_id: 'user-1', day_of_week: 'sunday', is_working: true, start_time: '10:00', end_time: '18:00', created_at: '', updated_at: '' },
        { id: '2', user_id: 'user-1', day_of_week: 'monday', is_working: true, start_time: '10:00', end_time: '18:00', created_at: '', updated_at: '' },
        { id: '3', user_id: 'user-1', day_of_week: 'friday', is_working: false, start_time: null, end_time: null, created_at: '', updated_at: '' },
      ]
      
      const result = workDaysToMap(workDays as any)
      
      expect(result.sunday.isWorking).toBe(true)
      expect(result.sunday.startTime).toBe('10:00')
      expect(result.monday.isWorking).toBe(true)
      expect(result.friday.isWorking).toBe(false)
    })
  })
})
