'use client'

import { useRef, useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { SectionContainer, SectionHeader, SectionContent } from './home/SectionContainer'
import { ChevronLeft, ShoppingBag } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Product } from '@/types/database'

interface ProductsCarouselProps {
  products: Product[]
}

/**
 * Products Carousel with RTL-aware auto-scroll and swipe gestures
 * 
 * Features:
 * - RTL-aware auto-scroll animation (pauses on hover/touch)
 * - Native touch swipe
 * - Infinite loop effect
 * - Hover zoom on product images
 */
export function ProductsCarousel({ products }: ProductsCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [isPaused, setIsPaused] = useState(false)
  const scrollPositionRef = useRef(0)
  
  const productCount = products?.length || 0

  // RTL-aware auto-scroll effect
  useEffect(() => {
    const container = scrollRef.current
    if (!container || isPaused || productCount < 3) return

    const scrollSpeed = 0.7 // pixels per frame - faster than barbers
    let animationId: number
    const isRTL = document.documentElement.dir === 'rtl' || document.documentElement.lang === 'he'
    
    const autoScroll = () => {
      if (!container) return
      
      // Increment our tracked position
      scrollPositionRef.current += scrollSpeed
      
      // Reset when we've scrolled the width of original items (half of duplicated)
      const cardWidth = 216 + 16 // card width + gap
      const resetPoint = productCount * cardWidth
      
      if (scrollPositionRef.current >= resetPoint) {
        scrollPositionRef.current = 0
        container.scrollLeft = isRTL ? 0 : 0
      } else {
        // In RTL, scroll in the negative direction
        if (isRTL) {
          container.scrollLeft = -scrollPositionRef.current
        } else {
          container.scrollLeft = scrollPositionRef.current
        }
      }
      
      animationId = requestAnimationFrame(autoScroll)
    }

    // Initialize scroll position
    scrollPositionRef.current = isRTL ? 0 : container.scrollLeft

    animationId = requestAnimationFrame(autoScroll)
    
    return () => cancelAnimationFrame(animationId)
  }, [isPaused, productCount])
  
  // Early return after all hooks
  if (!products || products.length === 0) {
    return null
  }

  const handleInteractionStart = () => setIsPaused(true)
  const handleInteractionEnd = () => {
    // Sync our ref with actual scroll position when user finishes interacting
    if (scrollRef.current) {
      const isRTL = document.documentElement.dir === 'rtl' || document.documentElement.lang === 'he'
      scrollPositionRef.current = isRTL ? -scrollRef.current.scrollLeft : scrollRef.current.scrollLeft
    }
    setIsPaused(false)
  }

  // Duplicate products for seamless loop effect
  const displayProducts = productCount > 2 ? [...products, ...products] : products

  return (
    <SectionContainer variant="darker" animate={true}>
      <SectionContent>
        <SectionHeader 
          title="המוצרים שלנו" 
          subtitle="מוצרי טיפוח איכותיים"
        />
      </SectionContent>

      {/* Carousel Container */}
      <div 
        className="relative"
        onMouseEnter={handleInteractionStart}
        onMouseLeave={handleInteractionEnd}
        onTouchStart={handleInteractionStart}
        onTouchEnd={handleInteractionEnd}
      >
        {/* Gradient masks for edge fade effect */}
        <div className="absolute right-0 top-0 bottom-0 w-12 sm:w-20 bg-gradient-to-l from-background-darker to-transparent z-[1] pointer-events-none" />
        <div className="absolute left-0 top-0 bottom-0 w-12 sm:w-20 bg-gradient-to-r from-background-darker to-transparent z-[1] pointer-events-none" />

        {/* Products scroll container - smooth touch scrolling */}
        <div 
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto scrollbar-hide px-4 sm:px-8 py-4 snap-x snap-mandatory"
          style={{ 
            scrollPaddingInline: '16px',
            WebkitOverflowScrolling: 'touch',
            scrollBehavior: 'auto',
          }}
        >
          {displayProducts.map((product, index) => (
            <ProductCard 
              key={`${product.id}-${index}`} 
              product={product}
              index={index}
            />
          ))}
        </div>
      </div>

      {/* View All CTA */}
      <SectionContent className="mt-6 text-center">
        <Link
          href="/products"
          className="inline-flex items-center gap-3 px-6 py-3 rounded-xl border border-accent-gold/30 text-accent-gold hover:bg-accent-gold/10 hover:border-accent-gold/50 transition-all group"
        >
          <ShoppingBag size={18} strokeWidth={1.5} />
          <span>לקטלוג המלא</span>
          <ChevronLeft size={16} strokeWidth={2} className="group-hover:-translate-x-1 transition-transform" />
        </Link>
      </SectionContent>
    </SectionContainer>
  )
}

interface ProductCardProps {
  product: Product
  index: number
}

/**
 * Enhanced Product Card with hover effects
 */
function ProductCard({ product, index }: ProductCardProps) {
  return (
    <div 
      className="flex-shrink-0 w-[200px] sm:w-[216px] snap-center"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className={cn(
        'relative overflow-hidden rounded-2xl',
        'bg-gradient-to-b from-white/[0.06] to-white/[0.02]',
        'border border-white/10 transition-all duration-300',
        'hover:border-accent-gold/30 hover:shadow-gold group'
      )}>
        {/* Product Image */}
        <div className="relative aspect-square overflow-hidden">
          <Image
            src={product.image_url || '/icon.png'}
            alt={product.name}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-110"
            sizes="220px"
          />
          
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-background-dark/80 via-transparent to-transparent" />
          
          {/* Price tag */}
          <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-accent-gold text-background-dark text-sm font-medium">
            ₪{product.price}
          </div>
        </div>

        {/* Product Info */}
        <div className="p-3">
          <h3 className="text-foreground-light font-medium text-sm line-clamp-1 group-hover:text-accent-gold transition-colors">
            {product.name}
          </h3>
          {product.description && (
            <p className="mt-1 text-foreground-muted text-xs line-clamp-2">
              {product.description}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export default ProductsCarousel
