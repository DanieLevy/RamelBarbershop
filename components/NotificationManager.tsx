'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'

/**
 * Notification Manager
 * 
 * Coordinates the display of multiple notifications (cookie consent, PWA install, etc.)
 * to prevent overwhelming users with multiple prompts at once.
 * 
 * Priority queue:
 * 1. Cookie consent (legal requirement, shown first after delay)
 * 2. PWA install banner (shown only after cookie consent is handled)
 * 
 * Timing:
 * - Cookie notice: 10 seconds after page load (if not already accepted)
 * - PWA install: 5 seconds after cookie consent is handled
 * - If cookie was already accepted, PWA shows after 15 seconds
 */

type NotificationType = 'cookie' | 'pwa-install' | 'pwa-push-denied'

interface NotificationManagerContextType {
  // Current notification being shown (or null if none)
  activeNotification: NotificationType | null
  // Request to show a notification - will be queued if another is active
  requestNotification: (type: NotificationType) => void
  // Dismiss the current notification and show next in queue
  dismissNotification: (type: NotificationType) => void
  // Check if a specific notification type can be shown
  canShowNotification: (type: NotificationType) => boolean
}

const NotificationManagerContext = createContext<NotificationManagerContextType | null>(null)

export const useNotificationManager = () => {
  const context = useContext(NotificationManagerContext)
  if (!context) {
    // Return a default implementation for components used outside the provider
    return {
      activeNotification: null,
      requestNotification: () => {},
      dismissNotification: () => {},
      canShowNotification: () => true,
    }
  }
  return context
}

// Local storage keys
const COOKIE_CONSENT_KEY = 'cookie-consent-v2'

interface NotificationManagerProviderProps {
  children: ReactNode
}

export function NotificationManagerProvider({ children }: NotificationManagerProviderProps) {
  const [activeNotification, setActiveNotification] = useState<NotificationType | null>(null)
  const [queue, setQueue] = useState<NotificationType[]>([])
  const [isMounted, setIsMounted] = useState(false)

  // Check cookie consent status on mount
  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Process queue - show next notification when current is dismissed
  useEffect(() => {
    if (!isMounted) return
    
    if (activeNotification === null && queue.length > 0) {
      // Small delay between notifications for better UX
      const timer = setTimeout(() => {
        const next = queue[0]
        setQueue(prev => prev.slice(1))
        setActiveNotification(next)
      }, 500)
      
      return () => clearTimeout(timer)
    }
  }, [activeNotification, queue, isMounted])

  // Request to show a notification
  const requestNotification = useCallback((type: NotificationType) => {
    // Don't add duplicates
    if (activeNotification === type) return
    
    setQueue(prev => {
      if (prev.includes(type)) return prev
      return [...prev, type]
    })
    
    // If nothing is active, show immediately
    if (activeNotification === null) {
      setActiveNotification(type)
      setQueue(prev => prev.filter(t => t !== type))
    }
  }, [activeNotification])

  // Dismiss current notification
  const dismissNotification = useCallback((type: NotificationType) => {
    if (activeNotification === type) {
      setActiveNotification(null)
    }
    // Also remove from queue if present
    setQueue(prev => prev.filter(t => t !== type))
  }, [activeNotification])

  // Check if a notification can be shown
  const canShowNotification = useCallback((type: NotificationType) => {
    return activeNotification === type || activeNotification === null
  }, [activeNotification])

  const contextValue: NotificationManagerContextType = {
    activeNotification,
    requestNotification,
    dismissNotification,
    canShowNotification,
  }

  return (
    <NotificationManagerContext.Provider value={contextValue}>
      {children}
    </NotificationManagerContext.Provider>
  )
}

/**
 * Hook to get notification timing based on context
 * 
 * Returns the delay (in ms) before a notification should be requested
 */
export function useNotificationTiming(type: NotificationType): number {
  const [hasCookieConsent, setHasCookieConsent] = useState(true) // Assume true initially to delay check

  useEffect(() => {
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY)
    setHasCookieConsent(!!consent)
  }, [])

  switch (type) {
    case 'cookie':
      // Show cookie notice after 10 seconds (if not already accepted)
      return 10000
    case 'pwa-install':
      // If cookie consent already given, show after 8 seconds
      // Otherwise, it will be queued after cookie consent
      return hasCookieConsent ? 8000 : 15000
    case 'pwa-push-denied':
      // Show push denied banner after PWA install is handled
      return 20000
    default:
      return 5000
  }
}
