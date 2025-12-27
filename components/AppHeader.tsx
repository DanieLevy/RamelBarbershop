'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Image from 'next/image'
import { cn } from '@/lib/utils'

interface AppHeaderProps {
  barberImgUrl?: string
}

export function AppHeader({ barberImgUrl }: AppHeaderProps) {
  const router = useRouter()
  const pathname = usePathname()
  
  const [isScrolled, setIsScrolled] = useState(false)
  
  const isHomePage = pathname === '/'
  const isBarberPage = pathname.includes('/barber')

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 0)
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
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

  return (
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
          <nav className="flex w-full justify-evenly items-center">
            <button
              onClick={() => scrollToSection('index-header')}
              className="hover:underline cursor-pointer text-sm md:text-base"
            >
              אודות
            </button>
            
            <button
              onClick={() => scrollToSection('index-contact')}
              className="hover:underline cursor-pointer text-sm md:text-base"
            >
              צור קשר
            </button>
            
            {/* Logo */}
            <div
              onClick={() => router.push('/')}
              className={cn(
                'cursor-pointer transition-all duration-300 rounded-full overflow-hidden shadow-lg',
                isScrolled ? 'w-16 h-16' : 'w-24 h-24 md:w-32 md:h-32 relative top-6'
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
            
            <button
              onClick={() => scrollToSection('index-location')}
              className="hover:underline cursor-pointer text-sm md:text-base"
            >
              מיקום
            </button>
            
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
          </nav>
        )}
      </div>
    </header>
  )
}

