'use client'

import { useState, useEffect } from 'react'
import { X, Download, Share, Smartphone, Monitor, ChevronDown, AlertTriangle, Bell, Heart } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getDismissCount } from '@/hooks/usePWA'
import { useNotificationManager, useNotificationTiming } from '@/components/NotificationManager'

interface InstallBannerProps {
  isModal: boolean
  deviceOS: 'ios' | 'android' | 'desktop' | 'unknown'
  isInstallable: boolean
  onInstall: () => Promise<boolean>
  onDismiss: () => void
  instructions: {
    title: string
    steps: string[]
  }
}

// Messages that get more urgent based on dismiss count
const getUrgentMessage = (dismissCount: number): { 
  title: string
  subtitle: string
  icon: 'info' | 'warning' | 'heart'
  confirmDismiss: boolean
} => {
  switch (dismissCount) {
    case 0:
      return {
        title: 'התקינו את האפליקציה',
        subtitle: 'גישה מהירה + התראות על תורים',
        icon: 'info',
        confirmDismiss: false,
      }
    case 1:
      return {
        title: 'ראינו שעדיין לא התקנת את האפליקציה',
        subtitle: 'התקנה תאפשר לך לקבל תזכורות ועדכונים על התורים שלך',
        icon: 'info',
        confirmDismiss: false,
      }
    case 2:
      return {
        title: 'חשוב! האפליקציה עדיין לא מותקנת',
        subtitle: 'בלי התקנה לא תקבלו התראות על תורים חדשים או שינויים',
        icon: 'warning',
        confirmDismiss: true,
      }
    case 3:
      return {
        title: 'אל תפספסו תורים!',
        subtitle: 'לקוחות שהתקינו את האפליקציה מקבלים תזכורות ולא מפספסים תורים',
        icon: 'warning',
        confirmDismiss: true,
      }
    default:
      return {
        title: 'אנא התקינו את האפליקציה',
        subtitle: 'זה באמת חשוב כדי לקבל התראות ועדכונים. זה לוקח רק שניות!',
        icon: 'heart',
        confirmDismiss: true,
      }
  }
}

