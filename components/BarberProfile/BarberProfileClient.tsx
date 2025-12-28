'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Phone, Clock, ChevronLeft, Calendar, MapPin } from 'lucide-react'
import { cn, formatPrice, formatOpeningHours } from '@/lib/utils'
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

  // Format opening hours from shop settings
  const openingHours = shopSettings?.open_days && shopSettings?.work_hours_start && shopSettings?.work_hours_end
    ? formatOpeningHours(shopSettings.open_days, shopSettings.work_hours_start, shopSettings.work_hours_end)
    : null

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Banner - Wide image with rounded bottom */}
      <div className="relative w-full h-64 sm:h-80 md:h-96 overflow-hidden">
        {/* Background Image */}
        <Image
          src={barber.img_url || '/icon.png'}
          alt={barber.fullname}
          fill
          className="object-cover"
          priority
          sizes="100vw"
        />
        
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-background-dark via-background-dark/40 to-transparent" />
        
        {/* Bottom rounded edge mask */}
        <div 
          className="absolute bottom-0 left-0 right-0 h-8 bg-background-dark"
          style={{ 
            borderTopLeftRadius: '2rem',
            borderTopRightRadius: '2rem',
          }}
        />
      </div>

      {/* Content */}
      <div className="container-mobile flex-1 -mt-4 relative z-10 pb-24">
        {/* Barber Name & Quick Info */}
        <div className="text-center mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground-light mb-1">
            {barber.fullname}
          </h1>
          
          {/* Working Days Pills */}
          {workingDayNames.length > 0 && (
            <div className="flex items-center justify-center gap-1 mt-3">
              <Calendar size={14} strokeWidth={1.5} className="text-accent-gold ml-2" />
              <div className="flex gap-1">
                {workingDayNames.map((day, i) => (
                  <span
                    key={i}
                    className="text-xs px-2 py-1 rounded-full bg-white/5 text-foreground-muted border border-white/10"
                  >
                    {day}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Info Cards Row */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {/* Phone Card */}
          {barber.phone && (
            <a
              href={`tel:${barber.phone}`}
              className="flex items-center gap-3 p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-accent-gold/30 transition-all active:scale-95"
            >
              <div className="w-10 h-10 rounded-full bg-accent-gold/20 flex items-center justify-center flex-shrink-0">
                <Phone size={18} strokeWidth={1.5} className="text-accent-gold" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-foreground-muted">התקשר</p>
                <p className="text-sm text-foreground-light font-medium truncate" dir="ltr">
                  {barber.phone}
                </p>
              </div>
            </a>
          )}

          {/* Hours Card */}
          {openingHours && openingHours.length > 0 && (
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-white/5 border border-white/10">
              <div className="w-10 h-10 rounded-full bg-accent-gold/20 flex items-center justify-center flex-shrink-0">
                <Clock size={18} strokeWidth={1.5} className="text-accent-gold" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-foreground-muted">שעות פעילות</p>
                <p className="text-sm text-foreground-light font-medium">
                  {shopSettings?.work_hours_start?.slice(0, 5)} - {shopSettings?.work_hours_end?.slice(0, 5)}
                </p>
              </div>
            </div>
          )}
        </div>


        {/* Services Section */}
        <div className="mb-6">
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
                      'relative rounded-2xl border transition-all overflow-hidden',
                      isSelected
                        ? 'bg-accent-gold/10 border-accent-gold/40'
                        : 'bg-white/5 border-white/10'
                    )}
                  >
                    {/* Service Content - Clickable area */}
                    <div className="p-4 flex items-center justify-between gap-4">
                      {/* Left: Service Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base font-medium text-foreground-light">
                          {service.name_he}
                        </h3>
                        
                        {service.description && (
                          <p className="text-foreground-muted text-xs mt-0.5 line-clamp-1">
                            {service.description}
                          </p>
                        )}
                        
                        {/* Duration & Price */}
                        <div className="flex items-center gap-4 mt-2">
                          <span className="text-xs text-foreground-muted flex items-center gap-1">
                            <Clock size={12} strokeWidth={1.5} />
                            {service.duration} דק׳
                          </span>
                          <span className="text-accent-gold font-bold">
                            {formatPrice(service.price)}
                          </span>
                        </div>
                      </div>
                      
                      {/* Right: Book Button */}
                      <button
                        onClick={() => handleServiceSelect(service.id)}
                        className={cn(
                          'px-5 py-2.5 rounded-xl text-sm font-medium transition-all flex-shrink-0',
                          'bg-accent-gold/10 text-accent-gold border border-accent-gold/30',
                          'hover:bg-accent-gold hover:text-background-dark active:scale-95'
                        )}
                      >
                        הזמן
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Location hint if available */}
        {shopSettings?.address_text && (
          <div className="flex items-center justify-center gap-2 text-foreground-muted text-sm py-4">
            <MapPin size={14} strokeWidth={1.5} className="text-accent-gold" />
            <span>{shopSettings.address_text}</span>
          </div>
        )}
      </div>
    </div>
  )
}
