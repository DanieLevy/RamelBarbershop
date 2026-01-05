/**
 * API Route: Notification History
 * 
 * GET: Fetch notification history for a user
 * Supports pagination, filtering by type, and unread-only filtering
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { NotificationLogRecord, NotificationType, RecipientType } from '@/lib/push/types'

export const dynamic = 'force-dynamic'

// Valid notification types for filtering
const VALID_NOTIFICATION_TYPES: NotificationType[] = [
  'reminder',
  'cancellation',
  'booking_confirmed',
  'chat_message',
  'barber_broadcast',
  'admin_broadcast'
]

/**
 * GET /api/push/notifications
 * Fetch notification history for a user
 * 
 * Query params:
 * - customerId: Customer ID (required if not barberId)
 * - barberId: Barber ID (required if not customerId)
 * - limit: Number of notifications to fetch (default 20, max 100)
 * - offset: Offset for pagination (default 0)
 * - type: Filter by notification type
 * - unreadOnly: If true, only return unread notifications
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const customerId = searchParams.get('customerId')
    const barberId = searchParams.get('barberId')
    const limitParam = searchParams.get('limit')
    const offsetParam = searchParams.get('offset')
    const typeFilter = searchParams.get('type') as NotificationType | null
    const unreadOnlyParam = searchParams.get('unreadOnly')

    // Validate user ID
    if (!customerId && !barberId) {
      return NextResponse.json(
        { success: false, error: 'Either customerId or barberId is required' },
        { status: 400 }
      )
    }

    // Parse pagination params
    const limit = Math.min(Math.max(parseInt(limitParam || '20', 10) || 20, 1), 100)
    const offset = Math.max(parseInt(offsetParam || '0', 10) || 0, 0)
    const unreadOnly = unreadOnlyParam === 'true'

    // Validate type filter
    if (typeFilter && !VALID_NOTIFICATION_TYPES.includes(typeFilter)) {
      return NextResponse.json(
        { success: false, error: `Invalid type filter. Must be one of: ${VALID_NOTIFICATION_TYPES.join(', ')}` },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    
    // Determine recipient type and ID
    const recipientType: RecipientType = customerId ? 'customer' : 'barber'
    const recipientId = customerId || barberId!

    // Build query
    let query = supabase
      .from('notification_logs')
      .select('*', { count: 'exact' })
      .eq('recipient_type', recipientType)
      .eq('recipient_id', recipientId)
      .in('status', ['sent', 'partial']) // Only show successfully sent notifications
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Apply type filter
    if (typeFilter) {
      query = query.eq('notification_type', typeFilter)
    }

    // Apply unread filter
    if (unreadOnly) {
      query = query.eq('is_read', false)
    }

    const { data, error, count } = await query

    if (error) {
      console.error('[API notifications] Error fetching notifications:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch notifications' },
        { status: 500 }
      )
    }

    // Get total unread count (for badge display)
    const { count: unreadCount, error: unreadError } = await supabase
      .from('notification_logs')
      .select('*', { count: 'exact', head: true })
      .eq('recipient_type', recipientType)
      .eq('recipient_id', recipientId)
      .eq('is_read', false)
      .in('status', ['sent', 'partial'])
      // Only count high-priority notification types for badge
      .in('notification_type', ['reminder', 'cancellation', 'booking_confirmed'])

    if (unreadError) {
      console.error('[API notifications] Error fetching unread count:', unreadError)
    }

    const notifications = (data as NotificationLogRecord[]) || []
    const totalCount = count || 0
    const totalUnread = unreadCount || 0
    const hasMore = offset + notifications.length < totalCount

    return NextResponse.json({
      success: true,
      notifications,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore
      },
      totalUnread
    })
  } catch (error) {
    console.error('[API notifications] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
