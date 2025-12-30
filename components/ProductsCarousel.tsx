'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { SectionContainer, SectionHeader, SectionContent } from './home/SectionContainer'
import { ChevronLeft, ChevronRight, ShoppingBag } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Product } from '@/types/database'

interface ProductsCarouselProps {
  products: Product[]
}

/**
 * Products Carousel with native swipe gestures and peek effect
 * 
 * Features:
 * - Native touch swipe
 * - Peek effect (shows partial next/prev cards)
 * - Scroll snap for precise card positioning
 * - Hover zoom on product images
 * - Optional auto-scroll (pauses on interaction)
 */
export function ProductsCarousel({ products }: ProductsCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  
  const productCount = products?.length || 0

  // Check scroll position
  const checkScroll = useCallback(() => {
    if (!scrollRef.current) return
    
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current
    setCanScrollLeft(scrollLeft > 10)
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10)
    
    // Calculate active index
    const cardWidth = 240 + 16 // card width + gap
    const newIndex = Math.round(scrollLeft / cardWidth)
    setActiveIndex(Math.min(newIndex, productCount - 1))
  }, [productCount])

  useEffect(() => {
    const container = scrollRef.current
    if (!container) return

    checkScroll()
    container.addEventListener('scroll', checkScroll, { passive: true })
    return () => container.removeEventListener('scroll', checkScroll)
  }, [checkScroll])
  
  // Early return after all hooks
  if (!products || products.length === 0) {
    return null
  }

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return
    const cardWidth = 240 + 16
    const scrollAmount = direction === 'left' ? -cardWidth : cardWidth
    scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' })
  }

  return (
    <SectionContainer variant="darker" animate={true}>
      <SectionContent>
        <SectionHeader 
          title="המוצרים שלנו" 
          subtitle="מוצרי טיפוח מקצועיים לשימוש ביתי"
        />
      </SectionContent>

      {/* Carousel Container */}
      <div className="relative">
        {/* Navigation arrows - desktop only */}
        <button
          onClick={() => scroll('right')}
          disabled={!canScrollRight}
          className={cn(
            'hidden sm:flex absolute left-4 top-1/2 -translate-y-1/2 z-10',
            'w-12 h-12 rounded-full bg-background-dark/90 border border-white/10',
            'items-center justify-center text-foreground-light',
            'hover:text-accent-gold hover:border-accent-gold/50 transition-all shadow-lg backdrop-blur-sm',
            'disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-foreground-light disabled:hover:border-white/10'
          )}
          aria-label="הבא"
        >
          <ChevronLeft size={24} strokeWidth={2} />
        </button>
        <button
          onClick={() => scroll('left')}
          disabled={!canScrollLeft}
          className={cn(
            'hidden sm:flex absolute right-4 top-1/2 -translate-y-1/2 z-10',
            'w-12 h-12 rounded-full bg-background-dark/90 border border-white/10',
            'items-center justify-center text-foreground-light',
            'hover:text-accent-gold hover:border-accent-gold/50 transition-all shadow-lg backdrop-blur-sm',
            'disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-foreground-light disabled:hover:border-white/10'
          )}
          aria-label="הקודם"
        >
          <ChevronRight size={24} strokeWidth={2} />
        </button>

        {/* Gradient masks */}
        <div className="absolute right-0 top-0 bottom-0 w-8 sm:w-16 bg-gradient-to-l from-background-darker to-transparent z-[1] pointer-events-none" />
        <div className="absolute left-0 top-0 bottom-0 w-8 sm:w-16 bg-gradient-to-r from-background-darker to-transparent z-[1] pointer-events-none" />

        {/* Products scroll container */}
        <div 
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto scrollbar-hide snap-x snap-mandatory px-4 sm:px-8 py-4"
          style={{ scrollPaddingInline: '16px' }}
        >
          {products.map((product, index) => (
            <ProductCard 
              key={product.id} 
              product={product}
              index={index}
              isActive={index === activeIndex}
            />
          ))}
        </div>

        {/* Scroll indicator dots - mobile only */}
        <div className="flex sm:hidden justify-center gap-1.5 mt-4 px-4">
          {products.map((_, index) => (
            <button
              key={index}
              onClick={() => {
                if (!scrollRef.current) return
                const cardWidth = 240 + 16
                scrollRef.current.scrollTo({ left: cardWidth * index, behavior: 'smooth' })
              }}
              className={cn(
                'w-2 h-2 rounded-full transition-all duration-300',
                index === activeIndex 
                  ? 'bg-accent-gold w-6' 
                  : 'bg-white/20 hover:bg-white/40'
              )}
              aria-label={`מוצר ${index + 1}`}
            />
          ))}
        </div>
      </div>

      {/* View All CTA */}
      <SectionContent className="mt-8 text-center">
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
  isActive: boolean
}

/**
 * Enhanced Product Card with hover effects
 */
function ProductCard({ product, index, isActive }: ProductCardProps) {
  return (
    <div 
      className={cn(
        'flex-shrink-0 w-[220px] sm:w-[240px] snap-center',
        'transition-all duration-300',
        isActive ? 'scale-100' : 'sm:scale-100'
      )}
      style={{ 
        animationDelay: `${index * 50}ms`,
      }}
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
            sizes="240px"
          />
          
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-background-dark/80 via-transparent to-transparent" />
          
          {/* Price tag */}
          <div className="absolute top-3 left-3 px-3 py-1.5 rounded-full bg-accent-gold text-background-dark text-sm font-medium shadow-gold">
            ₪{product.price}
          </div>
        </div>

        {/* Product Info */}
        <div className="p-4">
          <h3 className="text-foreground-light font-medium text-sm sm:text-base line-clamp-1 group-hover:text-accent-gold transition-colors">
            {product.name}
          </h3>
          {product.description && (
            <p className="mt-1 text-foreground-muted text-xs sm:text-sm line-clamp-2">
              {product.description}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export default ProductsCarousel
