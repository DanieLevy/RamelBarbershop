'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Phone, Clock, ChevronLeft, Bell, Loader2 } from 'lucide-react'
import { cn, formatPrice, buildBarberBookingUrl } from '@/lib/utils'
import type { BarberWithWorkDays, Service, BarbershopSettings, BarberMessage } from '@/types/database'

interface BarberProfileClientProps {
  barber: BarberWithWorkDays
  services: Service[]
  shopSettings?: BarbershopSettings | null
  barberMessages?: BarberMessage[]
}

// Hebrew day names for working days display - ordered Sunday to Saturday
const DAY_ORDER = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const DAY_NAMES_SHORT: Record<string, string> = {
  sunday: 'א׳',
  monday: 'ב׳',
  tuesday: 'ג׳',
  wednesday: 'ד׳',
  thursday: 'ה׳',
  friday: 'ו׳',
  saturday: 'ש׳',
}

export function BarberProfileClient({ 
  barber, 
  services, 
  shopSettings,
  barberMessages = []
}: BarberProfileClientProps) {
  const router = useRouter()
  const [loadingServiceId, setLoadingServiceId] = useState<string | null>(null)
  
  // Use username (slug) for nicer URLs, fallback to UUID
  const barberSlug = barber.username || barber.id

  // Prefetch the booking page on mount for instant navigation
  useEffect(() => {
    // Prefetch the booking page with each service option
    services.forEach(service => {
      router.prefetch(buildBarberBookingUrl(barberSlug, service.id))
    })
    // Also prefetch without a service (fallback)
    router.prefetch(buildBarberBookingUrl(barberSlug))
  }, [barberSlug, services, router])

  const handleServiceSelect = (serviceId: string) => {
    setLoadingServiceId(serviceId)
    router.push(buildBarberBookingUrl(barberSlug, serviceId))
  }

  // Get working days - intersect barber's work days with shop's open days
  // A barber can only work on days when the shop is open
  const shopOpenDays = shopSettings?.open_days || []
  const workingDays = barber.work_days?.filter(d => 
    d.is_working && shopOpenDays.includes(d.day_of_week.toLowerCase())
  ) || []
  
  // Sort working days by proper day order (Sunday to Saturday)
  const sortedWorkingDays = [...workingDays].sort((a, b) => {
    const aIndex = DAY_ORDER.indexOf(a.day_of_week.toLowerCase())
    const bIndex = DAY_ORDER.indexOf(b.day_of_week.toLowerCase())
    return aIndex - bIndex
  })
  
  const workingDayNames = sortedWorkingDays.map(d => DAY_NAMES_SHORT[d.day_of_week.toLowerCase()] || d.day_of_week)

  // Format working hours
  const workHours = shopSettings?.work_hours_start && shopSettings?.work_hours_end
    ? `${shopSettings.work_hours_start.slice(0, 5)} - ${shopSettings.work_hours_end.slice(0, 5)}`
    : null

  return (
    <div className="flex flex-col min-h-screen bg-background-dark">
      {/* Hero Section - Flexible aspect ratio for better image display */}
      <div className="relative w-full">
        {/* Safe area spacer for notch devices */}
        <div 
          className="w-full bg-background-dark"
          style={{ height: 'var(--header-top-offset, 0px)' }}
        />
        
        {/* Hero Image Container - Dynamic aspect ratio */}
        <div className="relative w-full aspect-[4/3] sm:aspect-[16/9] max-h-[50vh] overflow-hidden rounded-b-[2rem]">
          <Image
            src={barber.img_url || '/icon.png'}
            alt={barber.fullname}
            fill
            className="object-cover object-top"
            priority
            sizes="100vw"
          />
          
          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-background-dark via-background-dark/20 to-transparent" />
          
          {/* Floating Phone Button - Small icon, accounts for notch AND header */}
          {/* Uses max() to ensure proper spacing: either notch offset + 1rem, or 5rem (header height + gap) */}
          {barber.phone && (
            <a
              href={`tel:${barber.phone.startsWith('+') ? barber.phone : '+972' + barber.phone.replace(/^0/, '')}`}
              className="absolute left-4 w-11 h-11 rounded-full bg-accent-gold flex items-center justify-center shadow-lg active:scale-95 transition-transform z-20"
              style={{ top: 'max(calc(var(--header-top-offset, 0px) + 1rem), 5rem)' }}
              aria-label="התקשר לספר"
            >
              <Phone size={20} strokeWidth={1.5} className="text-background-dark" />
            </a>
          )}
          
          {/* Barber Info Overlay - At bottom of image */}
          <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground-light text-center drop-shadow-lg mb-3">
              {barber.fullname}
            </h1>
            
            {/* Working Days & Hours - integrated badges */}
            <div className="flex items-center justify-center gap-3 flex-wrap">
              {/* Working Days */}
              {workingDayNames.length > 0 && (
                <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-sm rounded-full px-3 py-1.5">
                  {workingDayNames.map((day, i) => (
                    <span key={i} className="text-xs text-foreground-light/90">
                      {day}
                    </span>
                  ))}
                </div>
              )}
              
              {/* Working Hours */}
              {workHours && (
                <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-sm rounded-full px-3 py-1.5">
                  <Clock size={12} strokeWidth={1.5} className="text-accent-gold" />
                  <span className="text-xs text-foreground-light/90">{workHours}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content Section - Full width padding */}
      <div className="flex-1 px-4 py-5 pb-28">
        {/* Barber Messages Section */}
        {barberMessages.length > 0 && (
          <div className="mb-5 space-y-2">
            {barberMessages.map((msg) => (
              <div 
                key={msg.id} 
                className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3 flex items-start gap-3"
              >
                <Bell size={16} strokeWidth={1.5} className="text-blue-400 flex-shrink-0 mt-0.5" />
                <p className="text-blue-300 text-sm">{msg.message}</p>
              </div>
            ))}
          </div>
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
              {services.map((service) => (
                <div
                  key={service.id}
                  className="w-full rounded-2xl border bg-white/[0.03] border-white/10 overflow-hidden"
                >
                  <div className="p-4 flex items-center justify-between gap-3">
                    {/* Service Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-medium text-foreground-light">
                        {service.name_he}
                      </h3>
                      
                      {service.description && (
                        <p className="text-foreground-muted text-xs mt-0.5 line-clamp-2">
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
                      disabled={loadingServiceId !== null}
                      className={cn(
                        'px-4 py-2.5 rounded-xl text-sm font-medium min-w-[72px]',
                        'bg-accent-gold text-background-dark',
                        'hover:bg-accent-gold/90 active:scale-95 transition-all',
                        'flex items-center justify-center gap-1 flex-shrink-0',
                        loadingServiceId === service.id && 'opacity-80 cursor-wait'
                      )}
                    >
                      {loadingServiceId === service.id ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <>
                          הזמן
                          <ChevronLeft size={14} strokeWidth={2} />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
