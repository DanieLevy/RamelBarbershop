'use client'

import { useEffect, useState } from 'react'
import { useBarberAuthStore } from '@/store/useBarberAuthStore'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { cn, formatTime as formatTimeUtil, nowInIsrael } from '@/lib/utils'
import { startOfDay, endOfDay, startOfWeek, endOfWeek, isSameDay, addDays, startOfMonth, endOfMonth } from 'date-fns'
import { 
  Calendar, Clock, TrendingDown, Users, 
  CalendarOff, Store,
  ChevronLeft, Phone, Package
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Reservation, Service } from '@/types/database'
import { useBugReporter } from '@/hooks/useBugReporter'

interface DashboardStats {
  todayAppointments: number
  weekAppointments: number
  newCustomersMonth: number
  cancellationRate: number
}

interface UpcomingReservation extends Reservation {
  services?: Service
}

export default function DashboardPage() {
  const { barber, isAdmin } = useBarberAuthStore()
  const { report } = useBugReporter('DashboardPage')
  const [stats, setStats] = useState<DashboardStats>({
    todayAppointments: 0,
    weekAppointments: 0,
    newCustomersMonth: 0,
    cancellationRate: 0,
  })
  const [upcomingList, setUpcomingList] = useState<UpcomingReservation[]>([])
  const [loading, setLoading] = useState(true)

  const israelNow = nowInIsrael()

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
    const todayStart = startOfDay(israelNow)
    const todayEnd = endOfDay(israelNow)
    const weekStart = startOfWeek(israelNow, { weekStartsOn: 0 })
    const weekEnd = endOfWeek(israelNow, { weekStartsOn: 0 })
    const monthStart = startOfMonth(israelNow)
    const monthEnd = endOfMonth(israelNow)
    
    try {
      // Fetch reservations for stats
      const { data: reservations } = await supabase
        .from('reservations')
        .select('*, services(*)')
        .eq('barber_id', barber.id)
        .gte('time_timestamp', monthStart.getTime())
        .order('time_timestamp', { ascending: true })
      
      const allRes = (reservations || []) as UpcomingReservation[]
      
      // Today's confirmed appointments
      const todayRes = allRes.filter(
        r => r.time_timestamp >= todayStart.getTime() && 
             r.time_timestamp <= todayEnd.getTime() &&
             r.status === 'confirmed'
      )
      
      // Week's confirmed appointments
      const weekRes = allRes.filter(
        r => r.time_timestamp >= weekStart.getTime() && 
             r.time_timestamp <= weekEnd.getTime() &&
             r.status === 'confirmed'
      )
      
      // Month stats for cancellation rate
      const monthRes = allRes.filter(
        r => r.time_timestamp >= monthStart.getTime() && 
             r.time_timestamp <= monthEnd.getTime()
      )
      const cancelledMonth = monthRes.filter(r => r.status === 'cancelled')
      const cancellationRate = monthRes.length > 0 
        ? Math.round((cancelledMonth.length / monthRes.length) * 100) 
        : 0

      // Unique customers this month (by phone)
      const uniquePhones = new Set(monthRes.map(r => r.customer_phone))
      
      // Upcoming reservations
      const upcoming = allRes.filter(
        r => r.time_timestamp > now && r.status === 'confirmed'
      )
      
      setStats({
        todayAppointments: todayRes.length,
        weekAppointments: weekRes.length,
        newCustomersMonth: uniquePhones.size,
        cancellationRate,
      })
      
      setUpcomingList(upcoming.slice(0, 5))
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
      await report(error, 'Fetching barber dashboard data')
    } finally {
      setLoading(false)
    }
  }

  // Smart date/time display
  const getSmartDateTime = (timestamp: number): { date: string; time: string; isToday: boolean } => {
    const resDate = new Date(timestamp)
    const isToday = isSameDay(resDate, israelNow)
    const isTomorrow = isSameDay(resDate, addDays(israelNow, 1))
    
    let dateStr = ''
    if (isToday) dateStr = 'היום'
    else if (isTomorrow) dateStr = 'מחר'
    else dateStr = resDate.toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'short' })
    
    return { 
      date: dateStr, 
      time: formatTimeUtil(timestamp), 
      isToday 
    }
  }

  // Admin quick actions
  const adminActions: { href: string; icon: LucideIcon; label: string }[] = [
    { href: '/barber/dashboard/barbers', icon: Users, label: 'ספרים' },
    { href: '/barber/dashboard/users', icon: Users, label: 'לקוחות' },
    { href: '/barber/dashboard/schedule', icon: Clock, label: 'שעות' },
    { href: '/barber/dashboard/closures', icon: CalendarOff, label: 'סגירות' },
    { href: '/barber/dashboard/products', icon: Package, label: 'מוצרים' },
    { href: '/barber/dashboard/settings', icon: Store, label: 'הגדרות' },
  ]

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-medium text-foreground-light">
          שלום, {barber?.fullname}! 👋
        </h1>
        <p className="text-foreground-muted text-sm mt-0.5">הנה סיכום הפעילות שלך</p>
      </div>

      {/* Stats Grid - 2x2 on mobile */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <StatCard
          icon={Calendar}
          label="תורים היום"
          value={stats.todayAppointments.toString()}
          color="gold"
          loading={loading}
        />
        <StatCard
          icon={Clock}
          label="תורים השבוע"
          value={stats.weekAppointments.toString()}
          color="blue"
          loading={loading}
        />
        <StatCard
          icon={Users}
          label="לקוחות החודש"
          value={stats.newCustomersMonth.toString()}
          color="green"
          loading={loading}
        />
        <StatCard
          icon={TrendingDown}
          label="אחוז ביטולים"
          value={`${stats.cancellationRate}%`}
          color={stats.cancellationRate > 20 ? 'red' : 'muted'}
          loading={loading}
        />
      </div>

      {/* Upcoming Appointments - Compact Cards */}
      <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden mb-6">
        <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
          <h2 className="font-medium text-foreground-light">התורים הקרובים</h2>
          <Link
            href="/barber/dashboard/reservations"
            className="flex items-center gap-1 text-accent-gold text-sm hover:underline"
          >
            הצג הכל
            <ChevronLeft size={14} />
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-6 h-6 border-2 border-accent-gold border-t-transparent rounded-full animate-spin" />
          </div>
        ) : upcomingList.length === 0 ? (
          <div className="text-center py-10">
            <Calendar size={36} strokeWidth={1} className="text-foreground-muted/30 mx-auto mb-2" />
            <p className="text-foreground-muted text-sm">אין תורים קרובים</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {upcomingList.map((res) => {
              const smartDate = getSmartDateTime(res.time_timestamp)
              
              return (
                <Link
                  key={res.id}
                  href="/barber/dashboard/reservations"
                  className="flex items-center gap-3 px-3 sm:px-4 py-3 hover:bg-white/[0.03] transition-colors cursor-pointer"
                >
                  {/* Time Display - Before indicator */}
                  <div className="flex flex-col items-center shrink-0 w-12">
                    <span className={cn(
                      'text-lg font-bold tabular-nums',
                      smartDate.isToday ? 'text-accent-gold' : 'text-foreground-muted'
                    )}>
                      {smartDate.time}
                    </span>
                    <span className="text-[10px] text-foreground-muted/70">
                      {smartDate.isToday ? 'היום' : smartDate.date}
                    </span>
                  </div>
                  
                  {/* Status line */}
                  <div className={cn(
                    'w-1 h-10 rounded-full shrink-0',
                    smartDate.isToday ? 'bg-accent-gold' : 'bg-foreground-muted/30'
                  )} />
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-foreground-light font-medium text-sm truncate">
                      {res.customer_name}
                    </p>
                    <p className="text-foreground-muted text-xs truncate">
                      {res.services?.name_he || 'שירות'}
                    </p>
                  </div>
                  
                  {/* Phone */}
                  <a
                    href={`tel:${res.customer_phone}`}
                    onClick={(e) => e.stopPropagation()}
                    className="icon-btn p-2 rounded-lg hover:bg-accent-gold/10 transition-colors shrink-0"
                    aria-label="התקשר"
                  >
                    <Phone size={16} strokeWidth={1.5} className="text-accent-gold" />
                  </a>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {/* Admin Quick Actions - Compact Grid */}
      {isAdmin && (
        <div className="bg-accent-gold/5 border border-accent-gold/20 rounded-2xl p-4">
          <h3 className="text-sm font-medium text-accent-gold mb-3">פעולות מנהל</h3>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {adminActions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-background-dark/50 hover:bg-background-dark transition-colors group"
              >
                <action.icon 
                  size={20} 
                  strokeWidth={1.5} 
                  className="text-foreground-muted group-hover:text-accent-gold transition-colors" 
                />
                <span className="text-xs text-foreground-muted group-hover:text-foreground-light transition-colors">
                  {action.label}
                </span>
              </Link>
            ))}
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
  icon: LucideIcon
  label: string
  value: string
  color: 'gold' | 'blue' | 'green' | 'red' | 'muted'
  loading: boolean
}) {
  const colorClasses = {
    gold: 'bg-accent-gold/15 text-accent-gold',
    blue: 'bg-blue-500/15 text-blue-400',
    green: 'bg-green-500/15 text-green-400',
    red: 'bg-red-500/15 text-red-400',
    muted: 'bg-foreground-muted/15 text-foreground-muted',
  }

  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
      <div className={cn(
        'w-9 h-9 rounded-lg flex items-center justify-center mb-2.5',
        colorClasses[color]
      )}>
        <Icon size={18} strokeWidth={1.5} />
      </div>
      <p className="text-foreground-muted text-xs mb-0.5">{label}</p>
      {loading ? (
        <div className="h-7 w-10 bg-foreground-muted/20 rounded animate-pulse" />
      ) : (
        <p className="text-xl font-bold text-foreground-light">{value}</p>
      )}
    </div>
  )
}
