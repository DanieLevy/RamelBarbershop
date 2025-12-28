/**
 * POST /api/push/send
 * Send push notifications (admin/testing only)
 */

import { NextRequest, NextResponse } from 'next/server'
import { pushService } from '@/lib/push/push-service'
import type { NotificationPayload } from '@/lib/push/types'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      title,
      body: notificationBody,
      url,
      customerIds,
      barberIds,
      broadcast,
      ...options
    } = body

    // Validate required fields
    if (!title || !notificationBody) {
      return NextResponse.json(
        { success: false, error: 'Title and body are required' },
        { status: 400 }
      )
    }

    // Build payload
    const payload: NotificationPayload = {
      title,
      body: notificationBody,
      url,
      ...options
    }

    let result

    // Determine target
    if (broadcast === true) {
      // Broadcast to all
      result = await pushService.sendToAll(payload)
    } else if (customerIds?.length) {
      // Send to specific customers
      result = await pushService.sendToCustomers(customerIds, payload)
    } else if (barberIds?.length) {
      // Send to specific barbers
      result = await pushService.sendToBarbers(barberIds, payload)
    } else {
      return NextResponse.json(
        { success: false, error: 'Must specify customerIds, barberIds, or broadcast' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: result.success,
      sent: result.sent,
      failed: result.failed,
      errors: result.errors.length > 0 ? result.errors : undefined
    })
  } catch (error) {
    console.error('[API] Error sending push notification:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

