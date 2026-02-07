/**
 * Class Name Utility
 *
 * Combines CSS class names, filtering out falsy values.
 */

/**
 * Combine utility classes
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}
