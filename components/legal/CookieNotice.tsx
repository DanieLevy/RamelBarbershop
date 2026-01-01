'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Cookie, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const COOKIE_CONSENT_KEY = 'cookie-consent-accepted'

/**
 * Cookie Notice Banner
 * 
 * Displays a non-blocking cookie notice for essential cookies.
 * Persists user acceptance in localStorage.
 */
export function CookieNotice() {
  const [isVisible, setIsVisible] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)

  useEffect(() => {
    // Check if user has already accepted
    const hasAccepted = localStorage.getItem(COOKIE_CONSENT_KEY)
    if (!hasAccepted) {
      // Small delay for smoother page load
      const timer = setTimeout(() => {
        setIsVisible(true)
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [])

  const handleAccept = () => {
    setIsAnimating(true)
    localStorage.setItem(COOKIE_CONSENT_KEY, 'true')
    
    // Animate out
    setTimeout(() => {
      setIsVisible(false)
    }, 300)
  }

  const handleDismiss = () => {
    setIsAnimating(true)
    localStorage.setItem(COOKIE_CONSENT_KEY, 'true')
    
    setTimeout(() => {
      setIsVisible(false)
    }, 300)
  }

  if (!isVisible) return null

  return (
    <div
      className={cn(
        'fixed bottom-24 md:bottom-6 left-4 right-4 z-50',
        'transition-all duration-300 ease-out',
        isAnimating ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'
      )}
    >
      <div className="max-w-md mx-auto">
        <div className="relative bg-background-card/95 backdrop-blur-xl p-5 pt-8 rounded-2xl shadow-2xl border border-white/10">
          {/* Close Button - Top Left (RTL) */}
          <button
            onClick={handleDismiss}
            className="absolute top-2 left-2 text-foreground-muted hover:text-foreground-light transition-colors p-1.5 rounded-full hover:bg-white/10"
            aria-label="סגור"
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
            <button
              onClick={handleAccept}
              className="px-6 py-2.5 bg-accent-gold text-background-dark text-sm font-medium rounded-xl hover:bg-accent-gold/90 transition-colors"
            >
              הבנתי
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
