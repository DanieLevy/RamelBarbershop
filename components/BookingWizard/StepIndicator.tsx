'use client'

import { useBookingStore } from '@/store/useBookingStore'
import { cn } from '@/lib/utils'

/**
 * Minimalistic Apple-style Step Indicator
 * 
 * Features:
 * - Clean pill-shaped progress bar
 * - Subtle glass morphism
 * - Animated transitions
 * - Compact and mobile-friendly
 */
export function StepIndicator() {
  const { step, totalSteps, isUserLoggedIn } = useBookingStore()
  
  // Calculate actual total steps based on login state
  const actualTotalSteps = isUserLoggedIn ? 4 : 6
  
  // Calculate progress percentage
  const progress = Math.min((step / actualTotalSteps) * 100, 100)

  // Step labels for current step display
  const stepLabels: Record<number, string> = isUserLoggedIn
    ? { 1: 'בחירת שירות', 2: 'בחירת תאריך', 3: 'בחירת שעה', 4: 'אישור הזמנה' }
    : { 1: 'בחירת שירות', 2: 'בחירת תאריך', 3: 'בחירת שעה', 4: 'פרטים אישיים', 5: 'אימות טלפון', 6: 'אישור הזמנה' }

  const currentLabel = stepLabels[step] || ''

  return (
    <div className="w-full max-w-md mx-auto px-4">
      {/* Progress Container */}
      <div className="glass-card p-3 sm:p-4">
        {/* Top Row: Step Counter and Label */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-foreground-muted text-xs">
            שלב {step} מתוך {actualTotalSteps}
          </span>
          <span className="text-foreground-light text-sm font-medium">
            {currentLabel}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="relative h-1.5 bg-white/10 rounded-full overflow-hidden">
          {/* Background dots for visual reference */}
          <div className="absolute inset-0 flex items-center justify-between px-0.5">
            {Array.from({ length: actualTotalSteps }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  'w-1 h-1 rounded-full transition-colors duration-300',
                  i < step ? 'bg-transparent' : 'bg-white/20'
                )}
              />
            ))}
          </div>
          
          {/* Animated Progress Fill */}
          <div 
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-accent-gold to-accent-orange rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          >
            {/* Shine effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse" />
          </div>
        </div>

        {/* Step Pills - Compact dots below */}
        <div className="flex items-center justify-center gap-1.5 mt-3">
          {Array.from({ length: actualTotalSteps }).map((_, i) => {
            const stepNum = i + 1
            const isCompleted = step > stepNum
            const isCurrent = step === stepNum
            
            return (
              <div
                key={i}
                className={cn(
                  'transition-all duration-300',
                  isCurrent 
                    ? 'w-6 h-2 rounded-full bg-accent-gold' 
                    : isCompleted
                    ? 'w-2 h-2 rounded-full bg-green-500'
                    : 'w-2 h-2 rounded-full bg-white/20'
                )}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}
