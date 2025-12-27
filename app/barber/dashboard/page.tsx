'use client'

import { useEffect, useState } from 'react'
import { useBarberAuthStore } from '@/store/useBarberAuthStore'
import { createClient } from '@/lib/supabase/client'
import { FaCalendarAlt, FaClock, FaCheckCircle, FaTimesCircle } from 'react-icons/fa'
import type { Reservation, Service } from '@/types/database'

interface DashboardStats {
  todayReservations: number
  upcomingReservations: number
  completedToday: number
  cancelledToday: number
}

interface UpcomingReservation extends Reservation {
  services?: Service
}

export default function DashboardPage() {
  const { barber, isAdmin } = useBarberAuthStore()
  const [stats, setStats] = useState<DashboardStats>({
    todayReservations: 0,
    upcomingReservations: 0,
    completedToday: 0,
    cancelledToday: 0,
  })
  const [upcomingList, setUpcomingList] = useState<UpcomingReservation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (barber?.id) {
      fetchDashboardData()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barber?.id])

  const fetchDashboardData = async () => {
    if (!barber?.id) return
    
    setLoading(true)
    const supabase = createClient()
    
    const now = Date.now()
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date()
    todayEnd.setHours(23, 59, 59, 999)
    
    try {
      // Fetch all reservations for this barber
      const { data: reservations } = await supabase
        .from('reservations')
        .select('*, services(*)')
        .eq('barber_id', barber.id)
        .gte('time_timestamp', todayStart.getTime())
        .order('time_timestamp', { ascending: true })
      
      const allRes = (reservations || []) as UpcomingReservation[]
      
      // Calculate stats
      const todayRes = allRes.filter(
        r => r.time_timestamp >= todayStart.getTime() && r.time_timestamp <= todayEnd.getTime()
      )
      
      const upcoming = allRes.filter(
        r => r.time_timestamp > now && r.status === 'confirmed'
      )
      
      const completed = todayRes.filter(r => r.status === 'completed')
      const cancelled = todayRes.filter(r => r.status === 'cancelled')
      
      setStats({
        todayReservations: todayRes.filter(r => r.status === 'confirmed').length,
        upcomingReservations: upcoming.length,
        completedToday: completed.length,
        cancelledToday: cancelled.length,
      })
      
      // Get next 5 upcoming reservations
      setUpcomingList(upcoming.slice(0, 5))
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (timestamp: number): string => {
    return new Date(timestamp).toLocaleTimeString('he-IL', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleDateString('he-IL', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    })
  }

  return (
    <div className="max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-medium text-foreground-light">
          שלום, {barber?.fullname}! 👋
        </h1>
        <p className="text-foreground-muted mt-1">
          הנה סיכום היום שלך
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={FaCalendarAlt}
          label="תורים להיום"
          value={stats.todayReservations}
          color="gold"
          loading={loading}
        />
        <StatCard
          icon={FaClock}
          label="תורים קרובים"
          value={stats.upcomingReservations}
          color="blue"
          loading={loading}
        />
        <StatCard
          icon={FaCheckCircle}
          label="הושלמו היום"
          value={stats.completedToday}
          color="green"
          loading={loading}
        />
        <StatCard
          icon={FaTimesCircle}
          label="בוטלו היום"
          value={stats.cancelledToday}
          color="red"
          loading={loading}
        />
      </div>

      {/* Upcoming Reservations */}
      <div className="bg-background-card border border-white/10 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-foreground-light">התורים הקרובים</h2>
          <a
            href="/barber/dashboard/reservations"
            className="text-accent-gold text-sm hover:underline"
          >
            הצג הכל →
          </a>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-8 h-8 border-2 border-accent-gold border-t-transparent rounded-full animate-spin" />
          </div>
        ) : upcomingList.length === 0 ? (
          <div className="text-center py-8">
            <FaCalendarAlt className="w-12 h-12 text-foreground-muted/30 mx-auto mb-3" />
            <p className="text-foreground-muted">אין תורים קרובים</p>
          </div>
        ) : (
          <div className="space-y-3">
            {upcomingList.map((res) => (
              <div
                key={res.id}
                className="flex items-center justify-between p-4 bg-background-dark rounded-xl border border-white/5"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-accent-gold/20 flex items-center justify-center">
                    <FaCalendarAlt className="w-5 h-5 text-accent-gold" />
                  </div>
                  <div>
                    <p className="text-foreground-light font-medium">
                      {res.customer_name}
                    </p>
                    <p className="text-foreground-muted text-sm">
                      {res.services?.name_he || 'שירות'}
                    </p>
                  </div>
                </div>
                <div className="text-left">
                  <p className="text-foreground-light font-medium" dir="ltr">
                    {formatTime(res.time_timestamp)}
                  </p>
                  <p className="text-foreground-muted text-sm">
                    {formatDate(res.time_timestamp)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Admin Quick Actions */}
      {isAdmin && (
        <div className="mt-8 p-6 bg-accent-gold/10 border border-accent-gold/30 rounded-2xl">
          <h3 className="text-lg font-medium text-accent-gold mb-3">פעולות מנהל מהירות</h3>
          <div className="flex flex-wrap gap-3">
            <a
              href="/barber/dashboard/barbers"
              className="px-4 py-2 bg-background-dark rounded-lg text-sm text-foreground-light hover:bg-white/5 transition-colors"
            >
              ניהול ספרים
            </a>
            <a
              href="/barber/dashboard/schedule"
              className="px-4 py-2 bg-background-dark rounded-lg text-sm text-foreground-light hover:bg-white/5 transition-colors"
            >
              שעות פתיחה
            </a>
            <a
              href="/barber/dashboard/closures"
              className="px-4 py-2 bg-background-dark rounded-lg text-sm text-foreground-light hover:bg-white/5 transition-colors"
            >
              ימי סגירה
            </a>
            <a
              href="/barber/dashboard/settings"
              className="px-4 py-2 bg-background-dark rounded-lg text-sm text-foreground-light hover:bg-white/5 transition-colors"
            >
              הגדרות מספרה
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
  loading,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number
  color: 'gold' | 'blue' | 'green' | 'red'
  loading: boolean
}) {
  const colorClasses = {
    gold: 'bg-accent-gold/20 text-accent-gold',
    blue: 'bg-blue-500/20 text-blue-400',
    green: 'bg-green-500/20 text-green-400',
    red: 'bg-red-500/20 text-red-400',
  }

  return (
    <div className="bg-background-card border border-white/10 rounded-xl p-5">
      <div className={`w-10 h-10 rounded-lg ${colorClasses[color]} flex items-center justify-center mb-3`}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-foreground-muted text-sm">{label}</p>
      {loading ? (
        <div className="h-8 w-12 bg-foreground-muted/20 rounded animate-pulse mt-1" />
      ) : (
        <p className="text-2xl font-bold text-foreground-light mt-1">{value}</p>
      )}
    </div>
  )
}

