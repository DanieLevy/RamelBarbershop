'use client'

import { useBookingStore } from '@/store/useBookingStore'
import type { Service } from '@/types/database'
import { cn } from '@/lib/utils'
import { FaCut, FaClock, FaShekelSign } from 'react-icons/fa'

interface ServiceSelectionProps {
  services: Service[]
}

export function ServiceSelection({ services }: ServiceSelectionProps) {
  const { service: selectedService, setService, nextStep } = useBookingStore()

  const handleSelect = (service: Service) => {
    setService(service)
    nextStep()
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h2 className="text-xl sm:text-2xl text-foreground-light font-medium">
          בחר סוג שירות
        </h2>
        <p className="text-foreground-muted text-sm mt-1">
          {services.length} שירותים זמינים
        </p>
      </div>
      
      <div className="flex flex-col gap-3">
        {services.map((service) => (
          <button
            key={service.id}
            onClick={() => handleSelect(service)}
            className={cn(
              'flex items-center p-4 sm:p-5 rounded-xl backdrop-blur-lg bg-background-card border transition-all cursor-pointer',
              'hover:scale-[1.01] active:scale-[0.99]',
              selectedService?.id === service.id
                ? 'border-accent-gold bg-accent-gold/10 shadow-gold'
                : 'border-white/10 hover:border-white/30'
            )}
          >
            {/* Icon */}
            <div className={cn(
              'w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0',
              selectedService?.id === service.id
                ? 'bg-accent-gold/20 text-accent-gold'
                : 'bg-white/5 text-foreground-muted'
            )}>
              <FaCut className="w-5 h-5" />
            </div>
            
            {/* Content */}
            <div className="flex-1 text-right mr-4">
              <span className="text-foreground-light font-medium block text-base">
                {service.name_he}
              </span>
              <span className="text-foreground-muted text-sm flex items-center gap-1 mt-1">
                <FaClock className="w-3 h-3" />
                {service.duration} דקות
              </span>
            </div>
            
            {/* Price */}
            <div className="flex items-center gap-1 text-accent-gold font-medium text-lg">
              <span>{service.price}</span>
              <FaShekelSign className="w-4 h-4" />
            </div>
          </button>
        ))}
      </div>
      
      {services.length === 0 && (
        <p className="text-center text-foreground-muted py-8">
          אין שירותים זמינים כרגע
        </p>
      )}
    </div>
  )
}
