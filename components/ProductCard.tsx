'use client'

import Image from 'next/image'
import Link from 'next/link'
import { cn, formatPrice } from '@/lib/utils'
import type { Product } from '@/types/database'

interface ProductCardProps {
  product: Product
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

// Check if product was created within the last 7 days
function isNewProduct(createdAt: string): boolean {
  const created = new Date(createdAt)
  const now = new Date()
  const diffTime = Math.abs(now.getTime() - created.getTime())
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return diffDays <= 7
}

/**
 * Product card for displaying barbershop products
 * 
 * Sizes:
 * - sm: For carousel display (compact)
 * - md: Default size
 * - lg: For catalog page (larger image)
 */
export function ProductCard({ product, size = 'md', className }: ProductCardProps) {
  const sizeClasses = {
    sm: 'w-40 sm:w-48',
    md: 'w-full max-w-[280px]',
    lg: 'w-full',
  }

  const imageSizes = {
    sm: 'h-32 sm:h-40',
    md: 'h-40 sm:h-48',
    lg: 'h-48 sm:h-56',
  }

  const isNew = product.created_at ? isNewProduct(product.created_at) : false

  return (
    <Link
      href={`/products/${product.id}`}
      className={cn(
        'group block rounded-2xl overflow-hidden bg-white/[0.03] border border-white/10',
        'hover:border-accent-gold/30 hover:bg-white/[0.05] transition-all duration-300',
        sizeClasses[size],
        className
      )}
    >
      {/* Product Image */}
      <div className={cn('relative overflow-hidden', imageSizes[size])}>
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.name_he}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            sizes={size === 'lg' ? '(max-width: 640px) 100vw, 33vw' : '200px'}
          />
        ) : (
          <div className="w-full h-full bg-background-card flex items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="w-6 h-6 text-foreground-muted"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
            </div>
          </div>
        )}
        
        {/* New Badge */}
        {isNew && (
          <div className={cn(
            'absolute top-2 right-2 px-2 py-0.5 rounded-full bg-green-500 text-white font-bold shadow-lg',
            size === 'sm' ? 'text-[10px]' : 'text-xs',
            // Subtle pulse animation
            'animate-pulse'
          )}>
            חדש!
          </div>
        )}
        
        {/* Price badge */}
        <div className={cn(
          'absolute bottom-2 right-2 px-3 py-1 rounded-full bg-accent-gold text-background-dark font-bold shadow-lg',
          size === 'sm' ? 'text-xs' : 'text-sm'
        )}>
          {formatPrice(product.price)}
        </div>
      </div>

      {/* Product Info */}
      <div className={cn('p-3', size === 'lg' && 'p-4')}>
        <h3 className={cn(
          'font-medium text-foreground-light truncate group-hover:text-accent-gold transition-colors',
          size === 'sm' ? 'text-sm' : 'text-base'
        )}>
          {product.name_he}
        </h3>
        
        {size !== 'sm' && product.description && (
          <p className="text-foreground-muted text-xs mt-1 line-clamp-2">
            {product.description}
          </p>
        )}
      </div>
    </Link>
  )
}
