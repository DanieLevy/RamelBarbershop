'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
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
  
  // Touch gesture state for swipe-to-open sidebar
  const touchStartX = useRef<number | null>(null)
  const touchStartY = useRef<number | null>(null)

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

  // Swipe gesture handling for opening sidebar
  const handleTouchStart = useCallback((e: TouchEvent) => {
    // Only track touches starting from the right edge (RTL - swipe left to open)
    const touch = e.touches[0]
    if (touch.clientX > window.innerWidth - 30) {
      touchStartX.current = touch.clientX
      touchStartY.current = touch.clientY
    }
  }, [])

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return
    
    const touch = e.touches[0]
    const deltaX = touchStartX.current - touch.clientX
    const deltaY = Math.abs(touch.clientY - touchStartY.current)
    
    // Horizontal swipe from right edge (swipe left in RTL = open menu)
    if (deltaX > 50 && deltaY < 30) {
      setIsSidebarOpen(true)
      touchStartX.current = null
      touchStartY.current = null
    }
  }, [])

  const handleTouchEnd = useCallback(() => {
    touchStartX.current = null
    touchStartY.current = null
  }, [])

  // Register touch event listeners
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      document.addEventListener('touchstart', handleTouchStart, { passive: true })
      document.addEventListener('touchmove', handleTouchMove, { passive: true })
      document.addEventListener('touchend', handleTouchEnd, { passive: true })
      
      return () => {
        document.removeEventListener('touchstart', handleTouchStart)
        document.removeEventListener('touchmove', handleTouchMove)
        document.removeEventListener('touchend', handleTouchEnd)
      }
    }
  }, [handleTouchStart, handleTouchMove, handleTouchEnd])

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
    <div 
      className="min-h-screen bg-background-dark" 
      dir="rtl"
      style={{
        // iOS smooth scrolling
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {/* Mobile header - with safe area padding */}
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
        
        {/* Main content with smooth scrolling */}
        <main 
          className="flex-1 overflow-auto min-h-screen"
          style={{
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {/* Safe area padding for notch + header height on mobile */}
          <div 
            className="p-4 sm:p-6 lg:p-8 lg:pt-8"
            style={{
              // Mobile: account for header + safe area
              paddingTop: 'calc(var(--header-top-offset, 0px) + 5rem)',
            }}
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
