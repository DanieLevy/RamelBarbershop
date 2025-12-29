/**
 * Navigator API Type Augmentations
 * 
 * Extends the Navigator interface with modern PWA APIs that TypeScript
 * doesn't include by default.
 */

/**
 * App Badging API (iOS 16.4+, Android, desktop PWAs)
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Navigator/setAppBadge
 */
interface NavigatorBadge {
  /**
   * Sets an app badge on the app's icon
   * @param contents - The number to display, or nothing for a dot
   */
  setAppBadge(contents?: number): Promise<void>
  
  /**
   * Clears the app badge
   */
  clearAppBadge(): Promise<void>
}

/**
 * iOS Safari standalone mode detection
 */
interface NavigatorStandalone {
  /**
   * Returns true if the app is running in standalone mode (iOS Safari PWA)
   */
  readonly standalone?: boolean
}

/**
 * Share API types (for completeness)
 */
interface ShareData {
  files?: File[]
  text?: string
  title?: string
  url?: string
}

interface NavigatorShare {
  share(data?: ShareData): Promise<void>
  canShare(data?: ShareData): boolean
}

/**
 * Extend the Navigator interface
 */
declare global {
  interface Navigator extends NavigatorBadge, NavigatorStandalone, NavigatorShare {}
}

export {}

