/**
 * POST /api/barber/update-profile
 *
 * Updates a barber's own profile fields (name, phone, image, etc.).
 * Uses service_role to bypass RLS — verifyBarber ensures the requester
 * is a real barber and can only update their own record.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { reportApiError } from '@/lib/bug-reporter/helpers'
import { verifyBarber, verifyOwnership } from '@/lib/auth/barber-api-auth'
import { z } from 'zod'

const UpdateProfileSchema = z.object({
  barberId: z.string().uuid(),
  fullname: z.string().min(2).max(100).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(20).nullable().optional(),
  img_url: z.string().url().nullable().optional(),
  img_position_x: z.number().min(0).max(100).optional(),
  img_position_y: z.number().min(0).max(100).optional(),
  is_active: z.boolean().optional(),
  username: z.string().min(2).max(50).optional(),
  name_en: z.string().max(100).nullable().optional(),
  instagram_url: z.string().max(500).nullable().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const auth = await verifyBarber(request, body)
    if (!auth.success) return auth.response

    const parsed = UpdateProfileSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'VALIDATION_ERROR', message: parsed.error.issues.map(i => i.message).join(', ') },
        { status: 400 }
      )
    }

    const { barberId, ...updates } = parsed.data

    // Barbers can only update their own profile; admins can update any
    if (!verifyOwnership(auth.barber, barberId)) {
      return NextResponse.json(
        { success: false, error: 'FORBIDDEN', message: 'לא ניתן לעדכן פרופיל של ספר אחר' },
        { status: 403 }
      )
    }

    // Build update object (only include provided fields)
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) updateData[key] = value
    }

    const supabase = createAdminClient()
    const { error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', barberId)
      .eq('is_barber', true)

    if (error) {
      console.error('[API/barber/update-profile] Update error:', error)
      await reportApiError(new Error(error.message), request, 'Update barber profile failed')
      return NextResponse.json(
        { success: false, error: 'DATABASE_ERROR', message: 'שגיאה בעדכון הפרופיל' },
        { status: 500 }
      )
    }

    revalidateTag('barbers', 'max')

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[API/barber/update-profile] Exception:', err)
    await reportApiError(err instanceof Error ? err : new Error(String(err)), request, 'Update barber profile exception')
    return NextResponse.json(
      { success: false, error: 'UNKNOWN_ERROR', message: 'שגיאה בלתי צפויה' },
      { status: 500 }
    )
  }
}
