'use client'

import { useBookingStore } from '@/store/useBookingStore'
import { cn } from '@/lib/utils'

const steps = [
  { num: 1, label: 'סוג שירות' },
  { num: 2, label: 'תאריך' },
  { num: 3, label: 'שעה' },
  { num: 4, label: 'פרטים' },
  { num: 5, label: 'אימות' },
  { num: 6, label: 'סיום' },
]

export function StepIndicator() {
  const step = useBookingStore((state) => state.step)

  return (
    <div className="flex items-center justify-center gap-2 w-full max-w-md">
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
                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all',
                step === s.num
                  ? 'bg-accent-gold text-background-dark scale-110'
                  : step > s.num
                  ? 'bg-green-600 text-white'
                  : 'bg-foreground-muted/30 text-foreground-muted'
              )}
            >
              {step > s.num ? '✓' : s.num}
            </div>
            <span className="text-xs text-foreground-light hidden md:block">{s.label}</span>
          </div>
          
          {idx < steps.length - 1 && (
            <div
              className={cn(
                'w-6 md:w-10 h-0.5 mx-1',
                step > s.num ? 'bg-green-600' : 'bg-foreground-muted/30'
              )}
            />
          )}
        </div>
      ))}
    </div>
  )
}

