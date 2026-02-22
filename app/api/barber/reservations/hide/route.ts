/**
 * API Route: Hide Reservation from Barber View
 *
 * Soft-deletes a reservation by setting barber_hidden_at.
 * The reservation remains visible to the customer.
 *
 * Only allowed for:
 *  - completed reservations
 *  - barber-cancelled reservations (cancelled_by = 'barber')
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { verifyBarber, verifyOwnership } from '@/lib/auth/barber-api-auth'
import { reportApiError } from '@/lib/bug-reporter/helpers'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { reservationId } = body

    if (!reservationId || !UUID_REGEX.test(reservationId)) {
      return NextResponse.json(
        { success: false, error: 'מזהה תור לא תקין' },
        { status: 400 }
      )
    }

    const auth = await verifyBarber(request, body)
    if (!auth.success) return auth.response

    const supabase = createAdminClient()

    const { data: reservation, error: fetchError } = await supabase
      .from('reservations')
      .select('id, barber_id, status, cancelled_by, barber_hidden_at')
      .eq('id', reservationId)
      .maybeSingle()

    if (fetchError) {
      console.error('[API/hide] Fetch error:', fetchError.message)
      return NextResponse.json(
        { success: false, error: 'שגיאה בטעינת התור' },
        { status: 500 }
      )
    }

    if (!reservation) {
      return NextResponse.json(
        { success: false, error: 'התור לא נמצא' },
        { status: 404 }
      )
    }

    if (!verifyOwnership(auth.barber, reservation.barber_id)) {
      return NextResponse.json(
        { success: false, error: 'אין הרשאה לתור זה' },
        { status: 403 }
      )
    }

    if (reservation.barber_hidden_at) {
      return NextResponse.json({ success: true, alreadyHidden: true })
    }

    const isCompleted = reservation.status === 'completed'
    const isBarberCancelled = reservation.status === 'cancelled' && reservation.cancelled_by === 'barber'

    if (!isCompleted && !isBarberCancelled) {
      return NextResponse.json(
        { success: false, error: 'ניתן להסתיר רק תורים שהסתיימו או בוטלו על ידי הספר' },
        { status: 400 }
      )
    }

    const { error: updateError } = await supabase
      .from('reservations')
      .update({ barber_hidden_at: new Date().toISOString() })
      .eq('id', reservationId)

    if (updateError) {
      console.error('[API/hide] Update error:', updateError.message)
      await reportApiError(new Error(updateError.message), request, 'Hide reservation failed', {
        severity: 'high',
        additionalData: { reservationId },
      })
      return NextResponse.json(
        { success: false, error: 'שגיאה בהסתרת התור' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[API/hide] Unexpected error:', err)
    await reportApiError(
      err instanceof Error ? err : new Error(String(err)),
      request,
      'Unexpected error hiding reservation',
      { severity: 'high' }
    )
    return NextResponse.json(
      { success: false, error: 'שגיאה בלתי צפויה' },
      { status: 500 }
    )
  }
}
