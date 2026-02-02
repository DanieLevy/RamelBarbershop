'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Cookie, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useNotificationManager, useNotificationTiming } from '@/components/NotificationManager'

const COOKIE_CONSENT_KEY = 'cookie-consent-v2'
// Delay before showing cookie banner (15 seconds)
const COOKIE_BANNER_DELAY = 15000

type ConsentLevel = 'all' | 'essential' | null

/**
 * Cookie Notice Banner (Amendment 13 Compliant)
 * 
 * Per Israeli Privacy Protection Law Amendment 13 (August 2025):
 * - Users must be able to accept all cookies OR essential only
 * - Clear explanation of what cookies are used
 * - Link to privacy policy with full cookie details
 * 
 * Design: Minimal bottom banner that doesn't interrupt UX
 * - Shows after 15 seconds delay
 * - Never shows if PWA install prompt is visible
 * - Compact single-line design on mobile
 * 
 * Persists user choice in localStorage.
 * Uses NotificationManager to coordinate with other notifications.
 */
export function CookieNotice() {
  const [isVisible, setIsVisible] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)
  const [isReady, setIsReady] = useState(false)
  
  const { requestNotification, dismissNotification, canShowNotification, activeNotification } = useNotificationManager()
  const delay = useNotificationTiming('cookie')

  useEffect(() => {
    setIsReady(true)
    
    // Check if user has already made a choice
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY)
    if (!consent) {
      // Request to show cookie notice after extended delay (15s minimum, coordinated with manager)
      const actualDelay = Math.max(delay, COOKIE_BANNER_DELAY)
      const timer = setTimeout(() => {
        requestNotification('cookie')
      }, actualDelay)
      return () => clearTimeout(timer)
    }
  }, [delay, requestNotification])
  
  // Show/hide based on notification manager
  // IMPORTANT: Never show if PWA install prompt is visible
  useEffect(() => {
    const canShow = canShowNotification('cookie')
    const pwaNotShowing = activeNotification !== 'pwa-install'
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY)
    
    if (canShow && pwaNotShowing && !consent && isReady) {
      setIsVisible(true)
    } else if (activeNotification === 'pwa-install') {
      // Hide if PWA install becomes visible
      setIsVisible(false)
    }
  }, [canShowNotification, activeNotification, isReady])

  const handleConsent = useCallback((level: ConsentLevel) => {
    setIsAnimating(true)
    localStorage.setItem(COOKIE_CONSENT_KEY, level || 'essential')
    
    // Animate out and notify manager
    setTimeout(() => {
      setIsVisible(false)
      dismissNotification('cookie')
    }, 200)
  }, [dismissNotification])

  const handleDismiss = useCallback(() => {
    // Dismissing = accepting essential only (per Amendment 13 - no implicit consent)
    handleConsent('essential')
  }, [handleConsent])

  if (!isVisible || !isReady) return null

  return (
    <div
      className={cn(
        'fixed bottom-0 left-0 right-0 z-[998]',
        'transition-all duration-200 ease-out',
        'pointer-events-auto',
        'pb-safe', // Safe area for iOS home indicator
        isAnimating ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'
      )}
      role="dialog"
      aria-labelledby="cookie-title"
    >
      {/* Compact Banner */}
      <div className="bg-background-darker/95 backdrop-blur-md border-t border-white/10 px-4 py-3">
        <div className="max-w-xl mx-auto flex items-center gap-3">
          {/* Icon */}
          <div className="w-8 h-8 rounded-full bg-accent-gold/20 flex items-center justify-center shrink-0">
            <Cookie size={16} className="text-accent-gold" />
          </div>

          {/* Text */}
          <p id="cookie-title" className="flex-1 text-foreground-muted text-xs sm:text-sm leading-snug">
            אנו משתמשים בעוגיות.{' '}
            <Link 
              href="/privacy-policy#cookies" 
              className="text-accent-gold hover:underline"
            >
              מדיניות פרטיות
            </Link>
          </p>

          {/* Buttons - Compact */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => handleConsent('all')}
              className="px-3 py-1.5 bg-accent-gold text-background-dark text-xs font-medium rounded-lg hover:bg-accent-gold/90 transition-colors"
              type="button"
            >
              אישור
            </button>
            <button
              onClick={handleDismiss}
              className="p-1.5 text-foreground-muted hover:text-foreground-light transition-colors rounded-lg hover:bg-white/10"
              aria-label="סגור"
              type="button"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Get current cookie consent level
 * Can be used by other components to check consent status
 */
export function getCookieConsent(): ConsentLevel {
  if (typeof window === 'undefined') return null
  const consent = localStorage.getItem(COOKIE_CONSENT_KEY)
  if (consent === 'all' || consent === 'essential') return consent
  return null
}

/**
 * Check if user has given full cookie consent
 */
export function hasFullCookieConsent(): boolean {
  return getCookieConsent() === 'all'
}
