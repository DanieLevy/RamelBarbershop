/**
 * API Route: R2 Image Delete
 *
 * Accepts JSON body:
 *   - barberId (string, UUID)  — for auth verification
 *   - key      (string)        — R2 object key to delete
 *
 * Verifies the barber and deletes the object from R2.
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyBarber } from '@/lib/auth/barber-api-auth'
import { reportApiError } from '@/lib/bug-reporter/helpers'
import { deleteFromR2, isValidR2Key } from '@/lib/r2/client'
import { z } from 'zod'

const DeleteSchema = z.object({
  barberId: z.string().uuid(),
  key: z.string().min(1),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const auth = await verifyBarber(request, body)
    if (!auth.success) return auth.response

    const parsed = DeleteSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'VALIDATION_ERROR', message: parsed.error.issues.map(i => i.message).join(', ') },
        { status: 400 }
      )
    }

    const { key } = parsed.data

    if (!isValidR2Key(key)) {
      return NextResponse.json(
        { success: false, error: 'VALIDATION_ERROR', message: 'Invalid object key prefix' },
        { status: 400 }
      )
    }

    await deleteFromR2(key)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[API/barber/r2/delete] Exception:', err)
    await reportApiError(
      err instanceof Error ? err : new Error(String(err)),
      request,
      'R2 delete failed'
    )
    return NextResponse.json(
      { success: false, error: 'DELETE_ERROR', message: 'שגיאה במחיקת הקובץ' },
      { status: 500 }
    )
  }
}
