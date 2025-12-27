'use client'

import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Home, Scissors, Calendar, Phone, UserCog } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  action?: () => void
}

export function MobileBottomNav() {
  const pathname = usePathname()
  const router = useRouter()

  // Don't show on dashboard pages
  if (pathname.startsWith('/barber/dashboard')) {
    return null
  }

  const scrollToContact = () => {
    if (pathname !== '/') {
      router.push('/')
      setTimeout(() => {
        const el = document.querySelector('.index-contact')
        el?.scrollIntoView({ behavior: 'smooth' })
      }, 500)
    } else {
      const el = document.querySelector('.index-contact')
      el?.scrollIntoView({ behavior: 'smooth' })
    }
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

  const navItems: NavItem[] = [
    { label: 'בית', href: '/', icon: Home },
    { label: 'קבע תור', href: '/', icon: Scissors, action: scrollToTeam },
    { label: 'התורים שלי', href: '/my-appointments', icon: Calendar },
    { label: 'צור קשר', href: '/', icon: Phone, action: scrollToContact },
    { label: 'לספרים', href: '/barber/login', icon: UserCog },
  ]

  const isActive = (item: NavItem) => {
    if (item.href === '/' && item.label === 'בית') {
      return pathname === '/'
    }
    if (item.href === '/my-appointments') {
      return pathname === '/my-appointments'
    }
    if (item.href === '/barber/login') {
      return pathname.startsWith('/barber/')
    }
    return false
  }

  const handleClick = (item: NavItem) => {
    if (item.action) {
      item.action()
    } else {
      router.push(item.href)
    }
  }

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-background-darker/95 backdrop-blur-lg border-t border-white/10 bottom-nav-safe"
      role="navigation"
      aria-label="תפריט נייד"
    >
      <div className="flex items-center justify-around py-2">
        {navItems.map((item) => {
          const Icon = item.icon
          const active = isActive(item)
          
          return (
            <button
              key={item.label}
              onClick={() => handleClick(item)}
              className={cn(
                'flex flex-col items-center justify-center gap-1 px-4 py-2 min-w-[60px] transition-colors',
                active
                  ? 'text-accent-gold'
                  : 'text-foreground-muted hover:text-foreground-light'
              )}
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
            >
              <Icon
                size={20}
                strokeWidth={1.5}
                className={cn(
                  'transition-transform',
                  active && 'scale-110'
                )}
              />
              <span className="text-[10px] font-medium">{item.label}</span>
              {active && (
                <div className="absolute bottom-1 w-1 h-1 rounded-full bg-accent-gold" />
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
