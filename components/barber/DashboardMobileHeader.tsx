'use client'

import Image from 'next/image'
import { Menu } from 'lucide-react'

interface DashboardMobileHeaderProps {
  barberName: string
  onMenuToggle: () => void
}

export function DashboardMobileHeader({ barberName, onMenuToggle }: DashboardMobileHeaderProps) {
  return (
    <header className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-background-darker/95 backdrop-blur-lg border-b border-white/10">
      <div className="flex items-center justify-between px-4 h-16">
        {/* Menu button */}
        <button
          onClick={onMenuToggle}
          className="p-2 -mr-2 text-foreground-light hover:text-accent-gold transition-colors"
          aria-label="פתח תפריט"
        >
          <Menu size={20} strokeWidth={1.5} />
        </button>
        
        {/* Logo and title */}
        <div className="flex items-center gap-3">
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
        </div>
        
        {/* User name placeholder for balance */}
        <div className="w-10 text-left">
          <span className="text-xs text-foreground-muted truncate block">
            {barberName.split(' ')[0]}
          </span>
        </div>
      </div>
    </header>
  )
}
