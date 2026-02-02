'use client'

import { useState, useEffect, useCallback } from 'react'
import { useDevAuthStore } from '@/store/useDevAuthStore'
import { StatusBadge } from '@/components/dev/StatusBadge'
import { 
  RefreshCw,
  Smartphone,
  Monitor,
  Tablet,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Send
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDistanceToNow, format } from 'date-fns'

type Tab = 'subscriptions' | 'logs'

interface Subscription {
  id: string
  customer_id: string | null
  barber_id: string | null
  owner_name: string
  owner_type: 'customer' | 'barber' | 'unknown'
  owner_contact: string
  device_type: 'ios' | 'android' | 'desktop'
  device_name: string | null
  is_active: boolean
  consecutive_failures: number
  last_delivery_status: 'success' | 'failed' | 'pending' | 'user_deleted' | null
  last_used: string | null
  created_at: string
}

interface NotificationLog {
  id: string
  notification_type: string
  recipient_type: 'customer' | 'barber'
  recipient_id: string
  recipient_name: string
  title: string
  body: string
  status: 'pending' | 'sent' | 'partial' | 'failed'
  devices_targeted: number
  devices_succeeded: number
  devices_failed: number
  error_message: string | null
  created_at: string
}

interface SubStats {
  total: number
  active: number
  inactive: number
  customers: number
  barbers: number
  byDevice: { ios: number; android: number; desktop: number }
  withFailures: number
}

interface LogStats {
  total: number
  byType: Record<string, number>
  byStatus: Record<string, number>
  successRate: number
}

