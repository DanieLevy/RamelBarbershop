'use client'

import { useState, useEffect, useCallback } from 'react'
import { useDevAuthStore } from '@/store/useDevAuthStore'
import { StatusBadge } from '@/components/dev/StatusBadge'
import { 
  Search, 
  Users, 
  Scissors, 
  RefreshCw,
  Smartphone,
  Bell,
  BellOff,
  Calendar,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDistanceToNow, format } from 'date-fns'

type Tab = 'customers' | 'barbers'

interface Customer {
  id: string
  fullname: string
  phone: string
  email: string | null
  auth_method: 'phone' | 'email' | 'both'
  is_blocked: boolean
  blocked_reason: string | null
  last_login_at: string | null
  created_at: string
  pwa_installed: boolean
  notifications_enabled: boolean
  push_subscriptions_count: number
  reservations_count: number
}

interface Barber {
  id: string
  fullname: string
  username: string | null
  email: string | null
  phone: string | null
  role: 'admin' | 'barber'
  is_active: boolean
  created_at: string
  services: { total: number; active: number }
  reservations: { total: number; confirmed: number; cancelled: number }
  work_schedule: Array<{ day: string; working: boolean; hours?: string }>
}

export default function DevUsersPage() {
  const { devToken } = useDevAuthStore()
  const [tab, setTab] = useState<Tab>('customers')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [barbers, setBarbers] = useState<Barber[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [totalCustomers, setTotalCustomers] = useState(0)

  const fetchCustomers = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      
      const response = await fetch(`/api/dev/customers?${params}`, {
        headers: { 'X-Dev-Token': devToken || '' },
      })
      
      if (response.ok) {
        const data = await response.json()
        setCustomers(data.customers)
        setTotalCustomers(data.total)
      }
    } catch (error) {
      console.error('Failed to fetch customers:', error)
    } finally {
      setLoading(false)
    }
  }, [devToken, search])

  const fetchBarbers = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/dev/barbers', {
        headers: { 'X-Dev-Token': devToken || '' },
      })
      
      if (response.ok) {
        const data = await response.json()
        setBarbers(data.barbers)
      }
    } catch (error) {
      console.error('Failed to fetch barbers:', error)
    } finally {
      setLoading(false)
    }
  }, [devToken])

  useEffect(() => {
    if (tab === 'customers') {
      fetchCustomers()
    } else {
      fetchBarbers()
    }
  }, [tab, fetchCustomers, fetchBarbers])

  // Debounced search
  useEffect(() => {
    if (tab === 'customers') {
      const timer = setTimeout(() => {
        fetchCustomers()
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [search, tab, fetchCustomers])

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id)
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Users</h1>
        <button
          onClick={() => tab === 'customers' ? fetchCustomers() : fetchBarbers()}
          className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors flex items-center justify-center"
          aria-label="Refresh"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-zinc-900 rounded-xl">
        <button
          onClick={() => setTab('customers')}
          className={cn(
            'flex-1 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2',
            tab === 'customers'
              ? 'bg-emerald-600 text-white'
              : 'text-zinc-400 hover:text-white'
          )}
        >
          <Users size={16} />
          Customers
        </button>
        <button
          onClick={() => setTab('barbers')}
          className={cn(
            'flex-1 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2',
            tab === 'barbers'
              ? 'bg-emerald-600 text-white'
              : 'text-zinc-400 hover:text-white'
          )}
        >
          <Scissors size={16} />
          Barbers
        </button>
      </div>

      {/* Search (customers only) */}
      {tab === 'customers' && (
        <div className="relative">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, phone, or email..."
            className="w-full p-3 pr-10 rounded-xl bg-zinc-900 border border-zinc-800 text-white placeholder:text-zinc-600 outline-none focus:ring-2 focus:ring-emerald-500/50"
          />
        </div>
      )}

      {/* Count */}
      <p className="text-zinc-500 text-sm">
        {tab === 'customers' 
          ? `${totalCustomers} customers total`
          : `${barbers.length} barbers total`
        }
      </p>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-20 bg-zinc-900 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : tab === 'customers' ? (
        <div className="space-y-2">
          {customers.map((customer) => (
            <div
              key={customer.id}
              className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden"
            >
              <button
                onClick={() => toggleExpand(customer.id)}
                className="w-full p-4 flex items-start justify-between text-left"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium text-white truncate">
                      {customer.fullname}
                    </p>
                    {customer.is_blocked && (
                      <StatusBadge status="error" label="Blocked" />
                    )}
                  </div>
                  <p className="text-xs text-zinc-500" dir="ltr">{customer.phone}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className={cn(
                      'flex items-center gap-1 text-[10px]',
                      customer.pwa_installed ? 'text-emerald-400' : 'text-zinc-600'
                    )}>
                      <Smartphone size={10} />
                      PWA
                    </span>
                    <span className={cn(
                      'flex items-center gap-1 text-[10px]',
                      customer.notifications_enabled ? 'text-emerald-400' : 'text-zinc-600'
                    )}>
                      {customer.notifications_enabled ? <Bell size={10} /> : <BellOff size={10} />}
                      Push
                    </span>
                    <span className="flex items-center gap-1 text-[10px] text-zinc-500">
                      <Calendar size={10} />
                      {customer.reservations_count} bookings
                    </span>
                  </div>
                </div>
                {expandedId === customer.id ? (
                  <ChevronUp size={18} className="text-zinc-500" />
                ) : (
                  <ChevronDown size={18} className="text-zinc-500" />
                )}
              </button>
              
              {expandedId === customer.id && (
                <div className="px-4 pb-4 border-t border-zinc-800 pt-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-zinc-500">Email</p>
                      <p className="text-zinc-300">{customer.email || '-'}</p>
                    </div>
                    <div>
                      <p className="text-zinc-500">Auth Method</p>
                      <p className="text-zinc-300">{customer.auth_method}</p>
                    </div>
                    <div>
                      <p className="text-zinc-500">Registered</p>
                      <p className="text-zinc-300">
                        {format(new Date(customer.created_at), 'dd/MM/yyyy')}
                      </p>
                    </div>
                    <div>
                      <p className="text-zinc-500">Last Login</p>
                      <p className="text-zinc-300">
                        {customer.last_login_at 
                          ? formatDistanceToNow(new Date(customer.last_login_at), { addSuffix: true })
                          : 'Never'
                        }
                      </p>
                    </div>
                    <div>
                      <p className="text-zinc-500">Push Devices</p>
                      <p className="text-zinc-300">{customer.push_subscriptions_count}</p>
                    </div>
                    <div>
                      <p className="text-zinc-500">ID</p>
                      <p className="text-zinc-300 font-mono text-[10px] truncate">{customer.id}</p>
                    </div>
                  </div>
                  {customer.is_blocked && customer.blocked_reason && (
                    <div className="p-2 bg-red-500/10 rounded-lg">
                      <p className="text-red-400 text-xs">
                        Blocked: {customer.blocked_reason}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {barbers.map((barber) => (
            <div
              key={barber.id}
              className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden"
            >
              <button
                onClick={() => toggleExpand(barber.id)}
                className="w-full p-4 flex items-start justify-between text-left"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium text-white truncate">
                      {barber.fullname}
                    </p>
                    <StatusBadge
                      status={barber.role === 'admin' ? 'warning' : 'info'}
                      label={barber.role}
                    />
                    <StatusBadge
                      status={barber.is_active ? 'success' : 'error'}
                      label={barber.is_active ? 'Active' : 'Inactive'}
                    />
                  </div>
                  <p className="text-xs text-zinc-500">{barber.email || barber.phone || '-'}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="flex items-center gap-1 text-[10px] text-zinc-500">
                      <Scissors size={10} />
                      {barber.services.active}/{barber.services.total} services
                    </span>
                    <span className="flex items-center gap-1 text-[10px] text-zinc-500">
                      <Calendar size={10} />
                      {barber.reservations.total} bookings
                    </span>
                  </div>
                </div>
                {expandedId === barber.id ? (
                  <ChevronUp size={18} className="text-zinc-500" />
                ) : (
                  <ChevronDown size={18} className="text-zinc-500" />
                )}
              </button>
              
              {expandedId === barber.id && (
                <div className="px-4 pb-4 border-t border-zinc-800 pt-3 space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-zinc-500">Username</p>
                      <p className="text-zinc-300">{barber.username || '-'}</p>
                    </div>
                    <div>
                      <p className="text-zinc-500">Registered</p>
                      <p className="text-zinc-300">
                        {format(new Date(barber.created_at), 'dd/MM/yyyy')}
                      </p>
                    </div>
                    <div>
                      <p className="text-zinc-500">Confirmed</p>
                      <p className="text-emerald-400">{barber.reservations.confirmed}</p>
                    </div>
                    <div>
                      <p className="text-zinc-500">Cancelled</p>
                      <p className="text-red-400">{barber.reservations.cancelled}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-zinc-500 text-xs mb-2">Work Schedule</p>
                    <div className="flex gap-1 flex-wrap">
                      {barber.work_schedule.map((day) => (
                        <span
                          key={day.day}
                          className={cn(
                            'px-2 py-1 rounded text-[10px] font-medium',
                            day.working
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : 'bg-zinc-800 text-zinc-600'
                          )}
                          title={day.hours}
                        >
                          {day.day.slice(0, 3)}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
