'use client'

import { useCallback } from 'react'

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
  medium: 20,
  heavy: 30,
  success: [10, 50, 10],
  error: [50, 100, 50],
  warning: [30, 50, 30],
  selection: 8,
  impact: 15,
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

export const useHaptics = (): UseHapticsReturn => {
  const isSupported = typeof navigator !== 'undefined' && 'vibrate' in navigator

  const vibrate = useCallback(
    (pattern: VibratePattern): void => {
      if (!isSupported) return
      
      try {
        navigator.vibrate(pattern)
      } catch {
        // Silently fail - vibration not critical
      }
    },
    [isSupported]
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

