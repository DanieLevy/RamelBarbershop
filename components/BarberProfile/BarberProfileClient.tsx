'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Phone, Clock, Scissors, ChevronLeft } from 'lucide-react'
import { cn, formatPrice } from '@/lib/utils'
import { GlassCard } from '@/components/ui/GlassCard'
import type { BarberWithWorkDays, Service } from '@/types/database'

interface BarberProfileClientProps {
  barber: BarberWithWorkDays
  services: Service[]
}

export function BarberProfileClient({ barber, services }: BarberProfileClientProps) {
  const router = useRouter()
  const [selectedService, setSelectedService] = useState<string | null>(null)

  const handleServiceSelect = (serviceId: string) => {
    setSelectedService(serviceId)
  }

  const handleBookNow = () => {
    if (selectedService) {
      router.push(`/barber/${barber.id}/book?service=${selectedService}`)
    }
  }

  const handleServiceBookNow = (serviceId: string) => {
    router.push(`/barber/${barber.id}/book?service=${serviceId}`)
  }

  // Get working days
  const workingDays = barber.work_days?.filter(d => d.is_working) || []
  const hasWorkingDays = workingDays.length > 0

  return (
    <div className="container-mobile py-6 sm:py-8">
      {/* Barber Profile Card */}
      <GlassCard className="mb-6 sm:mb-8 overflow-hidden">
        <div className="flex flex-col sm:flex-row gap-6">
          {/* Barber Image */}
          <div className="flex-shrink-0 flex justify-center sm:justify-start">
            <div className="relative">
              {/* Decorative ring */}
              <div className="absolute -inset-2 rounded-full bg-gradient-to-br from-accent-gold/30 to-accent-orange/20 blur-sm" />
              
              <div className="relative w-32 h-32 sm:w-40 sm:h-40 rounded-full overflow-hidden border-4 border-accent-gold/40 shadow-gold-lg">
                <Image
                  src={barber.img_url || '/icon.png'}
                  alt={barber.fullname}
                  fill
                  className="object-cover"
                  priority
                />
              </div>
            </div>
          </div>
          
          {/* Barber Info */}
          <div className="flex-1 text-center sm:text-right">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground-light mb-2">
              {barber.fullname}
            </h1>
            
            <p className="text-foreground-muted text-sm sm:text-base mb-4">
              ספר מקצועי
            </p>
            
            {/* Contact Info */}
            <div className="space-y-2">
              {barber.phone && (
                <a 
                  href={`tel:${barber.phone}`}
                  className="inline-flex items-center gap-2 text-foreground-muted hover:text-accent-gold transition-colors"
                >
                  <Phone size={16} strokeWidth={1.5} className="text-accent-gold" />
                  <span dir="ltr" className="text-sm">{barber.phone}</span>
                </a>
              )}
              
              {hasWorkingDays && (
                <div className="flex items-center justify-center sm:justify-start gap-2 text-foreground-muted">
                  <Clock size={16} strokeWidth={1.5} className="text-accent-gold" />
                  <span className="text-sm">
                    {workingDays.length} ימי עבודה בשבוע
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Services Section */}
      <div className="mb-6">
        <h2 className="text-xl sm:text-2xl font-semibold text-foreground-light mb-4 flex items-center gap-2">
          <Scissors size={22} strokeWidth={1.5} className="text-accent-gold" />
          שירותים זמינים
        </h2>
        
        {services.length === 0 ? (
          <GlassCard className="text-center py-8">
            <p className="text-foreground-muted">אין שירותים זמינים כרגע</p>
          </GlassCard>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {services.map((service) => {
              const isSelected = selectedService === service.id
              
              return (
                <button
                  key={service.id}
                  onClick={() => handleServiceSelect(service.id)}
                  className={cn(
                    'relative p-4 sm:p-5 rounded-2xl border text-right transition-all',
                    'hover:scale-[1.02] active:scale-[0.98]',
                    isSelected
                      ? 'bg-accent-gold/20 border-accent-gold/50 shadow-gold'
                      : 'bg-background-card border-white/10 hover:border-accent-gold/30'
                  )}
                >
                  {/* Selection indicator */}
                  {isSelected && (
                    <div className="absolute top-3 left-3 w-6 h-6 rounded-full bg-accent-gold flex items-center justify-center">
                      <svg className="w-4 h-4 text-background-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                  
                  <div className="flex flex-col gap-2">
                    <h3 className="text-lg font-medium text-foreground-light">
                      {service.name_he}
                    </h3>
                    
                    {service.description && (
                      <p className="text-foreground-muted text-sm line-clamp-2">
                        {service.description}
                      </p>
                    )}
                    
                    <div className="flex items-center justify-between mt-2 pt-3 border-t border-white/10">
                      <div className="flex items-center gap-3 text-sm text-foreground-muted">
                        <span className="flex items-center gap-1">
                          <Clock size={14} strokeWidth={1.5} />
                          {service.duration} דק&apos;
                        </span>
                      </div>
                      
                      <span className="text-accent-gold font-bold text-lg">
                        {formatPrice(service.price)}
                      </span>
                    </div>
                  </div>
                  
                  {/* Quick book button */}
                  <div className="mt-4 pt-3 border-t border-white/10">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleServiceBookNow(service.id)
                      }}
                      className={cn(
                        'w-full py-2.5 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2',
                        'bg-accent-gold/10 text-accent-gold hover:bg-accent-gold hover:text-background-dark'
                      )}
                    >
                      הזמן עכשיו
                      <ChevronLeft size={16} strokeWidth={2} />
                    </button>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Sticky Book Now Button */}
      {selectedService && (
        <div className="fixed bottom-20 md:bottom-16 left-0 right-0 p-4 bg-gradient-to-t from-background-dark via-background-dark to-transparent z-40">
          <div className="container-mobile">
            <button
              onClick={handleBookNow}
              className="w-full py-4 rounded-2xl bg-accent-gold text-background-dark font-bold text-lg shadow-gold hover:bg-accent-gold/90 transition-all flex items-center justify-center gap-2"
            >
              המשך להזמנה
              <ChevronLeft size={20} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

