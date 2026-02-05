/**
 * API Route: Create Reservation
 * 
 * Server-side reservation creation using the atomic database function.
 * Uses service_role to bypass RLS for secure reservation management.
 * 
 * VALIDATION LAYERS:
 * 1. Input validation (UUIDs, required fields)
 * 2. Parallel pre-checks (all run concurrently for performance):
 *    - Barber exists & is active
 *    - Per-barber customer blocking
 *    - Recurring appointment conflicts
 *    - Breakout (break time) conflicts
 *    - Barber closures (absence days)
 *    - Barbershop closures
 *    - Working hours validation
 *    - Booking settings (max days ahead, min hours before)
 *    - Past time validation
 * 3. Atomic database function (race-condition safe):
 *    - Slot availability (with advisory lock)
 *    - Global customer blocking
 *    - Customer double booking prevention
 *    - Max future bookings enforcement
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

// Error messages (Hebrew) - Complete list of all validation scenarios
const ERROR_MESSAGES: Record<string, string> = {
  // Input validation
  VALIDATION_ERROR: 'חסרים נתונים ליצירת התור.',
  
  // Barber availability
  BARBER_NOT_FOUND: 'הספר לא נמצא במערכת.',
  BARBER_PAUSED: 'הספר אינו זמין כרגע לקביעת תורים.',
  BARBER_CLOSED: 'הספר ביום חופש בתאריך זה.',
  SHOP_CLOSED: 'המספרה סגורה בתאריך זה.',
  OUTSIDE_WORK_HOURS: 'השעה מחוץ לשעות העבודה של הספר.',
  NOT_WORKING_DAY: 'הספר לא עובד ביום זה.',
  
  // Time-based restrictions
  PAST_APPOINTMENT: 'לא ניתן לקבוע תור לזמן שעבר.',
  TOO_CLOSE_TO_APPOINTMENT: 'לא ניתן לקבוע תור בהתראה כה קצרה.',
  DATE_OUT_OF_RANGE: 'התאריך שנבחר חורג מטווח ההזמנות המותר.',
  
  // Slot conflicts
  SLOT_ALREADY_TAKEN: 'השעה כבר נתפסה. אנא בחר שעה אחרת.',
  SLOT_RESERVED_RECURRING: 'השעה שמורה לתור קבוע.',
  SLOT_IN_BREAKOUT: 'השעה לא זמינה - הספר בהפסקה.',
  
  // Customer restrictions
  CUSTOMER_BLOCKED: 'לא ניתן לקבוע תור. אנא פנה לצוות המספרה.',
  CUSTOMER_DOUBLE_BOOKING: 'כבר יש לך תור בשעה זו.',
  MAX_BOOKINGS_REACHED: 'הגעת למקסימום התורים המותרים. בטל תור קיים כדי לקבוע חדש.',
  
  // Generic errors
  GENERIC_ERROR: 'אופס, אירעה שגיאה ביצירת התור.',
  DATABASE_ERROR: 'שגיאה ביצירת התור. נסה שוב.',
  UNKNOWN_ERROR: 'שגיאה בלתי צפויה. נסה שוב.',
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

/**
 * Get date string in Israel timezone (YYYY-MM-DD)
 */
function getIsraelDateString(timestamp: number): string {
  const date = new Date(timestamp)
  // Get date parts in Israel timezone
  const year = date.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem', year: 'numeric' })
  const month = date.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem', month: '2-digit' })
  const day = date.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem', day: '2-digit' })
  return `${year}-${month}-${day}`
}

/**
 * Convert time string (HH:MM or HH:MM:SS) to minutes since midnight
 */
