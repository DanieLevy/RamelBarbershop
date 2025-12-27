'use client'

import { cn } from '@/lib/utils'

interface ScissorsLoaderProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  text?: string
}

export function ScissorsLoader({ size = 'md', className, text }: ScissorsLoaderProps) {
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-10 h-10',
    lg: 'w-16 h-16',
    xl: 'w-24 h-24',
  }

  const textSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
    xl: 'text-lg',
  }

  return (
    <div className={cn('flex flex-col items-center justify-center gap-3', className)}>
      <div className={cn('animate-spin-scissors text-accent-gold', sizeClasses[size])}>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-full h-full"
        >
          {/* Scissors icon */}
          <circle cx="6" cy="6" r="3" />
          <circle cx="6" cy="18" r="3" />
          <line x1="20" y1="4" x2="8.12" y2="15.88" />
          <line x1="14.47" y1="14.48" x2="20" y2="20" />
          <line x1="8.12" y1="8.12" x2="12" y2="12" />
        </svg>
      </div>
      {text && (
        <p className={cn('text-foreground-muted', textSizeClasses[size])}>
          {text}
        </p>
      )}
    </div>
  )
}

// Alternative scissors design with cutting animation
interface CuttingScissorsProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function CuttingScissors({ size = 'md', className }: CuttingScissorsProps) {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
  }

  return (
    <div className={cn('relative', sizeClasses[size], className)}>
      {/* Top blade */}
      <div className="absolute inset-0 origin-bottom-right animate-pulse">
        <svg viewBox="0 0 24 12" fill="currentColor" className="w-full h-1/2 text-accent-gold">
          <path d="M0 6 C0 2.7 2.7 0 6 0 L24 0 L18 6 L6 6 C2.7 6 0 6 0 6 Z" />
        </svg>
      </div>
      {/* Bottom blade */}
      <div className="absolute inset-0 origin-top-right animate-pulse" style={{ animationDelay: '150ms' }}>
        <svg viewBox="0 0 24 12" fill="currentColor" className="w-full h-1/2 mt-auto text-accent-gold transform rotate-180">
          <path d="M0 6 C0 2.7 2.7 0 6 0 L24 0 L18 6 L6 6 C2.7 6 0 6 0 6 Z" />
        </svg>
      </div>
    </div>
  )
}

