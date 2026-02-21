/**
 * POST /api/barber/set-password
 *
 * Sets or changes a barber's password.
 * - If oldPassword is provided: verifies it before allowing the change.
 * - Admin role: can set any barber's password without oldPassword.
 * Uses service_role to bypass RLS.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { reportApiError } from '@/lib/bug-reporter/helpers'
import { verifyBarber, verifyOwnership } from '@/lib/auth/barber-api-auth'
import { z } from 'zod'
import bcrypt from 'bcryptjs'

const SALT_ROUNDS = 10

const SetPasswordSchema = z.object({
  barberId: z.string().uuid(),
  targetBarberId: z.string().uuid(),
  newPassword: z.string().min(6, 'סיסמה חייבת להכיל לפחות 6 תווים'),
  oldPassword: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const auth = await verifyBarber(request, body)
    if (!auth.success) return auth.response

    const parsed = SetPasswordSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message || 'נתונים לא תקינים' },
        { status: 400 }
      )
    }

    const { targetBarberId, newPassword, oldPassword } = parsed.data

    // Non-admins can only change their own password
    if (!verifyOwnership(auth.barber, targetBarberId)) {
      return NextResponse.json(
        { success: false, error: 'FORBIDDEN', message: 'לא ניתן לשנות סיסמה של ספר אחר' },
        { status: 403 }
      )
    }

    const supabase = createAdminClient()

    // If oldPassword provided, verify it before allowing the change
    if (oldPassword) {
      const { data: barber, error: fetchError } = await supabase
        .from('users')
        .select('password_hash')
        .eq('id', targetBarberId)
        .eq('is_barber', true)
        .maybeSingle()

      if (fetchError || !barber) {
        return NextResponse.json(
          { success: false, error: 'NOT_FOUND', message: 'ספר לא נמצא' },
          { status: 404 }
        )
      }

      if (barber.password_hash) {
        const isValid = await bcrypt.compare(oldPassword, barber.password_hash)
        if (!isValid) {
          return NextResponse.json(
            { success: false, error: 'WRONG_PASSWORD', message: 'הסיסמה הנוכחית שגויה' },
            { status: 401 }
          )
        }
      }
    }

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS)

    const { error } = await supabase
      .from('users')
      .update({ password_hash: passwordHash, updated_at: new Date().toISOString() })
      .eq('id', targetBarberId)
      .eq('is_barber', true)

    if (error) {
      console.error('[API/barber/set-password] Update error:', error)
      await reportApiError(new Error(error.message), request, 'Set barber password failed')
      return NextResponse.json(
        { success: false, error: 'DATABASE_ERROR', message: 'שגיאה בעדכון הסיסמה' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[API/barber/set-password] Exception:', err)
    await reportApiError(err instanceof Error ? err : new Error(String(err)), request, 'Set barber password exception')
    return NextResponse.json(
      { success: false, error: 'UNKNOWN_ERROR', message: 'שגיאה בלתי צפויה' },
      { status: 500 }
    )
  }
}
