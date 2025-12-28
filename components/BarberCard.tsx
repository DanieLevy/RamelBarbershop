'use client'

import { useState, useTransition } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import type { BarberWithWorkDays } from '@/types/database'
import { Calendar, Loader2, ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

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
        <div className="absolute inset-0 z-20 bg-background-dark/80 backdrop-blur-sm rounded-2xl flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <Loader2 size={32} strokeWidth={1.5} className="text-accent-gold animate-spin" />
            <span className="text-accent-gold text-sm">טוען...</span>
          </div>
        </div>
      )}
      
      {/* Card container - Modern glass design */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/10 transition-all duration-500 hover:border-accent-gold/40 hover:shadow-[0_0_40px_-10px] hover:shadow-accent-gold/30 group-hover:scale-[1.02]">
        
        {/* Hero Image Section - Large featured image */}
        <div className="relative h-56 sm:h-64 overflow-hidden">
          {/* Background Image */}
          <Image
            src={barber.img_url || '/icon.png'}
            alt={barber.fullname}
            fill
            className="object-cover object-top transition-transform duration-700 group-hover:scale-110"
            sizes="(max-width: 640px) 100vw, 400px"
          />
          
          {/* Gradient Overlays */}
          <div className="absolute inset-0 bg-gradient-to-t from-background-dark via-background-dark/40 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-b from-background-dark/30 via-transparent to-transparent" />
          
          {/* Top Decorative Line */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-accent-gold to-transparent opacity-60 group-hover:opacity-100 transition-opacity" />
          
          {/* Barber Name Overlay - Positioned at bottom of image */}
          <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5">
            <h3 className="text-xl sm:text-2xl font-bold text-foreground-light drop-shadow-lg group-hover:text-accent-gold transition-colors duration-300">
              {barber.fullname}
            </h3>
          </div>
        </div>
        
        {/* Action Section - Clean CTA */}
        <div className="p-4 sm:p-5 bg-background-dark/50 backdrop-blur-sm">
          <div className={cn(
            'flex items-center justify-between py-3 px-4 rounded-xl transition-all duration-300',
            'bg-accent-gold/10 border border-accent-gold/30',
            'group-hover:bg-accent-gold group-hover:border-accent-gold'
          )}>
            <div className="flex items-center gap-3">
              {showLoader ? (
                <Loader2 size={20} strokeWidth={1.5} className="text-accent-gold group-hover:text-background-dark animate-spin" />
              ) : (
                <Calendar size={20} strokeWidth={1.5} className="text-accent-gold group-hover:text-background-dark transition-colors" />
              )}
              <span className="font-medium text-accent-gold group-hover:text-background-dark transition-colors">
                {showLoader ? 'טוען...' : 'קבע תור עכשיו'}
              </span>
            </div>
            <ChevronLeft 
              size={18} 
              strokeWidth={2} 
              className="text-accent-gold/50 group-hover:text-background-dark group-hover:translate-x-[-4px] transition-all duration-300" 
            />
          </div>
        </div>
        
        {/* Decorative corner accents - visible on hover */}
        <div className="absolute top-2 left-2 w-4 h-4 border-t border-l border-accent-gold/0 rounded-tl-lg group-hover:border-accent-gold/50 transition-colors duration-300" />
        <div className="absolute top-2 right-2 w-4 h-4 border-t border-r border-accent-gold/0 rounded-tr-lg group-hover:border-accent-gold/50 transition-colors duration-300" />
      </div>
    </Link>
  )
}
