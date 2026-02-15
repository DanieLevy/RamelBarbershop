/**
 * Client-Side In-Memory Cache
 * 
 * Provides a simple TTL-based cache for client components to avoid
 * redundant Supabase queries within the same session.
 * 
 * Use for data that:
 * - Rarely changes (shop settings, services, work days)
 * - Is fetched from multiple components
 * - Doesn't need real-time freshness
 * 
 * DO NOT use for:
 * - Reservation data (must be real-time)
 * - User-specific sensitive data
 */

type CacheEntry<T> = {
  data: T
  expiresAt: number
}

const cache = new Map<string, CacheEntry<unknown>>()

/** Default TTL: 5 minutes */
const DEFAULT_TTL_MS = 5 * 60 * 1000

/**
 * Get cached data or fetch fresh data
 * @param key - Unique cache key
 * @param fetcher - Async function to fetch data if cache miss
 * @param ttlMs - Time-to-live in milliseconds (default 5 min)
 */
export const getCachedOrFetch = async <T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs: number = DEFAULT_TTL_MS
): Promise<T> => {
  const now = Date.now()
  const cached = cache.get(key) as CacheEntry<T> | undefined

  if (cached && cached.expiresAt > now) {
    return cached.data
  }

  const data = await fetcher()
  cache.set(key, { data, expiresAt: now + ttlMs })
  return data
}

/**
 * Invalidate a specific cache entry
 */
export const invalidateCache = (key: string): void => {
  cache.delete(key)
}

/**
 * Invalidate all cache entries matching a prefix
 * e.g., invalidateCacheByPrefix('barber-services') clears all barber service caches
 */
export const invalidateCacheByPrefix = (prefix: string): void => {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      cache.delete(key)
    }
  }
}

/**
 * Clear the entire cache
 */
export const clearCache = (): void => {
  cache.clear()
}

// ============================================================
// PREDEFINED CACHE KEYS
// ============================================================

export const CACHE_KEYS = {
  shopSettings: 'shop-settings',
  shopClosures: 'shop-closures',
  barberWorkDays: (barberId: string) => `barber-work-days-${barberId}`,
  barberClosures: (barberId: string) => `barber-closures-${barberId}`,
  barberServices: (barberId: string) => `barber-services-${barberId}`,
  barberBookingSettings: (barberId: string) => `barber-booking-settings-${barberId}`,
  barberMessages: (barberId: string) => `barber-messages-${barberId}`,
} as const

// ============================================================
// CACHE TTLS (in milliseconds)
// ============================================================

export const CACHE_TTLS = {
  /** Shop settings - rarely change, 10 minute client cache */
  shopSettings: 10 * 60 * 1000,
  /** Shop closures - 10 minute client cache */
  shopClosures: 10 * 60 * 1000,
  /** Work days - 5 minute client cache */
  workDays: 5 * 60 * 1000,
  /** Barber closures - 5 minute client cache */
  barberClosures: 5 * 60 * 1000,
  /** Services - 5 minute client cache */
  services: 5 * 60 * 1000,
  /** Booking settings - 5 minute client cache */
  bookingSettings: 5 * 60 * 1000,
  /** Messages - 2 minute client cache */
  messages: 2 * 60 * 1000,
} as const
