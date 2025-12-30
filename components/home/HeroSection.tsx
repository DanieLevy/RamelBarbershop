'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { ChevronDown } from 'lucide-react'

interface HeroSectionProps {
  title?: string
  subtitle?: string
  description?: string
  ctaText?: string
  ctaHref?: string
}

/**
 * Hero Section - Full viewport with animated reveal and modern glass design
 * 
 * Features:
 * - Staggered reveal animation on mount
 * - Animated gradient mesh background
 * - Floating barbershop icons with parallax
 * - Breathing glow effect on logo
 * - Smooth scroll indicator
 * - Full notch integration for PWA
 */
export const HeroSection = ({
  title = 'רמאל ברברשופ',
  subtitle = 'חווית טיפוח ייחודית לגבר המודרני',
  description = 'מספרה מקצועית בירושלים עם צוות מנוסה ואווירה נעימה. אנו מציעים שירותי תספורת, עיצוב זקן וטיפוח מקצועי.',
  ctaText = 'קבע תור עכשיו',
  ctaHref = '#team',
}: HeroSectionProps) => {
  const [isLoaded, setIsLoaded] = useState(false)
  const [mousePosition, setMousePosition] = useState({ x: 0.5, y: 0.5 })

  useEffect(() => {
    // Trigger animations after mount
    const timer = setTimeout(() => setIsLoaded(true), 100)
    return () => clearTimeout(timer)
  }, [])

  const handleMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height
    setMousePosition({ x, y })
  }

  const handleScrollToTeam = () => {
    const teamSection = document.getElementById('team')
    if (teamSection) {
      teamSection.scrollIntoView({ behavior: 'smooth' })
    }
  }

  // Parse title to highlight second word in gold
  const titleParts = title.split(' ')
  const firstWord = titleParts[0]
  const restWords = titleParts.slice(1).join(' ')

  return (
    <section
      className="section-hero relative overflow-hidden bg-background-dark"
      onMouseMove={handleMouseMove}
    >
      {/* Animated gradient background */}
      <div className="absolute inset-0">
        {/* Base dark gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-background-dark via-background-dark/95 to-background-dark" />
        
        {/* Animated gold radial gradient - follows mouse slightly */}
        <div 
          className="absolute inset-0 opacity-40 transition-transform duration-1000 ease-out"
          style={{
            background: `radial-gradient(ellipse 80% 50% at ${50 + (mousePosition.x - 0.5) * 10}% ${40 + (mousePosition.y - 0.5) * 10}%, rgba(255, 170, 61, 0.08) 0%, transparent 50%)`,
          }}
        />
        
        {/* Subtle pattern overlay */}
        <div 
          className="absolute inset-0 opacity-[0.02]"
          style={{ backgroundImage: 'var(--pattern-dots)', backgroundSize: '20px 20px' }}
        />
        
        {/* Top fade for notch blending */}
        <div 
          className="absolute top-0 left-0 right-0 pointer-events-none z-[1]"
          style={{
            height: 'calc(env(safe-area-inset-top, 0px) + 120px)',
            background: 'linear-gradient(to bottom, #080b0d 0%, #080b0d 40%, transparent 100%)',
          }}
        />
      </div>

      {/* Floating decorative elements */}
      <FloatingIcons isLoaded={isLoaded} />

      {/* Main content container */}
      <div className="relative z-10 flex flex-1 items-center justify-center px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-4xl mx-auto">
          {/* Logo with subtle glow */}
          <div 
            className={cn(
              'mb-6 sm:mb-8 transition-all duration-1000 ease-reveal',
              isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            )}
          >
            <div className="relative inline-block">
              {/* Subtle glow backdrop - reduced opacity and size */}
              <div className="absolute inset-0 rounded-full bg-accent-gold/10 blur-2xl scale-125" />
              
              {/* Logo container - slightly larger */}
              <div className="relative w-32 h-32 sm:w-40 sm:h-40 lg:w-48 lg:h-48 mx-auto rounded-full overflow-hidden border-2 border-accent-gold/30 shadow-lg">
                <Image
                  src="/icon.png"
                  alt="Ramel Barbershop Logo"
                  width={192}
                  height={192}
                  className="w-full h-full object-cover"
                  priority
                />
              </div>
            </div>
          </div>

          {/* Title */}
          <h1 
            className={cn(
              'text-hero font-bold text-foreground-light mb-4 transition-all duration-1000 ease-reveal',
              isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            )}
            style={{ transitionDelay: '150ms' }}
          >
            {firstWord}{' '}
            <span className="text-gradient-gold-animated">{restWords}</span>
          </h1>

          {/* Subtitle */}
          <p 
            className={cn(
              'text-hero-sub text-foreground-muted mb-4 sm:mb-6 transition-all duration-1000 ease-reveal',
              isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            )}
            style={{ transitionDelay: '300ms' }}
          >
            {subtitle}
          </p>

          {/* Decorative divider - elegant scissors icon */}
          <div 
            className={cn(
              'flex items-center justify-center gap-3 mb-6 sm:mb-8 transition-all duration-1000 ease-reveal',
              isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            )}
            style={{ transitionDelay: '400ms' }}
          >
            <div className="h-px w-16 sm:w-24 bg-gradient-to-r from-transparent via-white/20 to-white/40" />
            <div className="flex items-center gap-1">
              <div className="w-1 h-1 rounded-full bg-white/40" />
              <div className="w-1.5 h-1.5 rounded-full bg-accent-gold/60" />
              <div className="w-1 h-1 rounded-full bg-white/40" />
            </div>
            <div className="h-px w-16 sm:w-24 bg-gradient-to-l from-transparent via-white/20 to-white/40" />
          </div>

          {/* Description */}
          <p 
            className={cn(
              'text-foreground-muted text-sm sm:text-base leading-relaxed max-w-2xl mx-auto mb-8 sm:mb-10 transition-all duration-1000 ease-reveal',
              isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            )}
            style={{ transitionDelay: '500ms' }}
          >
            {description}
          </p>

          {/* CTA Button */}
          <div 
            className={cn(
              'transition-all duration-1000 ease-reveal',
              isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            )}
            style={{ transitionDelay: '600ms' }}
          >
            <a
              href={ctaHref}
              className="inline-flex items-center gap-3 px-8 py-4 bg-accent-gold text-background-dark font-medium rounded-2xl hover:bg-accent-gold-light transition-all duration-300 hover:scale-105 active:scale-95 shadow-gold btn-press group"
            >
              <ScissorsIcon className="w-5 h-5 transition-transform duration-300 group-hover:rotate-[-20deg]" />
              <span>{ctaText}</span>
            </a>
          </div>
        </div>
      </div>

      {/* Scroll indicator - moved up, inside content area */}
      <div 
        className={cn(
          'relative z-10 mt-8 sm:mt-12 pb-16 transition-all duration-1000 ease-reveal cursor-pointer flex justify-center',
          isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        )}
        style={{ transitionDelay: '800ms' }}
        onClick={handleScrollToTeam}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && handleScrollToTeam()}
        aria-label="גלול למטה"
      >
        <div className="flex flex-col items-center gap-1.5 text-foreground-muted hover:text-accent-gold transition-colors">
          <span className="text-xs">גלול למטה</span>
          <ChevronDown 
            size={20} 
            strokeWidth={1.5} 
            className="animate-scroll-hint text-accent-gold" 
          />
        </div>
      </div>

      {/* Bottom gradient transition to next section */}
      <div 
        className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none"
        style={{
          background: 'linear-gradient(to top, #080b0d, transparent)',
        }}
      />
    </section>
  )
}