export default function DevNotificationsPage() {
  const { devToken } = useDevAuthStore()
  const [tab, setTab] = useState<Tab>('subscriptions')
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [logs, setLogs] = useState<NotificationLog[]>([])
  const [subStats, setSubStats] = useState<SubStats | null>(null)
  const [logStats, setLogStats] = useState<LogStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const fetchSubscriptions = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/dev/subscriptions', {
        headers: { 'X-Dev-Token': devToken || '' },
      })
      
      if (response.ok) {
        const data = await response.json()
        setSubscriptions(data.subscriptions)
        setSubStats(data.stats)
      }
    } catch (error) {
      console.error('Failed to fetch subscriptions:', error)
    } finally {
      setLoading(false)
    }
  }, [devToken])

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/dev/notifications', {
        headers: { 'X-Dev-Token': devToken || '' },
      })
      
      if (response.ok) {
        const data = await response.json()
        setLogs(data.logs)
        setLogStats(data.stats)
      }
    } catch (error) {
      console.error('Failed to fetch logs:', error)
    } finally {
      setLoading(false)
    }
  }, [devToken])

  useEffect(() => {
    if (tab === 'subscriptions') {
      fetchSubscriptions()
    } else {
      fetchLogs()
    }
  }, [tab, fetchSubscriptions, fetchLogs])

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id)
  }

  const getDeviceIcon = (type: string) => {
    switch (type) {
      case 'ios':
      case 'android':
        return <Smartphone size={14} />
      case 'desktop':
        return <Monitor size={14} />
      default:
        return <Tablet size={14} />
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
      case 'success':
        return <CheckCircle size={12} className="text-emerald-400" />
      case 'failed':
        return <XCircle size={12} className="text-red-400" />
      case 'pending':
        return <Clock size={12} className="text-amber-400" />
      default:
        return <AlertTriangle size={12} className="text-zinc-400" />
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Notifications</h1>
        <button
          onClick={() => tab === 'subscriptions' ? fetchSubscriptions() : fetchLogs()}
          className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors flex items-center justify-center"
          aria-label="Refresh"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-zinc-900 rounded-xl">
        <button
          onClick={() => setTab('subscriptions')}
          className={cn(
            'flex-1 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2',
            tab === 'subscriptions'
              ? 'bg-emerald-600 text-white'
              : 'text-zinc-400 hover:text-white'
          )}
        >
          <Smartphone size={16} />
          Subscriptions
        </button>
        <button
          onClick={() => setTab('logs')}
          className={cn(
            'flex-1 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2',
            tab === 'logs'
              ? 'bg-emerald-600 text-white'
              : 'text-zinc-400 hover:text-white'
          )}
        >
          <Send size={16} />
          Logs
        </button>
      </div>

      {/* Stats */}
      {tab === 'subscriptions' && subStats && (
        <div className="grid grid-cols-4 gap-2">
          <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-center">
            <p className="text-lg font-bold text-white">{subStats.active}</p>
            <p className="text-[9px] text-emerald-400">Active</p>
          </div>
          <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-center">
            <p className="text-lg font-bold text-white">{subStats.byDevice.ios}</p>
            <p className="text-[9px] text-zinc-500">iOS</p>
          </div>
          <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-center">
            <p className="text-lg font-bold text-white">{subStats.byDevice.android}</p>
            <p className="text-[9px] text-zinc-500">Android</p>
          </div>
          <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-center">
            <p className={cn(
              'text-lg font-bold',
              subStats.withFailures > 0 ? 'text-amber-400' : 'text-white'
            )}>{subStats.withFailures}</p>
            <p className="text-[9px] text-amber-400/70">Failures</p>
          </div>
        </div>
      )}

      {tab === 'logs' && logStats && (
        <div className="grid grid-cols-3 gap-2">
          <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-center">
            <p className="text-lg font-bold text-white">{logStats.total}</p>
            <p className="text-[9px] text-zinc-500">Total</p>
          </div>
          <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-center">
            <p className="text-lg font-bold text-emerald-400">{logStats.successRate}%</p>
            <p className="text-[9px] text-emerald-400/70">Success</p>
          </div>
          <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-center">
            <p className="text-lg font-bold text-red-400">{logStats.byStatus.failed || 0}</p>
            <p className="text-[9px] text-red-400/70">Failed</p>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-20 bg-zinc-900 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : tab === 'subscriptions' ? (
        <div className="space-y-2">
          {subscriptions.map((sub) => (
            <div
              key={sub.id}
              className={cn(
                'bg-zinc-900 border rounded-xl overflow-hidden',
                sub.consecutive_failures > 0 ? 'border-amber-500/20' : 'border-zinc-800'
              )}
            >
              <button
                onClick={() => toggleExpand(sub.id)}
                className="w-full p-4 flex items-start justify-between text-left"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn(
                      'p-1 rounded',
                      sub.device_type === 'ios' && 'bg-blue-500/10 text-blue-400',
                      sub.device_type === 'android' && 'bg-emerald-500/10 text-emerald-400',
                      sub.device_type === 'desktop' && 'bg-zinc-700 text-zinc-300'
                    )}>
                      {getDeviceIcon(sub.device_type)}
                    </span>
                    <p className="text-sm font-medium text-white truncate">
                      {sub.owner_name}
                    </p>
                    <StatusBadge
                      status={sub.is_active ? 'success' : 'error'}
                      label={sub.is_active ? 'Active' : 'Inactive'}
                    />
                  </div>
                  <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <span>{sub.owner_type}</span>
                    {sub.consecutive_failures > 0 && (
                      <span className="flex items-center gap-1 text-amber-400">
                        <AlertTriangle size={10} />
                        {sub.consecutive_failures} failures
                      </span>
                    )}
                  </div>
                </div>
                {expandedId === sub.id ? (
                  <ChevronUp size={18} className="text-zinc-500" />
                ) : (
                  <ChevronDown size={18} className="text-zinc-500" />
                )}
              </button>
              
              {expandedId === sub.id && (
                <div className="px-4 pb-4 border-t border-zinc-800 pt-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-zinc-500">Device</p>
                      <p className="text-zinc-300">{sub.device_name || sub.device_type}</p>
                    </div>
                    <div>
                      <p className="text-zinc-500">Last Status</p>
                      <p className="text-zinc-300 flex items-center gap-1">
                        {getStatusIcon(sub.last_delivery_status || 'unknown')}
                        {sub.last_delivery_status || 'Never'}
                      </p>
                    </div>
                    <div>
                      <p className="text-zinc-500">Last Used</p>
                      <p className="text-zinc-300">
                        {sub.last_used
                          ? formatDistanceToNow(new Date(sub.last_used), { addSuffix: true })
                          : 'Never'
                        }
                      </p>
                    </div>
                    <div>
                      <p className="text-zinc-500">Created</p>
                      <p className="text-zinc-300">
                        {format(new Date(sub.created_at), 'dd/MM/yyyy')}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => (
            <div
              key={log.id}
              className={cn(
                'bg-zinc-900 border rounded-xl overflow-hidden',
                log.status === 'failed' ? 'border-red-500/20' : 'border-zinc-800'
              )}
            >
              <button
                onClick={() => toggleExpand(log.id)}
                className="w-full p-4 flex items-start justify-between text-left"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {getStatusIcon(log.status)}
                    <p className="text-sm font-medium text-white truncate">
                      {log.title}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <StatusBadge
                      status="info"
                      label={log.notification_type.replace('_', ' ')}
                      dot={false}
                    />
                    <span>{log.recipient_name}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-400">
                    {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                  </span>
                  {expandedId === log.id ? (
                    <ChevronUp size={18} className="text-zinc-500" />
                  ) : (
                    <ChevronDown size={18} className="text-zinc-500" />
                  )}
                </div>
              </button>
              
              {expandedId === log.id && (
                <div className="px-4 pb-4 border-t border-zinc-800 pt-3 space-y-2">
                  <div className="p-2 bg-zinc-800 rounded-lg">
                    <p className="text-zinc-300 text-xs">{log.body}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <p className="text-zinc-500">Targeted</p>
                      <p className="text-zinc-300">{log.devices_targeted}</p>
                    </div>
                    <div>
                      <p className="text-zinc-500">Succeeded</p>
                      <p className="text-emerald-400">{log.devices_succeeded}</p>
                    </div>
                    <div>
                      <p className="text-zinc-500">Failed</p>
                      <p className="text-red-400">{log.devices_failed}</p>
                    </div>
                  </div>
                  {log.error_message && (
                    <div className="p-2 bg-red-500/10 rounded-lg">
                      <p className="text-red-400 text-xs">{log.error_message}</p>
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
