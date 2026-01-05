/**
 * Centralized Booking Service
 * 
 * Single source of truth for all booking operations.
 * Uses database-level atomic functions for race condition prevention.
 * Provides comprehensive error handling and logging.
 */

import { createClient } from '@/lib/supabase/client'
import { reportSupabaseError } from '@/lib/bug-reporter/helpers'
import type { ReservationInsert } from '@/types/database'

// ============================================================
// Types
// ============================================================

export interface CreateReservationData {
  barberId: string
  serviceId: string
  customerId: string
  customerName: string
  customerPhone: string
  dateTimestamp: number
  timeTimestamp: number
  dayName: string
  dayNum: string
}

export interface CreateReservationResult {
  success: boolean
  reservationId?: string
  error?: BookingErrorCode
  message?: string
}

export interface CancelReservationResult {
  success: boolean
  error?: string
  concurrencyConflict?: boolean
}

export type BookingErrorCode =
  | 'SLOT_ALREADY_TAKEN'
  | 'CUSTOMER_BLOCKED'
  | 'CUSTOMER_DOUBLE_BOOKING'
  | 'MAX_BOOKINGS_REACHED'
  | 'DATE_OUT_OF_RANGE'
  | 'BARBER_PAUSED'
  | 'VALIDATION_ERROR'
  | 'DATABASE_ERROR'
  | 'UNKNOWN_ERROR'

export interface BookingLimits {
  maxConcurrentBookings: number
  maxDailyBookings: number
  hasReachedLimit: boolean
  currentFutureBookings: number
  message?: string
}

// ============================================================
// Error Messages (Hebrew)
// ============================================================

const ERROR_MESSAGES: Record<BookingErrorCode, string> = {
  SLOT_ALREADY_TAKEN: 'השעה כבר נתפסה. אנא בחר שעה אחרת.',
  CUSTOMER_BLOCKED: 'לא ניתן לקבוע תור. אנא פנה לצוות המספרה.',
  CUSTOMER_DOUBLE_BOOKING: 'כבר יש לך תור בשעה זו.',
  MAX_BOOKINGS_REACHED: 'הגעת למקסימום התורים המותרים. בטל תור קיים כדי לקבוע חדש.',
  DATE_OUT_OF_RANGE: 'התאריך שנבחר חורג מטווח ההזמנות המותר.',
  BARBER_PAUSED: 'הספר אינו זמין כרגע לקביעת תורים.',
  VALIDATION_ERROR: 'חסרים נתונים ליצירת התור.',
  DATABASE_ERROR: 'שגיאה ביצירת התור. נסה שוב.',
  UNKNOWN_ERROR: 'שגיאה בלתי צפויה. נסה שוב.',
}

// ============================================================
// UUID Validation
// ============================================================

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const isValidUUID = (value: string): boolean => {
  return UUID_REGEX.test(value)
}

// ============================================================
// Booking Service
// ============================================================

/**
 * Create a reservation using the atomic database function
 * This guarantees no race conditions or duplicate bookings
 */
export async function createReservation(
  data: CreateReservationData
): Promise<CreateReservationResult> {
  // Validate all required fields
  const validationErrors: string[] = []
  
  if (!data.barberId?.trim() || !isValidUUID(data.barberId)) {
    validationErrors.push('barberId is required and must be a valid UUID')
  }
  if (!data.serviceId?.trim() || !isValidUUID(data.serviceId)) {
    validationErrors.push('serviceId is required and must be a valid UUID')
  }
  if (!data.customerId?.trim() || !isValidUUID(data.customerId)) {
    validationErrors.push('customerId is required and must be a valid UUID')
  }
  if (!data.customerName?.trim()) {
    validationErrors.push('customerName is required')
  }
  if (!data.customerPhone?.trim()) {
    validationErrors.push('customerPhone is required')
  }
  if (!data.dateTimestamp || typeof data.dateTimestamp !== 'number') {
    validationErrors.push('dateTimestamp is required')
  }
  if (!data.timeTimestamp || typeof data.timeTimestamp !== 'number') {
    validationErrors.push('timeTimestamp is required')
  }
  if (!data.dayName?.trim()) {
    validationErrors.push('dayName is required')
  }
  if (!data.dayNum?.trim()) {
    validationErrors.push('dayNum is required')
  }
  
  if (validationErrors.length > 0) {
    console.error('[BookingService] Validation failed:', validationErrors)
    return {
      success: false,
      error: 'VALIDATION_ERROR',
      message: ERROR_MESSAGES.VALIDATION_ERROR,
    }
  }
  
  try {
    const supabase = createClient()
    
    // Call the atomic database function
    const { data: result, error } = await supabase.rpc('create_reservation_atomic', {
      p_barber_id: data.barberId,
      p_service_id: data.serviceId,
      p_customer_id: data.customerId,
      p_customer_name: data.customerName.trim(),
      p_customer_phone: data.customerPhone.replace(/\D/g, ''),
      p_date_timestamp: data.dateTimestamp,
      p_time_timestamp: data.timeTimestamp,
      p_day_name: data.dayName,
      p_day_num: data.dayNum,
    })
    
    if (error) {
      console.error('[BookingService] Database error:', error)
      
      // Parse specific error codes from database
      const errorCode = parseBookingError(error.message)
      
      if (errorCode !== 'DATABASE_ERROR') {
        // Known business logic error
        return {
          success: false,
          error: errorCode,
          message: ERROR_MESSAGES[errorCode],
        }
      }
      
      // Handle unique constraint violation (backup for race condition)
      if (error.code === '23505') {
        if (error.message.includes('idx_unique_confirmed_booking')) {
          return {
            success: false,
            error: 'SLOT_ALREADY_TAKEN',
            message: ERROR_MESSAGES.SLOT_ALREADY_TAKEN,
          }
        }
        if (error.message.includes('idx_customer_no_double_booking')) {
          return {
            success: false,
            error: 'CUSTOMER_DOUBLE_BOOKING',
            message: ERROR_MESSAGES.CUSTOMER_DOUBLE_BOOKING,
          }
        }
      }
      
      await reportSupabaseError(error, 'Creating reservation via atomic function', {
        table: 'reservations',
        operation: 'rpc',
      })
      
      return {
        success: false,
        error: 'DATABASE_ERROR',
        message: ERROR_MESSAGES.DATABASE_ERROR,
      }
    }
    
    console.log('[BookingService] Reservation created successfully:', result)
    
    return {
      success: true,
      reservationId: result as string,
    }
  } catch (err) {
    console.error('[BookingService] Unexpected error:', err)
    // Report unexpected errors (not already reported DB errors)
    await reportSupabaseError(
      { message: err instanceof Error ? err.message : String(err), code: 'BOOKING_EXCEPTION' },
      'Creating reservation - unexpected error',
      { table: 'reservations', operation: 'rpc' }
    )
    return {
      success: false,
      error: 'UNKNOWN_ERROR',
      message: ERROR_MESSAGES.UNKNOWN_ERROR,
    }
  }
}

