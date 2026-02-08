'use client'

import { useAuthStore } from '@/store/useAuthStore'
import { UnifiedProfilePage } from '@/components/profile/UnifiedProfilePage'
import type { ProfileUser } from '@/components/profile/UnifiedProfilePage'

export default function ProfilePage() {
  const { customer, isLoggedIn, isLoading, isInitialized, logout } = useAuthStore()

  const user: ProfileUser | null = customer
    ? {
        id: customer.id,
        fullname: customer.fullname,
        phone: customer.phone,
        created_at: customer.created_at,
      }
    : null

  const handleNameUpdate = (newName: string) => {
    if (!customer) return
    useAuthStore.setState({
      customer: { ...customer, fullname: newName },
    })
  }

  if (!user) {
    return (
      <UnifiedProfilePage
        userType="customer"
        user={{ id: '', fullname: '', phone: '' }}
        isLoggedIn={isLoggedIn}
        isLoading={isLoading}
        isInitialized={isInitialized}
        logout={logout}
        allowNameEdit
        onNameUpdate={handleNameUpdate}
      />
    )
  }

  return (
    <UnifiedProfilePage
      userType="customer"
      user={user}
      isLoggedIn={isLoggedIn}
      isLoading={isLoading}
      isInitialized={isInitialized}
      logout={logout}
      allowNameEdit
      onNameUpdate={handleNameUpdate}
    />
  )
}
