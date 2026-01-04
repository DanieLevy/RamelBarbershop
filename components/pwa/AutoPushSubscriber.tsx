'use client'

import { useEffect, useRef, useState } from 'react'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { usePWA } from '@/hooks/usePWA'
import { useAuthStore } from '@/store/useAuthStore'
import { useBarberAuthStore } from '@/store/useBarberAuthStore'

const AUTO_SUBSCRIBE_KEY = 'auto_push_subscribe_attempted'
const PWA_INSTALLED_KEY = 'pwa_installed_timestamp'

/**
 * Auto Push Subscriber - Invisible component
 * 
 * After PWA installation, this component automatically:
 * 1. Triggers the native OS permission dialog (not a custom modal)
 * 2. If granted - silently registers the device for push notifications
 * 3. If denied - does nothing (PushDeniedBanner handles that)
 * 
 * This provides a frictionless, modern UX where users see only
 * the native OS permission prompt instead of multiple modals.
 */
export function AutoPushSubscriber() {
  const push = usePushNotifications()
  const pwa = usePWA()
  const { isLoggedIn: isCustomerLoggedIn, isInitialized: customerInitialized } = useAuthStore()
  const { isLoggedIn: isBarberLoggedIn, isInitialized: barberInitialized } = useBarberAuthStore()
  
  const [hasAttempted, setHasAttempted] = useState(false)
  const attemptingRef = useRef(false)

  const isLoggedIn = isCustomerLoggedIn || isBarberLoggedIn
  const isInitialized = customerInitialized && barberInitialized

  // Detect if this is a fresh PWA installation
  useEffect(() => {
    if (pwa.isStandalone) {
      const installedTimestamp = localStorage.getItem(PWA_INSTALLED_KEY)
      if (!installedTimestamp) {
        // First time detecting standalone mode - mark installation time
        localStorage.setItem(PWA_INSTALLED_KEY, String(Date.now()))
      }
    }
  }, [pwa.isStandalone])

  // Auto-subscribe logic
  useEffect(() => {
    const autoSubscribe = async () => {
      // Guards - prevent multiple attempts
      if (attemptingRef.current) return
      if (hasAttempted) return
      if (!isInitialized || push.isLoading) return

      // Only in PWA standalone mode
      if (!pwa.isStandalone) return

      // Only if user is logged in
      if (!isLoggedIn) return

      // Only if push is supported
      if (!push.isSupported) return

      // Don't auto-subscribe if already subscribed
      if (push.isSubscribed) return

      // Don't auto-subscribe if permission was already denied (user made their choice)
      if (push.permission === 'denied') return

      // Check if we already attempted auto-subscription for this session
      const attemptedKey = `${AUTO_SUBSCRIBE_KEY}_${isCustomerLoggedIn ? 'customer' : 'barber'}`
      const alreadyAttempted = sessionStorage.getItem(attemptedKey)
      if (alreadyAttempted) return

      // Check installation timestamp - only auto-prompt within first 5 minutes of install
      // or if user just logged in to the PWA
      const installedTimestamp = localStorage.getItem(PWA_INSTALLED_KEY)
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
      const isRecentInstall = installedTimestamp && parseInt(installedTimestamp, 10) > fiveMinutesAgo

      // Also auto-prompt if permission is 'default' (never asked) and user is in PWA
      const shouldAutoPrompt = isRecentInstall || push.permission === 'default'

      if (!shouldAutoPrompt) return

      // Mark as attempting
      attemptingRef.current = true
      setHasAttempted(true)
      sessionStorage.setItem(attemptedKey, 'true')

      // Small delay for better UX - let the app settle first
      await new Promise(resolve => setTimeout(resolve, 2000))

      try {
        // This will trigger the native OS permission dialog
        // No custom modal - just the native prompt!
        const success = await push.subscribe()
        
        if (success) {
          console.log('[AutoPush] Successfully auto-subscribed to push notifications')
        } else {
          console.log('[AutoPush] Auto-subscription failed or was denied')
        }
      } catch (error) {
        console.error('[AutoPush] Error during auto-subscription:', error)
      } finally {
        attemptingRef.current = false
      }
    }

    autoSubscribe()
    // NOTE: We intentionally use specific push properties instead of the whole push object
    // to prevent unnecessary re-renders and infinite loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isInitialized,
    push.isLoading,
    push.isSupported,
    push.isSubscribed,
    push.permission,
    push.subscribe,
    pwa.isStandalone,
    isLoggedIn,
    isCustomerLoggedIn,
    hasAttempted
  ])

  // This component renders nothing - it's purely for side effects
  return null
}
