/**
 * API Route: Barber Preferences
 * 
 * Manages barber notification and booking settings.
 * Uses admin client to bypass RLS.
 * 
 * Methods:
 * - GET: Fetch barber preferences (creates defaults if missing)
 * - PUT: Update barber preferences
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { reportApiError } from '@/lib/bug-reporter/helpers'
import { verifyBarber } from '@/lib/auth/barber-api-auth'
import { z } from 'zod'

const UpdatePreferencesSchema = z.object({
  barberId: z.string().uuid(),
  // Notification settings
  reminder_hours_before: z.number().int().min(0).max(72).optional(),
  notify_on_customer_cancel: z.boolean().optional(),
  notify_on_new_booking: z.boolean().optional(),
  broadcast_enabled: z.boolean().optional(),
  // Booking settings
  max_booking_days_ahead: z.number().int().min(1).max(365).optional(),
  min_hours_before_booking: z.number().min(0).max(72).optional(),
  min_cancel_hours: z.number().min(0).max(72).optional(),
})

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyBarber(request)
    if (!auth.success) return auth.response

    const barberId = auth.barber.id
    const supabase = createAdminClient()

    // Fetch notification settings
    let { data: notifSettings, error: notifError } = await supabase // eslint-disable-line prefer-const
      .from('barber_notification_settings')
      .select('id, barber_id, reminder_hours_before, notify_on_customer_cancel, notify_on_new_booking, broadcast_enabled')
      .eq('barber_id', barberId)
      .maybeSingle()

    // Create defaults if missing
    if (!notifSettings && !notifError) {
      const { data: created, error: createError } = await supabase
        .from('barber_notification_settings')
        .insert({
          barber_id: barberId,
          reminder_hours_before: 3,
          notify_on_customer_cancel: true,
          notify_on_new_booking: true,
          broadcast_enabled: true,
        })
        .select()
        .single()

      if (createError) {
        console.error('[API/barber/preferences] Create notif defaults error:', createError)
      } else {
        notifSettings = created
      }
    }

    // Fetch booking settings
    let { data: bookingSettings, error: bookingError } = await supabase // eslint-disable-line prefer-const
      .from('barber_booking_settings')
      .select('id, barber_id, max_booking_days_ahead, min_hours_before_booking, min_cancel_hours')
      .eq('barber_id', barberId)
      .maybeSingle()

    // Create defaults if missing
    if (!bookingSettings && !bookingError) {
      const { data: created, error: createError } = await supabase
        .from('barber_booking_settings')
        .insert({
          barber_id: barberId,
          max_booking_days_ahead: 15,
          min_hours_before_booking: 1,
          min_cancel_hours: 2,
        })
        .select()
        .single()

      if (createError) {
        console.error('[API/barber/preferences] Create booking defaults error:', createError)
      } else {
        bookingSettings = created
      }
    }

    if (notifError || bookingError) {
      console.error('[API/barber/preferences] Fetch error:', { notifError, bookingError })
    }

    return NextResponse.json({
      success: true,
      data: {
        notification: notifSettings,
        booking: bookingSettings,
      },
    })
  } catch (err) {
    console.error('[API/barber/preferences] GET exception:', err)
    await reportApiError(err instanceof Error ? err : new Error(String(err)), request, 'Get preferences exception')
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

    const parsed = UpdatePreferencesSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'VALIDATION_ERROR', message: parsed.error.issues.map(i => i.message).join(', ') },
        { status: 400 }
      )
    }

    const { barberId, ...fields } = parsed.data
    const supabase = createAdminClient()
    const now = new Date().toISOString()

    // Separate notification and booking fields
    const notifFields: Record<string, unknown> = {}
    const bookingFields: Record<string, unknown> = {}

    if (fields.reminder_hours_before !== undefined) notifFields.reminder_hours_before = fields.reminder_hours_before
    if (fields.notify_on_customer_cancel !== undefined) notifFields.notify_on_customer_cancel = fields.notify_on_customer_cancel
    if (fields.notify_on_new_booking !== undefined) notifFields.notify_on_new_booking = fields.notify_on_new_booking
    if (fields.broadcast_enabled !== undefined) notifFields.broadcast_enabled = fields.broadcast_enabled

    if (fields.max_booking_days_ahead !== undefined) bookingFields.max_booking_days_ahead = fields.max_booking_days_ahead
    if (fields.min_hours_before_booking !== undefined) bookingFields.min_hours_before_booking = fields.min_hours_before_booking
    if (fields.min_cancel_hours !== undefined) bookingFields.min_cancel_hours = fields.min_cancel_hours

    const errors: string[] = []

    // Update notification settings
    if (Object.keys(notifFields).length > 0) {
      const { error } = await supabase
        .from('barber_notification_settings')
        .update({ ...notifFields, updated_at: now })
        .eq('barber_id', barberId)

      if (error) {
        console.error('[API/barber/preferences] Update notif error:', error)
        errors.push(error.message)
      }
    }

    // Update booking settings
    if (Object.keys(bookingFields).length > 0) {
      const { error } = await supabase
        .from('barber_booking_settings')
        .update({ ...bookingFields, updated_at: now })
        .eq('barber_id', barberId)

      if (error) {
        console.error('[API/barber/preferences] Update booking error:', error)
        errors.push(error.message)
      }
    }

    if (errors.length > 0) {
      await reportApiError(new Error(errors.join('; ')), request, 'Update preferences failed')
      return NextResponse.json(
        { success: false, error: 'DATABASE_ERROR', message: 'שגיאה בעדכון ההעדפות' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[API/barber/preferences] PUT exception:', err)
    await reportApiError(err instanceof Error ? err : new Error(String(err)), request, 'Update preferences exception')
    return NextResponse.json(
      { success: false, error: 'UNKNOWN_ERROR', message: 'שגיאה בלתי צפויה' },
      { status: 500 }
    )
  }
}
