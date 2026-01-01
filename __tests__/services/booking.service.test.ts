/**
 * Tests for Booking Service
 * 
 * Comprehensive tests for the centralized booking service including
 * validation, error handling, and business logic.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  createReservation,
  cancelReservation,
  checkSlotAvailability,
  checkCustomerEligibility,
  getReservationById,
  type CreateReservationData,
  type BookingErrorCode,
} from '@/lib/services/booking.service'
import {
  TEST_BARBERS,
  TEST_CUSTOMERS,
  TEST_SERVICES,
  INVALID_UUID,
  getTomorrowAtHour,
  getDayStart,
  getHebrewDayName,
  getDayNum,
  createTestReservationData,
} from '../helpers/test-data'

// Mock Supabase client
const mockRpc = vi.fn()
const mockFrom = vi.fn()
const mockSelect = vi.fn()
const mockEq = vi.fn()
const mockGt = vi.fn()
const mockUpdate = vi.fn()
const mockMaybeSingle = vi.fn()
const mockSingle = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    rpc: mockRpc,
    from: mockFrom,
  }),
}))

vi.mock('@/lib/bug-reporter/helpers', () => ({
  reportSupabaseError: vi.fn(),
}))

describe('Booking Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Setup default mock chain for from queries
    mockFrom.mockReturnValue({
      select: mockSelect,
      update: mockUpdate,
    })
    
    mockSelect.mockReturnValue({
      eq: mockEq,
      gt: mockGt,
      maybeSingle: mockMaybeSingle,
      single: mockSingle,
    })
    
    mockUpdate.mockReturnValue({
      eq: mockEq,
      select: mockSelect,
    })
    
    mockEq.mockReturnValue({
      eq: mockEq,
      gt: mockGt,
      select: mockSelect,
      maybeSingle: mockMaybeSingle,
      single: mockSingle,
    })
    
    mockGt.mockReturnValue({
      eq: mockEq,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ============================================================
  // createReservation - Validation Tests
  // ============================================================

  describe('createReservation - Validation', () => {
    it('should reject missing barberId', async () => {
      const data = createTestReservationData({ barberId: '' })
      const result = await createReservation(data)
      
      expect(result.success).toBe(false)
      expect(result.error).toBe('VALIDATION_ERROR')
    })

    it('should reject invalid barberId UUID', async () => {
      const data = createTestReservationData({ barberId: INVALID_UUID })
      const result = await createReservation(data)
      
      expect(result.success).toBe(false)
      expect(result.error).toBe('VALIDATION_ERROR')
    })

    it('should reject missing serviceId', async () => {
      const data = createTestReservationData({ serviceId: '' })
      const result = await createReservation(data)
      
      expect(result.success).toBe(false)
      expect(result.error).toBe('VALIDATION_ERROR')
    })

    it('should reject invalid serviceId UUID', async () => {
      const data = createTestReservationData({ serviceId: INVALID_UUID })
      const result = await createReservation(data)
      
      expect(result.success).toBe(false)
      expect(result.error).toBe('VALIDATION_ERROR')
    })

    it('should reject missing customerId', async () => {
      const data = createTestReservationData({ customerId: '' })
      const result = await createReservation(data)
      
      expect(result.success).toBe(false)
      expect(result.error).toBe('VALIDATION_ERROR')
    })

    it('should reject invalid customerId UUID', async () => {
      const data = createTestReservationData({ customerId: INVALID_UUID })
      const result = await createReservation(data)
      
      expect(result.success).toBe(false)
      expect(result.error).toBe('VALIDATION_ERROR')
    })

    it('should reject missing customerName', async () => {
      const data = createTestReservationData({ customerName: '' })
      const result = await createReservation(data)
      
      expect(result.success).toBe(false)
      expect(result.error).toBe('VALIDATION_ERROR')
    })

    it('should reject missing customerPhone', async () => {
      const data = createTestReservationData({ customerPhone: '' })
      const result = await createReservation(data)
      
      expect(result.success).toBe(false)
      expect(result.error).toBe('VALIDATION_ERROR')
    })

    it('should reject missing dateTimestamp', async () => {
      const data = createTestReservationData()
      // @ts-expect-error - testing invalid input
      data.dateTimestamp = null
      const result = await createReservation(data)
      
      expect(result.success).toBe(false)
      expect(result.error).toBe('VALIDATION_ERROR')
    })

    it('should reject missing timeTimestamp', async () => {
      const data = createTestReservationData()
      // @ts-expect-error - testing invalid input
      data.timeTimestamp = null
      const result = await createReservation(data)
      
      expect(result.success).toBe(false)
      expect(result.error).toBe('VALIDATION_ERROR')
    })

    it('should reject missing dayName', async () => {
      const data = createTestReservationData({ dayName: '' })
      const result = await createReservation(data)
      
      expect(result.success).toBe(false)
      expect(result.error).toBe('VALIDATION_ERROR')
    })

    it('should reject missing dayNum', async () => {
      const data = createTestReservationData({ dayNum: '' })
      const result = await createReservation(data)
      
      expect(result.success).toBe(false)
      expect(result.error).toBe('VALIDATION_ERROR')
    })
  })

  // ============================================================
  // createReservation - Success Cases
  // ============================================================

  describe('createReservation - Success Cases', () => {
    it('should create reservation successfully with valid data', async () => {
      const reservationId = 'new-reservation-uuid'
      mockRpc.mockResolvedValue({ data: reservationId, error: null })
      
      const data = createTestReservationData()
      const result = await createReservation(data)
      
      expect(result.success).toBe(true)
      expect(result.reservationId).toBe(reservationId)
      expect(mockRpc).toHaveBeenCalledWith('create_reservation_atomic', expect.objectContaining({
        p_barber_id: data.barberId,
        p_service_id: data.serviceId,
        p_customer_id: data.customerId,
      }))
    })

    it('should normalize phone number by removing non-digits', async () => {
      const reservationId = 'new-reservation-uuid'
      mockRpc.mockResolvedValue({ data: reservationId, error: null })
      
      const data = createTestReservationData({ customerPhone: '050-287-9998' })
      await createReservation(data)
      
      expect(mockRpc).toHaveBeenCalledWith('create_reservation_atomic', expect.objectContaining({
        p_customer_phone: '0502879998',
      }))
    })

    it('should trim customer name', async () => {
      const reservationId = 'new-reservation-uuid'
      mockRpc.mockResolvedValue({ data: reservationId, error: null })
      
      const data = createTestReservationData({ customerName: '  דניאל לוי  ' })
      await createReservation(data)
      
      expect(mockRpc).toHaveBeenCalledWith('create_reservation_atomic', expect.objectContaining({
        p_customer_name: 'דניאל לוי',
      }))
    })
  })

  // ============================================================
  // createReservation - Error Handling
  // ============================================================

  describe('createReservation - Error Handling', () => {
    const errorCodes: Array<{ dbError: string; expectedCode: BookingErrorCode }> = [
      { dbError: 'SLOT_ALREADY_TAKEN', expectedCode: 'SLOT_ALREADY_TAKEN' },
      { dbError: 'CUSTOMER_BLOCKED', expectedCode: 'CUSTOMER_BLOCKED' },
      { dbError: 'CUSTOMER_DOUBLE_BOOKING', expectedCode: 'CUSTOMER_DOUBLE_BOOKING' },
      { dbError: 'MAX_BOOKINGS_REACHED', expectedCode: 'MAX_BOOKINGS_REACHED' },
      { dbError: 'DATE_OUT_OF_RANGE', expectedCode: 'DATE_OUT_OF_RANGE' },
    ]

    errorCodes.forEach(({ dbError, expectedCode }) => {
      it(`should parse ${dbError} error correctly`, async () => {
        mockRpc.mockResolvedValue({ 
          data: null, 
          error: { message: `Error: ${dbError}` } 
        })
        
        const data = createTestReservationData()
        const result = await createReservation(data)
        
        expect(result.success).toBe(false)
        expect(result.error).toBe(expectedCode)
        expect(result.message).toBeDefined()
      })
    })

    it('should handle unique constraint violation for slot', async () => {
      mockRpc.mockResolvedValue({ 
        data: null, 
        error: { 
          code: '23505',
          message: 'violates unique constraint "idx_unique_confirmed_booking"' 
        } 
      })
      
      const data = createTestReservationData()
      const result = await createReservation(data)
      
      expect(result.success).toBe(false)
      expect(result.error).toBe('SLOT_ALREADY_TAKEN')
    })

    it('should handle unique constraint violation for double booking', async () => {
      mockRpc.mockResolvedValue({ 
        data: null, 
        error: { 
          code: '23505',
          message: 'violates unique constraint "idx_customer_no_double_booking"' 
        } 
      })
      
      const data = createTestReservationData()
      const result = await createReservation(data)
      
      expect(result.success).toBe(false)
      expect(result.error).toBe('CUSTOMER_DOUBLE_BOOKING')
    })

    it('should return DATABASE_ERROR for unknown errors', async () => {
      mockRpc.mockResolvedValue({ 
        data: null, 
        error: { message: 'Unknown database error' } 
      })
      
      const data = createTestReservationData()
      const result = await createReservation(data)
      
      expect(result.success).toBe(false)
      expect(result.error).toBe('DATABASE_ERROR')
    })

    it('should return UNKNOWN_ERROR for exceptions', async () => {
      mockRpc.mockRejectedValue(new Error('Network error'))
      
      const data = createTestReservationData()
      const result = await createReservation(data)
      
      expect(result.success).toBe(false)
      expect(result.error).toBe('UNKNOWN_ERROR')
    })
  })

  // ============================================================
  // cancelReservation Tests (validation only - complex DB mocking in integration tests)
  // ============================================================

  describe('cancelReservation', () => {
    it('should reject invalid reservation ID', async () => {
      const result = await cancelReservation(INVALID_UUID, 'customer')
      
      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid reservation ID')
    })

    it('should reject empty reservation ID', async () => {
      const result = await cancelReservation('', 'customer')
      
      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid reservation ID')
    })

    // Note: Complex Supabase chained calls are tested in integration tests
  })

  // ============================================================
  // checkSlotAvailability Tests
  // ============================================================

  describe('checkSlotAvailability', () => {
    it('should reject invalid barber ID', async () => {
      const result = await checkSlotAvailability(INVALID_UUID, Date.now())
      
      expect(result.available).toBe(false)
      expect(result.error).toBe('Invalid barber ID')
    })

    it('should return available true when slot is free', async () => {
      mockMaybeSingle.mockResolvedValue({ data: null, error: null })
      
      const result = await checkSlotAvailability(TEST_BARBERS.admin.id, getTomorrowAtHour(10))
      
      expect(result.available).toBe(true)
    })

    it('should return available false when slot is taken', async () => {
      mockMaybeSingle.mockResolvedValue({ 
        data: { id: 'existing-reservation' }, 
        error: null 
      })
      
      const result = await checkSlotAvailability(TEST_BARBERS.admin.id, getTomorrowAtHour(10))
      
      expect(result.available).toBe(false)
    })

    it('should handle database errors', async () => {
      mockMaybeSingle.mockResolvedValue({ 
        data: null, 
        error: { message: 'DB Error' } 
      })
      
      const result = await checkSlotAvailability(TEST_BARBERS.admin.id, getTomorrowAtHour(10))
      
      expect(result.available).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  // ============================================================
  // checkCustomerEligibility Tests (validation only - complex DB mocking in integration tests)
  // ============================================================

  describe('checkCustomerEligibility', () => {
    it('should reject invalid customer ID', async () => {
      const result = await checkCustomerEligibility(INVALID_UUID)
      
      expect(result.eligible).toBe(false)
      expect(result.error).toBe('Invalid customer ID')
    })

    it('should reject empty customer ID', async () => {
      const result = await checkCustomerEligibility('')
      
      expect(result.eligible).toBe(false)
      expect(result.error).toBe('Invalid customer ID')
    })

    it('should return default limits structure on error', async () => {
      const result = await checkCustomerEligibility(INVALID_UUID)
      
      expect(result.limits).toBeDefined()
      expect(result.limits.maxConcurrentBookings).toBe(5)
      expect(result.limits.maxDailyBookings).toBe(2)
    })

    // Note: Complex Supabase chained calls are tested in integration tests
  })

  // ============================================================
  // getReservationById Tests
  // ============================================================

  describe('getReservationById', () => {
    it('should return null for invalid ID', async () => {
      const result = await getReservationById(INVALID_UUID)
      
      expect(result).toBeNull()
    })

    it('should return null for empty ID', async () => {
      const result = await getReservationById('')
      
      expect(result).toBeNull()
    })

    it('should return reservation data when found', async () => {
      const mockReservation = {
        id: TEST_BARBERS.admin.id,
        barber_id: TEST_BARBERS.admin.id,
        customer_name: 'דניאל לוי',
        status: 'confirmed',
      }
      
      mockSingle.mockResolvedValue({ data: mockReservation, error: null })
      
      const result = await getReservationById(TEST_BARBERS.admin.id)
      
      expect(result).toEqual(mockReservation)
    })

    it('should return null when reservation not found', async () => {
      mockSingle.mockResolvedValue({ 
        data: null, 
        error: { message: 'Not found' } 
      })
      
      const result = await getReservationById(TEST_BARBERS.admin.id)
      
      expect(result).toBeNull()
    })
  })

  // ============================================================
  // Error Messages Tests
  // ============================================================

  describe('Error Messages', () => {
    const errorMessages: Array<{ code: BookingErrorCode; expectedHebrew: string }> = [
      { code: 'SLOT_ALREADY_TAKEN', expectedHebrew: 'השעה כבר נתפסה' },
      { code: 'CUSTOMER_BLOCKED', expectedHebrew: 'לא ניתן לקבוע תור' },
      { code: 'CUSTOMER_DOUBLE_BOOKING', expectedHebrew: 'כבר יש לך תור' },
      { code: 'MAX_BOOKINGS_REACHED', expectedHebrew: 'מקסימום התורים' },
      { code: 'DATE_OUT_OF_RANGE', expectedHebrew: 'התאריך שנבחר חורג' },
      { code: 'VALIDATION_ERROR', expectedHebrew: 'חסרים נתונים' },
      { code: 'DATABASE_ERROR', expectedHebrew: 'שגיאה ביצירת' },
    ]

    errorMessages.forEach(({ code, expectedHebrew }) => {
      it(`should return Hebrew message for ${code}`, async () => {
        if (code === 'VALIDATION_ERROR') {
          const data = createTestReservationData({ barberId: '' })
          const result = await createReservation(data)
          expect(result.message).toContain(expectedHebrew)
        } else {
          mockRpc.mockResolvedValue({ 
            data: null, 
            error: { message: code === 'DATABASE_ERROR' ? 'unknown' : code } 
          })
          
          const data = createTestReservationData()
          const result = await createReservation(data)
          expect(result.message).toContain(expectedHebrew)
        }
      })
    })
  })
})
