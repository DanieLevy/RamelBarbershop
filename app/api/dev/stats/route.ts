import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateDevToken, unauthorizedResponse } from '@/lib/auth/dev-auth'

export const dynamic = 'force-dynamic'

/**
 * GET /api/dev/stats
 * Returns comprehensive dashboard statistics for the developer console
 */
export async function GET(request: NextRequest) {
  // Validate dev token
  if (!validateDevToken(request)) {
    return unauthorizedResponse()
  }

  try {
    const supabase = await createClient()
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayStartMs = todayStart.getTime()
    
    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)

    // Fetch all stats in parallel
    const [
      customersResult,
      customersThisMonthResult,
      blockedCustomersResult,
      barbersResult,
      activeBarbersResult,
      reservationsResult,
      todayReservationsResult,
      confirmedReservationsResult,
      cancelledReservationsResult,
      pushSubscriptionsResult,
      activePushResult,
      failedPushResult,
      recentReservationsResult,
      recentCustomersResult,
    ] = await Promise.all([
      // Customers
      supabase.from('customers').select('id', { count: 'exact', head: true }),
      supabase.from('customers').select('id', { count: 'exact', head: true })
        .gte('created_at', monthStart.toISOString()),
      supabase.from('customers').select('id', { count: 'exact', head: true })
        .eq('is_blocked', true),
      
      // Barbers
      supabase.from('users').select('id', { count: 'exact', head: true })
        .eq('is_barber', true),
      supabase.from('users').select('id', { count: 'exact', head: true })
        .eq('is_barber', true)
        .eq('is_active', true),
      
      // Reservations
      supabase.from('reservations').select('id', { count: 'exact', head: true }),
      supabase.from('reservations').select('id', { count: 'exact', head: true })
        .gte('time_timestamp', todayStartMs)
        .lt('time_timestamp', todayStartMs + 86400000),
      supabase.from('reservations').select('id', { count: 'exact', head: true })
        .eq('status', 'confirmed'),
      supabase.from('reservations').select('id', { count: 'exact', head: true })
        .eq('status', 'cancelled'),
      
      // Push subscriptions
      supabase.from('push_subscriptions').select('id', { count: 'exact', head: true }),
      supabase.from('push_subscriptions').select('id', { count: 'exact', head: true })
        .eq('is_active', true),
      supabase.from('push_subscriptions').select('id', { count: 'exact', head: true })
        .gt('consecutive_failures', 0),
      
      // Recent reservations with barber info
      supabase.from('reservations')
        .select('id, customer_name, barber_id, time_timestamp, status')
        .order('created_at', { ascending: false })
        .limit(10),
      
      // Recent customers
      supabase.from('customers')
        .select('id, fullname, phone, created_at')
        .order('created_at', { ascending: false })
        .limit(5),
    ])

    // Fetch barber names for recent reservations
    let recentReservations: Array<{
      id: string
      customer_name: string
      barber_name: string
      time_timestamp: number
      status: string
    }> = []

    if (recentReservationsResult.data && recentReservationsResult.data.length > 0) {
      const barberIds = [...new Set(recentReservationsResult.data.map(r => r.barber_id))]
      const { data: barbers } = await supabase
        .from('users')
        .select('id, fullname')
        .in('id', barberIds)
      
      const barberMap = new Map(barbers?.map(b => [b.id, b.fullname]) || [])
      
      recentReservations = recentReservationsResult.data.map(r => ({
        id: r.id,
        customer_name: r.customer_name,
        barber_name: barberMap.get(r.barber_id) || 'Unknown',
        time_timestamp: r.time_timestamp,
        status: r.status || 'confirmed',
      }))
    }

    // Check health
    const healthCheck = await fetch(new URL('/api/health', request.url).toString())
    const healthData = await healthCheck.json().catch(() => ({ status: 'unknown' }))

    const stats = {
      customers: {
        total: customersResult.count || 0,
        thisMonth: customersThisMonthResult.count || 0,
        blocked: blockedCustomersResult.count || 0,
      },
      barbers: {
        total: barbersResult.count || 0,
        active: activeBarbersResult.count || 0,
      },
      reservations: {
        total: reservationsResult.count || 0,
        today: todayReservationsResult.count || 0,
        confirmed: confirmedReservationsResult.count || 0,
        cancelled: cancelledReservationsResult.count || 0,
      },
      notifications: {
        subscriptions: pushSubscriptionsResult.count || 0,
        active: activePushResult.count || 0,
        failed: failedPushResult.count || 0,
      },
      health: {
        database: healthData.status === 'healthy' ? 'healthy' : 
                  healthData.status === 'degraded' ? 'degraded' : 'unhealthy',
        push: !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      },
    }

    return Response.json({
      stats,
      recentReservations,
      recentCustomers: recentCustomersResult.data || [],
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[Dev Stats API] Error:', error)
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
