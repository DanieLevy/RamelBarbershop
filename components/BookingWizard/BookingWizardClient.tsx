'use client'

import { useEffect } from 'react'
import { useBookingStore } from '@/store/useBookingStore'
import { useAuthStore } from '@/store/useAuthStore'
import type { BarberWithWorkDays, Service, BarbershopSettings, BarbershopClosure, BarberSchedule, BarberClosure, BarberMessage } from '@/types/database'
import { ScissorsLoader } from '@/components/ui/ScissorsLoader'
import { StepIndicator } from './StepIndicator'
import { ServiceSelection } from './ServiceSelection'
import { DateSelection } from './DateSelection'
import { TimeSelection } from './TimeSelection'
import { CustomerDetails } from './CustomerDetails'
import { OTPVerification } from './OTPVerification'
import { Confirmation } from './Confirmation'
import { LoggedInConfirmation } from './LoggedInConfirmation'
import { FaBell } from 'react-icons/fa'

interface BookingWizardClientProps {
  barberId: string
  barber: BarberWithWorkDays
  services: Service[]
  shopSettings?: BarbershopSettings | null
  shopClosures?: BarbershopClosure[]
  barberSchedule?: BarberSchedule | null
  barberClosures?: BarberClosure[]
  barberMessages?: BarberMessage[]
}

export function BookingWizardClient({ 
  barberId, 
  barber, 
  services,
  shopSettings,
  shopClosures = [],
  barberSchedule,
  barberClosures = [],
  barberMessages = [],
}: BookingWizardClientProps) {
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
        return (
          <DateSelection 
            workDays={barber.work_days}
            shopSettings={shopSettings}
            shopClosures={shopClosures}
            barberSchedule={barberSchedule}
            barberClosures={barberClosures}
          />
        )
      case 'time':
        return (
          <TimeSelection 
            barberId={barberId}
            shopSettings={shopSettings}
            barberSchedule={barberSchedule}
          />
        )
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
      <div className="flex flex-col items-center justify-center py-16">
        <ScissorsLoader size="lg" text="טוען..." />
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-6 px-4 py-6">
      <StepIndicator />
      
      {/* Barber Messages */}
      {barberMessages.length > 0 && step === 1 && (
        <div className="w-full max-w-md space-y-2">
          {barberMessages.map((msg) => (
            <div 
              key={msg.id} 
              className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3 flex items-start gap-3"
            >
              <FaBell className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
              <p className="text-blue-300 text-sm">{msg.message}</p>
            </div>
          ))}
        </div>
      )}
      
      {/* Show logged-in badge */}
      {isUserLoggedIn && loggedInCustomer && step === 1 && (
        <div className="w-full max-w-md bg-accent-gold/10 border border-accent-gold/30 rounded-xl p-3 text-center">
          <p className="text-accent-gold text-sm">
            מחובר כ-<strong>{loggedInCustomer.fullname}</strong> • לא נדרש אימות נוסף
          </p>
        </div>
      )}
      
      {/* Show message if no services */}
      {services.length === 0 && step === 1 && (
        <div className="w-full max-w-md bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-center">
          <p className="text-red-400 text-sm">
            אין שירותים זמינים לספר זה כרגע. אנא נסה שוב מאוחר יותר.
          </p>
        </div>
      )}
      
      <div className="w-full max-w-md">
        {renderStep()}
      </div>
    </div>
  )
}
