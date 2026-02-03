/**
 * Database Operation Tests for Reservations (READ-ONLY)
 * 
 * Integration tests that verify database queries work correctly
 * using the real Supabase database. All tests are READ-ONLY.
 * 
 * NOTE: These tests use actual database calls and require proper setup.
 * They will be skipped if Supabase environment variables are not set.
 */

import { describe, it, expect, beforeAll } from 'vitest'

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

describe.skipIf(!hasSupabaseEnv)('Reservations Database Operations (Read-Only)', () => {
  let supabase: Awaited<ReturnType<typeof getSupabase>>
  
  beforeAll(async () => {
    supabase = await getSupabase()
  })

  describe('Query Operations', () => {
    it('should query reservations with all columns', async () => {
      const { data, error } = await supabase
        .from('reservations')
        .select('*')
        .limit(5)
      
      expect(error).toBeNull()
      expect(Array.isArray(data)).toBe(true)
      
      if (data && data.length > 0) {
        const res = data[0]
        expect(res.id).toBeDefined()
        expect(res.barber_id).toBeDefined()
        expect(res.service_id).toBeDefined()
        expect(res.customer_id).toBeDefined()
        expect(res.status).toBeDefined()
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
      
      for (const res of data || []) {
        expect(res.status).toBe('confirmed')
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
      
      for (const res of data || []) {
        expect(Number(res.time_timestamp)).toBeGreaterThan(now)
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
      for (const res of data || []) {
        expect(validStatuses).toContain(res.status)
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
      for (const res of data || []) {
        expect(validCancelledBy).toContain(res.cancelled_by)
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
    it('should count confirmed reservations', async () => {
      const { count, error } = await supabase
        .from('reservations')
        .select('*', { count: 'exact', head: true })
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

    it('should count reservations per status', async () => {
      const statuses = ['confirmed', 'cancelled', 'completed']
      
      for (const status of statuses) {
        const { count, error } = await supabase
          .from('reservations')
          .select('*', { count: 'exact', head: true })
          .eq('status', status)
        
        expect(error).toBeNull()
        expect(typeof count).toBe('number')
      }
    })
  })

  describe('Related Tables', () => {
    it('should query customers table', async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('id, phone, fullname, is_blocked')
        .limit(1)
      
      expect(error).toBeNull()
      expect(Array.isArray(data)).toBe(true)
      
      if (data && data.length > 0) {
        expect(data[0].id).toBeDefined()
        expect(data[0].phone).toBeDefined()
      }
    })

    it('should query services table', async () => {
      const { data, error } = await supabase
        .from('services')
        .select('id, name_he, duration, price, is_active')
        .limit(1)
      
      expect(error).toBeNull()
      expect(Array.isArray(data)).toBe(true)
      
      if (data && data.length > 0) {
        expect(data[0].id).toBeDefined()
        expect(data[0].name_he).toBeDefined()
      }
    })

    it('should query users (barbers) table', async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, username, fullname, role, is_active')
        .eq('is_barber', true)
        .limit(1)
      
      expect(error).toBeNull()
      expect(Array.isArray(data)).toBe(true)
      
      if (data && data.length > 0) {
        expect(data[0].id).toBeDefined()
        expect(data[0].fullname).toBeDefined()
      }
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

    it('should query work_days table', async () => {
      const { data, error } = await supabase
        .from('work_days')
        .select('id, user_id, day_of_week, is_working, start_time, end_time')
        .limit(7)
      
      expect(error).toBeNull()
      expect(Array.isArray(data)).toBe(true)
      
      if (data && data.length > 0) {
        expect(data[0].day_of_week).toBeDefined()
      }
    })

    it('should query barber_booking_settings table', async () => {
      const { data, error } = await supabase
        .from('barber_booking_settings')
        .select('id, barber_id, max_booking_days_ahead, min_hours_before_booking, min_cancel_hours')
        .limit(1)
      
      expect(error).toBeNull()
      expect(Array.isArray(data)).toBe(true)
    })
  })

  describe('Complex Queries', () => {
    it('should query reservations with full joins', async () => {
      const { data, error } = await supabase
        .from('reservations')
        .select(`
          id,
          customer_name,
          customer_phone,
          time_timestamp,
          status,
          services:service_id (id, name_he, price, duration),
          users:barber_id (id, fullname, username),
          customers:customer_id (id, fullname, phone)
        `)
        .eq('status', 'confirmed')
        .limit(3)
      
      expect(error).toBeNull()
      expect(Array.isArray(data)).toBe(true)
    })

    it('should query reservations ordered by time', async () => {
      const { data, error } = await supabase
        .from('reservations')
        .select('id, time_timestamp')
        .eq('status', 'confirmed')
        .order('time_timestamp', { ascending: true })
        .limit(10)
      
      expect(error).toBeNull()
      expect(Array.isArray(data)).toBe(true)
      
      // Verify order
      if (data && data.length > 1) {
        for (let i = 1; i < data.length; i++) {
          expect(Number(data[i].time_timestamp)).toBeGreaterThanOrEqual(Number(data[i - 1].time_timestamp))
        }
      }
    })

    it('should query with date range filter', async () => {
      const now = Date.now()
      const weekFromNow = now + 7 * 24 * 60 * 60 * 1000
      
      const { data, error } = await supabase
        .from('reservations')
        .select('id, time_timestamp, status')
        .gte('time_timestamp', now)
        .lte('time_timestamp', weekFromNow)
        .eq('status', 'confirmed')
      
      expect(error).toBeNull()
      expect(Array.isArray(data)).toBe(true)
      
      for (const res of data || []) {
        const ts = Number(res.time_timestamp)
        expect(ts).toBeGreaterThanOrEqual(now)
        expect(ts).toBeLessThanOrEqual(weekFromNow)
      }
    })
  })
})
