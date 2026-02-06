'use client'

import { useState, useEffect, useCallback } from 'react'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { usePWA } from '@/hooks/usePWA'
import { useAuthStore } from '@/store/useAuthStore'
import { useBarberAuthStore } from '@/store/useBarberAuthStore'
import { cn } from '@/lib/utils'
import { BellOff, X, Settings, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@heroui/react'

const BANNER_DISMISSED_KEY = 'push_denied_banner_dismissed'
const BANNER_COOLDOWN_HOURS = 24 // Don't re-show for 24 hours after dismissal

/**
 * Banner that shows when push notifications are denied
 * Provides helpful instructions on how to enable them in device settings
 */
export function PushDeniedBanner() {
  const push = usePushNotifications()
  const pwa = usePWA()
  const { isLoggedIn: isCustomerLoggedIn, isInitialized: customerInitialized } = useAuthStore()
  const { isLoggedIn: isBarberLoggedIn, isInitialized: barberInitialized } = useBarberAuthStore()
  
  const [isVisible, setIsVisible] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [showInstructions, setShowInstructions] = useState(false)
  const [isRetrying, setIsRetrying] = useState(false)

  const isLoggedIn = isCustomerLoggedIn || isBarberLoggedIn
  const isInitialized = customerInitialized && barberInitialized

  // Check if we should show the banner
  useEffect(() => {
    if (!isInitialized || push.isLoading) return

    // Only show in PWA standalone mode (user installed the app)
    if (!pwa.isStandalone) return

    // Only show if user is logged in
    if (!isLoggedIn) return

    // Only show if permission is denied
    if (push.permission !== 'denied') return

    // Check if user dismissed recently
    const dismissedUntil = localStorage.getItem(BANNER_DISMISSED_KEY)
    if (dismissedUntil && Date.now() < parseInt(dismissedUntil, 10)) {
      return
    }

    // Show banner with small delay for better UX
    const timer = setTimeout(() => {
      setIsVisible(true)
    }, 1500)

    return () => clearTimeout(timer)
  }, [isInitialized, push.isLoading, push.permission, pwa.isStandalone, isLoggedIn])

  const handleDismiss = useCallback(() => {
    // Dismiss for 24 hours
    const dismissUntil = Date.now() + BANNER_COOLDOWN_HOURS * 60 * 60 * 1000
    localStorage.setItem(BANNER_DISMISSED_KEY, String(dismissUntil))
    
    setIsClosing(true)
    setTimeout(() => {
      setIsVisible(false)
      setIsClosing(false)
    }, 300)
  }, [])

  const handleRetry = useCallback(async () => {
    setIsRetrying(true)
    
    // Try to request permission again
    // Some browsers allow re-requesting after settings change
    const permission = await push.requestPermission()
    
    if (permission === 'granted') {
      // User enabled in settings! Subscribe silently
      const success = await push.subscribe()
      if (success) {
        handleDismiss()
      }
    }
    
    setIsRetrying(false)
  }, [push, handleDismiss])

  // Get platform-specific instructions
  const getInstructions = useCallback(() => {
    const deviceOS = pwa.deviceOS
    
    if (deviceOS === 'ios') {
      return {
        title: 'איך להפעיל התראות באייפון',
        steps: [
          'פתחו את "הגדרות" במכשיר',
          'גללו למטה ובחרו "התראות"',
          'מצאו את "רם אל ברברשופ"',
          'הפעילו "אפשר התראות"',
          'חזרו לאפליקציה ולחצו "נסה שוב"'
        ]
      }
    }
    
    if (deviceOS === 'android') {
      return {
        title: 'איך להפעיל התראות באנדרואיד',
        steps: [
          'לחצו על 🔒 שליד שורת הכתובת',
          'או פתחו "הגדרות" > "אפליקציות"',
          'מצאו את "רם אל ברברשופ"',
          'לחצו על "התראות" והפעילו',
          'חזרו לאפליקציה ולחצו "נסה שוב"'
        ]
      }
    }
    
    // Desktop
    return {
      title: 'איך להפעיל התראות',
      steps: [
        'לחצו על 🔒 שליד שורת הכתובת',
        'מצאו "התראות" או "Notifications"',
        'שנו מ"חסום" ל"אפשר"',
        'רעננו את הדף ולחצו "נסה שוב"'
      ]
    }
  }, [pwa.deviceOS])

  if (!isVisible) return null

  const instructions = getInstructions()

  return (
    <div
      className={cn(
        'fixed bottom-20 md:bottom-4 left-4 right-4 z-50',
        'transition-all duration-300 ease-out',
        isClosing ? 'translate-y-full opacity-0' : 'translate-y-0 opacity-100'
      )}
    >
      <div className="mx-auto max-w-md glass-elevated rounded-2xl border border-amber-500/30 overflow-hidden">
        {/* Main Banner */}
        <div className="p-4 flex items-center gap-4">
          {/* Icon */}
          <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
            <BellOff size={24} className="text-amber-400" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-amber-300 truncate">
              התראות חסומות
            </h3>
            <p className="text-xs text-foreground-muted mt-0.5">
              לא תקבלו תזכורות על תורים
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onPress={() => setShowInstructions(!showInstructions)}
              aria-expanded={showInstructions}
              aria-label="הצג הוראות להפעלת התראות"
              className="bg-amber-500/20 text-amber-300 hover:bg-amber-500/30"
            >
              <Settings size={16} />
              <span className="hidden sm:inline">הפעל</span>
              {showInstructions ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </Button>
            
            <Button
              variant="ghost"
              isIconOnly
              onPress={handleDismiss}
              aria-label="סגור"
            >
              <X size={18} />
            </Button>
          </div>
        </div>

        {/* Expandable Instructions */}
        <div
          className={cn(
            'overflow-hidden transition-all duration-300',
            showInstructions ? 'max-h-[400px] opacity-100' : 'max-h-0 opacity-0'
          )}
        >
          <div className="px-4 pb-4 pt-2 border-t border-white/10">
            <h4 className="text-sm font-medium text-foreground-light mb-3">
              {instructions.title}
            </h4>
            
            <ol className="space-y-2 mb-4">
              {instructions.steps.map((step, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-foreground-muted">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-accent-gold/20 text-accent-gold text-xs font-bold flex items-center justify-center mt-0.5">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>

            {/* Retry Button */}
            <Button
              variant="primary"
              onPress={handleRetry}
              isDisabled={isRetrying}
              className="w-full"
            >
              {isRetrying ? (
                <>
                  <div className="w-4 h-4 border-2 border-background-dark/30 border-t-background-dark rounded-full animate-spin" />
                  <span>בודק...</span>
                </>
              ) : (
                <>
                  <RefreshCw size={16} />
                  <span>נסה שוב</span>
                </>
              )}
            </Button>

            <p className="text-xs text-foreground-muted text-center mt-3">
              לאחר שינוי ההגדרות, לחצו &quot;נסה שוב&quot;
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
