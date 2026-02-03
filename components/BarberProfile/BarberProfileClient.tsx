'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Phone, Clock, ChevronLeft, Bell, Loader2, Home } from 'lucide-react'
import { cn, formatPrice, buildBarberBookingUrl } from '@/lib/utils'
import { GallerySlideshow } from './GallerySlideshow'
import type { BarberWithWorkDays, Service, BarbershopSettings, BarberMessage, BarberGalleryImage } from '@/types/database'

interface BarberProfileClientProps {
  barber: BarberWithWorkDays
  services: Service[]
  shopSettings?: BarbershopSettings | null
  barberMessages?: BarberMessage[]
  galleryImages?: BarberGalleryImage[]
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
  barberMessages = [],
  galleryImages = []
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

  // Edge-to-edge hero mode - add fallback class for browsers without :has() support
  useEffect(() => {
    // Add class to body for CSS fallback (browsers without :has() selector)
    document.body.classList.add('hero-edge-to-edge-active')
    
    // Cleanup on unmount - remove the class when leaving this page
    return () => {
      document.body.classList.remove('hero-edge-to-edge-active')
    }
  }, [])

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
    <div 
      className="flex flex-col min-h-screen bg-background-dark ios-scroll-container"
      data-hero-edge-to-edge
    >
      {/* Hero Section - Full-bleed immersive display extending into notch */}
      <div className="relative w-full">
        {/* Hero Image/Gallery Container - Extends into safe area for edge-to-edge display */}
        {/* The hero-image-container class handles the negative margin in PWA mode via CSS */}
        <div 
          className="hero-image-container relative w-full aspect-[3/4] sm:aspect-[4/3] max-h-[60vh] overflow-hidden"
        >
          <GallerySlideshow
            images={galleryImages}
            fallbackImage={barber.img_url || '/icon.png'}
            fallbackPositionX={(barber as { img_position_x?: number }).img_position_x ?? 50}
            fallbackPositionY={(barber as { img_position_y?: number }).img_position_y ?? 30}
            barberName={barber.fullname}
            interval={5000}
          />
          
          {/* UI Controls Container - Stays BELOW the notch safe area */}
          {/* Uses hero-safe-content which adds safe-area padding at the top */}
          <div className="hero-safe-content absolute top-0 left-0 right-0 z-10 flex justify-end">
            {/* Back to Home Button - Properly positioned below notch */}
            <button
              onClick={() => router.push('/')}
              className="m-2 p-3 rounded-full bg-black/30 backdrop-blur-sm text-white/90 hover:bg-black/50 active:scale-95 transition-all"
              aria-label="חזרה לדף הבית"
              tabIndex={0}
            >
              <Home size={20} strokeWidth={2} />
            </button>
          </div>
          
          {/* Minimal Name Overlay - Only name, clean design */}
          <div className="absolute bottom-0 left-0 right-0 pb-6 pt-16 bg-gradient-to-t from-background-dark via-background-dark/80 to-transparent">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground-light text-center">
              {barber.fullname}
            </h1>
          </div>
        </div>
      </div>

      {/* Info Bar - Compact, modern, below the image */}
      <div className="px-4 -mt-1">
        <div className="flex items-center justify-center gap-2 flex-wrap py-3">
          {/* Working Days */}
          {workingDayNames.length > 0 && (
            <div className="flex items-center gap-1 px-3 py-1.5 bg-white/5 rounded-full">
              <span className="text-[11px] text-foreground-muted">ימים:</span>
              {workingDayNames.map((day, i) => (
                <span key={i} className="text-xs text-foreground-light font-medium">
                  {day}
                </span>
              ))}
            </div>
          )}
          
          {/* Working Hours */}
          {workHours && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 rounded-full">
              <Clock size={11} strokeWidth={1.5} className="text-accent-gold" />
              <span className="text-xs text-foreground-light">{workHours}</span>
            </div>
          )}
          
          {/* Phone - Compact inline */}
          {barber.phone && (
            <a
              href={`tel:${barber.phone.startsWith('+') ? barber.phone : '+972' + barber.phone.replace(/^0/, '')}`}
              className="flex items-center gap-1.5 text-sm text-foreground-muted hover:text-accent-gold transition-colors"
            >
              
              <Phone size={12} strokeWidth={1.5} className="text-accent-gold" />
              <span className="text-xs text-accent-gold font-medium">התקשר</span>
            </a>
          )}
        </div>
      </div>

      {/* Content Section */}
      <div className="flex-1 px-4 pt-2 pb-28">
        {/* Barber Messages Section */}
        {barberMessages.length > 0 && (
          <div className="mb-4 space-y-2">
            {barberMessages.map((msg) => (
              <div 
                key={msg.id} 
                className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3 flex items-start gap-3"
              >
                <Bell size={14} strokeWidth={1.5} className="text-blue-400 flex-shrink-0 mt-0.5" />
                <p className="text-blue-300 text-sm">{msg.message}</p>
              </div>
            ))}
          </div>
        )}

        {/* Services Section */}
        <div>
          <h2 className="text-base font-semibold text-foreground-light mb-3">
            שירותים
          </h2>
          
          {services.length === 0 ? (
            <div className="text-center py-8 rounded-2xl bg-white/5 border border-white/10">
              <p className="text-foreground-muted text-sm">אין שירותים זמינים כרגע</p>
            </div>
          ) : (
            /* Services list - no border, with gradient dividers */
            <div className="w-full">
              {services.map((service, index) => (
                <div key={service.id}>
                  {/* Gradient divider - fades out on sides */}
                  {index > 0 && (
                    <div className="mx-4 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                  )}
                  
                  <button
                    onClick={() => handleServiceSelect(service.id)}
                    disabled={loadingServiceId !== null}
                    className={cn(
                      'w-full transition-all duration-150 group',
                      'hover:bg-white/[0.03]',
                      'active:bg-white/[0.05]',
                      loadingServiceId === service.id && 'opacity-70 cursor-wait'
                    )}
                  >
                    {/* Use dir="ltr" to force left-to-right flex, then swap items visually */}
                    <div className="py-6 flex items-center w-full" dir="ltr">
                      {/* Book Button - on LEFT side */}
                      <div 
                        className={cn(
                          'px-6 py-2 rounded-lg text-base font-bold',
                          'group-hover:border-accent-gold/60',
                          'flex items-center justify-center gap-1 flex-shrink-0',
                          'transition-all duration-150'
                        )}
                      >
                        {loadingServiceId === service.id ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <>
                            <ChevronLeft size={11} strokeWidth={2.5} className="group-hover:-translate-x-0.5 transition-transform" />
                            הזמן
                          </>
                        )}
                      </div>
                      
                      {/* Spacer to push text to right */}
                      <div className="flex-1" />
                      
                      {/* Service Info - on RIGHT side, text aligned right */}
                      <div className="text-right">
                        <h3 className="text-lg font-medium text-foreground-light leading-tight">
                          {service.name_he}
                        </h3>
                        
                        {/* Duration & Price - inline, right aligned */}
                        <div className="flex items-center justify-end gap-2 mt-1">
                          <span className="text-sm text-foreground-muted flex items-center gap-1">
                            <Clock size={10} strokeWidth={1.5} />
                            {service.duration} דק׳
                          </span>
                          <span className="text-sm text-foreground-muted/50">•</span>
                          <span className="text-accent-gold font-semibold text-sm">
                            {formatPrice(service.price)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
