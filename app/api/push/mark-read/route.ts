/**
 * POST /api/push/mark-read
 * Mark all notifications as read for a user and clear their badge
 * 
 * This endpoint is called when:
 * 1. User opens the app (visibility change)
 * 2. User clicks on a notification
 * 
 * This ensures the badge count is reset and the user has acknowledged their notifications.
 */

import { NextRequest, NextResponse } from 'next/server'
import { pushService } from '@/lib/push/push-service'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { customerId, barberId } = body

    if (!customerId && !barberId) {
      return NextResponse.json(
        { success: false, error: 'Either customerId or barberId is required' },
        { status: 400 }
      )
    }

    // Determine recipient type and ID
    const recipientType = customerId ? 'customer' : 'barber'
    const recipientId = customerId || barberId

    // Mark all notifications as read
    const success = await pushService.markAllAsRead(
      recipientType as 'customer' | 'barber',
      recipientId
    )

    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Failed to mark notifications as read' },
        { status: 500 }
      )
    }

    console.log(`[API] Marked all notifications as read for ${recipientType} ${recipientId}`)

    return NextResponse.json({
      success: true,
      message: 'All notifications marked as read',
      recipientType,
      recipientId
    })
  } catch (error) {
    console.error('[API] Error marking notifications as read:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/push/mark-read
 * Get unread notification count for a user
 */
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

    // Determine recipient type and ID
    const recipientType = customerId ? 'customer' : 'barber'
    const recipientId = customerId || barberId

    // Get unread count
    const unreadCount = await pushService.getUnreadCount(
      recipientType as 'customer' | 'barber',
      recipientId!
    )

    return NextResponse.json({
      success: true,
      unreadCount,
      recipientType,
      recipientId
    })
  } catch (error) {
    console.error('[API] Error getting unread count:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
