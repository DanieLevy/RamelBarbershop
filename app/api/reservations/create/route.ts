/**
 * API Route: Create Reservation
 * 
 * Server-side reservation creation using the atomic database function.
 * Uses service_role to bypass RLS for secure reservation management.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { reportBug } from '@/lib/bug-reporter'
import { normalizeToSlotBoundary } from '@/lib/utils'
import type { DayOfWeek } from '@/types/database'

// UUID validation
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface CreateReservationRequest {
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

// Error messages (Hebrew)
const ERROR_MESSAGES: Record<string, string> = {
  SLOT_ALREADY_TAKEN: 'השעה כבר נתפסה. אנא בחר שעה אחרת.',
  SLOT_RESERVED_RECURRING: 'השעה שמורה לתור קבוע.',
  SLOT_IN_BREAKOUT: 'השעה לא זמינה - הספר בהפסקה.',
  CUSTOMER_BLOCKED: 'לא ניתן לקבוע תור. אנא פנה לצוות המספרה.',
  CUSTOMER_DOUBLE_BOOKING: 'כבר יש לך תור בשעה זו.',
  MAX_BOOKINGS_REACHED: 'הגעת למקסימום התורים המותרים. בטל תור קיים כדי לקבוע חדש.',
  DATE_OUT_OF_RANGE: 'התאריך שנבחר חורג מטווח ההזמנות המותר.',
  BARBER_PAUSED: 'הספר אינו זמין כרגע לקביעת תורים.',
  VALIDATION_ERROR: 'חסרים נתונים ליצירת התור.',
  DATABASE_ERROR: 'שגיאה ביצירת התור. נסה שוב.',
}

/**
 * Get day of week from timestamp in Israel timezone
 */
function getDayOfWeekFromTimestamp(timestamp: number): DayOfWeek {
  const date = new Date(timestamp)
  // Convert to Israel timezone
  const israelDateStr = date.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem', weekday: 'long' }).toLowerCase()
  // Map to our day format
  const dayMap: Record<string, DayOfWeek> = {
    'sunday': 'sunday',
    'monday': 'monday',
    'tuesday': 'tuesday',
    'wednesday': 'wednesday',
    'thursday': 'thursday',
    'friday': 'friday',
    'saturday': 'saturday',
  }
  return dayMap[israelDateStr] || 'sunday'
}

/**
 * Convert timestamp to time slot string (HH:MM) in Israel timezone
 */
