'use client'

import { useState, useEffect, useCallback } from 'react'
import { useDevAuthStore } from '@/store/useDevAuthStore'
import { StatusBadge } from '@/components/dev/StatusBadge'
import { 
  RefreshCw,
  Database,
  Server,
  HardDrive,
  AlertTriangle,
  CheckCircle,
  Info,
  Zap,
  Layers
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'

interface TableInfo {
  name: string
  rows: number
}

interface Recommendation {
  type: 'info' | 'warning' | 'success'
  message: string
}

interface DbHealth {
  health: {
    status: 'healthy' | 'degraded' | 'unhealthy'
    latency: number
    lastChecked: string
  }
  tables: TableInfo[]
  totalRows: number
  recommendations: Recommendation[]
  environment: {
    nodeVersion: string
    platform: string
    env: string
  }
  indexes: {
    note: string
    optimizedIndexes: string[]
  }
}

export default function DevSystemPage() {
  const { devToken } = useDevAuthStore()
  const [dbHealth, setDbHealth] = useState<DbHealth | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/dev/db-health', {
        headers: { 'X-Dev-Token': devToken || '' },
      })
      
      if (response.ok) {
        const data = await response.json()
        setDbHealth(data)
        setLastUpdated(new Date())
      }
    } catch (error) {
      console.error('Failed to fetch DB health:', error)
    } finally {
      setLoading(false)
    }
  }, [devToken])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const getRecommendationIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle size={14} className="text-emerald-400" />
      case 'warning':
        return <AlertTriangle size={14} className="text-amber-400" />
      default:
        return <Info size={14} className="text-blue-400" />
    }
  }

  const getHealthColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-emerald-400'
      case 'degraded':
        return 'text-amber-400'
      default:
        return 'text-red-400'
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">System</h1>
          {lastUpdated && (
            <p className="text-zinc-500 text-xs">
              Updated: {formatDistanceToNow(lastUpdated, { addSuffix: true })}
            </p>
          )}
        </div>
        <button
          onClick={fetchData}
          className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          aria-label="Refresh"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {loading && !dbHealth ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-zinc-900 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : dbHealth && (
        <>
          {/* Database Health */}
          <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
            <div className="flex items-center gap-2 mb-4">
              <Database size={18} className="text-zinc-400" />
              <h2 className="text-sm font-medium text-white">Database Health</h2>
            </div>
            
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center">
                <div className={cn(
                  'text-2xl font-bold',
                  getHealthColor(dbHealth.health.status)
                )}>
                  {dbHealth.health.status === 'healthy' ? (
                    <CheckCircle size={32} className="mx-auto" />
                  ) : dbHealth.health.status === 'degraded' ? (
                    <AlertTriangle size={32} className="mx-auto" />
                  ) : (
                    <AlertTriangle size={32} className="mx-auto" />
                  )}
                </div>
                <p className="text-xs text-zinc-500 mt-1">
                  {dbHealth.health.status.charAt(0).toUpperCase() + dbHealth.health.status.slice(1)}
                </p>
              </div>
              <div className="text-center">
                <p className={cn(
                  'text-2xl font-bold',
                  dbHealth.health.latency < 100 ? 'text-emerald-400' :
                  dbHealth.health.latency < 300 ? 'text-amber-400' : 'text-red-400'
                )}>
                  {dbHealth.health.latency}
                </p>
                <p className="text-xs text-zinc-500">Latency (ms)</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-white">
                  {dbHealth.totalRows.toLocaleString()}
                </p>
                <p className="text-xs text-zinc-500">Total Rows</p>
              </div>
            </div>
          </div>

          {/* Tables */}
          <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
            <div className="flex items-center gap-2 mb-4">
              <Layers size={18} className="text-zinc-400" />
              <h2 className="text-sm font-medium text-white">Tables</h2>
              <span className="text-xs text-zinc-500">({dbHealth.tables.length})</span>
            </div>
            
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {dbHealth.tables.map((table) => (
                <div
                  key={table.name}
                  className="flex items-center justify-between p-2 bg-zinc-800/50 rounded-lg"
                >
                  <span className="text-sm text-zinc-300 font-mono">{table.name}</span>
                  <span className="text-sm text-zinc-400 tabular-nums">
                    {table.rows.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Advisor Recommendations */}
          <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
            <div className="flex items-center gap-2 mb-4">
              <Zap size={18} className="text-zinc-400" />
              <h2 className="text-sm font-medium text-white">Advisor</h2>
            </div>
            
            {dbHealth.recommendations.length === 0 ? (
              <p className="text-zinc-500 text-sm">No recommendations at this time.</p>
            ) : (
              <div className="space-y-2">
                {dbHealth.recommendations.map((rec, i) => (
                  <div
                    key={i}
                    className={cn(
                      'flex items-start gap-2 p-3 rounded-lg',
                      rec.type === 'success' && 'bg-emerald-500/10',
                      rec.type === 'warning' && 'bg-amber-500/10',
                      rec.type === 'info' && 'bg-blue-500/10'
                    )}
                  >
                    {getRecommendationIcon(rec.type)}
                    <p className="text-xs text-zinc-300">{rec.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Optimized Indexes */}
          <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
            <div className="flex items-center gap-2 mb-4">
              <HardDrive size={18} className="text-zinc-400" />
              <h2 className="text-sm font-medium text-white">Optimized Indexes</h2>
            </div>
            
            <div className="space-y-2">
              {dbHealth.indexes.optimizedIndexes.map((idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 p-2 bg-emerald-500/10 rounded-lg"
                >
                  <CheckCircle size={12} className="text-emerald-400" />
                  <span className="text-xs text-emerald-300 font-mono">{idx}</span>
                </div>
              ))}
            </div>
            <p className="text-zinc-600 text-[10px] mt-3">{dbHealth.indexes.note}</p>
          </div>

          {/* Environment */}
          <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
            <div className="flex items-center gap-2 mb-4">
              <Server size={18} className="text-zinc-400" />
              <h2 className="text-sm font-medium text-white">Environment</h2>
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-zinc-500 text-xs">Node</p>
                <p className="text-zinc-300 text-sm font-mono">{dbHealth.environment.nodeVersion}</p>
              </div>
              <div>
                <p className="text-zinc-500 text-xs">Platform</p>
                <p className="text-zinc-300 text-sm">{dbHealth.environment.platform}</p>
              </div>
              <div>
                <p className="text-zinc-500 text-xs">Mode</p>
                <StatusBadge
                  status={dbHealth.environment.env === 'production' ? 'warning' : 'info'}
                  label={dbHealth.environment.env}
                />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
