/**
 * Centralized Booking Service
 * 
 * Single source of truth for all booking operations.
 * Uses database-level atomic functions for race condition prevention.
 * Provides comprehensive error handling and logging.
 */

import { createClient } from '@/lib/supabase/client'
import { reportSupabaseError } from '@/lib/bug-reporter/helpers'
import { normalizeToSlotBoundary, SLOT_INTERVAL_MS } from '@/lib/utils'

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
  barberNotes?: string
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
    // Call the server-side API route to create the reservation
    // This uses the service_role key to bypass RLS
    const response = await fetch('/api/reservations/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        barberId: data.barberId,
        serviceId: data.serviceId,
        customerId: data.customerId,
        customerName: data.customerName.trim(),
        customerPhone: data.customerPhone.replace(/\D/g, ''),
        dateTimestamp: data.dateTimestamp,
        timeTimestamp: data.timeTimestamp,
        dayName: data.dayName,
        dayNum: data.dayNum,
        barberNotes: data.barberNotes?.trim() || null,
      }),
    })
    
    const result = await response.json()
    
    if (!response.ok || !result.success) {
      console.error('[BookingService] API error:', result)
      
      const errorCode = (result.error as BookingErrorCode) || 'DATABASE_ERROR'
      const message = result.message || ERROR_MESSAGES[errorCode] || ERROR_MESSAGES.DATABASE_ERROR
      
      return {
        success: false,
        error: errorCode,
        message,
      }
    }
    
    console.log('[BookingService] Reservation created successfully:', result.reservationId)
    
    return {
      success: true,
      reservationId: result.reservationId as string,
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
 * Uses server-side API route to bypass RLS restrictions
 */
export async function cancelReservation(
  reservationId: string,
  cancelledBy: 'customer' | 'barber' | 'system',
  reason?: string,
  expectedVersion?: number
): Promise<CancelReservationResult> {
  if (!reservationId || !isValidUUID(reservationId)) {
    return { success: false, error: 'Invalid reservation ID' }
  }
  
  try {
    // Use server-side API route for cancellation (bypasses RLS)
    const response = await fetch('/api/reservations/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reservationId,
        cancelledBy,
        reason,
        expectedVersion,
      }),
    })
    
    const result = await response.json()
    
    if (!response.ok || !result.success) {
      console.error('[BookingService] Cancel error:', result.error)
      
      if (response.status === 409 || result.concurrencyConflict) {
        return {
          success: false,
          error: result.error || 'התור כבר בוטל או עודכן על ידי אחר',
          concurrencyConflict: true,
        }
      }
      
      return { success: false, error: result.error || 'שגיאה בביטול התור' }
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
 * Uses slot boundary matching for robust comparison
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
    
    // Normalize to slot boundary for robust matching
    const slotStart = normalizeToSlotBoundary(timeTimestamp)
    const slotEnd = slotStart + SLOT_INTERVAL_MS - 1
    
    // Query using range to catch any timestamps within the same 30-minute slot
    const { data, error } = await supabase
      .from('reservations')
      .select('id')
      .eq('barber_id', barberId)
      .gte('time_timestamp', slotStart)
      .lte('time_timestamp', slotEnd)
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
    const maxBookings = 10
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
// Edit (Reschedule) Reservation
// ============================================================

export interface EditReservationData {
  reservationId: string
  barberId: string
  callerType?: 'barber' | 'customer'
  customerId?: string
  newTimeTimestamp: number
  newDateTimestamp: number
  newDayName: string
  newDayNum: string
  newServiceId?: string
  expectedVersion?: number
}

export interface EditReservationResult {
  success: boolean
  reservationId?: string
  newVersion?: number
  error?: string
  message?: string
  concurrencyConflict?: boolean
}

/**
 * Edit (reschedule) an existing reservation.
 * Supports both barber and customer callers.
 * Preserves the same reservation ID - date/time/service can change.
 * Barber cannot be changed (enforced server-side).
 */
export async function editReservation(
  data: EditReservationData
): Promise<EditReservationResult> {
  // Validate required fields
  if (!data.reservationId?.trim() || !isValidUUID(data.reservationId)) {
    return { success: false, error: 'VALIDATION_ERROR', message: 'מזהה תור לא תקין' }
  }
  if (!data.barberId?.trim() || !isValidUUID(data.barberId)) {
    return { success: false, error: 'VALIDATION_ERROR', message: 'מזהה ספר לא תקין' }
  }
  if (!data.newTimeTimestamp || typeof data.newTimeTimestamp !== 'number') {
    return { success: false, error: 'VALIDATION_ERROR', message: 'נא לבחור שעה חדשה' }
  }
  if (!data.newDateTimestamp || typeof data.newDateTimestamp !== 'number') {
    return { success: false, error: 'VALIDATION_ERROR', message: 'נא לבחור תאריך חדש' }
  }
  
  try {
    const response = await fetch('/api/reservations/edit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reservationId: data.reservationId,
        barberId: data.barberId,
        callerType: data.callerType || 'barber',
        customerId: data.customerId,
        newTimeTimestamp: data.newTimeTimestamp,
        newDateTimestamp: data.newDateTimestamp,
        newDayName: data.newDayName,
        newDayNum: data.newDayNum,
        newServiceId: data.newServiceId,
        expectedVersion: data.expectedVersion,
      }),
    })
    
    const result = await response.json()
    
    if (!response.ok || !result.success) {
      console.error('[BookingService] Edit error:', result)
      
      if (response.status === 409 || result.concurrencyConflict) {
        return {
          success: false,
          error: result.error || 'CONCURRENCY_CONFLICT',
          message: result.message || 'התור עודכן על ידי אחר. אנא רענן ונסה שוב.',
          concurrencyConflict: true,
        }
      }
      
      return {
        success: false,
        error: result.error || 'DATABASE_ERROR',
        message: result.message || 'שגיאה בעדכון התור',
      }
    }
    
    console.log('[BookingService] Reservation edited successfully:', result.reservationId, 'v' + result.newVersion)
    
    return {
      success: true,
      reservationId: result.reservationId as string,
      newVersion: result.newVersion as number,
    }
  } catch (err) {
    console.error('[BookingService] Edit exception:', err)
    await reportSupabaseError(
      { message: err instanceof Error ? err.message : String(err), code: 'EDIT_EXCEPTION' },
      'Editing reservation - unexpected error',
      { table: 'reservations', operation: 'update' }
    )
    return {
      success: false,
      error: 'UNKNOWN_ERROR',
      message: 'שגיאה בלתי צפויה בעריכת התור',
    }
  }
}

// Note: parseBookingError was moved to app/api/reservations/create/route.ts
// createReservationLegacy was removed as it used direct database inserts
// which don't work with strict RLS policies. Use createReservation() instead.
