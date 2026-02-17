import { createClient } from '@/lib/supabase/server'
import { AppHeader } from '@/components/AppHeader'
import { ProductCard } from '@/components/ProductCard'
import { SectionTitle } from '@/components/ui/SectionTitle'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import type { Product } from '@/types/database'

export const metadata = {
  title: 'המוצרים שלנו | רם אל ברברשופ',
  description: 'קטלוג המוצרים של רם אל ברברשופ - מוצרי טיפוח וסטיילינג לגבר המודרני',
}

export default async function ProductsPage() {
  const supabase = await createClient()
  
  // Fetch all active products
  const { data: products } = await supabase
    .from('products')
    .select('id, name, name_he, description, price, image_url, is_active, display_order')
    .eq('is_active', true)
    .order('display_order', { ascending: true }) as { data: Product[] | null }

  return (
    <>
      <AppHeader />
      
      <main 
        id="main-content"
        tabIndex={-1}
        className="min-h-screen bg-background-dark outline-none"
        style={{
          paddingTop: 'calc(var(--header-top-offset, 0px) + 5rem)',
        }}
      >
        <div className="container-mobile py-8 sm:py-12">
          {/* Back Link */}
          <Link
            href="/"
            prefetch={false}
            className="inline-flex items-center gap-2 text-foreground-muted hover:text-accent-gold transition-colors mb-8"
          >
            <ChevronRight size={16} strokeWidth={2} />
            <span>חזרה לדף הבית</span>
          </Link>
          
          <SectionTitle className="mb-8">המוצרים שלנו</SectionTitle>
          
          <p className="text-foreground-muted text-center mb-12 max-w-2xl mx-auto">
            מבחר מוצרי טיפוח וסטיילינג איכותיים לגבר המודרני.
            כל המוצרים זמינים לרכישה במספרה.
          </p>
          
          {/* Products Grid */}
          {products && products.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {products.map((product) => (
                <ProductCard 
                  key={product.id} 
                  product={product} 
                  size="lg" 
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="w-8 h-8 text-foreground-muted"
                >
                  <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                  <line x1="7" y1="7" x2="7.01" y2="7" />
                </svg>
              </div>
              <p className="text-foreground-muted">
                אין מוצרים להצגה כרגע
              </p>
            </div>
          )}
          
          {/* Info Note */}
          <div className="mt-12 p-4 rounded-2xl bg-accent-gold/10 border border-accent-gold/20 text-center">
            <p className="text-accent-gold text-sm">
              💈 כל המוצרים זמינים לרכישה במספרה בלבד
            </p>
          </div>
        </div>
      </main>
    </>
  )
}

