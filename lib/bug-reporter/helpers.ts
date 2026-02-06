/**
 * Bug Reporter Helper Functions
 * 
 * Easy-to-use utilities for integrating bug reporting across the app
 */

import { reportBug, getEnvironmentInfo, serializeError, type UserContext, type BugSeverity } from './index'

/**
 * Wrapper function that adds error reporting to async functions
 * 
 * @example
 * const fetchData = withErrorReporting(
 *   async () => {
 *     const response = await fetch('/api/data')
 *     return response.json()
 *   },
 *   'Fetching user data',
 *   { component: 'UserProfile' }
 * )
 */
export function withErrorReporting<T extends unknown[], R>(
  fn: (...args: T) => Promise<R>,
  action: string,
  options: {
    component?: string
    getUser?: () => UserContext | undefined
    severity?: BugSeverity
    additionalData?: Record<string, unknown>
    rethrow?: boolean
  } = {}
): (...args: T) => Promise<R | null> {
  return async (...args: T): Promise<R | null> => {
    try {
      return await fn(...args)
    } catch (error) {
      await reportBug(error, action, {
        component: options.component,
        user: options.getUser?.(),
        environment: getEnvironmentInfo(),
        severity: options.severity,
        additionalData: {
          ...options.additionalData,
          arguments: args.map((arg, i) => ({
            index: i,
            type: typeof arg,
            value: typeof arg === 'object' ? '[Object]' : String(arg).substring(0, 100),
          })),
        },
      })

      if (options.rethrow) {
        throw error
      }

      return null
    }
  }
}

/**
 * Safe try-catch wrapper with automatic error reporting
 * 
 * @example
 * const result = await trySafe(
 *   () => riskyOperation(),
 *   'Performing risky operation',
 *   { component: 'RiskyComponent' }
 * )
 * 
 * if (result.success) {
 *   console.log(result.data)
 * } else {
 *   console.log('Failed:', result.error)
 * }
 */
export async function trySafe<T>(
  fn: () => Promise<T> | T,
  action: string,
  options: {
    component?: string
    user?: UserContext
    severity?: BugSeverity
    additionalData?: Record<string, unknown>
    silent?: boolean
  } = {}
): Promise<{ success: true; data: T } | { success: false; error: string; reportId: string | null }> {
  try {
    const data = await fn()
    return { success: true, data }
  } catch (error) {
    const serialized = serializeError(error)

    let reportId: string | null = null

    if (!options.silent) {
      reportId = await reportBug(error, action, {
        component: options.component,
        user: options.user,
        environment: getEnvironmentInfo(),
        severity: options.severity,
        additionalData: options.additionalData,
      })
    }

    return {
      success: false,
      error: serialized.message,
      reportId,
    }
  }
}

/**
 * Client-side error reporter hook helper
 * Returns a function that can be called to report errors
 * 
 * @example
 * // In a component
 * const report = useClientReporter('UserProfile')
 * 
 * const handleSubmit = async () => {
 *   try {
 *     await submitForm()
 *   } catch (error) {
 *     report(error, 'Submitting user profile form')
 *   }
 * }
 */
export function createClientReporter(
  component: string,
  getUser?: () => UserContext | undefined
) {
  return async function report(
    error: unknown,
    action: string,
    additionalData?: Record<string, unknown>
  ): Promise<string | null> {
    return reportBug(error, action, {
      component,
      user: getUser?.(),
      environment: getEnvironmentInfo(),
      additionalData,
    })
  }
}

/**
 * Server-side error reporter
 * For use in API routes and server actions
 * Now actually sends email reports via Resend
 * 
 * @example
 * // In an API route
 * export async function POST(request: Request) {
 *   try {
 *     // ... handler logic
 *   } catch (error) {
 *     await reportServerError(error, 'POST /api/reservations', {
 *       route: '/api/reservations',
 *       additionalData: { body: await request.json() }
 *     })
 *     return Response.json({ error: 'Server error' }, { status: 500 })
 *   }
 * }
 */
