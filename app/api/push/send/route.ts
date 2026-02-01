import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// VAPID configuration
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || ''
const vapidEmail = process.env.VAPID_EMAIL || 'mailto:admin@ramel-barbershop.co.il'

// Initialize web-push
if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey)
}

// Helper to send to a single subscription
async function sendToSubscription(
  subscription: { id: string; endpoint: string; p256dh: string; auth: string },
  payload: string
): Promise<boolean> {
  try {
    const pushSubscription = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh,
        auth: subscription.auth,
      },
    }
    
    await webpush.sendNotification(pushSubscription, payload)
    
    // Update success status
    await supabase
      .from('push_subscriptions')
      .update({
        last_used: new Date().toISOString(),
        last_delivery_status: 'success',
        consecutive_failures: 0,
      })
      .eq('id', subscription.id)
    
    return true
  } catch (error) {
    console.error('[Push Send] Error sending to subscription:', subscription.id, error)
    
    // Handle permanent errors - deactivate subscription
    if (error instanceof webpush.WebPushError && [404, 410, 401].includes(error.statusCode)) {
      await supabase
        .from('push_subscriptions')
        .update({ 
          is_active: false,
          last_delivery_status: 'failed'
        })
        .eq('id', subscription.id)
    } else {
      // Update failure status for transient errors
      await supabase
        .from('push_subscriptions')
        .update({ last_delivery_status: 'failed' })
        .eq('id', subscription.id)
    }
    
    return false
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { subscriptionId, customerId, title, body: messageBody, url, barberName } = body

    // Validate input - need either subscriptionId or customerId
    if ((!subscriptionId && !customerId) || !title || !messageBody) {
      return NextResponse.json(
        { error: 'Missing required fields: (subscriptionId or customerId), title, body' },
        { status: 400 }
      )
    }

    let subscriptions: Array<{ id: string; endpoint: string; p256dh: string; auth: string; customer_id: string | null; barber_id: string | null }> = []
    
    if (customerId) {
      // Fetch all active subscriptions for the customer
      const { data, error } = await supabase
        .from('push_subscriptions')
        .select('id, endpoint, p256dh, auth, customer_id, barber_id')
        .eq('customer_id', customerId)
        .eq('is_active', true)
      
      if (error) {
        console.error('[Push Send] Error fetching customer subscriptions:', error)
        return NextResponse.json(
          { error: 'Failed to fetch customer subscriptions' },
          { status: 500 }
        )
      }
      
      if (!data || data.length === 0) {
        return NextResponse.json(
          { error: 'Customer has no active push subscriptions' },
          { status: 404 }
        )
      }
      
      subscriptions = data
    } else {
      // Fetch single subscription by ID
      const { data: subscription, error: fetchError } = await supabase
        .from('push_subscriptions')
        .select('id, endpoint, p256dh, auth, customer_id, barber_id')
        .eq('id', subscriptionId)
        .eq('is_active', true)
        .single()

      if (fetchError || !subscription) {
        return NextResponse.json(
          { error: 'Subscription not found or inactive' },
          { status: 404 }
        )
      }
      
      subscriptions = [subscription]
    }

    // Build notification payload
    const payload = JSON.stringify({
      title,
      body: messageBody,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      tag: `barber-message-${Date.now()}`,
      requireInteraction: true,
      data: {
        url: url || '/my-appointments',
        timestamp: Date.now(),
        type: 'barber_broadcast',
        barberName: barberName || undefined,
      },
    })

    // Send to all subscriptions
    let succeeded = 0
    let failed = 0
    
    for (const sub of subscriptions) {
      const success = await sendToSubscription(sub, payload)
      if (success) {
        succeeded++
      } else {
        failed++
      }
    }

    // Log the notification
    const firstSub = subscriptions[0]
    const recipientType = firstSub.barber_id ? 'barber' : 'customer'
    const recipientId = customerId || firstSub.barber_id || firstSub.customer_id

    await supabase.from('notification_logs').insert({
      notification_type: 'barber_broadcast',
      recipient_type: recipientType,
      recipient_id: recipientId,
      title,
      body: messageBody,
      payload: { url, custom: true, barberName },
      devices_targeted: subscriptions.length,
      devices_succeeded: succeeded,
      devices_failed: failed,
      status: succeeded > 0 ? 'sent' : 'failed',
      sent_at: new Date().toISOString(),
    })

    if (succeeded === 0) {
      return NextResponse.json({
        success: false,
        error: 'Failed to send to any device',
        devicesTargeted: subscriptions.length,
        devicesSucceeded: 0,
        devicesFailed: failed
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Notification sent to ${succeeded} device(s)`,
      devicesTargeted: subscriptions.length,
      devicesSucceeded: succeeded,
      devicesFailed: failed
    })
  } catch (error) {
    console.error('[Push Send] Error:', error)
    
    // Handle web-push specific errors
    if (error instanceof webpush.WebPushError) {
      const statusCode = error.statusCode
      
      // Subscription is no longer valid
      if ([404, 410].includes(statusCode)) {
        // Deactivate the subscription
        const body = await request.json().catch(() => ({}))
        if (body.subscriptionId) {
          await supabase
            .from('push_subscriptions')
            .update({ is_active: false })
            .eq('id', body.subscriptionId)
        }
        
        return NextResponse.json(
          { error: 'Subscription expired or unsubscribed', code: statusCode },
          { status: 410 }
        )
      }
      
      return NextResponse.json(
        { error: `Push service error: ${error.message}`, code: statusCode },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
