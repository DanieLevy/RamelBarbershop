/**
 * Database Operation Tests for Reservations
 * 
 * Integration tests that verify database operations work correctly
 * using the real Supabase database. Tests include CRUD operations,
 * constraints, and queries.
 * 
 * NOTE: These tests use actual database calls and require proper setup.
 * They will be skipped if Supabase environment variables are not set.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  TEST_BARBERS,
  TEST_CUSTOMERS,
  TEST_SERVICES,
  getTomorrowAtHour,
  getDayStart,
  getHebrewDayName,
  getDayNum,
  generateTestId,
} from '../helpers/test-data'

// Check if Supabase env vars are available
const hasSupabaseEnv = !!(
  process.env.NEXT_PUBLIC_SUPABASE_URL && 
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// Conditionally import and create client
const getSupabase = async () => {
  if (!hasSupabaseEnv) return null
  const { createClient } = await import('@/lib/supabase/client')
  return createClient()
}

// Test reservation tracking for cleanup
const createdReservationIds: string[] = []

describe.skipIf(!hasSupabaseEnv)('Reservations Database Operations', () => {
  let supabase: Awaited<ReturnType<typeof getSupabase>>
  
  beforeAll(async () => {
    supabase = await getSupabase()
  })
  
  afterAll(async () => {
    // Cleanup: Delete all test reservations created during tests
    if (createdReservationIds.length > 0) {
      await supabase
        .from('reservations')
        .delete()
        .in('id', createdReservationIds)
    }
  })

  describe('Query Operations', () => {
    it('should query reservations by barber_id', async () => {
      const { data, error } = await supabase
        .from('reservations')
        .select('id, barber_id, customer_name, status')
        .eq('barber_id', TEST_BARBERS.admin.id)
        .limit(5)
      
      expect(error).toBeNull()
      expect(Array.isArray(data)).toBe(true)
      
      if (data && data.length > 0) {
        data.forEach(res => {
          expect(res.barber_id).toBe(TEST_BARBERS.admin.id)
        })
      }
    })

    it('should query reservations by customer_id', async () => {
      const { data, error } = await supabase
        .from('reservations')
        .select('id, customer_id, customer_name, status')
        .eq('customer_id', TEST_CUSTOMERS.daniel.id)
        .limit(5)
      
      expect(error).toBeNull()
      expect(Array.isArray(data)).toBe(true)
      
      if (data && data.length > 0) {
        data.forEach(res => {
          expect(res.customer_id).toBe(TEST_CUSTOMERS.daniel.id)
        })
      }
    })

    it('should filter reservations by status', async () => {
      const { data, error } = await supabase
        .from('reservations')
        .select('id, status')
        .eq('status', 'confirmed')
        .limit(5)
      
      expect(error).toBeNull()
      expect(Array.isArray(data)).toBe(true)
      
      if (data && data.length > 0) {
        data.forEach(res => {
          expect(res.status).toBe('confirmed')
        })
      }
    })

    it('should query future reservations by time_timestamp', async () => {
      const now = Date.now()
      
      const { data, error } = await supabase
        .from('reservations')
        .select('id, time_timestamp, status')
        .gt('time_timestamp', now)
        .eq('status', 'confirmed')
        .limit(5)
      
      expect(error).toBeNull()
      expect(Array.isArray(data)).toBe(true)
      
      if (data && data.length > 0) {
        data.forEach(res => {
          expect(Number(res.time_timestamp)).toBeGreaterThan(now)
        })
      }
    })

    it('should join with services table', async () => {
      const { data, error } = await supabase
        .from('reservations')
        .select(`
          id,
          customer_name,
          services (id, name_he, price, duration)
        `)
        .limit(3)
      
      expect(error).toBeNull()
      expect(Array.isArray(data)).toBe(true)
    })

    it('should join with users (barbers) table', async () => {
      const { data, error } = await supabase
        .from('reservations')
        .select(`
          id,
          customer_name,
          users (id, fullname, username)
        `)
        .limit(3)
      
      expect(error).toBeNull()
      expect(Array.isArray(data)).toBe(true)
    })
  })

  describe('Data Integrity', () => {
    it('should have valid status values (confirmed, cancelled, completed)', async () => {
      const { data, error } = await supabase
        .from('reservations')
        .select('status')
        .limit(50)
      
      expect(error).toBeNull()
      
      const validStatuses = ['confirmed', 'cancelled', 'completed']
      if (data) {
        data.forEach(res => {
          expect(validStatuses).toContain(res.status)
        })
      }
    })

    it('should have valid cancelled_by values when cancelled', async () => {
      const { data, error } = await supabase
        .from('reservations')
        .select('status, cancelled_by')
        .eq('status', 'cancelled')
        .limit(10)
      
      expect(error).toBeNull()
      
      const validCancelledBy = ['customer', 'barber', 'system', null]
      if (data) {
        data.forEach(res => {
          expect(validCancelledBy).toContain(res.cancelled_by)
        })
      }
    })

    it('should have version column for optimistic locking', async () => {
      const { data, error } = await supabase
        .from('reservations')
        .select('id, version')
        .limit(1)
      
      expect(error).toBeNull()
      
      if (data && data.length > 0) {
        expect(data[0].version).toBeDefined()
        expect(typeof data[0].version).toBe('number')
      }
    })
  })

  describe('Counts and Aggregations', () => {
    it('should count confirmed reservations for a customer', async () => {
      const { count, error } = await supabase
        .from('reservations')
        .select('*', { count: 'exact', head: true })
        .eq('customer_id', TEST_CUSTOMERS.daniel.id)
        .eq('status', 'confirmed')
      
      expect(error).toBeNull()
      expect(typeof count).toBe('number')
    })

    it('should count future reservations', async () => {
      const now = Date.now()
      
      const { count, error } = await supabase
        .from('reservations')
        .select('*', { count: 'exact', head: true })
        .gt('time_timestamp', now)
        .eq('status', 'confirmed')
      
      expect(error).toBeNull()
      expect(typeof count).toBe('number')
    })
  })

  describe('Related Tables', () => {
    it('should query customers table', async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('id, phone, fullname, is_blocked')
        .eq('id', TEST_CUSTOMERS.daniel.id)
        .single()
      
      expect(error).toBeNull()
      expect(data).toBeDefined()
      expect(data?.id).toBe(TEST_CUSTOMERS.daniel.id)
    })

    it('should query services table', async () => {
      const { data, error } = await supabase
        .from('services')
        .select('id, name_he, duration, price, is_active')
        .eq('id', TEST_SERVICES.haircutBeard.id)
        .single()
      
      expect(error).toBeNull()
      expect(data).toBeDefined()
      expect(data?.id).toBe(TEST_SERVICES.haircutBeard.id)
    })

    it('should query users (barbers) table', async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, username, fullname, role, is_active')
        .eq('id', TEST_BARBERS.admin.id)
        .single()
      
      expect(error).toBeNull()
      expect(data).toBeDefined()
      expect(data?.id).toBe(TEST_BARBERS.admin.id)
    })

    it('should query barbershop_settings', async () => {
      const { data, error } = await supabase
        .from('barbershop_settings')
        .select('id, name, max_booking_days_ahead, work_hours_start, work_hours_end')
        .single()
      
      expect(error).toBeNull()
      expect(data).toBeDefined()
      expect(data?.max_booking_days_ahead).toBeDefined()
    })
  })
})
