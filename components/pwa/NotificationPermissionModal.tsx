'use client'

import { useState, useEffect } from 'react'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { usePWA } from '@/hooks/usePWA'
import { useAuthStore } from '@/store/useAuthStore'
import { useBarberAuthStore } from '@/store/useBarberAuthStore'
import { cn } from '@/lib/utils'
import { Bell, X, Smartphone, AlertCircle } from 'lucide-react'

const MODAL_DISMISSED_KEY = 'notification_modal_dismissed'
const MODAL_SHOW_DELAY = 3000 // 3 seconds after PWA loads

/**
 * Modal that prompts PWA users to enable push notifications
 * Only shows when:
 * - User is in PWA standalone mode
 * - User is logged in (customer or barber)
 * - Notifications are supported but not yet subscribed
 * - User hasn't dismissed the modal recently
 */
export function NotificationPermissionModal() {
  const push = usePushNotifications()
  const pwa = usePWA()
  const { isLoggedIn: isCustomerLoggedIn, isInitialized: customerInitialized } = useAuthStore()
  const { isLoggedIn: isBarberLoggedIn, isInitialized: barberInitialized } = useBarberAuthStore()
  
  const [isVisible, setIsVisible] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [isEnabling, setIsEnabling] = useState(false)

  const isLoggedIn = isCustomerLoggedIn || isBarberLoggedIn
  const isInitialized = customerInitialized && barberInitialized

  // Check if we should show the modal
  useEffect(() => {
    if (!isInitialized || push.isLoading) return

    // Only show in PWA standalone mode
    if (!pwa.isStandalone) return

    // Only show if user is logged in
    if (!isLoggedIn) return

    // Only show if push is supported
    if (!push.isSupported) return

    // Don't show if already subscribed
    if (push.isSubscribed) return

    // Don't show if permission was denied
    if (push.permission === 'denied') return

    // Check if user dismissed recently (24 hours)
    const dismissedUntil = localStorage.getItem(MODAL_DISMISSED_KEY)
    if (dismissedUntil && Date.now() < parseInt(dismissedUntil, 10)) {
      return
    }

    // Show modal after delay
    const timer = setTimeout(() => {
      setIsVisible(true)
    }, MODAL_SHOW_DELAY)

    return () => clearTimeout(timer)
  }, [isInitialized, push.isLoading, push.isSupported, push.isSubscribed, push.permission, pwa.isStandalone, isLoggedIn])

  const handleDismiss = () => {
    // Dismiss for 24 hours
    const dismissUntil = Date.now() + 24 * 60 * 60 * 1000
    localStorage.setItem(MODAL_DISMISSED_KEY, String(dismissUntil))
    
    setIsClosing(true)
    setTimeout(() => {
      setIsVisible(false)
      setIsClosing(false)
    }, 300)
  }

  const handleEnable = async () => {
    setIsEnabling(true)
    
    const success = await push.subscribe()
    
    if (success) {
      setIsClosing(true)
      setTimeout(() => {
        setIsVisible(false)
        setIsClosing(false)
      }, 300)
    }
    
    setIsEnabling(false)
  }

  if (!isVisible) return null

  return (
    <div
      className={cn(
        'fixed inset-0 z-[60] flex items-center justify-center p-4',
        'transition-all duration-300',
        isClosing ? 'opacity-0' : 'opacity-100'
      )}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={handleDismiss}
      />

      {/* Modal */}
      <div
        className={cn(
          'relative w-full max-w-sm',
          'glass-elevated rounded-3xl',
          'p-6 text-center',
          'transform transition-all duration-300',
          isClosing ? 'scale-95 opacity-0' : 'scale-100 opacity-100'
        )}
      >
        {/* Close Button */}
        <button
          onClick={handleDismiss}
          className="absolute top-4 left-4 p-2 text-foreground-muted hover:text-foreground-light transition-colors rounded-full hover:bg-white/10"
          aria-label="סגור"
        >
          <X size={20} />
        </button>

        {/* Icon */}
        <div className="mx-auto w-20 h-20 rounded-2xl bg-accent-gold/20 flex items-center justify-center mb-4 shadow-gold relative">
          <Bell size={36} className="text-accent-gold" />
          <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center animate-pulse">
            <span className="text-white text-xs font-bold">!</span>
          </div>
        </div>

        {/* Title */}
        <h2 className="text-xl font-bold text-foreground-light mb-2">
          הפעילו התראות
        </h2>

        <p className="text-foreground-muted text-sm mb-6 leading-relaxed">
          קבלו תזכורות על תורים קרובים, עדכונים על שינויים ועוד.
          <br />
          <span className="text-accent-gold">לא נשלח ספאם - רק מידע חשוב!</span>
        </p>

        {/* Benefits */}
        <div className="text-right space-y-2 mb-6 bg-white/5 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
              <span className="text-green-400">✓</span>
            </div>
            <p className="text-foreground-light text-sm">תזכורת לפני התור שלך</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
              <span className="text-green-400">✓</span>
            </div>
            <p className="text-foreground-light text-sm">עדכון אם יש שינוי בתור</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
              <span className="text-green-400">✓</span>
            </div>
            <p className="text-foreground-light text-sm">מבצעים והטבות מיוחדות</p>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <button
            onClick={handleEnable}
            disabled={isEnabling}
            className={cn(
              'w-full py-3.5 px-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2',
              isEnabling
                ? 'bg-accent-gold/50 text-background-dark cursor-not-allowed'
                : 'bg-accent-gold text-background-dark hover:bg-accent-gold/90'
            )}
          >
            {isEnabling ? (
              <>
                <div className="w-5 h-5 border-2 border-background-dark/30 border-t-background-dark rounded-full animate-spin" />
                <span>מפעיל...</span>
              </>
            ) : (
              <>
                <Bell size={18} />
                <span>הפעל התראות</span>
              </>
            )}
          </button>
          
          <button
            onClick={handleDismiss}
            className="w-full py-3 px-4 rounded-xl font-medium bg-white/10 text-foreground-light hover:bg-white/20 transition-colors"
          >
            אולי אח&quot;כ
          </button>
        </div>

        {/* iOS Note */}
        {pwa.deviceOS === 'ios' && (
          <p className="mt-4 text-xs text-foreground-muted flex items-center justify-center gap-1">
            <Smartphone size={12} />
            <span>נדרשת הרשאה מהמכשיר</span>
          </p>
        )}
      </div>
    </div>
  )
}

