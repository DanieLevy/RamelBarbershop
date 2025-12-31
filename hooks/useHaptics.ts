'use client'

import { useCallback, useRef, useEffect } from 'react'

type VibratePattern = number | number[]

interface HapticPatterns {
  light: VibratePattern
  medium: VibratePattern
  heavy: VibratePattern
  success: VibratePattern
  error: VibratePattern
  warning: VibratePattern
  selection: VibratePattern
  impact: VibratePattern
}

const PATTERNS: HapticPatterns = {
  light: 10,
  medium: 25,
  heavy: 40,
  success: [15, 50, 15],
  error: [50, 100, 50],
  warning: [30, 50, 30],
  selection: 10,
  impact: 20,
}

interface UseHapticsReturn {
  isSupported: boolean
  light: () => void
  medium: () => void
  heavy: () => void
  success: () => void
  error: () => void
  warning: () => void
  selection: () => void
  impact: () => void
  custom: (pattern: VibratePattern) => void
}

/**
 * Simple haptics hook using native Vibration API only
 * 
 * NOTE: Removed react-haptic dependency as it caused PWA layout issues on iOS
 * due to DOM manipulation during SSR hydration. The hidden checkbox trick
 * for iOS haptics was causing "Connection closed" errors and layout breaks.
 * 
 * This hook now uses only the native Vibration API (Android/Chrome support).
 * iOS Safari doesn't support haptics via JavaScript, so we fail silently there.
 */
export const useHaptics = (): UseHapticsReturn => {
  // Check for native vibrate API support (Android, Chrome desktop)
  const isSupportedRef = useRef(false)
  const isMountedRef = useRef(false)
  
  useEffect(() => {
    isMountedRef.current = true
    isSupportedRef.current = typeof navigator !== 'undefined' && 'vibrate' in navigator
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const vibrate = useCallback((pattern: VibratePattern): void => {
    // Only run on client after mount
    if (!isMountedRef.current) return
    
    try {
      // Use native Vibration API if available (Android/Chrome)
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(pattern)
      }
      // iOS doesn't support navigator.vibrate - silently fail
      // The user experience is still good without haptics
    } catch {
      // Silently fail - haptic feedback is not critical
    }
  }, [])

  // Memoized callbacks for each pattern
  const light = useCallback(() => vibrate(PATTERNS.light), [vibrate])
  const medium = useCallback(() => vibrate(PATTERNS.medium), [vibrate])
  const heavy = useCallback(() => vibrate(PATTERNS.heavy), [vibrate])
  const success = useCallback(() => vibrate(PATTERNS.success), [vibrate])
  const error = useCallback(() => vibrate(PATTERNS.error), [vibrate])
  const warning = useCallback(() => vibrate(PATTERNS.warning), [vibrate])
  const selection = useCallback(() => vibrate(PATTERNS.selection), [vibrate])
  const impact = useCallback(() => vibrate(PATTERNS.impact), [vibrate])
  const custom = useCallback((pattern: VibratePattern) => vibrate(pattern), [vibrate])

  return {
    isSupported: isSupportedRef.current,
    light,
    medium,
    heavy,
    success,
    error,
    warning,
    selection,
    impact,
    custom,
  }
}
