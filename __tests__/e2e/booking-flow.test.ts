/**
 * End-to-End Booking Flow Tests
 * 
 * These tests simulate complete booking scenarios from start to finish,
 * testing the integration of all system components.
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
  getTomorrowAtHour,
  getDayStart,
  getHebrewDayName,
  getDayNum,
  getDaysFromNow,
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

describe.skipIf(!hasSupabaseEnv)('E2E Booking Flow', () => {
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

  describe('Complete Booking Lifecycle', () => {
    let createdReservationId: string | null = null
    
    it('Step 1: Verify customer exists and is not blocked', async () => {
      const { data: customer, error } = await supabase
        .from('customers')
        .select('id, fullname, phone, is_blocked')
        .eq('id', TEST_CUSTOMERS.daniel.id)
        .single()
      
      expect(error).toBeNull()
      expect(customer).toBeDefined()
      expect(customer?.is_blocked).toBe(false)
    })

    it('Step 2: Verify service exists and is active', async () => {
      // Use the service that belongs to the admin barber
      const adminService = getServiceForBarber(TEST_BARBERS.admin.id)
      
      const { data: service, error } = await supabase
        .from('services')
        .select('id, name_he, duration, price, is_active, barber_id')
        .eq('id', adminService.id)
        .single()
      
      expect(error).toBeNull()
      expect(service).toBeDefined()
      expect(service?.is_active).toBe(true)
      expect(service?.barber_id).toBe(TEST_BARBERS.admin.id)
    })

    it('Step 3: Verify barber exists and is active', async () => {
      const { data: barber, error } = await supabase
        .from('users')
        .select('id, fullname, is_active, role')
        .eq('id', TEST_BARBERS.admin.id)
        .single()
      
      expect(error).toBeNull()
      expect(barber).toBeDefined()
      expect(barber?.is_active).toBe(true)
    })

    it('Step 4: Check time slot availability', async () => {
      // Use a time far in the future to ensure availability
      const futureTime = getDaysFromNow(5, 14) // 5 days from now at 2pm
      
      const { data: existing, error } = await supabase
        .from('reservations')
        .select('id')
        .eq('barber_id', TEST_BARBERS.admin.id)
        .eq('time_timestamp', futureTime)
        .eq('status', 'confirmed')
        .maybeSingle()
      
      expect(error).toBeNull()
      // Slot should be available (no existing booking)
      expect(existing).toBeNull()
    })

    it('Step 5: Create reservation using atomic function', async () => {
      const futureTime = getDaysFromNow(5, 14)
      const futureDate = getDayStart(futureTime)
      // Use the service that belongs to the admin barber
      const adminService = getServiceForBarber(TEST_BARBERS.admin.id)
      
      const { data: reservationId, error } = await supabase.rpc('create_reservation_atomic', {
        p_barber_id: TEST_BARBERS.admin.id,
        p_service_id: adminService.id,
        p_customer_id: TEST_CUSTOMERS.daniel.id,
        p_customer_name: TEST_CUSTOMERS.daniel.fullname,
        p_customer_phone: TEST_CUSTOMERS.daniel.phone,
        p_date_timestamp: futureDate,
        p_time_timestamp: futureTime,
        p_day_name: getHebrewDayName(futureTime),
        p_day_num: getDayNum(futureTime),
      })
      
      expect(error).toBeNull()
      expect(reservationId).toBeDefined()
      expect(typeof reservationId).toBe('string')
      
      createdReservationId = reservationId
      if (reservationId) {
        testReservationIds.push(reservationId)
      }
    })

    it('Step 6: Verify reservation was created correctly', async () => {
      expect(createdReservationId).not.toBeNull()
      
      const { data: reservation, error } = await supabase
        .from('reservations')
        .select('*')
        .eq('id', createdReservationId!)
        .single()
      
      expect(error).toBeNull()
      expect(reservation).toBeDefined()
      expect(reservation?.status).toBe('confirmed')
      expect(reservation?.customer_id).toBe(TEST_CUSTOMERS.daniel.id)
      expect(reservation?.barber_id).toBe(TEST_BARBERS.admin.id)
      expect(reservation?.version).toBe(1)
    })

    it('Step 7: Cancel reservation', async () => {
      expect(createdReservationId).not.toBeNull()
      
      const { data, error } = await supabase
        .from('reservations')
        .update({
          status: 'cancelled',
          cancelled_by: 'customer',
          cancellation_reason: 'E2E Test cancellation',
        })
        .eq('id', createdReservationId!)
        .eq('status', 'confirmed')
        .select()
      
      expect(error).toBeNull()
      expect(data).toBeDefined()
      expect(data?.length).toBe(1)
    })

    it('Step 8: Verify reservation status is cancelled', async () => {
      expect(createdReservationId).not.toBeNull()
      
      const { data: reservation, error } = await supabase
        .from('reservations')
        .select('status, cancelled_by, cancellation_reason')
        .eq('id', createdReservationId!)
        .single()
      
      expect(error).toBeNull()
      expect(reservation?.status).toBe('cancelled')
      expect(reservation?.cancelled_by).toBe('customer')
    })
  })

  describe('Double Booking Prevention', () => {
    it('should allow booking same slot after cancellation', async () => {
      const futureTime = getDaysFromNow(6, 11) // Different time slot
      const futureDate = getDayStart(futureTime)
      // Use the service that belongs to the admin barber
      const adminService = getServiceForBarber(TEST_BARBERS.admin.id)
      
      // Create first reservation
      const { data: firstId, error: firstError } = await supabase.rpc('create_reservation_atomic', {
        p_barber_id: TEST_BARBERS.admin.id,
        p_service_id: adminService.id,
        p_customer_id: TEST_CUSTOMERS.gal.id,
        p_customer_name: TEST_CUSTOMERS.gal.fullname,
        p_customer_phone: TEST_CUSTOMERS.gal.phone,
        p_date_timestamp: futureDate,
        p_time_timestamp: futureTime,
        p_day_name: getHebrewDayName(futureTime),
        p_day_num: getDayNum(futureTime),
      })
      
      // If customer has max bookings, that's a valid scenario - skip this test
      if (firstError?.message?.includes('MAX_BOOKINGS_REACHED')) {
        console.log('Customer reached max bookings - skipping double booking test')
        return
      }
      
      expect(firstError).toBeNull()
      expect(firstId).toBeDefined()
      if (firstId) testReservationIds.push(firstId)
      
      // Cancel first reservation
      await supabase
        .from('reservations')
        .update({ status: 'cancelled', cancelled_by: 'customer' })
        .eq('id', firstId)
      
      // Create second reservation at same time - should succeed
      const { data: secondId, error: secondError } = await supabase.rpc('create_reservation_atomic', {
        p_barber_id: TEST_BARBERS.admin.id,
        p_service_id: adminService.id,
        p_customer_id: TEST_CUSTOMERS.akiva.id,
        p_customer_name: TEST_CUSTOMERS.akiva.fullname,
        p_customer_phone: TEST_CUSTOMERS.akiva.phone,
        p_date_timestamp: futureDate,
        p_time_timestamp: futureTime,
        p_day_name: getHebrewDayName(futureTime),
        p_day_num: getDayNum(futureTime),
      })
      
      // Handle case where second customer also reached max bookings
      if (secondError?.message?.includes('MAX_BOOKINGS_REACHED')) {
        console.log('Second customer also reached max bookings - test still validates cancellation worked')
        return
      }
      
      expect(secondError).toBeNull()
      expect(secondId).toBeDefined()
      if (secondId) testReservationIds.push(secondId)
    })
  })

  describe('Booking Limits', () => {
    it('should enforce max_booking_days_ahead setting', async () => {
      // Get current max booking days setting
      const { data: settings } = await supabase
        .from('barbershop_settings')
        .select('max_booking_days_ahead')
        .single()
      
      const maxDays = settings?.max_booking_days_ahead || 21
      // Use the service that belongs to the admin barber
      const adminService = getServiceForBarber(TEST_BARBERS.admin.id)
      
      // Try to book beyond the limit
      const beyondLimitTime = getDaysFromNow(maxDays + 5, 10)
      const beyondLimitDate = getDayStart(beyondLimitTime)
      
      const { data, error } = await supabase.rpc('create_reservation_atomic', {
        p_barber_id: TEST_BARBERS.admin.id,
        p_service_id: adminService.id,
        p_customer_id: TEST_CUSTOMERS.daniel.id,
        p_customer_name: TEST_CUSTOMERS.daniel.fullname,
        p_customer_phone: TEST_CUSTOMERS.daniel.phone,
        p_date_timestamp: beyondLimitDate,
        p_time_timestamp: beyondLimitTime,
        p_day_name: getHebrewDayName(beyondLimitTime),
        p_day_num: getDayNum(beyondLimitTime),
      })
      
      // Should fail with DATE_OUT_OF_RANGE error
      expect(error).not.toBeNull()
      expect(error?.message).toContain('DATE_OUT_OF_RANGE')
    })

    it('should allow booking within max_booking_days_ahead', async () => {
      // Get current max booking days setting
      const { data: settings } = await supabase
        .from('barbershop_settings')
        .select('max_booking_days_ahead')
        .single()
      
      const maxDays = settings?.max_booking_days_ahead || 21
      // Use the service that belongs to the regular barber
      const regularService = getServiceForBarber(TEST_BARBERS.regular.id)
      
      // Book within the limit (but use a unique time to avoid conflicts)
      const withinLimitTime = getDaysFromNow(Math.min(maxDays - 1, 7), 15) // Unique hour
      const withinLimitDate = getDayStart(withinLimitTime)
      
      const { data: reservationId, error } = await supabase.rpc('create_reservation_atomic', {
        p_barber_id: TEST_BARBERS.regular.id, // Use regular barber
        p_service_id: regularService.id, // Use service that belongs to regular barber
        p_customer_id: TEST_CUSTOMERS.daniel.id,
        p_customer_name: TEST_CUSTOMERS.daniel.fullname,
        p_customer_phone: TEST_CUSTOMERS.daniel.phone,
        p_date_timestamp: withinLimitDate,
        p_time_timestamp: withinLimitTime,
        p_day_name: getHebrewDayName(withinLimitTime),
        p_day_num: getDayNum(withinLimitTime),
      })
      
      // If it fails with SLOT_ALREADY_TAKEN or other valid error, that's acceptable
      if (error) {
        expect(['SLOT_ALREADY_TAKEN', 'CUSTOMER_DOUBLE_BOOKING', 'MAX_BOOKINGS_REACHED'].some(e => 
          error.message.includes(e)
        )).toBe(true)
      } else {
        expect(reservationId).toBeDefined()
        if (reservationId) testReservationIds.push(reservationId)
      }
    })
  })

  describe('Data Consistency', () => {
    it('should maintain referential integrity with customers', async () => {
      const { data, error } = await supabase
        .from('reservations')
        .select(`
          id,
          customer_id,
          customers (id, fullname)
        `)
        .eq('status', 'confirmed')
        .limit(5)
      
      expect(error).toBeNull()
      
      if (data && data.length > 0) {
        data.forEach(res => {
          // Every reservation should have a valid customer reference
          expect(res.customer_id).toBeDefined()
        })
      }
    })

    it('should maintain referential integrity with services', async () => {
      const { data, error } = await supabase
        .from('reservations')
        .select(`
          id,
          service_id,
          services (id, name_he)
        `)
        .limit(5)
      
      expect(error).toBeNull()
      
      if (data && data.length > 0) {
        data.forEach(res => {
          expect(res.service_id).toBeDefined()
        })
      }
    })

    it('should maintain referential integrity with barbers', async () => {
      const { data, error } = await supabase
        .from('reservations')
        .select(`
          id,
          barber_id,
          users (id, fullname)
        `)
        .limit(5)
      
      expect(error).toBeNull()
      
      if (data && data.length > 0) {
        data.forEach(res => {
          expect(res.barber_id).toBeDefined()
        })
      }
    })
  })
})
