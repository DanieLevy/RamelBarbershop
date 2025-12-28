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
  Download,
  Settings2,
  XCircle
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

  // Get overall status color and message
  const getOverallStatus = () => {
    if (!push.isSupported) {
      return {
        status: 'unsupported',
        color: 'text-red-400',
        bgColor: 'bg-red-500/10 border-red-500/30',
        icon: XCircle,
        title: 'לא נתמך במכשיר',
        message: 'הדפדפן או המכשיר שלך אינו תומך בהתראות. נסה להשתמש בדפדפן מודרני כמו Chrome, Firefox או Safari.'
      }
    }
    
    if (push.permission === 'denied') {
      return {
        status: 'denied',
        color: 'text-red-400',
        bgColor: 'bg-red-500/10 border-red-500/30',
        icon: XCircle,
        title: 'ההתראות נחסמו',
        message: 'חסמת את ההתראות בהגדרות המכשיר. כדי להפעיל מחדש, יש לפתוח את הגדרות הדפדפן ולאפשר התראות עבור האפליקציה.'
      }
    }
    
    if (push.isIOS && !pwa.isStandalone) {
      return {
        status: 'pwa_required',
        color: 'text-amber-400',
        bgColor: 'bg-amber-500/10 border-amber-500/30',
        icon: Download,
        title: 'נדרשת התקנה',
        message: 'באייפון, יש להתקין את האפליקציה למסך הבית כדי לקבל התראות. לחץ על כפתור השיתוף (⎙) ובחר "הוסף למסך הבית".'
      }
    }
    
    if (push.isSubscribed) {
      return {
        status: 'active',
        color: 'text-green-400',
        bgColor: 'bg-green-500/10 border-green-500/30',
        icon: CheckCircle,
        title: 'התראות פעילות',
        message: `המכשיר שלך רשום לקבלת התראות. תקבל תזכורות על תורים, עדכונים על שינויים והודעות חשובות.`
      }
    }
    
    return {
      status: 'inactive',
      color: 'text-foreground-muted',
      bgColor: 'bg-white/5 border-white/10',
      icon: BellOff,
      title: 'התראות כבויות',
      message: 'הפעל התראות כדי לקבל תזכורות על תורים קרובים, עדכונים על שינויים והודעות מהברברשופ.'
    }
  }

  const overallStatus = getOverallStatus()
  const StatusIcon = overallStatus.icon

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

      {/* Overall Status Card */}
      <GlassCard padding="md" className={cn('border', overallStatus.bgColor)}>
        <div className="flex items-start gap-4">
          <div className={cn(
            'w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0',
            overallStatus.status === 'active' ? 'bg-green-500/20' :
            overallStatus.status === 'denied' || overallStatus.status === 'unsupported' ? 'bg-red-500/20' :
            overallStatus.status === 'pwa_required' ? 'bg-amber-500/20' :
            'bg-white/10'
          )}>
            <StatusIcon size={24} className={overallStatus.color} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className={cn('font-medium', overallStatus.color)}>
              {overallStatus.title}
            </h3>
            <p className="text-sm text-foreground-muted mt-1 leading-relaxed">
              {overallStatus.message}
            </p>
          </div>
        </div>
      </GlassCard>

      {/* Detailed Status Section */}
      <GlassCard padding="md" className="space-y-4">
        <div className="flex items-center gap-2 text-foreground-muted mb-2">
          <Settings2 size={14} />
          <span className="text-xs font-medium">סטטוס מפורט</span>
        </div>

        {/* PWA Status */}
        <div className="flex items-center justify-between py-2 border-b border-white/5">
          <div className="flex items-center gap-3">
            <Download size={16} className="text-foreground-muted" />
            <div>
              <p className="text-sm text-foreground-light">אפליקציה מותקנת</p>
              <p className="text-xs text-foreground-muted">
                {pwa.isStandalone || pwa.isInstalled 
                  ? 'האפליקציה מותקנת על המכשיר' 
                  : 'משתמש דרך דפדפן'}
              </p>
            </div>
          </div>
          <div className={cn(
            'flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full',
            pwa.isStandalone || pwa.isInstalled
              ? 'bg-green-500/20 text-green-400'
              : 'bg-amber-500/20 text-amber-400'
          )}>
            {pwa.isStandalone || pwa.isInstalled ? (
              <><CheckCircle size={12} /> מותקן</>
            ) : (
              <><Info size={12} /> לא מותקן</>
            )}
          </div>
        </div>

        {/* Permission Status */}
        <div className="flex items-center justify-between py-2 border-b border-white/5">
          <div className="flex items-center gap-3">
            {push.permission === 'granted' ? (
              <CheckCircle size={16} className="text-green-400" />
            ) : push.permission === 'denied' ? (
              <XCircle size={16} className="text-red-400" />
            ) : (
              <Info size={16} className="text-amber-400" />
            )}
            <div>
              <p className="text-sm text-foreground-light">הרשאת מכשיר</p>
              <p className="text-xs text-foreground-muted">
                {push.permission === 'granted' 
                  ? 'המכשיר מאפשר קבלת התראות'
                  : push.permission === 'denied'
                  ? 'ההרשאה נחסמה בהגדרות המכשיר'
                  : 'טרם נתבקשה הרשאה'}
              </p>
            </div>
          </div>
          <div className={cn(
            'flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full',
            push.permission === 'granted' ? 'bg-green-500/20 text-green-400' :
            push.permission === 'denied' ? 'bg-red-500/20 text-red-400' :
            'bg-amber-500/20 text-amber-400'
          )}>
            {push.permission === 'granted' ? 'מאושר' :
             push.permission === 'denied' ? 'נחסם' :
             'ממתין'}
          </div>
        </div>

        {/* Subscription Status */}
        <div className="flex items-center justify-between py-2">
          <div className="flex items-center gap-3">
            {push.isSubscribed ? (
              <Bell size={16} className="text-accent-gold" />
            ) : (
              <BellOff size={16} className="text-foreground-muted" />
            )}
            <div>
              <p className="text-sm text-foreground-light">רישום להתראות</p>
              <p className="text-xs text-foreground-muted">
                {push.isSubscribed 
                  ? `${push.devices.length} מכשיר${push.devices.length !== 1 ? 'ים' : ''} רשומים`
                  : 'לא רשום לקבלת התראות'}
              </p>
            </div>
          </div>
          <div className={cn(
            'flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full',
            push.isSubscribed
              ? 'bg-green-500/20 text-green-400'
              : 'bg-white/10 text-foreground-muted'
          )}>
            {push.isSubscribed ? (
              <><CheckCircle size={12} /> פעיל</>
            ) : (
              <>כבוי</>
            )}
          </div>
        </div>
      </GlassCard>

      {/* Benefits Info (when not subscribed) */}
      {!push.isSubscribed && push.isSupported && push.permission !== 'denied' && (
        <GlassCard padding="md" className="bg-accent-gold/5 border-accent-gold/20">
          <h4 className="text-sm font-medium text-accent-gold mb-3 flex items-center gap-2">
            <Bell size={14} />
            למה להפעיל התראות?
          </h4>
          <ul className="space-y-2">
            <li className="flex items-start gap-2 text-sm text-foreground-muted">
              <span className="text-green-400 mt-0.5">✓</span>
              <span>תזכורת לפני התור שלך - לעולם לא תשכח</span>
            </li>
            <li className="flex items-start gap-2 text-sm text-foreground-muted">
              <span className="text-green-400 mt-0.5">✓</span>
              <span>עדכון מיידי אם יש שינוי בתור שלך</span>
            </li>
            <li className="flex items-start gap-2 text-sm text-foreground-muted">
              <span className="text-green-400 mt-0.5">✓</span>
              <span>הודעות על מבצעים והטבות מיוחדות</span>
            </li>
          </ul>
          <p className="text-xs text-foreground-muted/70 mt-3">
            💡 אנחנו לא שולחים ספאם - רק הודעות חשובות שקשורות אליך!
          </p>
        </GlassCard>
      )}

      {/* Enable/Disable Button */}
      {push.isSupported && push.permission !== 'denied' && (
        <GlassCard padding="md">
          {!push.isSubscribed ? (
            <button
              onClick={handleEnableNotifications}
              disabled={isEnabling || (push.isIOS && !pwa.isStandalone)}
              className={cn(
                'w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold transition-all',
                isEnabling || (push.isIOS && !pwa.isStandalone)
                  ? 'bg-foreground-muted/20 text-foreground-muted cursor-not-allowed'
                  : 'bg-accent-gold text-background-dark hover:bg-accent-gold/90 shadow-gold'
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
                  <span>הפעל התראות עכשיו</span>
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
          
          {push.isIOS && !pwa.isStandalone && (
            <p className="text-xs text-foreground-muted text-center mt-3">
              💡 התקן את האפליקציה קודם כדי להפעיל התראות
            </p>
          )}
        </GlassCard>
      )}

      {/* Connected Devices */}
      {push.devices.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-foreground-muted flex items-center gap-2">
            <Smartphone size={14} />
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
          
          <p className="text-xs text-foreground-muted/70 text-center">
            כל מכשיר רשום יקבל התראות בנפרד
          </p>
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
