/**
 * API Route: Barber Special Days
 *
 * Barbers declare specific dates when they will work, even if
 * that day-of-week is normally off (e.g., Erev Purim, Erev Pesach).
 *
 * Methods:
 * - GET:    ?barberId=X — returns upcoming special days for barber
 * - POST:   { barberId, date, startTime, endTime, reason? } — create
 * - DELETE: { barberId, id } — delete by id
 *
 * Auth: verifyBarber(). Admin can pass any barberId; regular barber must match own id.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { reportApiError } from '@/lib/bug-reporter/helpers'
import { verifyBarber, verifyOwnership } from '@/lib/auth/barber-api-auth'
import { getTodayDateString } from '@/lib/utils'
import { z } from 'zod'

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/
const TIME_REGEX = /^\d{2}:\d{2}$/

const CreateSchema = z.object({
  barberId: z.string().uuid(),
  date: z.string().regex(DATE_REGEX, 'Invalid date format (YYYY-MM-DD)'),
  startTime: z.string().regex(TIME_REGEX, 'Invalid time format (HH:MM)'),
  endTime: z.string().regex(TIME_REGEX, 'Invalid time format (HH:MM)'),
  reason: z.string().max(500).nullable().optional(),
})

const DeleteSchema = z.object({
  barberId: z.string().uuid(),
  id: z.string().uuid(),
})

export async function GET(request: NextRequest) {
  try {
    const body = { barberId: request.nextUrl.searchParams.get('barberId') }
    const auth = await verifyBarber(request, body as Record<string, unknown>)
    if (!auth.success) return auth.response

    const barberId = body.barberId!
    if (!verifyOwnership(auth.barber, barberId)) {
      return NextResponse.json(
        { success: false, error: 'FORBIDDEN', message: 'אין הרשאה לצפות בימים מיוחדים של ספר אחר' },
        { status: 403 }
      )
    }

    const supabase = createAdminClient()
    const today = getTodayDateString()

    const { data, error } = await supabase
      .from('barber_special_days')
      .select('id, barber_id, date, start_time, end_time, reason, created_at')
      .eq('barber_id', barberId)
      .gte('date', today)
      .order('date', { ascending: true })

    if (error) {
      console.error('[API/barber/special-days] GET error:', error)
      return NextResponse.json(
        { success: false, error: 'DATABASE_ERROR', message: 'שגיאה בטעינת ימים מיוחדים' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data })
  } catch (err) {
    await reportApiError(err instanceof Error ? err : new Error(String(err)), request, 'GET barber special days')
    return NextResponse.json({ success: false, error: 'UNKNOWN_ERROR', message: 'שגיאה בלתי צפויה' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const auth = await verifyBarber(request, body)
    if (!auth.success) return auth.response

    if (!verifyOwnership(auth.barber, body.barberId)) {
      return NextResponse.json(
        { success: false, error: 'FORBIDDEN', message: 'אין הרשאה לנהל ימים מיוחדים של ספר אחר' },
        { status: 403 }
      )
    }

    const parsed = CreateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'VALIDATION_ERROR', message: parsed.error.issues.map(i => i.message).join(', ') },
        { status: 400 }
      )
    }

    const { barberId, date, startTime, endTime, reason } = parsed.data

    // Validate startTime < endTime
    if (startTime >= endTime) {
      return NextResponse.json(
        { success: false, error: 'VALIDATION_ERROR', message: 'שעת ההתחלה חייבת להיות לפני שעת הסיום' },
        { status: 400 }
      )
    }

    // Validate date is not in the past (Israel timezone)
    const today = getTodayDateString()
    if (date < today) {
      return NextResponse.json(
        { success: false, error: 'VALIDATION_ERROR', message: 'לא ניתן להוסיף יום מיוחד בעבר' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('barber_special_days')
      .insert({
        barber_id: barberId,
        date,
        start_time: startTime,
        end_time: endTime,
        reason: reason || null,
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { success: false, error: 'DUPLICATE', message: 'כבר קיים יום מיוחד לתאריך זה' },
          { status: 409 }
        )
      }
      console.error('[API/barber/special-days] POST error:', error)
      await reportApiError(new Error(error.message), request, 'Create barber special day failed')
      return NextResponse.json(
        { success: false, error: 'DATABASE_ERROR', message: 'שגיאה ביצירת יום מיוחד' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (err) {
    await reportApiError(err instanceof Error ? err : new Error(String(err)), request, 'POST barber special day')
    return NextResponse.json({ success: false, error: 'UNKNOWN_ERROR', message: 'שגיאה בלתי צפויה' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const auth = await verifyBarber(request, body)
    if (!auth.success) return auth.response

    if (!verifyOwnership(auth.barber, body.barberId)) {
      return NextResponse.json(
        { success: false, error: 'FORBIDDEN', message: 'אין הרשאה למחוק ימים מיוחדים של ספר אחר' },
        { status: 403 }
      )
    }

    const parsed = DeleteSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'VALIDATION_ERROR', message: 'id and barberId are required' },
        { status: 400 }
      )
    }

    const { barberId, id } = parsed.data
    const supabase = createAdminClient()

    const { error } = await supabase
      .from('barber_special_days')
      .delete()
      .eq('id', id)
      .eq('barber_id', barberId)

    if (error) {
      console.error('[API/barber/special-days] DELETE error:', error)
      await reportApiError(new Error(error.message), request, 'Delete barber special day failed')
      return NextResponse.json(
        { success: false, error: 'DATABASE_ERROR', message: 'שגיאה במחיקת יום מיוחד' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    await reportApiError(err instanceof Error ? err : new Error(String(err)), request, 'DELETE barber special day')
    return NextResponse.json({ success: false, error: 'UNKNOWN_ERROR', message: 'שגיאה בלתי צפויה' }, { status: 500 })
  }
}
