'use client'

import { useState, useTransition } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import type { BarberWithWorkDays } from '@/types/database'
import { Calendar, Loader2 } from 'lucide-react'

interface BarberCardProps {
  barber: BarberWithWorkDays
}

export function BarberCard({ barber }: BarberCardProps) {
  const [isPending, startTransition] = useTransition()
  const [isNavigating, setIsNavigating] = useState(false)
  
  const handleNavigation = () => {
    setIsNavigating(true)
    startTransition(() => {
      // Navigation happens via Link, this just tracks the transition
    })
  }

  const showLoader = isPending || isNavigating

  return (
    <Link
      href={`/barber/${barber.id}`}
      prefetch={true}
      onClick={handleNavigation}
      className="group relative w-full block"
      aria-label={`קבע תור אצל ${barber.fullname}`}
    >
      {/* Loading overlay */}
      {showLoader && (
        <div className="absolute inset-0 z-10 bg-background-dark/80 backdrop-blur-sm rounded-2xl flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <Loader2 size={32} strokeWidth={1.5} className="text-accent-gold animate-spin" />
            <span className="text-accent-gold text-sm">טוען...</span>
          </div>
        </div>
      )}
      
      {/* Card container */}
      <div className="relative bg-background-card backdrop-blur-lg border border-white/10 rounded-2xl overflow-hidden transition-all duration-300 hover:border-accent-gold/40 hover:shadow-gold cursor-pointer">
        {/* Top decorative bar */}
        <div className="h-1 w-full bg-gradient-to-r from-accent-gold via-accent-orange to-accent-gold" />
        
        {/* Content */}
        <div className="p-5 sm:p-6">
          {/* Mobile: Horizontal layout, Desktop: Vertical */}
          <div className="flex flex-row sm:flex-col items-center gap-4 sm:gap-5">
            {/* Avatar with decorative frame */}
            <div className="relative flex-shrink-0">
              {/* Glow effect on hover */}
              <div className="absolute inset-0 rounded-full bg-accent-gold/0 group-hover:bg-accent-gold/20 blur-xl transition-all duration-300" />
              
              {/* Avatar frame */}
              <div className="relative">
                {/* Outer ring */}
                <div className="absolute -inset-1 rounded-full bg-gradient-to-br from-accent-gold/50 via-brand-primary to-accent-gold/50 opacity-50 group-hover:opacity-100 transition-opacity" />
                
                {/* Avatar */}
                <div className="relative w-20 h-20 sm:w-28 sm:h-28 rounded-full overflow-hidden border-2 border-background-dark">
                  <Image
                    src={barber.img_url || '/icon.png'}
                    alt={barber.fullname}
                    width={112}
                    height={112}
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            </div>
            
            {/* Info */}
            <div className="flex-1 text-right sm:text-center">
              {/* Name */}
              <h3 className="text-lg sm:text-xl font-medium text-foreground-light mb-3 group-hover:text-accent-gold transition-colors">
                {barber.fullname}
              </h3>
            </div>
          </div>
          
          {/* Book button */}
          <div className="w-full mt-5 flex items-center justify-center gap-2 py-3 px-4 bg-accent-gold/10 border border-accent-gold/30 text-accent-gold rounded-xl font-medium transition-all group-hover:bg-accent-gold group-hover:text-background-dark group-hover:scale-[1.02] group-hover:border-accent-gold">
            {showLoader ? (
              <Loader2 size={18} strokeWidth={1.5} className="animate-spin" />
            ) : (
              <Calendar size={18} strokeWidth={1.5} />
            )}
            <span>{showLoader ? 'טוען...' : 'קבע תור'}</span>
          </div>
        </div>
        
        {/* Corner decorations */}
        <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-accent-gold/20 rounded-tl-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-accent-gold/20 rounded-tr-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-accent-gold/20 rounded-bl-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-accent-gold/20 rounded-br-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </Link>
  )
}
