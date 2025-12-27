'use client'

import { cn } from '@/lib/utils'
import { forwardRef } from 'react'

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'hover' | 'gold' | 'dark' | 'elevated' | 'subtle' | 'interactive'
  padding?: 'none' | 'sm' | 'md' | 'lg'
  rounded?: 'md' | 'lg' | 'xl' | '2xl' | '3xl' | 'full'
}

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, variant = 'default', padding = 'md', rounded = '2xl', children, ...props }, ref) => {
    const variantClasses = {
      default: 'glass-card',
      hover: 'glass-card-hover',
      gold: 'bg-accent-gold/10 backdrop-blur-lg border border-accent-gold/30',
      dark: 'bg-background-darker backdrop-blur-lg border border-white/5',
      elevated: 'glass-elevated',
      subtle: 'glass-subtle',
      interactive: 'glass-interactive',
    }

    const paddingClasses = {
      none: '',
      sm: 'p-3 sm:p-4',
      md: 'p-4 sm:p-5 lg:p-6',
      lg: 'p-5 sm:p-6 lg:p-8',
    }

    const roundedClasses = {
      md: 'rounded-md',
      lg: 'rounded-lg',
      xl: 'rounded-xl',
      '2xl': 'rounded-2xl',
      '3xl': 'rounded-3xl',
      full: 'rounded-full',
    }

    return (
      <div
        ref={ref}
        className={cn(
          variantClasses[variant],
          paddingClasses[padding],
          roundedClasses[rounded],
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)

GlassCard.displayName = 'GlassCard'

// Decorative card with vintage corner flourishes
interface VintageCardProps extends React.HTMLAttributes<HTMLDivElement> {
  showCorners?: boolean
}

export const VintageCard = forwardRef<HTMLDivElement, VintageCardProps>(
  ({ className, showCorners = true, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'relative bg-background-card backdrop-blur-lg border border-accent-gold/20 rounded-xl p-4 sm:p-5 lg:p-6',
          className
        )}
        {...props}
      >
        {showCorners && (
          <>
            {/* Top left corner */}
            <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-accent-gold/50 rounded-tl-xl" />
            {/* Top right corner */}
            <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-accent-gold/50 rounded-tr-xl" />
            {/* Bottom left corner */}
            <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-accent-gold/50 rounded-bl-xl" />
            {/* Bottom right corner */}
            <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-accent-gold/50 rounded-br-xl" />
          </>
        )}
        {children}
      </div>
    )
  }
)

VintageCard.displayName = 'VintageCard'

