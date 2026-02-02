/**
 * GET /api/push/status
 * Get push notification status and devices for a user
 */

import { NextRequest, NextResponse } from 'next/server'
import { pushService } from '@/lib/push/push-service'
import { createClient } from '@/lib/supabase/server'
import { reportServerError } from '@/lib/bug-reporter/helpers'
import type { DeviceInfo, CustomerNotificationSettings } from '@/lib/push/types'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const customerId = searchParams.get('customerId')
    const barberId = searchParams.get('barberId')

    if (!customerId && !barberId) {
      return NextResponse.json(
        { success: false, error: 'Either customerId or barberId is required' },
        { status: 400 }
      )
    }

    // Get subscriptions
    let subscriptions
    if (customerId) {
      subscriptions = await pushService.getCustomerSubscriptions(customerId)
    } else {
      subscriptions = await pushService.getBarberSubscriptions(barberId!)
    }

    // Map to device info
    const devices: DeviceInfo[] = subscriptions.map(sub => ({
      id: sub.id,
      deviceType: sub.device_type,
      deviceName: sub.device_name,
      lastUsed: sub.last_used,
      createdAt: sub.created_at
    }))

    // Get notification settings for customers
    let settings: CustomerNotificationSettings | null = null
    if (customerId) {
      const supabase = await createClient()
      const { data } = await supabase
        .from('customer_notification_settings')
        .select('*')
        .eq('customer_id', customerId)
        .single()
      
      settings = data as CustomerNotificationSettings | null
    }

    return NextResponse.json({
      success: true,
      isSubscribed: subscriptions.length > 0,
      deviceCount: subscriptions.length,
      devices,
      settings: settings ? {
        pwaInstalled: settings.pwa_installed,
        notificationsEnabled: settings.notifications_enabled,
        reminderEnabled: settings.reminder_enabled,
        cancellationAlertsEnabled: settings.cancellation_alerts_enabled
      } : null
    })
  } catch (error) {
    console.error('[API] Error getting push status:', error)
    await reportServerError(error, 'GET /api/push/status', {
      route: '/api/push/status'
    })
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/push/status
 * Update notification settings for a customer
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { customerId, reminderEnabled, cancellationAlertsEnabled } = body

    if (!customerId) {
      return NextResponse.json(
        { success: false, error: 'customerId is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    
    // Check if settings exist
    const { data: existing } = await supabase
      .from('customer_notification_settings')
      .select('id')
      .eq('customer_id', customerId)
      .single()

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString()
    }

    if (typeof reminderEnabled === 'boolean') {
      updateData.reminder_enabled = reminderEnabled
    }
    if (typeof cancellationAlertsEnabled === 'boolean') {
      updateData.cancellation_alerts_enabled = cancellationAlertsEnabled
    }

    if (existing) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any
      const { error } = await db
        .from('customer_notification_settings')
        .update(updateData)
        .eq('customer_id', customerId)

      if (error) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 500 }
        )
      }
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any
      const { error } = await db
        .from('customer_notification_settings')
        .insert({
          customer_id: customerId,
          ...updateData
        })

      if (error) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API] Error updating push settings:', error)
    await reportServerError(error, 'PATCH /api/push/status', {
      route: '/api/push/status'
    })
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

