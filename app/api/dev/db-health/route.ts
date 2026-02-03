import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateDevToken, unauthorizedResponse } from '@/lib/auth/dev-auth'

export const dynamic = 'force-dynamic'

/**
 * GET /api/dev/db-health
 * Returns database health metrics and advisor recommendations
 */
export async function GET(request: NextRequest) {
  if (!validateDevToken(request)) {
    return unauthorizedResponse()
  }

  try {
    const supabase = await createClient()

    // Get row counts for all tables
    const tableCounts = await Promise.all([
      supabase.from('customers').select('id', { count: 'exact', head: true }),
      supabase.from('users').select('id', { count: 'exact', head: true }),
      supabase.from('reservations').select('id', { count: 'exact', head: true }),
      supabase.from('services').select('id', { count: 'exact', head: true }),
      supabase.from('push_subscriptions').select('id', { count: 'exact', head: true }),
      supabase.from('notification_logs').select('id', { count: 'exact', head: true }),
      supabase.from('work_days').select('id', { count: 'exact', head: true }),
      supabase.from('barber_closures').select('id', { count: 'exact', head: true }),
      supabase.from('barbershop_closures').select('id', { count: 'exact', head: true }),
      supabase.from('products').select('id', { count: 'exact', head: true }),
      supabase.from('barber_messages').select('id', { count: 'exact', head: true }),
      supabase.from('barbershop_settings').select('id', { count: 'exact', head: true }),
      supabase.from('customer_notification_settings').select('id', { count: 'exact', head: true }),
      supabase.from('barber_notification_settings').select('id', { count: 'exact', head: true }),
      supabase.from('barber_booking_settings').select('id', { count: 'exact', head: true }),
    ])

    const tables = [
      { name: 'customers', rows: tableCounts[0].count || 0 },
      { name: 'users', rows: tableCounts[1].count || 0 },
      { name: 'reservations', rows: tableCounts[2].count || 0 },
      { name: 'services', rows: tableCounts[3].count || 0 },
      { name: 'push_subscriptions', rows: tableCounts[4].count || 0 },
      { name: 'notification_logs', rows: tableCounts[5].count || 0 },
      { name: 'work_days', rows: tableCounts[6].count || 0 },
      { name: 'barber_closures', rows: tableCounts[7].count || 0 },
      { name: 'barbershop_closures', rows: tableCounts[8].count || 0 },
      { name: 'products', rows: tableCounts[9].count || 0 },
      { name: 'barber_messages', rows: tableCounts[10].count || 0 },
      { name: 'barbershop_settings', rows: tableCounts[11].count || 0 },
      { name: 'customer_notification_settings', rows: tableCounts[12].count || 0 },
      { name: 'barber_notification_settings', rows: tableCounts[13].count || 0 },
      { name: 'barber_booking_settings', rows: tableCounts[14].count || 0 },
    ]

    // Check database connectivity with timing
    const startTime = Date.now()
    const { error: pingError } = await supabase
      .from('barbershop_settings')
      .select('id')
      .limit(1)
    const latency = Date.now() - startTime

    // Generate advisor recommendations
    const recommendations: Array<{ type: 'info' | 'warning' | 'success'; message: string }> = []

    // Check for large tables that might need optimization
    const largeTable = tables.find(t => t.rows > 10000)
    if (largeTable) {
      recommendations.push({
        type: 'info',
        message: `${largeTable.name} has ${largeTable.rows.toLocaleString()} rows. Consider implementing pagination.`,
      })
    }

    // Check notification logs cleanup
    const notifLogs = tables.find(t => t.name === 'notification_logs')
    if (notifLogs && notifLogs.rows > 1000) {
      recommendations.push({
        type: 'warning',
        message: `notification_logs has ${notifLogs.rows} entries. Run cleanup cron job.`,
      })
    }

    // Check push subscription failures
    const { count: failedSubs } = await supabase
      .from('push_subscriptions')
      .select('id', { count: 'exact', head: true })
      .gt('consecutive_failures', 0)
    
    if (failedSubs && failedSubs > 0) {
      recommendations.push({
        type: 'warning',
        message: `${failedSubs} push subscriptions have failures. Consider cleanup.`,
      })
    }

    // Check inactive push subscriptions
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    
    const { count: staleSubs } = await supabase
      .from('push_subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true)
      .lt('last_used', thirtyDaysAgo.toISOString())
    
    if (staleSubs && staleSubs > 0) {
      recommendations.push({
        type: 'info',
        message: `${staleSubs} push subscriptions inactive for 30+ days.`,
      })
    }

    // Check blocked customers
    const { count: blockedCustomers } = await supabase
      .from('customers')
      .select('id', { count: 'exact', head: true })
      .eq('is_blocked', true)
    
    if (blockedCustomers && blockedCustomers > 0) {
      recommendations.push({
        type: 'info',
        message: `${blockedCustomers} customers are blocked.`,
      })
    }

    // Success indicators
    if (latency < 100) {
      recommendations.push({
        type: 'success',
        message: `Database latency is excellent (${latency}ms).`,
      })
    }

    const totalRows = tables.reduce((sum, t) => sum + t.rows, 0)
    
    return Response.json({
      health: {
        status: pingError ? 'unhealthy' : latency > 500 ? 'degraded' : 'healthy',
        latency,
        lastChecked: new Date().toISOString(),
      },
      tables: tables.sort((a, b) => b.rows - a.rows),
      totalRows,
      recommendations,
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        env: process.env.NODE_ENV,
      },
      indexes: {
        note: 'Run SQL query on Supabase dashboard for detailed index stats',
        optimizedIndexes: [
          'idx_users_active_barbers',
          'idx_services_barber_active_cover',
          'idx_reservations_date_barber_status',
        ],
      },
    })
  } catch (error) {
    console.error('[Dev DB Health API] Error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
