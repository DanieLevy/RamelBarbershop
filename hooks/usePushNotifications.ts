'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuthStore } from '@/store/useAuthStore'
import { useBarberAuthStore } from '@/store/useBarberAuthStore'
import { usePushStore } from '@/store/usePushStore'
import { usePWA } from './usePWA'
import { useBugReporter } from './useBugReporter'
import type { DeviceInfo, DeviceType } from '@/lib/push/types'

// Module-level API call guards
let globalFetchInProgress = false
let globalLastFetchTime = 0
const FETCH_COOLDOWN_MS = 5000

interface PushNotificationState {
  isSupported: boolean
  permission: NotificationPermission | 'unavailable'
  isSubscribed: boolean
  isLoading: boolean
  error: string | null
  devices: DeviceInfo[]
  pwaInstalled: boolean
  notificationsEnabled: boolean
}

interface UsePushNotificationsReturn extends PushNotificationState {
  requestPermission: () => Promise<NotificationPermission | 'unavailable'>
  subscribe: () => Promise<boolean>
  unsubscribe: () => Promise<boolean>
  removeDevice: (deviceId: string) => Promise<boolean>
  refreshStatus: () => Promise<void>
  isIOS: boolean
  requiresPWA: boolean
}

const urlBase64ToUint8Array = (base64String: string): ArrayBuffer => {
  const base64 = base64String.trim()
  const padding = '='.repeat((4 - base64.length % 4) % 4)
  const base64Padded = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64Padded)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray.buffer
}

export const setAppBadge = async (count: number): Promise<boolean> => {
  if (!('setAppBadge' in navigator)) return false
  
  try {
    if (count > 0) {
      await navigator.setAppBadge(count)
    } else {
      await navigator.clearAppBadge()
    }
    return true
  } catch {
    return false
  }
}

