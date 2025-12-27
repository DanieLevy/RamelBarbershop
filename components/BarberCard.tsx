'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import type { BarberWithWorkDays } from '@/types/database'
import { cn } from '@/lib/utils'
import { FaCut, FaCalendarAlt } from 'react-icons/fa'

interface BarberCardProps {
  barber: BarberWithWorkDays
}

// Map day keys to Hebrew abbreviations
const dayAbbreviations: Record<string, string> = {
  sunday: 'א',
  monday: 'ב',
  tuesday: 'ג',
  wednesday: 'ד',
  thursday: 'ה',
  friday: 'ו',
  saturday: 'ש',
}

export function BarberCard({ barber }: BarberCardProps) {
  const router = useRouter()

  // Get working days from work_days array
  const workingDays = barber.work_days
    ?.filter((wd) => wd.is_working)
    .map((wd) => wd.day_of_week.toLowerCase()) || []

  const handleBookNow = () => {
    router.push(`/barber/${barber.id}`)
  }

  return (
    <div
      className="group relative w-full"
      onClick={handleBookNow}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && handleBookNow()}
      aria-label={`קבע תור אצל ${barber.fullname}`}
    >
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
              <h3 className="text-lg sm:text-xl font-medium text-foreground-light mb-1 group-hover:text-accent-gold transition-colors">
                {barber.fullname}
              </h3>
              
              {/* Role badge */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-accent-gold/10 rounded-full mb-3">
                <FaCut className="w-3 h-3 text-accent-gold" />
                <span className="text-xs text-accent-gold font-medium">ספר מקצועי</span>
              </div>
              
              {/* Working days */}
              {workingDays.length > 0 && (
                <div className="flex items-center justify-end sm:justify-center gap-2 text-foreground-muted">
                  <div className="flex items-center gap-1" dir="rtl">
                    {['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].map((day) => (
                      <span
                        key={day}
                        className={cn(
                          'w-5 h-5 text-[10px] rounded flex items-center justify-center font-medium',
                          workingDays.includes(day)
                            ? 'bg-accent-gold/20 text-accent-gold'
                            : 'bg-white/5 text-foreground-muted/40'
                        )}
                        title={day}
                      >
                        {dayAbbreviations[day]}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Book button */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleBookNow()
            }}
            className="w-full mt-5 flex items-center justify-center gap-2 py-3 px-4 bg-accent-gold/10 border border-accent-gold/30 text-accent-gold rounded-xl font-medium transition-all hover:bg-accent-gold hover:text-background-dark hover:scale-[1.02] group-hover:border-accent-gold"
          >
            <FaCalendarAlt className="w-4 h-4" />
            <span>קבע תור</span>
          </button>
        </div>
        
        {/* Corner decorations */}
        <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-accent-gold/20 rounded-tl-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-accent-gold/20 rounded-tr-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-accent-gold/20 rounded-bl-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-accent-gold/20 rounded-br-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </div>
  )
}
