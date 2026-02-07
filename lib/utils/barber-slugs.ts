/**
 * Barber Slug Utilities
 *
 * URL-safe slug generation, validation, and URL building
 * for barber profiles. Supports Hebrew-to-Latin transliteration.
 */

// ============================================================
// TRANSLITERATION MAP
// ============================================================

/**
 * Hebrew to Latin transliteration map for URL-safe slugs
 */
const hebrewToLatinMap: Record<string, string> = {
  'א': 'a', 'ב': 'b', 'ג': 'g', 'ד': 'd', 'ה': 'h',
  'ו': 'v', 'ז': 'z', 'ח': 'ch', 'ט': 't', 'י': 'y',
  'כ': 'k', 'ך': 'k', 'ל': 'l', 'מ': 'm', 'ם': 'm',
  'נ': 'n', 'ן': 'n', 'ס': 's', 'ע': 'a', 'פ': 'p',
  'ף': 'p', 'צ': 'tz', 'ץ': 'tz', 'ק': 'k', 'ר': 'r',
  'ש': 'sh', 'ת': 't',
}

// ============================================================
// SLUG GENERATION
// ============================================================

/**
 * Generate a URL-safe slug from a name (supports Hebrew and English)
 * @param name The name to convert (e.g., "רם אל" or "Ramel")
 * @returns URL-safe slug (e.g., "ramal" or "ramel")
 */
export function generateSlugFromName(name: string): string {
  if (!name || typeof name !== 'string') return ''
  
  let result = name.toLowerCase().trim()
  
  // Transliterate Hebrew characters
  result = result
    .split('')
    .map(char => hebrewToLatinMap[char] || char)
    .join('')
  
  // Remove any remaining non-alphanumeric characters except spaces and hyphens
  result = result.replace(/[^a-z0-9\s-]/g, '')
  
  // Replace spaces with hyphens
  result = result.replace(/\s+/g, '-')
  
  // Remove consecutive hyphens
  result = result.replace(/-+/g, '-')
  
  // Remove leading/trailing hyphens
  result = result.replace(/^-+|-+$/g, '')
  
  return result
}

/**
 * Generate a URL slug from English name
 * Converts "Tamir Shabo" → "tamir.shabo"
 * Uses dots as separators for a cleaner look
 * @param nameEn English name to convert
 * @returns URL-friendly slug with dots
 */
export function generateSlugFromEnglishName(nameEn: string): string {
  if (!nameEn || typeof nameEn !== 'string') return ''
  
  return nameEn
    .toLowerCase()
    .trim()
    // Remove any characters that aren't letters, numbers, or spaces
    .replace(/[^a-z0-9\s]/g, '')
    // Replace multiple spaces with single space
    .replace(/\s+/g, ' ')
    // Replace spaces with dots
    .replace(/\s/g, '.')
    // Remove any leading/trailing dots
    .replace(/^\.+|\.+$/g, '')
}

// ============================================================
// SLUG VALIDATION
// ============================================================

/**
 * Check if a string is a valid UUID v4
 * @param str The string to check
 * @returns true if it's a valid UUID
 */
export function isValidUUID(str: string): boolean {
  if (!str || typeof str !== 'string') return false
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(str)
}

/**
 * Check if a string is a valid barber slug
 * Valid slugs: lowercase letters, numbers, and hyphens, 2-50 chars
 * @param str The string to check
 * @returns true if it's a valid slug format
 */
export function isValidSlug(str: string): boolean {
  if (!str || typeof str !== 'string') return false
  const slugRegex = /^[a-z0-9][a-z0-9-]{0,48}[a-z0-9]$|^[a-z0-9]{1,2}$/
  return slugRegex.test(str) && !str.includes('--')
}

/**
 * Normalize a slug for consistent comparison
 * @param slug The slug to normalize
 * @returns Lowercase, trimmed slug
 */
export function normalizeSlug(slug: string): string {
  if (!slug || typeof slug !== 'string') return ''
  return slug.toLowerCase().trim()
}

/**
 * Generate a unique slug by appending a number if needed
 * @param baseSlug The base slug
 * @param existingSlugs Array of existing slugs to check against
 * @returns A unique slug
 */
export function makeUniqueSlug(baseSlug: string, existingSlugs: string[]): string {
  const slug = normalizeSlug(baseSlug)
  if (!existingSlugs.includes(slug)) return slug
  
  let counter = 2
  while (existingSlugs.includes(`${slug}-${counter}`)) {
    counter++
  }
  return `${slug}-${counter}`
}

/**
 * Check if a slug is in the English name format (contains dots)
 * @param slug The slug to check
 * @returns True if it's an English name slug (e.g., "tamir.shabo")
 */
export function isEnglishNameSlug(slug: string): boolean {
  if (!slug) return false
  // English name slugs contain dots and only lowercase letters
  return /^[a-z]+(\.[a-z]+)+$/.test(slug)
}

/**
 * Get the preferred slug for a barber (name_en-based if available, otherwise username)
 * @param nameEn Optional English name
 * @param username Fallback username
 * @returns The preferred slug to use
 */
export function getPreferredBarberSlug(nameEn: string | null | undefined, username: string): string {
  if (nameEn && nameEn.trim()) {
    return generateSlugFromEnglishName(nameEn)
  }
  return normalizeSlug(username)
}

// ============================================================
// URL BUILDING
// ============================================================

/**
 * Build a barber profile URL using slug
 * @param slug The barber's URL slug (username)
 * @returns Full path to barber profile
 */
export function buildBarberProfileUrl(slug: string): string {
  return `/barber/${encodeURIComponent(normalizeSlug(slug))}`
}

/**
 * Build a barber booking URL with optional service pre-selection
 * @param slug The barber's URL slug
 * @param serviceId Optional service ID to pre-select
 * @returns Full path to booking page
 */
export function buildBarberBookingUrl(slug: string, serviceId?: string): string {
  const base = `/barber/${encodeURIComponent(normalizeSlug(slug))}/book`
  if (serviceId) {
    return `${base}?service=${encodeURIComponent(serviceId)}`
  }
  return base
}

/**
 * Build a shareable barber link with optional deep-link to homepage
 * @param slug The barber's URL slug
 * @param baseUrl The base URL of the site (e.g., "https://ramelbarbershop.com")
 * @returns Full shareable URL
 */
export function buildShareableBarberLink(slug: string, baseUrl: string): string {
  const normalizedSlug = normalizeSlug(slug)
  // Remove trailing slash from baseUrl if present
  const cleanBaseUrl = baseUrl.replace(/\/$/, '')
  return `${cleanBaseUrl}/barber/${encodeURIComponent(normalizedSlug)}`
}
