'use client'

import { useEffect } from 'react'
import { useBookingStore } from '@/store/useBookingStore'
import type { BarberWithWorkDays, Service } from '@/types/database'
import { StepIndicator } from './StepIndicator'
import { ServiceSelection } from './ServiceSelection'
import { DateSelection } from './DateSelection'
import { TimeSelection } from './TimeSelection'
import { CustomerDetails } from './CustomerDetails'
import { OTPVerification } from './OTPVerification'
import { Confirmation } from './Confirmation'

interface BookingWizardClientProps {
  barberId: string
  barber: BarberWithWorkDays
  services: Service[]
}

export function BookingWizardClient({ barberId, barber, services }: BookingWizardClientProps) {
  const { step, setBarberId, reset } = useBookingStore()

  // Set barber ID on mount and reset on unmount
  useEffect(() => {
    setBarberId(barberId)
    return () => reset()
  }, [barberId, setBarberId, reset])

  const renderStep = () => {
    switch (step) {
      case 1:
        return <ServiceSelection services={services} />
      case 2:
        return <DateSelection workDays={barber.work_days} />
      case 3:
        return <TimeSelection barberId={barberId} />
      case 4:
        return <CustomerDetails />
      case 5:
        return <OTPVerification />
      case 6:
        return <Confirmation barber={barber} />
      default:
        return <ServiceSelection services={services} />
    }
  }

  return (
    <div className="flex flex-col items-center gap-8 px-4 py-6">
      <StepIndicator />
      
      <div className="w-full max-w-md">
        {renderStep()}
      </div>
    </div>
  )
}

