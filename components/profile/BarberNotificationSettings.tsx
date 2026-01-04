'use client'

import { useState, useEffect, useCallback } from 'react'
import { useBarberAuthStore } from '@/store/useBarberAuthStore'
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
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  X,
  HelpCircle
} from 'lucide-react'

interface BarberNotificationSettingsProps {
  className?: string
}

export function BarberNotificationSettings({ className }: BarberNotificationSettingsProps) {
  const { barber } = useBarberAuthStore()
  const pwa = usePWA()
  const push = usePushNotifications()
  const [isEnabling, setIsEnabling] = useState(false)
  const [showDevices, setShowDevices] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [deviceToRemove, setDeviceToRemove] = useState<{ id: string; name: string } | null>(null)
  const [removingDeviceId, setRemovingDeviceId] = useState<string | null>(null)

  // Refresh status on mount
  useEffect(() => {
    if (barber?.id) {
      push.refreshStatus()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barber?.id])

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

  const handleDisableNotifications = async () => {
    const success = await push.unsubscribe()
    if (success) {
      toast.success('התראות בוטלו')
    } else if (push.error) {
      toast.error(push.error)
    }
  }

  const confirmRemoveDevice = async () => {
    if (!deviceToRemove) return
    setRemovingDeviceId(deviceToRemove.id)
    const success = await push.removeDevice(deviceToRemove.id)
    if (success) {
      toast.success('המכשיר הוסר בהצלחה')
    } else if (push.error) {
      toast.error(push.error)
    }
    setRemovingDeviceId(null)
    setDeviceToRemove(null)
  }

  const DeviceIcon = ({ type }: { type: string }) => {
    const iconName = getDeviceIcon(type as 'ios' | 'android' | 'desktop')
    if (iconName === 'Monitor') return <Monitor size={16} strokeWidth={1.5} />
    return <Smartphone size={16} strokeWidth={1.5} />
  }

  const formatLastUsed = useCallback((dateString: string | null): string => {
    if (!dateString) return 'לא ידוע'
    try {
      const date = new Date(dateString)
      const now = new Date()
      const diffMs = now.getTime() - date.getTime()
      const diffMins = Math.floor(diffMs / 60000)
      const diffHours = Math.floor(diffMs / 3600000)
      const diffDays = Math.floor(diffMs / 86400000)

      if (diffMins < 1) return 'הרגע'
      if (diffMins < 60) return `לפני ${diffMins} דקות`
      if (diffHours < 24) return `לפני ${diffHours} שעות`
      if (diffDays < 7) return `לפני ${diffDays} ימים`
      return date.toLocaleDateString('he-IL')
    } catch {
      return 'לא ידוע'
    }
  }, [])

  if (!barber) return null

  const isNotificationsAvailable = push.isSubscribed && push.permission === 'granted'

  return (
    <div className={cn('space-y-4', className)}>
      <GlassCard padding="lg">
        <div className="flex items-center gap-3 mb-4">
          <div className={cn(
            'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
            isNotificationsAvailable ? 'bg-green-500/20' : 'bg-foreground-muted/20'
          )}>
            {isNotificationsAvailable ? (
              <Bell size={20} strokeWidth={1.5} className="text-green-400" />
            ) : (
              <BellOff size={20} strokeWidth={1.5} className="text-foreground-muted" />
            )}
          </div>
          <div className="flex-1">
            <h3 className="text-foreground-light font-medium">התראות Push</h3>
            <p className="text-foreground-muted text-xs">
              {isNotificationsAvailable ? 'פעיל' : 'לא פעיל'}
            </p>
          </div>
          <button
            onClick={() => setShowHelp(!showHelp)}
            className="icon-btn p-2 rounded-lg text-foreground-muted hover:text-accent-gold hover:bg-white/5 transition-colors"
            aria-label="עזרה"
          >
            <HelpCircle size={18} strokeWidth={1.5} />
          </button>
        </div>

        {/* Help Section */}
        {showHelp && (
          <div className="bg-white/5 rounded-xl p-4 mb-4 text-sm text-foreground-muted space-y-2">
            <p>כספר/מנהל, תקבל התראות על:</p>
            <ul className="list-disc list-inside space-y-1 mr-2">
              <li>תורים חדשים שנקבעו</li>
              <li>ביטולים מצד לקוחות</li>
              <li>הודעות מהמערכת</li>
            </ul>
            <p className="pt-2 border-t border-white/10">
              ודא שהתראות מאופשרות בדפדפן ובמערכת ההפעלה.
            </p>
          </div>
        )}

        {/* Status */}
        {!pwa.isStandalone && (
          <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl mb-4">
            <AlertTriangle size={16} className="text-amber-400 flex-shrink-0" />
            <p className="text-amber-300 text-xs">
              להתראות מלאות, התקן את האפליקציה במכשיר שלך
            </p>
          </div>
        )}

        {push.permission === 'denied' && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl mb-4">
            <AlertTriangle size={16} className="text-red-400 flex-shrink-0" />
            <p className="text-red-300 text-xs">
              התראות חסומות. אפשר אותן בהגדרות הדפדפן
            </p>
          </div>
        )}

        {/* Enable/Disable Button */}
        {push.isSupported && push.permission !== 'denied' && (
          <button
            onClick={isNotificationsAvailable ? handleDisableNotifications : handleEnableNotifications}
            disabled={isEnabling || push.isLoading}
            className={cn(
              'w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium transition-all',
              isNotificationsAvailable
                ? 'bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20'
                : 'bg-accent-gold text-background-dark hover:bg-accent-gold/90'
            )}
          >
            {isEnabling || push.isLoading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : isNotificationsAvailable ? (
              <>
                <BellOff size={18} />
                <span>בטל התראות</span>
              </>
            ) : (
              <>
                <Bell size={18} />
                <span>הפעל התראות</span>
              </>
            )}
          </button>
        )}

        {/* Connected Devices */}
        {push.devices.length > 0 && (
          <div className="mt-4 pt-4 border-t border-white/10">
            <button
              onClick={() => setShowDevices(!showDevices)}
              className="w-full flex items-center justify-between text-foreground-muted text-sm hover:text-foreground-light transition-colors"
            >
              <span>מכשירים מחוברים ({push.devices.length})</span>
              {showDevices ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {showDevices && (
              <div className="mt-3 space-y-2">
                {push.devices.map((device) => (
                  <div
                    key={device.id}
                    className="flex items-center gap-3 p-3 rounded-xl bg-white/5"
                  >
                    <div className="w-8 h-8 rounded-full bg-accent-gold/10 flex items-center justify-center">
                      <DeviceIcon type={device.deviceType} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-foreground-light text-sm truncate">
                        {device.deviceName || device.deviceType}
                      </p>
                      <p className="text-foreground-muted text-xs">
                        {formatLastUsed(device.lastUsed)}
                      </p>
                    </div>
                    <button
                      onClick={() => setDeviceToRemove({ id: device.id, name: device.deviceName || device.deviceType })}
                      disabled={removingDeviceId === device.id}
                      className="p-1.5 rounded-lg text-foreground-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      aria-label="הסר מכשיר"
                    >
                      {removingDeviceId === device.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Trash2 size={14} />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </GlassCard>

      {/* Remove Device Confirmation Modal */}
      {deviceToRemove && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setDeviceToRemove(null)} />
          <div className="relative w-full max-w-sm glass-elevated rounded-3xl p-6 text-center">
            <button
              onClick={() => setDeviceToRemove(null)}
              className="icon-btn absolute top-4 left-4 p-2 rounded-lg text-foreground-muted hover:text-foreground-light transition-colors"
            >
              <X size={18} />
            </button>
            
            <div className="mx-auto w-16 h-16 rounded-2xl bg-red-500/20 flex items-center justify-center mb-4">
              <Trash2 size={28} className="text-red-400" />
            </div>
            
            <h3 className="text-lg font-bold text-foreground-light mb-2">הסר מכשיר</h3>
            <p className="text-foreground-muted text-sm mb-6">
              האם להסיר את <span className="text-foreground-light">{deviceToRemove.name}</span> מרשימת המכשירים?
            </p>
            
            <div className="space-y-2">
              <button
                onClick={confirmRemoveDevice}
                disabled={removingDeviceId !== null}
                className="w-full py-3 px-4 rounded-xl font-bold bg-red-500 text-white hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
              >
                {removingDeviceId ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                <span>הסר</span>
              </button>
              <button
                onClick={() => setDeviceToRemove(null)}
                className="w-full py-3 px-4 rounded-xl font-medium bg-white/10 text-foreground-light hover:bg-white/20 transition-colors"
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

