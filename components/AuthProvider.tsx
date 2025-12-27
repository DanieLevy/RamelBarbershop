'use client'

import { useEffect, type ReactNode } from 'react'
import { useAuthStore } from '@/store/useAuthStore'
import { useBarberAuthStore } from '@/store/useBarberAuthStore'

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const checkCustomerSession = useAuthStore((state) => state.checkSession)
  const checkBarberSession = useBarberAuthStore((state) => state.checkSession)

  useEffect(() => {
    // Initialize both auth stores in parallel
    checkCustomerSession()
    checkBarberSession()
  }, [checkCustomerSession, checkBarberSession])

  return <>{children}</>
}

