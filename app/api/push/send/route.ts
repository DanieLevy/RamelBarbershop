/**
 * API Route: Send Custom Push Notification
 * 
 * Used by debug page and admin tools to send custom notifications.
 * Supports sending to:
 * - A specific subscription by ID
 * - All devices for a customer (by customerId)
 * - All devices for a barber (by barberId)
 */

import { NextRequest, NextResponse } from 'next/server'
import { pushService } from '@/lib/push/push-service'
import { reportApiError } from '@/lib/bug-reporter/helpers'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      subscriptionId, 
      customerId, 
      barberId,
      title, 
      body: messageBody, 
      url, 
      barberName,
      senderName,
      senderId
    } = body

    // Validate input - need either subscriptionId, customerId, or barberId
    if (!subscriptionId && !customerId && !barberId) {
      return NextResponse.json(
        { error: 'Missing required field: subscriptionId, customerId, or barberId' },
        { status: 400 }
      )
    }

    if (!title || !messageBody) {
      return NextResponse.json(
        { error: 'Missing required fields: title and body' },
        { status: 400 }
      )
    }

    let result

    if (customerId) {
      // Send to all customer's devices using pushService
      console.log('[API push/send] Sending to customer:', customerId, 'from:', senderName || barberName)
      result = await pushService.sendCustomNotification({
        recipientType: 'customer',
        recipientId: customerId,
        title,
        body: messageBody,
        url,
        senderId,
        senderName: senderName || barberName
      })
    } else if (barberId) {
      // Send to all barber's devices using pushService
      console.log('[API push/send] Sending to barber:', barberId)
      result = await pushService.sendCustomNotification({
        recipientType: 'barber',
        recipientId: barberId,
        title,
        body: messageBody,
        url,
        senderName
      })
    } else {
      // Legacy: Send to specific subscription
      // Use pushService's internal methods via direct send
      console.log('[API push/send] Sending to subscription:', subscriptionId)
      
      // For single subscription, we still need to use the service
      // First, get the subscription details to determine recipient type
      const { createClient } = await import('@supabase/supabase-js')
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )

      const { data: subscription, error: fetchError } = await supabase
        .from('push_subscriptions')
        .select('id, customer_id, barber_id')
        .eq('id', subscriptionId)
        .eq('is_active', true)
        .single()

      if (fetchError || !subscription) {
        return NextResponse.json(
          { error: 'Subscription not found or inactive' },
          { status: 404 }
        )
      }

      // Determine recipient type and ID
      const recipientType = subscription.barber_id ? 'barber' : 'customer'
      const recipientId = subscription.barber_id || subscription.customer_id

      if (!recipientId) {
        return NextResponse.json(
          { error: 'Subscription not linked to any user' },
          { status: 400 }
        )
      }

      result = await pushService.sendCustomNotification({
        recipientType,
        recipientId,
        title,
        body: messageBody,
        url,
        senderName: senderName || barberName
      })
    }

    console.log('[API push/send] Result:', result)

    if (!result.success && result.sent === 0) {
      return NextResponse.json({
        success: false,
        error: result.errors[0] || 'Failed to send notification',
        devicesTargeted: 0,
        devicesSucceeded: 0,
        devicesFailed: result.failed
      }, { status: result.errors.includes('No active subscriptions') ? 404 : 500 })
    }

    return NextResponse.json({
      success: result.success,
      message: `Notification sent to ${result.sent} device(s)`,
      devicesTargeted: result.sent + result.failed,
      devicesSucceeded: result.sent,
      devicesFailed: result.failed,
      logId: result.logId
    })
  } catch (error) {
    console.error('[API push/send] Error:', error)
    await reportApiError(error, request, 'Send push notification failed', {
      severity: 'high',
    })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