export async function reportServerError(
  error: unknown,
  action: string,
  options: {
    route?: string
    user?: UserContext
    severity?: BugSeverity
    additionalData?: Record<string, unknown>
  } = {}
): Promise<string | null> {
  try {
    const serialized = serializeError(error)
    const reportId = `SERVER-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`.toUpperCase()
    const timestamp = new Date().toISOString()

    // Always log to console with structured format
    console.error('[ServerError]', JSON.stringify({
      reportId,
      action,
      error: serialized,
      route: options.route,
      user: options.user,
      severity: options.severity || 'high',
      additionalData: options.additionalData,
      timestamp,
    }, null, 2))

    // Try to send email via internal API call (works in Edge/Node runtime)
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL 
        ? `https://${process.env.VERCEL_URL}`
        : 'http://localhost:3000'
      
      const payload = {
        error: serialized,
        action: `[SERVER] ${action}`,
        page: options.route || 'server',
        route: options.route,
        user: options.user,
        severity: options.severity || 'high',
        additionalData: {
          ...options.additionalData,
          source: 'server',
          runtime: typeof globalThis !== 'undefined' && 'EdgeRuntime' in globalThis ? 'edge' : 'nodejs',
        },
        timestamp,
        appVersion: process.env.NEXT_PUBLIC_APP_VERSION || '2.0.0',
        reportId,
      }
      
      // Fire and forget - don't block on email
      fetch(`${baseUrl}/api/bug-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch(emailErr => {
        console.error('[ServerError] Failed to send email report:', emailErr)
      })
    } catch (emailError) {
      // Don't fail if email sending fails
      console.error('[ServerError] Email setup error:', emailError)
    }

    return reportId
  } catch (reportError) {
    console.error('[ServerError] Failed to report:', reportError)
    return null
  }
}

/**
 * API Route error reporter with request context
 * Captures HTTP method, path, headers, and sanitized body for debugging
 * 
 * @example
 * export async function POST(request: NextRequest) {
 *   try {
 *     // ... handler logic
 *   } catch (error) {
 *     await reportApiError(error, request, 'Creating reservation')
 *     return Response.json({ error: 'Server error' }, { status: 500 })
 *   }
 * }
 */
export async function reportApiError(
  error: unknown,
  request: Request,
  action: string,
  options: {
    user?: UserContext
    severity?: BugSeverity
    additionalData?: Record<string, unknown>
    includeBody?: boolean
  } = {}
): Promise<string | null> {
  try {
    // Extract request context
    const url = new URL(request.url)
    const method = request.method
    const route = url.pathname
    
    // Get safe headers (exclude sensitive ones)
    const safeHeaders: Record<string, string> = {}
    const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key', 'api-key']
    request.headers.forEach((value, key) => {
      if (!sensitiveHeaders.includes(key.toLowerCase())) {
        safeHeaders[key] = value
      }
    })

    // Try to get body if requested and not already consumed
    let bodyData: Record<string, unknown> | string | null = null
    if (options.includeBody && request.bodyUsed === false) {
      try {
        const clonedRequest = request.clone()
        const contentType = request.headers.get('content-type') || ''
        if (contentType.includes('application/json')) {
          bodyData = await clonedRequest.json()
          // Sanitize sensitive fields
          if (typeof bodyData === 'object' && bodyData !== null) {
            const sensitiveFields = ['password', 'token', 'secret', 'otp', 'pin', 'auth']
            for (const field of sensitiveFields) {
              if (field in bodyData) {
                (bodyData as Record<string, unknown>)[field] = '[REDACTED]'
              }
            }
          }
        }
      } catch {
        bodyData = '[Could not parse body]'
      }
    }

    const requestContext = {
      method,
      route,
      url: url.toString(),
      headers: safeHeaders,
      body: bodyData,
      query: Object.fromEntries(url.searchParams),
    }

    return reportServerError(error, `${method} ${route}: ${action}`, {
      route,
      user: options.user,
      severity: options.severity || 'high',
      additionalData: {
        ...options.additionalData,
        request: requestContext,
      },
    })
  } catch (reportError) {
    console.error('[reportApiError] Failed to report:', reportError)
    return null
  }
}

/**
 * Create a form submission error handler
 * 
 * @example
 * const handleError = createFormErrorHandler('ContactForm', getUser)
 * 
 * const onSubmit = async (data: FormData) => {
 *   try {
 *     await submitForm(data)
 *   } catch (error) {
 *     handleError(error, data)
 *   }
 * }
 */
export function createFormErrorHandler(
  formName: string,
  getUser?: () => UserContext | undefined
) {
  return async function handleError(
    error: unknown,
    formData?: Record<string, unknown>
  ): Promise<string | null> {
    // Sanitize form data - remove sensitive fields
    const sanitizedData = formData
      ? Object.fromEntries(
          Object.entries(formData).filter(
            ([key]) => !['password', 'token', 'secret', 'pin', 'otp'].includes(key.toLowerCase())
          )
        )
      : undefined

    return reportBug(error, `Form submission failed: ${formName}`, {
      component: formName,
      user: getUser?.(),
      environment: getEnvironmentInfo(),
      additionalData: {
        formName,
        formData: sanitizedData,
      },
      severity: 'high',
    })
  }
}

/**
 * Supabase error handler
 * Specifically for handling Supabase database errors
 */
export async function reportSupabaseError(
  error: { message: string; code?: string; details?: string; hint?: string },
  action: string,
  options: {
    table?: string
    operation?: 'select' | 'insert' | 'update' | 'delete' | 'rpc'
    user?: UserContext
  } = {}
): Promise<string | null> {
  return reportBug(
    new Error(error.message),
    action,
    {
      severity: 'high',
      user: options.user,
      environment: getEnvironmentInfo(),
      additionalData: {
        supabaseError: {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        },
        table: options.table,
        operation: options.operation,
      },
    }
  )
}

/**
 * SMS Provider error handler
 * For handling SMS OTP authentication errors from any provider
 * 
 * Note: Previously named reportFirebaseError, renamed for clarity
 * as Firebase has been removed and replaced with a generic SMS provider.
 */
export async function reportSmsAuthError(
  error: { code?: string; message: string },
  action: string,
  options: {
    user?: UserContext
    phone?: string
  } = {}
): Promise<string | null> {
  return reportBug(
    new Error(error.message),
    action,
    {
      severity: 'high',
      user: options.user,
      environment: getEnvironmentInfo(),
      additionalData: {
        smsError: {
          code: error.code,
          message: error.message,
        },
        // Don't log full phone number for privacy
        phonePrefix: options.phone?.substring(0, 6),
      },
    }
  )
}

/**
 * @deprecated Use reportSmsAuthError instead
 */
export const reportFirebaseError = reportSmsAuthError

