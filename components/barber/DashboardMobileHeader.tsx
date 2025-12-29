'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Menu, Home } from 'lucide-react'

interface DashboardMobileHeaderProps {
  barberName?: string
  onMenuToggle: () => void
}

export function DashboardMobileHeader({ onMenuToggle }: DashboardMobileHeaderProps) {
  return (
    <header 
      className="lg:hidden fixed left-0 right-0 z-40 bg-[#080b0d]/95 backdrop-blur-lg border-b border-white/10"
      style={{
        top: 'var(--header-top-offset, 0px)',
      }}
    >
      <div className="flex items-center justify-between px-4 h-16">
        {/* Menu button */}
        <button
          onClick={onMenuToggle}
          className="p-2 -mr-2 text-foreground-light hover:text-accent-gold transition-colors flex items-center justify-center"
          aria-label="פתח תפריט"
        >
          <Menu size={20} strokeWidth={1.5} />
        </button>
        
        {/* Logo and title */}
        <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <div className="w-8 h-8 rounded-full overflow-hidden border border-accent-gold/30">
            <Image
              src="/icon.png"
              alt="Ramel Barbershop"
              width={32}
              height={32}
              className="w-full h-full object-cover"
            />
          </div>
          <span className="font-medium text-foreground-light">לוח בקרה</span>
        </Link>
        
        {/* Home button */}
        <Link
          href="/"
          className="p-2 text-foreground-muted hover:text-accent-gold transition-colors flex items-center justify-center"
          aria-label="חזרה לדף הבית"
        >
          <Home size={18} strokeWidth={1.5} />
        </Link>
      </div>
    </header>
  )
}
