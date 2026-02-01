'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import type { BarberGalleryImage } from '@/types/database'

interface GallerySlideshowProps {
  /** Gallery images to display */
  images: BarberGalleryImage[]
  /** Fallback image URL (profile picture) */
  fallbackImage?: string | null
  /** Fallback image position X (0-100%) */
  fallbackPositionX?: number
  /** Fallback image position Y (0-100%) */
  fallbackPositionY?: number
  /** Barber name for alt text */
  barberName: string
  /** Transition interval in ms (default: 4000) */
  interval?: number
  /** CSS class for the container */
  className?: string
}

/**
 * Auto-scrolling gallery slideshow for barber profile
 * Shows gallery images with smooth fade transitions
 * Falls back to profile picture if no gallery images
 */
export function GallerySlideshow({
  images,
  fallbackImage,
  fallbackPositionX = 50,
  fallbackPositionY = 30,
  barberName,
  interval = 4000,
  className,
}: GallerySlideshowProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const sortedImages = [...images].sort((a, b) => a.display_order - b.display_order)
  
  // If no gallery images, show fallback
  const hasGallery = sortedImages.length > 0
  const displayImages = hasGallery 
    ? sortedImages 
    : fallbackImage 
      ? [{ id: 'fallback', image_url: fallbackImage, position_x: fallbackPositionX, position_y: fallbackPositionY }] 
      : []
  
  const nextSlide = useCallback(() => {
    if (displayImages.length <= 1) return
    
    setIsTransitioning(true)
    
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % displayImages.length)
      setIsTransitioning(false)
    }, 500) // Half of the transition duration
  }, [displayImages.length])
  
  // Auto-advance slideshow
  useEffect(() => {
    if (displayImages.length <= 1) return
    
    timeoutRef.current = setInterval(nextSlide, interval)
    
    return () => {
      if (timeoutRef.current) {
        clearInterval(timeoutRef.current)
      }
    }
  }, [displayImages.length, interval, nextSlide])
  
  // Pause on hover (optional UX enhancement)
  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearInterval(timeoutRef.current)
    }
  }
  
  const handleMouseLeave = () => {
    if (displayImages.length > 1) {
      timeoutRef.current = setInterval(nextSlide, interval)
    }
  }
  
  if (displayImages.length === 0) {
    // No images at all - show placeholder
    return (
      <div className={cn('relative w-full h-full bg-background-dark', className)}>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-24 h-24 rounded-full bg-background-card flex items-center justify-center">
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="text-foreground-muted"
            >
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
        </div>
      </div>
    )
  }
  
  return (
    <div 
      className={cn('relative w-full h-full overflow-hidden', className)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Images Stack */}
      {displayImages.map((image, index) => (
        <div
          key={image.id}
          className={cn(
            'absolute inset-0 transition-all duration-1000 ease-in-out',
            index === currentIndex
              ? 'opacity-100 scale-100'
              : 'opacity-0 scale-105',
            isTransitioning && index === currentIndex && 'opacity-50'
          )}
        >
          <Image
            src={image.image_url}
            alt={hasGallery ? `${barberName} - עבודה ${index + 1}` : barberName}
            fill
            className="object-cover"
            style={{ 
              objectPosition: `${(image as { position_x?: number | null }).position_x ?? 50}% ${(image as { position_y?: number | null }).position_y ?? 50}%`
            }}
            sizes="(max-width: 640px) 100vw, 400px"
            priority={index === 0}
          />
        </div>
      ))}
      
      {/* Gradient Overlays */}
      <div className="absolute inset-0 bg-gradient-to-t from-background-dark via-background-dark/30 to-transparent pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-background-dark/20 via-transparent to-transparent pointer-events-none" />
      
      {/* Slide Indicators */}
      {displayImages.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
          {displayImages.map((_, index) => (
            <div
              key={index}
              className={cn(
                'w-1.5 h-1.5 rounded-full transition-all duration-300',
                index === currentIndex
                  ? 'bg-accent-gold w-4'
                  : 'bg-white/40'
              )}
            />
          ))}
        </div>
      )}
      
    </div>
  )
}
