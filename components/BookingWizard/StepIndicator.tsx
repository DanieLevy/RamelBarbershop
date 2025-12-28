'use client'

import { useBookingStore } from '@/store/useBookingStore'
import { cn } from '@/lib/utils'

/**
 * Minimal Bullet-Style Step Indicator
 * 
 * Clean, modern, and mobile-friendly progress indicator
 * with simple dots and a subtle progress line
 */
export function StepIndicator() {
  const { step, isUserLoggedIn } = useBookingStore()
  
  // Calculate actual total steps based on login state
  const actualTotalSteps = isUserLoggedIn ? 4 : 6

  return (
    <div className="w-full max-w-xs mx-auto">
      {/* Minimal Dots */}
      <div className="flex items-center justify-center gap-2">
        {Array.from({ length: actualTotalSteps }).map((_, i) => {
          const stepNum = i + 1
          const isCompleted = step > stepNum
          const isCurrent = step === stepNum
          
          return (
            <div
              key={i}
              className={cn(
                'transition-all duration-300 rounded-full',
                isCurrent 
                  ? 'w-8 h-2 bg-accent-gold' 
                  : isCompleted
                  ? 'w-2 h-2 bg-accent-gold/60'
                  : 'w-2 h-2 bg-white/20'
              )}
            />
          )
        })}
      </div>
      
      {/* Step Counter Text - Small and subtle */}
      <p className="text-center text-xs text-foreground-muted mt-2">
        {step} / {actualTotalSteps}
      </p>
    </div>
  )
}
