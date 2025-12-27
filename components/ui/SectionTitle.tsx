'use client'

import { cn } from '@/lib/utils'

interface SectionTitleProps {
  children: React.ReactNode
  className?: string
  variant?: 'default' | 'gold' | 'simple'
  size?: 'sm' | 'md' | 'lg'
  as?: 'h1' | 'h2' | 'h3' | 'h4'
}

export function SectionTitle({
  children,
  className,
  variant = 'default',
  size = 'md',
  as: Component = 'h2',
}: SectionTitleProps) {
  const sizeClasses = {
    sm: 'text-lg sm:text-xl',
    md: 'text-xl sm:text-2xl md:text-3xl',
    lg: 'text-2xl sm:text-3xl md:text-4xl',
  }

  if (variant === 'simple') {
    return (
      <Component
        className={cn(
          'font-medium text-foreground-light',
          sizeClasses[size],
          className
        )}
      >
        {children}
      </Component>
    )
  }

  if (variant === 'gold') {
    return (
      <div className={cn('text-center', className)}>
        <Component
          className={cn(
            'font-light tracking-wide uppercase text-gradient-gold inline-block',
            sizeClasses[size]
          )}
        >
          {children}
        </Component>
        <div className="mt-3 flex items-center justify-center gap-3">
          <div className="h-px w-12 bg-gradient-to-r from-transparent to-accent-gold" />
          <div className="w-2 h-2 rounded-full bg-accent-gold" />
          <div className="h-px w-12 bg-gradient-to-l from-transparent to-accent-gold" />
        </div>
      </div>
    )
  }

  // Default variant with decorative lines
  return (
    <div className={cn('w-full', className)}>
      <Component className="section-title">
        {children}
      </Component>
    </div>
  )
}

// Subsection title for smaller headings
interface SubsectionTitleProps {
  children: React.ReactNode
  className?: string
  icon?: React.ReactNode
}

export function SubsectionTitle({ children, className, icon }: SubsectionTitleProps) {
  return (
    <h3
      className={cn(
        'flex items-center gap-2 text-lg font-medium text-foreground-light',
        className
      )}
    >
      {icon && <span className="text-accent-gold">{icon}</span>}
      {children}
    </h3>
  )
}

