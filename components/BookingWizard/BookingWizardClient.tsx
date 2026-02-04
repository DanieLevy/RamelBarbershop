'use client'

import { useEffect, useState, useCallback } from 'react'
import { useBookingStore } from '@/store/useBookingStore'
import { useAuthStore } from '@/store/useAuthStore'
import type { BarberWithWorkDays, Service, BarbershopSettings, BarbershopClosure, BarberClosure, BarberMessage, BarberBookingSettings } from '@/types/database'
import { ScissorsLoader } from '@/components/ui/ScissorsLoader'
import { StepIndicator } from './StepIndicator'
import { ServiceSelection } from './ServiceSelection'
import { DateSelection } from './DateSelection'
import { TimeSelection } from './TimeSelection'
import { CustomerDetails } from './CustomerDetails'
import { OTPVerification } from './OTPVerification'
import { Confirmation } from './Confirmation'
import { LoggedInConfirmation } from './LoggedInConfirmation'
import { Bell } from 'lucide-react'
import ErrorBoundary from '@/components/ErrorBoundary'
import { getBarberClosures } from '@/lib/services/availability.service'
import { createClient } from '@/lib/supabase/client'

interface BookingWizardClientProps {
  barberId: string
  barber: BarberWithWorkDays
  services: Service[]
  shopSettings?: BarbershopSettings | null
  shopClosures?: BarbershopClosure[]
  barberClosures?: BarberClosure[]
  barberMessages?: BarberMessage[]
  barberBookingSettings?: BarberBookingSettings | null
  preSelectedServiceId?: string
}

export function BookingWizardClient({ 
  barberId, 
  barber, 
  services,
  shopSettings,
  shopClosures = [],
  barberClosures = [],
  barberMessages = [],
  barberBookingSettings,
  preSelectedServiceId,
}: BookingWizardClientProps) {
  const { step, setBarberId, setService, nextStep, setLoggedInUser, reset, getActualStep, isUserLoggedIn } = useBookingStore()
  const { customer: loggedInCustomer, isLoggedIn, isInitialized } = useAuthStore()
  
  // Dynamic closures state - initialized with server-side data, updated via real-time subscription
  const [dynamicBarberClosures, setDynamicBarberClosures] = useState<BarberClosure[]>(barberClosures)
  
  // Refresh closures from server
  const refreshClosures = useCallback(async () => {
    try {
      const freshClosures = await getBarberClosures(barberId)
      setDynamicBarberClosures(freshClosures)
      console.log('[BookingWizard] Closures refreshed:', freshClosures.length)
    } catch (err) {
      console.error('[BookingWizard] Error refreshing closures:', err)
    }
  }, [barberId])
  
  // Set barber ID on mount and reset on unmount
  useEffect(() => {
    setBarberId(barberId)
    return () => reset()
  }, [barberId, setBarberId, reset])
  
  // Real-time subscription for barber closures
  useEffect(() => {
    const supabase = createClient()
    
    // Subscribe to barber_closures changes for this barber
    const channel = supabase
      .channel(`barber_closures_${barberId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'barber_closures',
          filter: `barber_id=eq.${barberId}`
        },
        (payload) => {
          console.log('[BookingWizard] Closure change detected:', payload.eventType)
          // Refresh closures when any change occurs
          refreshClosures()
        }
      )
      .subscribe()
    
    return () => {
      supabase.removeChannel(channel)
    }
  }, [barberId, refreshClosures])
  
  // Refresh closures when entering date selection step
  useEffect(() => {
    const actualStep = getActualStep()
    if (actualStep === 'date') {
      refreshClosures()
    }
  }, [step, getActualStep, refreshClosures])

  // Handle pre-selected service - auto-advance to date selection
  useEffect(() => {
    if (preSelectedServiceId && services.length > 0) {
      const selectedService = services.find(s => s.id === preSelectedServiceId)
      if (selectedService) {
        setService(selectedService)
        if (step === 1) {
          nextStep()
        }
      }
    }
  }, [preSelectedServiceId, services, setService, step, nextStep])

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
            barberClosures={dynamicBarberClosures}
            barberBookingSettings={barberBookingSettings}
          />
        )
      case 'time':
        return (
          <TimeSelection 
            barberId={barberId}
            shopSettings={shopSettings}
            barberWorkDays={barber.work_days}
            barberBookingSettings={barberBookingSettings}
          />
        )
      case 'details':
        return <CustomerDetails />
      case 'otp':
        return <OTPVerification />
      case 'confirmation':
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
    <div className="flex flex-col gap-4 px-4 pt-4 pb-6">
      {/* Step Indicator - Minimal */}
      <StepIndicator />
      
      {/* Barber Messages - Only on service selection step */}
      {barberMessages.length > 0 && step === 1 && (
        <div className="w-full max-w-md mx-auto space-y-2">
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
      
      {/* Logged-in badge */}
      {isUserLoggedIn && loggedInCustomer && step === 1 && (
        <div className="w-full max-w-md mx-auto bg-accent-gold/10 border border-accent-gold/30 rounded-xl p-3 text-center">
          <p className="text-accent-gold text-sm">
            מחובר כ-<strong>{loggedInCustomer.fullname}</strong> • לא נדרש אימות נוסף
          </p>
        </div>
      )}
      
      {/* No services message */}
      {services.length === 0 && step === 1 && (
        <div className="w-full max-w-md mx-auto bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-center">
          <p className="text-red-400 text-sm">
            אין שירותים זמינים לספר זה כרגע. אנא נסה שוב מאוחר יותר.
          </p>
        </div>
      )}
      
      {/* Main Step Content - wrapped in ErrorBoundary for granular error handling */}
      <ErrorBoundary component={`BookingWizard-Step${step}`}>
        <div className="w-full max-w-md mx-auto">
          {renderStep()}
        </div>
      </ErrorBoundary>
    </div>
  )
}
