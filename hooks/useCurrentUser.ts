'use client'

import { useMemo, useCallback } from 'react'
import { useAuthStore } from '@/store/useAuthStore'
import { useBarberAuthStore } from '@/store/useBarberAuthStore'
import type { Customer, User } from '@/types/database'

export type UserType = 'guest' | 'customer' | 'barber'

export interface CurrentUserState {
  // Type of the currently logged in user
  type: UserType
  
  // The user data (Customer for customer, User for barber)
  user: Customer | User | null
  
  // Whether any user is logged in
  isLoggedIn: boolean
  
  // Whether auth has been initialized (checked sessions)
  isInitialized: boolean
  
  // Whether auth is currently loading
  isLoading: boolean
  
  // Customer-specific data (null if not a customer)
  customer: Customer | null
  
  // Barber-specific data (null if not a barber)
  barber: User | null
  
  // Whether the logged in barber is an admin
  isAdmin: boolean
  
  // Display name for the current user
  displayName: string
  
  // Unified logout function - clears both sessions
  logout: () => void
  
  // Check if another account type is logged in
  isOtherAccountLoggedIn: (targetType: 'customer' | 'barber') => boolean
}

/**
 * Unified hook for getting the current user state across both auth systems.
 * 
 * This hook ensures we have a single source of truth for the current user,
 * regardless of whether they're logged in as a customer or a barber.
 * 
 * IMPORTANT: Only one account type can be active at a time.
 * If both somehow get logged in, barber takes precedence (admin access).
 */
export function useCurrentUser(): CurrentUserState {
  // Get state from both auth stores
  const {
    customer,
    isLoggedIn: isCustomerLoggedIn,
    isLoading: isCustomerLoading,
    isInitialized: isCustomerInitialized,
    logout: customerLogout,
  } = useAuthStore()

  const {
    barber,
    isLoggedIn: isBarberLoggedIn,
    isLoading: isBarberLoading,
    isInitialized: isBarberInitialized,
    isAdmin,
    logout: barberLogout,
  } = useBarberAuthStore()

  // Determine the current user type
  // Priority: barber > customer > guest (for security - barbers have more access)
  const type = useMemo<UserType>(() => {
    if (isBarberLoggedIn && barber) {
      return 'barber'
    }
    if (isCustomerLoggedIn && customer) {
      return 'customer'
    }
    return 'guest'
  }, [isBarberLoggedIn, barber, isCustomerLoggedIn, customer])

  // Get the current user data
  const user = useMemo(() => {
    if (type === 'barber') return barber
    if (type === 'customer') return customer
    return null
  }, [type, barber, customer])

  // Get display name
  const displayName = useMemo(() => {
    if (type === 'barber' && barber) {
      return barber.fullname || (barber.email ? barber.email.split('@')[0] : 'ספר')
    }
    if (type === 'customer' && customer) {
      return customer.fullname
    }
    return 'אורח'
  }, [type, barber, customer])

  // Unified logout - clears BOTH sessions for security
  const logout = useCallback(() => {
    customerLogout()
    barberLogout()
  }, [customerLogout, barberLogout])

  // Check if another account type is logged in
  const isOtherAccountLoggedIn = useCallback((targetType: 'customer' | 'barber'): boolean => {
    if (targetType === 'customer') {
      // Trying to log in as customer, check if barber is logged in
      return isBarberLoggedIn
    }
    // Trying to log in as barber, check if customer is logged in
    return isCustomerLoggedIn
  }, [isBarberLoggedIn, isCustomerLoggedIn])

  return {
    type,
    user,
    isLoggedIn: type !== 'guest',
    isInitialized: isCustomerInitialized && isBarberInitialized,
    isLoading: isCustomerLoading || isBarberLoading,
    customer: type === 'customer' ? customer : null,
    barber: type === 'barber' ? barber : null,
    isAdmin: type === 'barber' ? isAdmin : false,
    displayName,
    logout,
    isOtherAccountLoggedIn,
  }
}

