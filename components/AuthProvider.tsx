'use client'

import { useEffect, type ReactNode } from 'react'
import { useAuthStore } from '@/store/useAuthStore'

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const checkSession = useAuthStore((state) => state.checkSession)

  useEffect(() => {
    checkSession()
  }, [checkSession])

  return <>{children}</>
}

