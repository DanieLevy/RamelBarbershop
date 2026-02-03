/**
 * iOS 26 Haptic Feedback Utility
 * 
 * Provides haptic feedback for PWAs on iOS Safari using the switch element workaround,
 * with standard Vibration API fallback for Android devices.
 * 
 * @see https://webkit.org/demos/html-switch/
 */

export type HapticFeedbackType = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' | 'selection';

// Cache for iOS detection
let isIOSCached: boolean | null = null;
let isPWACached: boolean | null = null;

/**
 * Detects if the current device is running iOS
 */
const isIOS = (): boolean => {
  if (isIOSCached !== null) return isIOSCached;
  
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }
  
  isIOSCached = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  
  return isIOSCached;
};

/**
 * Detects if the app is running in standalone PWA mode
 */
const isPWA = (): boolean => {
  if (isPWACached !== null) return isPWACached;
  
  if (typeof window === 'undefined') {
    return false;
  }
  
  isPWACached = window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  
  return isPWACached;
};

/**
 * Checks if haptic feedback is supported on the current device
 */
export const isHapticSupported = (): boolean => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }
  
  // iOS Safari supports haptics via switch element
  if (isIOS()) {
    return true;
  }
  
  // Android and other devices support Vibration API
  return 'vibrate' in navigator;
};

/**
 * Hidden switch element for triggering iOS haptics
 */
let hapticSwitch: HTMLInputElement | null = null;

/**
 * Creates or returns the cached haptic switch element
 */
const getHapticSwitch = (): HTMLInputElement => {
  if (hapticSwitch && document.body.contains(hapticSwitch)) {
    return hapticSwitch;
  }
  
  hapticSwitch = document.createElement('input');
  hapticSwitch.type = 'checkbox';
  hapticSwitch.setAttribute('switch', '');
  hapticSwitch.style.cssText = `
    position: absolute;
    top: -9999px;
    left: -9999px;
    width: 1px;
    height: 1px;
    opacity: 0;
    pointer-events: none;
    visibility: hidden;
  `;
  hapticSwitch.setAttribute('aria-hidden', 'true');
  hapticSwitch.tabIndex = -1;
  
  document.body.appendChild(hapticSwitch);
  
  return hapticSwitch;
};

/**
 * Triggers haptic feedback on iOS using the switch element workaround
 */
const triggerIOSHaptic = (): void => {
  try {
    const switchEl = getHapticSwitch();
    switchEl.checked = !switchEl.checked;
    // Force a layout recalculation to ensure the haptic fires
    void switchEl.offsetHeight;
  } catch (error) {
    // Silently fail if haptic cannot be triggered
    console.debug('[Haptics] iOS haptic failed:', error);
  }
};

/**
 * Vibration patterns for different feedback types (in milliseconds)
 */
const vibrationPatterns: Record<HapticFeedbackType, number | number[]> = {
  light: 10,
  medium: 20,
  heavy: 40,
  success: [10, 50, 10],
  warning: [20, 50, 20],
  error: [30, 50, 30, 50, 30],
  selection: 5,
};

/**
 * Triggers haptic feedback on Android using the Vibration API
 */
const triggerAndroidHaptic = (type: HapticFeedbackType = 'medium'): void => {
  try {
    const pattern = vibrationPatterns[type];
    navigator.vibrate(pattern);
  } catch (error) {
    // Silently fail if vibration cannot be triggered
    console.debug('[Haptics] Android vibration failed:', error);
  }
};

/**
 * Main function to trigger haptic feedback
 * 
 * @param type - The type of haptic feedback (only used on Android)
 * @returns boolean indicating if haptic was triggered
 * 
 * @example
 * ```tsx
 * import { triggerHaptic } from '@/lib/haptics';
 * 
 * const handleButtonClick = () => {
 *   triggerHaptic('light');
 *   // ... rest of click handler
 * };
 * ```
 */
export const triggerHaptic = (type: HapticFeedbackType = 'light'): boolean => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }
  
  // iOS Safari - use switch element workaround
  if (isIOS()) {
    triggerIOSHaptic();
    return true;
  }
  
  // Android and other devices - use Vibration API
  if ('vibrate' in navigator) {
    triggerAndroidHaptic(type);
    return true;
  }
  
  return false;
};

/**
 * Triggers a light tap haptic - ideal for button presses
 */
export const hapticTap = (): boolean => triggerHaptic('light');

/**
 * Triggers an impact haptic - ideal for toggles and selections
 * 
 * @param intensity - The intensity of the impact ('light' | 'medium' | 'heavy')
 */
export const hapticImpact = (intensity: 'light' | 'medium' | 'heavy' = 'medium'): boolean => triggerHaptic(intensity);

/**
 * Triggers a heavy impact haptic - ideal for important actions
 */
export const hapticHeavy = (): boolean => triggerHaptic('heavy');

/**
 * Triggers a success haptic pattern
 */
export const hapticSuccess = (): boolean => triggerHaptic('success');

/**
 * Triggers a warning haptic pattern
 */
export const hapticWarning = (): boolean => triggerHaptic('warning');

/**
 * Triggers an error haptic pattern
 */
export const hapticError = (): boolean => triggerHaptic('error');

/**
 * Triggers a selection change haptic - ideal for picker/scroll selections
 */
export const hapticSelection = (): boolean => triggerHaptic('selection');

/**
 * React hook-friendly wrapper that returns haptic functions
 * 
 * @example
 * ```tsx
 * const { tap, impact, success } = useHaptics();
 * 
 * return (
 *   <button onClick={() => { tap(); handleSubmit(); }}>
 *     Submit
 *   </button>
 * );
 * ```
 */
export const useHaptics = () => ({
  isSupported: isHapticSupported(),
  isIOS: isIOS(),
  isPWA: isPWA(),
  trigger: triggerHaptic,
  tap: hapticTap,
  impact: hapticImpact,
  heavy: hapticHeavy,
  success: hapticSuccess,
  warning: hapticWarning,
  error: hapticError,
  selection: hapticSelection,
});

export default triggerHaptic;
