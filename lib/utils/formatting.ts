/**
 * General Formatting Utilities
 *
 * Price formatting and ID generation.
 */

/**
 * Format price with currency symbol
 */
export function formatPrice(price: number): string {
  return `₪${price.toLocaleString('he-IL')}`
}

/**
 * Normalize a phone value for storage.
 * Preserves walkin identifiers (e.g. "walkin-1709000000000") as-is,
 * strips non-digit characters from real phone numbers.
 */
export function normalizePhone(phone: string): string {
  if (phone.startsWith('walkin-')) return phone
  return phone.replace(/\D/g, '')
}

/**
 * Generate a random ID
 */
export function makeId(length = 6): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}
