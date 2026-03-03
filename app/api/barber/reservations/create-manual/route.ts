/**
 * API Route: Barber Manual Reservation Creation
 *
 * Allows barbers to create future reservations OUTSIDE their normal working hours
 * or on non-working days (out-of-hours / override mode).
 *
 * Key differences from /api/reservations/create:
 * - Requires barber authentication (verifyBarber + verifyOwnership)
 * - Bypasses: working hours, non-working day, min_hours_before, date_out_of_range
 * - Keeps: slot conflict, barber/shop closures, customer blocking, service ownership
 * - Uses create_reservation_atomic with a large max_days_ahead to bypass date range limit
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { normalizePhone } from '@/lib/utils/formatting'
import { NextRequest, NextResponse } from 'next/server'
import { verifyBarber, verifyOwnership } from '@/lib/auth/barber-api-auth'
import { reportApiError } from '@/lib/bug-reporter/helpers'
import { normalizeToSlotBoundary } from '@/lib/utils'
import { pushService } from '@/lib/push/push-service'
import type { DayOfWeek } from '@/types/database'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const ERROR_MESSAGES: Record<string, string> = {
  VALIDATION_ERROR: 'חסרים נתונים ליצירת התור.',
  BARBER_NOT_FOUND: 'הספר לא נמצא במערכת.',
  BARBER_PAUSED: 'הספר אינו זמין כרגע לקביעת תורים.',
  BARBER_CLOSED: 'הספר ביום חופש בתאריך זה.',
  SHOP_CLOSED: 'המספרה סגורה בתאריך זה.',
  INVALID_SERVICE: 'השירות לא נמצא או לא שייך לספר זה.',
  SLOT_ALREADY_TAKEN: 'השעה כבר נתפסה. אנא בחר שעה אחרת.',
  SLOT_RESERVED_RECURRING: 'השעה שמורה לתור קבוע.',
  SLOT_IN_BREAKOUT: 'השעה לא זמינה - הספר בהפסקה.',
  CUSTOMER_BLOCKED: 'לא ניתן לקבוע תור. הלקוח חסום.',
  CUSTOMER_DOUBLE_BOOKING: 'הלקוח כבר קבע תור בשעה זו.',
  MAX_BOOKINGS_REACHED: 'הלקוח הגיע למקסימום התורים המותרים.',
  DATABASE_ERROR: 'שגיאה ביצירת התור. נסה שוב.',
  UNKNOWN_ERROR: 'שגיאה בלתי צפויה. נסה שוב.',
}

function getDayOfWeekFromTimestamp(timestamp: number): string {
  const date = new Date(timestamp)
  const day = date.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem', weekday: 'long' }).toLowerCase()
  return day
}

function timestampToTimeSlot(timestamp: number): string {
  const date = new Date(timestamp)
  const timeStr = date.toLocaleString('en-US', {
    timeZone: 'Asia/Jerusalem',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const [hours, minutes] = timeStr.split(':')
  return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`
}

function getIsraelDateString(timestamp: number): string {
  const date = new Date(timestamp)
  const year = date.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem', year: 'numeric' })
  const month = date.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem', month: '2-digit' })
  const day = date.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem', day: '2-digit' })
  return `${year}-${month}-${day}`
}

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
    if (message.includes(code)) return code
  }
  return 'DATABASE_ERROR'
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      barberId,
      serviceId,
      customerId,
      customerName,
      customerPhone,
      dateTimestamp,
      timeTimestamp,
      dayName,
      dayNum,
      barberNotes,
    } = body

    // --- Input validation ---
    const validationErrors: string[] = []
    if (!barberId?.trim() || !UUID_REGEX.test(barberId)) validationErrors.push('barberId invalid')
    if (!serviceId?.trim() || !UUID_REGEX.test(serviceId)) validationErrors.push('serviceId invalid')
    if (!customerId?.trim() || !UUID_REGEX.test(customerId)) validationErrors.push('customerId invalid')
    if (!customerName?.trim()) validationErrors.push('customerName required')
    if (!customerPhone?.trim()) validationErrors.push('customerPhone required')
    if (!dateTimestamp || typeof dateTimestamp !== 'number') validationErrors.push('dateTimestamp invalid')
    if (!timeTimestamp || typeof timeTimestamp !== 'number') validationErrors.push('timeTimestamp invalid')
    if (!dayName?.trim()) validationErrors.push('dayName required')
    if (!dayNum?.trim()) validationErrors.push('dayNum required')

    if (validationErrors.length > 0) {
      return NextResponse.json(
        { success: false, error: 'VALIDATION_ERROR', message: ERROR_MESSAGES.VALIDATION_ERROR, details: validationErrors },
        { status: 400 }
      )
    }

    // --- Barber auth ---
    const auth = await verifyBarber(request, body)
    if (!auth.success) return auth.response

    if (!verifyOwnership(auth.barber, barberId)) {
      return NextResponse.json(
        { success: false, error: 'FORBIDDEN', message: 'אין הרשאה ליצור תור עבור ספר אחר' },
        { status: 403 }
      )
    }

    const supabase = createAdminClient()

    const dayOfWeek = getDayOfWeekFromTimestamp(timeTimestamp)
    const timeSlot = timestampToTimeSlot(timeTimestamp)
    const dateString = getIsraelDateString(dateTimestamp)
    const slotMinutes = timeToMinutes(timeSlot)

    // --- Parallel pre-checks (subset - no working hours validation) ---
    const [barberResult, serviceResult, recurringResult, breakoutResult, barberClosuresResult, shopClosuresResult] =
      await Promise.all([
        supabase
          .from('users')
          .select('id, is_active')
          .eq('id', barberId)
          .eq('is_barber', true)
          .single(),

        supabase
          .from('services')
          .select('id, name_he')
          .eq('id', serviceId)
          .eq('barber_id', barberId)
          .eq('is_active', true)
          .maybeSingle(),

        supabase
          .from('recurring_appointments')
          .select('id')
          .eq('barber_id', barberId)
          .eq('day_of_week', dayOfWeek as DayOfWeek)
          .eq('time_slot', timeSlot)
          .eq('is_active', true)
          .maybeSingle(),

        supabase
          .from('barber_breakouts')
          .select('id, start_time, end_time, breakout_type, start_date, end_date, day_of_week')
          .eq('barber_id', barberId)
          .eq('is_active', true),

        supabase
          .from('barber_closures')
          .select('id, start_date, end_date')
          .eq('barber_id', barberId),

        supabase
          .from('barbershop_closures')
          .select('id, start_date, end_date'),
      ])

    // Barber exists and is active
    if (barberResult.error || !barberResult.data) {
      return NextResponse.json(
        { success: false, error: 'BARBER_NOT_FOUND', message: ERROR_MESSAGES.BARBER_NOT_FOUND },
        { status: 400 }
      )
    }
    if (barberResult.data.is_active === false) {
      return NextResponse.json(
        { success: false, error: 'BARBER_PAUSED', message: ERROR_MESSAGES.BARBER_PAUSED },
        { status: 400 }
      )
    }

    // Service belongs to barber
    if (serviceResult.error || !serviceResult.data) {
      return NextResponse.json(
        { success: false, error: 'INVALID_SERVICE', message: ERROR_MESSAGES.INVALID_SERVICE },
        { status: 400 }
      )
    }

    // Barber closures (barber on vacation - hard constraint even for manual bookings)
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

    // Shop closures (shop physically closed - hard constraint)
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

    // Recurring appointment conflict
    if (recurringResult.data) {
      return NextResponse.json(
        { success: false, error: 'SLOT_RESERVED_RECURRING', message: ERROR_MESSAGES.SLOT_RESERVED_RECURRING },
        { status: 409 }
      )
    }

    // Breakout conflicts
    if (breakoutResult.data && breakoutResult.data.length > 0) {
      for (const breakout of breakoutResult.data) {
        let appliesToDate = false
        switch (breakout.breakout_type) {
          case 'single':
            appliesToDate = breakout.start_date === dateString
            break
          case 'date_range':
            appliesToDate = !!(
              breakout.start_date &&
              breakout.end_date &&
              dateString >= breakout.start_date &&
              dateString <= breakout.end_date
            )
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

    // --- Normalize timestamps and create reservation ---
    const normalizedTimeTimestamp = normalizeToSlotBoundary(timeTimestamp)
    const normalizedDateTimestamp = normalizeToSlotBoundary(dateTimestamp)

    // Use a large max_days_ahead to bypass the date range check in the DB function
    // (barbers can book as far ahead as needed)
    const BARBER_MAX_DAYS_AHEAD = 3650 // 10 years

    const { data: reservationId, error } = await supabase.rpc('create_reservation_atomic', {
      p_barber_id: barberId,
      p_service_id: serviceId,
      p_customer_id: customerId,
      p_customer_name: customerName.trim(),
      p_customer_phone: normalizePhone(customerPhone),
      p_date_timestamp: normalizedDateTimestamp,
      p_time_timestamp: normalizedTimeTimestamp,
      p_day_name: dayName,
      p_day_num: dayNum,
      p_barber_notes: barberNotes?.trim() || null,
      p_max_days_ahead: BARBER_MAX_DAYS_AHEAD,
    })

    if (error) {
      console.error('[API/create-manual] Database error:', error)

      const errorCode = parseBookingError(error.message)
      const message = ERROR_MESSAGES[errorCode] || ERROR_MESSAGES.DATABASE_ERROR

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

      if (errorCode !== 'DATABASE_ERROR') {
        return NextResponse.json({ success: false, error: errorCode, message }, { status: 400 })
      }

      await reportApiError(new Error(error.message), request, 'Barber manual create failed', {
        severity: 'critical',
        additionalData: { barberId, customerId, serviceId, dateString, timeSlot },
      })

      return NextResponse.json(
        { success: false, error: 'DATABASE_ERROR', message: ERROR_MESSAGES.DATABASE_ERROR },
        { status: 500 }
      )
    }

    console.log('[API/create-manual] Reservation created:', reservationId)

    // Fire-and-forget: notify customer if they have an account with push subscriptions
    if (customerId) {
      pushService.sendManualBookingCustomerNotification({
        reservationId: reservationId as string,
        customerId,
        barberId,
        customerName: customerName.trim(),
        barberName: auth.barber.fullname ?? '',
        serviceName: serviceResult.data?.name_he ?? 'שירות',
        appointmentTime: normalizedTimeTimestamp,
      }).catch((err) => console.error('[create-manual] Push error:', err))
    }

    return NextResponse.json({ success: true, reservationId })
  } catch (err) {
    console.error('[API/create-manual] Unexpected error:', err)
    await reportApiError(
      err instanceof Error ? err : new Error(String(err)),
      request,
      'Unexpected error in barber manual create',
      { severity: 'critical' }
    )
    return NextResponse.json(
      { success: false, error: 'UNKNOWN_ERROR', message: ERROR_MESSAGES.UNKNOWN_ERROR },
      { status: 500 }
    )
  }
}
