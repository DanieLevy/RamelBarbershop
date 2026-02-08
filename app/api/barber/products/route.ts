/**
 * API Route: Barber Products
 * 
 * Manages products sold by the barbershop.
 * Uses admin client to bypass RLS.
 * 
 * Methods:
 * - POST: Create a new product
 * - PUT: Update a product (content or is_active toggle)
 * - DELETE: Delete a product
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { reportApiError } from '@/lib/bug-reporter/helpers'
import { verifyBarber } from '@/lib/auth/barber-api-auth'
import { z } from 'zod'

const CreateProductSchema = z.object({
  barberId: z.string().uuid(),
  name: z.string().max(200).optional(),
  name_he: z.string().min(1).max(200),
  description: z.string().max(1000).nullable().optional(),
  price: z.number().min(0),
  image_url: z.string().nullable().optional(),
  is_active: z.boolean().optional().default(true),
  display_order: z.number().int().min(0).optional().default(0),
})

const UpdateProductSchema = z.object({
  barberId: z.string().uuid(),
  productId: z.string().uuid(),
  name: z.string().max(200).optional(),
  name_he: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  price: z.number().min(0).optional(),
  image_url: z.string().nullable().optional(),
  is_active: z.boolean().optional(),
})

const DeleteProductSchema = z.object({
  barberId: z.string().uuid(),
  productId: z.string().uuid(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const auth = await verifyBarber(request, body)
    if (!auth.success) return auth.response

    const parsed = CreateProductSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'VALIDATION_ERROR', message: parsed.error.issues.map(i => i.message).join(', ') },
        { status: 400 }
      )
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { barberId: _barberId, name, name_he, description, price, image_url, is_active, display_order } = parsed.data
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('products')
      .insert({
        name: name || name_he,
        name_he,
        description: description || null,
        price,
        image_url: image_url || null,
        is_active,
        display_order,
      })
      .select()
      .single()

    if (error) {
      console.error('[API/barber/products] Create error:', error)
      await reportApiError(new Error(error.message), request, 'Create product failed')
      return NextResponse.json(
        { success: false, error: 'DATABASE_ERROR', message: 'שגיאה ביצירת המוצר' },
        { status: 500 }
      )
    }

    revalidateTag('products', 'max')
    return NextResponse.json({ success: true, data })
  } catch (err) {
    console.error('[API/barber/products] POST exception:', err)
    await reportApiError(err instanceof Error ? err : new Error(String(err)), request, 'Create product exception')
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

    const parsed = UpdateProductSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'VALIDATION_ERROR', message: parsed.error.issues.map(i => i.message).join(', ') },
        { status: 400 }
      )
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { barberId: _barberId, productId, ...updateFields } = parsed.data
    const supabase = createAdminClient()

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (updateFields.name !== undefined) updateData.name = updateFields.name
    if (updateFields.name_he !== undefined) updateData.name_he = updateFields.name_he
    if (updateFields.description !== undefined) updateData.description = updateFields.description || null
    if (updateFields.price !== undefined) updateData.price = updateFields.price
    if (updateFields.image_url !== undefined) updateData.image_url = updateFields.image_url || null
    if (updateFields.is_active !== undefined) updateData.is_active = updateFields.is_active

    const { data, error } = await supabase
      .from('products')
      .update(updateData)
      .eq('id', productId)
      .select()

    if (error) {
      console.error('[API/barber/products] Update error:', error)
      await reportApiError(new Error(error.message), request, 'Update product failed')
      return NextResponse.json(
        { success: false, error: 'DATABASE_ERROR', message: 'שגיאה בעדכון המוצר' },
        { status: 500 }
      )
    }

    revalidateTag('products', 'max')
    return NextResponse.json({ success: true, data })
  } catch (err) {
    console.error('[API/barber/products] PUT exception:', err)
    await reportApiError(err instanceof Error ? err : new Error(String(err)), request, 'Update product exception')
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

    const parsed = DeleteProductSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'VALIDATION_ERROR', message: 'productId and barberId are required' },
        { status: 400 }
      )
    }

    const { productId } = parsed.data
    const supabase = createAdminClient()

    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', productId)

    if (error) {
      console.error('[API/barber/products] Delete error:', error)
      await reportApiError(new Error(error.message), request, 'Delete product failed')
      return NextResponse.json(
        { success: false, error: 'DATABASE_ERROR', message: 'שגיאה במחיקת המוצר' },
        { status: 500 }
      )
    }

    revalidateTag('products', 'max')
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[API/barber/products] DELETE exception:', err)
    await reportApiError(err instanceof Error ? err : new Error(String(err)), request, 'Delete product exception')
    return NextResponse.json(
      { success: false, error: 'UNKNOWN_ERROR', message: 'שגיאה בלתי צפויה' },
      { status: 500 }
    )
  }
}
