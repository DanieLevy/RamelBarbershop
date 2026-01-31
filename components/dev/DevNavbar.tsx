'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Users, Calendar, Bell, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavItem {
  href: string
  label: string
  icon: React.ReactNode
}

const navItems: NavItem[] = [
  { href: '/dev', label: 'Overview', icon: <LayoutDashboard size={20} /> },
  { href: '/dev/users', label: 'Users', icon: <Users size={20} /> },
  { href: '/dev/bookings', label: 'Bookings', icon: <Calendar size={20} /> },
  { href: '/dev/notifications', label: 'Notifs', icon: <Bell size={20} /> },
  { href: '/dev/system', label: 'System', icon: <Settings size={20} /> },
]

/**
 * Bottom navigation bar for the developer dashboard
 * Mobile-first design with easy thumb access
 */
export function DevNavbar() {
  const pathname = usePathname()

  const isActive = (href: string) => {
    if (href === '/dev') {
      return pathname === '/dev'
    }
    return pathname.startsWith(href)
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-zinc-900/95 backdrop-blur-lg border-t border-zinc-800 safe-area-bottom">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
        {navItems.map((item) => {
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center min-w-[60px] py-2 px-3 rounded-xl transition-all',
                active
                  ? 'text-emerald-400'
                  : 'text-zinc-500 hover:text-zinc-300 active:scale-95'
              )}
              aria-current={active ? 'page' : undefined}
            >
              <div
                className={cn(
                  'p-1.5 rounded-lg transition-colors',
                  active && 'bg-emerald-500/10'
                )}
              >
                {item.icon}
              </div>
              <span className="text-[10px] font-medium mt-0.5">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
