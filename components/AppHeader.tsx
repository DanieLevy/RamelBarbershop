'use client'

import { useEffect, useState, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/useAuthStore'
import { LoginModal } from './LoginModal'
import { FaUser, FaCalendarAlt, FaSignOutAlt } from 'react-icons/fa'

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
  const menuRef = useRef<HTMLDivElement>(null)
  
  const isHomePage = pathname === '/'
  const isBarberPage = pathname.includes('/barber')

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

  const scrollToSection = (className: string) => {
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
  }

  const handleMyAppointments = () => {
    router.push('/my-appointments')
    setShowUserMenu(false)
  }

  // User menu dropdown component
  const UserMenu = () => {
    if (!isLoggedIn || !customer) {
      return (
        <button
          onClick={() => setShowLoginModal(true)}
          disabled={isLoading}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg transition-all text-sm',
            'bg-accent-gold/10 border border-accent-gold/30 text-accent-gold hover:bg-accent-gold/20',
            isLoading && 'opacity-50 cursor-not-allowed'
          )}
        >
          <FaUser className="w-3 h-3" />
          <span>התחברות</span>
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
            <FaUser className="w-3 h-3" />
          </div>
          <span className="text-sm max-w-[100px] truncate hidden sm:block">
            {customer.fullname.split(' ')[0]}
          </span>
        </button>

        {showUserMenu && (
          <div className="absolute left-0 top-full mt-2 w-48 bg-background-dark border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50">
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
                <FaCalendarAlt className="w-4 h-4 text-accent-gold" />
                <span className="text-sm">התורים שלי</span>
              </button>

              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <FaSignOutAlt className="w-4 h-4" />
                <span className="text-sm">התנתק</span>
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

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
            'flex justify-between items-center text-white transition-all duration-300 px-5 md:px-10 lg:px-20',
            isScrolled ? 'h-20' : 'h-24'
          )}
        >
          {isHomePage && (
            <nav className="flex w-full justify-between items-center">
              {/* Right side - Navigation */}
              <div className="flex items-center gap-4 md:gap-6">
                <button
                  onClick={() => scrollToSection('index-header')}
                  className="hover:underline cursor-pointer text-sm md:text-base hidden sm:block"
                >
                  אודות
                </button>
                
                <button
                  onClick={() => scrollToSection('index-contact')}
                  className="hover:underline cursor-pointer text-sm md:text-base hidden sm:block"
                >
                  צור קשר
                </button>
              </div>
              
              {/* Logo - Center */}
              <div
                onClick={() => router.push('/')}
                className={cn(
                  'cursor-pointer transition-all duration-300 rounded-full overflow-hidden shadow-lg absolute left-1/2 -translate-x-1/2',
                  isScrolled ? 'w-16 h-16' : 'w-20 h-20 md:w-24 md:h-24 relative top-2'
                )}
              >
                <Image
                  src="https://iili.io/JxtxOgf.md.jpg"
                  alt="Ramel Barbershop Logo"
                  width={128}
                  height={128}
                  className="w-full h-full object-cover"
                  priority
                />
              </div>
              
              {/* Left side - Book & Login */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => scrollToSection('index-body')}
                  className="hover:underline cursor-pointer text-sm md:text-base flex items-center gap-1"
                >
                  קבע תור
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 16 16"
                    className="w-4 h-4 fill-current hidden md:block"
                  >
                    <path d="M7.78 12.53a.75.75 0 0 1-1.06 0L2.47 8.28a.75.75 0 0 1 0-1.06l4.25-4.25a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042L4.81 7h7.44a.75.75 0 0 1 0 1.5H4.81l2.97 2.97a.75.75 0 0 1 0 1.06Z" />
                  </svg>
                </button>
                
                <UserMenu />
              </div>
            </nav>
          )}

          {isBarberPage && (
            <nav className="flex w-full justify-between items-center">
              <button
                onClick={() => router.push('/')}
                className="flex items-center gap-2 hover:underline"
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
                <span>חזור</span>
              </button>

              <h1 className="text-lg font-medium">הזמנת תור</h1>

              <div className="flex items-center gap-3">
                <UserMenu />
                
                {/* Barber avatar */}
                <div className="w-10 h-10 rounded-full overflow-hidden shadow-md">
                  <Image
                    src={barberImgUrl || 'https://iili.io/JxtxGON.md.jpg'}
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

      <LoginModal 
        isOpen={showLoginModal} 
        onClose={() => setShowLoginModal(false)} 
      />
    </>
  )
}