function timeToMinutes(timeStr: string): number {
  const parts = timeStr.split(':').map(Number)
  return parts[0] * 60 + (parts[1] || 0)
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
    
    // ============================================================
    // PHASE 1: Input Validation (synchronous, fast)
    // ============================================================
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
    
    // Pre-compute values needed for parallel queries (Israel timezone)
    const dayOfWeek = getDayOfWeekFromTimestamp(body.timeTimestamp)
    const timeSlot = timestampToTimeSlot(body.timeTimestamp)
    const dateString = getIsraelDateString(body.dateTimestamp)
    const slotMinutes = timeToMinutes(timeSlot)
    const now = Date.now()
    
    // ============================================================
    // PHASE 2: Parallel Validation Queries (performance optimized)
    // All independent checks run concurrently
    // ============================================================
    console.log('[API/Create] Running parallel validation checks...')
    
    const [
      barberResult,
      recurringResult,
      breakoutResult,
      barberClosuresResult,
      shopClosuresResult,
      workDaysResult,
      bookingSettingsResult,
    ] = await Promise.all([
      // 1. Barber data: exists, is active, blocked customers list
      supabase
        .from('users')
        .select('id, is_active, blocked_customers')
        .eq('id', body.barberId)
        .eq('is_barber', true)
        .single(),
      
      // 2. Recurring appointment conflict
      supabase
        .from('recurring_appointments')
        .select('id')
        .eq('barber_id', body.barberId)
        .eq('day_of_week', dayOfWeek)
        .eq('time_slot', timeSlot)
        .eq('is_active', true)
        .maybeSingle(),
      
      // 3. Breakout conflicts (barber breaks)
      supabase
        .from('barber_breakouts')
        .select('id, start_time, end_time, breakout_type, start_date, end_date, day_of_week')
        .eq('barber_id', body.barberId)
        .eq('is_active', true),
      
      // 4. Barber closures (absence days)
      supabase
        .from('barber_closures')
        .select('id, start_date, end_date')
        .eq('barber_id', body.barberId),
      
      // 5. Barbershop closures
      supabase
        .from('barbershop_closures')
        .select('id, start_date, end_date'),
      
      // 6. Work days for this barber on requested day
      supabase
        .from('work_days')
        .select('is_working, start_time, end_time')
        .eq('user_id', body.barberId)
        .eq('day_of_week', dayOfWeek)
        .single(),
      
      // 7. Per-barber booking settings
      supabase
        .from('barber_booking_settings')
        .select('max_booking_days_ahead, min_hours_before_booking')
        .eq('barber_id', body.barberId)
        .maybeSingle(),
    ])
    
    console.log('[API/Create] Parallel checks completed, evaluating results...')
    
    // ============================================================
    // PHASE 3: Evaluate All Validation Results
    // ============================================================
    
    // 3.1 Check barber exists and is active
    if (barberResult.error || !barberResult.data) {
      console.error('[API/Create] Barber not found:', body.barberId)
      return NextResponse.json(
        { success: false, error: 'BARBER_NOT_FOUND', message: ERROR_MESSAGES.BARBER_NOT_FOUND },
        { status: 400 }
      )
    }
    
    if (barberResult.data.is_active === false) {
      console.log('[API/Create] Barber is paused:', body.barberId)
      return NextResponse.json(
        { success: false, error: 'BARBER_PAUSED', message: ERROR_MESSAGES.BARBER_PAUSED },
        { status: 400 }
      )
    }
    
    // 3.2 Check per-barber customer blocking
    if (barberResult.data.blocked_customers?.includes(body.customerPhone)) {
      console.log('[API/Create] Blocked customer attempt:', body.customerPhone, 'for barber:', body.barberId)
      
      // Send push notification to barber about the blocked attempt (fire and forget)
      try {
        fetch(`${request.nextUrl.origin}/api/push/notify-blocked-attempt`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            barberId: body.barberId,
            customerName: body.customerName,
            customerPhone: body.customerPhone,
          })
        }).catch(err => console.error('[API/Create] Failed to send blocked attempt notification:', err))
      } catch {
        // Ignore errors - notification is optional
      }
      
      // Return generic error (don't reveal blocking)
      return NextResponse.json(
        { success: false, error: 'GENERIC_ERROR', message: ERROR_MESSAGES.GENERIC_ERROR },
        { status: 400 }
      )
    }
    
    // 3.3 Check past time validation
    if (body.timeTimestamp < now) {
      console.log('[API/Create] Past appointment attempt:', new Date(body.timeTimestamp).toISOString())
      return NextResponse.json(
        { success: false, error: 'PAST_APPOINTMENT', message: ERROR_MESSAGES.PAST_APPOINTMENT },
        { status: 400 }
      )
    }
    
    // 3.4 Check per-barber booking settings (min hours before, max days ahead)
    const bookingSettings = bookingSettingsResult.data
    if (bookingSettings) {
      // Check min hours before booking
      if (bookingSettings.min_hours_before_booking) {
        const minMilliseconds = bookingSettings.min_hours_before_booking * 60 * 60 * 1000
        const timeUntilAppointment = body.timeTimestamp - now
        
        if (timeUntilAppointment < minMilliseconds) {
          console.log('[API/Create] Too close to appointment:', {
            minHours: bookingSettings.min_hours_before_booking,
            hoursRemaining: (timeUntilAppointment / (60 * 60 * 1000)).toFixed(2),
          })
          return NextResponse.json(
            { success: false, error: 'TOO_CLOSE_TO_APPOINTMENT', message: ERROR_MESSAGES.TOO_CLOSE_TO_APPOINTMENT },
            { status: 400 }
          )
        }
      }
      
      // Check max days ahead (per-barber override)
      if (bookingSettings.max_booking_days_ahead) {
        const maxMilliseconds = bookingSettings.max_booking_days_ahead * 24 * 60 * 60 * 1000
        const daysAhead = body.dateTimestamp - now
        
        if (daysAhead > maxMilliseconds) {
          console.log('[API/Create] Date out of range:', {
            maxDays: bookingSettings.max_booking_days_ahead,
            daysRequested: Math.ceil(daysAhead / (24 * 60 * 60 * 1000)),
          })
          return NextResponse.json(
            { success: false, error: 'DATE_OUT_OF_RANGE', message: ERROR_MESSAGES.DATE_OUT_OF_RANGE },
            { status: 400 }
          )
        }
      }
    }
    
    // 3.5 Check working hours
    if (workDaysResult.error) {
      console.error('[API/Create] Work days check error:', workDaysResult.error)
      // Don't fail - database function will catch this
    } else if (workDaysResult.data) {
      const workDay = workDaysResult.data
      
      // Check if barber works on this day
      if (!workDay.is_working) {
        console.log('[API/Create] Barber not working on day:', dayOfWeek)
        return NextResponse.json(
          { success: false, error: 'NOT_WORKING_DAY', message: ERROR_MESSAGES.NOT_WORKING_DAY },
          { status: 400 }
        )
      }
      
      // Check if time is within working hours
      if (workDay.start_time && workDay.end_time) {
        const startMinutes = timeToMinutes(workDay.start_time)
        const endMinutes = timeToMinutes(workDay.end_time)
        
        if (slotMinutes < startMinutes || slotMinutes >= endMinutes) {
          console.log('[API/Create] Outside work hours:', {
            requested: timeSlot,
            workHours: `${workDay.start_time} - ${workDay.end_time}`,
          })
          return NextResponse.json(
            { success: false, error: 'OUTSIDE_WORK_HOURS', message: ERROR_MESSAGES.OUTSIDE_WORK_HOURS },
            { status: 400 }
          )
        }
      }
    }
    
    // 3.6 Check barber closures (absence days)
    if (!barberClosuresResult.error && barberClosuresResult.data) {
      for (const closure of barberClosuresResult.data) {
        if (dateString >= closure.start_date && dateString <= closure.end_date) {
          console.log('[API/Create] Barber closure found:', closure.id)
          return NextResponse.json(
            { success: false, error: 'BARBER_CLOSED', message: ERROR_MESSAGES.BARBER_CLOSED },
            { status: 409 }
          )
        }
      }
    }
    
    // 3.7 Check barbershop closures
    if (!shopClosuresResult.error && shopClosuresResult.data) {
      for (const closure of shopClosuresResult.data) {
        if (dateString >= closure.start_date && dateString <= closure.end_date) {
          console.log('[API/Create] Shop closure found:', closure.id)
          return NextResponse.json(
            { success: false, error: 'SHOP_CLOSED', message: ERROR_MESSAGES.SHOP_CLOSED },
            { status: 409 }
          )
        }
      }
    }
    
    // 3.8 Check recurring appointment conflict
    if (recurringResult.error) {
      console.error('[API/Create] Recurring check error:', recurringResult.error)
      // Don't fail the request, just log and continue
    }
    
    if (recurringResult.data) {
      console.log('[API/Create] Recurring conflict found:', recurringResult.data.id)
      return NextResponse.json(
        { success: false, error: 'SLOT_RESERVED_RECURRING', message: ERROR_MESSAGES.SLOT_RESERVED_RECURRING },
        { status: 409 }
      )
    }
    
    // 3.9 Check breakout conflicts
    if (breakoutResult.error) {
      console.error('[API/Create] Breakout check error:', breakoutResult.error)
      // Don't fail the request, just log and continue
    }
    
    if (breakoutResult.data && breakoutResult.data.length > 0) {
      for (const breakout of breakoutResult.data) {
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
          const startMinutes = timeToMinutes(breakout.start_time)
          const endMinutes = breakout.end_time
            ? timeToMinutes(breakout.end_time)
            : 24 * 60 // Until end of day
          
          if (slotMinutes >= startMinutes && slotMinutes < endMinutes) {
            console.log('[API/Create] Breakout conflict found:', breakout.id)
            return NextResponse.json(
              { success: false, error: 'SLOT_IN_BREAKOUT', message: ERROR_MESSAGES.SLOT_IN_BREAKOUT },
              { status: 409 }
            )
          }
        }
      }
    }
    
    // ============================================================
    // PHASE 4: Normalize Timestamps and Create Reservation
    // ============================================================
    
    // CRITICAL: Normalize timestamps to slot boundaries before storing
    // This ensures all reservations have clean timestamps (e.g., 17:30:00.000 not 17:30:42.952)
    const normalizedTimeTimestamp = normalizeToSlotBoundary(body.timeTimestamp)
    const normalizedDateTimestamp = normalizeToSlotBoundary(body.dateTimestamp)
    
    console.log(`[API/Create] Normalized timestamp: ${body.timeTimestamp} → ${normalizedTimeTimestamp}`)
    
    // Calculate per-barber max days ahead for database function
    // Use per-barber setting if available, otherwise database will use global default
    const maxDaysAhead = bookingSettings?.max_booking_days_ahead ?? null
    
    // Call the atomic database function with service_role (bypasses RLS)
    // This handles final race-condition-safe validation and insert
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
      p_max_days_ahead: maxDaysAhead,
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
    
    console.log('[API/Create] Reservation created successfully:', reservationId)
    
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
