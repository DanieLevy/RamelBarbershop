/**
 * External Link Utility for iOS PWA Compatibility
 * 
 * On iOS PWA (standalone mode), links with target="_blank" or window.open()
 * open in an in-app browser, causing white screen issues when returning.
 * This utility detects iOS PWA and uses window.location.href instead.
 */

/**
 * Detect if running in iOS PWA standalone mode
 */
export function isIOSPWA(): boolean {
  if (typeof window === 'undefined') return false
  
  // Check for iOS
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent.toLowerCase())
  
  // Check for standalone mode (PWA installed)
  const isStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  
  return isIOS && isStandalone
}

/**
 * Detect if running in any PWA standalone mode (iOS or Android)
 */
export function isPWAStandalone(): boolean {
  if (typeof window === 'undefined') return false
  
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true ||
    document.referrer.includes('android-app://')
  )
}

/**
 * Check if a URL is external (different domain)
 */
export function isExternalUrl(url: string): boolean {
  if (typeof window === 'undefined') return false
  
  try {
    const urlObj = new URL(url, window.location.origin)
    return urlObj.origin !== window.location.origin
  } catch {
    // If URL parsing fails, assume it's external if it starts with http
    return url.startsWith('http://') || url.startsWith('https://')
  }
}

/**
 * Open an external link properly based on environment
 * 
 * - iOS PWA: Uses window.location.href to open in Safari (avoids in-app browser issues)
 * - Other PWA/Browser: Uses window.open with proper security attributes
 * 
 * @param url - The URL to open
 * @param options - Optional configuration
 */
export function openExternalLink(
  url: string, 
  options: { 
    /** Force open in same tab (for iOS PWA this is always true) */
    forceSameTab?: boolean 
  } = {}
): void {
  if (typeof window === 'undefined') return
  
  // For iOS PWA, always use location.href to open in Safari
  // This prevents the white screen issue when returning to the app
  if (isIOSPWA() || options.forceSameTab) {
    window.location.href = url
    return
  }
  
  // For other environments, use window.open with security attributes
  window.open(url, '_blank', 'noopener,noreferrer')
}

/**
 * Create an onClick handler for external links
 * Use this instead of href for buttons that open external URLs
 * 
 * @param url - The URL to open
 * @returns Event handler function
 */
export function handleExternalClick(url: string) {
  return (e: React.MouseEvent) => {
    e.preventDefault()
    openExternalLink(url)
  }
}

/**
 * Get the appropriate link props for an anchor tag
 * Returns props that handle iOS PWA correctly
 * 
 * @param url - The URL for the link
 * @returns Props object for the anchor tag
 */
export function getExternalLinkProps(url: string): {
  href: string
  target?: string
  rel?: string
  onClick?: (e: React.MouseEvent) => void
} {
  // For iOS PWA, use onClick handler instead of target="_blank"
  if (isIOSPWA()) {
    return {
      href: url,
      onClick: (e: React.MouseEvent) => {
        e.preventDefault()
        window.location.href = url
      }
    }
  }
  
  // For other environments, use standard external link attributes
  return {
    href: url,
    target: '_blank',
    rel: 'noopener noreferrer'
  }
}
