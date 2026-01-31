import { create } from 'zustand'

// Hardcoded developer credentials
const DEV_CREDENTIALS = {
  email: 'daniellofficial@gmail.com',
  password: 'daniel123',
}

const DEV_SESSION_KEY = 'ramel_dev_session'
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000 // 24 hours

interface DevSession {
  email: string
  token: string
  expiresAt: number
}

interface DevAuthState {
  isDevLoggedIn: boolean
  isInitialized: boolean
  devEmail: string | null
  devToken: string | null
  
  // Actions
  devLogin: (email: string, password: string) => { success: boolean; error?: string }
  devLogout: () => void
  checkDevSession: () => void
  getDevToken: () => string | null
}

/**
 * Generate a simple token for dev session
 */
const generateDevToken = (): string => {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 15)
  return `dev_${timestamp}_${random}`
}

/**
 * Save dev session to localStorage
 */
const saveDevSession = (session: DevSession): void => {
  if (typeof window === 'undefined') return
  localStorage.setItem(DEV_SESSION_KEY, JSON.stringify(session))
}

/**
 * Get dev session from localStorage
 */
const getDevSession = (): DevSession | null => {
  if (typeof window === 'undefined') return null
  const stored = localStorage.getItem(DEV_SESSION_KEY)
  if (!stored) return null
  
  try {
    return JSON.parse(stored) as DevSession
  } catch {
    return null
  }
}

/**
 * Clear dev session from localStorage
 */
const clearDevSession = (): void => {
  if (typeof window === 'undefined') return
  localStorage.removeItem(DEV_SESSION_KEY)
}

/**
 * Developer authentication store
 * Provides read-only access to all system data for the developer
 */
export const useDevAuthStore = create<DevAuthState>((set, get) => ({
  isDevLoggedIn: false,
  isInitialized: false,
  devEmail: null,
  devToken: null,

  /**
   * Login with developer credentials
   * Validates against hardcoded credentials (NOT database)
   */
  devLogin: (email: string, password: string) => {
    // Normalize email for comparison
    const normalizedEmail = email.toLowerCase().trim()
    
    // Check against hardcoded credentials
    if (normalizedEmail !== DEV_CREDENTIALS.email || password !== DEV_CREDENTIALS.password) {
      return { success: false, error: 'Invalid developer credentials' }
    }
    
    // Generate session token
    const token = generateDevToken()
    const expiresAt = Date.now() + SESSION_DURATION_MS
    
    // Save session
    const session: DevSession = {
      email: normalizedEmail,
      token,
      expiresAt,
    }
    saveDevSession(session)
    
    // Update state
    set({
      isDevLoggedIn: true,
      devEmail: normalizedEmail,
      devToken: token,
    })
    
    return { success: true }
  },

  /**
   * Logout and clear dev session
   */
  devLogout: () => {
    clearDevSession()
    set({
      isDevLoggedIn: false,
      devEmail: null,
      devToken: null,
    })
  },

  /**
   * Check if a valid dev session exists
   */
  checkDevSession: () => {
    const session = getDevSession()
    
    if (!session) {
      set({ isDevLoggedIn: false, isInitialized: true, devEmail: null, devToken: null })
      return
    }
    
    // Check if session has expired
    if (Date.now() > session.expiresAt) {
      clearDevSession()
      set({ isDevLoggedIn: false, isInitialized: true, devEmail: null, devToken: null })
      return
    }
    
    // Valid session exists
    set({
      isDevLoggedIn: true,
      isInitialized: true,
      devEmail: session.email,
      devToken: session.token,
    })
  },

  /**
   * Get the current dev token for API calls
   */
  getDevToken: () => {
    const state = get()
    return state.devToken
  },
}))
