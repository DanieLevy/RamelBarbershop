import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateDevToken, unauthorizedResponse } from '@/lib/auth/dev-auth'

export const dynamic = 'force-dynamic'

/**
 * GET /api/dev/barbers
 * Returns all barbers with stats
 */
export async function GET(request: NextRequest) {
  if (!validateDevToken(request)) {
    return unauthorizedResponse()
  }

  try {
    const supabase = await createClient()

    // Get all barbers
    const { data: barbers, error } = await supabase
      .from('users')
      .select('id, username, fullname, name_en, img_url, phone, email, is_barber, is_active, role, display_order')
      .eq('is_barber', true)
      .order('display_order', { ascending: true })

    if (error) {
      console.error('[Dev Barbers API] Error:', error)
      return Response.json({ error: 'Failed to fetch barbers' }, { status: 500 })
    }

    const barberIds = barbers?.map(b => b.id) || []

    // Get additional stats
    const [servicesResult, reservationsResult, workDaysResult] = await Promise.all([
      supabase
        .from('services')
        .select('barber_id, is_active')
        .in('barber_id', barberIds),
      supabase
        .from('reservations')
        .select('barber_id, status')
        .in('barber_id', barberIds),
      supabase
        .from('work_days')
        .select('user_id, day_of_week, is_working, start_time, end_time')
        .in('user_id', barberIds),
    ])

    // Count services per barber
    const servicesCount = new Map<string, { total: number; active: number }>()
    servicesResult.data?.forEach(s => {
      if (!s.barber_id) return
      const current = servicesCount.get(s.barber_id) || { total: 0, active: 0 }
      current.total++
      if (s.is_active) current.active++
      servicesCount.set(s.barber_id, current)
    })

    // Count reservations per barber
    const reservationsCount = new Map<string, { total: number; confirmed: number; cancelled: number }>()
    reservationsResult.data?.forEach(r => {
      const current = reservationsCount.get(r.barber_id) || { total: 0, confirmed: 0, cancelled: 0 }
      current.total++
      if (r.status === 'confirmed') current.confirmed++
      if (r.status === 'cancelled') current.cancelled++
      reservationsCount.set(r.barber_id, current)
    })

    // Get work schedule per barber
    const workSchedule = new Map<string, Array<{ day: string; working: boolean; hours?: string }>>()
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    
    barberIds.forEach(id => {
      const schedule = dayNames.map(day => {
        const dayData = workDaysResult.data?.find(
          wd => wd.user_id === id && wd.day_of_week === day
        )
        return {
          day,
          working: dayData?.is_working || false,
          hours: dayData?.is_working ? `${dayData.start_time}-${dayData.end_time}` : undefined,
        }
      })
      workSchedule.set(id, schedule)
    })

    // Enrich barbers with stats
    const enrichedBarbers = barbers?.map(barber => ({
      ...barber,
      services: servicesCount.get(barber.id) || { total: 0, active: 0 },
      reservations: reservationsCount.get(barber.id) || { total: 0, confirmed: 0, cancelled: 0 },
      work_schedule: workSchedule.get(barber.id) || [],
    }))

    return Response.json({
      barbers: enrichedBarbers,
      total: barbers?.length || 0,
    })
  } catch (error) {
    console.error('[Dev Barbers API] Error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
