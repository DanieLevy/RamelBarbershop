/**
 * Toast Utility - Powered by react-hot-toast
 * 
 * Single source of truth for all toast notifications in the application.
 * Mobile-optimized with beautiful design, Hebrew RTL support, and consistent API.
 * 
 * @example Basic usage:
 * import { showToast } from '@/lib/toast'
 * 
 * showToast.success('התור נקבע בהצלחה!')
 * showToast.error('שגיאה בביצוע הפעולה')
 * showToast.info('מידע חשוב')
 * showToast.warning('שים לב!')
 * 
 * @example Loading toast:
 * const id = showToast.loading('שומר...')
 * // After operation completes:
 * showToast.dismiss(id)
 * showToast.success('נשמר בהצלחה!')
 * 
 * @example Promise toast:
 * showToast.promise(saveData(), {
 *   loading: 'שומר נתונים...',
 *   success: 'הנתונים נשמרו!',
 *   error: 'שגיאה בשמירה',
 * })
 */

import toast, { type Renderable } from 'react-hot-toast'

// ============================================================================
// Types
// ============================================================================

export type ToastVariant = 'success' | 'error' | 'warning' | 'info' | 'default'

export interface ToastAction {
  label: string
  onClick: () => void
}

export interface ToastOptions {
  /** Additional description text below the main message */
  description?: string
  /** Duration in milliseconds (default: 4000, use Infinity for persistent) */
  duration?: number
  /** Action button configuration (ignored in react-hot-toast) */
  action?: ToastAction
  /** Custom toast ID (for updating/dismissing specific toasts) */
  id?: string
  /** Whether the toast is dismissible (default: true) */
  dismissible?: boolean
  /** Callback when toast is dismissed */
  onDismiss?: () => void
  /** Callback when toast auto-closes */
  onAutoClose?: () => void
  /** Custom icon (JSX Element, string, or null) */
  icon?: Renderable
  /** Custom class name for the toast */
  className?: string
  /** Position override for this specific toast */
  position?: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'
}

export interface PromiseOptions<T> {
  loading: string
  success: string | ((data: T) => string)
  error: string | ((error: unknown) => string)
}

// ============================================================================
// Shared Style Constants
// ============================================================================

const VARIANT_STYLES = {
  success: { borderColor: 'rgba(52,211,153,0.3)' },
  error: { borderColor: 'rgba(244,63,94,0.3)' },
  warning: { borderColor: 'rgba(245,158,11,0.3)' },
  info: { borderColor: 'rgba(56,189,248,0.3)' },
  loading: { borderColor: 'rgba(212,175,55,0.3)' },
  default: {},
} as const

// ============================================================================
// Helper to build toast message with optional description
// ============================================================================

const buildMessage = (message: string, description?: string): string => {
  if (!description) return message
  return `${message}\n${description}`
}

// ============================================================================
// Toast Functions
// ============================================================================

/**
 * Show a success toast
 */
const success = (message: string, options?: ToastOptions): string => {
  return toast.success(buildMessage(message, options?.description), {
    id: options?.id,
    duration: options?.duration ?? 4000,
    icon: options?.icon,
    style: VARIANT_STYLES.success,
    position: options?.position,
  })
}

/**
 * Show an error toast
 */
const error = (message: string, options?: ToastOptions): string => {
  return toast.error(buildMessage(message, options?.description), {
    id: options?.id,
    duration: options?.duration ?? 5000, // Errors stay longer
    icon: options?.icon,
    style: VARIANT_STYLES.error,
    position: options?.position,
  })
}

/**
 * Show a warning toast
 */
const warning = (message: string, options?: ToastOptions): string => {
  return toast(buildMessage(message, options?.description), {
    id: options?.id,
    duration: options?.duration ?? 4000,
    icon: options?.icon ?? '⚠️',
    style: VARIANT_STYLES.warning,
    position: options?.position,
  })
}

/**
 * Show an info toast
 */
