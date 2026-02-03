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
  Layers,
  MessageSquare,
  CreditCard,
  Globe,
  Vibrate,
  Smartphone
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { 
  triggerHaptic, 
  hapticSuccess, 
  hapticWarning, 
  hapticError, 
  isHapticSupported,
  type HapticFeedbackType 
} from '@/lib/haptics'
import { useHaptics } from '@/hooks/useHaptics'

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

interface SmsBalance {
  success: boolean
  balance?: number
  internationalBalance?: number
  message?: string
  lastChecked?: string
  error?: string
}

export default function DevSystemPage() {
  const { devToken } = useDevAuthStore()
  const [dbHealth, setDbHealth] = useState<DbHealth | null>(null)
  const [smsBalance, setSmsBalance] = useState<SmsBalance | null>(null)
  const [loading, setLoading] = useState(true)
  const [smsLoading, setSmsLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchDbHealth = useCallback(async () => {
    try {
      const response = await fetch('/api/dev/db-health', {
        headers: { 'X-Dev-Token': devToken || '' },
      })
      
      if (response.ok) {
        const data = await response.json()
        setDbHealth(data)
      }
    } catch (error) {
      console.error('Failed to fetch DB health:', error)
    }
  }, [devToken])

  const fetchSmsBalance = useCallback(async () => {
    setSmsLoading(true)
    try {
      const response = await fetch('/api/sms/balance', {
        headers: { 'X-Dev-Token': devToken || '' },
      })
      
      const data = await response.json()
      setSmsBalance(data)
    } catch (error) {
      console.error('Failed to fetch SMS balance:', error)
      setSmsBalance({ success: false, error: 'Failed to fetch' })
    } finally {
      setSmsLoading(false)
    }
  }, [devToken])

  const fetchData = useCallback(async () => {
    setLoading(true)
    await Promise.all([fetchDbHealth(), fetchSmsBalance()])
    setLastUpdated(new Date())
    setLoading(false)
  }, [fetchDbHealth, fetchSmsBalance])

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
          className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors flex items-center justify-center"
          aria-label="Refresh"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Haptics Testing Section */}
      <HapticsTestingSection />

      {loading && !dbHealth ? (
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-zinc-900 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* SMS Provider Balance */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-900/30 to-zinc-900 border border-emerald-500/20">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                  <MessageSquare size={16} className="text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-sm font-medium text-white">019 SMS Provider</h2>
                  <p className="text-[10px] text-zinc-500">OTP Authentication Service</p>
                </div>
              </div>
              <button
                onClick={fetchSmsBalance}
                disabled={smsLoading}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                aria-label="Refresh SMS Balance"
              >
                <RefreshCw size={14} className={smsLoading ? 'animate-spin' : ''} />
              </button>
            </div>
            
            {smsLoading && !smsBalance ? (
              <div className="h-20 bg-zinc-800/50 rounded-lg animate-pulse" />
            ) : smsBalance?.success ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-zinc-800/50 rounded-xl">
                  <div className="flex items-center gap-2 mb-1">
                    <CreditCard size={14} className="text-emerald-400" />
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider">SMS Credits</span>
                  </div>
                  <p className={cn(
                    'text-2xl font-bold tabular-nums',
                    (smsBalance.balance ?? 0) > 100 ? 'text-emerald-400' :
                    (smsBalance.balance ?? 0) > 20 ? 'text-amber-400' : 'text-red-400'
                  )}>
                    {smsBalance.balance?.toLocaleString() ?? 'N/A'}
                  </p>
                  {(smsBalance.balance ?? 0) < 50 && (
                    <p className="text-[10px] text-amber-400 mt-1 flex items-center gap-1">
                      <AlertTriangle size={10} />
                      Low balance - consider recharging
                    </p>
                  )}
                </div>
                <div className="p-3 bg-zinc-800/50 rounded-xl">
                  <div className="flex items-center gap-2 mb-1">
                    <Globe size={14} className="text-blue-400" />
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider">International</span>
                  </div>
                  <p className="text-2xl font-bold text-zinc-300 tabular-nums">
                    ₪{smsBalance.internationalBalance?.toFixed(2) ?? 'N/A'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-red-500/10 rounded-lg border border-red-500/20">
                <p className="text-sm text-red-400 flex items-center gap-2">
                  <AlertTriangle size={14} />
                  {smsBalance?.error || 'Failed to load SMS balance'}
                </p>
              </div>
            )}
            
            {smsBalance?.lastChecked && (
              <p className="text-[10px] text-zinc-600 mt-3 text-right">
                Last checked: {formatDistanceToNow(new Date(smsBalance.lastChecked), { addSuffix: true })}
              </p>
            )}
          </div>

          {/* Database Health */}
          {dbHealth && (
          <>
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
        </>
      )}
    </div>
  )
}

/**
 * Haptics Testing Section Component
 * Tests both lib/haptics.ts (iOS switch workaround) and hooks/useHaptics.ts (Vibration API)
 */
function HapticsTestingSection() {
  const [lastTriggered, setLastTriggered] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<{ method: string; success: boolean; timestamp: Date }[]>([])
  
  // Use the hook-based haptics
  const hookHaptics = useHaptics()
  
  // Check support status
  const isLibSupported = typeof window !== 'undefined' && isHapticSupported()
  const isHookSupported = hookHaptics.isSupported
  
  // Device info
  const [deviceInfo, setDeviceInfo] = useState({
    isIOS: false,
    isPWA: false,
    hasVibrate: false,
    userAgent: ''
  })
  
  useEffect(() => {
    if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
      const isPWA = window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as Navigator & { standalone?: boolean }).standalone === true
      const hasVibrate = 'vibrate' in navigator
      
      setDeviceInfo({
        isIOS,
        isPWA,
        hasVibrate,
        userAgent: navigator.userAgent.substring(0, 50) + '...'
      })
    }
  }, [])
  
  const handleLibHaptic = (type: HapticFeedbackType, name: string) => {
    const result = triggerHaptic(type)
    setLastTriggered(`lib/${name}`)
    setTestResults(prev => [{
      method: `lib/${name}`,
      success: result,
      timestamp: new Date()
    }, ...prev.slice(0, 9)])
  }
  
  const handleHookHaptic = (fn: () => void, name: string) => {
    fn()
    setLastTriggered(`hook/${name}`)
    setTestResults(prev => [{
      method: `hook/${name}`,
      success: true, // Hook doesn't return boolean
      timestamp: new Date()
    }, ...prev.slice(0, 9)])
  }
  
  const handleCustomVibrate = (pattern: number | number[], name: string) => {
    hookHaptics.custom(pattern)
    setLastTriggered(`custom/${name}`)
    setTestResults(prev => [{
      method: `custom/${name}`,
      success: true,
      timestamp: new Date()
    }, ...prev.slice(0, 9)])
  }

  return (
    <div className="p-4 rounded-xl bg-gradient-to-br from-violet-900/30 to-zinc-900 border border-violet-500/20">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center">
            <Vibrate size={16} className="text-violet-400" />
          </div>
          <div>
            <h2 className="text-sm font-medium text-white">Haptic Feedback Testing</h2>
            <p className="text-[10px] text-zinc-500">iOS 26 Switch Workaround + Vibration API</p>
          </div>
        </div>
        {lastTriggered && (
          <span className="text-xs text-violet-400 bg-violet-500/10 px-2 py-1 rounded-full">
            Last: {lastTriggered}
          </span>
        )}
      </div>
      
      {/* Device Info */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="p-2 bg-zinc-800/50 rounded-lg">
          <div className="flex items-center gap-2">
            <Smartphone size={12} className="text-zinc-400" />
            <span className="text-[10px] text-zinc-500">Device</span>
          </div>
          <div className="flex flex-wrap gap-1 mt-1">
            <StatusBadge 
              status={deviceInfo.isIOS ? 'success' : 'info'} 
              label={deviceInfo.isIOS ? 'iOS' : 'Other'} 
              dot={false}
            />
            <StatusBadge 
              status={deviceInfo.isPWA ? 'success' : 'warning'} 
              label={deviceInfo.isPWA ? 'PWA' : 'Browser'} 
              dot={false}
            />
            <StatusBadge 
              status={deviceInfo.hasVibrate ? 'success' : 'error'} 
              label={deviceInfo.hasVibrate ? 'Vibrate API' : 'No Vibrate'} 
              dot={false}
            />
          </div>
        </div>
        <div className="p-2 bg-zinc-800/50 rounded-lg">
          <div className="flex items-center gap-2">
            <Zap size={12} className="text-zinc-400" />
            <span className="text-[10px] text-zinc-500">Support</span>
          </div>
          <div className="flex flex-wrap gap-1 mt-1">
            <StatusBadge 
              status={isLibSupported ? 'success' : 'error'} 
              label={isLibSupported ? 'lib/haptics ✓' : 'lib/haptics ✗'} 
              dot={false}
            />
            <StatusBadge 
              status={isHookSupported ? 'success' : 'warning'} 
              label={isHookSupported ? 'useHaptics ✓' : 'useHaptics ✗'} 
              dot={false}
            />
          </div>
        </div>
      </div>
      
      {/* lib/haptics.ts Tests */}
      <div className="mb-4">
        <h3 className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">lib/haptics.ts (iOS Switch)</h3>
        <div className="grid grid-cols-4 gap-2">
          <button
            onClick={() => handleLibHaptic('light', 'light')}
            className="p-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-center transition-colors active:scale-95"
          >
            <span className="text-xs text-white block">Light</span>
            <span className="text-[10px] text-zinc-500">10ms</span>
          </button>
          <button
            onClick={() => handleLibHaptic('medium', 'medium')}
            className="p-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-center transition-colors active:scale-95"
          >
            <span className="text-xs text-white block">Medium</span>
            <span className="text-[10px] text-zinc-500">20ms</span>
          </button>
          <button
            onClick={() => handleLibHaptic('heavy', 'heavy')}
            className="p-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-center transition-colors active:scale-95"
          >
            <span className="text-xs text-white block">Heavy</span>
            <span className="text-[10px] text-zinc-500">40ms</span>
          </button>
          <button
            onClick={() => handleLibHaptic('selection', 'selection')}
            className="p-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-center transition-colors active:scale-95"
          >
            <span className="text-xs text-white block">Select</span>
            <span className="text-[10px] text-zinc-500">5ms</span>
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-2">
          <button
            onClick={() => { hapticSuccess(); handleLibHaptic('success', 'success') }}
            className="p-3 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 rounded-lg text-center transition-colors active:scale-95"
          >
            <span className="text-xs text-emerald-400 block">Success</span>
            <span className="text-[10px] text-emerald-500/70">[10,50,10]</span>
          </button>
          <button
            onClick={() => { hapticWarning(); handleLibHaptic('warning', 'warning') }}
            className="p-3 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 rounded-lg text-center transition-colors active:scale-95"
          >
            <span className="text-xs text-amber-400 block">Warning</span>
            <span className="text-[10px] text-amber-500/70">[20,50,20]</span>
          </button>
          <button
            onClick={() => { hapticError(); handleLibHaptic('error', 'error') }}
            className="p-3 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-lg text-center transition-colors active:scale-95"
          >
            <span className="text-xs text-red-400 block">Error</span>
            <span className="text-[10px] text-red-500/70">[30,50,30,50,30]</span>
          </button>
        </div>
      </div>
      
      {/* hooks/useHaptics.ts Tests */}
      <div className="mb-4">
        <h3 className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">hooks/useHaptics.ts (Vibration API)</h3>
        <div className="grid grid-cols-4 gap-2">
          <button
            onClick={() => handleHookHaptic(hookHaptics.light, 'light')}
            className="p-3 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-lg text-center transition-colors active:scale-95"
          >
            <span className="text-xs text-blue-400 block">Light</span>
          </button>
          <button
            onClick={() => handleHookHaptic(hookHaptics.medium, 'medium')}
            className="p-3 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-lg text-center transition-colors active:scale-95"
          >
            <span className="text-xs text-blue-400 block">Medium</span>
          </button>
          <button
            onClick={() => handleHookHaptic(hookHaptics.heavy, 'heavy')}
            className="p-3 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-lg text-center transition-colors active:scale-95"
          >
            <span className="text-xs text-blue-400 block">Heavy</span>
          </button>
          <button
            onClick={() => handleHookHaptic(hookHaptics.impact, 'impact')}
            className="p-3 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-lg text-center transition-colors active:scale-95"
          >
            <span className="text-xs text-blue-400 block">Impact</span>
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-2">
          <button
            onClick={() => handleHookHaptic(hookHaptics.success, 'success')}
            className="p-3 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-lg text-center transition-colors active:scale-95"
          >
            <span className="text-xs text-blue-400 block">Success</span>
          </button>
          <button
            onClick={() => handleHookHaptic(hookHaptics.warning, 'warning')}
            className="p-3 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-lg text-center transition-colors active:scale-95"
          >
            <span className="text-xs text-blue-400 block">Warning</span>
          </button>
          <button
            onClick={() => handleHookHaptic(hookHaptics.error, 'error')}
            className="p-3 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-lg text-center transition-colors active:scale-95"
          >
            <span className="text-xs text-blue-400 block">Error</span>
          </button>
        </div>
      </div>
      
      {/* Custom Patterns */}
      <div className="mb-4">
        <h3 className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">Custom Patterns</h3>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => handleCustomVibrate([50, 100, 50, 100, 50], 'SOS')}
            className="p-3 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/20 rounded-lg text-center transition-colors active:scale-95"
          >
            <span className="text-xs text-orange-400 block">SOS</span>
            <span className="text-[10px] text-orange-500/70">[50,100,50,100,50]</span>
          </button>
          <button
            onClick={() => handleCustomVibrate([100, 30, 100, 30, 100], 'Triple')}
            className="p-3 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/20 rounded-lg text-center transition-colors active:scale-95"
          >
            <span className="text-xs text-orange-400 block">Triple</span>
            <span className="text-[10px] text-orange-500/70">[100,30,100,30,100]</span>
          </button>
          <button
            onClick={() => handleCustomVibrate(200, 'Long')}
            className="p-3 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/20 rounded-lg text-center transition-colors active:scale-95"
          >
            <span className="text-xs text-orange-400 block">Long</span>
            <span className="text-[10px] text-orange-500/70">200ms</span>
          </button>
        </div>
      </div>
      
      {/* Test Results Log */}
      {testResults.length > 0 && (
        <div>
          <h3 className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">Test Log</h3>
          <div className="max-h-32 overflow-y-auto space-y-1">
            {testResults.map((result, i) => (
              <div 
                key={i} 
                className="flex items-center justify-between text-[10px] p-1.5 bg-zinc-800/30 rounded"
              >
                <span className="text-zinc-400 font-mono">{result.method}</span>
                <div className="flex items-center gap-2">
                  {result.success ? (
                    <CheckCircle size={10} className="text-emerald-400" />
                  ) : (
                    <AlertTriangle size={10} className="text-amber-400" />
                  )}
                  <span className="text-zinc-600">
                    {result.timestamp.toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Instructions */}
      <div className="mt-4 p-3 bg-zinc-800/30 rounded-lg">
        <p className="text-[10px] text-zinc-500">
          <strong className="text-zinc-400">iOS:</strong> Uses hidden switch element workaround (lib/haptics.ts) - should vibrate on tap.
          <br />
          <strong className="text-zinc-400">Android:</strong> Uses Vibration API (hooks/useHaptics.ts) - test on device.
          <br />
          <strong className="text-zinc-400">Note:</strong> iOS Safari doesn&apos;t support Vibration API, use lib/haptics.ts for iOS.
        </p>
      </div>
    </div>
  )
}
