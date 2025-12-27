'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useBarberAuthStore } from '@/store/useBarberAuthStore'
import { DashboardSidebar } from '@/components/barber/DashboardSidebar'
import { DashboardMobileHeader } from '@/components/barber/DashboardMobileHeader'
import { ScissorsLoader } from '@/components/ui/ScissorsLoader'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const { isLoggedIn, isLoading, isInitialized, checkSession, barber } = useBarberAuthStore()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  useEffect(() => {
    checkSession()
  }, [checkSession])

  useEffect(() => {
    if (isInitialized && !isLoggedIn) {
      router.replace('/barber/login')
    }
  }, [isInitialized, isLoggedIn, router])

  // Close sidebar on resize to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsSidebarOpen(false)
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  if (!isInitialized || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-dark">
        <ScissorsLoader size="lg" text="טוען..." />
      </div>
    )
  }

  if (!isLoggedIn) {
    return null
  }

  return (
    <div className="min-h-screen bg-background-dark" dir="rtl">
      {/* Mobile header */}
      <DashboardMobileHeader
        barberName={barber?.fullname || ''}
        onMenuToggle={() => setIsSidebarOpen(true)}
      />
      
      <div className="flex">
        {/* Sidebar - desktop */}
        <div className="hidden lg:block">
          <DashboardSidebar />
        </div>
        
        {/* Sidebar - mobile drawer */}
        <DashboardSidebar
          isMobileOpen={isSidebarOpen}
          onMobileClose={() => setIsSidebarOpen(false)}
        />
        
        {/* Main content */}
        <main className="flex-1 overflow-auto min-h-screen">
          {/* Add top padding on mobile for the fixed header */}
          <div className="p-4 sm:p-6 lg:p-8 pt-20 lg:pt-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
