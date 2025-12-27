import { create } from 'zustand'
import type { Customer, StoredSession } from '@/types/database'
import { getOrCreateCustomer, getCustomerById } from '@/lib/services/customer.service'

const SESSION_KEY = 'ramel_auth_session'
const SESSION_EXPIRY_MS = 60 * 24 * 60 * 60 * 1000 // 60 days in milliseconds

interface AuthState {
  customer: Customer | null
  isLoggedIn: boolean
  isLoading: boolean
  isInitialized: boolean
  
  // Actions
  login: (phone: string, fullname: string, firebaseUid?: string) => Promise<Customer | null>
  logout: () => void
  checkSession: () => Promise<void>
  setLoading: (loading: boolean) => void
}

/**
 * Save session to localStorage
 */
function saveSession(customer: Customer): void {
  if (typeof window === 'undefined') return
  
  const session: StoredSession = {
    customerId: customer.id,
    phone: customer.phone,
    fullname: customer.fullname,
    expiresAt: Date.now() + SESSION_EXPIRY_MS,
  }
  
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

/**
 * Get session from localStorage
 */
function getStoredSession(): StoredSession | null {
  if (typeof window === 'undefined') return null
  
  const stored = localStorage.getItem(SESSION_KEY)
  if (!stored) return null
  
  try {
    const session: StoredSession = JSON.parse(stored)
    
    // Check if session is expired
    if (session.expiresAt < Date.now()) {
      localStorage.removeItem(SESSION_KEY)
      return null
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

  login: async (phone: string, fullname: string, firebaseUid?: string) => {
    set({ isLoading: true })
    
    try {
      const customer = await getOrCreateCustomer(phone, fullname, firebaseUid)
      
      if (customer) {
        saveSession(customer)
        set({ 
          customer, 
          isLoggedIn: true, 
          isLoading: false 
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

  logout: () => {
    clearSession()
    set({ 
      customer: null, 
      isLoggedIn: false 
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
          isInitialized: true 
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

