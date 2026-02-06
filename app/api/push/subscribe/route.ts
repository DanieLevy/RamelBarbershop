/**
 * POST /api/push/subscribe
 * Save a push subscription for a user
 * 
 * DELETE /api/push/subscribe
 * Remove a push subscription by endpoint
 */

import { NextRequest, NextResponse } from 'next/server'
import { pushService } from '@/lib/push/push-service'
import type { DeviceType } from '@/lib/push/types'
import { reportApiError } from '@/lib/bug-reporter/helpers'

// Detect device type from user agent
function detectDeviceType(userAgent: string): DeviceType {
  const ua = userAgent.toLowerCase()
  
  if (/iphone|ipad|ipod/.test(ua)) return 'ios'
  if (/android/.test(ua)) return 'android'
  
  return 'desktop'
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { subscription, customerId, barberId, deviceName } = body

    // Validate subscription object
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return NextResponse.json(
        { success: false, error: 'Invalid subscription object' },
        { status: 400 }
      )
    }

    // Must have either customerId or barberId
    if (!customerId && !barberId) {
      return NextResponse.json(
        { success: false, error: 'Either customerId or barberId is required' },
        { status: 400 }
      )
    }

    // Get user agent for device detection
    const userAgent = request.headers.get('user-agent') || ''
    const deviceType = detectDeviceType(userAgent)

    // Save subscription
    const result = await pushService.saveSubscription({
      customerId,
      barberId,
      subscription,
      deviceType,
      deviceName,
      userAgent
    })

    if (result.error) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      subscriptionId: result.subscriptionId,
      deviceType
    })
  } catch (error) {
    console.error('[API] Error saving push subscription:', error)
    await reportApiError(error, request, 'Save push subscription failed', {
      severity: 'high',
    })
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { endpoint, subscriptionId } = body

    if (!endpoint && !subscriptionId) {
      return NextResponse.json(
        { success: false, error: 'Either endpoint or subscriptionId is required' },
        { status: 400 }
      )
    }

    if (subscriptionId) {
      const result = await pushService.removeSubscription(subscriptionId)
      
      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 500 }
        )
      }
    } else if (endpoint) {
      await pushService.deactivateByEndpoint(endpoint)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API] Error removing push subscription:', error)
    await reportApiError(error, request, 'Remove push subscription failed', {
      severity: 'medium',
    })
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