/**
 * Floating barbershop icons for parallax effect
 */
const FloatingIcons = ({ isLoaded }: { isLoaded: boolean }) => {
  return (
    <>
      {/* Scissors - top left */}
      <div 
        className={cn(
          'absolute top-[20%] left-[5%] sm:left-[10%] opacity-0 transition-all duration-1000',
          isLoaded && 'opacity-10'
        )}
        style={{ transitionDelay: '700ms' }}
      >
        <ScissorsIcon className="w-10 h-10 sm:w-14 sm:h-14 text-accent-gold animate-float-slow" />
      </div>

      {/* Razor - top right */}
      <div 
        className={cn(
          'absolute top-[15%] right-[5%] sm:right-[10%] opacity-0 transition-all duration-1000',
          isLoaded && 'opacity-10'
        )}
        style={{ transitionDelay: '800ms' }}
      >
        <RazorIcon className="w-8 h-8 sm:w-12 sm:h-12 text-accent-gold animate-float-delayed" />
      </div>

      {/* Comb - bottom left */}
      <div 
        className={cn(
          'absolute bottom-[25%] left-[8%] opacity-0 transition-all duration-1000',
          isLoaded && 'opacity-10'
        )}
        style={{ transitionDelay: '900ms' }}
      >
        <CombIcon className="w-8 h-8 sm:w-10 sm:h-10 text-accent-gold animate-float" />
      </div>

      {/* Bottle - bottom right */}
      <div 
        className={cn(
          'absolute bottom-[30%] right-[8%] sm:right-[12%] opacity-0 transition-all duration-1000',
          isLoaded && 'opacity-10'
        )}
        style={{ transitionDelay: '1000ms' }}
      >
        <BottleIcon className="w-10 h-10 sm:w-12 sm:h-12 text-accent-gold animate-float-slow" />
      </div>
    </>
  )
}

// SVG Icons as components
const ScissorsIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
    <circle cx="6" cy="6" r="3" />
    <circle cx="6" cy="18" r="3" />
    <line x1="20" y1="4" x2="8.12" y2="15.88" />
    <line x1="14.47" y1="14.48" x2="20" y2="20" />
    <line x1="8.12" y1="8.12" x2="12" y2="12" />
  </svg>
)

const RazorIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M20.5 2.5L21.5 3.5L18 7L14 3L17.5 1.5L20.5 2.5ZM12.5 5.5L16.5 9.5L6 20L2 22L4 18L14.5 7.5L12.5 5.5Z" />
  </svg>
)

const CombIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M4 2H20V4H19V8H17V4H15V8H13V4H11V8H9V4H7V8H5V4H4V2ZM4 10H20V12H4V10ZM4 14H20V22H4V14ZM6 16V20H18V16H6Z" />
  </svg>
)

const BottleIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M7 5C7 3.89543 7.89543 3 9 3H15C16.1046 3 17 3.89543 17 5V7H18C19.1046 7 20 7.89543 20 9V10C20 11.1046 19.1046 12 18 12H17V19C17 20.1046 16.1046 21 15 21H9C7.89543 21 7 20.1046 7 19V12H6C4.89543 12 4 11.1046 4 10V9C4 7.89543 4.89543 7 6 7H7V5Z" />
  </svg>
)

export default HeroSection

