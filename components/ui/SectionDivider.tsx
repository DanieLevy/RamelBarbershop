'use client'

import { cn } from '@/lib/utils'

interface SectionDividerProps {
  /**
   * Variant:
   * - simple: Just gradient lines with a small dot
   * - title: Lines with section title text in center (recommended)
   */
  variant?: 'simple' | 'title'
  /**
   * Section title text to display (for 'title' variant)
   */
  title?: string
  /**
   * Additional CSS classes
   */
  className?: string
}

/**
 * Modern minimal section divider
 * 
 * Use 'title' variant with section name for best visual hierarchy
 */
export function SectionDivider({ 
  variant = 'simple', 
  title,
  className 
}: SectionDividerProps) {
  // If title is provided, automatically use title variant
  const effectiveVariant = title ? 'title' : variant

  return (
    <div className={cn('flex items-center justify-center gap-4 py-4', className)}>
      {/* Left gradient line */}
      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/10 to-white/20" />
      
      {/* Center element */}
      {effectiveVariant === 'title' && title ? (
        <span className="text-base sm:text-lg lg:text-xl text-accent-gold font-medium tracking-wide whitespace-nowrap">
          {title}
        </span>
      ) : (
        <div className="w-1.5 h-1.5 rounded-full bg-accent-gold/50" />
      )}
      
      {/* Right gradient line */}
      <div className="flex-1 h-px bg-gradient-to-l from-transparent via-white/10 to-white/20" />
    </div>
  )
}
