'use client'

import { useBookingStore } from '@/store/useBookingStore'
import { cn } from '@/lib/utils'
import { Scissors, Calendar, Clock, User, Lock, Check } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface Step {
  num: number
  label: string
  icon: LucideIcon
}

const guestSteps: Step[] = [
  { num: 1, label: 'שירות', icon: Scissors },
  { num: 2, label: 'תאריך', icon: Calendar },
  { num: 3, label: 'שעה', icon: Clock },
  { num: 4, label: 'פרטים', icon: User },
  { num: 5, label: 'אימות', icon: Lock },
  { num: 6, label: 'סיום', icon: Check },
]

const loggedInSteps: Step[] = [
  { num: 1, label: 'שירות', icon: Scissors },
  { num: 2, label: 'תאריך', icon: Calendar },
  { num: 3, label: 'שעה', icon: Clock },
  { num: 4, label: 'סיום', icon: Check },
]

export function StepIndicator() {
  const { step, isUserLoggedIn } = useBookingStore()
  
  const steps = isUserLoggedIn ? loggedInSteps : guestSteps

  return (
    <div className="flex items-center justify-center gap-0.5 xs:gap-1 sm:gap-2 w-full max-w-md mx-auto px-2">
      {steps.map((s, idx) => {
        const Icon = s.icon
        const isCompleted = step > s.num
        const isCurrent = step === s.num
        
        return (
          <div key={s.num} className="flex items-center">
            <div
              className={cn(
                'flex flex-col items-center gap-1 transition-all',
                step >= s.num ? 'opacity-100' : 'opacity-40'
              )}
            >
              {/* Step circle */}
              <div
                className={cn(
                  'w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-xs transition-all',
                  isCurrent
                    ? 'bg-accent-gold text-background-dark scale-110 shadow-gold'
                    : isCompleted
                    ? 'bg-green-600 text-white'
                    : 'bg-white/10 text-foreground-muted'
                )}
              >
                {isCompleted ? (
                  <Check size={12} strokeWidth={2} />
                ) : (
                  <Icon size={14} strokeWidth={1.5} />
                )}
              </div>
              
              {/* Label - show on larger screens or just for current step */}
              <span 
                className={cn(
                  'text-[10px] sm:text-xs text-center leading-tight',
                  isCurrent ? 'text-accent-gold font-medium' : 'text-foreground-muted',
                  isCurrent ? 'block' : 'hidden sm:block'
                )}
              >
                {s.label}
              </span>
            </div>
            
            {/* Connector line */}
            {idx < steps.length - 1 && (
              <div
                className={cn(
                  'w-3 xs:w-4 sm:w-6 md:w-8 h-0.5 mx-0.5 transition-colors',
                  step > s.num ? 'bg-green-600' : 'bg-white/10'
                )}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
