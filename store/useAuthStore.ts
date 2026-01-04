import { create } from 'zustand'
import type { Customer, StoredSession } from '@/types/database'
import { 
  getOrCreateCustomer, 
  getOrCreateCustomerWithEmail, 
  linkEmailToCustomer,
  getCustomerById 
} from '@/lib/services/customer.service'
import { signOutSupabase } from '@/lib/auth/email-auth'

const SESSION_KEY = 'ramel_auth_session'
// Session never expires - only manual logout clears the session
// This ensures users stay logged in permanently for best UX

// Auth method type
export type SessionAuthMethod = 'phone' | 'email'

interface AuthState {
  customer: Customer | null
  isLoggedIn: boolean
  isLoading: boolean
  isInitialized: boolean
  authMethod: SessionAuthMethod | null // Track how user logged in this session
  
  // Actions
  login: (phone: string, fullname: string, firebaseUid?: string) => Promise<Customer | null>
  loginWithEmail: (phone: string, fullname: string, email: string, supabaseUid?: string) => Promise<Customer | null>
  linkEmail: (email: string, supabaseUid?: string) => Promise<boolean>
  logout: () => void
  checkSession: () => Promise<void>
  setLoading: (loading: boolean) => void
}

// Extended session type to include auth method
interface ExtendedSession extends StoredSession {
  authMethod?: SessionAuthMethod
  email?: string
}

/**
 * Save session to localStorage
 * Sessions are permanent - no expiration (only manual logout clears them)
 */
function saveSession(customer: Customer, authMethod: SessionAuthMethod = 'phone'): void {
  if (typeof window === 'undefined') return
  
  const session: ExtendedSession = {
    customerId: customer.id,
    phone: customer.phone,
    fullname: customer.fullname,
    expiresAt: 0, // 0 = never expires (kept for backward compatibility with stored sessions)
    authMethod,
    email: customer.email || undefined,
  }
  
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

/**
 * Get session from localStorage
 * Sessions are permanent - only manual logout clears them
 */
function getStoredSession(): ExtendedSession | null {
  if (typeof window === 'undefined') return null
  
  const stored = localStorage.getItem(SESSION_KEY)
  if (!stored) return null
  
  try {
    const session: ExtendedSession = JSON.parse(stored)
    
    // Sessions are now permanent - skip expiration check
    // expiresAt === 0 means never expires (new behavior)
    // For backward compatibility, also accept old sessions with future dates
    // Only reject if expiresAt is set to a past date AND is not 0
    if (session.expiresAt !== 0 && session.expiresAt > 0 && session.expiresAt < Date.now()) {
      // Migrate old expired sessions: re-save without expiration
      // This allows previously logged-in users to stay logged in
      console.log('[Auth] Migrating old session to permanent format')
      session.expiresAt = 0
      localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    }
    
    return session
  } catch {
    localStorage.removeItem(SESSION_KEY)
    return null
  }
}

/**
 * Clear session from localStorage
 */
function clearSession(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(SESSION_KEY)
}

export const useAuthStore = create<AuthState>((set, get) => ({
  customer: null,
  isLoggedIn: false,
  isLoading: false,
  isInitialized: false,
  authMethod: null,

  login: async (phone: string, fullname: string, firebaseUid?: string) => {
    set({ isLoading: true })
    
    try {
      const customer = await getOrCreateCustomer(phone, fullname, firebaseUid)
      
      if (customer) {
        saveSession(customer, 'phone')
        set({ 
          customer, 
          isLoggedIn: true, 
          isLoading: false,
          authMethod: 'phone'
        })
        return customer
      }
      
      set({ isLoading: false })
      return null
    } catch (error) {
      console.error('Login error:', error)
      set({ isLoading: false })
      return null
    }
  },

  loginWithEmail: async (phone: string, fullname: string, email: string, supabaseUid?: string) => {
    set({ isLoading: true })
    
    try {
      const customer = await getOrCreateCustomerWithEmail(phone, fullname, email, supabaseUid)
      
      if (customer) {
        saveSession(customer, 'email')
        set({ 
          customer, 
          isLoggedIn: true, 
          isLoading: false,
          authMethod: 'email'
        })
        return customer
      }
      
      set({ isLoading: false })
      return null
    } catch (error) {
      console.error('Email login error:', error)
      set({ isLoading: false })
      return null
    }
  },

  linkEmail: async (email: string, supabaseUid?: string) => {
    const { customer } = get()
    if (!customer) return false
    
    try {
      const updated = await linkEmailToCustomer(customer.id, email, supabaseUid)
      if (updated) {
        saveSession(updated, get().authMethod || 'phone')
        set({ customer: updated })
        return true
      }
      return false
    } catch (error) {
      console.error('Link email error:', error)
      return false
    }
  },

  logout: async () => {
    const { authMethod, customer } = get()
    
    // Deactivate push subscription for current device before logout
    // This ensures this device won't receive notifications for the logged-out user
    if (customer?.id && typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
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
          
          console.log('[Auth] Push subscription deactivated on logout')
        }
      } catch (err) {
        // Don't block logout if push cleanup fails
        console.error('[Auth] Error cleaning up push subscription on logout:', err)
      }
    }
    
    // Sign out from Supabase if user was logged in via email
    if (authMethod === 'email') {
      await signOutSupabase()
    }
    
    clearSession()
    set({ 
      customer: null, 
      isLoggedIn: false,
      authMethod: null
    })
  },

  checkSession: async () => {
    const { isInitialized } = get()
    if (isInitialized) return
    
    set({ isLoading: true })
    
    const session = getStoredSession()
    
    if (!session) {
      set({ 
        isLoading: false, 
        isInitialized: true 
      })
      return
    }
    
    try {
      // Validate session by fetching customer from database
      const customer = await getCustomerById(session.customerId)
      
      if (customer) {
        set({ 
          customer, 
          isLoggedIn: true, 
          isLoading: false,
          isInitialized: true,
          authMethod: session.authMethod || 'phone'
        })
      } else {
        // Invalid session - customer not found
        clearSession()
        set({ 
          isLoading: false,
          isInitialized: true 
        })
      }
    } catch (error) {
      console.error('Session check error:', error)
      clearSession()
      set({ 
        isLoading: false,
        isInitialized: true 
      })
    }
  },

  setLoading: (loading: boolean) => set({ isLoading: loading }),
}))

