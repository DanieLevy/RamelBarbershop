import { create } from 'zustand'
import type { User, UserRole } from '@/types/database'
import { 
  loginBarber, 
  clearBarberSession, 
  validateBarberSession,
  getBarberSession
} from '@/lib/auth/barber-auth'

interface BarberAuthState {
  barber: User | null
  isLoggedIn: boolean
  isLoading: boolean
  isInitialized: boolean
  isAdmin: boolean
  
  // Actions
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  logout: () => void
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
      return { success: false, error: result.error }
    } catch (error) {
      console.error('Login error:', error)
      set({ isLoading: false })
      return { success: false, error: 'שגיאה בהתחברות' }
    }
  },

  logout: () => {
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
        set({
          isLoading: false,
          isInitialized: true,
        })
      }
    } catch (error) {
      console.error('Session check error:', error)
      clearBarberSession()
      set({
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

