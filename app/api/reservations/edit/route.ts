/**
 * API Route: Edit (Reschedule) Reservation
 * 
 * Server-side reservation editing using admin client (bypasses RLS).
 * Supports barber, customer, and admin callers:
 *  - Barber: can edit any reservation assigned to them
 *  - Customer: can edit their own reservations (same barber enforced, service change allowed)
 *  - Admin: can edit ANY barber's reservation (verified via DB role check)
 * Updates the SAME reservation record (preserves reservation ID).
 * 
 * VALIDATION LAYERS:
 * 1. Input validation (UUIDs, required fields)
 * 2. Authorization (barber ownership OR customer ownership)
 * 3. Reservation is still confirmed and upcoming
 * 4. Parallel pre-checks (same as create):
 *    - Recurring appointment conflicts
 *    - Breakout (break time) conflicts
 *    - Barber closures (absence days)
 *    - Barbershop closures
 *    - Working hours validation
 *    - Booking settings (min hours before, max days ahead — customer only)
 *    - Past time validation
 * 5. Atomic update with optimistic locking (version check)
 * 6. Audit trail via reservation_changes
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { reportApiError, reportServerError } from '@/lib/bug-reporter/helpers'
import { normalizeToSlotBoundary } from '@/lib/utils'
import type { DayOfWeek } from '@/types/database'

// UUID validation
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface EditReservationRequest {
  reservationId: string
  barberId: string
  callerType: 'barber' | 'customer' | 'admin'
  customerId?: string
  adminId?: string
  newTimeTimestamp: number
  newDateTimestamp: number
  newDayName: string
  newDayNum: string
  newServiceId?: string
  expectedVersion?: number
}

// Error messages (Hebrew)
const ERROR_MESSAGES: Record<string, string> = {
  VALIDATION_ERROR: 'חסרים נתונים לעריכת התור.',
  RESERVATION_NOT_FOUND: 'התור לא נמצא.',
  NOT_AUTHORIZED: 'אין הרשאה לערוך תור זה.',
  ALREADY_CANCELLED: 'לא ניתן לערוך תור שבוטל.',
  ALREADY_PAST: 'לא ניתן לערוך תור שעבר.',
  PAST_APPOINTMENT: 'לא ניתן לקבוע תור לזמן שעבר.',
  TOO_CLOSE_TO_APPOINTMENT: 'לא ניתן לערוך תור בהתראה כה קצרה.',
  DATE_OUT_OF_RANGE: 'התאריך שנבחר חורג מטווח ההזמנות המותר.',
  BARBER_CLOSED: 'הספר ביום חופש בתאריך זה.',
  SHOP_CLOSED: 'המספרה סגורה בתאריך זה.',
  OUTSIDE_WORK_HOURS: 'השעה מחוץ לשעות העבודה של הספר.',
  NOT_WORKING_DAY: 'הספר לא עובד ביום זה.',
  SLOT_ALREADY_TAKEN: 'השעה כבר נתפסה. אנא בחר שעה אחרת.',
  SLOT_RESERVED_RECURRING: 'השעה שמורה לתור קבוע.',
  SLOT_IN_BREAKOUT: 'השעה לא זמינה - הספר בהפסקה.',
  CONCURRENCY_CONFLICT: 'התור עודכן על ידי אחר. אנא רענן ונסה שוב.',
  SAME_TIME: 'השעה והשירות לא השתנו.',
  INVALID_SERVICE: 'השירות שנבחר לא תקין.',
  DATABASE_ERROR: 'שגיאה בעדכון התור. נסה שוב.',
  UNKNOWN_ERROR: 'שגיאה בלתי צפויה. נסה שוב.',
}

/**
 * Get day of week from timestamp in Israel timezone
 */
function getDayOfWeekFromTimestamp(timestamp: number): DayOfWeek {
  const date = new Date(timestamp)
  const israelDateStr = date.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem', weekday: 'long' }).toLowerCase()
  const dayMap: Record<string, DayOfWeek> = {
    'sunday': 'sunday', 'monday': 'monday', 'tuesday': 'tuesday',
    'wednesday': 'wednesday', 'thursday': 'thursday', 'friday': 'friday', 'saturday': 'saturday',
  }
  return dayMap[israelDateStr] || 'sunday'
}

