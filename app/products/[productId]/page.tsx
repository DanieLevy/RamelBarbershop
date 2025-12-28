import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { AppHeader } from '@/components/AppHeader'
import { ChevronRight, Tag, Package } from 'lucide-react'
import { formatPrice } from '@/lib/utils'
import type { Product } from '@/types/database'

interface ProductPageProps {
  params: Promise<{ productId: string }>
}

// Check if product was created within the last 7 days
function isNewProduct(createdAt: string): boolean {
  const created = new Date(createdAt)
  const now = new Date()
  const diffTime = Math.abs(now.getTime() - created.getTime())
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return diffDays <= 7
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { productId } = await params
  const supabase = await createClient()
  
  // Fetch the product
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: product, error } = await (supabase as any)
    .from('products')
    .select('*')
    .eq('id', productId)
    .eq('is_active', true)
    .single() as { data: Product | null; error: unknown }
  
  if (error || !product) {
    notFound()
  }

  const isNew = isNewProduct(product.created_at)

  return (
    <>
      <AppHeader />
      
      <main 
        className="min-h-screen bg-background-dark"
        style={{
          paddingTop: 'calc(var(--header-top-offset, 0px) + 5rem)',
        }}
      >
        <div className="container-mobile py-8 sm:py-12">
          {/* Back Link */}
          <Link
            href="/products"
            className="inline-flex items-center gap-2 text-foreground-muted hover:text-accent-gold transition-colors mb-8"
          >
            <ChevronRight size={16} strokeWidth={2} />
            <span>חזרה לקטלוג</span>
          </Link>
          
          {/* Product Content */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
            {/* Product Image */}
            <div className="relative">
              <div className="relative aspect-square rounded-3xl overflow-hidden bg-background-card border border-white/10">
                {product.image_url ? (
                  <Image
                    src={product.image_url}
                    alt={product.name_he}
                    fill
                    className="object-cover"
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    priority
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package size={64} strokeWidth={1} className="text-foreground-muted/30" />
                  </div>
                )}
                
                {/* New Badge */}
                {isNew && (
                  <div className="absolute top-4 right-4 px-3 py-1.5 rounded-full bg-green-500 text-white text-sm font-bold shadow-lg animate-pulse">
                    חדש!
                  </div>
                )}
              </div>
            </div>
            
            {/* Product Info */}
            <div className="flex flex-col">
              {/* Name */}
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground-light mb-4">
                {product.name_he}
              </h1>
              
              {/* Price */}
              <div className="flex items-center gap-3 mb-6">
                <Tag size={20} strokeWidth={1.5} className="text-accent-gold" />
                <span className="text-3xl sm:text-4xl font-bold text-accent-gold">
                  {formatPrice(product.price)}
                </span>
              </div>
              
              {/* Description */}
              {product.description && (
                <div className="mb-8">
                  <h2 className="text-lg font-medium text-foreground-light mb-3">תיאור המוצר</h2>
                  <p className="text-foreground-muted leading-relaxed">
                    {product.description}
                  </p>
                </div>
              )}
              
              {/* Purchase Info */}
              <div className="mt-auto p-4 rounded-2xl bg-accent-gold/10 border border-accent-gold/20">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-accent-gold/20 flex items-center justify-center flex-shrink-0">
                    <Package size={20} strokeWidth={1.5} className="text-accent-gold" />
                  </div>
                  <div>
                    <h3 className="text-accent-gold font-medium mb-1">זמין במספרה</h3>
                    <p className="text-foreground-muted text-sm">
                      מוצר זה זמין לרכישה במספרה בלבד. בואו לבקר אותנו!
                    </p>
                  </div>
                </div>
              </div>
              
              {/* View All Products Link */}
              <Link
                href="/products"
                className="mt-6 flex items-center justify-center gap-2 py-3 px-6 rounded-xl border border-white/10 text-foreground-light hover:border-accent-gold/30 hover:text-accent-gold transition-all"
              >
                צפייה בכל המוצרים
              </Link>
            </div>
          </div>
        </div>
      </main>
    </>
  )
}

