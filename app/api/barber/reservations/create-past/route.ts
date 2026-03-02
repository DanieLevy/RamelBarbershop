/**
 * API Route: Create Past (Completed) Reservation
 *
 * Allows barbers to manually record past appointments that were not
 * originally entered in the system (e.g., street walk-ins).
 *
 * Bypasses create_reservation_atomic RPC because it hardcodes status='confirmed'
 * and rejects past timestamps. Uses direct INSERT with status='completed'.
 *
 * The DB trigger validate_reservation_insert has been updated to allow
 * past timestamps when status='completed'.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { normalizePhone } from '@/lib/utils/formatting'
import { NextRequest, NextResponse } from 'next/server'
import { verifyBarber, verifyOwnership } from '@/lib/auth/barber-api-auth'
import { reportApiError } from '@/lib/bug-reporter/helpers'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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
    if (!barberId || !UUID_REGEX.test(barberId)) {
      return NextResponse.json(
        { success: false, error: 'VALIDATION_ERROR', message: 'מזהה ספר לא תקין' },
        { status: 400 }
      )
    }
    if (!serviceId || !UUID_REGEX.test(serviceId)) {
      return NextResponse.json(
        { success: false, error: 'VALIDATION_ERROR', message: 'מזהה שירות לא תקין' },
        { status: 400 }
      )
    }
    if (!customerId || !UUID_REGEX.test(customerId)) {
      return NextResponse.json(
        { success: false, error: 'VALIDATION_ERROR', message: 'מזהה לקוח לא תקין' },
        { status: 400 }
      )
    }
    if (!customerName?.trim()) {
      return NextResponse.json(
        { success: false, error: 'VALIDATION_ERROR', message: 'שם לקוח חסר' },
        { status: 400 }
      )
    }
    if (!customerPhone?.trim()) {
      return NextResponse.json(
        { success: false, error: 'VALIDATION_ERROR', message: 'טלפון לקוח חסר' },
        { status: 400 }
      )
    }
    if (!dateTimestamp || typeof dateTimestamp !== 'number') {
      return NextResponse.json(
        { success: false, error: 'VALIDATION_ERROR', message: 'תאריך לא תקין' },
        { status: 400 }
      )
    }
    if (!timeTimestamp || typeof timeTimestamp !== 'number') {
      return NextResponse.json(
        { success: false, error: 'VALIDATION_ERROR', message: 'שעה לא תקינה' },
        { status: 400 }
      )
    }
    if (!dayName?.trim() || !dayNum?.trim()) {
      return NextResponse.json(
        { success: false, error: 'VALIDATION_ERROR', message: 'פרטי יום חסרים' },
        { status: 400 }
      )
    }

    // Verify timestamp is in the past
    if (timeTimestamp > Date.now()) {
      return NextResponse.json(
        { success: false, error: 'VALIDATION_ERROR', message: 'נקודת קצה זו מיועדת לתורים בעבר בלבד' },
        { status: 400 }
      )
    }

    // --- Auth ---
    const auth = await verifyBarber(request, body)
    if (!auth.success) return auth.response

    if (!verifyOwnership(auth.barber, barberId)) {
      return NextResponse.json(
        { success: false, error: 'FORBIDDEN', message: 'אין הרשאה ליצור תור עבור ספר אחר' },
        { status: 403 }
      )
    }

    const supabase = createAdminClient()

    // --- Validate service belongs to barber ---
    const { data: service, error: serviceError } = await supabase
      .from('services')
      .select('id')
      .eq('id', serviceId)
      .eq('barber_id', barberId)
      .eq('is_active', true)
      .maybeSingle()

    if (serviceError || !service) {
      return NextResponse.json(
        { success: false, error: 'INVALID_SERVICE', message: 'השירות לא נמצא או לא שייך לספר זה' },
        { status: 400 }
      )
    }

    // --- Check for duplicate slot (same barber + time + non-cancelled) ---
    const SLOT_BOUNDARY = 1800000 // 30 minutes in ms
    const slotKey = Math.floor(timeTimestamp / SLOT_BOUNDARY)

    const { data: existing } = await supabase
      .from('reservations')
      .select('id')
      .eq('barber_id', barberId)
      .neq('status', 'cancelled')
      .gte('time_timestamp', slotKey * SLOT_BOUNDARY)
      .lt('time_timestamp', (slotKey + 1) * SLOT_BOUNDARY)
      .limit(1)

    if (existing && existing.length > 0) {
      return NextResponse.json(
        { success: false, error: 'SLOT_ALREADY_TAKEN', message: 'כבר קיים תור במשבצת זמן זו' },
        { status: 409 }
      )
    }

    // --- Insert the completed reservation ---
    const { data: reservation, error: insertError } = await supabase
      .from('reservations')
      .insert({
        barber_id: barberId,
        service_id: serviceId,
        customer_id: customerId,
        customer_name: customerName.trim(),
        customer_phone: normalizePhone(customerPhone),
        date_timestamp: dateTimestamp,
        time_timestamp: timeTimestamp,
        day_name: dayName,
        day_num: dayNum,
        status: 'completed',
        barber_notes: barberNotes?.trim() || null,
      })
      .select('id')
      .single()

    if (insertError) {
      console.error('[API/create-past] Insert error:', insertError.message)
      await reportApiError(
        new Error(insertError.message),
        request,
        'Create past reservation failed',
        { severity: 'high', additionalData: { barberId, serviceId, timeTimestamp } }
      )
      return NextResponse.json(
        { success: false, error: 'DATABASE_ERROR', message: 'שגיאה ביצירת התור' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      reservationId: reservation.id,
    })
  } catch (err) {
    console.error('[API/create-past] Unexpected error:', err)
    await reportApiError(
      err instanceof Error ? err : new Error(String(err)),
      request,
      'Unexpected error creating past reservation',
      { severity: 'high' }
    )
    return NextResponse.json(
      { success: false, error: 'UNEXPECTED_ERROR', message: 'שגיאה בלתי צפויה' },
      { status: 500 }
    )
  }
}
