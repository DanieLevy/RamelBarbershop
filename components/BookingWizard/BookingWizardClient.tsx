'use client'

import { useEffect } from 'react'
import { useBookingStore } from '@/store/useBookingStore'
import { useAuthStore } from '@/store/useAuthStore'
import type { BarberWithWorkDays, Service } from '@/types/database'
import { StepIndicator } from './StepIndicator'
import { ServiceSelection } from './ServiceSelection'
import { DateSelection } from './DateSelection'
import { TimeSelection } from './TimeSelection'
import { CustomerDetails } from './CustomerDetails'
import { OTPVerification } from './OTPVerification'
import { Confirmation } from './Confirmation'
import { LoggedInConfirmation } from './LoggedInConfirmation'

interface BookingWizardClientProps {
  barberId: string
  barber: BarberWithWorkDays
  services: Service[]
}

export function BookingWizardClient({ barberId, barber, services }: BookingWizardClientProps) {
  const { step, setBarberId, setLoggedInUser, reset, getActualStep, isUserLoggedIn } = useBookingStore()
  const { customer: loggedInCustomer, isLoggedIn, isInitialized } = useAuthStore()

  // Set barber ID on mount and reset on unmount
  useEffect(() => {
    setBarberId(barberId)
    return () => reset()
  }, [barberId, setBarberId, reset])

  // Sync logged-in user state with booking store
  useEffect(() => {
    if (isInitialized) {
      if (isLoggedIn && loggedInCustomer) {
        setLoggedInUser(loggedInCustomer)
      } else {
        setLoggedInUser(null)
      }
    }
  }, [isLoggedIn, loggedInCustomer, isInitialized, setLoggedInUser])

  const renderStep = () => {
    const actualStep = getActualStep()
    
    switch (actualStep) {
      case 'service':
        return <ServiceSelection services={services} />
      case 'date':
        return <DateSelection workDays={barber.work_days} />
      case 'time':
        return <TimeSelection barberId={barberId} />
      case 'details':
        return <CustomerDetails />
      case 'otp':
        return <OTPVerification />
      case 'confirmation':
        // Use different confirmation component for logged-in users
        if (isUserLoggedIn) {
          return <LoggedInConfirmation barber={barber} />
        }
        return <Confirmation barber={barber} />
      default:
        return <ServiceSelection services={services} />
    }
  }

  // Show loading while initializing auth
  if (!isInitialized) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <div className="w-8 h-8 border-2 border-accent-gold border-t-transparent rounded-full animate-spin" />
        <p className="text-foreground-muted text-sm">טוען...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-8 px-4 py-6">
      <StepIndicator />
      
      {/* Show logged-in badge */}
      {isUserLoggedIn && loggedInCustomer && step === 1 && (
        <div className="w-full max-w-md bg-accent-gold/10 border border-accent-gold/30 rounded-xl p-3 text-center">
          <p className="text-accent-gold text-sm">
            מחובר כ-<strong>{loggedInCustomer.fullname}</strong> • לא נדרש אימות נוסף
          </p>
        </div>
      )}
      
      <div className="w-full max-w-md">
        {renderStep()}
      </div>
    </div>
  )
}
