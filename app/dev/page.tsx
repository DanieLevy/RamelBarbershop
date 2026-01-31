'use client'

import { useState, useEffect, useCallback } from 'react'
import { useDevAuthStore } from '@/store/useDevAuthStore'
import { StatsCard } from '@/components/dev/StatsCard'
import { StatusBadge } from '@/components/dev/StatusBadge'
import { 
  Users, 
  Scissors, 
  Calendar, 
  Bell, 
  Database, 
  Wifi, 
  WifiOff,
  RefreshCw,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'

interface DashboardStats {
  customers: { total: number; thisMonth: number; blocked: number }
  barbers: { total: number; active: number }
  reservations: { total: number; today: number; confirmed: number; cancelled: number }
  notifications: { subscriptions: number; active: number; failed: number }
  health: { database: 'healthy' | 'degraded' | 'unhealthy'; push: boolean }
}

interface RecentReservation {
  id: string
  customer_name: string
  barber_name: string
  time_timestamp: number
  status: 'confirmed' | 'cancelled'
}

interface RecentCustomer {
  id: string
  fullname: string
  phone: string
  created_at: string
}

export default function DevOverviewPage() {
  const { devToken } = useDevAuthStore()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [recentReservations, setRecentReservations] = useState<RecentReservation[]>([])
  const [recentCustomers, setRecentCustomers] = useState<RecentCustomer[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [isOnline, setIsOnline] = useState(true)

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      const response = await fetch('/api/dev/stats', {
        headers: {
          'X-Dev-Token': devToken || '',
        },
      })

      if (response.ok) {
        const data = await response.json()
        setStats(data.stats)
        setRecentReservations(data.recentReservations || [])
        setRecentCustomers(data.recentCustomers || [])
        setLastUpdated(new Date())
        setIsOnline(true)
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error)
      setIsOnline(false)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [devToken])

  useEffect(() => {
    fetchData()
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => fetchData(true), 30000)
    return () => clearInterval(interval)
  }, [fetchData])

  // Online/offline detection
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const handleRefresh = () => {
    fetchData(true)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Overview</h1>
          {lastUpdated && (
            <p className="text-zinc-500 text-xs mt-0.5">
              Last updated: {formatDistanceToNow(lastUpdated, { addSuffix: true })}
            </p>
          )}
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className={cn(
            'p-2 rounded-lg transition-colors',
            refreshing 
              ? 'text-zinc-600 cursor-not-allowed' 
              : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
          )}
          aria-label="Refresh data"
        >
          <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Offline Banner */}
      {!isOnline && (
        <div className="flex items-center gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
          <WifiOff size={18} className="text-amber-500" />
          <p className="text-amber-200 text-sm">You are offline. Showing cached data.</p>
        </div>
      )}

      {/* System Health */}
      <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
        <h2 className="text-sm font-medium text-zinc-400 mb-3">System Health</h2>
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Database size={16} className="text-zinc-500" />
            <span className="text-zinc-300 text-sm">Database:</span>
            {loading ? (
              <div className="w-16 h-5 bg-zinc-800 rounded animate-pulse" />
            ) : (
              <StatusBadge
                status={
                  stats?.health.database === 'healthy' ? 'success' :
                  stats?.health.database === 'degraded' ? 'warning' : 'error'
                }
                label={stats?.health.database || 'Unknown'}
              />
            )}
          </div>
          <div className="flex items-center gap-2">
            <Bell size={16} className="text-zinc-500" />
            <span className="text-zinc-300 text-sm">Push Service:</span>
            {loading ? (
              <div className="w-16 h-5 bg-zinc-800 rounded animate-pulse" />
            ) : (
              <StatusBadge
                status={stats?.health.push ? 'success' : 'error'}
                label={stats?.health.push ? 'Active' : 'Inactive'}
              />
            )}
          </div>
          <div className="flex items-center gap-2">
            <Wifi size={16} className="text-zinc-500" />
            <span className="text-zinc-300 text-sm">Connection:</span>
            <StatusBadge
              status={isOnline ? 'success' : 'warning'}
              label={isOnline ? 'Online' : 'Offline'}
            />
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatsCard
          title="Customers"
          value={stats?.customers.total || 0}
          subtitle={`${stats?.customers.thisMonth || 0} this month`}
          icon={<Users size={16} />}
          color="blue"
          loading={loading}
        />
        <StatsCard
          title="Active Barbers"
          value={stats?.barbers.active || 0}
          subtitle={`${stats?.barbers.total || 0} total`}
          icon={<Scissors size={16} />}
          color="emerald"
          loading={loading}
        />
        <StatsCard
          title="Today's Bookings"
          value={stats?.reservations.today || 0}
          subtitle={`${stats?.reservations.total || 0} total`}
          icon={<Calendar size={16} />}
          color="amber"
          loading={loading}
        />
        <StatsCard
          title="Push Subs"
          value={stats?.notifications.active || 0}
          subtitle={`${stats?.notifications.failed || 0} failed`}
          icon={<Bell size={16} />}
          color={stats?.notifications.failed ? 'red' : 'zinc'}
          loading={loading}
        />
      </div>

      {/* Reservation Stats */}
      <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
        <h2 className="text-sm font-medium text-zinc-400 mb-3">Reservation Stats</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-white">
              {loading ? '-' : stats?.reservations.confirmed || 0}
            </p>
            <p className="text-xs text-emerald-400 flex items-center justify-center gap-1">
              <CheckCircle size={12} />
              Confirmed
            </p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-white">
              {loading ? '-' : stats?.reservations.cancelled || 0}
            </p>
            <p className="text-xs text-red-400 flex items-center justify-center gap-1">
              <XCircle size={12} />
              Cancelled
            </p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-white">
              {loading ? '-' : 
                stats?.reservations.total 
                  ? `${Math.round((stats.reservations.cancelled / stats.reservations.total) * 100)}%`
                  : '0%'
              }
            </p>
            <p className="text-xs text-amber-400 flex items-center justify-center gap-1">
              <AlertTriangle size={12} />
              Cancel Rate
            </p>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Recent Reservations */}
        <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
          <h2 className="text-sm font-medium text-zinc-400 mb-3">Recent Reservations</h2>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 bg-zinc-800 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : recentReservations.length === 0 ? (
            <p className="text-zinc-500 text-sm text-center py-6">No recent reservations</p>
          ) : (
            <div className="space-y-2">
              {recentReservations.map((res) => (
                <div
                  key={res.id}
                  className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-white truncate">{res.customer_name}</p>
                    <p className="text-xs text-zinc-500 flex items-center gap-1">
                      <Scissors size={10} />
                      {res.barber_name}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-400 flex items-center gap-1">
                      <Clock size={10} />
                      {formatDistanceToNow(res.time_timestamp, { addSuffix: true })}
                    </span>
                    <StatusBadge
                      status={res.status === 'confirmed' ? 'success' : 'error'}
                      label={res.status === 'confirmed' ? 'OK' : 'X'}
                      dot={false}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Customers */}
        <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
          <h2 className="text-sm font-medium text-zinc-400 mb-3">New Customers</h2>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 bg-zinc-800 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : recentCustomers.length === 0 ? (
            <p className="text-zinc-500 text-sm text-center py-6">No recent customers</p>
          ) : (
            <div className="space-y-2">
              {recentCustomers.map((customer) => (
                <div
                  key={customer.id}
                  className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-white truncate">{customer.fullname}</p>
                    <p className="text-xs text-zinc-500" dir="ltr">{customer.phone}</p>
                  </div>
                  <span className="text-xs text-zinc-400">
                    {formatDistanceToNow(new Date(customer.created_at), { addSuffix: true })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
