'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Cookie, X, Shield } from 'lucide-react'
import { cn } from '@/lib/utils'

const COOKIE_CONSENT_KEY = 'cookie-consent-v2'

type ConsentLevel = 'all' | 'essential' | null

/**
 * Cookie Notice Banner (Amendment 13 Compliant)
 * 
 * Per Israeli Privacy Protection Law Amendment 13 (August 2025):
 * - Users must be able to accept all cookies OR essential only
 * - Clear explanation of what cookies are used
 * - Link to privacy policy with full cookie details
 * 
 * Persists user choice in localStorage.
 */
export function CookieNotice() {
  const [isVisible, setIsVisible] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    setIsReady(true)
    
    // Check if user has already made a choice
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY)
    if (!consent) {
      // Show banner after page is interactive
      const timer = setTimeout(() => {
        setIsVisible(true)
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [])

  const handleConsent = useCallback((level: ConsentLevel) => {
    setIsAnimating(true)
    localStorage.setItem(COOKIE_CONSENT_KEY, level || 'essential')
    
    // Animate out
    setTimeout(() => {
      setIsVisible(false)
    }, 300)
  }, [])

  const handleDismiss = useCallback(() => {
    // Dismissing = accepting essential only (per Amendment 13 - no implicit consent)
    handleConsent('essential')
  }, [handleConsent])

  if (!isVisible || !isReady) return null

  return (
    <div
      className={cn(
        'fixed bottom-24 md:bottom-6 left-4 right-4 z-[999]',
        'transition-all duration-300 ease-out',
        'pointer-events-auto',
        isAnimating ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'
      )}
      style={{ touchAction: 'auto' }}
      role="dialog"
      aria-labelledby="cookie-title"
      aria-describedby="cookie-description"
    >
      <div className="max-w-lg mx-auto">
        <div className="relative bg-background-card/95 backdrop-blur-xl p-5 rounded-2xl shadow-2xl border border-white/10 pointer-events-auto">
          {/* Close Button */}
          <button
            onClick={handleDismiss}
            className="absolute top-3 left-3 text-foreground-muted hover:text-foreground-light transition-colors p-1.5 rounded-full hover:bg-white/10 pointer-events-auto touch-manipulation"
            aria-label="סגור (יאשר עוגיות חיוניות בלבד)"
            type="button"
          >
            <X size={16} />
          </button>

          {/* Content */}
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Icon & Text */}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-accent-gold/20 flex items-center justify-center shrink-0">
                  <Cookie size={20} className="text-accent-gold" />
                </div>
                <h3 id="cookie-title" className="text-foreground-light font-medium">
                  הגדרות פרטיות ועוגיות
                </h3>
              </div>
              
              <p id="cookie-description" className="text-foreground-muted text-sm leading-relaxed mb-3">
                אנו משתמשים בעוגיות חיוניות לתפעול האתר. באפשרותך לאשר עוגיות נוספות 
                לשיפור חוויית השימוש, או להמשיך עם עוגיות חיוניות בלבד.
                {' '}
                <Link 
                  href="/privacy-policy#cookies" 
                  className="text-accent-gold hover:underline"
                >
                  מדיניות פרטיות מלאה
                </Link>
              </p>

              {/* Cookie Types Info */}
              <div className="flex flex-wrap gap-2 mb-4 text-xs">
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-500/10 text-green-400 rounded-full">
                  <Shield size={12} />
                  חיוניות (תמיד פעילות)
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-white/5 text-foreground-muted rounded-full">
                  פונקציונליות (אופציונלי)
                </span>
              </div>
            </div>
          </div>

          {/* Buttons - Amendment 13 requires both options */}
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={() => handleConsent('all')}
              onTouchEnd={() => handleConsent('all')}
              className="flex-1 flex justify-center items-center px-4 py-2.5 bg-accent-gold text-background-dark text-sm font-medium rounded-xl hover:bg-accent-gold/90 transition-colors pointer-events-auto touch-manipulation cursor-pointer text-center"
              type="button"
            >
              אישור כל העוגיות
            </button>
            <button
              onClick={() => handleConsent('essential')}
              onTouchEnd={() => handleConsent('essential')}
              className="flex-1 flex justify-center items-center px-4 py-2.5 bg-white/5 text-foreground-light text-sm font-medium rounded-xl hover:bg-white/10 transition-colors border border-white/10 pointer-events-auto touch-manipulation cursor-pointer text-center"
              type="button"
            >
              חיוניות בלבד
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
