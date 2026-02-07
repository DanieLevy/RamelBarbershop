/**
 * API Route: Barber Gallery
 * 
 * Manages barber gallery images.
 * Uses admin client to bypass RLS.
 * 
 * Methods:
 * - POST: Add a gallery image
 * - PUT: Update image display order or position
 * - DELETE: Remove a gallery image
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { reportApiError } from '@/lib/bug-reporter/helpers'
import { verifyBarber } from '@/lib/auth/barber-api-auth'
import { z } from 'zod'

const AddImageSchema = z.object({
  barberId: z.string().uuid(),
  image_url: z.string().min(1),
  display_order: z.number().int().min(0).optional().default(0),
  caption: z.string().max(500).nullable().optional(),
})

const UpdateImageSchema = z.object({
  barberId: z.string().uuid(),
  imageId: z.string().uuid(),
  display_order: z.number().int().min(0).optional(),
  position_x: z.number().int().min(0).max(100).optional(),
  position_y: z.number().int().min(0).max(100).optional(),
  caption: z.string().max(500).nullable().optional(),
})

const UpdateOrderSchema = z.object({
  barberId: z.string().uuid(),
  images: z.array(z.object({
    id: z.string().uuid(),
    display_order: z.number().int().min(0),
  })),
})

const DeleteImageSchema = z.object({
  barberId: z.string().uuid(),
  imageId: z.string().uuid(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const auth = await verifyBarber(request, body)
    if (!auth.success) return auth.response

    const parsed = AddImageSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'VALIDATION_ERROR', message: parsed.error.issues.map(i => i.message).join(', ') },
        { status: 400 }
      )
    }

    const { barberId, image_url, display_order, caption } = parsed.data
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('barber_gallery')
      .insert({
        barber_id: barberId,
        image_url,
        display_order,
        caption: caption || null,
      })
      .select()
      .single()

    if (error) {
      console.error('[API/barber/gallery] Create error:', error)
      await reportApiError(new Error(error.message), request, 'Add gallery image failed')
      return NextResponse.json(
        { success: false, error: 'DATABASE_ERROR', message: 'שגיאה בהוספת תמונה' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data })
  } catch (err) {
    console.error('[API/barber/gallery] POST exception:', err)
    await reportApiError(err instanceof Error ? err : new Error(String(err)), request, 'Add gallery image exception')
    return NextResponse.json(
      { success: false, error: 'UNKNOWN_ERROR', message: 'שגיאה בלתי צפויה' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const auth = await verifyBarber(request, body)
    if (!auth.success) return auth.response

    // Check if this is a bulk order update or single image update
    if (body.images && Array.isArray(body.images)) {
      const parsed = UpdateOrderSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json(
          { success: false, error: 'VALIDATION_ERROR', message: parsed.error.issues.map(i => i.message).join(', ') },
          { status: 400 }
        )
      }

      const supabase = createAdminClient()
      const errors: string[] = []

      for (const img of parsed.data.images) {
        const { error } = await supabase
          .from('barber_gallery')
          .update({ display_order: img.display_order })
          .eq('id', img.id)
          .eq('barber_id', parsed.data.barberId)

        if (error) errors.push(error.message)
      }

      if (errors.length > 0) {
        return NextResponse.json(
          { success: false, error: 'DATABASE_ERROR', message: 'שגיאה בעדכון סדר התמונות' },
          { status: 500 }
        )
      }

      return NextResponse.json({ success: true })
    }

    // Single image update
    const parsed = UpdateImageSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'VALIDATION_ERROR', message: parsed.error.issues.map(i => i.message).join(', ') },
        { status: 400 }
      )
    }

    const { barberId, imageId, ...updateFields } = parsed.data
    const supabase = createAdminClient()

    const updateData: Record<string, unknown> = {}
    if (updateFields.display_order !== undefined) updateData.display_order = updateFields.display_order
    if (updateFields.position_x !== undefined) updateData.position_x = updateFields.position_x
    if (updateFields.position_y !== undefined) updateData.position_y = updateFields.position_y
    if (updateFields.caption !== undefined) updateData.caption = updateFields.caption

    const { error } = await supabase
      .from('barber_gallery')
      .update(updateData)
      .eq('id', imageId)
      .eq('barber_id', barberId)

    if (error) {
      console.error('[API/barber/gallery] Update error:', error)
      await reportApiError(new Error(error.message), request, 'Update gallery image failed')
      return NextResponse.json(
        { success: false, error: 'DATABASE_ERROR', message: 'שגיאה בעדכון התמונה' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[API/barber/gallery] PUT exception:', err)
    await reportApiError(err instanceof Error ? err : new Error(String(err)), request, 'Update gallery exception')
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

    const parsed = DeleteImageSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'VALIDATION_ERROR', message: 'imageId and barberId are required' },
        { status: 400 }
      )
    }

    const { barberId, imageId } = parsed.data
    const supabase = createAdminClient()

    const { error } = await supabase
      .from('barber_gallery')
      .delete()
      .eq('id', imageId)
      .eq('barber_id', barberId)

    if (error) {
      console.error('[API/barber/gallery] Delete error:', error)
      await reportApiError(new Error(error.message), request, 'Delete gallery image failed')
      return NextResponse.json(
        { success: false, error: 'DATABASE_ERROR', message: 'שגיאה במחיקת התמונה' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[API/barber/gallery] DELETE exception:', err)
    await reportApiError(err instanceof Error ? err : new Error(String(err)), request, 'Delete gallery exception')
    return NextResponse.json(
      { success: false, error: 'UNKNOWN_ERROR', message: 'שגיאה בלתי צפויה' },
      { status: 500 }
    )
  }
}