export function InstallBanner({
  isModal,
  deviceOS,
  isInstallable,
  onInstall,
  onDismiss,
  instructions,
}: InstallBannerProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [dismissCount, setDismissCount] = useState(0)
  const [hasRequested, setHasRequested] = useState(false)
  
  const { requestNotification, dismissNotification, canShowNotification } = useNotificationManager()
  const delay = useNotificationTiming('pwa-install')
  
  // Get dismiss count and urgent message on mount
  useEffect(() => {
    setDismissCount(getDismissCount())
  }, [])
  
  const urgentMessage = getUrgentMessage(dismissCount)

  // Request to show via notification manager (coordinated with other notifications)
  useEffect(() => {
    if (hasRequested) return
    
    const timer = setTimeout(() => {
      setHasRequested(true)
      requestNotification('pwa-install')
    }, delay)

    return () => clearTimeout(timer)
  }, [delay, hasRequested, requestNotification])
  
  // Show only when notification manager allows
  useEffect(() => {
    if (hasRequested && canShowNotification('pwa-install')) {
      setIsVisible(true)
    }
  }, [hasRequested, canShowNotification])

  const handleClose = () => {
    // Check if we need confirmation before dismissing
    if (urgentMessage.confirmDismiss && !showConfirmation) {
      setShowConfirmation(true)
      return
    }
    
    setIsClosing(true)
    setTimeout(() => {
      dismissNotification('pwa-install')
      onDismiss()
    }, 300)
  }

  const handleInstall = async () => {
    const success = await onInstall()
    if (success) {
      setIsClosing(true)
      setTimeout(() => {
        dismissNotification('pwa-install')
        onDismiss()
      }, 300)
    }
  }

  if (!isVisible) return null

  // Get device-specific icon
  const DeviceIcon = deviceOS === 'ios' ? Share : deviceOS === 'android' ? Download : Monitor
  
  // Get icon based on urgency
  const UrgentIcon = urgentMessage.icon === 'warning' ? AlertTriangle : 
                     urgentMessage.icon === 'heart' ? Heart : Bell

  // Confirmation Modal (Are you sure?)
  if (showConfirmation) {
    return (
      <div
        className={cn(
          'fixed inset-0 z-[60] flex items-center justify-center p-4',
          'transition-all duration-300',
          isClosing ? 'opacity-0 pointer-events-none' : 'opacity-100'
        )}
      >
        {/* Backdrop */}
        <div className={cn(
          'absolute inset-0 bg-black/70 backdrop-blur-sm',
          isClosing && 'pointer-events-none'
        )} />

        {/* Confirmation Modal */}
        <div
          className={cn(
            'relative w-full max-w-sm',
            'glass-elevated rounded-3xl',
            'p-6 text-center',
            'transform transition-all duration-300',
            isClosing ? 'scale-95 opacity-0' : 'scale-100 opacity-100'
          )}
        >
          {/* Warning Icon */}
          <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-500/20 flex items-center justify-center mb-4">
            <AlertTriangle size={32} className="text-amber-400" />
          </div>

          <h2 className="text-lg font-bold text-foreground-light mb-2">
            בטוח שאתה רוצה לדחות?
          </h2>

          <p className="text-foreground-muted text-sm mb-4">
            בלי האפליקציה לא תוכל לקבל:
          </p>
          
          <ul className="text-right text-foreground-light text-sm space-y-2 mb-6 px-4">
            <li className="flex items-center gap-2">
              <Bell size={16} className="text-accent-gold flex-shrink-0" />
              <span>התראות על תורים חדשים</span>
            </li>
            <li className="flex items-center gap-2">
              <Bell size={16} className="text-accent-gold flex-shrink-0" />
              <span>תזכורות לפני התור</span>
            </li>
            <li className="flex items-center gap-2">
              <Bell size={16} className="text-accent-gold flex-shrink-0" />
              <span>עדכונים על שינויים או ביטולים</span>
            </li>
          </ul>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={() => {
                setIsClosing(true)
                setTimeout(() => {
                  dismissNotification('pwa-install')
                  onDismiss()
                }, 300)
              }}
              className="flex-1 py-3 px-4 rounded-xl bg-white/10 text-foreground-muted font-medium hover:bg-white/20 transition-colors text-sm"
            >
              דחה בכל זאת
            </button>
            
            <button
              onClick={() => {
                setShowConfirmation(false)
                handleInstall()
              }}
              className="flex-1 py-3 px-4 rounded-xl bg-accent-gold text-background-dark font-bold hover:bg-accent-gold/90 transition-colors flex items-center justify-center gap-2"
            >
              <Download size={18} />
              התקן עכשיו
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Bottom Toast Banner
  if (!isModal) {
    return (
      <div
        className={cn(
          'fixed bottom-20 md:bottom-4 left-4 right-4 z-50',
          'transition-all duration-300 ease-out',
          isClosing ? 'translate-y-full opacity-0' : 'translate-y-0 opacity-100'
        )}
      >
        <div
          className={cn(
            'mx-auto max-w-md',
            'glass-elevated rounded-2xl',
            'p-4 flex items-center gap-4',
            urgentMessage.icon === 'warning' ? 'border-2 border-amber-500/50' : 'border border-white/10'
          )}
        >
          {/* App Icon - changes based on urgency */}
          <div className={cn(
            'flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center',
            urgentMessage.icon === 'warning' ? 'bg-amber-500/20' : 'bg-accent-gold/20'
          )}>
            {urgentMessage.icon === 'warning' ? (
              <AlertTriangle size={24} className="text-amber-400" />
            ) : (
              <Smartphone size={24} className="text-accent-gold" />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h3 className={cn(
              'text-sm font-medium truncate',
              urgentMessage.icon === 'warning' ? 'text-amber-300' : 'text-foreground-light'
            )}>
              {urgentMessage.title}
            </h3>
            <p className="text-xs text-foreground-muted mt-0.5 line-clamp-2">
              {urgentMessage.subtitle}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {isInstallable ? (
              <button
                onClick={handleInstall}
                className="px-4 py-2 bg-accent-gold text-background-dark rounded-xl text-sm font-medium hover:bg-accent-gold/90 transition-colors"
              >
                התקן
              </button>
            ) : (
              <button
                onClick={() => {/* Will be replaced by modal logic */}}
                className="px-3 py-2 bg-white/10 text-foreground-light rounded-xl text-sm font-medium hover:bg-white/20 transition-colors flex items-center gap-1"
              >
                <ChevronDown size={16} />
                איך?
              </button>
            )}
            
            <button
              onClick={handleClose}
              className="p-2 text-foreground-muted hover:text-foreground-light transition-colors"
              aria-label="סגור"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Full Modal with Instructions
  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center p-4',
        'transition-all duration-300',
        isClosing ? 'opacity-0 pointer-events-none' : 'opacity-100'
      )}
    >
      {/* Backdrop */}
      <div
        className={cn(
          'absolute inset-0 bg-black/60 backdrop-blur-sm',
          isClosing && 'pointer-events-none'
        )}
        onClick={handleClose}
      />

      {/* Modal */}
      <div
        className={cn(
          'relative w-full max-w-sm',
          'glass-elevated rounded-3xl',
          'p-6 text-center',
          'transform transition-all duration-300',
          isClosing ? 'scale-95 opacity-0' : 'scale-100 opacity-100',
          urgentMessage.icon === 'warning' && 'border-2 border-amber-500/50'
        )}
      >
        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute top-4 left-4 p-2 text-foreground-muted hover:text-foreground-light transition-colors rounded-full hover:bg-white/10 flex items-center justify-center"
          aria-label="סגור"
        >
          <X size={20} />
        </button>

        {/* Urgent Badge for repeat dismissers */}
        {dismissCount >= 2 && (
          <div className="absolute -top-3 right-4 px-3 py-1 rounded-full bg-amber-500 text-background-dark text-xs font-bold">
            חשוב!
          </div>
        )}

        {/* App Icon - changes based on urgency */}
        <div className={cn(
          'mx-auto w-20 h-20 rounded-2xl flex items-center justify-center mb-4',
          urgentMessage.icon === 'warning' ? 'bg-amber-500/20' : 'bg-accent-gold/20 shadow-gold'
        )}>
          {urgentMessage.icon === 'warning' ? (
            <UrgentIcon size={36} className="text-amber-400" />
          ) : urgentMessage.icon === 'heart' ? (
            <Heart size={36} className="text-pink-400" />
          ) : (
            <DeviceIcon size={36} className="text-accent-gold" />
          )}
        </div>

        {/* Title - use urgent message for repeat visitors */}
        <h2 className={cn(
          'text-xl font-bold mb-2',
          urgentMessage.icon === 'warning' ? 'text-amber-300' : 'text-foreground-light'
        )}>
          {dismissCount > 0 ? urgentMessage.title : instructions.title}
        </h2>

        <p className="text-foreground-muted text-sm mb-6">
          {dismissCount > 0 ? urgentMessage.subtitle : 'התקינו את האפליקציה למסך הבית לגישה מהירה, התראות על תורים ועוד'}
        </p>

        {/* Installation Steps */}
        <div className="text-right space-y-3 mb-6">
          {instructions.steps.map((step, index) => (
            <div key={index} className="flex items-start gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-accent-gold/20 text-accent-gold text-sm font-bold flex items-center justify-center">
                {index + 1}
              </div>
              <p className="text-foreground-light text-sm pt-0.5">{step}</p>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleClose}
            className={cn(
              'flex-1 py-3 px-4 rounded-xl font-medium transition-colors text-center',
              dismissCount >= 3 
                ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20 text-sm' 
                : 'bg-white/10 text-foreground-light hover:bg-white/20'
            )}
          >
            {dismissCount >= 3 ? 'אני מבין שאפספס התראות' : 'אולי אח״כ'}
          </button>
          
          {isInstallable && (
            <button
              onClick={handleInstall}
              className="flex-1 py-3 px-4 rounded-xl bg-accent-gold text-background-dark font-bold hover:bg-accent-gold/90 transition-colors flex items-center justify-center gap-2"
            >
              <Download size={18} />
              התקן עכשיו
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

