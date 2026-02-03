/**
 * Cached Data Queries
 * 
 * Uses Next.js unstable_cache for selective caching of data that doesn't change frequently.
 * 
 * IMPORTANT: Only cache data that can tolerate being slightly stale:
 * - Shop settings (rarely change)
 * - Products (rarely change)
 * 
 * NEVER cache:
 * - Barber availability/status (must be real-time)
 * - Reservation data (must be real-time)
 * - User-specific data
 * 
 * NOTE: We use createAdminClient() instead of createClient() because:
 * - unstable_cache cannot use dynamic functions like cookies()
 * - Admin client uses service_role key and doesn't need cookies
 * - These are public, read-only queries so no RLS concerns
 */

import { unstable_cache } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import type { BarbershopSettings, Product } from '@/types/database'

/**
 * Get cached barbershop settings
 * Cached for 10 minutes (600 seconds)
 * 
 * This is safe to cache because shop settings rarely change,
 * and a 10-minute delay is acceptable for display purposes.
 */
export const getCachedShopSettings = unstable_cache(
  async (): Promise<BarbershopSettings | null> => {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('barbershop_settings')
      .select('*')
      .single()
    
    if (error) {
      console.error('[CachedQueries] Failed to fetch shop settings:', error)
      return null
    }
    
    return data as BarbershopSettings
  },
  ['barbershop-settings'], // Cache key
  { 
    revalidate: 600, // 10 minutes
    tags: ['shop-settings'] 
  }
)

/**
 * Get cached products list
 * Cached for 10 minutes (600 seconds)
 * 
 * Products are displayed on the home page and rarely change.
 * A 10-minute cache is acceptable for this static-ish content.
 */
export const getCachedProducts = unstable_cache(
  async (): Promise<Product[]> => {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true })
    
    if (error) {
      console.error('[CachedQueries] Failed to fetch products:', error)
      return []
    }
    
    return (data as Product[]) || []
  },
  ['active-products'], // Cache key
  { 
    revalidate: 600, // 10 minutes
    tags: ['products'] 
  }
)

/**
 * Revalidation Notes:
 * 
 * To manually invalidate these caches (e.g., when admin updates settings):
 * 
 * import { revalidateTag } from 'next/cache'
 * 
 * // In API route or server action:
 * revalidateTag('shop-settings')
 * revalidateTag('products')
 */