function timestampToTimeSlot(timestamp: number): string {
  const date = new Date(timestamp)
  // Get hours and minutes in Israel timezone
  const israelTimeStr = date.toLocaleString('en-US', {
    timeZone: 'Asia/Jerusalem',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  // Format is "HH:MM", but some locales might return "H:MM"
  const [hours, minutes] = israelTimeStr.split(':')
  return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`
}

function parseBookingError(message: string): string {
  const errorCodes = [
    'SLOT_ALREADY_TAKEN',
    'CUSTOMER_BLOCKED',
    'CUSTOMER_DOUBLE_BOOKING',
    'MAX_BOOKINGS_REACHED',
    'DATE_OUT_OF_RANGE',
    'BARBER_PAUSED',
  ]
  
  for (const code of errorCodes) {
    if (message.includes(code)) {
      return code
    }
  }
  
  return 'DATABASE_ERROR'
}

export async function POST(request: NextRequest) {
  try {
    const body: CreateReservationRequest = await request.json()
    
    // Validate all required fields
    const validationErrors: string[] = []
    
    if (!body.barberId?.trim() || !UUID_REGEX.test(body.barberId)) {
      validationErrors.push('barberId is required and must be a valid UUID')
    }
    if (!body.serviceId?.trim() || !UUID_REGEX.test(body.serviceId)) {
      validationErrors.push('serviceId is required and must be a valid UUID')
    }
    if (!body.customerId?.trim() || !UUID_REGEX.test(body.customerId)) {
      validationErrors.push('customerId is required and must be a valid UUID')
    }
    if (!body.customerName?.trim()) {
      validationErrors.push('customerName is required')
    }
    if (!body.customerPhone?.trim()) {
      validationErrors.push('customerPhone is required')
    }
    if (!body.dateTimestamp || typeof body.dateTimestamp !== 'number') {
      validationErrors.push('dateTimestamp is required')
    }
    if (!body.timeTimestamp || typeof body.timeTimestamp !== 'number') {
      validationErrors.push('timeTimestamp is required')
    }
    if (!body.dayName?.trim()) {
      validationErrors.push('dayName is required')
    }
    if (!body.dayNum?.trim()) {
      validationErrors.push('dayNum is required')
    }
    
    if (validationErrors.length > 0) {
      console.error('[API/Create] Validation failed:', validationErrors)
      return NextResponse.json(
        { 
          success: false, 
          error: 'VALIDATION_ERROR',
          message: ERROR_MESSAGES.VALIDATION_ERROR,
          details: validationErrors 
        },
        { status: 400 }
      )
    }
    
    const supabase = createAdminClient()
    
    // Check for recurring appointment conflict before creating
    // This prevents booking a slot that's reserved for a recurring customer
    const dayOfWeek = getDayOfWeekFromTimestamp(body.timeTimestamp)
    const timeSlot = timestampToTimeSlot(body.timeTimestamp)
    
    const { data: recurringConflict, error: recurringError } = await supabase
      .from('recurring_appointments')
      .select('id')
      .eq('barber_id', body.barberId)
      .eq('day_of_week', dayOfWeek)
      .eq('time_slot', timeSlot)
      .eq('is_active', true)
      .maybeSingle()
    
    if (recurringError) {
      console.error('[API/Create] Recurring check error:', recurringError)
      // Don't fail the request, just log and continue
    }
    
    if (recurringConflict) {
      console.log('[API/Create] Recurring conflict found:', recurringConflict.id)
      return NextResponse.json(
        { success: false, error: 'SLOT_RESERVED_RECURRING', message: ERROR_MESSAGES.SLOT_RESERVED_RECURRING },
        { status: 409 }
      )
    }
    
    // Check for breakout conflict before creating
    // This prevents booking a slot that's blocked by a barber break
    const dateString = new Date(body.dateTimestamp).toISOString().split('T')[0]
    
    const { data: breakoutConflicts, error: breakoutError } = await supabase
      .from('barber_breakouts')
      .select('id, start_time, end_time, breakout_type, start_date, end_date, day_of_week')
      .eq('barber_id', body.barberId)
      .eq('is_active', true)
    
    if (breakoutError) {
      console.error('[API/Create] Breakout check error:', breakoutError)
      // Don't fail the request, just log and continue
    }
    
    if (breakoutConflicts && breakoutConflicts.length > 0) {
      // Check if any breakout applies to this date and time
      const slotHour = parseInt(timeSlot.split(':')[0], 10)
      const slotMinute = parseInt(timeSlot.split(':')[1], 10)
      const slotMinutes = slotHour * 60 + slotMinute
      
      for (const breakout of breakoutConflicts) {
        let appliesToDate = false
        
        // Check if breakout applies to this date
        switch (breakout.breakout_type) {
          case 'single':
            appliesToDate = breakout.start_date === dateString
            break
          case 'date_range':
            appliesToDate = !!(breakout.start_date && breakout.end_date &&
              dateString >= breakout.start_date && dateString <= breakout.end_date)
            break
          case 'recurring':
            appliesToDate = breakout.day_of_week === dayOfWeek
            break
        }
        
        if (appliesToDate) {
          // Check if time falls within breakout range
          const [startH, startM] = breakout.start_time.split(':').map(Number)
          const startMinutes = startH * 60 + startM
          const endMinutes = breakout.end_time
            ? parseInt(breakout.end_time.split(':')[0], 10) * 60 + parseInt(breakout.end_time.split(':')[1], 10)
            : 24 * 60 // Until end of day
          
          if (slotMinutes >= startMinutes && slotMinutes < endMinutes) {
            console.log('[API/Create] Breakout conflict found:', breakout.id)
            return NextResponse.json(
              { success: false, error: 'SLOT_IN_BREAKOUT', message: 'השעה לא זמינה - הספר בהפסקה.' },
              { status: 409 }
            )
          }
        }
      }
    }
    
    // CRITICAL: Normalize timestamps to slot boundaries before storing
    // This ensures all reservations have clean timestamps (e.g., 17:30:00.000 not 17:30:42.952)
    // This is the single source of truth for timestamp normalization
    const normalizedTimeTimestamp = normalizeToSlotBoundary(body.timeTimestamp)
    const normalizedDateTimestamp = normalizeToSlotBoundary(body.dateTimestamp)
    
    console.log(`[API/Create] Normalized timestamp: ${body.timeTimestamp} → ${normalizedTimeTimestamp}`)
    
    // Call the atomic database function with service_role (bypasses RLS)
    const { data: reservationId, error } = await supabase.rpc('create_reservation_atomic', {
      p_barber_id: body.barberId,
      p_service_id: body.serviceId,
      p_customer_id: body.customerId,
      p_customer_name: body.customerName.trim(),
      p_customer_phone: body.customerPhone.replace(/\D/g, ''),
      p_date_timestamp: normalizedDateTimestamp,
      p_time_timestamp: normalizedTimeTimestamp,
      p_day_name: body.dayName,
      p_day_num: body.dayNum,
      p_barber_notes: body.barberNotes?.trim() || null,
    })
    
    if (error) {
      console.error('[API/Create] Database error:', error)
      
      // Parse specific error codes from database
      const errorCode = parseBookingError(error.message)
      const message = ERROR_MESSAGES[errorCode] || ERROR_MESSAGES.DATABASE_ERROR
      
      // Handle unique constraint violation (backup for race condition)
      if (error.code === '23505') {
        if (error.message.includes('idx_unique_confirmed_booking')) {
          return NextResponse.json(
            { success: false, error: 'SLOT_ALREADY_TAKEN', message: ERROR_MESSAGES.SLOT_ALREADY_TAKEN },
            { status: 409 }
          )
        }
        if (error.message.includes('idx_customer_no_double_booking')) {
          return NextResponse.json(
            { success: false, error: 'CUSTOMER_DOUBLE_BOOKING', message: ERROR_MESSAGES.CUSTOMER_DOUBLE_BOOKING },
            { status: 409 }
          )
        }
      }
      
      // Business logic errors - don't report these as bugs (expected behavior)
      if (errorCode !== 'DATABASE_ERROR') {
        return NextResponse.json(
          { success: false, error: errorCode, message },
          { status: 400 }
        )
      }
      
      // Report unexpected database errors
      await reportBug(
        new Error(error.message),
        'API: Create Reservation - Database Error',
        {
          additionalData: {
            errorCode: error.code,
            barberId: body.barberId,
            customerId: body.customerId,
            serviceId: body.serviceId,
          }
        }
      )
      
      return NextResponse.json(
        { success: false, error: 'DATABASE_ERROR', message },
        { status: 500 }
      )
    }
    
    console.log('[API/Create] Reservation created:', reservationId)
    
    return NextResponse.json({
      success: true,
      reservationId,
    })
    
  } catch (err) {
    console.error('[API/Create] Unexpected error:', err)
    
    // Report unexpected errors
    await reportBug(
      err instanceof Error ? err : new Error(String(err)),
      'API: Create Reservation - Unexpected Error'
    )
    
    return NextResponse.json(
      { success: false, error: 'UNKNOWN_ERROR', message: 'שגיאה בלתי צפויה. נסה שוב.' },
      { status: 500 }
    )
  }
}