/**
 * Cancel a reservation with optimistic locking
 */
export async function cancelReservation(
  reservationId: string,
  cancelledBy: 'customer' | 'barber',
  reason?: string,
  expectedVersion?: number
): Promise<CancelReservationResult> {
  if (!reservationId || !isValidUUID(reservationId)) {
    return { success: false, error: 'Invalid reservation ID' }
  }
  
  try {
    const supabase = createClient()
    
    // Build update query with optimistic locking if version provided
    let query = supabase
      .from('reservations')
      .update({
        status: 'cancelled',
        cancelled_by: cancelledBy,
        cancellation_reason: reason || null,
      })
      .eq('id', reservationId)
      .eq('status', 'confirmed') // Only cancel if still confirmed
    
    // Add version check for optimistic locking
    if (expectedVersion !== undefined) {
      query = query.eq('version', expectedVersion)
    }
    
    const { data, error } = await query.select('id, status, version')
    
    if (error) {
      console.error('[BookingService] Cancel error:', error)
      await reportSupabaseError(error, 'Cancelling reservation', {
        table: 'reservations',
        operation: 'update',
      })
      return { success: false, error: 'שגיאה בביטול התור' }
    }
    
    if (!data || data.length === 0) {
      // No rows updated - either already cancelled or version mismatch
      console.warn('[BookingService] Cancel failed - concurrent modification or already cancelled')
      return {
        success: false,
        error: 'התור כבר בוטל או עודכן על ידי אחר',
        concurrencyConflict: true,
      }
    }
    
    console.log('[BookingService] Reservation cancelled:', reservationId)
    return { success: true }
  } catch (err) {
    console.error('[BookingService] Cancel exception:', err)
    await reportSupabaseError(
      { message: err instanceof Error ? err.message : String(err), code: 'CANCEL_EXCEPTION' },
      'Cancelling reservation - unexpected error',
      { table: 'reservations', operation: 'update' }
    )
    return { success: false, error: 'שגיאה בלתי צפויה בביטול התור' }
  }
}

/**
 * Check if a time slot is available for booking
 */
export async function checkSlotAvailability(
  barberId: string,
  timeTimestamp: number
): Promise<{ available: boolean; error?: string }> {
  if (!barberId || !isValidUUID(barberId)) {
    return { available: false, error: 'Invalid barber ID' }
  }
  
  try {
    const supabase = createClient()
    
    const { data, error } = await supabase
      .from('reservations')
      .select('id')
      .eq('barber_id', barberId)
      .eq('time_timestamp', timeTimestamp)
      .eq('status', 'confirmed')
      .maybeSingle()
    
    if (error) {
      console.error('[BookingService] Slot check error:', error)
      return { available: false, error: 'שגיאה בבדיקת זמינות' }
    }
    
    return { available: data === null }
  } catch (err) {
    console.error('[BookingService] Slot check exception:', err)
    return { available: false, error: 'שגיאה בבדיקת זמינות' }
  }
}

/**
 * Check customer eligibility for booking (blocked status, limits)
 */
