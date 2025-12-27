'use client'

import { useBookingStore } from '@/store/useBookingStore'
import { cn } from '@/lib/utils'

const guestSteps = [
  { num: 1, label: 'שירות' },
  { num: 2, label: 'תאריך' },
  { num: 3, label: 'שעה' },
  { num: 4, label: 'פרטים' },
  { num: 5, label: 'אימות' },
  { num: 6, label: 'סיום' },
]

const loggedInSteps = [
  { num: 1, label: 'שירות' },
  { num: 2, label: 'תאריך' },
  { num: 3, label: 'שעה' },
  { num: 4, label: 'סיום' },
]

export function StepIndicator() {
  const { step, isUserLoggedIn } = useBookingStore()
  
  const steps = isUserLoggedIn ? loggedInSteps : guestSteps

  return (
    <div className="flex items-center justify-center gap-1 md:gap-2 w-full max-w-md">
      {steps.map((s, idx) => (
        <div key={s.num} className="flex items-center">
          <div
            className={cn(
              'flex flex-col items-center gap-1 transition-all',
              step >= s.num ? 'opacity-100' : 'opacity-40'
            )}
          >
            <div
              className={cn(
                'w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center text-xs md:text-sm font-medium transition-all',
                step === s.num
                  ? 'bg-accent-gold text-background-dark scale-110'
                  : step > s.num
                  ? 'bg-green-600 text-white'
                  : 'bg-foreground-muted/30 text-foreground-muted'
              )}
            >
              {step > s.num ? '✓' : s.num}
            </div>
            <span className="text-[10px] md:text-xs text-foreground-light hidden sm:block">{s.label}</span>
          </div>
          
          {idx < steps.length - 1 && (
            <div
              className={cn(
                'w-4 md:w-8 lg:w-10 h-0.5 mx-0.5 md:mx-1',
                step > s.num ? 'bg-green-600' : 'bg-foreground-muted/30'
              )}
            />
          )}
        </div>
      ))}
    </div>
  )
}
