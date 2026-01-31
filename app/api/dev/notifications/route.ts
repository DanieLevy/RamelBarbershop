import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateDevToken, unauthorizedResponse } from '@/lib/auth/dev-auth'

export const dynamic = 'force-dynamic'

/**
 * GET /api/dev/notifications
 * Returns notification logs
 */
export async function GET(request: NextRequest) {
  if (!validateDevToken(request)) {
    return unauthorizedResponse()
  }

  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const type = searchParams.get('type')

    // Build query
    let query = supabase
      .from('notification_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (type) {
      query = query.eq('notification_type', type)
    }

    const { data: logs, count, error } = await query

    if (error) {
      console.error('[Dev Notifications API] Error:', error)
      return Response.json({ error: 'Failed to fetch notifications' }, { status: 500 })
    }

    // Get recipient names
    const customerIds = [...new Set(
      logs?.filter(l => l.recipient_type === 'customer').map(l => l.recipient_id) || []
    )]
    const barberIds = [...new Set(
      logs?.filter(l => l.recipient_type === 'barber').map(l => l.recipient_id) || []
    )]

    const [customersResult, barbersResult] = await Promise.all([
      customerIds.length > 0
        ? supabase.from('customers').select('id, fullname').in('id', customerIds)
        : Promise.resolve({ data: [] }),
      barberIds.length > 0
        ? supabase.from('users').select('id, fullname').in('id', barberIds)
        : Promise.resolve({ data: [] }),
    ])

    const customerMap = new Map(customersResult.data?.map(c => [c.id, c.fullname]) || [])
    const barberMap = new Map(barbersResult.data?.map(b => [b.id, b.fullname]) || [])

    // Enrich logs
    const enrichedLogs = logs?.map(log => ({
      ...log,
      recipient_name: log.recipient_type === 'customer'
        ? customerMap.get(log.recipient_id) || 'Unknown'
        : barberMap.get(log.recipient_id) || 'Unknown',
    }))

    // Calculate stats
    const allLogsQuery = await supabase
      .from('notification_logs')
      .select('notification_type, status')
    
    const allLogs = allLogsQuery.data || []
    
    const stats = {
      total: allLogs.length,
      byType: {
        reminder: allLogs.filter(l => l.notification_type === 'reminder').length,
        booking_confirmed: allLogs.filter(l => l.notification_type === 'booking_confirmed').length,
        cancellation: allLogs.filter(l => l.notification_type === 'cancellation').length,
        chat_message: allLogs.filter(l => l.notification_type === 'chat_message').length,
        admin_broadcast: allLogs.filter(l => l.notification_type === 'admin_broadcast').length,
      },
      byStatus: {
        sent: allLogs.filter(l => l.status === 'sent').length,
        failed: allLogs.filter(l => l.status === 'failed').length,
        pending: allLogs.filter(l => l.status === 'pending').length,
        partial: allLogs.filter(l => l.status === 'partial').length,
      },
      successRate: allLogs.length > 0
        ? Math.round((allLogs.filter(l => l.status === 'sent').length / allLogs.length) * 100)
        : 0,
    }

    return Response.json({
      logs: enrichedLogs,
      stats,
      total: count || 0,
      limit,
      offset,
    })
  } catch (error) {
    console.error('[Dev Notifications API] Error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
