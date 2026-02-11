'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { useAuthStore } from '@/store/useAuthStore'
import { useBarberAuthStore } from '@/store/useBarberAuthStore'
import { getBarberSession } from '@/lib/auth/barber-auth'

interface AuthProviderProps {
  children: ReactNode
}

/**
 * AuthProvider
 * 
 * Initializes both customer and barber auth on mount.
 * Adds resilience against iOS localStorage eviction and PWA background wake-ups:
 * 
 * 1. visibilitychange: When the app returns from background (especially iOS PWA),
 *    re-check sessions from storage. If Zustand says "not logged in" but storage
 *    has a valid session (recovered from cookie fallback), re-hydrate.
 * 
 * 2. storage event: If another tab clears storage (logout), sync this tab.
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const checkCustomerSession = useAuthStore((state) => state.checkSession)
  const checkBarberSession = useBarberAuthStore((state) => state.checkSession)
  const initializedRef = useRef(false)

  // Initial session check
  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true
    
    checkCustomerSession()
    checkBarberSession()
  }, [checkCustomerSession, checkBarberSession])

  // Re-hydrate sessions when app returns from background (iOS PWA wake-up)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return
      
      // Customer: if Zustand says not logged in, but storage has session → re-check
      const customerState = useAuthStore.getState()
      if (!customerState.isLoggedIn && customerState.isInitialized) {
        // Force a fresh session check by resetting isInitialized
        // This triggers re-read from dual storage (localStorage + cookie)
        useAuthStore.setState({ isInitialized: false })
        useAuthStore.getState().checkSession()
      }
      
      // Barber: same logic
      const barberState = useBarberAuthStore.getState()
      if (!barberState.isLoggedIn && barberState.isInitialized) {
        // Only re-check if there's a session in storage (from cookie fallback recovery)
        const session = getBarberSession()
        if (session) {
          useBarberAuthStore.setState({ isInitialized: false })
          useBarberAuthStore.getState().checkSession()
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  // Cross-tab sync: if another tab logs out (clears storage), sync this tab
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      // Customer session was cleared in another tab
      if (event.key === 'ramel_auth_session' && event.newValue === null) {
        const { isLoggedIn } = useAuthStore.getState()
        if (isLoggedIn) {
          console.log('[AuthProvider] Customer session cleared in another tab')
          useAuthStore.setState({
            customer: null,
            isLoggedIn: false,
            authMethod: null,
          })
        }
      }
      
      // Barber session was cleared in another tab
      if (event.key === 'ramel_barber_session' && event.newValue === null) {
        const { isLoggedIn } = useBarberAuthStore.getState()
        if (isLoggedIn) {
          console.log('[AuthProvider] Barber session cleared in another tab')
          useBarberAuthStore.setState({
            barber: null,
            isLoggedIn: false,
            isAdmin: false,
          })
        }
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  return <>{children}</>
}

