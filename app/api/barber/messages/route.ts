/**
 * API Route: Barber Messages
 * 
 * Manages barber profile messages displayed to customers.
 * Uses admin client to bypass RLS.
 * 
 * Methods:
 * - POST: Create a new message
 * - PUT: Update a message (content or is_active toggle)
 * - DELETE: Delete a message
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { reportApiError } from '@/lib/bug-reporter/helpers'
import { verifyBarber } from '@/lib/auth/barber-api-auth'
import { z } from 'zod'

const CreateMessageSchema = z.object({
  barberId: z.string().uuid(),
  message: z.string().min(1).max(1000),
  is_active: z.boolean().optional().default(true),
})

const UpdateMessageSchema = z.object({
  barberId: z.string().uuid(),
  messageId: z.string().uuid(),
  message: z.string().min(1).max(1000).optional(),
  is_active: z.boolean().optional(),
})

const DeleteMessageSchema = z.object({
  barberId: z.string().uuid(),
  messageId: z.string().uuid(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const auth = await verifyBarber(request, body)
    if (!auth.success) return auth.response

    const parsed = CreateMessageSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'VALIDATION_ERROR', message: parsed.error.issues.map(i => i.message).join(', ') },
        { status: 400 }
      )
    }

    const { barberId, message, is_active } = parsed.data
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('barber_messages')
      .insert({
        barber_id: barberId,
        message,
        is_active,
      })
      .select()

    if (error) {
      console.error('[API/barber/messages] Create error:', error)
      await reportApiError(new Error(error.message), request, 'Create barber message failed')
      return NextResponse.json(
        { success: false, error: 'DATABASE_ERROR', message: 'שגיאה ביצירת ההודעה' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data })
  } catch (err) {
    console.error('[API/barber/messages] POST exception:', err)
    await reportApiError(err instanceof Error ? err : new Error(String(err)), request, 'Create message exception')
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

    const parsed = UpdateMessageSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'VALIDATION_ERROR', message: parsed.error.issues.map(i => i.message).join(', ') },
        { status: 400 }
      )
    }

    const { barberId, messageId, message, is_active } = parsed.data
    const supabase = createAdminClient()

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (message !== undefined) updateData.message = message
    if (is_active !== undefined) updateData.is_active = is_active

    const { data, error } = await supabase
      .from('barber_messages')
      .update(updateData)
      .eq('id', messageId)
      .eq('barber_id', barberId)
      .select()

    if (error) {
      console.error('[API/barber/messages] Update error:', error)
      await reportApiError(new Error(error.message), request, 'Update barber message failed')
      return NextResponse.json(
        { success: false, error: 'DATABASE_ERROR', message: 'שגיאה בעדכון ההודעה' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data })
  } catch (err) {
    console.error('[API/barber/messages] PUT exception:', err)
    await reportApiError(err instanceof Error ? err : new Error(String(err)), request, 'Update message exception')
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

    const parsed = DeleteMessageSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'VALIDATION_ERROR', message: 'messageId and barberId are required' },
        { status: 400 }
      )
    }

    const { barberId, messageId } = parsed.data
    const supabase = createAdminClient()

    const { error } = await supabase
      .from('barber_messages')
      .delete()
      .eq('id', messageId)
      .eq('barber_id', barberId)

    if (error) {
      console.error('[API/barber/messages] Delete error:', error)
      await reportApiError(new Error(error.message), request, 'Delete barber message failed')
      return NextResponse.json(
        { success: false, error: 'DATABASE_ERROR', message: 'שגיאה במחיקת ההודעה' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[API/barber/messages] DELETE exception:', err)
    await reportApiError(err instanceof Error ? err : new Error(String(err)), request, 'Delete message exception')
    return NextResponse.json(
      { success: false, error: 'UNKNOWN_ERROR', message: 'שגיאה בלתי צפויה' },
      { status: 500 }
    )
  }
}
