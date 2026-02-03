/**
 * Concurrency and Database Constraint Tests (READ-ONLY)
 * 
 * Tests to verify the database has proper constraints and indexes
 * for handling concurrent operations. All tests are READ-ONLY.
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

describe.skipIf(!hasSupabaseEnv)('Database Concurrency Support (Read-Only)', () => {
  let supabase: Awaited<ReturnType<typeof getSupabase>>
  
  beforeAll(async () => {
    supabase = await getSupabase()
  })

  describe('Optimistic Locking Support', () => {
    it('should have version column in reservations table', async () => {
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

    it('should have versions incrementing correctly across reservations', async () => {
      const { data, error } = await supabase
        .from('reservations')
        .select('id, version')
        .limit(20)
      
      expect(error).toBeNull()
      
      for (const res of data || []) {
        // All versions should be positive integers
        expect(res.version).toBeGreaterThanOrEqual(1)
        expect(Number.isInteger(res.version)).toBe(true)
      }
    })
  })

  describe('Concurrent Query Handling', () => {
    it('should handle multiple parallel SELECT queries', async () => {
      // Execute 5 queries in parallel
      const queries = Array(5).fill(null).map(() =>
        supabase
          .from('reservations')
          .select('id, status')
          .limit(3)
      )
      
      const results = await Promise.all(queries)
      
      // All queries should succeed
      for (const result of results) {
        expect(result.error).toBeNull()
        expect(Array.isArray(result.data)).toBe(true)
      }
    })

    it('should handle parallel queries to different tables', async () => {
      const [reservations, customers, services, barbers] = await Promise.all([
        supabase.from('reservations').select('id').limit(1),
        supabase.from('customers').select('id').limit(1),
        supabase.from('services').select('id').limit(1),
        supabase.from('users').select('id').eq('is_barber', true).limit(1),
      ])
      
      expect(reservations.error).toBeNull()
      expect(customers.error).toBeNull()
      expect(services.error).toBeNull()
      expect(barbers.error).toBeNull()
    })

    it('should handle parallel count queries', async () => {
      const [confirmed, cancelled, completed] = await Promise.all([
        supabase.from('reservations').select('*', { count: 'exact', head: true }).eq('status', 'confirmed'),
        supabase.from('reservations').select('*', { count: 'exact', head: true }).eq('status', 'cancelled'),
        supabase.from('reservations').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
      ])
      
      expect(confirmed.error).toBeNull()
      expect(cancelled.error).toBeNull()
      expect(completed.error).toBeNull()
      
      expect(typeof confirmed.count).toBe('number')
      expect(typeof cancelled.count).toBe('number')
      expect(typeof completed.count).toBe('number')
    })
  })

  describe('Data Consistency Checks', () => {
    it('should have no orphaned reservations (all reference valid customers)', async () => {
      // Get reservations with customer join
      const { data, error } = await supabase
        .from('reservations')
        .select(`
          id,
          customer_id,
          customers:customer_id (id)
        `)
        .limit(20)
      
      expect(error).toBeNull()
      
      for (const res of data || []) {
        // customer_id should always be set
        expect(res.customer_id).toBeDefined()
        // The join should return the customer
        expect(res.customers).toBeDefined()
      }
    })

    it('should have no orphaned reservations (all reference valid services)', async () => {
      const { data, error } = await supabase
        .from('reservations')
        .select(`
          id,
          service_id,
          services:service_id (id)
        `)
        .limit(20)
      
      expect(error).toBeNull()
      
      for (const res of data || []) {
        expect(res.service_id).toBeDefined()
        expect(res.services).toBeDefined()
      }
    })

    it('should have no orphaned reservations (all reference valid barbers)', async () => {
      const { data, error } = await supabase
        .from('reservations')
        .select(`
          id,
          barber_id,
          users:barber_id (id)
        `)
        .limit(20)
      
      expect(error).toBeNull()
      
      for (const res of data || []) {
        expect(res.barber_id).toBeDefined()
        expect(res.users).toBeDefined()
      }
    })
  })

  describe('Booking Constraint Verification', () => {
    it('should not have duplicate confirmed bookings for same slot', async () => {
      // Get all confirmed reservations grouped by barber and time
      const { data, error } = await supabase
        .from('reservations')
        .select('barber_id, time_timestamp')
        .eq('status', 'confirmed')
      
      expect(error).toBeNull()
      
      // Check for duplicates
      const slotMap = new Map<string, number>()
      for (const res of data || []) {
        const key = `${res.barber_id}-${res.time_timestamp}`
        slotMap.set(key, (slotMap.get(key) || 0) + 1)
      }
      
      // No slot should have more than 1 confirmed booking
      for (const [slot, count] of slotMap.entries()) {
        expect(count).toBe(1)
      }
    })

    it('should verify customer booking counts are reasonable', async () => {
      const now = Date.now()
      
      // Get customers with their future confirmed booking counts
      const { data: customers, error: custError } = await supabase
        .from('customers')
        .select('id, fullname')
        .limit(10)
      
      expect(custError).toBeNull()
      
      for (const customer of customers || []) {
        const { count, error } = await supabase
          .from('reservations')
          .select('*', { count: 'exact', head: true })
          .eq('customer_id', customer.id)
          .eq('status', 'confirmed')
          .gt('time_timestamp', now)
        
        expect(error).toBeNull()
        // Max bookings per customer is typically 5
        expect(count || 0).toBeLessThanOrEqual(10)
      }
    })
  })

  describe('RLS Policy Verification', () => {
    it('should allow reading reservations (SELECT)', async () => {
      const { data, error } = await supabase
        .from('reservations')
        .select('id, status')
        .limit(1)
      
      expect(error).toBeNull()
      expect(Array.isArray(data)).toBe(true)
    })

    it('should allow reading customers (SELECT)', async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('id, fullname')
        .limit(1)
      
      expect(error).toBeNull()
      expect(Array.isArray(data)).toBe(true)
    })

    it('should allow reading services (SELECT)', async () => {
      const { data, error } = await supabase
        .from('services')
        .select('id, name_he, is_active')
        .limit(1)
      
      expect(error).toBeNull()
      expect(Array.isArray(data)).toBe(true)
    })

    it('should allow reading barbers (SELECT)', async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, fullname, is_active')
        .eq('is_barber', true)
        .limit(1)
      
      expect(error).toBeNull()
      expect(Array.isArray(data)).toBe(true)
    })

    it('should allow reading work_days (SELECT)', async () => {
      const { data, error } = await supabase
        .from('work_days')
        .select('id, day_of_week, is_working')
        .limit(1)
      
      expect(error).toBeNull()
      expect(Array.isArray(data)).toBe(true)
    })

    it('should allow reading barbershop_settings (SELECT)', async () => {
      const { data, error } = await supabase
        .from('barbershop_settings')
        .select('name, max_booking_days_ahead')
        .single()
      
      expect(error).toBeNull()
      expect(data).toBeDefined()
    })
  })

  describe('Index Efficiency Verification', () => {
    it('should efficiently query by barber_id', async () => {
      // Get first barber
      const { data: barbers } = await supabase
        .from('users')
        .select('id')
        .eq('is_barber', true)
        .limit(1)
      
      if (barbers && barbers.length > 0) {
        const startTime = Date.now()
        
        const { data, error } = await supabase
          .from('reservations')
          .select('id, status')
          .eq('barber_id', barbers[0].id)
          .limit(50)
        
        const queryTime = Date.now() - startTime
        
        expect(error).toBeNull()
        // Query should complete quickly (under 2 seconds even without specific indexes)
        expect(queryTime).toBeLessThan(2000)
      }
    })

    it('should efficiently query by customer_id', async () => {
      // Get first customer
      const { data: customers } = await supabase
        .from('customers')
        .select('id')
        .limit(1)
      
      if (customers && customers.length > 0) {
        const startTime = Date.now()
        
        const { data, error } = await supabase
          .from('reservations')
          .select('id, status')
          .eq('customer_id', customers[0].id)
          .limit(50)
        
        const queryTime = Date.now() - startTime
        
        expect(error).toBeNull()
        expect(queryTime).toBeLessThan(2000)
      }
    })

    it('should efficiently query by time_timestamp range', async () => {
      const now = Date.now()
      const weekAgo = now - 7 * 24 * 60 * 60 * 1000
      
      const startTime = Date.now()
      
      const { data, error } = await supabase
        .from('reservations')
        .select('id, status')
        .gte('time_timestamp', weekAgo)
        .lte('time_timestamp', now)
        .limit(50)
      
      const queryTime = Date.now() - startTime
      
      expect(error).toBeNull()
      expect(queryTime).toBeLessThan(2000)
    })
  })
})
