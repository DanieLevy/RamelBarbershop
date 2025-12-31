'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useAuthStore } from '@/store/useAuthStore'
import { useBarberAuthStore } from '@/store/useBarberAuthStore'
import { setAppBadge } from './usePushNotifications'

/**
 * Badge Manager Hook
 * 
 * Manages the PWA app badge by:
 * 1. Clearing the badge when the user opens/focuses the app
 * 2. Marking all notifications as read on the server
 * 
 * This ensures users don't see stale badge counts after viewing the app.
 */
export const useBadgeManager = () => {
  const { customer, isLoggedIn: isCustomerLoggedIn } = useAuthStore()
  const { barber, isLoggedIn: isBarberLoggedIn } = useBarberAuthStore()
  
  const hasInitializedRef = useRef(false)
  const lastClearTimeRef = useRef(0)
  
  // Minimum time between badge clears to prevent excessive API calls
  const CLEAR_COOLDOWN_MS = 5000

  /**
   * Clear badge and mark notifications as read
   */
  const clearBadgeAndMarkRead = useCallback(async () => {
    // Determine user type
    const isCustomer = isCustomerLoggedIn && customer?.id
    const isBarber = isBarberLoggedIn && barber?.id

    if (!isCustomer && !isBarber) {
      // Not logged in, just clear local badge
      await setAppBadge(0)
      return
    }

    // Enforce cooldown to prevent excessive API calls
    const now = Date.now()
    if (now - lastClearTimeRef.current < CLEAR_COOLDOWN_MS) {
      return
    }
    lastClearTimeRef.current = now

    try {
      // Clear the app badge immediately
      await setAppBadge(0)

      // Mark notifications as read on the server
      const response = await fetch('/api/push/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: isCustomer ? customer!.id : undefined,
          barberId: isBarber ? barber!.id : undefined
        })
      })

      if (!response.ok) {
        console.warn('[BadgeManager] Failed to mark notifications as read')
      }
    } catch (error) {
      console.error('[BadgeManager] Error clearing badge:', error)
    }
  }, [isCustomerLoggedIn, isBarberLoggedIn, customer, barber])

  /**
   * Handle visibility change
   */
  const handleVisibilityChange = useCallback(() => {
    if (document.visibilityState === 'visible') {
      clearBadgeAndMarkRead()
    }
  }, [clearBadgeAndMarkRead])

  /**
   * Handle window focus
   */
  const handleFocus = useCallback(() => {
    clearBadgeAndMarkRead()
  }, [clearBadgeAndMarkRead])

  useEffect(() => {
    // Prevent multiple initializations
    if (hasInitializedRef.current) return
    hasInitializedRef.current = true

    // Clear badge on initial load (user opened the app)
    if (document.visibilityState === 'visible') {
      clearBadgeAndMarkRead()
    }

    // Listen for visibility changes (app coming to foreground)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    // Listen for window focus (user clicked on app)
    window.addEventListener('focus', handleFocus)

    // Listen for service worker messages (notification clicked)
    const handleSwMessage = (event: MessageEvent) => {
      if (event.data?.type === 'NOTIFICATION_CLICKED') {
        clearBadgeAndMarkRead()
      }
    }
    navigator.serviceWorker?.addEventListener('message', handleSwMessage)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
      navigator.serviceWorker?.removeEventListener('message', handleSwMessage)
    }
  }, [handleVisibilityChange, handleFocus, clearBadgeAndMarkRead])

  return {
    clearBadgeAndMarkRead
  }
}
