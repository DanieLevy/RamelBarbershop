'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Image from 'next/image'
import { useBarberAuthStore } from '@/store/useBarberAuthStore'
import { cn } from '@/lib/utils'
import {
  FaHome,
  FaCalendarAlt,
  FaCut,
  FaClock,
  FaUser,
  FaCog,
  FaUsers,
  FaCalendarCheck,
  FaTimesCircle,
  FaSignOutAlt,
  FaTimes,
} from 'react-icons/fa'

interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  adminOnly?: boolean
}

const navItems: NavItem[] = [
  { label: 'סקירה כללית', href: '/barber/dashboard', icon: FaHome },
  { label: 'התורים שלי', href: '/barber/dashboard/reservations', icon: FaCalendarAlt },
  { label: 'השירותים שלי', href: '/barber/dashboard/services', icon: FaCut },
  { label: 'הלו"ז שלי', href: '/barber/dashboard/my-schedule', icon: FaClock },
  { label: 'פרופיל', href: '/barber/dashboard/profile', icon: FaUser },
]

const adminNavItems: NavItem[] = [
  { label: 'הגדרות המספרה', href: '/barber/dashboard/settings', icon: FaCog, adminOnly: true },
  { label: 'ניהול ספרים', href: '/barber/dashboard/barbers', icon: FaUsers, adminOnly: true },
  { label: 'שעות פתיחה', href: '/barber/dashboard/schedule', icon: FaCalendarCheck, adminOnly: true },
  { label: 'ימי סגירה', href: '/barber/dashboard/closures', icon: FaTimesCircle, adminOnly: true },
]

interface DashboardSidebarProps {
  isMobileOpen?: boolean
  onMobileClose?: () => void
}

export function DashboardSidebar({ isMobileOpen, onMobileClose }: DashboardSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { barber, isAdmin, logout } = useBarberAuthStore()

  // Close sidebar on route change (mobile)
  useEffect(() => {
    if (onMobileClose) {
      onMobileClose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  // Prevent body scroll when mobile sidebar is open
  useEffect(() => {
    if (isMobileOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isMobileOpen])

  const handleLogout = () => {
    logout()
    router.push('/barber/login')
  }

  const handleNavigation = (href: string) => {
    router.push(href)
    if (onMobileClose) {
      onMobileClose()
    }
  }

  const isActive = (href: string) => {
    if (href === '/barber/dashboard') {
      return pathname === href
    }
    return pathname.startsWith(href)
  }

  // If this is the mobile version
  if (isMobileOpen !== undefined) {
    if (!isMobileOpen) {
      return null
    }

    return (
      <>
        {/* Overlay */}
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 lg:hidden"
          onClick={onMobileClose}
        />
        
        {/* Drawer */}
        <aside className="fixed top-0 right-0 bottom-0 w-72 bg-background-darker border-l border-white/10 z-50 lg:hidden animate-slide-in-right flex flex-col">
          {/* Header with close button */}
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
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
              <div>
                <h2 className="text-sm font-medium text-foreground-light">לוח בקרה</h2>
                {barber && (
                  <p className="text-xs text-foreground-muted">{barber.fullname}</p>
                )}
              </div>
            </div>
            <button
              onClick={onMobileClose}
              className="p-2 text-foreground-muted hover:text-foreground-light transition-colors"
              aria-label="סגור תפריט"
            >
              <FaTimes className="w-5 h-5" />
            </button>
          </div>

          {isAdmin && (
            <div className="px-4 py-2 bg-accent-gold/10">
              <span className="text-xs text-accent-gold font-medium">מנהל</span>
            </div>
          )}

          <SidebarContent
            isAdmin={isAdmin}
            isActive={isActive}
            onNavigation={handleNavigation}
            onLogout={handleLogout}
          />
        </aside>
      </>
    )
  }

  // Desktop sidebar
  return (
    <aside className="w-64 bg-background-card border-l border-white/10 min-h-screen flex flex-col sticky top-0">
      {/* Header */}
      <div className="p-6 border-b border-white/10">
        <h2 className="text-lg font-medium text-foreground-light">לוח בקרה</h2>
        {barber && (
          <p className="text-sm text-foreground-muted mt-1">
            שלום, {barber.fullname}
          </p>
        )}
        {isAdmin && (
          <span className="inline-block mt-2 px-2 py-0.5 bg-accent-gold/20 text-accent-gold text-xs rounded-full">
            מנהל
          </span>
        )}
      </div>

      <SidebarContent
        isAdmin={isAdmin}
        isActive={isActive}
        onNavigation={handleNavigation}
        onLogout={handleLogout}
      />
    </aside>
  )
}

// Shared sidebar content
function SidebarContent({
  isAdmin,
  isActive,
  onNavigation,
  onLogout,
}: {
  isAdmin: boolean
  isActive: (href: string) => boolean
  onNavigation: (href: string) => void
  onLogout: () => void
}) {
  return (
    <>
      {/* Navigation */}
      <nav className="flex-1 p-4 overflow-y-auto">
        <div className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.href}
                onClick={() => onNavigation(item.href)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all',
                  isActive(item.href)
                    ? 'bg-accent-gold text-background-dark'
                    : 'text-foreground-light hover:bg-white/5'
                )}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            )
          })}
        </div>

        {/* Admin Section */}
        {isAdmin && (
          <>
            <div className="my-4 border-t border-white/10" />
            <p className="px-4 py-2 text-xs text-foreground-muted uppercase tracking-wider">
              ניהול מספרה
            </p>
            <div className="space-y-1">
              {adminNavItems.map((item) => {
                const Icon = item.icon
                return (
                  <button
                    key={item.href}
                    onClick={() => onNavigation(item.href)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all',
                      isActive(item.href)
                        ? 'bg-accent-gold text-background-dark'
                        : 'text-foreground-light hover:bg-white/5'
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </button>
                )
              })}
            </div>
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-white/10">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-red-400 hover:bg-red-500/10 transition-all"
        >
          <FaSignOutAlt className="w-4 h-4" />
          <span>התנתק</span>
        </button>
        
        <a
          href="/"
          className="block mt-2 text-center text-xs text-foreground-muted hover:text-foreground-light transition-colors"
        >
          ← חזרה לאתר
        </a>
      </div>
    </>
  )
}