export async function checkCustomerEligibility(
  customerId: string
): Promise<{
  eligible: boolean
  isBlocked: boolean
  limits: BookingLimits
  error?: string
}> {
  if (!customerId || !isValidUUID(customerId)) {
    return {
      eligible: false,
      isBlocked: false,
      limits: {
        maxConcurrentBookings: 5,
        maxDailyBookings: 2,
        hasReachedLimit: false,
        currentFutureBookings: 0,
      },
      error: 'Invalid customer ID',
    }
  }
  
  try {
    const supabase = createClient()
    const now = Date.now()
    
    // Check if customer is blocked
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('is_blocked')
      .eq('id', customerId)
      .single()
    
    if (customerError) {
      console.error('[BookingService] Customer check error:', customerError)
      return {
        eligible: false,
        isBlocked: false,
        limits: {
          maxConcurrentBookings: 5,
          maxDailyBookings: 2,
          hasReachedLimit: false,
          currentFutureBookings: 0,
        },
        error: 'שגיאה בבדיקת לקוח',
      }
    }
    
    if (customer?.is_blocked) {
      return {
        eligible: false,
        isBlocked: true,
        limits: {
          maxConcurrentBookings: 5,
          maxDailyBookings: 2,
          hasReachedLimit: false,
          currentFutureBookings: 0,
          message: 'החשבון שלך חסום. אנא פנה לצוות המספרה.',
        },
      }
    }
    
    // Count future bookings
    const { count: futureBookingsCount, error: countError } = await supabase
      .from('reservations')
      .select('*', { count: 'exact', head: true })
      .eq('customer_id', customerId)
      .eq('status', 'confirmed')
      .gt('time_timestamp', now)
    
    if (countError) {
      console.error('[BookingService] Booking count error:', countError)
    }
    
    const currentCount = futureBookingsCount || 0
    const maxBookings = 5
    const hasReachedLimit = currentCount >= maxBookings
    
    return {
      eligible: !hasReachedLimit,
      isBlocked: false,
      limits: {
        maxConcurrentBookings: maxBookings,
        maxDailyBookings: 2,
        hasReachedLimit,
        currentFutureBookings: currentCount,
        message: hasReachedLimit
          ? `הגעת למקסימום ${maxBookings} תורים עתידיים. בטל תור קיים כדי לקבוע חדש.`
          : undefined,
      },
    }
  } catch (err) {
    console.error('[BookingService] Eligibility check exception:', err)
    return {
      eligible: false,
      isBlocked: false,
      limits: {
        maxConcurrentBookings: 5,
        maxDailyBookings: 2,
        hasReachedLimit: false,
        currentFutureBookings: 0,
      },
      error: 'שגיאה בלתי צפויה',
    }
  }
}

/**
 * Get a reservation by ID (for verification/display)
 */
export async function getReservationById(reservationId: string) {
  if (!reservationId || !isValidUUID(reservationId)) {
    return null
  }
  
  try {
    const supabase = createClient()
    
    const { data, error } = await supabase
      .from('reservations')
      .select(`
        id,
        barber_id,
        service_id,
        customer_id,
        customer_name,
        customer_phone,
        date_timestamp,
        time_timestamp,
        day_name,
        day_num,
        status,
        version,
        created_at,
        cancelled_by,
        cancellation_reason,
        services (id, name_he, price, duration),
        users (id, fullname)
      `)
      .eq('id', reservationId)
      .single()
    
    if (error) {
      console.error('[BookingService] Get reservation error:', error)
      return null
    }
    
    return data
  } catch (err) {
    console.error('[BookingService] Get reservation exception:', err)
    return null
  }
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * Parse database error messages to determine booking error code
 */
function parseBookingError(errorMessage: string): BookingErrorCode {
  if (errorMessage.includes('SLOT_ALREADY_TAKEN')) {
    return 'SLOT_ALREADY_TAKEN'
  }
  if (errorMessage.includes('CUSTOMER_BLOCKED')) {
    return 'CUSTOMER_BLOCKED'
  }
  if (errorMessage.includes('CUSTOMER_DOUBLE_BOOKING')) {
    return 'CUSTOMER_DOUBLE_BOOKING'
  }
  if (errorMessage.includes('MAX_BOOKINGS_REACHED')) {
    return 'MAX_BOOKINGS_REACHED'
  }
  if (errorMessage.includes('DATE_OUT_OF_RANGE')) {
    return 'DATE_OUT_OF_RANGE'
  }
  if (errorMessage.includes('BARBER_PAUSED')) {
    return 'BARBER_PAUSED'
  }
  return 'DATABASE_ERROR'
}

/**
 * Legacy function for backward compatibility
 * Creates a reservation using the old insert method
 * @deprecated Use createReservation instead
 */
export async function createReservationLegacy(
  data: ReservationInsert
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const supabase = createClient()
    
    const { data: result, error } = await supabase
      .from('reservations')
      .insert(data)
      .select('id')
      .single()
    
    if (error) {
      return { success: false, error: error.message }
    }
    
    return { success: true, id: result?.id }
  } catch {
    return { success: false, error: 'Unknown error' }
  }
}