/**
 * Convert timestamp to time slot string (HH:MM) in Israel timezone
 */
function timestampToTimeSlot(timestamp: number): string {
  const date = new Date(timestamp)
  const israelTimeStr = date.toLocaleString('en-US', {
    timeZone: 'Asia/Jerusalem',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const [hours, minutes] = israelTimeStr.split(':')
  return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`
}

/**
 * Get date string in Israel timezone (YYYY-MM-DD)
 */
function getIsraelDateString(timestamp: number): string {
  const date = new Date(timestamp)
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

export async function POST(request: NextRequest) {
  try {
    const body: EditReservationRequest = await request.json()
    
    // Default callerType to 'barber' for backward compatibility
    const callerType = body.callerType || 'barber'
    
    // ============================================================
    // PHASE 1: Input Validation
    // ============================================================
    const validationErrors: string[] = []
    
    if (!body.reservationId?.trim() || !UUID_REGEX.test(body.reservationId)) {
      validationErrors.push('reservationId is required and must be a valid UUID')
    }
    if (!body.barberId?.trim() || !UUID_REGEX.test(body.barberId)) {
      validationErrors.push('barberId is required and must be a valid UUID')
    }
    if (callerType === 'customer' && (!body.customerId?.trim() || !UUID_REGEX.test(body.customerId))) {
      validationErrors.push('customerId is required for customer edits')
    }
    if (callerType === 'admin' && (!body.adminId?.trim() || !UUID_REGEX.test(body.adminId))) {
      validationErrors.push('adminId is required for admin edits')
    }
    if (!body.newTimeTimestamp || typeof body.newTimeTimestamp !== 'number') {
      validationErrors.push('newTimeTimestamp is required')
    }
    if (!body.newDateTimestamp || typeof body.newDateTimestamp !== 'number') {
      validationErrors.push('newDateTimestamp is required')
    }
    if (!body.newDayName?.trim()) {
      validationErrors.push('newDayName is required')
    }
    if (!body.newDayNum?.trim()) {
      validationErrors.push('newDayNum is required')
    }
    if (body.newServiceId && !UUID_REGEX.test(body.newServiceId)) {
      validationErrors.push('newServiceId must be a valid UUID')
    }
    
    if (validationErrors.length > 0) {
      console.error('[API/Edit] Validation failed:', validationErrors)
      return NextResponse.json(
        { success: false, error: 'VALIDATION_ERROR', message: ERROR_MESSAGES.VALIDATION_ERROR, details: validationErrors },
        { status: 400 }
      )
    }
    
    const supabase = createAdminClient()
    const now = Date.now()
    
    // ============================================================
    // PHASE 2: Fetch and validate the existing reservation
    // ============================================================
    const { data: reservation, error: fetchError } = await supabase
      .from('reservations')
      .select('id, barber_id, service_id, customer_id, customer_name, customer_phone, date_timestamp, time_timestamp, day_name, day_num, status, version, barber_notes')
      .eq('id', body.reservationId)
      .single()
    
    if (fetchError || !reservation) {
      console.error('[API/Edit] Reservation not found:', body.reservationId, fetchError)
      return NextResponse.json(
        { success: false, error: 'RESERVATION_NOT_FOUND', message: ERROR_MESSAGES.RESERVATION_NOT_FOUND },
        { status: 404 }
      )
    }
    
    // 2.1 Authorization based on caller type
    if (callerType === 'admin') {
      // Admin: verify the adminId is actually an admin in the database
      const { data: adminUser, error: adminError } = await supabase
        .from('users')
        .select('id, role')
        .eq('id', body.adminId!)
        .eq('is_barber', true)
        .single()
      
      if (adminError || !adminUser || adminUser.role !== 'admin') {
        console.error('[API/Edit] Not authorized - invalid admin:', { adminId: body.adminId, error: adminError })
        return NextResponse.json(
          { success: false, error: 'NOT_AUTHORIZED', message: ERROR_MESSAGES.NOT_AUTHORIZED },
          { status: 403 }
        )
      }
      // Admin can edit any barber's reservation — barberId in the request is the target barber,
      // not necessarily the admin's own ID. We use reservation.barber_id for all barber-related queries.
    } else if (callerType === 'barber') {
      // Barber must own the reservation
      if (reservation.barber_id !== body.barberId) {
        console.error('[API/Edit] Not authorized - barber mismatch:', { reservationBarber: reservation.barber_id, requestBarber: body.barberId })
        return NextResponse.json(
          { success: false, error: 'NOT_AUTHORIZED', message: ERROR_MESSAGES.NOT_AUTHORIZED },
          { status: 403 }
        )
      }
    } else {
      // Customer must own the reservation AND barber must match (no barber change allowed)
      if (reservation.customer_id !== body.customerId) {
        console.error('[API/Edit] Not authorized - customer mismatch:', { reservationCustomer: reservation.customer_id, requestCustomer: body.customerId })
        return NextResponse.json(
          { success: false, error: 'NOT_AUTHORIZED', message: ERROR_MESSAGES.NOT_AUTHORIZED },
          { status: 403 }
        )
      }
      if (reservation.barber_id !== body.barberId) {
        console.error('[API/Edit] Not authorized - barber change attempt by customer')
        return NextResponse.json(
          { success: false, error: 'NOT_AUTHORIZED', message: 'לא ניתן לשנות ספר. בטל את התור וקבע חדש.' },
          { status: 403 }
        )
      }
    }
    
    // 2.2 Reservation must be confirmed
    if (reservation.status === 'cancelled') {
      return NextResponse.json(
        { success: false, error: 'ALREADY_CANCELLED', message: ERROR_MESSAGES.ALREADY_CANCELLED },
        { status: 400 }
      )
    }
    
    // 2.3 Original reservation must be upcoming (not past)
    if (reservation.time_timestamp < now) {
      return NextResponse.json(
        { success: false, error: 'ALREADY_PAST', message: ERROR_MESSAGES.ALREADY_PAST },
        { status: 400 }
      )
    }
    
    // 2.4 New time must be in the future
    if (body.newTimeTimestamp < now) {
      return NextResponse.json(
        { success: false, error: 'PAST_APPOINTMENT', message: ERROR_MESSAGES.PAST_APPOINTMENT },
        { status: 400 }
      )
    }
    
    // 2.5 Optimistic locking check
    if (body.expectedVersion !== undefined && reservation.version !== body.expectedVersion) {
      return NextResponse.json(
        { success: false, error: 'CONCURRENCY_CONFLICT', message: ERROR_MESSAGES.CONCURRENCY_CONFLICT, concurrencyConflict: true },
        { status: 409 }
      )
    }
    
    // Normalize the new timestamps
    const normalizedNewTime = normalizeToSlotBoundary(body.newTimeTimestamp)
    const normalizedNewDate = normalizeToSlotBoundary(body.newDateTimestamp)
    const normalizedOldTime = normalizeToSlotBoundary(reservation.time_timestamp)
    
    // Determine the effective new service ID
    const effectiveServiceId = body.newServiceId || reservation.service_id
    const serviceChanged = body.newServiceId && body.newServiceId !== reservation.service_id
    const timeChanged = normalizedNewTime !== normalizedOldTime
    
    // 2.6 Check if anything actually changed
    if (!timeChanged && !serviceChanged) {
      return NextResponse.json(
        { success: false, error: 'SAME_TIME', message: ERROR_MESSAGES.SAME_TIME },
        { status: 400 }
      )
    }
    
    // 2.7 Validate service belongs to the same barber (if changed)
    if (serviceChanged) {
      const { data: serviceData, error: serviceError } = await supabase
        .from('services')
        .select('id, barber_id, is_active')
        .eq('id', body.newServiceId!)
        .single()
      
      if (serviceError || !serviceData) {
        return NextResponse.json(
          { success: false, error: 'INVALID_SERVICE', message: ERROR_MESSAGES.INVALID_SERVICE },
          { status: 400 }
        )
      }
      if (serviceData.barber_id !== reservation.barber_id || !serviceData.is_active) {
        return NextResponse.json(
          { success: false, error: 'INVALID_SERVICE', message: ERROR_MESSAGES.INVALID_SERVICE },
          { status: 400 }
        )
      }
    }
    
    // Pre-compute values for validation
    const dayOfWeek = getDayOfWeekFromTimestamp(normalizedNewTime)
    const timeSlot = timestampToTimeSlot(normalizedNewTime)
    const dateString = getIsraelDateString(normalizedNewDate)
    const slotMinutes = timeToMinutes(timeSlot)
    
    console.log(`[API/Edit] Rescheduling reservation ${body.reservationId} by ${callerType}: ${timestampToTimeSlot(normalizedOldTime)} → ${timeSlot} on ${dateString}${serviceChanged ? ' (service changed)' : ''}`)
    
    // ============================================================
    // PHASE 3: Parallel Validation Queries
    // ============================================================
    const [
      recurringResult,
      breakoutResult,
      barberClosuresResult,
      shopClosuresResult,
      workDaysResult,
      slotCheckResult,
      bookingSettingsResult,
    ] = await Promise.all([
      // 1. Recurring appointment conflict
      supabase
        .from('recurring_appointments')
        .select('id')
        .eq('barber_id', body.barberId)
        .eq('day_of_week', dayOfWeek)
        .eq('time_slot', timeSlot)
        .eq('is_active', true)
        .maybeSingle(),
      
      // 2. Breakout conflicts
      supabase
        .from('barber_breakouts')
        .select('id, start_time, end_time, breakout_type, start_date, end_date, day_of_week')
        .eq('barber_id', body.barberId)
        .eq('is_active', true),
      
      // 3. Barber closures
      supabase
        .from('barber_closures')
        .select('id, start_date, end_date')
        .eq('barber_id', body.barberId),
      
      // 4. Barbershop closures
      supabase
        .from('barbershop_closures')
        .select('id, start_date, end_date'),
      
      // 5. Work days
      supabase
        .from('work_days')
        .select('is_working, start_time, end_time')
        .eq('user_id', body.barberId)
        .eq('day_of_week', dayOfWeek)
        .single(),
      
      // 6. Check if slot is already taken (exclude current reservation)
      supabase
        .from('reservations')
        .select('id')
        .eq('barber_id', body.barberId)
        .eq('status', 'confirmed')
        .gte('time_timestamp', normalizedNewTime)
        .lte('time_timestamp', normalizedNewTime + (30 * 60 * 1000) - 1)
        .neq('id', body.reservationId)
        .maybeSingle(),
      
      // 7. Booking settings (for customer edits — always fetch, only enforce for customers)
      supabase
        .from('barber_booking_settings')
        .select('max_booking_days_ahead, min_hours_before_booking')
        .eq('barber_id', body.barberId)
        .maybeSingle(),
    ])
    
    // ============================================================
    // PHASE 4: Evaluate Validation Results
    // ============================================================
    
    // 4.1 Check working hours
    if (workDaysResult.error) {
      console.error('[API/Edit] Work days check error:', workDaysResult.error)
      reportServerError(workDaysResult.error, 'Work days check failed (edit)', {
        route: '/api/reservations/edit',
        severity: 'medium',
        additionalData: { barberId: body.barberId, dayOfWeek },
      })
    } else if (workDaysResult.data) {
      const workDay = workDaysResult.data
      
      if (!workDay.is_working) {
        return NextResponse.json(
          { success: false, error: 'NOT_WORKING_DAY', message: ERROR_MESSAGES.NOT_WORKING_DAY },
          { status: 400 }
        )
      }
      
      if (workDay.start_time && workDay.end_time) {
        const startMinutes = timeToMinutes(workDay.start_time)
        const endMinutes = timeToMinutes(workDay.end_time)
        
        if (slotMinutes < startMinutes || slotMinutes >= endMinutes) {
          return NextResponse.json(
            { success: false, error: 'OUTSIDE_WORK_HOURS', message: ERROR_MESSAGES.OUTSIDE_WORK_HOURS },
            { status: 400 }
          )
        }
      }
    }
    
    // 4.2 Check barber closures
    if (!barberClosuresResult.error && barberClosuresResult.data) {
      for (const closure of barberClosuresResult.data) {
        if (dateString >= closure.start_date && dateString <= closure.end_date) {
          return NextResponse.json(
            { success: false, error: 'BARBER_CLOSED', message: ERROR_MESSAGES.BARBER_CLOSED },
            { status: 409 }
          )
        }
      }
    }
    
    // 4.3 Check shop closures
    if (!shopClosuresResult.error && shopClosuresResult.data) {
      for (const closure of shopClosuresResult.data) {
        if (dateString >= closure.start_date && dateString <= closure.end_date) {
          return NextResponse.json(
            { success: false, error: 'SHOP_CLOSED', message: ERROR_MESSAGES.SHOP_CLOSED },
            { status: 409 }
          )
        }
      }
    }
    
    // 4.4 Check recurring conflict
    if (recurringResult.data) {
      return NextResponse.json(
        { success: false, error: 'SLOT_RESERVED_RECURRING', message: ERROR_MESSAGES.SLOT_RESERVED_RECURRING },
        { status: 409 }
      )
    }
    
    // 4.5 Check breakout conflicts
    if (breakoutResult.data && breakoutResult.data.length > 0) {
      for (const breakout of breakoutResult.data) {
        let appliesToDate = false
        
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
          const startMinutes = timeToMinutes(breakout.start_time)
          const endMinutes = breakout.end_time ? timeToMinutes(breakout.end_time) : 24 * 60
          
          if (slotMinutes >= startMinutes && slotMinutes < endMinutes) {
            return NextResponse.json(
              { success: false, error: 'SLOT_IN_BREAKOUT', message: ERROR_MESSAGES.SLOT_IN_BREAKOUT },
              { status: 409 }
            )
          }
        }
      }
    }
    
    // 4.6 Check slot availability (exclude current reservation) — only if time changed
    if (timeChanged && slotCheckResult.data) {
      return NextResponse.json(
        { success: false, error: 'SLOT_ALREADY_TAKEN', message: ERROR_MESSAGES.SLOT_ALREADY_TAKEN },
        { status: 409 }
      )
    }
    
    // 4.7 Customer-specific: check booking settings (min hours before, max days ahead)
    if (callerType === 'customer') {
      const bookingSettings = bookingSettingsResult.data
      
      if (bookingSettings) {
        // Check min hours before booking
        if (bookingSettings.min_hours_before_booking) {
          const minMilliseconds = bookingSettings.min_hours_before_booking * 60 * 60 * 1000
          const timeUntilAppointment = body.newTimeTimestamp - now
          
          if (timeUntilAppointment < minMilliseconds) {
            return NextResponse.json(
              { success: false, error: 'TOO_CLOSE_TO_APPOINTMENT', message: ERROR_MESSAGES.TOO_CLOSE_TO_APPOINTMENT },
              { status: 400 }
            )
          }
        }
        
        // Check max days ahead
        if (bookingSettings.max_booking_days_ahead) {
          const maxMilliseconds = bookingSettings.max_booking_days_ahead * 24 * 60 * 60 * 1000
          const daysAhead = body.newDateTimestamp - now
          
          if (daysAhead > maxMilliseconds) {
            return NextResponse.json(
              { success: false, error: 'DATE_OUT_OF_RANGE', message: ERROR_MESSAGES.DATE_OUT_OF_RANGE },
              { status: 400 }
            )
          }
        }
      }
    }
    
    // ============================================================
    // PHASE 5: Atomic Update with Optimistic Locking
    // ============================================================
    const newVersion = (reservation.version || 1) + 1
    
    // Build update payload — always update version, conditionally update time/service
    const updatePayload: Record<string, unknown> = {
      version: newVersion,
    }
    
    if (timeChanged) {
      updatePayload.date_timestamp = normalizedNewDate
      updatePayload.time_timestamp = normalizedNewTime
      updatePayload.day_name = body.newDayName
      updatePayload.day_num = body.newDayNum
    }
    
    if (serviceChanged) {
      updatePayload.service_id = effectiveServiceId
    }
    
    const { error: updateError } = await supabase
      .from('reservations')
      .update(updatePayload)
      .eq('id', body.reservationId)
      .eq('status', 'confirmed')
      .eq('version', reservation.version || 1)
    
    if (updateError) {
      console.error('[API/Edit] Update error:', updateError)
      
      // Unique constraint violation - slot was just taken
      if (updateError.code === '23505') {
        return NextResponse.json(
          { success: false, error: 'SLOT_ALREADY_TAKEN', message: ERROR_MESSAGES.SLOT_ALREADY_TAKEN },
          { status: 409 }
        )
      }
      
      await reportApiError(
        new Error(updateError.message),
        request,
        'Edit Reservation - Database Error',
        {
          severity: 'critical',
          additionalData: {
            errorCode: updateError.code,
            reservationId: body.reservationId,
            barberId: body.barberId,
          }
        }
      )
      
      return NextResponse.json(
        { success: false, error: 'DATABASE_ERROR', message: ERROR_MESSAGES.DATABASE_ERROR },
        { status: 500 }
      )
    }
    
    // ============================================================
    // PHASE 6: Audit Trail - Record the change
    // ============================================================
    try {
      const oldValues: Record<string, string | number | null> = {
        date_timestamp: reservation.date_timestamp,
        time_timestamp: reservation.time_timestamp,
        day_name: reservation.day_name,
        day_num: reservation.day_num,
      }
      const newValues: Record<string, string | number | null> = {
        date_timestamp: timeChanged ? normalizedNewDate : reservation.date_timestamp,
        time_timestamp: timeChanged ? normalizedNewTime : reservation.time_timestamp,
        day_name: timeChanged ? body.newDayName : reservation.day_name,
        day_num: timeChanged ? body.newDayNum : reservation.day_num,
      }
      
      if (serviceChanged) {
        oldValues.service_id = reservation.service_id
        newValues.service_id = effectiveServiceId
      }
      
      const changedById = callerType === 'admin' ? body.adminId : callerType === 'barber' ? body.barberId : body.customerId
      const reason = callerType === 'admin' ? 'שינוי מועד ע"י המנהל' : callerType === 'barber' ? 'שינוי מועד ע"י הספר' : 'שינוי מועד ע"י הלקוח'
      
      await supabase
        .from('reservation_changes')
        .insert({
          reservation_id: body.reservationId,
          changed_by_type: callerType,
          changed_by_id: changedById,
          change_type: 'updated',
          old_values: oldValues,
          new_values: newValues,
          reason,
        })
    } catch (auditErr) {
      // Don't fail the edit if audit log fails - log and continue
      console.error('[API/Edit] Audit trail error:', auditErr)
      reportServerError(auditErr, 'Edit reservation audit trail failed', {
        route: '/api/reservations/edit',
        severity: 'low',
        additionalData: { reservationId: body.reservationId },
      })
    }
    
    console.log(`[API/Edit] Reservation ${body.reservationId} rescheduled successfully. Version: ${reservation.version} → ${newVersion}`)
    
    return NextResponse.json({
      success: true,
      reservationId: body.reservationId,
      newVersion,
    })
    
  } catch (err) {
    console.error('[API/Edit] Unexpected error:', err)
    
    await reportApiError(
      err instanceof Error ? err : new Error(String(err)),
      request,
      'Edit Reservation - Unexpected Error',
      { severity: 'critical' }
    )
    
    return NextResponse.json(
      { success: false, error: 'UNKNOWN_ERROR', message: ERROR_MESSAGES.UNKNOWN_ERROR },
      { status: 500 }
    )
  }
}
