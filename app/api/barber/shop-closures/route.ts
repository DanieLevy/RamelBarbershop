/**
 * API Route: Barbershop Closures (Shop-wide)
 * 
 * Manages shop-wide closure days (holidays, renovations, etc.).
 * Uses admin client to bypass RLS.
 * 
 * Methods:
 * - POST: Add a shop closure period
 * - DELETE: Remove a shop closure
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { reportApiError } from '@/lib/bug-reporter/helpers'
import { verifyBarber } from '@/lib/auth/barber-api-auth'
import { z } from 'zod'

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

const CreateShopClosureSchema = z.object({
  barberId: z.string().uuid(),
  start_date: z.string().regex(DATE_REGEX, 'Invalid date format (YYYY-MM-DD)'),
  end_date: z.string().regex(DATE_REGEX, 'Invalid date format (YYYY-MM-DD)'),
  reason: z.string().max(500).nullable().optional(),
})

const DeleteShopClosureSchema = z.object({
  barberId: z.string().uuid(),
  closureId: z.string().uuid(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const auth = await verifyBarber(request, body)
    if (!auth.success) return auth.response

    const parsed = CreateShopClosureSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'VALIDATION_ERROR', message: parsed.error.issues.map(i => i.message).join(', ') },
        { status: 400 }
      )
    }

    const { start_date, end_date, reason } = parsed.data
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('barbershop_closures')
      .insert({
        start_date,
        end_date,
        reason: reason || null,
      })
      .select()
      .single()

    if (error) {
      console.error('[API/barber/shop-closures] Create error:', error)
      await reportApiError(new Error(error.message), request, 'Create shop closure failed')
      return NextResponse.json(
        { success: false, error: 'DATABASE_ERROR', message: 'שגיאה ביצירת סגירת מספרה' },
        { status: 500 }
      )
    }

    revalidateTag('shop-closures', 'max')
    return NextResponse.json({ success: true, data })
  } catch (err) {
    console.error('[API/barber/shop-closures] POST exception:', err)
    await reportApiError(err instanceof Error ? err : new Error(String(err)), request, 'Create shop closure exception')
    return NextResponse.json(
      { success: false, error: 'UNKNOWN_ERROR', message: 'שגיאה בלתי צפויה' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const auth = await verifyBarber(request, body)
    if (!auth.success) return auth.response

    const parsed = DeleteShopClosureSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'VALIDATION_ERROR', message: 'closureId and barberId are required' },
        { status: 400 }
      )
    }

    const { closureId } = parsed.data
    const supabase = createAdminClient()

    const { error } = await supabase
      .from('barbershop_closures')
      .delete()
      .eq('id', closureId)

    if (error) {
      console.error('[API/barber/shop-closures] Delete error:', error)
      await reportApiError(new Error(error.message), request, 'Delete shop closure failed')
      return NextResponse.json(
        { success: false, error: 'DATABASE_ERROR', message: 'שגיאה במחיקת סגירת מספרה' },
        { status: 500 }
      )
    }

    revalidateTag('shop-closures', 'max')
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[API/barber/shop-closures] DELETE exception:', err)
    await reportApiError(err instanceof Error ? err : new Error(String(err)), request, 'Delete shop closure exception')
    return NextResponse.json(
      { success: false, error: 'UNKNOWN_ERROR', message: 'שגיאה בלתי צפויה' },
      { status: 500 }
    )
  }
}
