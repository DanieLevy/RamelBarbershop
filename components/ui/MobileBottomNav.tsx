'use client'

import { useState, useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Home, Search, Calendar, User, LayoutDashboard, LogIn, Scissors } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useCurrentUser, type UserType } from '@/hooks/useCurrentUser'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { usePushStore } from '@/store/usePushStore'
import { usePWA } from '@/hooks/usePWA'
import { LoginModal } from '@/components/LoginModal'

interface NavItem {
  id: string
  label: string
  labelActive?: string
  href?: string
  icon: LucideIcon
  action?: () => void
}

export function MobileBottomNav() {
  const pathname = usePathname()
  const router = useRouter()
  
  // Use unified auth hook
  const { type: userRole, isInitialized } = useCurrentUser()
  
  // Push notifications state for badge - use shared store for real-time sync
  const push = usePushNotifications()
  const pushStore = usePushStore()
  const pwa = usePWA()
  
  // Show badge on profile when notifications need setup
  // Use shared store for real-time sync, but fallback to hook state
  const isSubscribedRealtime = pushStore.isSubscribed || push.isSubscribed
  const isSupportedRealtime = pushStore.isSupported || push.isSupported
  const permissionRealtime = pushStore.permission !== 'unavailable' ? pushStore.permission : push.permission
  
  // Only show when: in PWA, logged in, push supported but not subscribed
  const showNotificationBadge = 
    pwa.isStandalone && 
    userRole === 'customer' && 
    isSupportedRealtime && 
    !isSubscribedRealtime &&
    permissionRealtime !== 'denied'
  
  // UI State
  const [isVisible, setIsVisible] = useState(true)
  const [showLoginDropup, setShowLoginDropup] = useState(false)
  const [showLoginModal, setShowLoginModal] = useState(false)
  
  // Scroll tracking
  const lastScrollY = useRef(0)
  const scrollTimeout = useRef<NodeJS.Timeout | null>(null)
  const dropupRef = useRef<HTMLDivElement>(null)

  // Don't show on dashboard pages or barber booking wizard
  const shouldHide = pathname.startsWith('/barber/dashboard') || 
                     pathname.includes('/book') ||
                     (pathname.startsWith('/barber/') && pathname !== '/barber/login' && !pathname.match(/^\/barber\/[^/]+$/))

  
  // Scroll-based hide/show logic
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY
      const isScrollingDown = currentScrollY > lastScrollY.current
      const isNearBottom = window.innerHeight + currentScrollY >= document.body.scrollHeight - 100
      
      // Hide when scrolling down, show when scrolling up or near bottom
      if (isScrollingDown && currentScrollY > 100) {
        setIsVisible(false)
      } else {
        setIsVisible(true)
      }
      
      // Always show when near bottom
      if (isNearBottom) {
        setIsVisible(true)
      }
      
      lastScrollY.current = currentScrollY
      
      // Clear existing timeout
      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current)
      }
      
      // Show after user stops scrolling
      scrollTimeout.current = setTimeout(() => {
        setIsVisible(true)
      }, 300)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', handleScroll)
      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current)
      }
    }
  }, [])

  // Close dropup when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropupRef.current && !dropupRef.current.contains(event.target as Node)) {
        setShowLoginDropup(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Close dropup on route change
  useEffect(() => {
    setShowLoginDropup(false)
  }, [pathname])

  // Fallback: show nav after timeout even if auth isn't initialized
  const [forceShow, setForceShow] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => {
      setForceShow(true)
    }, 2000) // 2 second fallback
    return () => clearTimeout(timer)
  }, [])

  if (shouldHide) {
    return null
  }

  // Wait for auth to initialize (with fallback)
  const isReady = isInitialized || forceShow
  if (!isReady) {
    return null
  }

  const scrollToTeam = () => {
    if (pathname !== '/') {
      router.push('/')
      setTimeout(() => {
        const el = document.querySelector('.index-body')
        el?.scrollIntoView({ behavior: 'smooth' })
      }, 500)
    } else {
      const el = document.querySelector('.index-body')
      el?.scrollIntoView({ behavior: 'smooth' })
    }
  }

  // Navigation items based on role
  const getNavItems = (role: UserType): NavItem[] => {
    switch (role) {
      case 'barber':
        // Barber-specific navigation with quick access to their upcoming customer appointments
        return [
          { id: 'home', label: 'בית', href: '/', icon: Home },
          { id: 'dashboard', label: 'לוח בקרה', href: '/barber/dashboard', icon: LayoutDashboard },
          { id: 'upcoming', label: 'יומן', labelActive: 'יומן', href: '/barber/dashboard/reservations', icon: Calendar },
          { id: 'profile', label: 'פרופיל', href: '/barber/profile', icon: User },
        ]
      case 'customer':
        return [
          { id: 'home', label: 'בית', href: '/', icon: Home },
          { id: 'search', label: 'חיפוש', icon: Search, action: scrollToTeam },
          { id: 'calendar', label: 'התורים שלי', labelActive: 'תורים', href: '/my-appointments', icon: Calendar },
          { id: 'profile', label: 'פרופיל', href: '/profile', icon: User },
        ]
      default: // guest
        return [
          { id: 'home', label: 'בית', href: '/', icon: Home },
          { id: 'search', label: 'חיפוש', icon: Search, action: scrollToTeam },
          { id: 'calendar', label: 'תורים', href: '/my-appointments', icon: Calendar },
          { id: 'login', label: 'התחברות', icon: LogIn, action: () => setShowLoginDropup(true) },
        ]
    }
  }

  const navItems = getNavItems(userRole)

  const getActiveItem = (): string => {
    if (pathname === '/my-appointments') return 'calendar'
    if (pathname === '/profile') return 'profile'
    if (pathname === '/barber/dashboard/profile') return 'profile'
    if (pathname === '/barber/dashboard') return 'dashboard'
    if (pathname.startsWith('/barber/dashboard/reservations')) return 'upcoming'
    if (pathname.startsWith('/barber/')) return 'login'
    if (pathname === '/') return 'home'
    return 'home'
  }

  const activeItem = getActiveItem()

  const handleClick = (item: NavItem) => {
    setShowLoginDropup(false)
    if (item.action) {
      item.action()
    } else if (item.href) {
      router.push(item.href)
    }
  }

  const handleCustomerLogin = () => {
    setShowLoginDropup(false)
    setShowLoginModal(true)
  }

  const handleBarberLogin = () => {
    setShowLoginDropup(false)
    router.push('/barber/login')
  }

  return (
    <>
      <div 
        className={cn(
          'fixed bottom-0 left-0 right-0 z-50 pointer-events-none',
          'transition-all duration-300 ease-out',
          // Mobile: centered floating pill with padding
          'flex justify-center pb-6 px-4',
          // Desktop: full width bar at bottom
          'md:pb-0 md:px-0',
          isVisible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
        )}
      >
        {/* Login Dropup Menu */}
        {showLoginDropup && (
          <div 
            ref={dropupRef}
            className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 pointer-events-auto animate-fade-in md:mb-4"
          >
            <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden min-w-[200px]">
              <div className="p-1">
                <button
                  onClick={handleCustomerLogin}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-foreground-light hover:bg-white/5 transition-colors"
                >
                  <User size={20} strokeWidth={1.5} className="text-accent-gold" />
                  <span className="text-sm font-medium">כניסה כלקוח</span>
                </button>
                <button
                  onClick={handleBarberLogin}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-foreground-light hover:bg-white/5 transition-colors"
                >
                  <Scissors size={20} strokeWidth={1.5} className="text-accent-gold" />
                  <span className="text-sm font-medium">כניסה כספר</span>
                </button>
              </div>
            </div>
            {/* Arrow pointing down */}
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-[#1a1a1a] border-r border-b border-white/10 rotate-45" />
          </div>
        )}

        <nav
          className={cn(
            'pointer-events-auto',
            // Mobile: Floating pill shape
            'inline-flex items-center gap-1',
            'px-2 py-2',
            'rounded-full',
            // Desktop: Full width bar
            'md:w-full md:rounded-none md:px-0 md:py-0',
            'md:justify-center md:gap-0',
            // Dark glassmorphism background
            'bg-[#1a1a1a]/95 backdrop-blur-xl',
            // Subtle border and shadow
            'border border-white/10',
            'md:border-x-0 md:border-b-0',
            'shadow-[0_8px_32px_rgba(0,0,0,0.4)] md:shadow-[0_-4px_20px_rgba(0,0,0,0.3)]'
          )}
          role="navigation"
          aria-label="תפריט ניווט ראשי"
        >
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = activeItem === item.id
            const displayLabel = isActive && item.labelActive ? item.labelActive : item.label
            
            return (
              <button
                key={item.id}
                onClick={() => handleClick(item)}
                className={cn(
                  // Base styles
                  'relative flex items-center justify-center gap-2',
                  'transition-all duration-300 ease-out',
                  // Mobile: Rounded pill for each item
                  'rounded-full',
                  // Desktop: Square items in row
                  'md:rounded-none md:flex-1 md:max-w-[200px]',
                  // Size and padding - Mobile
                  isActive 
                    ? 'px-4 py-2.5' 
                    : 'p-3',
                  // Desktop padding
                  'md:px-6 md:py-4',
                  // Active state - gold background (mobile) / gold underline (desktop)
                  isActive 
                    ? 'bg-accent-gold text-background-dark md:bg-transparent md:text-accent-gold md:border-b-2 md:border-accent-gold' 
                    : 'text-foreground-muted hover:text-foreground-light md:border-b-2 md:border-transparent',
                  // Touch feedback
                  'active:scale-95 md:active:scale-100',
                  // Focus styles
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold/50'
                )}
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
              >
                {/* Icon container with optional badge */}
                <div className="relative flex-shrink-0">
                  <Icon
                    size={20}
                    strokeWidth={isActive ? 2.5 : 1.5}
                  />
                  
                  {/* Notification badge for profile tab */}
                  {item.id === 'profile' && showNotificationBadge && !isActive && (
                    <div className="absolute -top-1.5 -right-1.5 flex items-center justify-center">
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border border-background-dark" />
                      </span>
                    </div>
                  )}
                </div>
                
                {/* Label - Mobile: only visible when active. Desktop: always visible */}
                <span className={cn(
                  'text-sm font-semibold whitespace-nowrap',
                  // Mobile: hide when not active
                  !isActive && 'hidden md:block',
                  // Desktop: always show, adjust font weight
                  'md:font-medium'
                )}>
                  {displayLabel}
                </span>
              </button>
            )
          })}
        </nav>
      </div>

      {/* Login Modal */}
      <LoginModal 
        isOpen={showLoginModal} 
        onClose={() => setShowLoginModal(false)} 
      />
    </>
  )
}
