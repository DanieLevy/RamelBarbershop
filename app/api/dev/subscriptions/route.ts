import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateDevToken, unauthorizedResponse } from '@/lib/auth/dev-auth'

export const dynamic = 'force-dynamic'

/**
 * GET /api/dev/subscriptions
 * Returns all push subscriptions with owner details
 */
export async function GET(request: NextRequest) {
  if (!validateDevToken(request)) {
    return unauthorizedResponse()
  }

  try {
    const supabase = await createClient()

    // Get all subscriptions
    const { data: subscriptions, error } = await supabase
      .from('push_subscriptions')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[Dev Subscriptions API] Error:', error)
      return Response.json({ error: 'Failed to fetch subscriptions' }, { status: 500 })
    }

    // Get owner names
    const customerIds = [...new Set(
      subscriptions?.filter(s => s.customer_id).map(s => s.customer_id as string) || []
    )]
    const barberIds = [...new Set(
      subscriptions?.filter(s => s.barber_id).map(s => s.barber_id as string) || []
    )]

    const [customersResult, barbersResult] = await Promise.all([
      customerIds.length > 0
        ? supabase.from('customers').select('id, fullname, phone').in('id', customerIds)
        : Promise.resolve({ data: [] }),
      barberIds.length > 0
        ? supabase.from('users').select('id, fullname, email').in('id', barberIds)
        : Promise.resolve({ data: [] }),
    ])

    const customerMap = new Map(customersResult.data?.map(c => [c.id, c]) || [])
    const barberMap = new Map(barbersResult.data?.map(b => [b.id, b]) || [])

    // Enrich subscriptions
    const enrichedSubscriptions = subscriptions?.map(sub => {
      const customer = sub.customer_id ? customerMap.get(sub.customer_id) : null
      const barber = sub.barber_id ? barberMap.get(sub.barber_id) : null
      
      return {
        ...sub,
        owner_name: customer?.fullname || barber?.fullname || 'Unknown',
        owner_type: customer ? 'customer' : barber ? 'barber' : 'unknown',
        owner_contact: customer?.phone || barber?.email || '-',
      }
    })

    // Calculate stats
    const stats = {
      total: subscriptions?.length || 0,
      active: subscriptions?.filter(s => s.is_active).length || 0,
      inactive: subscriptions?.filter(s => !s.is_active).length || 0,
      customers: subscriptions?.filter(s => s.customer_id).length || 0,
      barbers: subscriptions?.filter(s => s.barber_id).length || 0,
      byDevice: {
        ios: subscriptions?.filter(s => s.device_type === 'ios').length || 0,
        android: subscriptions?.filter(s => s.device_type === 'android').length || 0,
        desktop: subscriptions?.filter(s => s.device_type === 'desktop').length || 0,
      },
      withFailures: subscriptions?.filter(s => (s.consecutive_failures || 0) > 0).length || 0,
    }

    return Response.json({
      subscriptions: enrichedSubscriptions,
      stats,
    })
  } catch (error) {
    console.error('[Dev Subscriptions API] Error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
