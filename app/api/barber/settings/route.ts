/**
 * API Route: Barbershop Settings
 * 
 * Manages barbershop-wide settings (name, phone, addresses, social links, schedule).
 * Uses admin client to bypass RLS.
 * 
 * Methods:
 * - PUT: Update barbershop settings
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { reportApiError } from '@/lib/bug-reporter/helpers'
import { verifyBarber } from '@/lib/auth/barber-api-auth'
import { z } from 'zod'

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/

const UpdateSettingsSchema = z.object({
  barberId: z.string().uuid(),
  settingsId: z.string().uuid(),
  // General info
  name: z.string().min(1).max(200).optional(),
  phone: z.string().max(20).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  // Hero section
  hero_title: z.string().max(200).nullable().optional(),
  hero_subtitle: z.string().max(200).nullable().optional(),
  hero_description: z.string().max(1000).nullable().optional(),
  // Address details
  address_text: z.string().max(500).nullable().optional(),
  address_lat: z.number().nullable().optional(),
  address_lng: z.number().nullable().optional(),
  waze_link: z.string().max(1000).nullable().optional(),
  google_maps_link: z.string().max(1000).nullable().optional(),
  // Contact
  contact_phone: z.string().max(20).nullable().optional(),
  contact_email: z.string().max(200).nullable().optional(),
  contact_whatsapp: z.string().max(20).nullable().optional(),
  // Social
  social_instagram: z.string().max(500).nullable().optional(),
  social_facebook: z.string().max(500).nullable().optional(),
  social_tiktok: z.string().max(500).nullable().optional(),
  // Visibility toggles
  show_phone: z.boolean().optional(),
  show_email: z.boolean().optional(),
  show_whatsapp: z.boolean().optional(),
  show_instagram: z.boolean().optional(),
  show_facebook: z.boolean().optional(),
  show_tiktok: z.boolean().optional(),
  // Booking config
  max_booking_days_ahead: z.number().int().min(1).max(365).optional(),
  // Schedule (from schedule/page.tsx)
  open_days: z.record(z.string(), z.boolean()).optional(),
  work_hours_start: z.string().regex(TIME_REGEX).optional(),
  work_hours_end: z.string().regex(TIME_REGEX).optional(),
})

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const auth = await verifyBarber(request, body)
    if (!auth.success) return auth.response

    const parsed = UpdateSettingsSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'VALIDATION_ERROR', message: parsed.error.issues.map(i => i.message).join(', ') },
        { status: 400 }
      )
    }

    const { barberId: _barberId, settingsId, ...updateFields } = parsed.data
    const supabase = createAdminClient()

    // Build the update object with only provided fields
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
    
    for (const [key, value] of Object.entries(updateFields)) {
      if (value !== undefined) {
        updateData[key] = value
      }
    }

    const { error } = await supabase
      .from('barbershop_settings')
      .update(updateData)
      .eq('id', settingsId)

    if (error) {
      console.error('[API/barber/settings] Update error:', error)
      await reportApiError(new Error(error.message), request, 'Update barbershop settings failed')
      return NextResponse.json(
        { success: false, error: 'DATABASE_ERROR', message: 'שגיאה בעדכון הגדרות המספרה' },
        { status: 500 }
      )
    }

    // Invalidate homepage shop settings cache immediately
    revalidateTag('shop-settings', 'max')

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[API/barber/settings] PUT exception:', err)
    await reportApiError(err instanceof Error ? err : new Error(String(err)), request, 'Update settings exception')
    return NextResponse.json(
      { success: false, error: 'UNKNOWN_ERROR', message: 'שגיאה בלתי צפויה' },
      { status: 500 }
    )
  }
}
