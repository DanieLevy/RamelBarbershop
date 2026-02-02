/**
 * Bug Reporter - Core Service
 * 
 * Centralized bug reporting system for automatic error tracking
 */

import type { BugReportData, BugReportPayload, BugSeverity, UserContext, EnvironmentInfo } from './types'

// App version - synced from package.json
const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || '2.0.0'

/**
 * Generate a unique report ID
 */
function generateReportId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 8)
  return `BR-${timestamp}-${random}`.toUpperCase()
}

/**
 * Get environment info from the browser
 */
export function getEnvironmentInfo(): EnvironmentInfo {
  if (typeof window === 'undefined') {
    return {}
  }

  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    screenWidth: screen.width,
    screenHeight: screen.height,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    online: navigator.onLine,
  }
}

/**
 * Get current page info
 */
export function getPageInfo(): { page: string; route: string } {
  if (typeof window === 'undefined') {
    return { page: 'server', route: 'server' }
  }

  return {
    page: window.location.href,
    route: window.location.pathname,
  }
}

/**
 * Serialize an error object
 */
export function serializeError(error: unknown): { name: string; message: string; stack?: string } {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    }
  }

  if (typeof error === 'string') {
    return {
      name: 'Error',
      message: error,
    }
  }

  return {
    name: 'UnknownError',
    message: String(error),
  }
}

/**
 * Determine severity based on error type
 */
export function determineSeverity(error: { name: string; message: string }): BugSeverity {
  const criticalPatterns = [
    /database/i,
    /authentication/i,
    /unauthorized/i,
    /payment/i,
    /security/i,
  ]

  const highPatterns = [
    /network/i,
    /fetch/i,
    /api/i,
    /supabase/i,
    /sms/i,
    /otp/i,
  ]

  const lowPatterns = [
    /abort/i,
    /cancel/i,
    /timeout/i,
  ]

  const errorText = `${error.name} ${error.message}`

  if (criticalPatterns.some(p => p.test(errorText))) return 'critical'
  if (highPatterns.some(p => p.test(errorText))) return 'high'
  if (lowPatterns.some(p => p.test(errorText))) return 'low'

  return 'medium'
}

/**
 * Send bug report to the API endpoint
 */
async function sendBugReport(payload: BugReportPayload): Promise<boolean> {
  try {
    const response = await fetch('/api/bug-report', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      console.error('[BugReporter] Failed to send report:', response.statusText)
      return false
    }

    const result = await response.json()
    console.log('[BugReporter] Report sent successfully:', result.reportId)
    return true
  } catch (sendError) {
    console.error('[BugReporter] Error sending report:', sendError)
    return false
  }
}

/**
 * Main function to report a bug
 */
export async function reportBug(
  error: unknown,
  action: string,
  options: {
    page?: string
    route?: string
    component?: string
    user?: UserContext
    environment?: EnvironmentInfo
    additionalData?: Record<string, unknown>
    severity?: BugSeverity
  } = {}
): Promise<string | null> {
  try {
    const serializedError = serializeError(error)
    const pageInfo = getPageInfo()

    const payload: BugReportPayload = {
      error: serializedError,
      action,
      page: options.page || pageInfo.page,
      route: options.route || pageInfo.route,
      component: options.component,
      user: options.user,
      environment: options.environment || getEnvironmentInfo(),
      additionalData: options.additionalData,
      severity: options.severity || determineSeverity(serializedError),
      timestamp: new Date().toISOString(),
      appVersion: APP_VERSION,
      reportId: generateReportId(),
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.group(`🐛 Bug Report: ${payload.reportId}`)
      console.error('Error:', serializedError)
      console.log('Action:', action)
      console.log('Page:', payload.page)
      console.log('User:', options.user)
      console.groupEnd()
    }

    // Send to API
    const success = await sendBugReport(payload)

    return success ? payload.reportId : null
  } catch (reportError) {
    console.error('[BugReporter] Critical error in reportBug:', reportError)
    return null
  }
}

/**
 * Create a bug reporter with pre-configured context
 */
export function createBugReporter(context: {
  component?: string
  getUser?: () => UserContext | undefined
}) {
  return async function report(
    error: unknown,
    action: string,
    additionalData?: Record<string, unknown>
  ): Promise<string | null> {
    return reportBug(error, action, {
      component: context.component,
      user: context.getUser?.(),
      additionalData,
    })
  }
}

// Re-export types
export type { BugReportData, BugReportPayload, BugSeverity, UserContext, EnvironmentInfo }

