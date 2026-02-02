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
  // On server, we can't use the API route, so we send directly
  try {
    const serialized = serializeError(error)

    // For server-side, we log extensively
    console.error('[ServerError]', {
      action,
      error: serialized,
      route: options.route,
      user: options.user,
      additionalData: options.additionalData,
      timestamp: new Date().toISOString(),
    })

    // If we have Resend configured, we could send directly here
    // For now, we just return the error info
    const reportId = `SERVER-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`.toUpperCase()

    return reportId
  } catch (reportError) {
    console.error('[ServerError] Failed to report:', reportError)
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

