'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { ProductCard } from './ProductCard'
import { SectionDivider } from './ui/SectionDivider'
import { ChevronLeft } from 'lucide-react'
import type { Product } from '@/types/database'

interface ProductsCarouselProps {
  products: Product[]
}

/**
 * Auto-scrolling products carousel for home page
 * 
 * Features:
 * - Infinite loop animation using CSS
 * - Pauses on hover/touch
 * - Duplicates items for seamless scrolling
 */
export function ProductsCarousel({ products }: ProductsCarouselProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isPaused, setIsPaused] = useState(false)
  
  // Don't render if no products
  if (!products || products.length === 0) {
    return null
  }

  // Duplicate products for seamless infinite scroll
  const duplicatedProducts = [...products, ...products]

  return (
    <section className="py-10 sm:py-12 lg:py-16 bg-background-darker overflow-hidden">
      <div className="container-mobile mb-6">
        <SectionDivider title="המוצרים שלנו" />
      </div>
      
      {/* Carousel Container */}
      <div 
        ref={containerRef}
        className="relative"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
      >
        {/* Gradient masks for fade effect */}
        <div className="absolute left-0 top-0 bottom-0 w-8 sm:w-16 bg-gradient-to-r from-background-dark to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-8 sm:w-16 bg-gradient-to-l from-background-dark to-transparent z-10 pointer-events-none" />
        
        {/* Scrolling track */}
        <div 
          className="flex gap-4 sm:gap-6"
          style={{
            animation: `scroll-rtl ${products.length * 5}s linear infinite`,
            animationPlayState: isPaused ? 'paused' : 'running',
          }}
        >
          {duplicatedProducts.map((product, index) => (
            <div key={`${product.id}-${index}`} className="flex-shrink-0">
              <ProductCard product={product} size="sm" />
            </div>
          ))}
        </div>
      </div>
      
      {/* View All Button */}
      <div className="container-mobile mt-8 text-center">
        <Link
          href="/products"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-accent-gold/30 text-accent-gold hover:bg-accent-gold/10 transition-all"
        >
          לקטלוג המלא
          <ChevronLeft size={16} strokeWidth={2} />
        </Link>
      </div>
      
      {/* CSS Animation */}
      <style jsx>{`
        @keyframes scroll-rtl {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(50%);
          }
        }
      `}</style>
    </section>
  )
}

