/**
 * API Route: Barber Management
 * 
 * Admin-only operations for managing barbers.
 * Uses admin client to bypass RLS.
 * 
 * Methods:
 * - DELETE: Cascade delete a barber (all related data)
 * - PUT: Update barber display order
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { reportApiError } from '@/lib/bug-reporter/helpers'
import { verifyAdmin, verifyBarber } from '@/lib/auth/barber-api-auth'
import { z } from 'zod'

const DeleteBarberSchema = z.object({
  barberId: z.string().uuid(),
  targetBarberId: z.string().uuid(),
})

const UpdateOrderSchema = z.object({
  barberId: z.string().uuid(),
  barbers: z.array(z.object({
    id: z.string().uuid(),
    display_order: z.number().int().min(0),
  })),
})

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const auth = await verifyAdmin(request, body)
    if (!auth.success) return auth.response

    const parsed = DeleteBarberSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'VALIDATION_ERROR', message: 'barberId and targetBarberId are required' },
        { status: 400 }
      )
    }

    const { targetBarberId } = parsed.data
    const supabase = createAdminClient()

    // First, cancel all active reservations for this barber
    const { error: cancelError } = await supabase
      .from('reservations')
      .update({
        status: 'cancelled',
        cancelled_by: 'barber',
        cancellation_reason: 'הספר הוסר מהמערכת',
      })
      .eq('barber_id', targetBarberId)
      .eq('status', 'active')

    if (cancelError) {
      console.error('[API/barber/manage] Cancel reservations error:', cancelError)
      await reportApiError(new Error(cancelError.message), request, 'Cancel reservations for deleted barber failed')
      return NextResponse.json(
        { success: false, error: 'DATABASE_ERROR', message: 'שגיאה בביטול תורים של הספר' },
        { status: 500 }
      )
    }

    // Cascade delete related data in order
    const tablesToDelete = [
      { table: 'barber_notification_settings', column: 'barber_id' },
      { table: 'barber_booking_settings', column: 'barber_id' },
      { table: 'barber_closures', column: 'barber_id' },
      { table: 'barber_messages', column: 'barber_id' },
      { table: 'work_days', column: 'user_id' },
      { table: 'push_subscriptions', column: 'barber_id' },
      { table: 'services', column: 'barber_id' },
    ] as const

    for (const { table, column } of tablesToDelete) {
      const { error } = await supabase
        .from(table)
        .delete()
        .eq(column, targetBarberId)

      if (error) {
        console.error(`[API/barber/manage] Delete ${table} error:`, error)
        // Continue with other deletes even if one fails
      }
    }

    // Finally delete the user record
    const { error: deleteError } = await supabase
      .from('users')
      .delete()
      .eq('id', targetBarberId)

    if (deleteError) {
      console.error('[API/barber/manage] Delete user error:', deleteError)
      await reportApiError(new Error(deleteError.message), request, 'Delete barber user record failed')
      return NextResponse.json(
        { success: false, error: 'DATABASE_ERROR', message: 'שגיאה במחיקת הספר' },
        { status: 500 }
      )
    }

    // Invalidate homepage barbers cache immediately
    revalidateTag('barbers', 'max')
    
    console.log('[API/barber/manage] Successfully deleted barber:', targetBarberId)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[API/barber/manage] DELETE exception:', err)
    await reportApiError(err instanceof Error ? err : new Error(String(err)), request, 'Delete barber exception')
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

    const parsed = UpdateOrderSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'VALIDATION_ERROR', message: parsed.error.issues.map(i => i.message).join(', ') },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()
    const errors: string[] = []

    for (const barber of parsed.data.barbers) {
      const { error } = await supabase
        .from('users')
        .update({ display_order: barber.display_order })
        .eq('id', barber.id)

      if (error) {
        console.error(`[API/barber/manage] Update order error for ${barber.id}:`, error)
        errors.push(error.message)
      }
    }

    if (errors.length > 0) {
      return NextResponse.json(
        { success: false, error: 'DATABASE_ERROR', message: 'שגיאה בעדכון סדר הספרים' },
        { status: 500 }
      )
    }

    // Invalidate homepage barbers cache immediately (order changed)
    revalidateTag('barbers', 'max')

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[API/barber/manage] PUT exception:', err)
    await reportApiError(err instanceof Error ? err : new Error(String(err)), request, 'Update barber order exception')
    return NextResponse.json(
      { success: false, error: 'UNKNOWN_ERROR', message: 'שגיאה בלתי צפויה' },
      { status: 500 }
    )
  }
}
