'use client'

import { useCallback } from 'react'
import { reportBug, getEnvironmentInfo, type UserContext, type BugSeverity } from '@/lib/bug-reporter'
import { useAuthStore } from '@/store/useAuthStore'
import { useBarberAuthStore } from '@/store/useBarberAuthStore'
import { usePathname } from 'next/navigation'

/**
 * React hook for bug reporting with automatic user context
 * 
 * @example
 * function MyComponent() {
 *   const { report, reportWithData } = useBugReporter('MyComponent')
 *   
 *   const handleSubmit = async () => {
 *     try {
 *       await submitData()
 *     } catch (error) {
 *       await report(error, 'Submitting form data')
 *     }
 *   }
 * }
 */
export function useBugReporter(component?: string) {
  const pathname = usePathname()
  const { customer, isLoggedIn: isCustomerLoggedIn } = useAuthStore()
  const { barber, isLoggedIn: isBarberLoggedIn } = useBarberAuthStore()

  /**
   * Get current user context
   */
  const getUserContext = useCallback((): UserContext | undefined => {
    if (isBarberLoggedIn && barber) {
      return {
        type: barber.role === 'admin' ? 'admin' : 'barber',
        id: barber.id,
        name: barber.fullname,
        email: barber.email || undefined,
        phone: barber.phone || undefined,
      }
    }

    if (isCustomerLoggedIn && customer) {
      return {
        type: 'customer',
        id: customer.id,
        name: customer.fullname,
        phone: customer.phone,
      }
    }

    return {
      type: 'guest',
    }
  }, [isBarberLoggedIn, barber, isCustomerLoggedIn, customer])

  /**
   * Report an error
   */
  const report = useCallback(
    async (
      error: unknown,
      action: string,
      severity?: BugSeverity
    ): Promise<string | null> => {
      return reportBug(error, action, {
        component,
        route: pathname,
        user: getUserContext(),
        environment: getEnvironmentInfo(),
        severity,
      })
    },
    [component, pathname, getUserContext]
  )

  /**
   * Report an error with additional data
   */
  const reportWithData = useCallback(
    async (
      error: unknown,
      action: string,
      additionalData: Record<string, unknown>,
      severity?: BugSeverity
    ): Promise<string | null> => {
      return reportBug(error, action, {
        component,
        route: pathname,
        user: getUserContext(),
        environment: getEnvironmentInfo(),
        additionalData,
        severity,
      })
    },
    [component, pathname, getUserContext]
  )

  /**
   * Wrap an async function with error reporting
   */
  const wrapAsync = useCallback(
    <T>(
      fn: () => Promise<T>,
      action: string,
      options: { severity?: BugSeverity; additionalData?: Record<string, unknown> } = {}
    ): Promise<T | null> => {
      return fn().catch(async (error) => {
        await reportBug(error, action, {
          component,
          route: pathname,
          user: getUserContext(),
          environment: getEnvironmentInfo(),
          severity: options.severity,
          additionalData: options.additionalData,
        })
        return null
      })
    },
    [component, pathname, getUserContext]
  )

  return {
    report,
    reportWithData,
    wrapAsync,
    getUserContext,
  }
}

export default useBugReporter

