/**
 * Tests for API Validation Schemas
 * 
 * Comprehensive tests for all Zod validation schemas used in API endpoints.
 */

import { describe, it, expect } from 'vitest'
import {
  UUIDSchema,
  PhoneSchema,
  TimestampSchema,
  CreateReservationSchema,
  CancelReservationSchema,
  NotifyBookingSchema,
  NotifyCancellationSchema,
  PushSubscriptionSchema,
  BarberLoginSchema,
  ManualBookingSchema,
  BugReportSchema,
  CustomerAuthSchema,
  validateInput,
} from '@/lib/validation/api-schemas'
import {
  TEST_BARBERS,
  TEST_CUSTOMERS,
  TEST_SERVICES,
  VALID_UUID,
  INVALID_UUID,
  VALID_PHONES,
  INVALID_PHONES,
  getTomorrowAtHour,
  getDayStart,
} from '../../helpers/test-data'

describe('API Validation Schemas', () => {
  // ============================================================
  // UUID Schema Tests
  // ============================================================
  
  describe('UUIDSchema', () => {
    it('should accept valid UUID', () => {
      const result = UUIDSchema.safeParse(VALID_UUID)
      expect(result.success).toBe(true)
    })

    it('should accept lowercase UUID', () => {
      const result = UUIDSchema.safeParse('550e8400-e29b-41d4-a716-446655440001')
      expect(result.success).toBe(true)
    })

    it('should accept uppercase UUID', () => {
      const result = UUIDSchema.safeParse('550E8400-E29B-41D4-A716-446655440001')
      expect(result.success).toBe(true)
    })

    it('should reject invalid UUID format', () => {
      const result = UUIDSchema.safeParse(INVALID_UUID)
      expect(result.success).toBe(false)
    })

    it('should reject empty string', () => {
      const result = UUIDSchema.safeParse('')
      expect(result.success).toBe(false)
    })

    it('should reject null', () => {
      const result = UUIDSchema.safeParse(null)
      expect(result.success).toBe(false)
    })

    it('should reject UUID without dashes', () => {
      const result = UUIDSchema.safeParse('550e8400e29b41d4a716446655440001')
      expect(result.success).toBe(false)
    })
  })

  // ============================================================
  // Phone Schema Tests
  // ============================================================
  
  describe('PhoneSchema', () => {
    it('should accept Israeli 05x format', () => {
      const result = PhoneSchema.safeParse(VALID_PHONES.israeli05x)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBe('0502879998')
      }
    })

    it('should accept +972 format and normalize', () => {
      const result = PhoneSchema.safeParse(VALID_PHONES.israeli972)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBe('972502879998')
      }
    })

    it('should accept 972 format without plus', () => {
      const result = PhoneSchema.safeParse(VALID_PHONES.israeli972NoPlus)
      expect(result.success).toBe(true)
    })

    it('should reject too short phone number', () => {
      const result = PhoneSchema.safeParse(INVALID_PHONES.tooShort)
      expect(result.success).toBe(false)
    })

    it('should reject empty string', () => {
      const result = PhoneSchema.safeParse(INVALID_PHONES.empty)
      expect(result.success).toBe(false)
    })

    it('should reject phone with dashes (regex validates before transform)', () => {
      // The schema validates format before transforming, so dashes aren't allowed
      const result = PhoneSchema.safeParse('050-287-9998')
      expect(result.success).toBe(false)
    })
  })

  // ============================================================
  // Timestamp Schema Tests
  // ============================================================
  
  describe('TimestampSchema', () => {
    it('should accept valid positive integer', () => {
      const result = TimestampSchema.safeParse(Date.now())
      expect(result.success).toBe(true)
    })

    it('should accept future timestamp', () => {
      const result = TimestampSchema.safeParse(getTomorrowAtHour(10))
      expect(result.success).toBe(true)
    })

    it('should reject negative numbers', () => {
      const result = TimestampSchema.safeParse(-1)
      expect(result.success).toBe(false)
    })

    it('should reject zero', () => {
      const result = TimestampSchema.safeParse(0)
      expect(result.success).toBe(false)
    })

    it('should reject floating point numbers', () => {
      const result = TimestampSchema.safeParse(1234567890.5)
      expect(result.success).toBe(false)
    })

    it('should reject strings', () => {
      const result = TimestampSchema.safeParse('1234567890')
      expect(result.success).toBe(false)
    })
  })

  // ============================================================
  // CreateReservation Schema Tests
  // ============================================================
  
  describe('CreateReservationSchema', () => {
    const validData = {
      barberId: TEST_BARBERS.admin.id,
      serviceId: TEST_SERVICES.haircutBeard.id,
      customerId: TEST_CUSTOMERS.daniel.id,
      customerName: TEST_CUSTOMERS.daniel.fullname,
      customerPhone: TEST_CUSTOMERS.daniel.phone,
      dateTimestamp: getDayStart(getTomorrowAtHour(10)),
      timeTimestamp: getTomorrowAtHour(10),
      dayName: 'sunday',
      dayNum: '15',
    }

    it('should accept valid complete data', () => {
      const result = validateInput(CreateReservationSchema, validData)
      expect(result.success).toBe(true)
    })

    it('should reject missing barberId', () => {
      const { barberId: _, ...data } = validData
      const result = validateInput(CreateReservationSchema, data)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('barberId')
      }
    })

    it('should reject missing serviceId', () => {
      const { serviceId: _, ...data } = validData
      const result = validateInput(CreateReservationSchema, data)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('serviceId')
      }
    })

    it('should reject missing customerId', () => {
      const { customerId: _, ...data } = validData
      const result = validateInput(CreateReservationSchema, data)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('customerId')
      }
    })

    it('should reject customerName shorter than 2 characters', () => {
      const data = { ...validData, customerName: 'A' }
      const result = validateInput(CreateReservationSchema, data)
      expect(result.success).toBe(false)
    })

    it('should reject customerName longer than 100 characters', () => {
      const data = { ...validData, customerName: 'A'.repeat(101) }
      const result = validateInput(CreateReservationSchema, data)
      expect(result.success).toBe(false)
    })

    it('should accept customerName with Hebrew characters', () => {
      const data = { ...validData, customerName: 'דניאל לוי' }
      const result = validateInput(CreateReservationSchema, data)
      expect(result.success).toBe(true)
    })

    it('should accept valid phone format and transform digits', () => {
      const data = { ...validData, customerPhone: '+972502879998' }
      const result = validateInput(CreateReservationSchema, data)
      expect(result.success).toBe(true)
      if (result.success) {
        // Transform removes + sign
        expect(result.data.customerPhone).toBe('972502879998')
      }
    })
  })

  // ============================================================
  // CancelReservation Schema Tests
  // ============================================================
  
  describe('CancelReservationSchema', () => {
    it('should accept valid cancellation by customer', () => {
      const data = {
        reservationId: VALID_UUID,
        cancelledBy: 'customer' as const,
      }
      const result = validateInput(CancelReservationSchema, data)
      expect(result.success).toBe(true)
    })

    it('should accept valid cancellation by barber', () => {
      const data = {
        reservationId: VALID_UUID,
        cancelledBy: 'barber' as const,
      }
      const result = validateInput(CancelReservationSchema, data)
      expect(result.success).toBe(true)
    })

    it('should accept optional reason', () => {
      const data = {
        reservationId: VALID_UUID,
        cancelledBy: 'customer' as const,
        reason: 'לא יכול להגיע',
      }
      const result = validateInput(CancelReservationSchema, data)
      expect(result.success).toBe(true)
    })

    it('should accept optional version for optimistic locking', () => {
      const data = {
        reservationId: VALID_UUID,
        cancelledBy: 'customer' as const,
        version: 1,
      }
      const result = validateInput(CancelReservationSchema, data)
      expect(result.success).toBe(true)
    })

    it('should reject invalid cancelledBy value', () => {
      const data = {
        reservationId: VALID_UUID,
        cancelledBy: 'system',
      }
      const result = validateInput(CancelReservationSchema, data)
      expect(result.success).toBe(false)
    })

    it('should reject reason longer than 500 characters', () => {
      const data = {
        reservationId: VALID_UUID,
        cancelledBy: 'customer' as const,
        reason: 'A'.repeat(501),
      }
      const result = validateInput(CancelReservationSchema, data)
      expect(result.success).toBe(false)
    })
  })

  // ============================================================
  // NotifyBooking Schema Tests
  // ============================================================
  
  describe('NotifyBookingSchema', () => {
    const validData = {
      reservationId: VALID_UUID,
      barberId: TEST_BARBERS.admin.id,
      customerName: TEST_CUSTOMERS.daniel.fullname,
      serviceName: TEST_SERVICES.haircutBeard.name_he,
      appointmentTime: getTomorrowAtHour(10),
    }

    it('should accept valid notification data', () => {
      const result = validateInput(NotifyBookingSchema, validData)
      expect(result.success).toBe(true)
    })

    it('should accept optional customerId', () => {
      const data = { ...validData, customerId: TEST_CUSTOMERS.daniel.id }
      const result = validateInput(NotifyBookingSchema, data)
      expect(result.success).toBe(true)
    })

    it('should accept optional barberName', () => {
      const data = { ...validData, barberName: TEST_BARBERS.admin.fullname }
      const result = validateInput(NotifyBookingSchema, data)
      expect(result.success).toBe(true)
    })

    it('should reject missing reservationId', () => {
      const { reservationId: _, ...data } = validData
      const result = validateInput(NotifyBookingSchema, data)
      expect(result.success).toBe(false)
    })

    it('should reject missing barberId', () => {
      const { barberId: _, ...data } = validData
      const result = validateInput(NotifyBookingSchema, data)
      expect(result.success).toBe(false)
    })
  })

  // ============================================================
  // NotifyCancellation Schema Tests
  // ============================================================
  
  describe('NotifyCancellationSchema', () => {
    const validData = {
      reservationId: VALID_UUID,
      barberId: TEST_BARBERS.admin.id,
      cancelledBy: 'customer' as const,
      customerName: TEST_CUSTOMERS.daniel.fullname,
      serviceName: TEST_SERVICES.haircutBeard.name_he,
      appointmentTime: getTomorrowAtHour(10),
    }

    it('should accept valid cancellation notification', () => {
      const result = validateInput(NotifyCancellationSchema, validData)
      expect(result.success).toBe(true)
    })

    it('should accept cancellation by barber', () => {
      const data = { ...validData, cancelledBy: 'barber' as const, customerId: TEST_CUSTOMERS.daniel.id }
      const result = validateInput(NotifyCancellationSchema, data)
      expect(result.success).toBe(true)
    })

    it('should accept optional reason', () => {
      const data = { ...validData, reason: 'בעיה טכנית' }
      const result = validateInput(NotifyCancellationSchema, data)
      expect(result.success).toBe(true)
    })

    it('should reject invalid cancelledBy', () => {
      const data = { ...validData, cancelledBy: 'invalid' }
      const result = validateInput(NotifyCancellationSchema, data)
      expect(result.success).toBe(false)
    })
  })

  // ============================================================
  // PushSubscription Schema Tests
  // ============================================================
  
  describe('PushSubscriptionSchema', () => {
    const validData = {
      subscription: {
        endpoint: 'https://push.example.com/abc123',
        keys: {
          p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM',
          auth: 'tBHItJI5svbpez7KI4CCXg',
        },
      },
      userType: 'customer' as const,
      userId: TEST_CUSTOMERS.daniel.id,
    }

    it('should accept valid subscription data', () => {
      const result = validateInput(PushSubscriptionSchema, validData)
      expect(result.success).toBe(true)
    })

    it('should accept barber user type', () => {
      const data = { ...validData, userType: 'barber' as const, userId: TEST_BARBERS.admin.id }
      const result = validateInput(PushSubscriptionSchema, data)
      expect(result.success).toBe(true)
    })

    it('should reject invalid endpoint URL', () => {
      const data = { ...validData, subscription: { ...validData.subscription, endpoint: 'not-a-url' } }
      const result = validateInput(PushSubscriptionSchema, data)
      expect(result.success).toBe(false)
    })

    it('should reject missing p256dh key', () => {
      const data = { 
        ...validData, 
        subscription: { 
          endpoint: validData.subscription.endpoint,
          keys: { auth: validData.subscription.keys.auth } 
        } 
      }
      const result = validateInput(PushSubscriptionSchema, data as typeof validData)
      expect(result.success).toBe(false)
    })

    it('should reject invalid userType', () => {
      const data = { ...validData, userType: 'admin' }
      const result = validateInput(PushSubscriptionSchema, data)
      expect(result.success).toBe(false)
    })
  })

  // ============================================================
  // BarberLogin Schema Tests
  // ============================================================
  
  describe('BarberLoginSchema', () => {
    it('should accept valid login credentials', () => {
      const data = { username: 'ramel', password: 'password123' }
      const result = validateInput(BarberLoginSchema, data)
      expect(result.success).toBe(true)
    })

    it('should reject username shorter than 3 characters', () => {
      const data = { username: 'ab', password: 'password123' }
      const result = validateInput(BarberLoginSchema, data)
      expect(result.success).toBe(false)
    })

    it('should reject username longer than 50 characters', () => {
      const data = { username: 'a'.repeat(51), password: 'password123' }
      const result = validateInput(BarberLoginSchema, data)
      expect(result.success).toBe(false)
    })

    it('should reject password shorter than 6 characters', () => {
      const data = { username: 'ramel', password: '12345' }
      const result = validateInput(BarberLoginSchema, data)
      expect(result.success).toBe(false)
    })

    it('should reject password longer than 100 characters', () => {
      const data = { username: 'ramel', password: 'p'.repeat(101) }
      const result = validateInput(BarberLoginSchema, data)
      expect(result.success).toBe(false)
    })
  })

  // ============================================================
  // ManualBooking Schema Tests
  // ============================================================
  
  describe('ManualBookingSchema', () => {
    const validData = {
      barberId: TEST_BARBERS.admin.id,
      serviceId: TEST_SERVICES.haircutBeard.id,
      customerName: 'לקוח חדש',
      customerPhone: '0501234567',
      dateTimestamp: getDayStart(getTomorrowAtHour(10)),
      timeTimestamp: getTomorrowAtHour(10),
      dayName: 'sunday',
      dayNum: '15',
    }

    it('should accept valid manual booking data', () => {
      const result = validateInput(ManualBookingSchema, validData)
      expect(result.success).toBe(true)
    })

    it('should not require customerId (walk-in customers)', () => {
      const result = validateInput(ManualBookingSchema, validData)
      expect(result.success).toBe(true)
    })

    it('should reject missing barberId', () => {
      const { barberId: _, ...data } = validData
      const result = validateInput(ManualBookingSchema, data)
      expect(result.success).toBe(false)
    })

    it('should reject invalid phone format', () => {
      const data = { ...validData, customerPhone: 'invalid' }
      const result = validateInput(ManualBookingSchema, data)
      expect(result.success).toBe(false)
    })
  })

  // ============================================================
  // BugReport Schema Tests
  // ============================================================
  
  describe('BugReportSchema', () => {
    it('should accept minimal bug report', () => {
      const data = { error: 'Something went wrong' }
      const result = validateInput(BugReportSchema, data)
      expect(result.success).toBe(true)
    })

    it('should accept complete bug report', () => {
      const data = {
        error: 'TypeError: Cannot read property',
        context: 'Booking flow',
        component: 'BookingWizard',
        userAgent: 'Mozilla/5.0',
        url: 'http://localhost:3000/book',
        timestamp: new Date().toISOString(),
        customerId: TEST_CUSTOMERS.daniel.id,
        customerPhone: TEST_CUSTOMERS.daniel.phone,
        barberId: TEST_BARBERS.admin.id,
        additionalInfo: { step: 3, action: 'submit' },
      }
      const result = validateInput(BugReportSchema, data)
      expect(result.success).toBe(true)
    })

    it('should reject empty error message', () => {
      const data = { error: '' }
      const result = validateInput(BugReportSchema, data)
      expect(result.success).toBe(false)
    })

    it('should reject error longer than 10000 characters', () => {
      const data = { error: 'e'.repeat(10001) }
      const result = validateInput(BugReportSchema, data)
      expect(result.success).toBe(false)
    })

    it('should accept null customerId', () => {
      const data = { error: 'Error', customerId: null }
      const result = validateInput(BugReportSchema, data)
      expect(result.success).toBe(true)
    })
  })

  // ============================================================
  // CustomerAuth Schema Tests
  // ============================================================
  
  describe('CustomerAuthSchema', () => {
    it('should accept valid customer auth data', () => {
      const data = {
        phone: TEST_CUSTOMERS.daniel.phone,
        fullname: TEST_CUSTOMERS.daniel.fullname,
      }
      const result = validateInput(CustomerAuthSchema, data)
      expect(result.success).toBe(true)
    })

    it('should accept optional smsProviderUid', () => {
      const data = {
        phone: TEST_CUSTOMERS.daniel.phone,
        fullname: TEST_CUSTOMERS.daniel.fullname,
        smsProviderUid: 'sms-provider-uid-123',
      }
      const result = validateInput(CustomerAuthSchema, data)
      expect(result.success).toBe(true)
    })

    it('should reject name shorter than 2 characters', () => {
      const data = {
        phone: TEST_CUSTOMERS.daniel.phone,
        fullname: 'A',
      }
      const result = validateInput(CustomerAuthSchema, data)
      expect(result.success).toBe(false)
    })

    it('should accept valid phone and transform +972 prefix', () => {
      const data = {
        phone: '+972502879998',
        fullname: 'Test User',
      }
      const result = validateInput(CustomerAuthSchema, data)
      expect(result.success).toBe(true)
      if (result.success) {
        // Transform removes + sign
        expect(result.data.phone).toBe('972502879998')
      }
    })
  })

  // ============================================================
  // validateInput Helper Tests
  // ============================================================
  
  describe('validateInput helper', () => {
    it('should return success true with parsed data for valid input', () => {
      const result = validateInput(UUIDSchema, VALID_UUID)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBe(VALID_UUID)
      }
    })

    it('should return success false with error message for invalid input', () => {
      const result = validateInput(UUIDSchema, INVALID_UUID)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('Validation failed')
        expect(result.details).toBeInstanceOf(Array)
      }
    })

    it('should include path in error message', () => {
      const schema = CreateReservationSchema
      const result = validateInput(schema, { barberId: 'invalid' })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('barberId')
      }
    })
  })
})
