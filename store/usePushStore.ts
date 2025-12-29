/**
 * Push Notification State Store
 * 
 * Shared state for push notifications across components.
 * This ensures real-time sync between components that need to know about push subscription status.
 */

import { create } from 'zustand'

interface PushState {
  isSubscribed: boolean
  permission: NotificationPermission | 'unavailable'
  isSupported: boolean
  deviceCount: number
  
  // Actions
  setSubscribed: (subscribed: boolean) => void
  setPermission: (permission: NotificationPermission | 'unavailable') => void
  setSupported: (supported: boolean) => void
  setDeviceCount: (count: number) => void
  reset: () => void
}

const initialState = {
  isSubscribed: false,
  permission: 'unavailable' as NotificationPermission | 'unavailable',
  isSupported: false,
  deviceCount: 0,
}

export const usePushStore = create<PushState>((set) => ({
  ...initialState,
  
  setSubscribed: (isSubscribed) => set({ isSubscribed }),
  setPermission: (permission) => set({ permission }),
  setSupported: (isSupported) => set({ isSupported }),
  setDeviceCount: (deviceCount) => set({ deviceCount }),
  reset: () => set(initialState),
}))


