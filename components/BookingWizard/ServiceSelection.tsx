'use client'

import { useBookingStore } from '@/store/useBookingStore'
import type { Service } from '@/types/database'
import { cn } from '@/lib/utils'

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
      <h2 className="text-xl text-center text-foreground-light font-medium">
        בחר סוג שירות
      </h2>
      
      <div className="flex flex-col gap-3">
        {services.map((service) => (
          <button
            key={service.id}
            onClick={() => handleSelect(service)}
            className={cn(
              'flex justify-between items-center p-4 rounded-xl backdrop-blur-lg bg-background-card border transition-all cursor-pointer',
              selectedService?.id === service.id
                ? 'border-accent-gold bg-accent-gold/10'
                : 'border-white/10 hover:border-white/30'
            )}
          >
            <div className="flex flex-col items-start gap-1">
              <span className="text-foreground-light font-medium">{service.name_he}</span>
              <span className="text-foreground-muted text-sm">{service.duration} דקות</span>
            </div>
            <span className="text-accent-gold font-medium">₪{service.price}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

