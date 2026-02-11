import { create } from 'zustand'
import type { Customer, StoredSession } from '@/types/database'
import { 
  getOrCreateCustomer, 
  getOrCreateCustomerWithEmail, 
  linkEmailToCustomer,
  getCustomerById 
} from '@/lib/services/customer.service'
import { signOutSupabase } from '@/lib/auth/email-auth'
import { saveSessionDual, readSessionDual, clearSessionDual } from '@/lib/utils/session-storage'

const SESSION_KEY = 'ramel_auth_session'
const COOKIE_KEY = 'rb_customer_s'
// Session never expires - only manual logout clears the session
// This ensures users stay logged in permanently for best UX
// Dual-storage: localStorage + cookie fallback for iOS resilience

// Auth method type
export type SessionAuthMethod = 'phone' | 'email'

interface AuthState {
  customer: Customer | null
  isLoggedIn: boolean
  isLoading: boolean
  isInitialized: boolean
  authMethod: SessionAuthMethod | null // Track how user logged in this session
  
  // Actions
  /**
   * Login via SMS OTP
   * @param phone - Customer phone number
   * @param fullname - Customer full name
   * @param providerUid - SMS provider user ID (e.g., "o19-0501234567" for 019 SMS)
   */
  login: (phone: string, fullname: string, providerUid?: string) => Promise<Customer | null>
  loginWithEmail: (phone: string, fullname: string, email: string, supabaseUid?: string) => Promise<Customer | null>
  linkEmail: (email: string, supabaseUid?: string) => Promise<boolean>
  logout: () => void
  checkSession: () => Promise<void>
  refreshCustomer: () => Promise<void>
  setLoading: (loading: boolean) => void
}

// Extended session type to include auth method
interface ExtendedSession extends StoredSession {
  authMethod?: SessionAuthMethod
  email?: string
}

/**
 * Save session to localStorage + cookie fallback
 * Sessions are permanent - no expiration (only manual logout clears them)
 * Dual-storage ensures iOS localStorage eviction doesn't cause logouts
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
  
  saveSessionDual(SESSION_KEY, COOKIE_KEY, session)
}

/**
 * Get session from localStorage with cookie fallback
 * Sessions are permanent - only manual logout clears them
 * If localStorage was evicted (iOS), recovers from cookie automatically
 */
function getStoredSession(): ExtendedSession | null {
  if (typeof window === 'undefined') return null
  
  const session = readSessionDual<ExtendedSession>(SESSION_KEY, COOKIE_KEY)
  if (!session) return null
  
  // Sessions are now permanent - skip expiration check
  // expiresAt === 0 means never expires (new behavior)
  // For backward compatibility, also accept old sessions with future dates
  // Only reject if expiresAt is set to a past date AND is not 0
  if (session.expiresAt !== 0 && session.expiresAt > 0 && session.expiresAt < Date.now()) {
    // Migrate old expired sessions: re-save without expiration
    console.log('[Auth] Migrating old session to permanent format')
    session.expiresAt = 0
    saveSessionDual(SESSION_KEY, COOKIE_KEY, session)
  }
  
  return session
}

/**
 * Clear session from all storage layers
 */
function clearSession(): void {
  if (typeof window === 'undefined') return
  clearSessionDual(SESSION_KEY, COOKIE_KEY)
}

export const useAuthStore = create<AuthState>((set, get) => ({
  customer: null,
  isLoggedIn: false,
  isLoading: false,
  isInitialized: false,
  authMethod: null,

  // Login via SMS OTP - providerUid is stored in provider_uid column
  login: async (phone: string, fullname: string, providerUid?: string) => {
    set({ isLoading: true })
    
    try {
      // providerUid is stored in provider_uid column (e.g., "o19-0501234567")
      const customer = await getOrCreateCustomer(phone, fullname, providerUid)
      
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
    
    // Deactivate push subscription on server (but keep browser subscription intact)
    // This ensures:
    // 1. This device won't receive notifications for the logged-out user
    // 2. When user logs back in, we can auto-resubscribe (browser subscription still exists)
    if (customer?.id && typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready
        const subscription = await registration.pushManager.getSubscription()
        
        if (subscription) {
          // Only deactivate on server - DO NOT unsubscribe from browser
          // This allows auto-resubscribe on next login if permission is still granted
          await fetch('/api/push/subscribe', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: subscription.endpoint })
          })
          
          console.log('[Auth] Push subscription deactivated on server (browser subscription kept for auto-resubscribe)')
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

  refreshCustomer: async () => {
    const { customer, isLoggedIn } = get()
    if (!isLoggedIn || !customer) return
    
    try {
      const freshCustomer = await getCustomerById(customer.id)
      if (freshCustomer) {
        set({ customer: freshCustomer })
        // Also update stored session
        const { authMethod } = get()
        saveSession(freshCustomer, authMethod || 'phone')
      }
    } catch (err) {
      console.warn('[AuthStore] Failed to refresh customer data:', err)
      // Don't update state on failure - keep existing data
    }
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
        // Customer genuinely not found (deleted, etc.) - clear session
        clearSession()
        set({ 
          customer: null,
          isLoggedIn: false,
          isLoading: false,
          isInitialized: true,
          authMethod: null
        })
      }
    } catch (err) {
      // This catch is hit for network errors (where getCustomerById throws)
      // getCustomerById throws for network errors but returns null for "not found"
      // We should NOT log them out - use cached session data for offline experience
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      console.warn('[AuthStore] Network error during session check:', errorMessage, '- keeping session, will retry on next interaction')
      
      // Use cached session data for offline experience
      set({ 
        customer: {
          id: session.customerId,
          phone: session.phone,
          fullname: session.fullname,
          email: session.email || null,
          auth_method: session.authMethod || 'phone',
          is_blocked: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as Customer,
        isLoggedIn: true,
        isLoading: false,
        isInitialized: true,
        authMethod: session.authMethod || 'phone'
      })
    }
  },

  setLoading: (loading: boolean) => set({ isLoading: loading }),
}))

