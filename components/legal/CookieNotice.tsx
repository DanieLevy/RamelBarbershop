'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Cookie, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const COOKIE_CONSENT_KEY = 'cookie-consent-accepted'

/**
 * Cookie Notice Banner
 * 
 * Displays a non-blocking cookie notice for essential cookies.
 * Persists user acceptance in localStorage.
 * 
 * Fixed: Button was unclickable on first load due to hydration timing.
 * Solution: Increased delay and ensured proper z-index stacking.
 */
export function CookieNotice() {
  const [isVisible, setIsVisible] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)
  const [isReady, setIsReady] = useState(false) // Ensure full hydration before showing

  useEffect(() => {
    // Mark as ready after hydration
    setIsReady(true)
    
    // Check if user has already accepted
    const hasAccepted = localStorage.getItem(COOKIE_CONSENT_KEY)
    if (!hasAccepted) {
      // Longer delay to ensure page is fully interactive
      // This fixes the button being unclickable on first load
      const timer = setTimeout(() => {
        setIsVisible(true)
      }, 2000) // Increased from 1000ms to 2000ms
      return () => clearTimeout(timer)
    }
  }, [])

  const handleAccept = useCallback(() => {
    setIsAnimating(true)
    localStorage.setItem(COOKIE_CONSENT_KEY, 'true')
    
    // Animate out
    setTimeout(() => {
      setIsVisible(false)
    }, 300)
  }, [])

  const handleDismiss = useCallback(() => {
    setIsAnimating(true)
    localStorage.setItem(COOKIE_CONSENT_KEY, 'true')
    
    setTimeout(() => {
      setIsVisible(false)
    }, 300)
  }, [])

  // Don't render until hydration is complete and visibility is set
  if (!isVisible || !isReady) return null

  return (
    <div
      className={cn(
        // Higher z-index to ensure it's above other elements
        'fixed bottom-24 md:bottom-6 left-4 right-4 z-[999]',
        'transition-all duration-300 ease-out',
        // Ensure pointer events work
        'pointer-events-auto',
        isAnimating ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'
      )}
      // Explicit style to ensure clickability
      style={{ touchAction: 'auto' }}
    >
      <div className="max-w-md mx-auto">
        <div className="relative bg-background-card/95 backdrop-blur-xl p-5 pt-8 rounded-2xl shadow-2xl border border-white/10 pointer-events-auto">
          {/* Close Button - Top Left (RTL) */}
          <button
            onClick={handleDismiss}
            className="absolute top-2 left-2 text-foreground-muted hover:text-foreground-light transition-colors p-1.5 rounded-full hover:bg-white/10 pointer-events-auto touch-manipulation"
            aria-label="סגור"
            type="button"
          >
            <X size={16} />
          </button>

          {/* Content - Centered using flexbox */}
          <div className="flex flex-col items-center text-center">
            {/* Icon */}
            <div className="w-12 h-12 rounded-full bg-accent-gold/20 flex items-center justify-center mb-3">
              <Cookie size={22} className="text-accent-gold" />
            </div>

            <h3 className="text-foreground-light font-medium text-sm mb-2">
              עוגיות חיוניות
            </h3>
            
            <p className="text-foreground-muted text-xs leading-relaxed mb-4 max-w-xs">
              האתר משתמש בעוגיות חיוניות בלבד לתפעול תקין של מערכת הזמנת התורים ושמירת העדפותיך.
              {' '}
              <Link 
                href="/privacy-policy" 
                className="text-accent-gold hover:underline"
              >
                למידע נוסף
              </Link>
            </p>

            {/* Button - centered via parent flexbox */}
            {/* Added explicit type, touch-manipulation, and pointer-events to fix first-load unclickable issue */}
            <button
              onClick={handleAccept}
              onTouchEnd={handleAccept}
              className="px-6 py-2.5 bg-accent-gold text-background-dark text-sm font-medium rounded-xl hover:bg-accent-gold/90 transition-colors pointer-events-auto touch-manipulation cursor-pointer select-none"
              type="button"
              role="button"
              tabIndex={0}
              aria-label="הבנתי והסכמה לעוגיות"
            >
              הבנתי
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
