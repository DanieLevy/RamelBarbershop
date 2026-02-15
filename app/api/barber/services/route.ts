/**
 * API Route: Barber Services
 * 
 * CRUD operations for barber services.
 * All write operations require barber verification via verifyBarber().
 * Uses admin client to bypass RLS.
 * 
 * Methods:
 * - POST: Create a new service
 * - PUT: Update an existing service
 * - DELETE: Delete a service
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { reportApiError } from '@/lib/bug-reporter/helpers'
import { verifyBarber, verifyOwnership } from '@/lib/auth/barber-api-auth'
import { z } from 'zod'

const ServiceSchema = z.object({
  barberId: z.string().uuid(),
  name: z.string().max(200).optional(),
  name_he: z.string().min(1, 'שם השירות חובה').max(200),
  description: z.string().max(500).nullable().optional(),
  duration: z.number().int().min(5),
  price: z.number().min(0),
  is_active: z.boolean().optional().default(true),
})

const UpdateServiceSchema = ServiceSchema.extend({
  serviceId: z.string().uuid(),
})

const DeleteServiceSchema = z.object({
  barberId: z.string().uuid(),
  serviceId: z.string().uuid(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const auth = await verifyBarber(request, body)
    if (!auth.success) return auth.response

    const parsed = ServiceSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'VALIDATION_ERROR', message: parsed.error.issues.map(i => i.message).join(', ') },
        { status: 400 }
      )
    }

    const { barberId, name, name_he, description, duration, price, is_active } = parsed.data
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('services')
      .insert({
        barber_id: barberId,
        name: name || name_he,
        name_he,
        description: description || null,
        duration,
        price,
        is_active,
      })
      .select()
      .single()

    if (error) {
      console.error('[API/barber/services] Create error:', error)
      await reportApiError(new Error(error.message), request, 'Create service failed')
      return NextResponse.json(
        { success: false, error: 'DATABASE_ERROR', message: `שגיאה ביצירת השירות: ${error.message}` },
        { status: 500 }
      )
    }

    revalidateTag('services', 'max')
    return NextResponse.json({ success: true, data })
  } catch (err) {
    console.error('[API/barber/services] POST exception:', err)
    await reportApiError(err instanceof Error ? err : new Error(String(err)), request, 'Create service exception')
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

    const parsed = UpdateServiceSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'VALIDATION_ERROR', message: parsed.error.issues.map(i => i.message).join(', ') },
        { status: 400 }
      )
    }

    const { barberId, serviceId, name, name_he, description, duration, price, is_active } = parsed.data
    const supabase = createAdminClient()

    // Verify ownership
    const { data: existing } = await supabase
      .from('services')
      .select('barber_id')
      .eq('id', serviceId)
      .maybeSingle()

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'NOT_FOUND', message: 'השירות לא נמצא' },
        { status: 404 }
      )
    }

    if (!verifyOwnership(auth.barber, existing.barber_id || '')) {
      return NextResponse.json(
        { success: false, error: 'FORBIDDEN', message: 'אין הרשאה לעדכן שירות זה' },
        { status: 403 }
      )
    }

    const { data, error } = await supabase
      .from('services')
      .update({
        name: name || name_he,
        name_he,
        description: description || null,
        duration,
        price,
        barber_id: barberId,
        is_active,
      })
      .eq('id', serviceId)
      .select()

    if (error) {
      console.error('[API/barber/services] Update error:', error)
      await reportApiError(new Error(error.message), request, 'Update service failed')
      return NextResponse.json(
        { success: false, error: 'DATABASE_ERROR', message: `שגיאה בעדכון השירות: ${error.message}` },
        { status: 500 }
      )
    }

    revalidateTag('services', 'max')
    return NextResponse.json({ success: true, data })
  } catch (err) {
    console.error('[API/barber/services] PUT exception:', err)
    await reportApiError(err instanceof Error ? err : new Error(String(err)), request, 'Update service exception')
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

    const parsed = DeleteServiceSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'VALIDATION_ERROR', message: 'serviceId and barberId are required' },
        { status: 400 }
      )
    }

    const { barberId, serviceId } = parsed.data
    const supabase = createAdminClient()

    // Verify ownership
    const { data: existing } = await supabase
      .from('services')
      .select('barber_id')
      .eq('id', serviceId)
      .maybeSingle()

    if (existing && !verifyOwnership(auth.barber, existing.barber_id || '')) {
      return NextResponse.json(
        { success: false, error: 'FORBIDDEN', message: 'אין הרשאה למחוק שירות זה' },
        { status: 403 }
      )
    }

    const { error } = await supabase
      .from('services')
      .delete()
      .eq('id', serviceId)
      .eq('barber_id', barberId)

    if (error) {
      console.error('[API/barber/services] Delete error:', error)
      await reportApiError(new Error(error.message), request, 'Delete service failed')
      return NextResponse.json(
        { success: false, error: 'DATABASE_ERROR', message: 'שגיאה במחיקת השירות' },
        { status: 500 }
      )
    }

    revalidateTag('services', 'max')
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[API/barber/services] DELETE exception:', err)
    await reportApiError(err instanceof Error ? err : new Error(String(err)), request, 'Delete service exception')
    return NextResponse.json(
      { success: false, error: 'UNKNOWN_ERROR', message: 'שגיאה בלתי צפויה' },
      { status: 500 }
    )
  }
}
