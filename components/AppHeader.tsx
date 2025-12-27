'use client'

import { useEffect, useState, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/useAuthStore'
import { LoginModal } from './LoginModal'
import { User, Calendar, LogOut, Menu, X, Home, Phone, MapPin } from 'lucide-react'

interface AppHeaderProps {
  barberImgUrl?: string
}

export function AppHeader({ barberImgUrl }: AppHeaderProps) {
  const router = useRouter()
  const pathname = usePathname()
  
  const { customer, isLoggedIn, isLoading, logout } = useAuthStore()
  
  const [isScrolled, setIsScrolled] = useState(false)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  
  const isHomePage = pathname === '/'
  const isBarberPage = pathname.includes('/barber') && !pathname.includes('/dashboard')

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 0)
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Close mobile menu on route change
  useEffect(() => {
    setShowMobileMenu(false)
  }, [pathname])

  // Prevent body scroll when mobile menu is open
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

  const scrollToSection = (className: string) => {
    setShowMobileMenu(false)
    
    if (pathname !== '/') {
      router.push('/')
      setTimeout(() => {
        const el = document.querySelector(`.${className}`)
        el?.scrollIntoView({ behavior: 'smooth' })
      }, 500)
      return
    }

    if (className === 'index-header') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    const el = document.querySelector(`.${className}`)
    el?.scrollIntoView({ behavior: 'smooth' })
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

  // User menu dropdown component
  const UserMenu = () => {
    if (!isLoggedIn || !customer) {
      return (
        <button
          onClick={() => setShowLoginModal(true)}
          disabled={isLoading}
          className={cn(
            'flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg transition-all text-sm',
            'bg-accent-gold/10 border border-accent-gold/30 text-accent-gold hover:bg-accent-gold/20',
            isLoading && 'opacity-50 cursor-not-allowed'
          )}
        >
          <User size={14} strokeWidth={1.5} />
          <span className="hidden xs:inline">התחברות</span>
        </button>
      )
    }

    return (
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setShowUserMenu(!showUserMenu)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent-gold/10 border border-accent-gold/30 text-accent-gold hover:bg-accent-gold/20 transition-all"
        >
          <div className="w-7 h-7 rounded-full bg-accent-gold/30 flex items-center justify-center">
            <User size={14} strokeWidth={1.5} />
          </div>
          <span className="text-sm max-w-[80px] truncate hidden sm:block">
            {customer.fullname.split(' ')[0]}
          </span>
        </button>

        {showUserMenu && (
          <div className="absolute left-0 top-full mt-2 w-48 bg-background-darker border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 animate-fade-in">
            <div className="p-3 border-b border-white/10">
              <p className="text-foreground-light font-medium truncate">
                {customer.fullname}
              </p>
              <p className="text-foreground-muted text-xs" dir="ltr">
                {customer.phone}
              </p>
            </div>

            <div className="py-1">
              <button
                onClick={handleMyAppointments}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-foreground-light hover:bg-white/5 transition-colors"
              >
                <Calendar size={18} strokeWidth={1.5} className="text-accent-gold" />
                <span className="text-sm">התורים שלי</span>
              </button>

              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-red-400 hover:bg-red-500/10 transition-colors"
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

  // Mobile menu items
  const mobileMenuItems = [
    { label: 'בית', icon: Home, action: () => router.push('/') },
    { label: 'אודות', icon: User, action: () => scrollToSection('index-header') },
    { label: 'קבע תור', icon: Calendar, action: () => scrollToSection('index-body') },
    { label: 'מיקום', icon: MapPin, action: () => scrollToSection('index-location') },
    { label: 'צור קשר', icon: Phone, action: () => scrollToSection('index-contact') },
  ]

  return (
    <>
      <header
        className={cn(
          'fixed top-0 w-full z-50 transition-all duration-300',
          'bg-black/60 backdrop-blur-md',
          isScrolled && 'bg-black/80'
        )}
      >
        <div
          className={cn(
            'flex justify-between items-center text-white transition-all duration-300 px-4 sm:px-6 lg:px-10',
            isScrolled ? 'h-16 sm:h-20' : 'h-20 sm:h-24'
          )}
        >
          {isHomePage && (
            <nav className="flex w-full justify-between items-center">
              {/* Mobile hamburger button */}
              <button
                onClick={() => setShowMobileMenu(true)}
                className="sm:hidden p-2 -ml-2 text-foreground-light hover:text-accent-gold transition-colors"
                aria-label="פתח תפריט"
              >
                <Menu size={22} strokeWidth={1.5} />
              </button>
              
              {/* Right side - Navigation (desktop only) */}
              <div className="hidden sm:flex items-center gap-4 md:gap-6">
                <button
                  onClick={() => scrollToSection('index-header')}
                  className="hover:text-accent-gold transition-colors cursor-pointer text-sm md:text-base relative group"
                >
                  אודות
                  <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-accent-gold transition-all group-hover:w-full" />
                </button>
                
                <button
                  onClick={() => scrollToSection('index-contact')}
                  className="hover:text-accent-gold transition-colors cursor-pointer text-sm md:text-base relative group"
                >
                  צור קשר
                  <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-accent-gold transition-all group-hover:w-full" />
                </button>
              </div>
              
              {/* Logo - Center */}
              <div
                onClick={() => router.push('/')}
                className={cn(
                  'cursor-pointer transition-all duration-300 rounded-full overflow-hidden shadow-lg absolute left-1/2 -translate-x-1/2 border border-accent-gold/30',
                  isScrolled ? 'w-12 h-12 sm:w-14 sm:h-14' : 'w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20'
                )}
              >
                <Image
                  src="/icon.png"
                  alt="Ramel Barbershop Logo"
                  width={80}
                  height={80}
                  className="w-full h-full object-cover"
                  priority
                />
              </div>
              
              {/* Left side - Book & Login */}
              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  onClick={() => scrollToSection('index-body')}
                  className="hidden sm:flex items-center gap-1 hover:text-accent-gold transition-colors cursor-pointer text-sm md:text-base relative group"
                >
                  קבע תור
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 16 16"
                    className="w-4 h-4 fill-current hidden md:block"
                  >
                    <path d="M7.78 12.53a.75.75 0 0 1-1.06 0L2.47 8.28a.75.75 0 0 1 0-1.06l4.25-4.25a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042L4.81 7h7.44a.75.75 0 0 1 0 1.5H4.81l2.97 2.97a.75.75 0 0 1 0 1.06Z" />
                  </svg>
                  <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-accent-gold transition-all group-hover:w-full" />
                </button>
                
                <UserMenu />
              </div>
            </nav>
          )}

          {isBarberPage && (
            <nav className="flex w-full justify-between items-center">
              <button
                onClick={() => router.push('/')}
                className="flex items-center gap-2 hover:text-accent-gold transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 16 16"
                  className="w-4 h-4 fill-current"
                >
                  <path
                    fillRule="evenodd"
                    d="M1.22 8a.75.75 0 0 1 0-1.06L6.47 2.7a.75.75 0 1 1 1.06 1.06L3.81 7h10.44a.75.75 0 0 1 0 1.5H3.81l3.72 3.72a.75.75 0 1 1-1.06 1.06L1.22 8Z"
                  />
                </svg>
                <span className="hidden xs:inline">חזור</span>
              </button>

              <h1 className="text-base sm:text-lg font-medium">הזמנת תור</h1>

              <div className="flex items-center gap-2 sm:gap-3">
                <UserMenu />
                
                {/* Barber avatar */}
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full overflow-hidden shadow-md border border-accent-gold/30">
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

      {/* Mobile Menu Drawer */}
      {showMobileMenu && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 sm:hidden animate-fade-in"
            onClick={() => setShowMobileMenu(false)}
          />
          
          {/* Drawer */}
          <div className="fixed top-0 right-0 bottom-0 w-72 bg-background-darker border-l border-white/10 z-50 sm:hidden animate-slide-in-right">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full overflow-hidden border border-accent-gold/30">
                  <Image
                    src="/icon.png"
                    alt="Ramel Barbershop"
                    width={40}
                    height={40}
                    className="w-full h-full object-cover"
                  />
                </div>
                <span className="font-medium text-foreground-light">רמאל ברברשופ</span>
              </div>
              <button
                onClick={() => setShowMobileMenu(false)}
                className="p-2 text-foreground-muted hover:text-foreground-light transition-colors"
                aria-label="סגור תפריט"
              >
                <X size={22} strokeWidth={1.5} />
              </button>
            </div>
            
            {/* User info if logged in */}
            {isLoggedIn && customer && (
              <div className="p-4 border-b border-white/10 bg-accent-gold/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-accent-gold/20 flex items-center justify-center">
                    <User size={18} strokeWidth={1.5} className="text-accent-gold" />
                  </div>
                  <div>
                    <p className="text-foreground-light font-medium">{customer.fullname}</p>
                    <p className="text-foreground-muted text-xs" dir="ltr">{customer.phone}</p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Menu items */}
            <nav className="py-2">
              {mobileMenuItems.map((item) => (
                <button
                  key={item.label}
                  onClick={item.action}
                  className="w-full flex items-center gap-4 px-4 py-3 text-foreground-light hover:bg-white/5 hover:text-accent-gold transition-colors"
                >
                  <item.icon size={22} strokeWidth={1.5} className="text-accent-gold" />
                  <span>{item.label}</span>
                </button>
              ))}
              
              {isLoggedIn && (
                <>
                  <div className="my-2 border-t border-white/10" />
                  <button
                    onClick={handleMyAppointments}
                    className="w-full flex items-center gap-4 px-4 py-3 text-foreground-light hover:bg-white/5 hover:text-accent-gold transition-colors"
                  >
                    <Calendar size={22} strokeWidth={1.5} className="text-accent-gold" />
                    <span>התורים שלי</span>
                  </button>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-4 px-4 py-3 text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <LogOut size={22} strokeWidth={1.5} />
                    <span>התנתק</span>
                  </button>
                </>
              )}
              
              {!isLoggedIn && (
                <>
                  <div className="my-2 border-t border-white/10" />
                  <button
                    onClick={() => {
                      setShowMobileMenu(false)
                      setShowLoginModal(true)
                    }}
                    className="w-full flex items-center gap-4 px-4 py-3 text-accent-gold hover:bg-accent-gold/10 transition-colors"
                  >
                    <User size={22} strokeWidth={1.5} />
                    <span>התחברות</span>
                  </button>
                </>
              )}
            </nav>
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
