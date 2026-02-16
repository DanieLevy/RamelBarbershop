'use client'

import { useState, useEffect, useCallback } from 'react'
import { useBarberAuthStore } from '@/store/useBarberAuthStore'
import { usePushNotifications, getDeviceIcon } from '@/hooks/usePushNotifications'
import { usePWA } from '@/hooks/usePWA'
import { GlassCard } from '@/components/ui/GlassCard'
import { cn, formatHebrewMinutes, formatHebrewHours, formatHebrewDays } from '@/lib/utils'
import { showToast } from '@/lib/toast'
import { Button } from '@heroui/react'
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
  HelpCircle,
  RefreshCw
} from 'lucide-react'

interface BarberNotificationSettingsProps {
  className?: string
}

export function BarberNotificationSettings({ className }: BarberNotificationSettingsProps) {
  const { barber } = useBarberAuthStore()
  const pwa = usePWA()
  const push = usePushNotifications()
  const [isEnabling, setIsEnabling] = useState(false)
  const [isRecheckingPermission, setIsRecheckingPermission] = useState(false)
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
      showToast.success('התראות הופעלו בהצלחה!')
    } else if (push.error) {
      showToast.error(push.error)
    }
    setIsEnabling(false)
  }

  /**
   * Re-check permission after user manually changes settings
   * If permission changed from 'denied' to 'default' or 'granted', allow subscription
   */
  const handleRecheckPermission = async () => {
    setIsRecheckingPermission(true)
    
    // Refresh status to get current permission from browser
    await push.refreshStatus()
    
    // Check if permission is now available (use window.Notification to avoid iOS Safari ReferenceError)
    let currentPermission: NotificationPermission | 'denied' = 'denied'
    try {
      const NotificationAPI = typeof window !== 'undefined' ? window.Notification : null
      if (NotificationAPI && typeof NotificationAPI.permission === 'string') {
        currentPermission = NotificationAPI.permission
      }
    } catch {
      // iOS Safari can throw ReferenceError
    }
    
    if (currentPermission === 'granted') {
      // Permission granted in settings! Auto-subscribe
      showToast.success('הרשאה זוהתה! מפעיל התראות...')
      const success = await push.subscribe()
      if (success) {
        showToast.success('התראות הופעלו בהצלחה!')
      }
    } else if (currentPermission === 'default') {
      // Permission reset to default - user can now request again
      showToast.success('ההרשאה אופסה! כעת ניתן להפעיל התראות')
    } else {
      // Still denied
      showToast.error('ההתראות עדיין חסומות. יש לשנות בהגדרות המכשיר.')
    }
    
    setIsRecheckingPermission(false)
  }

  const handleDisableNotifications = async () => {
    const success = await push.unsubscribe()
    if (success) {
      showToast.success('התראות בוטלו')
    } else if (push.error) {
      showToast.error(push.error)
    }
  }

  const confirmRemoveDevice = async () => {
    if (!deviceToRemove) return
    setRemovingDeviceId(deviceToRemove.id)
    const success = await push.removeDevice(deviceToRemove.id)
    if (success) {
      showToast.success('המכשיר הוסר בהצלחה')
    } else if (push.error) {
      showToast.error(push.error)
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
      if (diffMins < 60) return `לפני ${formatHebrewMinutes(diffMins)}`
      if (diffHours < 24) return `לפני ${formatHebrewHours(diffHours)}`
      if (diffDays < 7) return `לפני ${formatHebrewDays(diffDays)}`
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
          <Button
            onPress={() => setShowHelp(!showHelp)}
            isIconOnly
            variant="ghost"
            className="min-w-[36px] w-9 h-9 icon-btn p-2 rounded-lg text-foreground-muted hover:text-accent-gold hover:bg-white/5 transition-colors"
            aria-label="עזרה"
          >
            <HelpCircle size={18} strokeWidth={1.5} />
          </Button>
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
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl mb-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={16} className="text-red-400 flex-shrink-0" />
              <p className="text-red-300 text-sm font-medium">
                התראות חסומות
              </p>
            </div>
            
            <p className="text-foreground-muted text-xs mb-3">
              {push.isIOS 
                ? 'יש לפתוח הגדרות המכשיר → התראות → רם אל ברברשופ → הפעל'
                : 'יש ללחוץ על 🔒 ליד שורת הכתובת → התראות → אפשר'
              }
            </p>
            
            <Button
              onPress={handleRecheckPermission}
              isDisabled={isRecheckingPermission}
              className={cn(
                'w-full py-2.5 px-4 rounded-xl font-medium transition-all flex items-center justify-center gap-2 text-sm',
                isRecheckingPermission
                  ? 'bg-accent-gold/50 text-background-dark cursor-not-allowed'
                  : 'bg-accent-gold text-background-dark hover:bg-accent-gold/90'
              )}
            >
              {isRecheckingPermission ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>בודק...</span>
                </>
              ) : (
                <>
                  <RefreshCw size={16} />
                  <span>בדוק שוב</span>
                </>
              )}
            </Button>
          </div>
        )}

        {/* Enable/Disable Button */}
        {push.isSupported && push.permission !== 'denied' && (
          <Button
            onPress={isNotificationsAvailable ? handleDisableNotifications : handleEnableNotifications}
            isDisabled={isEnabling || push.isLoading}
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
          </Button>
        )}

        {/* Connected Devices */}
        {push.devices.length > 0 && (
          <div className="mt-4 pt-4 border-t border-white/10">
            <Button
              onPress={() => setShowDevices(!showDevices)}
              variant="ghost"
              className="w-full flex items-center justify-between text-foreground-muted text-sm hover:text-foreground-light transition-colors"
            >
              <span>מכשירים מחוברים ({push.devices.length})</span>
              {showDevices ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </Button>

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
                    <Button
                      onPress={() => setDeviceToRemove({ id: device.id, name: device.deviceName || device.deviceType })}
                      isDisabled={removingDeviceId === device.id}
                      isIconOnly
                      variant="ghost"
                      className="min-w-[28px] w-7 h-7 p-1.5 rounded-lg text-foreground-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      aria-label="הסר מכשיר"
                    >
                      {removingDeviceId === device.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Trash2 size={14} />
                      )}
                    </Button>
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
            <Button
              onPress={() => setDeviceToRemove(null)}
              isIconOnly
              variant="ghost"
              className="min-w-[36px] w-9 h-9 icon-btn absolute top-4 left-4 p-2 rounded-lg text-foreground-muted hover:text-foreground-light transition-colors"
              aria-label="סגור"
            >
              <X size={18} />
            </Button>
            
            <div className="mx-auto w-16 h-16 rounded-2xl bg-red-500/20 flex items-center justify-center mb-4">
              <Trash2 size={28} className="text-red-400" />
            </div>
            
            <h3 className="text-lg font-bold text-foreground-light mb-2">הסר מכשיר</h3>
            <p className="text-foreground-muted text-sm mb-6">
              האם להסיר את <span className="text-foreground-light">{deviceToRemove.name}</span> מרשימת המכשירים?
            </p>
            
            <div className="space-y-2">
              <Button
                onPress={confirmRemoveDevice}
                isDisabled={removingDeviceId !== null}
                className="w-full py-3 px-4 rounded-xl font-bold bg-red-500 text-white hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
              >
                {removingDeviceId ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                <span>הסר</span>
              </Button>
              <Button
                onPress={() => setDeviceToRemove(null)}
                variant="ghost"
                className="w-full py-3 px-4 rounded-xl font-medium bg-white/10 text-foreground-light hover:bg-white/20 transition-colors"
              >
                ביטול
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

