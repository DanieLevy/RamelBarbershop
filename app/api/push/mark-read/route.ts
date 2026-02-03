/**
 * POST /api/push/mark-read
 * Mark notifications as read for a user and clear their badge
 * 
 * This endpoint supports:
 * 1. markAll: true - Mark all notifications as read
 * 2. notificationId: string - Mark a specific notification as read
 * 
 * This ensures the badge count is reset and the user has acknowledged their notifications.
 */

import { NextRequest, NextResponse } from 'next/server'
import { pushService } from '@/lib/push/push-service'
import { createAdminClient } from '@/lib/supabase/admin'
import { reportServerError } from '@/lib/bug-reporter/helpers'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { customerId, barberId, notificationId, markAll } = body

    if (!customerId && !barberId) {
      return NextResponse.json(
        { success: false, error: 'Either customerId or barberId is required' },
        { status: 400 }
      )
    }

    // Determine recipient type and ID
    const recipientType = customerId ? 'customer' : 'barber'
    const recipientId = customerId || barberId

    // Mark single notification as read
    if (notificationId && !markAll) {
      // Use admin client for write operations (bypasses RLS)
      const supabase = createAdminClient()
      
      // Verify the notification belongs to this user
      const { data: notification, error: fetchError } = await supabase
        .from('notification_logs')
        .select('id, recipient_type, recipient_id')
        .eq('id', notificationId)
        .single()
      
      if (fetchError || !notification) {
        return NextResponse.json(
          { success: false, error: 'Notification not found' },
          { status: 404 }
        )
      }
      
      // Security check: ensure notification belongs to this user
      if (notification.recipient_type !== recipientType || notification.recipient_id !== recipientId) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized' },
          { status: 403 }
        )
      }
      
      const { error: updateError } = await supabase
        .from('notification_logs')
        .update({ is_read: true })
        .eq('id', notificationId)
      
      if (updateError) {
        console.error('[API] Error marking notification as read:', updateError)
        return NextResponse.json(
          { success: false, error: 'Failed to mark notification as read' },
          { status: 500 }
        )
      }
      
      console.log(`[API] Marked notification ${notificationId} as read`)
      
      return NextResponse.json({
        success: true,
        message: 'Notification marked as read',
        notificationId
      })
    }

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

    // Get the new count after marking - this helps detect if new notifications
    // arrived while we were marking (race condition protection)
    const newUnreadCount = await pushService.getUnreadCount(
      recipientType as 'customer' | 'barber',
      recipientId
    )

    console.log(`[API] Marked all notifications as read for ${recipientType} ${recipientId}, new count: ${newUnreadCount}`)

    return NextResponse.json({
      success: true,
      message: 'All notifications marked as read',
      recipientType,
      recipientId,
      newUnreadCount // Return this so client can update badge if needed
    })
  } catch (error) {
    console.error('[API] Error marking notifications as read:', error)
    await reportServerError(error, 'POST /api/push/mark-read', {
      route: '/api/push/mark-read'
    })
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
    await reportServerError(error, 'GET /api/push/mark-read', {
      route: '/api/push/mark-read'
    })
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
