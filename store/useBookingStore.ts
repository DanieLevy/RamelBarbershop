import { create } from 'zustand'
import type { Service } from '@/types/database'
import type { ConfirmationResult } from 'firebase/auth'

export interface DateSelection {
  dayName: string
  dayNum: string
  dateTimestamp: number
}

export interface CustomerInfo {
  fullname: string
  phone: string
}

interface BookingState {
  // Current step (1-6)
  step: number
  
  // Booking data
  barberId: string | null
  service: Service | null
  date: DateSelection | null
  timeTimestamp: number | null
  customer: CustomerInfo
  
  // OTP confirmation reference
  otpConfirmation: ConfirmationResult | null
  
  // Actions
  setStep: (step: number) => void
  nextStep: () => void
  prevStep: () => void
  setBarberId: (barberId: string) => void
  setService: (service: Service) => void
  setDate: (date: DateSelection) => void
  setTime: (timestamp: number) => void
  setCustomer: (customer: Partial<CustomerInfo>) => void
  setOtpConfirmation: (confirmation: ConfirmationResult | null) => void
  reset: () => void
  
  // Computed
  isStepComplete: (step: number) => boolean
}

const initialCustomer: CustomerInfo = {
  fullname: '',
  phone: '',
}

export const useBookingStore = create<BookingState>((set, get) => ({
  // Initial state
  step: 1,
  barberId: null,
  service: null,
  date: null,
  timeTimestamp: null,
  customer: { ...initialCustomer },
  otpConfirmation: null,

  // Actions
  setStep: (step) => set({ step }),
  
  nextStep: () => set((state) => ({ step: Math.min(state.step + 1, 6) })),
  
  prevStep: () => set((state) => ({ step: Math.max(state.step - 1, 1) })),
  
  setBarberId: (barberId) => set({ barberId }),
  
  setService: (service) => set({ service }),
  
  setDate: (date) => set({ date }),
  
  setTime: (timestamp) => set({ timeTimestamp: timestamp }),
  
  setCustomer: (customer) =>
    set((state) => ({
      customer: { ...state.customer, ...customer },
    })),
  
  setOtpConfirmation: (confirmation) => set({ otpConfirmation: confirmation }),
  
  reset: () =>
    set({
      step: 1,
      service: null,
      date: null,
      timeTimestamp: null,
      customer: { ...initialCustomer },
      otpConfirmation: null,
    }),

  // Computed
  isStepComplete: (step) => {
    const state = get()
    switch (step) {
      case 1:
        return state.service !== null
      case 2:
        return state.date !== null
      case 3:
        return state.timeTimestamp !== null
      case 4:
        return state.customer.fullname.trim() !== '' && state.customer.phone.length === 10
      case 5:
        return false // OTP verification handled separately
      case 6:
        return true
      default:
        return false
    }
  },
}))

