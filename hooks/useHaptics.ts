'use client'

import { useCallback } from 'react'
import { useHaptic } from 'react-haptic'

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
 * Enhanced haptics hook using react-haptic for iOS support
 * Falls back to native vibrate API where available, uses hidden switch
 * trick for iOS Taptic-like feedback
 */
export const useHaptics = (): UseHapticsReturn => {
  // react-haptic handles iOS vs Android internally
  const { vibrate: hapticVibrate } = useHaptic({ hapticDuration: 100 })
  
  // Check basic support
  const isSupported = typeof window !== 'undefined'

  const vibrate = useCallback(
    (pattern: VibratePattern): void => {
      if (!isSupported) return
      
      try {
        // For single durations, use react-haptic (which handles iOS)
        if (typeof pattern === 'number') {
          hapticVibrate()
          return
        }
        
        // For patterns, try native vibrate first, fallback to single haptic
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          navigator.vibrate(pattern)
        } else {
          // Multiple haptic taps for patterns on iOS
          pattern.forEach((duration, i) => {
            if (duration > 0 && i % 2 === 0) {
              setTimeout(() => hapticVibrate(), i * 50)
            }
          })
        }
      } catch {
        // Silently fail - haptic feedback is not critical
      }
    },
    [isSupported, hapticVibrate]
  )

  return {
    isSupported,
    light: useCallback(() => vibrate(PATTERNS.light), [vibrate]),
    medium: useCallback(() => vibrate(PATTERNS.medium), [vibrate]),
    heavy: useCallback(() => vibrate(PATTERNS.heavy), [vibrate]),
    success: useCallback(() => vibrate(PATTERNS.success), [vibrate]),
    error: useCallback(() => vibrate(PATTERNS.error), [vibrate]),
    warning: useCallback(() => vibrate(PATTERNS.warning), [vibrate]),
    selection: useCallback(() => vibrate(PATTERNS.selection), [vibrate]),
    impact: useCallback(() => vibrate(PATTERNS.impact), [vibrate]),
    custom: (pattern: VibratePattern) => vibrate(pattern),
  }
}
