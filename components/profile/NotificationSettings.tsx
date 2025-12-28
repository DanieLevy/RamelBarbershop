'use client'

import { useState } from 'react'
import { usePushNotifications, getDeviceIcon } from '@/hooks/usePushNotifications'
import { usePWA } from '@/hooks/usePWA'
import { GlassCard } from '@/components/ui/GlassCard'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  Bell,
  BellOff,
  Smartphone,
  Monitor,
  Trash2,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Info,
  RefreshCw,
  Download
} from 'lucide-react'

interface NotificationSettingsProps {
  className?: string
}

export function NotificationSettings({ className }: NotificationSettingsProps) {
  const pwa = usePWA()
  const push = usePushNotifications()
  const [isEnabling, setIsEnabling] = useState(false)
  const [removingDeviceId, setRemovingDeviceId] = useState<string | null>(null)

  // Handle enable notifications
  const handleEnableNotifications = async () => {
    setIsEnabling(true)

    const success = await push.subscribe()

    if (success) {
      toast.success('התראות הופעלו בהצלחה!')
    } else if (push.error) {
      toast.error(push.error)
    }

    setIsEnabling(false)
  }

  // Handle disable notifications
  const handleDisableNotifications = async () => {
    const success = await push.unsubscribe()

    if (success) {
      toast.success('התראות בוטלו')
    } else if (push.error) {
      toast.error(push.error)
    }
  }

  // Handle remove device
  const handleRemoveDevice = async (deviceId: string) => {
    setRemovingDeviceId(deviceId)

    const success = await push.removeDevice(deviceId)

    if (success) {
      toast.success('המכשיר הוסר בהצלחה')
    } else if (push.error) {
      toast.error(push.error)
    }

    setRemovingDeviceId(null)
  }

  // Get device icon component
  const DeviceIcon = ({ type }: { type: string }) => {
    const iconName = getDeviceIcon(type as 'ios' | 'android' | 'desktop')
    if (iconName === 'Monitor') return <Monitor size={16} strokeWidth={1.5} />
    return <Smartphone size={16} strokeWidth={1.5} />
  }

  // Format last used date
  const formatLastUsed = (dateString: string): string => {
    try {
      const date = new Date(dateString)
      const now = new Date()
      const diffMs = now.getTime() - date.getTime()
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

      if (diffDays === 0) return 'היום'
      if (diffDays === 1) return 'אתמול'
      if (diffDays < 7) return `לפני ${diffDays} ימים`
      
      return date.toLocaleDateString('he-IL', {
        day: 'numeric',
        month: 'short'
      })
    } catch {
      return 'לא ידוע'
    }
  }

  // Get permission status display
  const getPermissionStatus = () => {
    if (!push.isSupported) {
      return { color: 'text-red-400', text: 'לא נתמך', icon: AlertTriangle }
    }
    
    switch (push.permission) {
      case 'granted':
        return { color: 'text-green-400', text: 'מאושר', icon: CheckCircle }
      case 'denied':
        return { color: 'text-red-400', text: 'נדחה', icon: AlertTriangle }
      case 'default':
        return { color: 'text-amber-400', text: 'לא נבקש', icon: Info }
      default:
        return { color: 'text-foreground-muted', text: 'לא זמין', icon: Info }
    }
  }

  const permissionStatus = getPermissionStatus()
  const PermissionIcon = permissionStatus.icon

  return (
    <div className={cn('space-y-4', className)}>
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-foreground-light flex items-center gap-2">
          <Bell size={20} strokeWidth={1.5} className="text-accent-gold" />
          הגדרות התראות
        </h2>
        <button
          onClick={() => push.refreshStatus()}
          disabled={push.isLoading}
          className="p-2 text-foreground-muted hover:text-foreground-light transition-colors rounded-lg hover:bg-white/5"
          aria-label="רענן סטטוס"
        >
          <RefreshCw size={16} className={cn(push.isLoading && 'animate-spin')} />
        </button>
      </div>

      {/* Status Card */}
      <GlassCard padding="md" className="space-y-4">
        {/* PWA Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
              <Download size={14} className="text-foreground-muted" />
            </div>
            <div>
              <p className="text-sm text-foreground-light">אפליקציה מותקנת</p>
              <p className="text-xs text-foreground-muted">נדרש להתראות באייפון</p>
            </div>
          </div>
          <span className={cn(
            'text-xs font-medium px-2 py-1 rounded-full',
            pwa.isStandalone || pwa.isInstalled
              ? 'bg-green-500/20 text-green-400'
              : 'bg-amber-500/20 text-amber-400'
          )}>
            {pwa.isStandalone || pwa.isInstalled ? 'כן' : 'לא'}
          </span>
        </div>

        {/* Permission Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
              <PermissionIcon size={14} className={permissionStatus.color} />
            </div>
            <div>
              <p className="text-sm text-foreground-light">הרשאת התראות</p>
              <p className="text-xs text-foreground-muted">הרשאה מהמכשיר</p>
            </div>
          </div>
          <span className={cn(
            'text-xs font-medium px-2 py-1 rounded-full',
            push.permission === 'granted' ? 'bg-green-500/20' : 'bg-white/10',
            permissionStatus.color
          )}>
            {permissionStatus.text}
          </span>
        </div>

        {/* Subscription Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
              {push.isSubscribed ? (
                <Bell size={14} className="text-accent-gold" />
              ) : (
                <BellOff size={14} className="text-foreground-muted" />
              )}
            </div>
            <div>
              <p className="text-sm text-foreground-light">התראות פעילות</p>
              <p className="text-xs text-foreground-muted">
                {push.devices.length} מכשירים מחוברים
              </p>
            </div>
          </div>
          <span className={cn(
            'text-xs font-medium px-2 py-1 rounded-full',
            push.isSubscribed
              ? 'bg-green-500/20 text-green-400'
              : 'bg-white/10 text-foreground-muted'
          )}>
            {push.isSubscribed ? 'פעיל' : 'כבוי'}
          </span>
        </div>
      </GlassCard>

      {/* iOS Warning */}
      {push.isIOS && !pwa.isStandalone && (
        <GlassCard padding="sm" className="border-amber-500/30 bg-amber-500/5">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="text-amber-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm text-amber-400 font-medium">
                נדרשת התקנת האפליקציה
              </p>
              <p className="text-xs text-amber-400/80 mt-1">
                באייפון, יש להתקין את האפליקציה למסך הבית כדי לקבל התראות.
                לחצו על כפתור השיתוף ובחרו &quot;הוסף למסך הבית&quot;.
              </p>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Enable/Disable Button */}
      <GlassCard padding="md">
        {!push.isSupported ? (
          <div className="text-center py-4">
            <AlertTriangle size={24} className="text-red-400 mx-auto mb-2" />
            <p className="text-foreground-muted text-sm">
              הדפדפן/מכשיר שלך אינו תומך בהתראות
            </p>
          </div>
        ) : !push.isSubscribed ? (
          <button
            onClick={handleEnableNotifications}
            disabled={isEnabling || (push.isIOS && !pwa.isStandalone)}
            className={cn(
              'w-full flex items-center justify-center gap-2 py-3 rounded-xl font-medium transition-all',
              isEnabling || (push.isIOS && !pwa.isStandalone)
                ? 'bg-foreground-muted/20 text-foreground-muted cursor-not-allowed'
                : 'bg-accent-gold text-background-dark hover:bg-accent-gold/90'
            )}
          >
            {isEnabling ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>מפעיל התראות...</span>
              </>
            ) : (
              <>
                <Bell size={18} />
                <span>הפעל התראות</span>
              </>
            )}
          </button>
        ) : (
          <button
            onClick={handleDisableNotifications}
            disabled={push.isLoading}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-medium bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 transition-all"
          >
            <BellOff size={18} />
            <span>בטל התראות</span>
          </button>
        )}
      </GlassCard>

      {/* Connected Devices */}
      {push.devices.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-foreground-muted">
            מכשירים מחוברים ({push.devices.length})
          </h3>

          {push.devices.map((device) => (
            <GlassCard key={device.id} padding="sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center flex-shrink-0">
                    <DeviceIcon type={device.deviceType} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-foreground-light truncate">
                      {device.deviceName || 'מכשיר לא מזוהה'}
                    </p>
                    <p className="text-xs text-foreground-muted">
                      פעיל לאחרונה: {formatLastUsed(device.lastUsed)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleRemoveDevice(device.id)}
                  disabled={removingDeviceId === device.id}
                  className="p-2 text-red-400/60 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors flex-shrink-0"
                  aria-label="הסר מכשיר"
                >
                  {removingDeviceId === device.id ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Trash2 size={16} />
                  )}
                </button>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      {/* Error Display */}
      {push.error && (
        <GlassCard padding="sm" className="border-red-500/30 bg-red-500/5">
          <div className="flex items-center gap-2 text-red-400">
            <AlertTriangle size={16} />
            <p className="text-sm">{push.error}</p>
          </div>
        </GlassCard>
      )}
    </div>
  )
}

