'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '@/store/useAuthStore'
import { useBarberAuthStore } from '@/store/useBarberAuthStore'
import { usePWA } from './usePWA'
import type { DeviceInfo, DeviceType } from '@/lib/push/types'

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

/**
 * Convert VAPID key from base64url to ArrayBuffer (required for iOS compatibility)
 */
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

/**
 * Set app badge count (iOS 16.4+, Android)
 */
export const setAppBadge = async (count: number): Promise<boolean> => {
  if (!('setAppBadge' in navigator)) return false
  
  try {
    if (count > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (navigator as any).setAppBadge(count)
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (navigator as any).clearAppBadge()
    }
    return true
  } catch {
    return false
  }
}

/**
 * Hook for managing push notifications
 */
export const usePushNotifications = (): UsePushNotificationsReturn => {
  const { customer, isLoggedIn: isCustomerLoggedIn } = useAuthStore()
  const { barber, isLoggedIn: isBarberLoggedIn } = useBarberAuthStore()
  const { isStandalone, deviceOS } = usePWA()
  
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
   * Check if push notifications are supported
   */
  const checkSupport = useCallback((): boolean => {
    if (typeof window === 'undefined') return false
    
    return (
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window
    )
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
   * Fetch status from server
   */
  const fetchServerStatus = useCallback(async () => {
    const userId = isCustomerLoggedIn ? customer?.id : isBarberLoggedIn ? barber?.id : null
    if (!userId) return

    try {
      const param = isCustomerLoggedIn ? 'customerId' : 'barberId'
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
    }
  }, [isCustomerLoggedIn, isBarberLoggedIn, customer?.id, barber?.id])

  /**
   * Initialize push notification state
   */
  useEffect(() => {
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

      // Check permission
      const permission = Notification.permission

      // Check if already subscribed
      const subscription = await getCurrentSubscription()
      const isSubscribed = Boolean(subscription)

      setState(prev => ({
        ...prev,
        isSupported: true,
        permission,
        isSubscribed,
        pwaInstalled: isStandalone,
        isLoading: false
      }))

      // Fetch server status if logged in
      if (isCustomerLoggedIn || isBarberLoggedIn) {
        await fetchServerStatus()
      }
    }

    initialize()
  }, [checkSupport, getCurrentSubscription, isStandalone, isCustomerLoggedIn, isBarberLoggedIn, fetchServerStatus])

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

      // Refresh device list
      await fetchServerStatus()

      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'שגיאה לא ידועה'
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage
      }))
      return false
    }
  }, [state, isIOS, isStandalone, requestPermission, isCustomerLoggedIn, isBarberLoggedIn, customer, barber, fetchServerStatus])

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

      // Refresh status
      await fetchServerStatus()

      return true
    } catch (err) {
      console.error('[Push] Unsubscribe error:', err)
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: 'שגיאה בביטול ההרשמה'
      }))
      return false
    }
  }, [state, getCurrentSubscription, fetchServerStatus])

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
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage
      }))
      return false
    }
  }, [])

  /**
   * Refresh status from server
   */
  const refreshStatus = useCallback(async (): Promise<void> => {
    setState(prev => ({ ...prev, isLoading: true }))
    
    // Re-check local subscription
    const subscription = await getCurrentSubscription()
    setState(prev => ({
      ...prev,
      isSubscribed: Boolean(subscription),
      permission: Notification.permission
    }))

    // Fetch from server
    await fetchServerStatus()
    
    setState(prev => ({ ...prev, isLoading: false }))
  }, [getCurrentSubscription, fetchServerStatus])

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

