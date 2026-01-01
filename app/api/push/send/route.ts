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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { subscriptionId, title, body: messageBody, url } = body

    // Validate input
    if (!subscriptionId || !title || !messageBody) {
      return NextResponse.json(
        { error: 'Missing required fields: subscriptionId, title, body' },
        { status: 400 }
      )
    }

    // Fetch the subscription
    const { data: subscription, error: fetchError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('id', subscriptionId)
      .eq('is_active', true)
      .single()

    if (fetchError || !subscription) {
      return NextResponse.json(
        { error: 'Subscription not found or inactive' },
        { status: 404 }
      )
    }

    // Build push subscription object
    const pushSubscription = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh,
        auth: subscription.auth,
      },
    }

    // Build notification payload
    const payload = JSON.stringify({
      title,
      body: messageBody,
      icon: '/icon.png',
      badge: '/favicon-32x32.png',
      tag: `custom-${Date.now()}`,
      requireInteraction: false,
      data: {
        url: url || '/',
        timestamp: Date.now(),
        type: 'custom',
      },
    })

    // Send the notification
    await webpush.sendNotification(pushSubscription, payload)

    // Update last_used timestamp
    await supabase
      .from('push_subscriptions')
      .update({
        last_used: new Date().toISOString(),
        last_delivery_status: 'success',
        consecutive_failures: 0,
      })
      .eq('id', subscriptionId)

    // Log the notification
    const recipientType = subscription.barber_id ? 'barber' : 'customer'
    const recipientId = subscription.barber_id || subscription.customer_id

    await supabase.from('notification_logs').insert({
      notification_type: 'admin_broadcast',
      recipient_type: recipientType,
      recipient_id: recipientId,
      title,
      body: messageBody,
      payload: { url, custom: true },
      devices_targeted: 1,
      devices_succeeded: 1,
      devices_failed: 0,
      status: 'sent',
      sent_at: new Date().toISOString(),
    })

    return NextResponse.json({
      success: true,
      message: 'Notification sent successfully',
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
