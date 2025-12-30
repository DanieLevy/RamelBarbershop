'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { LoginModal } from './LoginModal'
import { User, Calendar, LogOut, Menu, X, Home, Phone, MapPin, Scissors, ChevronDown, LayoutDashboard, Settings } from 'lucide-react'

interface AppHeaderProps {
  barberImgUrl?: string
  isWizardPage?: boolean
}

export function AppHeader({ barberImgUrl, isWizardPage = false }: AppHeaderProps) {
  const router = useRouter()
  const pathname = usePathname()
  
  const { type: userType, customer, barber, isLoggedIn, isLoading, isAdmin, displayName, logout } = useCurrentUser()
  
  const [scrollProgress, setScrollProgress] = useState(0)
  const [pageScrollProgress, setPageScrollProgress] = useState(0)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  
  const isHomePage = pathname === '/'
  const isBarberPage = pathname.includes('/barber') && !pathname.includes('/dashboard')

  const handleScroll = useCallback(() => {
    // Calculate scroll progress for header opacity (0-100px)
    const headerOpacity = Math.min(window.scrollY / 100, 1)
    setScrollProgress(headerOpacity)
    
    // Calculate page scroll progress (0-100%)
    const scrollHeight = document.documentElement.scrollHeight - window.innerHeight
    const pageProgress = scrollHeight > 0 ? (window.scrollY / scrollHeight) * 100 : 0
    setPageScrollProgress(pageProgress)
  }, [])

  useEffect(() => {
    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    setShowMobileMenu(false)
  }, [pathname])

  useEffect(() => {
    if (showMobileMenu) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [showMobileMenu])

  // Swipe gesture detection for mobile menu
  useEffect(() => {
    let touchStartX = 0
    let touchStartY = 0
    let touchEndX = 0
    const edgeThreshold = 40 // pixels from edge to trigger
    const swipeThreshold = 80 // minimum swipe distance
    
    const handleTouchStart = (e: TouchEvent) => {
      touchStartX = e.touches[0].clientX
      touchStartY = e.touches[0].clientY
    }
    
    const handleTouchEnd = (e: TouchEvent) => {
      touchEndX = e.changedTouches[0].clientX
      const touchEndY = e.changedTouches[0].clientY
      
      const deltaX = touchEndX - touchStartX
      const deltaY = Math.abs(touchEndY - touchStartY)
      
      // Only trigger if horizontal swipe is dominant
      if (deltaY > Math.abs(deltaX)) return
      
      const screenWidth = window.innerWidth
      const isRTL = document.documentElement.dir === 'rtl' || document.documentElement.lang === 'he'
      
      if (!showMobileMenu) {
        // Open menu: In RTL, swipe from right edge towards left (negative deltaX, start near right edge)
        // In LTR, swipe from left edge towards right (positive deltaX, start near left edge)
        if (isRTL) {
          // Touch started near right edge and swiped left
          if (touchStartX > screenWidth - edgeThreshold && deltaX < -swipeThreshold) {
            setShowMobileMenu(true)
          }
        } else {
          // Touch started near left edge and swiped right
          if (touchStartX < edgeThreshold && deltaX > swipeThreshold) {
            setShowMobileMenu(true)
          }
        }
      } else {
        // Close menu: swipe in opposite direction
        if (isRTL) {
          // Swipe right to close
          if (deltaX > swipeThreshold) {
            setShowMobileMenu(false)
          }
        } else {
          // Swipe left to close
          if (deltaX < -swipeThreshold) {
            setShowMobileMenu(false)
          }
        }
      }
    }
    
    document.addEventListener('touchstart', handleTouchStart, { passive: true })
    document.addEventListener('touchend', handleTouchEnd, { passive: true })
    
    return () => {
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchend', handleTouchEnd)
    }
  }, [showMobileMenu])

  const scrollToSection = (className: string) => {
    setShowMobileMenu(false)
    
    const doScroll = () => {
      if (className === 'index-header') {
        window.scrollTo({ top: 0, behavior: 'smooth' })
        return
      }
      
      const el = document.querySelector(`.${className}`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' })
      }
    }
    
    if (pathname !== '/') {
      router.push('/')
      // Poll for element with increasing delays, up to 3 seconds total
      let attempts = 0
      const maxAttempts = 15
      const pollInterval = 200
      
      const pollForElement = () => {
        attempts++
        const el = document.querySelector(`.${className}`)
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' })
        } else if (attempts < maxAttempts) {
          setTimeout(pollForElement, pollInterval)
        }
      }
      
      // Start polling after initial delay for navigation
      setTimeout(pollForElement, 300)
      return
    }

    doScroll()
  }

  const handleLogout = () => {
    logout()
    setShowUserMenu(false)
    setShowMobileMenu(false)
  }

  const handleMyAppointments = () => {
    router.push('/my-appointments')
    setShowUserMenu(false)
    setShowMobileMenu(false)
  }

  const isScrolled = scrollProgress > 0.3
  const showHeaderLogo = scrollProgress > 0.5

  const UserButton = ({ compact = false }: { compact?: boolean }) => {
    if (!isLoggedIn) {
      return (
        <button
          onClick={() => setShowLoginModal(true)}
          disabled={isLoading}
          className={cn(
            'flex items-center gap-2 rounded-full transition-all font-medium',
            compact
              ? 'px-3 py-2 text-xs'
              : 'px-4 py-2.5 text-sm',
            'bg-accent-gold text-background-dark hover:bg-accent-gold/90',
            isLoading && 'opacity-50 cursor-not-allowed'
          )}
        >
          <User size={compact ? 14 : 16} strokeWidth={2} />
          <span>{compact ? 'כניסה' : 'התחברות'}</span>
        </button>
      )
    }

    if (userType === 'barber' && barber) {
      return (
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className={cn(
              'flex items-center gap-2 rounded-full transition-all',
              'bg-accent-gold/10 hover:bg-accent-gold/20',
              'backdrop-blur-md border border-accent-gold/30',
              'shadow-[0_2px_12px_rgba(255,170,61,0.1)]',
              compact ? 'px-2.5 py-1.5' : 'px-3 py-2'
            )}
          >
            <div className={cn(
              'rounded-full bg-accent-gold/30 backdrop-blur-sm flex items-center justify-center',
              compact ? 'w-6 h-6' : 'w-7 h-7'
            )}>
              <Scissors size={compact ? 12 : 14} strokeWidth={1.5} className="text-accent-gold" />
            </div>
            <span className={cn(
              'max-w-[80px] truncate text-accent-gold font-medium',
              compact ? 'text-xs hidden sm:block' : 'text-sm'
            )}>
              {displayName.split(' ')[0]}
            </span>
            <ChevronDown size={14} strokeWidth={1.5} className={cn(
              'text-accent-gold/70 transition-transform',
              showUserMenu && 'rotate-180'
            )} />
          </button>

          {showUserMenu && (
            <div className="absolute left-0 top-full mt-2 w-56 bg-background-darker/95 backdrop-blur-xl border border-accent-gold/20 rounded-2xl shadow-2xl overflow-hidden z-50 animate-fade-in">
              <div className="p-4 border-b border-white/10 bg-gradient-to-r from-accent-gold/15 to-transparent">
                <div className="flex items-center gap-2">
                  <Scissors size={14} strokeWidth={1.5} className="text-accent-gold" />
                  <span className="text-accent-gold text-xs font-medium">
                    {isAdmin ? 'מנהל' : 'ספר'}
                  </span>
                </div>
                <p className="text-foreground-light font-medium truncate mt-1">
                  {displayName}
                </p>
                <p className="text-foreground-muted text-xs mt-0.5" dir="ltr">
                  {barber.email}
                </p>
              </div>

              <div className="p-2">
                <button
                  onClick={() => {
                    router.push('/barber/dashboard')
                    setShowUserMenu(false)
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-foreground-light hover:bg-white/5 transition-colors"
                >
                  <LayoutDashboard size={18} strokeWidth={1.5} className="text-accent-gold" />
                  <span className="text-sm">לוח בקרה</span>
                </button>

                <button
                  onClick={() => {
                    router.push('/barber/dashboard/reservations')
                    setShowUserMenu(false)
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-foreground-light hover:bg-white/5 transition-colors"
                >
                  <Calendar size={18} strokeWidth={1.5} className="text-accent-gold" />
                  <span className="text-sm">תורים קרובים</span>
                </button>

                {isAdmin && (
                  <button
                    onClick={() => {
                      router.push('/barber/dashboard/settings')
                      setShowUserMenu(false)
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-foreground-light hover:bg-white/5 transition-colors"
                  >
                    <Settings size={18} strokeWidth={1.5} className="text-accent-gold" />
                    <span className="text-sm">הגדרות</span>
                  </button>
                )}

                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <LogOut size={18} strokeWidth={1.5} />
                  <span className="text-sm">התנתק</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )
    }

    if (userType === 'customer' && customer) {
      return (
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className={cn(
              'flex items-center gap-2 rounded-full transition-all',
              'bg-white/5 hover:bg-white/10',
              'backdrop-blur-md border border-white/15',
              'shadow-[0_2px_12px_rgba(0,0,0,0.15)]',
              compact ? 'px-2.5 py-1.5' : 'px-3 py-2'
            )}
          >
            <div className={cn(
              'rounded-full bg-accent-gold/25 backdrop-blur-sm flex items-center justify-center',
              compact ? 'w-6 h-6' : 'w-7 h-7'
            )}>
              <User size={compact ? 12 : 14} strokeWidth={1.5} className="text-accent-gold" />
            </div>
            <span className={cn(
              'max-w-[70px] truncate text-foreground-light',
              compact ? 'text-xs hidden sm:block' : 'text-sm'
            )}>
              {customer.fullname.split(' ')[0]}
            </span>
            <ChevronDown size={14} strokeWidth={1.5} className={cn(
              'text-foreground-muted transition-transform',
              showUserMenu && 'rotate-180'
            )} />
          </button>

          {showUserMenu && (
            <div className="absolute left-0 top-full mt-2 w-52 bg-background-darker/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50 animate-fade-in">
              <div className="p-4 border-b border-white/10 bg-gradient-to-r from-accent-gold/10 to-transparent">
                <p className="text-foreground-light font-medium truncate">
                  {customer.fullname}
                </p>
                <p className="text-foreground-muted text-xs mt-0.5" dir="ltr">
                  {customer.phone}
                </p>
              </div>

              <div className="p-2">
                <button
                  onClick={handleMyAppointments}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-foreground-light hover:bg-white/5 transition-colors"
                >
                  <Calendar size={18} strokeWidth={1.5} className="text-accent-gold" />
                  <span className="text-sm">התורים שלי</span>
                </button>

                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <LogOut size={18} strokeWidth={1.5} />
                  <span className="text-sm">התנתק</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )
    }

    return null
  }

  const getMobileMenuItems = () => {
    const baseItems = [
      { label: 'בית', icon: Home, action: () => router.push('/') },
    ]

    if (userType === 'barber') {
      return [
        ...baseItems,
        { label: 'לוח בקרה', icon: LayoutDashboard, action: () => router.push('/barber/dashboard') },
        { label: 'תורים קרובים', icon: Calendar, action: () => router.push('/barber/dashboard/reservations') },
        ...(isAdmin ? [{ label: 'הגדרות', icon: Settings, action: () => router.push('/barber/dashboard/settings') }] : []),
      ]
    }

    return [
      ...baseItems,
      { label: 'הצוות שלנו', icon: Scissors, action: () => scrollToSection('index-body') },
      { label: 'מיקום', icon: MapPin, action: () => scrollToSection('index-location') },
      { label: 'צור קשר', icon: Phone, action: () => scrollToSection('index-contact') },
    ]
  }

  const mobileMenuItems = getMobileMenuItems()

  return (
    <>
      <header
        className="fixed left-0 right-0 z-50 transition-all duration-500"
        style={{
          backgroundColor: `rgba(8, 11, 13, ${scrollProgress * 0.95})`,
          backdropFilter: `blur(${scrollProgress * 20}px)`,
          WebkitBackdropFilter: `blur(${scrollProgress * 20}px)`,
          top: 'var(--header-top-offset, 0px)',
        }}
      >
        {/* Scroll Progress Bar - ultra thin with white gradient */}
        <div 
          className="absolute top-0 left-0 right-0 h-px"
          style={{ opacity: scrollProgress > 0.3 ? 1 : 0, transition: 'opacity 0.3s' }}
        >
          <div 
            className="h-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-all duration-100"
            style={{ width: `${pageScrollProgress}%` }}
          />
        </div>
        
        <div className={cn(
          'mx-auto transition-all duration-500 px-4 sm:px-6',
          isScrolled ? 'py-2 sm:py-3' : 'py-3 sm:py-4'
        )}>
          {isHomePage && (
            <nav className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setShowMobileMenu(true)}
                  className="md:hidden p-2 -ml-2 rounded-full hover:bg-white/10 transition-colors"
                  aria-label="פתח תפריט"
                >
                  <Menu size={22} strokeWidth={1.5} className="text-foreground-light" />
                </button>
                
                <div className="hidden md:flex items-center gap-6">
                  <button
                    onClick={() => scrollToSection('index-body')}
                    className="text-sm text-foreground-light/80 hover:text-accent-gold transition-colors"
                  >
                    הצוות
                  </button>
                  <button
                    onClick={() => scrollToSection('index-location')}
                    className="text-sm text-foreground-light/80 hover:text-accent-gold transition-colors"
                  >
                    מיקום
                  </button>
                  <button
                    onClick={() => scrollToSection('index-contact')}
                    className="text-sm text-foreground-light/80 hover:text-accent-gold transition-colors"
                  >
                    צור קשר
                  </button>
                </div>
              </div>
              
              <div 
                className={cn(
                  'absolute left-1/2 -translate-x-1/2 transition-all duration-500',
                  showHeaderLogo ? 'opacity-100 scale-100' : 'opacity-0 scale-75 pointer-events-none'
                )}
              >
                <button
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                  className="flex items-center gap-3 group"
                >
                  <div className={cn(
                    'rounded-full overflow-hidden border-2 border-accent-gold/40 shadow-lg transition-all duration-300 group-hover:border-accent-gold/60',
                    isScrolled ? 'w-10 h-10 sm:w-11 sm:h-11' : 'w-12 h-12 sm:w-14 sm:h-14'
                  )}>
                    <Image
                      src="/icon.png"
                      alt="Ramel Barbershop"
                      width={56}
                      height={56}
                      className="w-full h-full object-cover"
                      priority
                    />
                  </div>
                  <span className={cn(
                    'font-medium text-foreground-light block transition-all duration-300',
                    isScrolled ? 'text-sm sm:text-base' : 'text-base sm:text-lg'
                  )}>
                    רמאל <span className="text-accent-gold">ברברשופ</span>
                  </span>
                </button>
              </div>
              
              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  onClick={() => scrollToSection('index-body')}
                  className={cn(
                    'hidden sm:flex items-center gap-2 px-4 py-2.5 rounded-full font-medium text-sm transition-all',
                    'border border-accent-gold/50 text-accent-gold hover:bg-accent-gold hover:text-background-dark'
                  )}
                >
                  <Scissors size={16} strokeWidth={1.5} />
                  קבע תור
                </button>
                
                <UserButton compact={isScrolled} />
              </div>
            </nav>
          )}

          {isBarberPage && (
            <nav className="flex items-center justify-between">
              <button
                onClick={() => router.push('/')}
                className="flex items-center gap-2 px-3 py-2 rounded-full hover:bg-white/10 transition-colors text-foreground-light"
              >
                <Home size={16} strokeWidth={1.5} className="text-accent-gold" />
                <span className="text-sm hidden sm:inline">בית</span>
              </button>

              <h1 className="text-base sm:text-lg font-medium text-foreground-light">
                {isWizardPage ? 'הזמנת תור' : 'פרופיל ספר'}
              </h1>

              <div className="flex items-center gap-2">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full overflow-hidden shadow-md border-2 border-accent-gold/40">
                  <Image
                    src={barberImgUrl || '/icon.png'}
                    alt="Barber"
                    width={40}
                    height={40}
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            </nav>
          )}
        </div>
      </header>

      {showMobileMenu && (
        <>
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] md:hidden animate-fade-in"
            onClick={() => setShowMobileMenu(false)}
          />
          
          <div 
            className="fixed top-0 right-0 bottom-0 w-[280px] bg-background-darker z-[100] md:hidden animate-slide-in-right shadow-2xl"
            style={{ paddingTop: 'var(--header-top-offset, 0px)' }}
          >
            <div className="relative p-5 border-b border-white/10 bg-gradient-to-br from-accent-gold/10 via-transparent to-accent-orange/5">
              <button
                onClick={() => setShowMobileMenu(false)}
                className="icon-btn absolute top-4 left-4 p-2 rounded-full bg-white/10 text-foreground-light hover:bg-white/20 transition-colors"
                aria-label="סגור תפריט"
              >
                <X size={18} strokeWidth={2} />
              </button>
              
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-accent-gold/40 shadow-lg">
                  <Image
                    src="/icon.png"
                    alt="Ramel Barbershop"
                    width={48}
                    height={48}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <span className="font-semibold text-foreground-light block">רמאל ברברשופ</span>
                  <span className="text-xs text-accent-gold">חווית טיפוח לגבר</span>
                </div>
              </div>
            </div>
            
            {isLoggedIn && userType === 'barber' && barber && (
              <div className="p-4 border-b border-white/10 bg-accent-gold/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-accent-gold/30 flex items-center justify-center">
                    <Scissors size={18} strokeWidth={1.5} className="text-accent-gold" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-foreground-light font-medium text-sm">{displayName}</p>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent-gold/20 text-accent-gold">
                        {isAdmin ? 'מנהל' : 'ספר'}
                      </span>
                    </div>
                    <p className="text-foreground-muted text-xs" dir="ltr">{barber.email}</p>
                  </div>
                </div>
              </div>
            )}
            
            {isLoggedIn && userType === 'customer' && customer && (
              <div className="p-4 border-b border-white/10 bg-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-accent-gold/20 flex items-center justify-center">
                    <User size={18} strokeWidth={1.5} className="text-accent-gold" />
                  </div>
                  <div>
                    <p className="text-foreground-light font-medium text-sm">{customer.fullname}</p>
                    <p className="text-foreground-muted text-xs" dir="ltr">{customer.phone}</p>
                  </div>
                </div>
              </div>
            )}
            
            <nav className="py-4 px-3">
              <div className="space-y-1">
                {mobileMenuItems.map((item) => (
                  <button
                    key={item.label}
                    onClick={item.action}
                    className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl text-foreground-light hover:bg-white/5 transition-colors"
                  >
                    <item.icon size={20} strokeWidth={1.5} className="text-accent-gold" />
                    <span className="text-sm font-medium">{item.label}</span>
                  </button>
                ))}
              </div>
              
              <div className="my-4 h-px bg-white/10" />
              
              {isLoggedIn && userType === 'barber' ? (
                <div className="space-y-1">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <LogOut size={20} strokeWidth={1.5} />
                    <span className="text-sm font-medium">התנתק</span>
                  </button>
                </div>
              ) : isLoggedIn && userType === 'customer' ? (
                <div className="space-y-1">
                  <button
                    onClick={handleMyAppointments}
                    className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl text-foreground-light hover:bg-white/5 transition-colors"
                  >
                    <Calendar size={20} strokeWidth={1.5} className="text-accent-gold" />
                    <span className="text-sm font-medium">התורים שלי</span>
                  </button>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <LogOut size={20} strokeWidth={1.5} />
                    <span className="text-sm font-medium">התנתק</span>
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setShowMobileMenu(false)
                    setShowLoginModal(true)
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl bg-accent-gold text-background-dark font-medium text-sm transition-colors hover:bg-accent-gold/90"
                >
                  <User size={18} strokeWidth={2} />
                  <span>התחברות</span>
                </button>
              )}
            </nav>
            
            <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-white/10 bg-background-darker">
              <p className="text-center text-foreground-muted text-xs">
                © 2025 רמאל ברברשופ
              </p>
            </div>
          </div>
        </>
      )}

      <LoginModal 
        isOpen={showLoginModal} 
        onClose={() => setShowLoginModal(false)} 
      />
    </>
  )
}
