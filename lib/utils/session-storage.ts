/**
 * Dual-Storage Session Persistence
 * 
 * Stores session data in BOTH localStorage AND a long-lived cookie.
 * On read, if localStorage is missing (iOS eviction, storage pressure),
 * automatically recovers from the cookie fallback.
 * 
 * This solves the iOS Safari / PWA issue where localStorage can be
 * evicted after ~7 days of inactivity or under storage pressure,
 * causing unexpected logouts.
 * 
 * Cookie properties:
 * - Max-Age: 400 days (max allowed by browsers)
 * - Path: /
 * - SameSite: Lax (works for same-site navigation)
 * - Secure: only in production (HTTPS)
 * - NOT HttpOnly (needs JS access for read/write)
 */

const COOKIE_MAX_AGE_DAYS = 400
const COOKIE_MAX_AGE_SECONDS = COOKIE_MAX_AGE_DAYS * 24 * 60 * 60

/**
 * Get cookie value by name
 */
function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  
  const cookies = document.cookie.split(';')
  for (const cookie of cookies) {
    const [key, ...valueParts] = cookie.trim().split('=')
    if (key === name) {
      try {
        return decodeURIComponent(valueParts.join('='))
      } catch {
        return null
      }
    }
  }
  return null
}

/**
 * Set a long-lived cookie
 */
function setCookie(name: string, value: string): void {
  if (typeof document === 'undefined') return
  
  const isSecure = typeof window !== 'undefined' && window.location.protocol === 'https:'
  const secureFlag = isSecure ? '; Secure' : ''
  
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${COOKIE_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secureFlag}`
}

/**
 * Delete a cookie
 */
function deleteCookie(name: string): void {
  if (typeof document === 'undefined') return
  document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`
}

/**
 * Save session data to both localStorage and cookie fallback.
 * The cookie acts as a resilient backup when localStorage is evicted.
 */
export function saveSessionDual(storageKey: string, cookieKey: string, data: object): void {
  if (typeof window === 'undefined') return
  
  const json = JSON.stringify(data)
  
  // Primary: localStorage
  try {
    localStorage.setItem(storageKey, json)
  } catch (err) {
    console.warn(`[SessionStorage] localStorage write failed for ${storageKey}:`, err)
  }
  
  // Fallback: cookie
  try {
    setCookie(cookieKey, json)
  } catch (err) {
    console.warn(`[SessionStorage] Cookie write failed for ${cookieKey}:`, err)
  }
}

/**
 * Read session data from localStorage with cookie fallback.
 * If localStorage is empty but cookie exists, automatically recovers
 * by restoring localStorage from the cookie.
 */
export function readSessionDual<T>(storageKey: string, cookieKey: string): T | null {
  if (typeof window === 'undefined') return null
  
  // Try localStorage first (fastest)
  try {
    const stored = localStorage.getItem(storageKey)
    if (stored) {
      const parsed = JSON.parse(stored) as T
      
      // Ensure cookie is also up-to-date (refresh its expiration)
      setCookie(cookieKey, stored)
      
      return parsed
    }
  } catch {
    // localStorage parse error — fall through to cookie
  }
  
  // localStorage empty or corrupted — try cookie fallback
  try {
    const cookieValue = getCookie(cookieKey)
    if (cookieValue) {
      const parsed = JSON.parse(cookieValue) as T
      
      // Recover localStorage from cookie
      console.log(`[SessionStorage] Recovered ${storageKey} from cookie fallback`)
      try {
        localStorage.setItem(storageKey, cookieValue)
      } catch {
        // localStorage write failed — session still works from cookie
      }
      
      return parsed
    }
  } catch {
    // Cookie parse error — both storages corrupted
  }
  
  return null
}

/**
 * Clear session from both localStorage and cookie.
 */
export function clearSessionDual(storageKey: string, cookieKey: string): void {
  if (typeof window === 'undefined') return
  
  try {
    localStorage.removeItem(storageKey)
  } catch {
    // Ignore
  }
  
  deleteCookie(cookieKey)
}