export const usePushNotifications = (): UsePushNotificationsReturn => {
  const { customer, isLoggedIn: isCustomerLoggedIn } = useAuthStore()
  const { barber, isLoggedIn: isBarberLoggedIn } = useBarberAuthStore()
  const { isStandalone, deviceOS } = usePWA()
  const { report } = useBugReporter('PushNotifications')
  
  const setStoreSupported = usePushStore(state => state.setSupported)
  const setStorePermission = usePushStore(state => state.setPermission)
  const setStoreSubscribed = usePushStore(state => state.setSubscribed)
  
  const hasInitializedRef = useRef(false)
  
  const [state, setState] = useState<PushNotificationState>({
    isSupported: false,
    permission: 'unavailable',
    isSubscribed: false,
    isLoading: true,
    error: null,
    devices: [],
    pwaInstalled: false,
    notificationsEnabled: false
  })

  const isIOS = deviceOS === 'ios'
  const requiresPWA = isIOS // iOS requires PWA for push

  /**
   * Safely check if the Notification API is available.
   * On some iOS Safari versions, 'Notification' in window may be true
   * but accessing Notification itself throws a ReferenceError.
   */
  const getNotificationPermission = useCallback((): NotificationPermission | 'unavailable' => {
    try {
      if (typeof window !== 'undefined' && 'Notification' in window && typeof Notification !== 'undefined') {
        return Notification.permission
      }
    } catch {
      // iOS Safari can throw ReferenceError: Can't find variable: Notification
    }
    return 'unavailable'
  }, [])

  /**
   * Check if push notifications are supported
   */
  const checkSupport = useCallback((): boolean => {
    if (typeof window === 'undefined') return false
    
    try {
      return (
        'serviceWorker' in navigator &&
        'PushManager' in window &&
        typeof Notification !== 'undefined'
      )
    } catch {
      // iOS Safari can throw ReferenceError when accessing Notification
      return false
    }
  }, [])

  /**
   * Get current subscription from service worker
   */
  const getCurrentSubscription = useCallback(async (): Promise<PushSubscription | null> => {
    if (!checkSupport()) return null
    
    try {
      const registration = await navigator.serviceWorker.ready
      return await registration.pushManager.getSubscription()
    } catch {
      return null
    }
  }, [checkSupport])

  /**
   * Fetch status from server.
   * NOTE: This function should NOT be in useEffect dependencies to prevent infinite loops.
   * It uses refs to access current auth state instead of depending on auth values directly.
   */
  const fetchServerStatus = useCallback(async () => {
    // Get current auth state from stores directly (not from hook closure)
    // This avoids the callback being recreated when auth state changes
    const authState = useAuthStore.getState()
    const barberAuthState = useBarberAuthStore.getState()
    
    const isCustomer = authState.isLoggedIn && authState.customer?.id
    const isBarber = barberAuthState.isLoggedIn && barberAuthState.barber?.id
    
    const userId = isCustomer ? authState.customer?.id : isBarber ? barberAuthState.barber?.id : null
    if (!userId) return

    // Prevent concurrent fetches and enforce cooldown period
    const now = Date.now()
    if (globalFetchInProgress || (now - globalLastFetchTime) < FETCH_COOLDOWN_MS) {
      return
    }

    globalFetchInProgress = true
    globalLastFetchTime = now

    try {
      const param = isCustomer ? 'customerId' : 'barberId'
      const response = await fetch(`/api/push/status?${param}=${userId}`)
      const data = await response.json()

      if (data.success) {
        setState(prev => ({
          ...prev,
          devices: data.devices || [],
          isSubscribed: data.isSubscribed,
          pwaInstalled: data.settings?.pwaInstalled || false,
          notificationsEnabled: data.settings?.notificationsEnabled || false
        }))
      }
    } catch (err) {
      console.error('[Push] Error fetching status:', err)
    } finally {
      globalFetchInProgress = false
    }
  }, []) // Empty dependency array - uses store.getState() for current values

  /**
   * Initialize push notification state
   * 
   * CRITICAL: The ref must be set SYNCHRONOUSLY before any async work to prevent
   * race conditions where the effect re-runs while async operations are pending.
   */
  useEffect(() => {
    // Prevent multiple initializations - check and set synchronously BEFORE any async work
    if (hasInitializedRef.current) return
    hasInitializedRef.current = true // Set immediately to prevent re-entry
    
    const initialize = async () => {
      const isSupported = checkSupport()
      
      if (!isSupported) {
        setState(prev => ({
          ...prev,
          isSupported: false,
          permission: 'unavailable',
          isLoading: false
        }))
        return
      }

      // Check permission (synchronous, with iOS safety guard)
      const permission = getNotificationPermission()
      if (permission === 'unavailable') {
        setState(prev => ({
          ...prev,
          isSupported: false,
          permission: 'unavailable',
          isLoading: false
        }))
        return
      }

      // Check if already subscribed in browser (async)
      const subscription = await getCurrentSubscription()
      const hasBrowserSubscription = Boolean(subscription)

      setState(prev => ({
        ...prev,
        isSupported: true,
        permission,
        isSubscribed: hasBrowserSubscription,
        pwaInstalled: isStandalone,
        isLoading: false
      }))
      
      // Update shared store for cross-component sync using stable setter refs
      setStoreSupported(true)
      setStorePermission(permission)
      setStoreSubscribed(hasBrowserSubscription)

      // Auto-resubscribe logic: If user is logged in, has granted permission,
      // and has a browser subscription but no server subscription, auto-subscribe
      if ((isCustomerLoggedIn || isBarberLoggedIn) && permission === 'granted' && subscription) {
        const authState = useAuthStore.getState()
        const barberAuthState = useBarberAuthStore.getState()
        
        const isCustomer = authState.isLoggedIn && authState.customer?.id
        const isBarber = barberAuthState.isLoggedIn && barberAuthState.barber?.id
        
        if (isCustomer || isBarber) {
          try {
            // Check if this endpoint is already registered on server
            const param = isCustomer ? 'customerId' : 'barberId'
            const userId = isCustomer ? authState.customer?.id : barberAuthState.barber?.id
            const statusResponse = await fetch(`/api/push/status?${param}=${userId}`)
            const statusData = await statusResponse.json()
            
            // If no active subscription on server but browser has one, auto-resubscribe
            if (statusData.success && !statusData.isSubscribed) {
              console.log('[Push] Auto-resubscribing: Browser subscription exists but server record missing')
              
              const subscriptionJSON = subscription.toJSON()
              
              const saveResponse = await fetch('/api/push/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  subscription: {
                    endpoint: subscriptionJSON.endpoint,
                    keys: subscriptionJSON.keys
                  },
                  customerId: isCustomer ? authState.customer?.id : undefined,
                  barberId: isBarber ? barberAuthState.barber?.id : undefined
                })
              })
              
              const saveData = await saveResponse.json()
              
              if (saveData.success) {
                console.log('[Push] Auto-resubscribe successful!')
                setState(prev => ({
                  ...prev,
                  isSubscribed: true,
                  notificationsEnabled: true
                }))
                setStoreSubscribed(true)
              }
            }
          } catch (err) {
            console.error('[Push] Auto-resubscribe error:', err)
            // Don't fail silently - user can still manually enable
          }
        }
      }

      // Fetch server status if logged in (uses store.getState() internally, so safe to call)
      if (isCustomerLoggedIn || isBarberLoggedIn) {
        await fetchServerStatus()
      }
    }

    initialize()
    // NOTE: fetchServerStatus is intentionally NOT in dependencies - it uses store.getState()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkSupport, getCurrentSubscription, isStandalone, isCustomerLoggedIn, isBarberLoggedIn, setStoreSupported, setStorePermission, setStoreSubscribed])

  /**
   * Request notification permission
   */
  const requestPermission = useCallback(async (): Promise<NotificationPermission | 'unavailable'> => {
    if (!state.isSupported) {
      return 'unavailable'
    }

    // iOS requires PWA installation
    if (isIOS && !isStandalone) {
      setState(prev => ({
        ...prev,
        error: 'יש להתקין את האפליקציה כדי לקבל התראות'
      }))
      return 'denied'
    }

    try {
      if (typeof Notification === 'undefined') return 'denied'
      const permission = await Notification.requestPermission()
      setState(prev => ({ ...prev, permission }))
      return permission
    } catch (err) {
      console.error('[Push] Permission request failed:', err)
      return 'denied'
    }
  }, [state.isSupported, isIOS, isStandalone])

  /**
   * Subscribe to push notifications
   */
  const subscribe = useCallback(async (): Promise<boolean> => {
    if (state.isLoading || state.isSubscribed) return false
    
    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      // Check support
      if (!state.isSupported) {
        throw new Error('התראות אינן נתמכות במכשיר זה')
      }

      // iOS PWA check
      if (isIOS && !isStandalone) {
        throw new Error('יש להתקין את האפליקציה כדי לקבל התראות')
      }

      // Request permission if needed
      let permission = state.permission
      if (permission !== 'granted') {
        permission = await requestPermission()
      }

      if (permission !== 'granted') {
        throw new Error('לא ניתנה הרשאה להתראות')
      }

      // Get service worker
      const registration = await navigator.serviceWorker.ready

      // Fetch VAPID key from server
      const vapidResponse = await fetch('/api/push/vapid-key')
      const vapidData = await vapidResponse.json()

      if (!vapidData.success || !vapidData.publicKey) {
        throw new Error('שגיאה בהגדרת התראות')
      }

      const applicationServerKey = urlBase64ToUint8Array(vapidData.publicKey)

      // Subscribe to push manager
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true, // Required for iOS
        applicationServerKey
      })

      // Prepare subscription data
      const subscriptionJSON = subscription.toJSON()
      
      // Determine user type
      const isCustomer = isCustomerLoggedIn && customer?.id
      const isBarber = isBarberLoggedIn && barber?.id

      if (!isCustomer && !isBarber) {
        throw new Error('יש להתחבר כדי לקבל התראות')
      }

      // Save to server
      const saveResponse = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: {
            endpoint: subscriptionJSON.endpoint,
            keys: subscriptionJSON.keys
          },
          customerId: isCustomer ? customer.id : undefined,
          barberId: isBarber ? barber.id : undefined
        })
      })

      const saveData = await saveResponse.json()

      if (!saveData.success) {
        throw new Error(saveData.error || 'שגיאה בשמירת ההרשמה')
      }

      setState(prev => ({
        ...prev,
        isSubscribed: true,
        isLoading: false,
        notificationsEnabled: true
      }))
      
      // Update shared store immediately for cross-component sync
      setStoreSubscribed(true)

      // Reset cooldown and refresh device list (important to get fresh data after subscribe)
      globalLastFetchTime = 0
      await fetchServerStatus()

      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'שגיאה לא ידועה'
      
      // Report error to bug tracking
      report(
        err instanceof Error ? err : new Error(errorMessage),
        'Subscribing to push notifications'
      )
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage
      }))
      return false
    }
  }, [state, isIOS, isStandalone, requestPermission, isCustomerLoggedIn, isBarberLoggedIn, customer, barber, fetchServerStatus, report, setStoreSubscribed])

  /**
   * Unsubscribe from push notifications
   */
  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (state.isLoading || !state.isSubscribed) return false

    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      // Get current subscription
      const subscription = await getCurrentSubscription()

      if (subscription) {
        // Unsubscribe from push manager
        await subscription.unsubscribe()

        // Remove from server
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: subscription.endpoint
          })
        })
      }

      setState(prev => ({
        ...prev,
        isSubscribed: false,
        isLoading: false,
        notificationsEnabled: false
      }))

      // Reset cooldown and refresh status (important to get fresh data after unsubscribe)
      globalLastFetchTime = 0
      await fetchServerStatus()

      return true
    } catch (err) {
      console.error('[Push] Unsubscribe error:', err)
      
      // Report error
      report(
        err instanceof Error ? err : new Error('Unsubscribe failed'),
        'Unsubscribing from push notifications'
      )
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: 'שגיאה בביטול ההרשמה'
      }))
      return false
    }
  }, [state, getCurrentSubscription, fetchServerStatus, report])

  /**
   * Remove a specific device
   */
  const removeDevice = useCallback(async (deviceId: string): Promise<boolean> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      const response = await fetch('/api/push/subscribe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscriptionId: deviceId })
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'שגיאה בהסרת המכשיר')
      }

      // Update local state
      setState(prev => ({
        ...prev,
        devices: prev.devices.filter(d => d.id !== deviceId),
        isLoading: false
      }))

      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'שגיאה לא ידועה'
      
      // Report error
      report(
        err instanceof Error ? err : new Error(errorMessage),
        `Removing push notification device: ${deviceId}`
      )
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage
      }))
      return false
    }
  }, [report])

  /**
   * Refresh status from server (bypasses cooldown for explicit refresh)
   */
  const refreshStatus = useCallback(async (): Promise<void> => {
    setState(prev => ({ ...prev, isLoading: true }))
    
    // Re-check local subscription
    const subscription = await getCurrentSubscription()
    const currentPermission = getNotificationPermission()
    setState(prev => ({
      ...prev,
      isSubscribed: Boolean(subscription),
      permission: currentPermission
    }))

    // Reset cooldown and fetch from server (explicit refresh should always work)
    globalLastFetchTime = 0
    await fetchServerStatus()
    
    setState(prev => ({ ...prev, isLoading: false }))
  }, [getCurrentSubscription, fetchServerStatus, getNotificationPermission])

  return {
    ...state,
    requestPermission,
    subscribe,
    unsubscribe,
    removeDevice,
    refreshStatus,
    isIOS,
    requiresPWA
  }
}

/**
 * Helper to get device type icon name
 */
export const getDeviceIcon = (deviceType: DeviceType): string => {
  switch (deviceType) {
    case 'ios':
      return 'Smartphone'
    case 'android':
      return 'Smartphone'
    case 'desktop':
      return 'Monitor'
    default:
      return 'Smartphone'
  }
}

