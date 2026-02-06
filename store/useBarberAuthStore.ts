import { create } from 'zustand'
import type { User } from '@/types/database'
import { 
  loginBarber, 
  clearBarberSession, 
  validateBarberSession,
  getBarberSession,
  type LoginErrorCode
} from '@/lib/auth/barber-auth'

interface BarberAuthState {
  barber: User | null
  isLoggedIn: boolean
  isLoading: boolean
  isInitialized: boolean
  isAdmin: boolean
  
  // Actions
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string; errorCode?: LoginErrorCode }>
  logout: () => Promise<void>
  checkSession: () => Promise<void>
  setBarber: (barber: User) => void
}

export const useBarberAuthStore = create<BarberAuthState>((set, get) => ({
  barber: null,
  isLoggedIn: false,
  isLoading: false,
  isInitialized: false,
  isAdmin: false,

  login: async (email: string, password: string) => {
    set({ isLoading: true })
    
    try {
      const result = await loginBarber(email, password)
      
      if (result.success && result.user) {
        set({
          barber: result.user,
          isLoggedIn: true,
          isAdmin: result.user.role === 'admin',
          isLoading: false,
        })
        return { success: true }
      }
      
      set({ isLoading: false })
      return { success: false, error: result.error, errorCode: result.errorCode }
    } catch (error) {
      console.error('Login error:', error)
      set({ isLoading: false })
      
      // Determine error type for better UX
      const errorMsg = error instanceof Error ? error.message : String(error)
      const isNetworkError = errorMsg.toLowerCase().includes('network') || 
                             errorMsg.toLowerCase().includes('load failed') ||
                             errorMsg.toLowerCase().includes('fetch')
      
      return { 
        success: false, 
        error: isNetworkError ? 'בעיית תקשורת. בדוק את החיבור לאינטרנט.' : 'שגיאה בהתחברות',
        errorCode: isNetworkError ? 'NETWORK_ERROR' : 'DATABASE_ERROR'
      }
    }
  },

  logout: async () => {
    const { barber } = get()
    
    // Deactivate push subscription for current device before logout
    // This ensures this device won't receive notifications for the logged-out barber
    if (barber?.id && typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready
        const subscription = await registration.pushManager.getSubscription()
        
        if (subscription) {
          // Unsubscribe from browser's push manager
          await subscription.unsubscribe()
          
          // Deactivate on server (by endpoint)
          await fetch('/api/push/subscribe', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: subscription.endpoint })
          })
          
          console.log('[BarberAuth] Push subscription deactivated on logout')
        }
      } catch (err) {
        // Don't block logout if push cleanup fails
        console.error('[BarberAuth] Error cleaning up push subscription on logout:', err)
      }
    }
    
    clearBarberSession()
    set({
      barber: null,
      isLoggedIn: false,
      isAdmin: false,
    })
  },

  checkSession: async () => {
    const { isInitialized } = get()
    if (isInitialized) return
    
    set({ isLoading: true })
    
    // Quick check from localStorage first
    const session = getBarberSession()
    if (!session) {
      set({ isLoading: false, isInitialized: true })
      return
    }
    
    // Validate against database
    try {
      const barber = await validateBarberSession()
      
      if (barber) {
        set({
          barber,
          isLoggedIn: true,
          isAdmin: barber.role === 'admin',
          isLoading: false,
          isInitialized: true,
        })
      } else {
        // validateBarberSession returns null for:
        // 1. User not found (session already cleared by validateBarberSession)
        // 2. Auth errors (session already cleared by validateBarberSession)
        set({
          barber: null,
          isLoggedIn: false,
          isAdmin: false,
          isLoading: false,
          isInitialized: true,
        })
      }
    } catch (err) {
      // This catch is hit for network errors (where session is PRESERVED)
      // validateBarberSession throws for network errors but doesn't clear session
      // We should NOT log them out - just mark as "offline" state with preserved session data
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      console.warn('[BarberAuthStore] Network error during session check:', errorMessage, '- keeping session, will retry on next interaction')
      
      // Use cached session data for offline experience
      // The barber can still browse the app with cached data
      set({
        barber: {
          id: session.barberId,
          fullname: session.fullname,
          email: session.email,
          role: session.role,
          is_barber: true,
          is_active: true,
          username: session.email.split('@')[0] || 'barber',
        } as User,
        isLoggedIn: true,
        isAdmin: session.role === 'admin',
        isLoading: false,
        isInitialized: true,
      })
    }
  },

  setBarber: (barber: User) => {
    set({
      barber,
      isLoggedIn: true,
      isAdmin: barber.role === 'admin',
    })
  },
}))

