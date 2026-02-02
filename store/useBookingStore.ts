import { create } from 'zustand'
import type { Service, Customer } from '@/types/database'
import type { OtpSession } from '@/lib/sms/sms-service'

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
  // Current step (1-6 for guest, 1-4 for logged-in user)
  step: number
  
  // Total steps (4 for logged-in, 6 for guest)
  totalSteps: number
  
  // Is user logged in (affects step count)
  isUserLoggedIn: boolean
  
  // Logged-in customer data
  loggedInCustomer: Customer | null
  
  // Flag to prevent auth sync during active booking flow
  isFlowLocked: boolean
  
  // Booking data
  barberId: string | null
  service: Service | null
  date: DateSelection | null
  timeTimestamp: number | null
  customer: CustomerInfo
  
  // OTP session reference (from SMS provider)
  otpConfirmation: OtpSession | null
  
  // Actions
  setStep: (step: number) => void
  nextStep: () => void
  prevStep: () => void
  setBarberId: (barberId: string) => void
  setService: (service: Service) => void
  setDate: (date: DateSelection) => void
  setTime: (timestamp: number) => void
  setCustomer: (customer: Partial<CustomerInfo>) => void
  setOtpConfirmation: (confirmation: OtpSession | null) => void
  setLoggedInUser: (customer: Customer | null, force?: boolean) => void
  lockFlow: () => void
  unlockFlow: () => void
  reset: () => void
  
  // Computed
  isStepComplete: (step: number) => boolean
  getActualStep: () => string // Returns step name for rendering
}

const initialCustomer: CustomerInfo = {
  fullname: '',
  phone: '',
}

export const useBookingStore = create<BookingState>((set, get) => ({
  // Initial state
  step: 1,
  totalSteps: 6,
  isUserLoggedIn: false,
  loggedInCustomer: null,
  isFlowLocked: false,
  barberId: null,
  service: null,
  date: null,
  timeTimestamp: null,
  customer: { ...initialCustomer },
  otpConfirmation: null,

  // Actions
  setStep: (step) => set({ step }),
  
  nextStep: () => {
    const state = get()
    set({ step: Math.min(state.step + 1, state.totalSteps) })
  },
  
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
  
  setLoggedInUser: (customer, force = false) => {
    const state = get()
    
    // Don't change user state mid-flow unless forced
    // This prevents the auth sync from disrupting the wizard after OTP verification
    if (state.isFlowLocked && !force) {
      return
    }
    
    if (customer) {
      set({
        isUserLoggedIn: true,
        loggedInCustomer: customer,
        totalSteps: 4, // service, date, time, confirmation
        customer: {
          fullname: customer.fullname,
          phone: customer.phone,
        },
      })
    } else {
      set({
        isUserLoggedIn: false,
        loggedInCustomer: null,
        totalSteps: 6,
      })
    }
  },
  
  lockFlow: () => set({ isFlowLocked: true }),
  
  unlockFlow: () => set({ isFlowLocked: false }),
  
  reset: () =>
    set({
      step: 1,
      service: null,
      date: null,
      timeTimestamp: null,
      customer: { ...initialCustomer },
      otpConfirmation: null,
      isFlowLocked: false,
      // Note: Don't reset isUserLoggedIn and loggedInCustomer here
    }),

  // Computed
  isStepComplete: (step) => {
    const state = get()
    
    if (state.isUserLoggedIn) {
      // For logged-in users: service(1), date(2), time(3), confirmation(4)
      switch (step) {
        case 1:
          return state.service !== null
        case 2:
          return state.date !== null
        case 3:
          return state.timeTimestamp !== null
        case 4:
          return true
        default:
          return false
      }
    } else {
      // For guests: service(1), date(2), time(3), details(4), otp(5), confirmation(6)
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
    }
  },
  
  getActualStep: () => {
    const state = get()
    
    if (state.isUserLoggedIn) {
      // Logged-in user steps: service, date, time, confirmation
      switch (state.step) {
        case 1: return 'service'
        case 2: return 'date'
        case 3: return 'time'
        case 4: return 'confirmation'
        default: return 'service'
      }
    } else {
      // Guest steps: service, date, time, details, otp, confirmation
      switch (state.step) {
        case 1: return 'service'
        case 2: return 'date'
        case 3: return 'time'
        case 4: return 'details'
        case 5: return 'otp'
        case 6: return 'confirmation'
        default: return 'service'
      }
    }
  },
}))
