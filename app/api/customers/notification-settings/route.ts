/**
 * GET/POST /api/customers/notification-settings
 * 
 * Get or update customer notification settings.
 * Uses service_role to bypass RLS for secure settings management.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { reportServerError } from '@/lib/bug-reporter/helpers'

const updateSettingsSchema = z.object({
  customerId: z.string().uuid('מזהה לקוח לא תקין'),
  pwaInstalled: z.boolean().optional(),
  notificationsEnabled: z.boolean().optional(),
  reminderEnabled: z.boolean().optional(),
  cancellationAlertsEnabled: z.boolean().optional(),
  smsReminderEnabled: z.boolean().optional(),
  pushReminderEnabled: z.boolean().optional(),
  reminderMethod: z.enum(['sms', 'push', 'both', 'none']).optional(),
})

export async function GET(request: NextRequest) {
  const requestId = `settings-get-${Date.now()}`
  
  try {
    const { searchParams } = new URL(request.url)
    const customerId = searchParams.get('customerId')
    
    if (!customerId) {
      return NextResponse.json(
        { success: false, error: 'מזהה לקוח חסר' },
        { status: 400 }
      )
    }
    
    const supabase = createAdminClient()
    
    const { data: settings, error } = await supabase
      .from('customer_notification_settings')
      .select('*')
      .eq('customer_id', customerId)
      .maybeSingle()
    
    if (error) {
      console.error(`[${requestId}] Error fetching settings:`, error)
      throw error
    }
    
    // Return default settings if none exist
    if (!settings) {
      return NextResponse.json({
        success: true,
        settings: {
          customer_id: customerId,
          pwa_installed: false,
          notifications_enabled: false,
          reminder_enabled: true,
          cancellation_alerts_enabled: true,
          sms_reminder_enabled: true,
          push_reminder_enabled: true,
          reminder_method: 'both',
        }
      })
    }
    
    return NextResponse.json({ success: true, settings })
    
  } catch (error) {
    console.error(`[${requestId}] Error fetching notification settings:`, error)
    
    await reportServerError(error, 'GET /api/customers/notification-settings', {
      route: '/api/customers/notification-settings',
    })
    
    return NextResponse.json(
      { success: false, error: 'שגיאה בקריאת הגדרות' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const requestId = `settings-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  
  try {
    const body = await request.json()
    const validation = updateSettingsSchema.safeParse(body)
    
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.issues[0]?.message || 'נתונים לא תקינים' },
        { status: 400 }
      )
    }
    
    const { customerId, ...settings } = validation.data
    
    console.log(`[${requestId}] Updating notification settings for customer ${customerId}`)
    
    const supabase = createAdminClient()
    
    // Build update data with snake_case column names
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }
    
    if (settings.pwaInstalled !== undefined) updateData.pwa_installed = settings.pwaInstalled
    if (settings.notificationsEnabled !== undefined) updateData.notifications_enabled = settings.notificationsEnabled
    if (settings.reminderEnabled !== undefined) updateData.reminder_enabled = settings.reminderEnabled
    if (settings.cancellationAlertsEnabled !== undefined) updateData.cancellation_alerts_enabled = settings.cancellationAlertsEnabled
    if (settings.smsReminderEnabled !== undefined) updateData.sms_reminder_enabled = settings.smsReminderEnabled
    if (settings.pushReminderEnabled !== undefined) updateData.push_reminder_enabled = settings.pushReminderEnabled
    if (settings.reminderMethod !== undefined) updateData.reminder_method = settings.reminderMethod
    
    // Check if settings exist
    const { data: existing } = await supabase
      .from('customer_notification_settings')
      .select('id')
      .eq('customer_id', customerId)
      .maybeSingle()
    
    let result
    
    if (existing) {
      // Update existing
      result = await supabase
        .from('customer_notification_settings')
        .update(updateData)
        .eq('customer_id', customerId)
        .select()
        .single()
    } else {
      // Insert new
      result = await supabase
        .from('customer_notification_settings')
        .insert({
          customer_id: customerId,
          ...updateData,
        })
        .select()
        .single()
    }
    
    if (result.error) {
      console.error(`[${requestId}] Error updating settings:`, result.error)
      throw result.error
    }
    
    console.log(`[${requestId}] Notification settings updated successfully`)
    return NextResponse.json({ success: true, settings: result.data })
    
  } catch (error) {
    console.error(`[${requestId}] Error updating notification settings:`, error)
    
    await reportServerError(error, 'POST /api/customers/notification-settings', {
      route: '/api/customers/notification-settings',
      severity: 'medium',
      additionalData: { requestId },
    })
    
    return NextResponse.json(
      { success: false, error: 'שגיאה בעדכון הגדרות התראות' },
      { status: 500 }
    )
  }
}
