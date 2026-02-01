import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'
import { format } from 'date-fns'
import { he } from 'date-fns/locale'

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
    const { 
      reservationId, 
      barberId, 
      customerId, 
      customerName, 
      barberName, 
      serviceName, 
      appointmentTime 
    } = body

    // Validate required fields
    if (!reservationId || !barberId || !customerName || !appointmentTime) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Format appointment time for the notification
    const appointmentDate = new Date(appointmentTime)
    const formattedDate = format(appointmentDate, 'EEEE, d בMMMM', { locale: he })
    const formattedTime = format(appointmentDate, 'HH:mm')

    // Get barber's push subscriptions
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('barber_id', barberId)
      .eq('is_active', true)

    if (subError) {
      console.error('[Request Cancel] Error fetching subscriptions:', subError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch barber subscriptions' },
        { status: 500 }
      )
    }

    if (!subscriptions || subscriptions.length === 0) {
      // Log the request even if barber has no push subscriptions
      await logCancelRequest(reservationId, customerId, barberId, customerName, 'no_subscription')
      
      return NextResponse.json({
        success: true,
        message: 'Request logged, but barber has no push subscriptions',
        notificationSent: false
      })
    }

    // Build notification payload
    const payload = JSON.stringify({
      title: `🙏 בקשת ביטול מ${customerName}`,
      body: `${customerName} מבקש/ת לבטל את התור ל${serviceName} ב${formattedDate} בשעה ${formattedTime}`,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      tag: `cancel-request-${reservationId}`,
      requireInteraction: true,
      data: {
        url: `/barber/dashboard/reservations?highlight=${reservationId}`,
        timestamp: Date.now(),
        type: 'cancel_request',
        reservationId,
        customerId,
        customerName
      },
      actions: [
        { action: 'approve', title: 'בטל את התור' },
        { action: 'view', title: 'צפה בפרטים' }
      ]
    })

    // Send to all barber's devices
    let succeeded = 0
    let failed = 0

    for (const sub of subscriptions) {
      try {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
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
          .eq('id', sub.id)
        
        succeeded++
      } catch (pushError) {
        console.error('[Request Cancel] Push error:', pushError)
        failed++
        
        // Handle permanent errors
        if (pushError instanceof webpush.WebPushError && [404, 410, 401].includes(pushError.statusCode)) {
          await supabase
            .from('push_subscriptions')
            .update({ is_active: false, last_delivery_status: 'failed' })
            .eq('id', sub.id)
        }
      }
    }

    // Log the notification
    await supabase.from('notification_logs').insert({
      notification_type: 'cancel_request',
      recipient_type: 'barber',
      recipient_id: barberId,
      reservation_id: reservationId,
      sender_id: customerId,
      title: `🙏 בקשת ביטול מ${customerName}`,
      body: `${customerName} מבקש/ת לבטל את התור ל${serviceName}`,
      payload: { 
        reservationId, 
        customerId, 
        customerName, 
        serviceName, 
        appointmentTime,
        barberName 
      },
      devices_targeted: subscriptions.length,
      devices_succeeded: succeeded,
      devices_failed: failed,
      status: succeeded > 0 ? 'sent' : 'failed',
      sent_at: new Date().toISOString(),
    })

    // Also log the cancel request itself
    await logCancelRequest(reservationId, customerId, barberId, customerName, succeeded > 0 ? 'notified' : 'failed')

    return NextResponse.json({
      success: true,
      message: `Cancel request sent to ${succeeded} device(s)`,
      notificationSent: succeeded > 0,
      devicesTargeted: subscriptions.length,
      devicesSucceeded: succeeded,
      devicesFailed: failed
    })
  } catch (error) {
    console.error('[Request Cancel] Error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// Log cancel request for tracking (even if notification fails)
async function logCancelRequest(
  reservationId: string,
  _customerId: string,
  _barberId: string,
  customerName: string,
  _status: 'notified' | 'no_subscription' | 'failed'
) {
  try {
    // Get current notes
    const { data: reservation } = await supabase
      .from('reservations')
      .select('barber_notes')
      .eq('id', reservationId)
      .single()
    
    const existingNotes = reservation?.barber_notes || ''
    const newNote = `[${new Date().toLocaleString('he-IL')}] בקשת ביטול מ${customerName}`
    const updatedNotes = existingNotes ? `${existingNotes}\n${newNote}` : newNote
    
    // Update with the new note appended
    await supabase
      .from('reservations')
      .update({ barber_notes: updatedNotes })
      .eq('id', reservationId)
    
    console.log('[Request Cancel] Logged cancel request to reservation notes')
  } catch (err) {
    console.error('[Request Cancel] Error logging cancel request:', err)
  }
}
