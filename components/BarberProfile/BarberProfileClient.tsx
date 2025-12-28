'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Phone, Clock, ChevronLeft } from 'lucide-react'
import { cn, formatPrice } from '@/lib/utils'
import type { BarberWithWorkDays, Service, BarbershopSettings } from '@/types/database'

interface BarberProfileClientProps {
  barber: BarberWithWorkDays
  services: Service[]
  shopSettings?: BarbershopSettings | null
}

// Hebrew day names for working days display
const DAY_NAMES_SHORT: Record<string, string> = {
  sunday: 'א׳',
  monday: 'ב׳',
  tuesday: 'ג׳',
  wednesday: 'ד׳',
  thursday: 'ה׳',
  friday: 'ו׳',
  saturday: 'ש׳',
}

export function BarberProfileClient({ barber, services, shopSettings }: BarberProfileClientProps) {
  const router = useRouter()
  const [selectedService, setSelectedService] = useState<string | null>(null)

  const handleServiceSelect = (serviceId: string) => {
    router.push(`/barber/${barber.id}/book?service=${serviceId}`)
  }

  // Get working days
  const workingDays = barber.work_days?.filter(d => d.is_working) || []
  const workingDayNames = workingDays.map(d => DAY_NAMES_SHORT[d.day_of_week.toLowerCase()] || d.day_of_week)

  // Format working hours
  const workHours = shopSettings?.work_hours_start && shopSettings?.work_hours_end
    ? `${shopSettings.work_hours_start.slice(0, 5)} - ${shopSettings.work_hours_end.slice(0, 5)}`
    : null

  return (
    <div className="flex flex-col min-h-screen bg-background-dark">
      {/* Hero Section - Full width image with rounded bottom corners */}
      <div className="relative w-full">
        {/* Image Container - respects safe area at top */}
        <div 
          className="relative w-full overflow-hidden"
          style={{
            // Account for notch on PWA - add extra height
            paddingTop: 'var(--header-top-offset, 0px)',
            background: '#080b0d',
          }}
        >
          {/* Hero Image with rounded bottom corners */}
          <div className="relative w-full h-56 sm:h-72 md:h-80 overflow-hidden rounded-b-[2rem]">
            <Image
              src={barber.img_url || '/icon.png'}
              alt={barber.fullname}
              fill
              className="object-cover"
              priority
              sizes="100vw"
            />
            
            {/* Gradient Overlay for text readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-background-dark/90 via-background-dark/30 to-transparent" />
            
            {/* Barber Name Overlay - positioned at bottom of image */}
            <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6">
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground-light text-center drop-shadow-lg">
                {barber.fullname}
              </h1>
              
              {/* Working Days & Hours - integrated into hero */}
              <div className="flex items-center justify-center gap-4 mt-3 flex-wrap">
                {/* Working Days */}
                {workingDayNames.length > 0 && (
                  <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur-sm rounded-full px-3 py-1.5">
                    {workingDayNames.map((day, i) => (
                      <span
                        key={i}
                        className="text-xs text-foreground-light/90"
                      >
                        {day}
                      </span>
                    ))}
                  </div>
                )}
                
                {/* Working Hours */}
                {workHours && (
                  <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur-sm rounded-full px-3 py-1.5">
                    <Clock size={12} strokeWidth={1.5} className="text-accent-gold" />
                    <span className="text-xs text-foreground-light/90">{workHours}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="flex-1 container-mobile py-6 pb-28">
        {/* Quick Action - Phone */}
        {barber.phone && (
          <a
            href={`tel:${barber.phone}`}
            className="flex items-center justify-center gap-3 w-full p-4 mb-6 rounded-2xl bg-accent-gold/10 border border-accent-gold/30 hover:bg-accent-gold/20 transition-all active:scale-[0.98]"
          >
            <Phone size={20} strokeWidth={1.5} className="text-accent-gold" />
            <span className="text-accent-gold font-medium">התקשר עכשיו</span>
            <span className="text-foreground-muted text-sm" dir="ltr">{barber.phone}</span>
          </a>
        )}

        {/* Services Section */}
        <div>
          <h2 className="text-lg font-semibold text-foreground-light mb-4">
            שירותים
          </h2>
          
          {services.length === 0 ? (
            <div className="text-center py-8 rounded-2xl bg-white/5 border border-white/10">
              <p className="text-foreground-muted text-sm">אין שירותים זמינים כרגע</p>
            </div>
          ) : (
            <div className="space-y-3">
              {services.map((service) => {
                const isSelected = selectedService === service.id
                
                return (
                  <div
                    key={service.id}
                    className={cn(
                      'rounded-2xl border transition-all overflow-hidden',
                      isSelected
                        ? 'bg-accent-gold/10 border-accent-gold/40'
                        : 'bg-white/[0.03] border-white/10'
                    )}
                  >
                    <div className="p-4 flex items-center justify-between gap-3">
                      {/* Service Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base font-medium text-foreground-light">
                          {service.name_he}
                        </h3>
                        
                        {service.description && (
                          <p className="text-foreground-muted text-xs mt-0.5 line-clamp-1">
                            {service.description}
                          </p>
                        )}
                        
                        {/* Duration & Price Row */}
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-xs text-foreground-muted flex items-center gap-1">
                            <Clock size={11} strokeWidth={1.5} />
                            {service.duration} דק׳
                          </span>
                          <span className="text-accent-gold font-bold text-sm">
                            {formatPrice(service.price)}
                          </span>
                        </div>
                      </div>
                      
                      {/* Book Button */}
                      <button
                        onClick={() => handleServiceSelect(service.id)}
                        className="px-4 py-2 rounded-xl text-sm font-medium bg-accent-gold text-background-dark hover:bg-accent-gold/90 active:scale-95 transition-all flex items-center gap-1 flex-shrink-0"
                      >
                        הזמן
                        <ChevronLeft size={14} strokeWidth={2} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
