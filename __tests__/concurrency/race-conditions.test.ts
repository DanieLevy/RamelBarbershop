/**
 * Concurrency and Race Condition Tests
 * 
 * Tests to verify the system properly handles concurrent operations
 * and prevents race conditions in booking scenarios.
 * 
 * NOTE: These tests require Supabase environment variables to be set.
 * They will be skipped if the environment is not configured.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  TEST_BARBERS,
  TEST_CUSTOMERS,
  TEST_SERVICES,
  getServiceForBarber,
  getDaysFromNow,
  getDayStart,
  getHebrewDayName,
  getDayNum,
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

// Track created reservations for cleanup
const testReservationIds: string[] = []

describe.skipIf(!hasSupabaseEnv)('Concurrency and Race Conditions', () => {
  let supabase: Awaited<ReturnType<typeof getSupabase>>
  
  beforeAll(async () => {
    supabase = await getSupabase()
    
    // Clean up old test reservations for test customers to reset limits
    // Cancel (don't delete) future reservations for test customers to free up slots
    const now = Date.now()
    const testCustomerIds = [
      TEST_CUSTOMERS.daniel.id,
      TEST_CUSTOMERS.gal.id,
      TEST_CUSTOMERS.akiva.id,
    ]
    
    await supabase
      .from('reservations')
      .update({ status: 'cancelled', cancelled_by: 'customer', cancellation_reason: 'Test cleanup' })
      .in('customer_id', testCustomerIds)
      .eq('status', 'confirmed')
      .gt('time_timestamp', now)
  })

  afterAll(async () => {
    // Cleanup test reservations
    if (testReservationIds.length > 0) {
      await supabase
        .from('reservations')
        .delete()
        .in('id', testReservationIds)
    }
  })

  describe('Simultaneous Slot Booking', () => {
    it('should only allow one booking when two customers try to book the same slot simultaneously', async () => {
      // Use a unique future time to avoid conflicts with other tests
      const uniqueTime = getDaysFromNow(8, 9) // 8 days from now at 9am
      const uniqueDate = getDayStart(uniqueTime)
      const dayName = getHebrewDayName(uniqueTime)
      const dayNum = getDayNum(uniqueTime)
      // Use the service that belongs to the admin barber
      const adminService = getServiceForBarber(TEST_BARBERS.admin.id)

      // Create two booking promises that run concurrently
      const booking1Promise = supabase.rpc('create_reservation_atomic', {
        p_barber_id: TEST_BARBERS.admin.id,
        p_service_id: adminService.id,
        p_customer_id: TEST_CUSTOMERS.daniel.id,
        p_customer_name: TEST_CUSTOMERS.daniel.fullname,
        p_customer_phone: TEST_CUSTOMERS.daniel.phone,
        p_date_timestamp: uniqueDate,
        p_time_timestamp: uniqueTime,
        p_day_name: dayName,
        p_day_num: dayNum,
      })

      const booking2Promise = supabase.rpc('create_reservation_atomic', {
        p_barber_id: TEST_BARBERS.admin.id,
        p_service_id: adminService.id,
        p_customer_id: TEST_CUSTOMERS.gal.id,
        p_customer_name: TEST_CUSTOMERS.gal.fullname,
        p_customer_phone: TEST_CUSTOMERS.gal.phone,
        p_date_timestamp: uniqueDate,
        p_time_timestamp: uniqueTime,
        p_day_name: dayName,
        p_day_num: dayNum,
      })

      // Execute both simultaneously
      const [result1, result2] = await Promise.all([booking1Promise, booking2Promise])

      // Collect successful reservation IDs for cleanup
      if (result1.data) testReservationIds.push(result1.data)
      if (result2.data) testReservationIds.push(result2.data)

      // Count successes and failures
      const successes = [result1, result2].filter(r => r.data && !r.error)
      const failures = [result1, result2].filter(r => r.error)

      // Exactly one should succeed, one should fail
      expect(successes.length).toBe(1)
      expect(failures.length).toBe(1)

      // The failure should be SLOT_ALREADY_TAKEN
      const failedResult = failures[0]
      expect(failedResult.error?.message).toContain('SLOT_ALREADY_TAKEN')
    })

    it('should handle triple concurrent booking attempts', async () => {
      const uniqueTime = getDaysFromNow(9, 10) // 9 days from now at 10am
      const uniqueDate = getDayStart(uniqueTime)
      const dayName = getHebrewDayName(uniqueTime)
      const dayNum = getDayNum(uniqueTime)
      // Use the service that belongs to the admin barber
      const adminService = getServiceForBarber(TEST_BARBERS.admin.id)

      // Three concurrent booking attempts
      const bookingPromises = [
        TEST_CUSTOMERS.daniel,
        TEST_CUSTOMERS.gal,
        TEST_CUSTOMERS.akiva,
      ].map(customer =>
        supabase.rpc('create_reservation_atomic', {
          p_barber_id: TEST_BARBERS.admin.id,
          p_service_id: adminService.id,
          p_customer_id: customer.id,
          p_customer_name: customer.fullname,
          p_customer_phone: customer.phone,
          p_date_timestamp: uniqueDate,
          p_time_timestamp: uniqueTime,
          p_day_name: dayName,
          p_day_num: dayNum,
        })
      )

      const results = await Promise.all(bookingPromises)

      // Collect successful IDs for cleanup
      results.forEach(r => {
        if (r.data) testReservationIds.push(r.data)
      })

      const successes = results.filter(r => r.data && !r.error)
      const failures = results.filter(r => r.error)

      // Exactly one should succeed
      expect(successes.length).toBe(1)
      expect(failures.length).toBe(2)

      // All failures should be SLOT_ALREADY_TAKEN
      failures.forEach(f => {
        expect(f.error?.message).toContain('SLOT_ALREADY_TAKEN')
      })
    })
  })

  describe('Optimistic Locking', () => {
    it('should detect version conflicts during concurrent updates', async () => {
      // First, create a reservation
      const uniqueTime = getDaysFromNow(10, 11)
      const uniqueDate = getDayStart(uniqueTime)
      // Use the service that belongs to the admin barber
      const adminService = getServiceForBarber(TEST_BARBERS.admin.id)
      
      const { data: reservationId, error: createError } = await supabase.rpc('create_reservation_atomic', {
        p_barber_id: TEST_BARBERS.admin.id,
        p_service_id: adminService.id,
        p_customer_id: TEST_CUSTOMERS.daniel.id,
        p_customer_name: TEST_CUSTOMERS.daniel.fullname,
        p_customer_phone: TEST_CUSTOMERS.daniel.phone,
        p_date_timestamp: uniqueDate,
        p_time_timestamp: uniqueTime,
        p_day_name: getHebrewDayName(uniqueTime),
        p_day_num: getDayNum(uniqueTime),
      })
      
      if (createError) {
        // If slot is taken or other valid errors, skip this test
        expect(['SLOT_ALREADY_TAKEN', 'CUSTOMER_DOUBLE_BOOKING', 'MAX_BOOKINGS_REACHED'].some(e =>
          createError.message.includes(e)
        )).toBe(true)
        return
      }
      
      expect(reservationId).toBeDefined()
      if (reservationId) testReservationIds.push(reservationId)

      // Get the current version
      const { data: reservation } = await supabase
        .from('reservations')
        .select('version')
        .eq('id', reservationId)
        .single()

      const currentVersion = reservation?.version || 1

      // Try to cancel with wrong version
      const { data: wrongVersionResult, error: wrongVersionError } = await supabase
        .from('reservations')
        .update({ status: 'cancelled', cancelled_by: 'customer' })
        .eq('id', reservationId)
        .eq('version', currentVersion + 100) // Wrong version
        .select()

      // Should return empty (no rows updated)
      expect(wrongVersionResult).toEqual([])

      // Verify reservation is still confirmed
      const { data: stillActive } = await supabase
        .from('reservations')
        .select('status')
        .eq('id', reservationId)
        .single()

      expect(stillActive?.status).toBe('confirmed')

      // Now cancel with correct version
      const { data: correctResult } = await supabase
        .from('reservations')
        .update({ status: 'cancelled', cancelled_by: 'customer' })
        .eq('id', reservationId)
        .eq('version', currentVersion)
        .select()

      expect(correctResult?.length).toBe(1)
    })
  })

  describe('Customer Booking Limits Race Condition', () => {
    it('should enforce max bookings even with concurrent requests', async () => {
      // This test verifies that the database function properly counts
      // and limits bookings even under concurrent load
      // Use the service that belongs to the regular barber
      const regularService = getServiceForBarber(TEST_BARBERS.regular.id)
      
      // Get current booking count for customer
      const now = Date.now()
      const { count: currentCount } = await supabase
        .from('reservations')
        .select('*', { count: 'exact', head: true })
        .eq('customer_id', TEST_CUSTOMERS.akiva.id)
        .eq('status', 'confirmed')
        .gt('time_timestamp', now)
      
      // Create multiple booking attempts concurrently at different times
      const bookingPromises = [11, 12, 13, 14, 15].map(day => {
        const time = getDaysFromNow(day, 10)
        const date = getDayStart(time)
        
        return supabase.rpc('create_reservation_atomic', {
          p_barber_id: TEST_BARBERS.regular.id,
          p_service_id: regularService.id,
          p_customer_id: TEST_CUSTOMERS.akiva.id,
          p_customer_name: TEST_CUSTOMERS.akiva.fullname,
          p_customer_phone: TEST_CUSTOMERS.akiva.phone,
          p_date_timestamp: date,
          p_time_timestamp: time,
          p_day_name: getHebrewDayName(time),
          p_day_num: getDayNum(time),
        })
      })

      const results = await Promise.all(bookingPromises)

      // Collect successful IDs for cleanup
      results.forEach(r => {
        if (r.data) testReservationIds.push(r.data)
      })

      const successes = results.filter(r => r.data && !r.error)
      const maxBookingsErrors = results.filter(r => 
        r.error?.message?.includes('MAX_BOOKINGS_REACHED')
      )

      // Total successful bookings should not exceed 5 (the limit)
      const newCount = (currentCount || 0) + successes.length
      expect(newCount).toBeLessThanOrEqual(5)

      // If we hit the limit, verify error message
      if (maxBookingsErrors.length > 0) {
        expect(maxBookingsErrors[0].error?.message).toContain('MAX_BOOKINGS_REACHED')
      }
    })
  })

  describe('Concurrent Cancellation', () => {
    it('should handle concurrent cancellation attempts gracefully', async () => {
      // Create a reservation first
      const uniqueTime = getDaysFromNow(12, 16)
      const uniqueDate = getDayStart(uniqueTime)
      // Use the service that belongs to the regular barber
      const regularService = getServiceForBarber(TEST_BARBERS.regular.id)
      
      const { data: reservationId, error } = await supabase.rpc('create_reservation_atomic', {
        p_barber_id: TEST_BARBERS.regular.id,
        p_service_id: regularService.id,
        p_customer_id: TEST_CUSTOMERS.gal.id,
        p_customer_name: TEST_CUSTOMERS.gal.fullname,
        p_customer_phone: TEST_CUSTOMERS.gal.phone,
        p_date_timestamp: uniqueDate,
        p_time_timestamp: uniqueTime,
        p_day_name: getHebrewDayName(uniqueTime),
        p_day_num: getDayNum(uniqueTime),
      })
      
      if (error) {
        // Skip if slot is taken or other valid errors
        expect(['SLOT_ALREADY_TAKEN', 'CUSTOMER_DOUBLE_BOOKING', 'MAX_BOOKINGS_REACHED'].some(e =>
          error.message.includes(e)
        )).toBe(true)
        return
      }
      
      if (reservationId) testReservationIds.push(reservationId)

      // Get version
      const { data: res } = await supabase
        .from('reservations')
        .select('version')
        .eq('id', reservationId)
        .single()

      const version = res?.version || 1

      // Attempt two concurrent cancellations
      const cancel1 = supabase
        .from('reservations')
        .update({ status: 'cancelled', cancelled_by: 'customer' })
        .eq('id', reservationId)
        .eq('status', 'confirmed')
        .eq('version', version)
        .select()

      const cancel2 = supabase
        .from('reservations')
        .update({ status: 'cancelled', cancelled_by: 'barber' })
        .eq('id', reservationId)
        .eq('status', 'confirmed')
        .eq('version', version)
        .select()

      const [result1, result2] = await Promise.all([cancel1, cancel2])

      // Only one should succeed (return data), one should be empty
      const successCount = [result1, result2].filter(
        r => r.data && r.data.length > 0
      ).length

      expect(successCount).toBe(1)

      // Verify final state
      const { data: finalState } = await supabase
        .from('reservations')
        .select('status, cancelled_by')
        .eq('id', reservationId)
        .single()

      expect(finalState?.status).toBe('cancelled')
      expect(['customer', 'barber']).toContain(finalState?.cancelled_by)
    })
  })
})
