/**
 * Enhanced Toast Utility
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
 * @example With description:
 * showToast.success('הצלחה!', { description: 'התור נקבע לשעה 10:00' })
 * 
 * @example With action:
 * showToast.success('התור בוטל', {
 *   action: { label: 'בטל', onClick: () => undoCancel() }
 * })
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

import { toast, ExternalToast } from 'sonner'

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
  /** Action button configuration */
  action?: ToastAction
  /** Custom toast ID (for updating/dismissing specific toasts) */
  id?: string | number
  /** Whether the toast is dismissible (default: true) */
  dismissible?: boolean
  /** Callback when toast is dismissed */
  onDismiss?: () => void
  /** Callback when toast auto-closes */
  onAutoClose?: () => void
  /** Custom icon (React node) */
  icon?: React.ReactNode
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
// Icon Components (SVG strings for performance)
// ============================================================================

const icons = {
  success: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
  error: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
  warning: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  info: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
  loading: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5 animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>`,
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Convert ToastOptions to Sonner's ExternalToast format
 */
const toSonnerOptions = (options?: ToastOptions): ExternalToast => {
  if (!options) return {}
  
  const sonnerOptions: ExternalToast = {}
  
  if (options.description) sonnerOptions.description = options.description
  if (options.duration !== undefined) sonnerOptions.duration = options.duration
  if (options.id !== undefined) sonnerOptions.id = options.id
  if (options.dismissible !== undefined) sonnerOptions.dismissible = options.dismissible
  if (options.onDismiss) sonnerOptions.onDismiss = options.onDismiss
  if (options.onAutoClose) sonnerOptions.onAutoClose = options.onAutoClose
  if (options.icon) sonnerOptions.icon = options.icon
  if (options.className) sonnerOptions.className = options.className
  if (options.position) sonnerOptions.position = options.position
  
  if (options.action) {
    sonnerOptions.action = {
      label: options.action.label,
      onClick: options.action.onClick,
    }
  }
  
  return sonnerOptions
}

// ============================================================================
// Toast Functions
// ============================================================================

/**
 * Show a success toast
 */
const success = (message: string, options?: ToastOptions): string | number => {
  return toast.success(message, toSonnerOptions(options))
}

/**
 * Show an error toast
 */
const error = (message: string, options?: ToastOptions): string | number => {
  return toast.error(message, {
    ...toSonnerOptions(options),
    duration: options?.duration ?? 5000, // Errors stay longer
  })
}

/**
 * Show a warning toast
 */
const warning = (message: string, options?: ToastOptions): string | number => {
  return toast.warning(message, toSonnerOptions(options))
}

/**
 * Show an info toast
 */
const info = (message: string, options?: ToastOptions): string | number => {
  return toast.info(message, toSonnerOptions(options))
}

/**
 * Show a loading toast (persistent by default)
 * Returns toast ID for later dismissal
 */
const loading = (message: string, options?: Omit<ToastOptions, 'duration'>): string | number => {
  return toast.loading(message, {
    ...toSonnerOptions(options),
    duration: Infinity, // Loading toasts don't auto-dismiss
  })
}

/**
 * Show a default/neutral toast
 */
const show = (message: string, options?: ToastOptions): string | number => {
  return toast(message, toSonnerOptions(options))
}

/**
 * Dismiss a toast by ID, or dismiss all toasts if no ID provided
 */
const dismiss = (id?: string | number): void => {
  if (id !== undefined) {
    toast.dismiss(id)
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
 * Update an existing toast
 */
const update = (
  id: string | number,
  message: string,
  options?: ToastOptions & { variant?: ToastVariant }
): void => {
  const variant = options?.variant || 'default'
  
  switch (variant) {
    case 'success':
      toast.success(message, { ...toSonnerOptions(options), id })
      break
    case 'error':
      toast.error(message, { ...toSonnerOptions(options), id })
      break
    case 'warning':
      toast.warning(message, { ...toSonnerOptions(options), id })
      break
    case 'info':
      toast.info(message, { ...toSonnerOptions(options), id })
      break
    default:
      toast(message, { ...toSonnerOptions(options), id })
  }
}

/**
 * Show a custom toast with full control
 */
const custom = (content: React.ReactNode, options?: ToastOptions): string | number => {
  return toast.custom(() => content as React.ReactElement, toSonnerOptions(options))
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
  /** SVG icons for custom toasts */
  icons,
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
