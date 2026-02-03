/**
 * End-to-End Booking Flow Tests (READ-ONLY)
 * 
 * These tests verify the booking system's data integrity and query patterns.
 * All tests are READ-ONLY - no database modifications.
 * 
 * NOTE: These tests require Supabase environment variables to be set.
 * They will be skipped if the environment is not configured.
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

describe.skipIf(!hasSupabaseEnv)('E2E Booking Flow (Read-Only)', () => {
  let supabase: Awaited<ReturnType<typeof getSupabase>>
  
  beforeAll(async () => {
    supabase = await getSupabase()
  })

  describe('Database Structure Verification', () => {
    it('should have customers table with required columns', async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('id, phone, fullname, is_blocked, created_at')
        .limit(1)
      
      expect(error).toBeNull()
      expect(Array.isArray(data)).toBe(true)
    })

    it('should have reservations table with required columns', async () => {
      const { data, error } = await supabase
        .from('reservations')
        .select('id, barber_id, service_id, customer_id, customer_name, customer_phone, time_timestamp, date_timestamp, status, version')
        .limit(1)
      
      expect(error).toBeNull()
      expect(Array.isArray(data)).toBe(true)
    })

    it('should have services table with required columns', async () => {
      const { data, error } = await supabase
        .from('services')
        .select('id, name_he, duration, price, is_active, barber_id')
        .limit(1)
      
      expect(error).toBeNull()
      expect(Array.isArray(data)).toBe(true)
    })

    it('should have users (barbers) table with required columns', async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, username, fullname, is_active, role, is_barber')
        .limit(1)
      
      expect(error).toBeNull()
      expect(Array.isArray(data)).toBe(true)
    })

    it('should have barbershop_settings table', async () => {
      const { data, error } = await supabase
        .from('barbershop_settings')
        .select('id, name, max_booking_days_ahead, work_hours_start, work_hours_end, open_days')
        .single()
      
      expect(error).toBeNull()
      expect(data).toBeDefined()
      expect(data?.name).toBeDefined()
    })
  })

  describe('Active Barbers Verification', () => {
    it('should have at least one active barber', async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, fullname, is_active')
        .eq('is_barber', true)
        .eq('is_active', true)
      
      expect(error).toBeNull()
      expect(data).toBeDefined()
      expect(data!.length).toBeGreaterThan(0)
    })

    it('should have work_days for each active barber', async () => {
      // Get active barbers
      const { data: barbers } = await supabase
        .from('users')
        .select('id, fullname')
        .eq('is_barber', true)
        .eq('is_active', true)
      
      expect(barbers).toBeDefined()
      
      for (const barber of barbers || []) {
        const { data: workDays, error } = await supabase
          .from('work_days')
          .select('id, day_of_week, is_working')
          .eq('user_id', barber.id)
        
        expect(error).toBeNull()
        // Each barber should have 7 work_days entries (one per day)
        expect(workDays?.length).toBe(7)
      }
    })
  })

  describe('Active Services Verification', () => {
    it('should have at least one active service', async () => {
      const { data, error } = await supabase
        .from('services')
        .select('id, name_he, price, duration, is_active, barber_id')
        .eq('is_active', true)
      
      expect(error).toBeNull()
      expect(data).toBeDefined()
      expect(data!.length).toBeGreaterThan(0)
    })

    it('should have valid duration values (positive integers)', async () => {
      const { data, error } = await supabase
        .from('services')
        .select('id, name_he, duration')
        .eq('is_active', true)
      
      expect(error).toBeNull()
      
      for (const service of data || []) {
        expect(service.duration).toBeGreaterThan(0)
        expect(Number.isInteger(service.duration)).toBe(true)
      }
    })

    it('should have valid price values (non-negative)', async () => {
      const { data, error } = await supabase
        .from('services')
        .select('id, name_he, price')
        .eq('is_active', true)
      
      expect(error).toBeNull()
      
      for (const service of data || []) {
        expect(Number(service.price)).toBeGreaterThanOrEqual(0)
      }
    })
  })

  describe('Reservations Data Integrity', () => {
    it('should have valid status values in reservations', async () => {
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

    it('should have valid cancelled_by values in cancelled reservations', async () => {
      const { data, error } = await supabase
        .from('reservations')
        .select('cancelled_by')
        .eq('status', 'cancelled')
        .limit(20)
      
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
        expect(data[0].version).toBeGreaterThanOrEqual(1)
      }
    })
  })

  describe('Referential Integrity', () => {
    it('should have valid customer references in reservations', async () => {
      const { data, error } = await supabase
        .from('reservations')
        .select(`
          id,
          customer_id,
          customers:customer_id (id, fullname)
        `)
        .eq('status', 'confirmed')
        .limit(10)
      
      expect(error).toBeNull()
      
      for (const res of data || []) {
        expect(res.customer_id).toBeDefined()
        // Verify the join returned data
        expect(res.customers).toBeDefined()
      }
    })

    it('should have valid service references in reservations', async () => {
      const { data, error } = await supabase
        .from('reservations')
        .select(`
          id,
          service_id,
          services:service_id (id, name_he)
        `)
        .limit(10)
      
      expect(error).toBeNull()
      
      for (const res of data || []) {
        expect(res.service_id).toBeDefined()
      }
    })

    it('should have valid barber references in reservations', async () => {
      const { data, error } = await supabase
        .from('reservations')
        .select(`
          id,
          barber_id,
          users:barber_id (id, fullname)
        `)
        .limit(10)
      
      expect(error).toBeNull()
      
      for (const res of data || []) {
        expect(res.barber_id).toBeDefined()
      }
    })
  })

  describe('Business Rules Verification', () => {
    it('should have max_booking_days_ahead configured', async () => {
      const { data, error } = await supabase
        .from('barbershop_settings')
        .select('max_booking_days_ahead')
        .single()
      
      expect(error).toBeNull()
      expect(data?.max_booking_days_ahead).toBeDefined()
      expect(data?.max_booking_days_ahead).toBeGreaterThan(0)
    })

    it('should have barber_booking_settings for barbers', async () => {
      const { data: barbers } = await supabase
        .from('users')
        .select('id')
        .eq('is_barber', true)
        .eq('is_active', true)
      
      const { data: settings, error } = await supabase
        .from('barber_booking_settings')
        .select('barber_id, max_booking_days_ahead, min_hours_before_booking, min_cancel_hours')
      
      expect(error).toBeNull()
      // Each active barber should have booking settings
      expect(settings?.length).toBeGreaterThanOrEqual(barbers?.length || 0)
    })
  })

  describe('Query Performance Patterns', () => {
    it('should efficiently query reservations by barber and date range', async () => {
      const now = Date.now()
      const tomorrow = now + 24 * 60 * 60 * 1000
      
      const { data, error } = await supabase
        .from('reservations')
        .select('id, time_timestamp, status')
        .gte('time_timestamp', now)
        .lte('time_timestamp', tomorrow)
        .eq('status', 'confirmed')
        .order('time_timestamp', { ascending: true })
      
      expect(error).toBeNull()
      expect(Array.isArray(data)).toBe(true)
    })

    it('should efficiently count confirmed reservations', async () => {
      const { count, error } = await supabase
        .from('reservations')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'confirmed')
      
      expect(error).toBeNull()
      expect(typeof count).toBe('number')
    })

    it('should efficiently query available time slots pattern', async () => {
      // This simulates how the booking wizard queries for taken slots
      const now = Date.now()
      const weekFromNow = now + 7 * 24 * 60 * 60 * 1000
      
      // Get first active barber
      const { data: barbers } = await supabase
        .from('users')
        .select('id')
        .eq('is_barber', true)
        .eq('is_active', true)
        .limit(1)
      
      if (barbers && barbers.length > 0) {
        const { data, error } = await supabase
          .from('reservations')
          .select('time_timestamp, customer_name, status')
          .eq('barber_id', barbers[0].id)
          .gte('time_timestamp', now)
          .lte('time_timestamp', weekFromNow)
          .neq('status', 'cancelled')
        
        expect(error).toBeNull()
        expect(Array.isArray(data)).toBe(true)
      }
    })
  })
})