const info = (message: string, options?: ToastOptions): string => {
  return toast(buildMessage(message, options?.description), {
    id: options?.id,
    duration: options?.duration ?? 4000,
    icon: options?.icon ?? 'ℹ️',
    style: VARIANT_STYLES.info,
    position: options?.position,
  })
}

/**
 * Show a loading toast (persistent by default)
 * Returns toast ID for later dismissal
 */
const loading = (message: string, options?: Omit<ToastOptions, 'duration'>): string => {
  return toast.loading(buildMessage(message, options?.description), {
    id: options?.id,
    style: VARIANT_STYLES.loading,
    position: options?.position,
  })
}

/**
 * Show a default/neutral toast
 */
const show = (message: string, options?: ToastOptions): string => {
  return toast(buildMessage(message, options?.description), {
    id: options?.id,
    duration: options?.duration ?? 4000,
    icon: options?.icon,
    position: options?.position,
  })
}

/**
 * Dismiss a toast by ID, or dismiss all toasts if no ID provided
 */
const dismiss = (id?: string | number): void => {
  if (id !== undefined) {
    toast.dismiss(String(id))
  } else {
    toast.dismiss()
  }
}

/**
 * Show a promise-based toast that updates based on promise state
 */
const promise = <T>(
  promiseToWatch: Promise<T>,
  options: PromiseOptions<T>
): Promise<T> => {
  toast.promise(promiseToWatch, {
    loading: options.loading,
    success: options.success,
    error: options.error,
  })
  return promiseToWatch
}

/**
 * Update an existing toast by showing a new one with the same ID
 */
const update = (
  id: string | number,
  message: string,
  options?: ToastOptions & { variant?: ToastVariant }
): void => {
  const toastId = String(id)
  const variant = options?.variant || 'default'
  
  switch (variant) {
    case 'success':
      toast.success(buildMessage(message, options?.description), { id: toastId, ...VARIANT_STYLES.success })
      break
    case 'error':
      toast.error(buildMessage(message, options?.description), { id: toastId, ...VARIANT_STYLES.error })
      break
    case 'warning':
      toast(buildMessage(message, options?.description), { id: toastId, icon: '⚠️', ...VARIANT_STYLES.warning })
      break
    case 'info':
      toast(buildMessage(message, options?.description), { id: toastId, icon: 'ℹ️', ...VARIANT_STYLES.info })
      break
    default:
      toast(buildMessage(message, options?.description), { id: toastId })
  }
}

/**
 * Show a custom toast with JSX content
 */
const custom = (content: React.ReactNode, options?: ToastOptions): string => {
  return toast.custom(
    () => content as React.ReactElement,
    {
      id: options?.id,
      duration: options?.duration ?? 4000,
      position: options?.position,
    }
  )
}

// ============================================================================
// Main Export Object
// ============================================================================

/**
 * Main toast utility - single source of truth for all notifications
 * 
 * @example
 * showToast.success('הצלחה!')
 * showToast.error('שגיאה', { description: 'נסה שוב' })
 * showToast.loading('טוען...')
 * showToast.dismiss()
 */
export const showToast = {
  /** Show success notification */
  success,
  /** Show error notification */
  error,
  /** Show warning notification */
  warning,
  /** Show info notification */
  info,
  /** Show loading notification (returns ID for dismiss) */
  loading,
  /** Show default/neutral notification */
  show,
  /** Dismiss toast(s) */
  dismiss,
  /** Promise-based notification */
  promise,
  /** Update existing toast */
  update,
  /** Custom toast component */
  custom,
}

// ============================================================================
// Quick Access Aliases
// ============================================================================

/** Alias for showToast - for shorter imports */
export const notify = showToast

/** Direct function exports for convenience */
export {
  success as toastSuccess,
  error as toastError,
  warning as toastWarning,
  info as toastInfo,
  loading as toastLoading,
  dismiss as toastDismiss,
}

// ============================================================================
// Default Export
// ============================================================================

export default showToast
