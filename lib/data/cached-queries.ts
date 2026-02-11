/**
 * Cached Data Queries
 * 
 * Uses Next.js unstable_cache for selective caching of data that doesn't change frequently.
 * 
 * CACHING STRATEGY:
 * - Barbers (with work_days): 30 seconds - tolerable for homepage display,
 *   barber status changes are infrequent (activating/deactivating a barber)
 * - Shop settings: 10 minutes - rarely change
 * - Products: 10 minutes - rarely change
 * 
 * NEVER cache:
 * - Reservation data (must be real-time for booking flow)
 * - User-specific data (customer profiles, sessions)
 * 
 * NOTE: We use createAdminClient() instead of createClient() because:
 * - unstable_cache cannot use dynamic functions like cookies()
 * - Admin client uses service_role key and doesn't need cookies
 * - These are public, read-only queries so no RLS concerns
 */

import { unstable_cache } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import type { BarbershopSettings, Product, BarberWithWorkDays } from '@/types/database'

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
 * Get cached active barbers with work days
 * Cached for 1 day (86400 seconds)
 * 
 * Barber status rarely changes (activating/deactivating a barber is an infrequent admin action).
 * Manual invalidation via revalidateTag('barbers') is triggered by:
 * - app/api/barber/manage/route.ts (delete/reorder barber)
 * - app/api/barbers/create/route.ts (new barber created)
 * - Client-side via /api/revalidate (is_active toggle, profile updates)
 * This ensures the cache is fresh when barber data actually changes.
 * The booking flow fetches fresh data independently.
 * 
 * ORDERING: Admin barber(s) appear first, then by display_order ascending.
 */
export const getCachedBarbers = unstable_cache(
  async (): Promise<BarberWithWorkDays[]> => {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('users')
      .select('*, work_days(*)')
      .eq('is_barber', true)
      .eq('is_active', true)
      .order('display_order', { ascending: true })
    
    if (error) {
      console.error('[CachedQueries] Failed to fetch barbers:', error)
      return []
    }
    
    const barbers = (data as BarberWithWorkDays[]) || []
    
    // Sort admin barber(s) to the front while preserving display_order among non-admins
    barbers.sort((a, b) => {
      const aIsAdmin = a.role === 'admin' ? 0 : 1
      const bIsAdmin = b.role === 'admin' ? 0 : 1
      if (aIsAdmin !== bIsAdmin) return aIsAdmin - bIsAdmin
      return (a.display_order ?? 999) - (b.display_order ?? 999)
    })
    
    return barbers
  },
  ['active-barbers'], // Cache key
  { 
    revalidate: 86400, // 1 day - tag-invalidated on barber changes
    tags: ['barbers'] 
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
 * revalidateTag('shop-settings', 'max')
 * revalidateTag('products', 'max')
 * revalidateTag('barbers', 'max')
 */
