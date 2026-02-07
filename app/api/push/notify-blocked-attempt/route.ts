/**
 * API Route: Notify Barber of Blocked Customer Attempt
 * 
 * Sends a push notification to the barber when a blocked customer
 * attempts to book an appointment.
 */

import { NextRequest, NextResponse } from 'next/server'
import { pushService } from '@/lib/push/push-service'
import { createAdminClient } from '@/lib/supabase/admin'
import { reportApiError } from '@/lib/bug-reporter/helpers'
import { verifyInternalCall } from '@/lib/auth/push-api-auth'

export const dynamic = 'force-dynamic'

interface BlockedAttemptRequest {
  barberId: string
  customerName: string
  customerPhone: string
}

export async function POST(request: NextRequest) {
  try {
    // This route is only called server-to-server
    if (!verifyInternalCall(request)) {
      return NextResponse.json(
        { error: 'Unauthorized: internal access only' },
        { status: 401 }
      )
    }

    const body: BlockedAttemptRequest = await request.json()
    const { barberId, customerName, customerPhone } = body

    // Validate required fields
    if (!barberId || !customerName) {
      return NextResponse.json(
        { error: 'Missing required fields: barberId, customerName' },
        { status: 400 }
      )
    }

    console.log('[API/notify-blocked-attempt] Blocked customer attempt:', customerName, 'for barber:', barberId)

    // Send push notification to barber
    const result = await pushService.sendCustomNotification({
      recipientType: 'barber',
      recipientId: barberId,
      title: '🚫 ניסיון הזמנה נחסם',
      body: `${customerName} ניסה לקבוע תור אצלך ללא הצלחה`,
      url: '/barber/dashboard/blocked-customers',
    })

    // Log to notification_logs
    const supabase = createAdminClient()
    await supabase.from('notification_logs').insert({
      notification_type: 'admin_broadcast',
      recipient_type: 'barber',
      recipient_id: barberId,
      title: 'ניסיון הזמנה נחסם',
      body: `${customerName} (${customerPhone}) ניסה לקבוע תור`,
      payload: { customerName, customerPhone, type: 'blocked_attempt' },
      devices_targeted: result.sent + result.failed,
      devices_succeeded: result.sent,
      devices_failed: result.failed,
      status: result.success ? 'sent' : 'failed',
    })

    return NextResponse.json({
      success: true,
      sent: result.sent,
      failed: result.failed,
    })
  } catch (error) {
    console.error('[API/notify-blocked-attempt] Error:', error)
    await reportApiError(error, request, 'Notify blocked attempt failed', {
      severity: 'high',
    })
    
    return NextResponse.json(
      { error: 'Failed to send notification' },
      { status: 500 }
    )
  }
}
