'use client'

import { cn } from '@/lib/utils'
import { forwardRef } from 'react'

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'gold' | 'dark' | 'elevated' | 'subtle'
  padding?: 'none' | 'sm' | 'md' | 'lg'
  rounded?: 'md' | 'lg' | 'xl' | '2xl' | '3xl' | 'full'
}

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, variant = 'default', padding = 'md', rounded = '2xl', children, ...props }, ref) => {
    const variantClasses = {
      default: 'glass-card',
      gold: 'bg-accent-gold/10 backdrop-blur-lg border border-accent-gold/30',
      dark: 'bg-background-darker backdrop-blur-lg border border-white/5',
      elevated: 'glass-elevated',
      subtle: 'glass-subtle',
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

