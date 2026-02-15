'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Home, Search, Calendar, User, LayoutDashboard, LogIn, Scissors } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useCurrentUser, type UserType } from '@/hooks/useCurrentUser'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { usePushStore } from '@/store/usePushStore'
import { usePWA } from '@/hooks/usePWA'
import { LoginModal } from '@/components/LoginModal'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/store/useAuthStore'
import { useHaptics } from '@/hooks/useHaptics'

// ============================================================================
// Types
// ============================================================================

interface NavItem {
  id: string
  label: string
  href?: string
  icon: LucideIcon
  action?: () => void
}

// ============================================================================
// Component
// ============================================================================

export function MobileBottomNav() {
  const pathname = usePathname()
  const router = useRouter()
  const haptics = useHaptics()

  // Auth
  const { type: userRole, isInitialized } = useCurrentUser()

  // Push notifications state for badge
  const push = usePushNotifications()
  const pushStore = usePushStore()
  const pwa = usePWA()

  const isSubscribedRealtime = pushStore.isSubscribed || push.isSubscribed
  const isSupportedRealtime = pushStore.isSupported || push.isSupported
  const permissionRealtime = pushStore.permission !== 'unavailable' ? pushStore.permission : push.permission

  const { customer } = useAuthStore()

  const isLoggedInUser = userRole === 'customer' || userRole === 'barber'
  const isCustomer = userRole === 'customer'
  const hasPermissionIssue = permissionRealtime === 'denied'
  const needsSubscription = isSupportedRealtime && !isSubscribedRealtime
  const isMissingPhone = isCustomer && customer && !customer.phone

  const showNotificationBadge =
    isLoggedInUser && pwa.isStandalone && (needsSubscription || hasPermissionIssue)
  const showPhoneBadge = isMissingPhone
  const isUrgentBadge = hasPermissionIssue

  // UI State
  const [isVisible, setIsVisible] = useState(true)
  const [showLoginDropup, setShowLoginDropup] = useState(false)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [upcomingCount, setUpcomingCount] = useState(0)

  // Scroll tracking
  const lastScrollY = useRef(0)
  const scrollTimeout = useRef<NodeJS.Timeout | null>(null)
  const dropupRef = useRef<HTMLDivElement>(null)
  const navRef = useRef<HTMLElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])

  // Active pill position - measured from DOM for RTL correctness
  const [pillStyle, setPillStyle] = useState<{ left: number; width: number } | null>(null)

  // ── Fetch upcoming appointments count ──

  const fetchUpcomingCount = useCallback(async () => {
    if (userRole !== 'customer' || !customer?.id) {
      setUpcomingCount(0)
      return
    }

    try {
      const supabase = createClient()
      const now = Date.now()

      const { count, error } = await supabase
        .from('reservations')
        .select('id', { count: 'exact', head: true })
        .eq('customer_id', customer.id)
        .eq('status', 'confirmed')
        .gt('time_timestamp', now)

      if (!error && count !== null) {
        setUpcomingCount(count)
      }
    } catch (err) {
      console.error('Error fetching upcoming appointments count:', err)
    }
  }, [userRole, customer?.id])

  useEffect(() => {
    fetchUpcomingCount()
    const interval = setInterval(fetchUpcomingCount, 30000)
    return () => clearInterval(interval)
  }, [fetchUpcomingCount])

  // ── Page visibility rules ──

  const shouldHide =
    pathname.startsWith('/barber/dashboard') ||
    pathname.includes('/book') ||
    pathname.startsWith('/dev') ||
    !!pathname.match(/^\/barber\/[^/]+$/)

  // ── Scroll-based visibility ──

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY
      const isScrollingDown = currentScrollY > lastScrollY.current
      const isNearBottom = window.innerHeight + currentScrollY >= document.body.scrollHeight - 100

      if (isScrollingDown && currentScrollY > 100) {
        setIsVisible(false)
      } else {
        setIsVisible(true)
      }

      if (isNearBottom) {
        setIsVisible(true)
      }

      lastScrollY.current = currentScrollY

      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current)
      }

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

  // Close dropup on outside click
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

  // Fallback: show nav after timeout
  const [forceShow, setForceShow] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setForceShow(true), 2000)
    return () => clearTimeout(timer)
  }, [])

  // ── Navigation ──

  const scrollToTeam = useCallback(() => {
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
  }, [pathname, router])

  const getNavItems = useCallback(
    (role: UserType): NavItem[] => {
      switch (role) {
        case 'barber':
          return [
            { id: 'home', label: 'בית', href: '/', icon: Home },
            { id: 'dashboard', label: 'לוח בקרה', href: '/barber/dashboard', icon: LayoutDashboard },
            { id: 'upcoming', label: 'יומן', href: '/barber/dashboard/reservations', icon: Calendar },
            { id: 'profile', label: 'פרופיל', href: '/barber/profile', icon: User },
          ]
        case 'customer':
          return [
            { id: 'home', label: 'בית', href: '/', icon: Home },
            { id: 'search', label: 'חיפוש', icon: Search, action: scrollToTeam },
            { id: 'calendar', label: 'תורים', href: '/my-appointments', icon: Calendar },
            { id: 'profile', label: 'פרופיל', href: '/profile', icon: User },
          ]
        default:
          return [
            { id: 'home', label: 'בית', href: '/', icon: Home },
            { id: 'search', label: 'חיפוש', icon: Search, action: scrollToTeam },
            { id: 'calendar', label: 'תורים', href: '/my-appointments', icon: Calendar },
            { id: 'login', label: 'כניסה', icon: LogIn, action: () => setShowLoginDropup(true) },
          ]
      }
    },
    [scrollToTeam]
  )

  const navItems = useMemo(() => getNavItems(userRole), [getNavItems, userRole])

  const activeItem = useMemo((): string => {
    if (pathname === '/my-appointments') return 'calendar'
    if (pathname === '/profile') return 'profile'
    if (pathname === '/barber/dashboard/profile') return 'profile'
    if (pathname === '/barber/dashboard') return 'dashboard'
    if (pathname.startsWith('/barber/dashboard/reservations')) return 'upcoming'
    if (pathname.startsWith('/barber/')) return 'login'
    if (pathname === '/') return 'home'
    return 'home'
  }, [pathname])

  const activeIndex = useMemo(
    () => navItems.findIndex((item) => item.id === activeItem),
    [navItems, activeItem]
  )

  // ── Measure active item position for pill indicator ──
  useEffect(() => {
    if (activeIndex < 0 || !navRef.current) return

    const measure = () => {
      const activeBtn = itemRefs.current[activeIndex]
      const navEl = navRef.current
      if (!activeBtn || !navEl) return

      const navRect = navEl.getBoundingClientRect()
      const btnRect = activeBtn.getBoundingClientRect()

      setPillStyle({
        left: btnRect.left - navRect.left,
        width: btnRect.width,
      })
    }

    requestAnimationFrame(measure)
  }, [activeIndex, navItems])

  // Determine pill border-radius based on position (edge-matching)
  const pillBorderRadius = useMemo(() => {
    const navRadius = 16 // matches rounded-2xl (16px)
    const innerRadius = 12
    const isFirst = activeIndex === 0
    const isLast = activeIndex === navItems.length - 1

    // RTL: first item is on the RIGHT, last item is on the LEFT
    return {
      borderTopRightRadius: isFirst ? navRadius : innerRadius,
      borderBottomRightRadius: isFirst ? navRadius : innerRadius,
      borderTopLeftRadius: isLast ? navRadius : innerRadius,
      borderBottomLeftRadius: isLast ? navRadius : innerRadius,
    }
  }, [activeIndex, navItems.length])

  const handleClick = useCallback(
    (item: NavItem) => {
      setShowLoginDropup(false)
      haptics.light()
      if (item.action) {
        item.action()
      } else if (item.href) {
        router.push(item.href)
      }
    },
    [haptics, router]
  )

  const handleCustomerLogin = useCallback(() => {
    setShowLoginDropup(false)
    setShowLoginModal(true)
  }, [])

  const handleBarberLogin = useCallback(() => {
    setShowLoginDropup(false)
    router.push('/barber/login')
  }, [router])

  // ── Early returns ──

  if (shouldHide) return null

  const isReady = isInitialized || forceShow
  if (!isReady) return null

  // ── Render ──

  return (
    <>
      <div
        className={cn(
          'fixed bottom-0 left-0 right-0 z-50 pointer-events-none',
          'transition-all duration-300 ease-out',
          'flex justify-center',
          'px-3 md:px-0',
          isVisible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
        )}
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 10px)' }}
      >
        {/* Login Dropup */}
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
                  tabIndex={0}
                >
                  <User size={20} strokeWidth={1.5} className="text-accent-gold" />
                  <span className="text-sm font-medium">כניסה כלקוח</span>
                </button>
                <button
                  onClick={handleBarberLogin}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-foreground-light hover:bg-white/5 transition-colors"
                  tabIndex={0}
                >
                  <Scissors size={20} strokeWidth={1.5} className="text-accent-gold" />
                  <span className="text-sm font-medium">כניסה כספר</span>
                </button>
              </div>
            </div>
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-[#1a1a1a] border-r border-b border-white/10 rotate-45" />
          </div>
        )}

        {/* ── Bottom Navigation Bar ── */}
        <nav
          ref={navRef}
          className={cn(
            'pointer-events-auto relative',
// calc the best width for the bottom nav bar based on the screen width
            'w-[calc(100%-100px)] max-w-[calc(100%-50px)]',
            'h-[60px] rounded-2xl',
            'flex items-center',
            // iOS 26: fixed elements' bg-color affects forehead/chin tint.
            // Using #080b0d (same as body) prevents tint mismatch in notch area.
            'bg-[#080b0d] backdrop-blur-xl',
            'border border-white/[0.06]',
            'shadow-[0_4px_24px_rgba(0,0,0,0.6)]',
            // Padding for pill vertical inset
            'py-[6px] px-[6px]',
            'md:max-w-none md:w-full md:rounded-none md:h-14 md:py-0 md:px-0'
          )}
          role="tablist"
          aria-label="תפריט ניווט ראשי"
        >
          {/* Animated active pill - solid gold, DOM-measured for RTL */}
          {pillStyle && activeIndex >= 0 && (
            <div
              className={cn(
                'absolute h-[calc(100%-12px)] top-[6px]',
                'bg-accent-gold',
                'transition-all duration-300 ease-out',
                'md:hidden',
              )}
              style={{
                left: pillStyle.left,
                width: pillStyle.width,
                ...pillBorderRadius,
              }}
            />
          )}

          {navItems.map((item, idx) => {
            const Icon = item.icon
            const isActive = activeItem === item.id

            return (
              <button
                key={item.id}
                ref={(el) => { itemRefs.current[idx] = el }}
                onClick={() => handleClick(item)}
                className={cn(
                  'relative z-10 flex-1 flex items-center justify-center',
                  'min-w-[44px] min-h-[44px]',
                  'transition-all duration-200 ease-out',
                  
                  // Active: horizontal icon + label, inactive: icon + small label below
                  isActive
                    ? 'flex-row gap-1.5'
                    : 'flex-col gap-0.5',
                  'md:max-w-[200px] md:h-full md:flex-col md:gap-0.5',
                  
                  // Colors: active = dark on gold, inactive = muted
                  isActive
                    ? 'text-background-dark font-semibold'
                    : 'text-foreground-muted hover:text-foreground-light',
                    
                  // Touch
                  'active:scale-95 md:active:scale-100',
                  // Focus
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold/50 focus-visible:rounded-lg'
                )}
                role="tab"
                aria-selected={isActive}
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
                tabIndex={0}
              >
                {/* Icon with optional badge */}
                <div className="relative shrink-0">
                  <Icon size={isActive ? 22 : 20} strokeWidth={isActive ? 2.5 : 1.5} />

                  {/* Profile badge */}
                  {item.id === 'profile' && (showNotificationBadge || showPhoneBadge) && (
                    <div className="absolute -top-1 -right-1">
                      <span className="relative flex h-2 w-2">
                        <span
                          className={cn(
                            'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75',
                            showNotificationBadge
                              ? isUrgentBadge ? 'bg-amber-400' : 'bg-red-400'
                              : 'bg-orange-400'
                          )}
                        />
                        <span
                          className={cn(
                            'relative inline-flex rounded-full h-2 w-2',
                            showNotificationBadge
                              ? isUrgentBadge ? 'bg-amber-500' : 'bg-red-500'
                              : 'bg-orange-500'
                          )}
                        />
                      </span>
                    </div>
                  )}

                  {/* Calendar count badge */}
                  {item.id === 'calendar' && upcomingCount > 0 && (
                    <div className="absolute -top-1.5 -right-2.5">
                      <span
                        className={cn(
                          'inline-flex items-center justify-center min-w-[16px] h-[16px] px-0.5',
                          'text-[9px] font-bold rounded-full',
                          'bg-red-500 text-white'
                        )}
                      >
                        {upcomingCount > 9 ? '9+' : upcomingCount}
                      </span>
                    </div>
                  )}
                </div>

                {/* Label */}
                <span
                  className={cn(
                    'font-semibold whitespace-nowrap leading-tight',
                    isActive
                      ? 'text-[12px] md:text-[10px]'
                      : 'text-[10px] opacity-50'
                  )}
                >
                  {item.label}
                </span>
              </button>
            )
          })}
        </nav>
      </div>

      {/* Login Modal */}
      <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
    </>
  )
}
