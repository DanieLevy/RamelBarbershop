/**
 * Cached Data Queries
 * 
 * Uses Next.js unstable_cache for selective caching of data that doesn't change frequently.
 * All queries use explicit field selection to minimize egress (never select('*')).
 * 
 * CACHING STRATEGY:
 * - Shop settings: 30 minutes - rarely change
 * - Products: 30 minutes - rarely change
 * - Barbers (with work_days): 1 day - tag-invalidated on changes
 * - Services: 30 minutes - tag-invalidated on changes
 * - Shop closures: 30 minutes - tag-invalidated on changes
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
import type { BarbershopSettings, Product, BarberWithWorkDays, Service, BarbershopClosure } from '@/types/database'

// ============================================================
// FIELD SELECTIONS - Centralized to avoid over-fetching
// ============================================================

/** Fields needed for shop settings display (excludes rarely-used fields) */
const SHOP_SETTINGS_FIELDS = `
  id,
  name,
  phone,
  address,
  address_text,
  address_lat,
  address_lng,
  description,
  work_hours_start,
  work_hours_end,
  open_days,
  hero_title,
  hero_subtitle,
  hero_description,
  waze_link,
  google_maps_link,
  contact_phone,
  contact_email,
  contact_whatsapp,
  social_instagram,
  social_facebook,
  social_tiktok,
  show_phone,
  show_email,
  show_whatsapp,
  show_instagram,
  show_facebook,
  show_tiktok,
  max_booking_days_ahead,
  default_reminder_hours
` as const

/** Fields needed for product display */
const PRODUCT_FIELDS = 'id, name, name_he, description, price, image_url, is_active, display_order' as const

/** Fields needed for barber display (excludes password_hash, email, etc.) */
const BARBER_FIELDS = `
  id,
  username,
  fullname,
  name_en,
  img_url,
  img_position_x,
  img_position_y,
  phone,
  is_barber,
  is_active,
  role,
  display_order,
  instagram_url,
  blocked_customers
` as const

/** Fields needed for work days */
const WORK_DAYS_FIELDS = 'id, user_id, day_of_week, is_working, start_time, end_time' as const

/** Fields needed for services display */
const SERVICE_FIELDS = 'id, name, name_he, description, duration, price, is_active, barber_id' as const

/** Fields needed for closures */
const CLOSURE_FIELDS = 'id, start_date, end_date, reason, created_at' as const

/** Fields needed for barber closures */
const BARBER_CLOSURE_FIELDS = 'id, barber_id, start_date, end_date, reason, created_at' as const

// ============================================================
// CACHED QUERIES
// ============================================================

/**
 * Get cached barbershop settings
 * Cached for 30 minutes (1800 seconds)
 */
export const getCachedShopSettings = unstable_cache(
  async (): Promise<BarbershopSettings | null> => {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('barbershop_settings')
      .select(SHOP_SETTINGS_FIELDS)
      .single()
    
    if (error) {
      console.error('[CachedQueries] Failed to fetch shop settings:', error)
      return null
    }
    
    return data as BarbershopSettings
  },
  ['barbershop-settings'],
  { 
    revalidate: 1800, // 30 minutes
    tags: ['shop-settings'] 
  }
)

/**
 * Get cached products list
 * Cached for 30 minutes (1800 seconds)
 */
export const getCachedProducts = unstable_cache(
  async (): Promise<Product[]> => {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('products')
      .select(PRODUCT_FIELDS)
      .eq('is_active', true)
      .order('display_order', { ascending: true })
    
    if (error) {
      console.error('[CachedQueries] Failed to fetch products:', error)
      return []
    }
    
    return (data as Product[]) || []
  },
  ['active-products'],
  { 
    revalidate: 1800, // 30 minutes
    tags: ['products'] 
  }
)

/**
 * Get cached active barbers with work days
 * Cached for 1 day (86400 seconds) - tag-invalidated on barber changes
 */
export const getCachedBarbers = unstable_cache(
  async (): Promise<BarberWithWorkDays[]> => {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('users')
      .select(`${BARBER_FIELDS}, work_days(${WORK_DAYS_FIELDS})`)
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
  ['active-barbers'],
  { 
    revalidate: 86400, // 1 day - tag-invalidated on barber changes
    tags: ['barbers'] 
  }
)

/**
 * Get cached active services for a barber
 * Cached for 30 minutes - tag-invalidated on service changes
 */
export const getCachedBarberServices = unstable_cache(
  async (barberId: string): Promise<Service[]> => {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('services')
      .select(SERVICE_FIELDS)
      .eq('barber_id', barberId)
      .eq('is_active', true)
      .order('name_he', { ascending: true })
    
    if (error) {
      console.error('[CachedQueries] Failed to fetch barber services:', error)
      return []
    }
    
    return (data as Service[]) || []
  },
  ['barber-services'],
  {
    revalidate: 1800, // 30 minutes
    tags: ['services']
  }
)

/**
 * Get cached barbershop closures (upcoming only)
 * Cached for 30 minutes - tag-invalidated on changes
 */
export const getCachedShopClosures = unstable_cache(
  async (): Promise<BarbershopClosure[]> => {
    const supabase = createAdminClient()
    const today = new Date().toISOString().split('T')[0]
    const { data, error } = await supabase
      .from('barbershop_closures')
      .select(CLOSURE_FIELDS)
      .gte('end_date', today)
    
    if (error) {
      console.error('[CachedQueries] Failed to fetch shop closures:', error)
      return []
    }
    
    return (data as BarbershopClosure[]) || []
  },
  ['shop-closures'],
  {
    revalidate: 1800, // 30 minutes
    tags: ['shop-closures']
  }
)

// ============================================================
// EXPORTED FIELD CONSTANTS - For use in other files
// ============================================================

export {
  SHOP_SETTINGS_FIELDS,
  PRODUCT_FIELDS,
  BARBER_FIELDS,
  WORK_DAYS_FIELDS,
  SERVICE_FIELDS,
  CLOSURE_FIELDS,
  BARBER_CLOSURE_FIELDS,
}

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
 * revalidateTag('barbers')
 * revalidateTag('services')
 * revalidateTag('shop-closures')
 */
