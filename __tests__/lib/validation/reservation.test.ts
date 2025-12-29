/**
 * Tests for lib/validation/reservation.ts
 * 
 * Tests reservation data validation utilities that ensure
 * data integrity before database operations.
 */

import { describe, it, expect } from 'vitest'
import {
  validateReservationData,
  validateLoggedInReservation,
  hasCustomerId,
  hasBarberId,
} from '@/lib/validation/reservation'

// Valid UUIDs for testing
const VALID_UUID = '550e8400-e29b-41d4-a716-446655440001'
const VALID_UUID_2 = 'd2f078fd-c497-40f5-824d-7fe0ef4b2d25'
const VALID_UUID_3 = '6e0526f0-9e6b-4603-bb7f-e975f046b261'

describe('Reservation Validation', () => {
  describe('validateReservationData', () => {
    // ALL bookings require login - customer_id is ALWAYS required
    const validData = {
      barber_id: VALID_UUID,
      service_id: VALID_UUID_2,
      customer_id: VALID_UUID_3,  // Required - no guest bookings
      customer_name: 'דניאל לוי',
      customer_phone: '0501234567',
      date_timestamp: Date.now(),
      time_timestamp: Date.now() + 3600000,
      day_name: 'ראשון',
      day_num: '29',
    }

    it('should pass validation for valid data', () => {
      const result = validateReservationData(validData)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
      expect(result.data).toBeDefined()
    })

    it('should fail validation for missing barber_id', () => {
      const data = { ...validData, barber_id: '' }
      const result = validateReservationData(data)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('barber_id is required')
    })

    it('should fail validation for missing service_id', () => {
      const data = { ...validData, service_id: '' }
      const result = validateReservationData(data)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('service_id is required')
    })

    it('should fail validation for missing customer_name', () => {
      const data = { ...validData, customer_name: '' }
      const result = validateReservationData(data)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('customer_name is required')
    })

    it('should fail validation for missing customer_phone', () => {
      const data = { ...validData, customer_phone: '' }
      const result = validateReservationData(data)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('customer_phone is required')
    })

    it('should fail validation for invalid date_timestamp', () => {
      const data = { ...validData, date_timestamp: undefined }
      const result = validateReservationData(data)
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('date_timestamp'))).toBe(true)
    })

    it('should fail validation for invalid time_timestamp', () => {
      const data = { ...validData, time_timestamp: 'invalid' as unknown as number }
      const result = validateReservationData(data)
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('time_timestamp'))).toBe(true)
    })

    it('should fail validation for missing day_name', () => {
      const data = { ...validData, day_name: '' }
      const result = validateReservationData(data)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('day_name is required')
    })

    it('should fail validation for missing day_num', () => {
      const data = { ...validData, day_num: '' }
      const result = validateReservationData(data)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('day_num is required')
    })

    it('should fail validation for invalid barber_id UUID format', () => {
      const data = { ...validData, barber_id: 'invalid-uuid' }
      const result = validateReservationData(data)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('barber_id must be a valid UUID')
    })

    it('should fail validation for invalid service_id UUID format', () => {
      const data = { ...validData, service_id: 'not-a-uuid' }
      const result = validateReservationData(data)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('service_id must be a valid UUID')
    })

    it('should fail validation for invalid customer_id UUID format', () => {
      const data = { ...validData, customer_id: 'bad-id' }
      const result = validateReservationData(data)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('customer_id must be a valid UUID')
    })

    it('should fail validation for missing customer_id (no guest bookings)', () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { customer_id, ...dataWithoutCustomerId } = validData
      const result = validateReservationData(dataWithoutCustomerId)
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('customer_id is required'))).toBe(true)
    })

    it('should fail validation for empty customer_id', () => {
      const data = { ...validData, customer_id: '' }
      const result = validateReservationData(data)
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('customer_id is required'))).toBe(true)
    })

    it('should pass validation with valid customer_id', () => {
      const result = validateReservationData(validData)
      expect(result.valid).toBe(true)
      expect(result.data?.customer_id).toBe(VALID_UUID_3)
    })

    it('should default status to confirmed', () => {
      const result = validateReservationData(validData)
      expect(result.data?.status).toBe('confirmed')
    })

    it('should accept custom status', () => {
      const data = { ...validData, status: 'cancelled' as const }
      const result = validateReservationData(data)
      expect(result.data?.status).toBe('cancelled')
    })

    it('should report multiple errors at once', () => {
      const data = {
        barber_id: '',
        service_id: '',
        customer_name: '',
        customer_phone: '',
      }
      const result = validateReservationData(data)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(1)
    })
  })

  describe('validateLoggedInReservation', () => {
    // validateLoggedInReservation is now an alias for validateReservationData
    // since ALL bookings require login (no guest bookings)
    const validLoggedInData = {
      barber_id: VALID_UUID,
      service_id: VALID_UUID_2,
      customer_id: VALID_UUID_3,
      customer_name: 'דניאל לוי',
      customer_phone: '0501234567',
      date_timestamp: Date.now(),
      time_timestamp: Date.now() + 3600000,
      day_name: 'ראשון',
      day_num: '29',
    }

    it('should pass validation for logged-in user with customer_id', () => {
      const result = validateLoggedInReservation(validLoggedInData)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should fail validation for empty customer_id', () => {
      const data = { ...validLoggedInData, customer_id: '' }
      const result = validateLoggedInReservation(data)
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('customer_id is required'))).toBe(true)
    })

    it('should be the same function as validateReservationData', () => {
      // Confirms they are the same (alias)
      expect(validateLoggedInReservation).toBe(validateReservationData)
    })

    it('should still validate base fields', () => {
      const data = { ...validLoggedInData, barber_id: '' }
      const result = validateLoggedInReservation(data)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('barber_id is required')
    })
  })

  describe('hasCustomerId type guard', () => {
    it('should return true for object with valid customer_id', () => {
      const reservation = { customer_id: VALID_UUID }
      expect(hasCustomerId(reservation)).toBe(true)
    })

    it('should return false for object with null customer_id', () => {
      const reservation = { customer_id: null }
      expect(hasCustomerId(reservation)).toBe(false)
    })

    it('should return false for object with undefined customer_id', () => {
      const reservation = { customer_id: undefined }
      expect(hasCustomerId(reservation)).toBe(false)
    })

    it('should return false for object with empty string customer_id', () => {
      const reservation = { customer_id: '' }
      expect(hasCustomerId(reservation)).toBe(false)
    })

    it('should narrow type correctly', () => {
      const reservation: { customer_id?: string | null; name: string } = {
        customer_id: VALID_UUID,
        name: 'Test',
      }
      if (hasCustomerId(reservation)) {
        // TypeScript should know customer_id is string here
        const id: string = reservation.customer_id
        expect(id).toBe(VALID_UUID)
      }
    })
  })

  describe('hasBarberId type guard', () => {
    it('should return true for object with valid barber_id', () => {
      const reservation = { barber_id: VALID_UUID }
      expect(hasBarberId(reservation)).toBe(true)
    })

    it('should return false for object with null barber_id', () => {
      const reservation = { barber_id: null }
      expect(hasBarberId(reservation)).toBe(false)
    })

    it('should return false for object with undefined barber_id', () => {
      const reservation = { barber_id: undefined }
      expect(hasBarberId(reservation)).toBe(false)
    })

    it('should return false for object with empty string barber_id', () => {
      const reservation = { barber_id: '' }
      expect(hasBarberId(reservation)).toBe(false)
    })
  })
})

