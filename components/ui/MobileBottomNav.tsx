'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Home, Search, Calendar, User, LayoutDashboard, Users, LogIn, Scissors } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAuthStore } from '@/store/useAuthStore'
import { useBarberAuthStore } from '@/store/useBarberAuthStore'
import { LoginModal } from '@/components/LoginModal'

interface NavItem {
  id: string
  label: string
  labelActive?: string
  href?: string
  icon: LucideIcon
  action?: () => void
}

type UserRole = 'guest' | 'customer' | 'barber'

export function MobileBottomNav() {
  const pathname = usePathname()
  const router = useRouter()
  
  // Auth stores
  const { isLoggedIn: isCustomerLoggedIn, isInitialized: customerInitialized } = useAuthStore()
  const { isLoggedIn: isBarberLoggedIn, isInitialized: barberInitialized } = useBarberAuthStore()
  
  // UI State
  const [isVisible, setIsVisible] = useState(true)
  const [showLoginDropup, setShowLoginDropup] = useState(false)
  const [showLoginModal, setShowLoginModal] = useState(false)
  
  // Scroll tracking
  const lastScrollY = useRef(0)
  const scrollTimeout = useRef<NodeJS.Timeout | null>(null)
  const dropupRef = useRef<HTMLDivElement>(null)

  // Determine user role
  const getUserRole = useCallback((): UserRole => {
    if (isBarberLoggedIn) return 'barber'
    if (isCustomerLoggedIn) return 'customer'
    return 'guest'
  }, [isBarberLoggedIn, isCustomerLoggedIn])

  const userRole = getUserRole()

  // Don't show on dashboard pages or barber booking wizard
  const shouldHide = pathname.startsWith('/barber/dashboard') || 
                     (pathname.startsWith('/barber/') && pathname !== '/barber/login')
  
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

  if (shouldHide) {
    return null
  }

  // Wait for auth to initialize
  if (!customerInitialized || !barberInitialized) {
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
  const getNavItems = (): NavItem[] => {
    switch (userRole) {
      case 'barber':
        return [
          { id: 'home', label: 'בית', href: '/', icon: Home },
          { id: 'dashboard', label: 'לוח בקרה', href: '/barber/dashboard', icon: LayoutDashboard },
          { id: 'upcoming', label: 'תורים קרובים', labelActive: 'תורים', href: '/barber/dashboard/reservations', icon: Users },
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

  const navItems = getNavItems()

  const getActiveItem = (): string => {
    if (pathname === '/my-appointments') return 'calendar'
    if (pathname === '/profile') return 'profile'
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
          'fixed bottom-0 left-0 right-0 z-50 md:hidden flex justify-center pb-6 px-4 pointer-events-none',
          'transition-all duration-300 ease-out',
          isVisible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
        )}
      >
        {/* Login Dropup Menu */}
        {showLoginDropup && (
          <div 
            ref={dropupRef}
            className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 pointer-events-auto animate-fade-in"
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
            // Floating pill shape
            'pointer-events-auto',
            'inline-flex items-center gap-1',
            'px-2 py-2',
            'rounded-full',
            // Dark glassmorphism background
            'bg-[#1a1a1a]/95 backdrop-blur-xl',
            // Subtle border and shadow
            'border border-white/10',
            'shadow-[0_8px_32px_rgba(0,0,0,0.4)]'
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
                  // Rounded pill for each item
                  'rounded-full',
                  // Size and padding
                  isActive 
                    ? 'px-4 py-2.5' 
                    : 'p-3',
                  // Active state - gold background
                  isActive 
                    ? 'bg-accent-gold text-background-dark' 
                    : 'text-foreground-muted hover:text-foreground-light',
                  // Touch feedback
                  'active:scale-95',
                  // Focus styles
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold/50'
                )}
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon
                  size={20}
                  strokeWidth={isActive ? 2.5 : 1.5}
                  className="flex-shrink-0"
                />
                
                {/* Label - only visible when active, horizontal layout */}
                {isActive && (
                  <span className="text-sm font-semibold whitespace-nowrap">
                    {displayLabel}
                  </span>
                )}
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
