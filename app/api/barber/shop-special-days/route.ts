/**
 * API Route: Shop Special Days (Admin Only)
 *
 * Admin declares specific dates when the shop is open,
 * even if that day-of-week is normally closed.
 *
 * Methods:
 * - GET:    returns all shop special days (upcoming + recent)
 * - POST:   { barberId, date, startTime, endTime, reason? } — create
 * - DELETE: { barberId, id } — delete by id
 *
 * Auth: verifyBarber() + admin role check.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { reportApiError } from '@/lib/bug-reporter/helpers'
import { verifyAdmin } from '@/lib/auth/barber-api-auth'
import { addDaysToDateString, getTodayDateString } from '@/lib/utils'
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
    const auth = await verifyAdmin(request, body as Record<string, unknown>)
    if (!auth.success) return auth.response

    const supabase = createAdminClient()
    // Show upcoming + last 30 days of past
    const monthAgo = addDaysToDateString(getTodayDateString(), -30)

    const { data, error } = await supabase
      .from('shop_special_days')
      .select('id, date, start_time, end_time, reason, created_at')
      .gte('date', monthAgo)
      .order('date', { ascending: true })

    if (error) {
      console.error('[API/barber/shop-special-days] GET error:', error)
      return NextResponse.json(
        { success: false, error: 'DATABASE_ERROR', message: 'שגיאה בטעינת ימי פתיחה מיוחדים' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data })
  } catch (err) {
    await reportApiError(err instanceof Error ? err : new Error(String(err)), request, 'GET shop special days')
    return NextResponse.json({ success: false, error: 'UNKNOWN_ERROR', message: 'שגיאה בלתי צפויה' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const auth = await verifyAdmin(request, body)
    if (!auth.success) return auth.response

    const parsed = CreateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'VALIDATION_ERROR', message: parsed.error.issues.map(i => i.message).join(', ') },
        { status: 400 }
      )
    }

    const { date, startTime, endTime, reason } = parsed.data

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
        { success: false, error: 'VALIDATION_ERROR', message: 'לא ניתן להוסיף יום פתיחה מיוחד בעבר' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('shop_special_days')
      .insert({
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
          { success: false, error: 'DUPLICATE', message: 'כבר קיים יום פתיחה מיוחד לתאריך זה' },
          { status: 409 }
        )
      }
      console.error('[API/barber/shop-special-days] POST error:', error)
      await reportApiError(new Error(error.message), request, 'Create shop special day failed')
      return NextResponse.json(
        { success: false, error: 'DATABASE_ERROR', message: 'שגיאה ביצירת יום פתיחה מיוחד' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (err) {
    await reportApiError(err instanceof Error ? err : new Error(String(err)), request, 'POST shop special day')
    return NextResponse.json({ success: false, error: 'UNKNOWN_ERROR', message: 'שגיאה בלתי צפויה' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const auth = await verifyAdmin(request, body)
    if (!auth.success) return auth.response

    const parsed = DeleteSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'VALIDATION_ERROR', message: 'id and barberId are required' },
        { status: 400 }
      )
    }

    const { id } = parsed.data
    const supabase = createAdminClient()

    const { error } = await supabase
      .from('shop_special_days')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('[API/barber/shop-special-days] DELETE error:', error)
      await reportApiError(new Error(error.message), request, 'Delete shop special day failed')
      return NextResponse.json(
        { success: false, error: 'DATABASE_ERROR', message: 'שגיאה במחיקת יום פתיחה מיוחד' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    await reportApiError(err instanceof Error ? err : new Error(String(err)), request, 'DELETE shop special day')
    return NextResponse.json({ success: false, error: 'UNKNOWN_ERROR', message: 'שגיאה בלתי צפויה' }, { status: 500 })
  }
}
