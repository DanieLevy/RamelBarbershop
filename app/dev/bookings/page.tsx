'use client'

import { useState, useEffect, useCallback } from 'react'
import { useDevAuthStore } from '@/store/useDevAuthStore'
import { StatusBadge } from '@/components/dev/StatusBadge'
import { 
  Search, 
  RefreshCw,
  Calendar,
  Clock,
  ChevronDown,
  ChevronUp,
  Filter,
  Scissors
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDistanceToNow, format } from 'date-fns'

type DateFilter = 'today' | 'week' | 'month' | 'all'
type StatusFilter = 'all' | 'confirmed' | 'cancelled'

interface Reservation {
  id: string
  customer_name: string
  customer_phone: string
  barber_id: string
  barber_name: string
  service_id: string
  service_name: string
  service_price: number
  service_duration: number
  time_timestamp: number
  date_timestamp: number
  day_num: string
  status: 'confirmed' | 'cancelled'
  cancellation_reason: string | null
  cancelled_by: 'customer' | 'barber' | null
  barber_notes: string | null
  created_at: string
}

interface Stats {
  total: number
  confirmed: number
  cancelled: number
}

interface Barber {
  id: string
  fullname: string
}

export default function DevBookingsPage() {
  const { devToken } = useDevAuthStore()
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [stats, setStats] = useState<Stats>({ total: 0, confirmed: 0, cancelled: 0 })
  const [barbers, setBarbers] = useState<Barber[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dateFilter, setDateFilter] = useState<DateFilter>('today')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [barberFilter, setBarberFilter] = useState<string>('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)

  // Calculate date range
  const getDateRange = useCallback(() => {
    const now = new Date()
    const todayStart = new Date(now)
    todayStart.setHours(0, 0, 0, 0)
    
    switch (dateFilter) {
      case 'today':
        return {
          from: todayStart.getTime(),
          to: todayStart.getTime() + 86400000,
        }
      case 'week':
        return {
          from: todayStart.getTime() - (7 * 86400000),
          to: todayStart.getTime() + 86400000,
        }
      case 'month':
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
        return {
          from: monthStart.getTime(),
          to: todayStart.getTime() + 86400000,
        }
      default:
        return { from: undefined, to: undefined }
    }
  }, [dateFilter])

  const fetchBarbers = useCallback(async () => {
    try {
      const response = await fetch('/api/dev/barbers', {
        headers: { 'X-Dev-Token': devToken || '' },
      })
      if (response.ok) {
        const data = await response.json()
        setBarbers(data.barbers.map((b: Barber) => ({ id: b.id, fullname: b.fullname })))
      }
    } catch (error) {
      console.error('Failed to fetch barbers:', error)
    }
  }, [devToken])

  const fetchReservations = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      const dateRange = getDateRange()
      
      if (dateRange.from) params.set('dateFrom', dateRange.from.toString())
      if (dateRange.to) params.set('dateTo', dateRange.to.toString())
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (barberFilter) params.set('barberId', barberFilter)
      if (search) params.set('search', search)
      
      const response = await fetch(`/api/dev/reservations?${params}`, {
        headers: { 'X-Dev-Token': devToken || '' },
      })
      
      if (response.ok) {
        const data = await response.json()
        setReservations(data.reservations)
        setStats(data.stats)
      }
    } catch (error) {
      console.error('Failed to fetch reservations:', error)
    } finally {
      setLoading(false)
    }
  }, [devToken, getDateRange, statusFilter, barberFilter, search])

  useEffect(() => {
    fetchBarbers()
  }, [fetchBarbers])

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchReservations()
    }, 300)
    return () => clearTimeout(timer)
  }, [fetchReservations])

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id)
  }

  const formatTime = (timestamp: number) => {
    return format(new Date(timestamp), 'HH:mm')
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Bookings</h1>
        <button
          onClick={fetchReservations}
          className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors flex items-center justify-center"
          aria-label="Refresh"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-3 gap-2">
        <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-center">
          <p className="text-lg font-bold text-white">{stats.total}</p>
          <p className="text-[10px] text-zinc-500">Total</p>
        </div>
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
          <p className="text-lg font-bold text-emerald-400">{stats.confirmed}</p>
          <p className="text-[10px] text-emerald-400/70">Confirmed</p>
        </div>
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-center">
          <p className="text-lg font-bold text-red-400">{stats.cancelled}</p>
          <p className="text-[10px] text-red-400/70">
            Cancelled ({stats.total > 0 ? Math.round((stats.cancelled / stats.total) * 100) : 0}%)
          </p>
        </div>
      </div>

      {/* Quick Filters */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
        {(['today', 'week', 'month', 'all'] as DateFilter[]).map((filter) => (
          <button
            key={filter}
            onClick={() => setDateFilter(filter)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors',
              dateFilter === filter
                ? 'bg-emerald-600 text-white'
                : 'bg-zinc-800 text-zinc-400 hover:text-white'
            )}
          >
            {filter === 'today' && 'Today'}
            {filter === 'week' && 'This Week'}
            {filter === 'month' && 'This Month'}
            {filter === 'all' && 'All Time'}
          </button>
        ))}
      </div>

      {/* Search & Advanced Filters */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search customer..."
              className="w-full p-3 pr-10 rounded-xl bg-zinc-900 border border-zinc-800 text-white placeholder:text-zinc-600 outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              'p-3 rounded-xl border transition-colors',
              showFilters
                ? 'bg-emerald-600 border-emerald-600 text-white'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400'
            )}
          >
            <Filter size={18} />
          </button>
        </div>
        
        {showFilters && (
          <div className="grid grid-cols-2 gap-2 p-3 bg-zinc-900 rounded-xl border border-zinc-800">
            <div>
              <label className="text-zinc-500 text-xs mb-1 block">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="w-full p-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm outline-none"
              >
                <option value="all">All</option>
                <option value="confirmed">Confirmed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div>
              <label className="text-zinc-500 text-xs mb-1 block">Barber</label>
              <select
                value={barberFilter}
                onChange={(e) => setBarberFilter(e.target.value)}
                className="w-full p-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm outline-none"
              >
                <option value="">All Barbers</option>
                {barbers.map((barber) => (
                  <option key={barber.id} value={barber.id}>
                    {barber.fullname}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Reservations List */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-24 bg-zinc-900 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : reservations.length === 0 ? (
        <div className="text-center py-12">
          <Calendar size={48} className="mx-auto text-zinc-700 mb-4" />
          <p className="text-zinc-500">No reservations found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {reservations.map((res) => (
            <div
              key={res.id}
              className={cn(
                'bg-zinc-900 border rounded-xl overflow-hidden',
                res.status === 'cancelled' ? 'border-red-500/20' : 'border-zinc-800'
              )}
            >
              <button
                onClick={() => toggleExpand(res.id)}
                className="w-full p-4 flex items-start justify-between text-left"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium text-white truncate">
                      {res.customer_name}
                    </p>
                    <StatusBadge
                      status={res.status === 'confirmed' ? 'success' : 'error'}
                      label={res.status === 'confirmed' ? 'OK' : 'X'}
                      dot={false}
                    />
                  </div>
                  <div className="flex items-center gap-3 text-xs text-zinc-500">
                    <span className="flex items-center gap-1">
                      <Scissors size={10} />
                      {res.barber_name}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar size={10} />
                      {res.day_num}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={10} />
                      {formatTime(res.time_timestamp)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-400">
                    {formatDistanceToNow(res.time_timestamp, { addSuffix: true })}
                  </span>
                  {expandedId === res.id ? (
                    <ChevronUp size={18} className="text-zinc-500" />
                  ) : (
                    <ChevronDown size={18} className="text-zinc-500" />
                  )}
                </div>
              </button>
              
              {expandedId === res.id && (
                <div className="px-4 pb-4 border-t border-zinc-800 pt-3 space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-zinc-500">Phone</p>
                      <p className="text-zinc-300" dir="ltr">{res.customer_phone}</p>
                    </div>
                    <div>
                      <p className="text-zinc-500">Service</p>
                      <p className="text-zinc-300">{res.service_name}</p>
                    </div>
                    <div>
                      <p className="text-zinc-500">Price</p>
                      <p className="text-zinc-300">₪{res.service_price}</p>
                    </div>
                    <div>
                      <p className="text-zinc-500">Duration</p>
                      <p className="text-zinc-300">{res.service_duration} min</p>
                    </div>
                    <div>
                      <p className="text-zinc-500">Created</p>
                      <p className="text-zinc-300">
                        {format(new Date(res.created_at), 'dd/MM HH:mm')}
                      </p>
                    </div>
                    <div>
                      <p className="text-zinc-500">ID</p>
                      <p className="text-zinc-300 font-mono text-[10px] truncate">{res.id}</p>
                    </div>
                  </div>
                  
                  {res.barber_notes && (
                    <div className="p-2 bg-zinc-800 rounded-lg">
                      <p className="text-zinc-500 text-[10px] mb-1">Barber Notes</p>
                      <p className="text-zinc-300 text-xs">{res.barber_notes}</p>
                    </div>
                  )}
                  
                  {res.status === 'cancelled' && (
                    <div className="p-2 bg-red-500/10 rounded-lg">
                      <p className="text-red-400 text-xs">
                        Cancelled by {res.cancelled_by || 'unknown'}
                        {res.cancellation_reason && `: ${res.cancellation_reason}`}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
