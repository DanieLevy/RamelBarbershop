'use client'

import { useBarberAuthStore } from '@/store/useBarberAuthStore'
import { UnifiedProfilePage } from '@/components/profile/UnifiedProfilePage'
import type { ProfileUser } from '@/components/profile/UnifiedProfilePage'

export default function BarberProfilePage() {
  const { barber, isLoggedIn, isLoading, isInitialized, logout } = useBarberAuthStore()

  const user: ProfileUser | null = barber
    ? {
        id: barber.id,
        fullname: barber.fullname,
        phone: barber.phone,
        created_at: barber.created_at,
        img_url: barber.img_url,
        role: barber.role,
      }
    : null

  if (!user) {
    return (
      <UnifiedProfilePage
        userType="barber"
        user={{ id: '', fullname: '', phone: '' }}
        isLoggedIn={isLoggedIn}
        isLoading={isLoading}
        isInitialized={isInitialized}
        logout={logout}
        loginRedirect="/barber/login"
      />
    )
  }

  return (
    <UnifiedProfilePage
      userType="barber"
      user={user}
      isLoggedIn={isLoggedIn}
      isLoading={isLoading}
      isInitialized={isInitialized}
      logout={logout}
      loginRedirect="/barber/login"
    />
  )
}
