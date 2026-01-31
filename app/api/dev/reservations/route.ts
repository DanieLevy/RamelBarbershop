import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateDevToken, unauthorizedResponse } from '@/lib/auth/dev-auth'

export const dynamic = 'force-dynamic'

/**
 * GET /api/dev/reservations
 * Returns filtered reservations with full details
 */
export async function GET(request: NextRequest) {
  if (!validateDevToken(request)) {
    return unauthorizedResponse()
  }

  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    
    const status = searchParams.get('status') // 'all', 'confirmed', 'cancelled'
    const barberId = searchParams.get('barberId')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const search = searchParams.get('search')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Build query
    let query = supabase
      .from('reservations')
      .select('*, services(name, name_he, price, duration)', { count: 'exact' })
      .order('time_timestamp', { ascending: false })
      .range(offset, offset + limit - 1)

    // Apply filters
    if (status && status !== 'all') {
      query = query.eq('status', status)
    }
    if (barberId) {
      query = query.eq('barber_id', barberId)
    }
    if (dateFrom) {
      query = query.gte('date_timestamp', parseInt(dateFrom))
    }
    if (dateTo) {
      query = query.lte('date_timestamp', parseInt(dateTo))
    }
    if (search) {
      query = query.or(`customer_name.ilike.%${search}%,customer_phone.ilike.%${search}%`)
    }

    const { data: reservations, count, error } = await query

    if (error) {
      console.error('[Dev Reservations API] Error:', error)
      return Response.json({ error: 'Failed to fetch reservations' }, { status: 500 })
    }

    // Get barber names
    const barberIds = [...new Set(reservations?.map(r => r.barber_id) || [])]
    const { data: barbers } = await supabase
      .from('users')
      .select('id, fullname')
      .in('id', barberIds)

    const barberMap = new Map(barbers?.map(b => [b.id, b.fullname]) || [])

    // Enrich reservations
    const enrichedReservations = reservations?.map(res => ({
      ...res,
      barber_name: barberMap.get(res.barber_id) || 'Unknown',
      service_name: res.services?.name_he || res.services?.name || 'Unknown',
      service_price: res.services?.price || 0,
      service_duration: res.services?.duration || 30,
    }))

    // Get stats for the current filter
    const statsQuery = supabase.from('reservations').select('status')
    if (barberId) statsQuery.eq('barber_id', barberId)
    if (dateFrom) statsQuery.gte('date_timestamp', parseInt(dateFrom))
    if (dateTo) statsQuery.lte('date_timestamp', parseInt(dateTo))
    
    const { data: statsData } = await statsQuery

    const stats = {
      total: statsData?.length || 0,
      confirmed: statsData?.filter(r => r.status === 'confirmed').length || 0,
      cancelled: statsData?.filter(r => r.status === 'cancelled').length || 0,
    }

    return Response.json({
      reservations: enrichedReservations,
      stats,
      total: count || 0,
      limit,
      offset,
    })
  } catch (error) {
    console.error('[Dev Reservations API] Error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
