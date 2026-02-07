/**
 * API Route: Barber Closures (Personal Absence Days)
 * 
 * Manages individual barber closure/absence days.
 * Uses admin client to bypass RLS.
 * 
 * Methods:
 * - POST: Add a closure period
 * - DELETE: Remove a closure
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { reportApiError } from '@/lib/bug-reporter/helpers'
import { verifyBarber } from '@/lib/auth/barber-api-auth'
import { z } from 'zod'

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

const CreateClosureSchema = z.object({
  barberId: z.string().uuid(),
  start_date: z.string().regex(DATE_REGEX, 'Invalid date format (YYYY-MM-DD)'),
  end_date: z.string().regex(DATE_REGEX, 'Invalid date format (YYYY-MM-DD)'),
  reason: z.string().max(500).nullable().optional(),
})

const DeleteClosureSchema = z.object({
  barberId: z.string().uuid(),
  closureId: z.string().uuid(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const auth = await verifyBarber(request, body)
    if (!auth.success) return auth.response

    const parsed = CreateClosureSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'VALIDATION_ERROR', message: parsed.error.issues.map(i => i.message).join(', ') },
        { status: 400 }
      )
    }

    const { barberId, start_date, end_date, reason } = parsed.data
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('barber_closures')
      .insert({
        barber_id: barberId,
        start_date,
        end_date,
        reason: reason || null,
      })
      .select()
      .single()

    if (error) {
      console.error('[API/barber/closures] Create error:', error)
      await reportApiError(new Error(error.message), request, 'Create barber closure failed')
      return NextResponse.json(
        { success: false, error: 'DATABASE_ERROR', message: 'שגיאה ביצירת יום היעדרות' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data })
  } catch (err) {
    console.error('[API/barber/closures] POST exception:', err)
    await reportApiError(err instanceof Error ? err : new Error(String(err)), request, 'Create closure exception')
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

    const parsed = DeleteClosureSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'VALIDATION_ERROR', message: 'closureId and barberId are required' },
        { status: 400 }
      )
    }

    const { barberId, closureId } = parsed.data
    const supabase = createAdminClient()

    const { error } = await supabase
      .from('barber_closures')
      .delete()
      .eq('id', closureId)
      .eq('barber_id', barberId)

    if (error) {
      console.error('[API/barber/closures] Delete error:', error)
      await reportApiError(new Error(error.message), request, 'Delete barber closure failed')
      return NextResponse.json(
        { success: false, error: 'DATABASE_ERROR', message: 'שגיאה במחיקת יום היעדרות' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[API/barber/closures] DELETE exception:', err)
    await reportApiError(err instanceof Error ? err : new Error(String(err)), request, 'Delete closure exception')
    return NextResponse.json(
      { success: false, error: 'UNKNOWN_ERROR', message: 'שגיאה בלתי צפויה' },
      { status: 500 }
    )
  }
}
