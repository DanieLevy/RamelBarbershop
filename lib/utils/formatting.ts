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
