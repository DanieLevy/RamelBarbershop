import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateDevToken, unauthorizedResponse } from '@/lib/auth/dev-auth'

export const dynamic = 'force-dynamic'

/**
 * GET /api/dev/customers
 * Returns paginated customer list with full details
 */
export async function GET(request: NextRequest) {
  if (!validateDevToken(request)) {
    return unauthorizedResponse()
  }

  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    
    const search = searchParams.get('search') || ''
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Build query
    let query = supabase
      .from('customers')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Add search filter
    if (search) {
      query = query.or(`fullname.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`)
    }

    const { data: customers, count, error } = await query

    if (error) {
      console.error('[Dev Customers API] Error:', error)
      return Response.json({ error: 'Failed to fetch customers' }, { status: 500 })
    }

    // Get notification settings and push subscriptions for each customer
    const customerIds = customers?.map(c => c.id) || []
    
    const [notifSettingsResult, pushSubsResult, reservationCountsResult] = await Promise.all([
      supabase
        .from('customer_notification_settings')
        .select('customer_id, pwa_installed, notifications_enabled')
        .in('customer_id', customerIds),
      supabase
        .from('push_subscriptions')
        .select('customer_id')
        .in('customer_id', customerIds)
        .eq('is_active', true),
      supabase
        .from('reservations')
        .select('customer_id')
        .in('customer_id', customerIds),
    ])

    // Create maps for quick lookup
    const notifSettingsMap = new Map(
      notifSettingsResult.data?.map(n => [n.customer_id, n]) || []
    )
    
    // Count push subscriptions per customer
    const pushSubsCount = new Map<string, number>()
    pushSubsResult.data?.forEach(p => {
      if (!p.customer_id) return
      const count = pushSubsCount.get(p.customer_id) || 0
      pushSubsCount.set(p.customer_id, count + 1)
    })
    
    // Count reservations per customer
    const reservationCount = new Map<string, number>()
    reservationCountsResult.data?.forEach(r => {
      if (!r.customer_id) return
      const count = reservationCount.get(r.customer_id) || 0
      reservationCount.set(r.customer_id, count + 1)
    })

    // Enrich customers with additional data
    const enrichedCustomers = customers?.map(customer => {
      const notifSettings = notifSettingsMap.get(customer.id)
      return {
        ...customer,
        pwa_installed: notifSettings?.pwa_installed || false,
        notifications_enabled: notifSettings?.notifications_enabled || false,
        push_subscriptions_count: pushSubsCount.get(customer.id) || 0,
        reservations_count: reservationCount.get(customer.id) || 0,
      }
    })

    return Response.json({
      customers: enrichedCustomers,
      total: count || 0,
      limit,
      offset,
    })
  } catch (error) {
    console.error('[Dev Customers API] Error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
