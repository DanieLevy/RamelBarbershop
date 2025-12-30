'use client'

import { useRef } from 'react'
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
 * Products Carousel with smooth native swipe gestures
 * 
 * Features:
 * - Smooth native touch swipe
 * - Snap scrolling for precise card positioning
 * - Hover zoom on product images
 * - No auto-scroll (cleaner UX)
 */
export function ProductsCarousel({ products }: ProductsCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  
  // Early return if no products
  if (!products || products.length === 0) {
    return null
  }

  return (
    <SectionContainer variant="darker" animate={true}>
      <SectionContent>
        <SectionHeader 
          title="המוצרים שלנו" 
          subtitle="מוצרי טיפוח איכותיים"
        />
      </SectionContent>

      {/* Carousel Container */}
      <div className="relative">
        {/* Gradient masks for edge fade effect */}
        <div className="absolute right-0 top-0 bottom-0 w-8 sm:w-16 bg-gradient-to-l from-background-darker to-transparent z-[1] pointer-events-none" />
        <div className="absolute left-0 top-0 bottom-0 w-8 sm:w-16 bg-gradient-to-r from-background-darker to-transparent z-[1] pointer-events-none" />

        {/* Products scroll container - smooth native touch scrolling */}
        <div 
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto scrollbar-hide px-4 sm:px-8 py-4 snap-x snap-mandatory overscroll-x-contain"
          style={{ 
            scrollPaddingInline: '16px',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {products.map((product, index) => (
            <ProductCard 
              key={product.id} 
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
      className="flex-shrink-0 w-[180px] sm:w-[200px] snap-center"
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
            sizes="200px"
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
