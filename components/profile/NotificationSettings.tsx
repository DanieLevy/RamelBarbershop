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
  ChevronDown,
  ChevronUp,
  X,
  HelpCircle
} from 'lucide-react'

interface NotificationSettingsProps {
  className?: string
}

export function NotificationSettings({ className }: NotificationSettingsProps) {
  const pwa = usePWA()
  const push = usePushNotifications()
  const [isEnabling, setIsEnabling] = useState(false)
  const [showDevices, setShowDevices] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [deviceToRemove, setDeviceToRemove] = useState<{ id: string; name: string } | null>(null)
  const [removingDeviceId, setRemovingDeviceId] = useState<string | null>(null)

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

  const formatLastUsed = (dateString: string): string => {
    try {
      const date = new Date(dateString)
      const now = new Date()
      const diffMs = now.getTime() - date.getTime()
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
      if (diffDays === 0) return 'היום'
      if (diffDays === 1) return 'אתמול'
      if (diffDays < 7) return `לפני ${diffDays} ימים`
      return date.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' })
    } catch {
      return 'לא ידוע'
    }
  }

  // Determine if notifications are working (simple boolean)
  const isNotificationsEnabled = push.isSubscribed && push.permission === 'granted'
  
  // Determine if there's an issue that needs user attention
  const hasIssue = !push.isSupported || 
                   push.permission === 'denied' || 
                   (push.isIOS && !pwa.isStandalone && !push.isSubscribed)

  // Get issue-specific help content
  const getIssueHelp = () => {
    if (!push.isSupported) {
      return {
        title: 'דפדפן לא נתמך',
        message: 'הדפדפן שלך אינו תומך בהתראות.',
        steps: [
          'נסה להשתמש בדפדפן Chrome, Firefox או Safari',
          'ודא שהדפדפן מעודכן לגרסה האחרונה'
        ]
      }
    }
    
    if (push.permission === 'denied') {
      if (push.isIOS) {
        return {
          title: 'ההתראות נחסמו',
          message: 'יש לאפשר התראות בהגדרות האייפון:',
          steps: [
            'פתח את הגדרות האייפון',
            'גלול למטה ולחץ על Safari (או האפליקציה)',
            'הפעל את "התראות" (Notifications)'
          ]
        }
      }
      return {
        title: 'ההתראות נחסמו',
        message: 'יש לאפשר התראות בהגדרות הדפדפן:',
        steps: [
          'לחץ על סמל המנעול/הגדרות ליד שורת הכתובת',
          'מצא את "התראות" או "Notifications"',
          'שנה מ"חסום" ל"אפשר"',
          'רענן את הדף'
        ]
      }
    }
    
    if (push.isIOS && !pwa.isStandalone) {
      return {
        title: 'נדרשת התקנה',
        message: 'באייפון, יש להתקין את האפליקציה למסך הבית:',
        steps: [
          'לחץ על כפתור השיתוף (⎙) בתחתית המסך',
          'גלול למטה ובחר "הוסף למסך הבית"',
          'לחץ "הוסף" בפינה הימנית העליונה',
          'פתח את האפליקציה ממסך הבית'
        ]
      }
    }
    
    return null
  }

  const issueHelp = getIssueHelp()
  const canEnableNotifications = push.isSupported && 
                                  push.permission !== 'denied' && 
                                  (!push.isIOS || pwa.isStandalone)

  return (
    <div className={cn('space-y-3', className)}>
      {/* Main Status Card */}
      <GlassCard padding="md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              'w-10 h-10 rounded-full flex items-center justify-center',
              isNotificationsEnabled ? 'bg-green-500/20' : 'bg-white/10'
            )}>
              {isNotificationsEnabled ? (
                <Bell size={20} className="text-green-400" />
              ) : (
                <BellOff size={20} className="text-foreground-muted" />
              )}
            </div>
            <div>
              <h3 className="font-medium text-foreground-light">התראות</h3>
              <p className={cn(
                'text-sm',
                isNotificationsEnabled ? 'text-green-400' : 'text-foreground-muted'
              )}>
                {isNotificationsEnabled ? 'פעיל' : 'כבוי'}
              </p>
            </div>
          </div>
          
          {/* Toggle Button */}
          {canEnableNotifications && (
            <button
              onClick={isNotificationsEnabled ? handleDisableNotifications : handleEnableNotifications}
              disabled={isEnabling || push.isLoading}
              className={cn(
                'w-12 h-7 rounded-full transition-colors relative flex-shrink-0',
                isNotificationsEnabled ? 'bg-accent-gold' : 'bg-white/10',
                (isEnabling || push.isLoading) && 'opacity-50 cursor-not-allowed'
              )}
              aria-checked={isNotificationsEnabled}
              role="switch"
            >
              <div className={cn(
                'absolute top-1 w-5 h-5 rounded-full bg-white transition-all',
                isNotificationsEnabled ? 'right-1' : 'left-1'
              )}>
                {(isEnabling || push.isLoading) && (
                  <Loader2 size={12} className="animate-spin absolute top-0.5 left-0.5 text-background-dark" />
                )}
              </div>
            </button>
          )}
          
          {/* Help Button (when there's an issue) */}
          {hasIssue && (
            <button
              onClick={() => setShowHelp(!showHelp)}
              className={cn(
                'icon-btn p-2 rounded-lg transition-colors',
                showHelp ? 'bg-amber-500/20 text-amber-400' : 'bg-white/10 text-foreground-muted hover:text-amber-400'
              )}
            >
              <HelpCircle size={20} />
            </button>
          )}
        </div>
        
        {/* Issue Help Section */}
        {showHelp && issueHelp && (
          <div className="mt-4 pt-4 border-t border-white/10">
            <div className="flex items-start gap-3">
              <AlertTriangle size={18} className="text-amber-400 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-medium text-amber-400">{issueHelp.title}</h4>
                <p className="text-sm text-foreground-muted mt-1">{issueHelp.message}</p>
                <ol className="mt-3 space-y-2">
                  {issueHelp.steps.map((step, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-foreground-muted">
                      <span className="w-5 h-5 rounded-full bg-accent-gold/20 text-accent-gold text-xs flex items-center justify-center flex-shrink-0">
                        {i + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        )}
      </GlassCard>

      {/* Connected Devices (Collapsible) */}
      {push.devices.length > 0 && (
        <GlassCard padding="sm">
          <button
            onClick={() => setShowDevices(!showDevices)}
            className="w-full flex items-center justify-between py-1"
          >
            <div className="flex items-center gap-3">
              <Smartphone size={16} className="text-foreground-muted" />
              <span className="text-sm text-foreground-light">
                מכשירים מחוברים ({push.devices.length})
              </span>
            </div>
            {showDevices ? (
              <ChevronUp size={16} className="text-foreground-muted" />
            ) : (
              <ChevronDown size={16} className="text-foreground-muted" />
            )}
          </button>
          
          {/* Primary Device (always visible) */}
          {!showDevices && push.devices[0] && (
            <div className="flex items-center gap-3 mt-3 pt-3 border-t border-white/5">
              <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
                <DeviceIcon type={push.devices[0].deviceType} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground-light truncate">
                  {push.devices[0].deviceName || 'מכשיר ראשי'}
                </p>
                <p className="text-xs text-foreground-muted">
                  {formatLastUsed(push.devices[0].lastUsed)}
                </p>
              </div>
              <CheckCircle size={14} className="text-green-400" />
            </div>
          )}
          
          {/* Expanded Device List */}
          {showDevices && (
            <div className="mt-3 pt-3 border-t border-white/5 space-y-2">
              {push.devices.map((device) => (
                <div key={device.id} className="flex items-center gap-3 py-2">
                  <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
                    <DeviceIcon type={device.deviceType} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground-light truncate">
                      {device.deviceName || 'מכשיר לא מזוהה'}
                    </p>
                    <p className="text-xs text-foreground-muted">
                      {formatLastUsed(device.lastUsed)}
                    </p>
                  </div>
                  <button
                    onClick={() => setDeviceToRemove({ id: device.id, name: device.deviceName || 'מכשיר' })}
                    disabled={removingDeviceId === device.id}
                    className="p-2 text-foreground-muted hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
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
        </GlassCard>
      )}

      {/* Device Removal Confirmation Modal */}
      {deviceToRemove && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-background-darker border border-white/10 rounded-2xl max-w-sm w-full p-6 animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-foreground-light">הסרת מכשיר</h3>
              <button
                onClick={() => setDeviceToRemove(null)}
                className="p-1 text-foreground-muted hover:text-foreground-light"
              >
                <X size={20} />
              </button>
            </div>
            
            <p className="text-foreground-muted mb-4">
              האם להסיר את <span className="text-foreground-light font-medium">{deviceToRemove.name}</span> מרשימת המכשירים?
            </p>
            <p className="text-sm text-foreground-muted/70 mb-6">
              מכשיר זה לא יקבל יותר התראות על תורים ועדכונים.
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={() => setDeviceToRemove(null)}
                className="flex-1 py-3 rounded-xl bg-white/10 text-foreground-light font-medium hover:bg-white/15 transition-colors"
              >
                ביטול
              </button>
              <button
                onClick={confirmRemoveDevice}
                disabled={removingDeviceId === deviceToRemove.id}
                className="flex-1 py-3 rounded-xl bg-red-500/20 text-red-400 font-medium border border-red-500/30 hover:bg-red-500/30 transition-colors disabled:opacity-50"
              >
                {removingDeviceId === deviceToRemove.id ? (
                  <Loader2 size={18} className="animate-spin mx-auto" />
                ) : (
                  'הסר מכשיר'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
