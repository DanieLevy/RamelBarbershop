'use client'

import { cn } from '@/lib/utils'
import { useEffect, useRef, useState } from 'react'

interface SectionContainerProps {
  children: React.ReactNode
  className?: string
  variant?: 'dark' | 'darker' | 'accent' | 'hero'
  id?: string
  withTransition?: 'top' | 'bottom' | 'both' | 'none'
  animate?: boolean
}

/**
 * Unified section container for consistent padding, spacing, and animations
 * 
 * Features:
 * - Consistent section padding across all breakpoints
 * - Variant styles (dark, darker, accent, hero)
 * - Optional gradient transitions between sections
 * - Intersection Observer for reveal animations
 */
export const SectionContainer = ({
  children,
  className,
  variant = 'dark',
  id,
  withTransition = 'none',
  animate = true,
}: SectionContainerProps) => {
  const sectionRef = useRef<HTMLElement>(null)
  const [isVisible, setIsVisible] = useState(!animate)

  useEffect(() => {
    if (!animate) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px',
      }
    )

    if (sectionRef.current) {
      observer.observe(sectionRef.current)
    }

    return () => observer.disconnect()
  }, [animate])

  const variantClasses = {
    dark: 'section-dark',
    darker: 'section-darker',
    accent: 'section-accent',
    hero: 'section-hero',
  }

  return (
    <section
      ref={sectionRef}
      id={id}
      className={cn(
        variantClasses[variant],
        animate && 'transition-opacity duration-700',
        animate && (isVisible ? 'opacity-100' : 'opacity-0'),
        className
      )}
    >
      {(withTransition === 'top' || withTransition === 'both') && (
        <div className="section-transition-top" />
      )}
      
      {children}
      
      {(withTransition === 'bottom' || withTransition === 'both') && (
        <div className="section-transition-bottom" />
      )}
    </section>
  )
}

interface SectionHeaderProps {
  title: string
  subtitle?: string
  className?: string
  align?: 'center' | 'start'
  onTitleClick?: () => void
}

/**
 * Section header with full-width divider and optional subtitle
 */
export const SectionHeader = ({
  title,
  subtitle,
  className,
  align = 'center',
  onTitleClick,
}: SectionHeaderProps) => {
  return (
    <div className={cn(
      'mb-8 sm:mb-10 lg:mb-12',
      align === 'center' && 'text-center',
      className
    )}>
      {/* Full-width divider line - lighter color */}
      <div className="w-full h-px bg-gradient-to-r from-transparent via-white/15 to-transparent mb-6 sm:mb-8" />
      
      <h2 
        className={cn(
          "text-2xl sm:text-3xl lg:text-4xl font-light text-foreground-light",
          onTitleClick && "cursor-pointer select-none"
        )}
        onClick={onTitleClick}
      >
        {title}
      </h2>
      
      {subtitle && (
        <p className="mt-3 text-foreground-muted text-sm sm:text-base max-w-2xl mx-auto">
          {subtitle}
        </p>
      )}
    </div>
  )
}

interface SectionContentProps {
  children: React.ReactNode
  className?: string
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl' | '7xl' | 'full'
}

/**
 * Content container with responsive padding and max-width
 */
export const SectionContent = ({
  children,
  className,
  maxWidth = '7xl',
}: SectionContentProps) => {
  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
    '5xl': 'max-w-5xl',
    '6xl': 'max-w-6xl',
    '7xl': 'max-w-7xl',
    full: 'max-w-full',
  }

  return (
    <div className={cn(
      'px-4 sm:px-6 lg:px-8 mx-auto w-full',
      maxWidthClasses[maxWidth],
      className
    )}>
      {children}
    </div>
  )
}

export default SectionContainer

