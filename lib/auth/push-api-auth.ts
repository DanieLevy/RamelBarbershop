/**
 * Push Notification API Authentication Helper
 * 
 * Provides authentication for push notification API routes.
 * Supports two authentication methods:
 * 
 * 1. User verification: Validates that customerId/barberId in the request
 *    corresponds to a real user in the database.
 * 
 * 2. Internal call verification: Validates X-Internal-Secret header
 *    for server-to-server calls between API routes.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

// ============================================================
// Types
// ============================================================

export interface PushAuthSuccess {
  success: true
  userId: string
  userType: 'customer' | 'barber'
}

export interface PushAuthInternalSuccess {
  success: true
  internal: true
}

export interface PushAuthFailure {
  success: false
  response: NextResponse
}

export type PushCallerResult = PushAuthSuccess | PushAuthFailure
export type PushCallerOrInternalResult = PushAuthSuccess | PushAuthInternalSuccess | PushAuthFailure

// ============================================================
// Constants
// ============================================================

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ============================================================
// Internal Secret Verification
// ============================================================

/**
 * Verify that the request comes from an internal API route
 * by checking the X-Internal-Secret header.
 */
export const verifyInternalCall = (request: Request): boolean => {
  const secret = process.env.INTERNAL_API_SECRET
  if (!secret) {
    console.warn('[PushAuth] INTERNAL_API_SECRET not configured')
    return false
  }

  const headerSecret = request.headers.get('X-Internal-Secret')
  return headerSecret === secret
}

// ============================================================
// User Verification
// ============================================================

/**
 * Extract customerId and barberId from request.
 * Supports both JSON body and query params.
 */
const extractUserIds = async (
  request: Request,
  body?: Record<string, unknown>
): Promise<{ customerId?: string; barberId?: string }> => {
  // Try from provided body
  if (body) {
    return {
      customerId: typeof body.customerId === 'string' ? body.customerId : undefined,
      barberId: typeof body.barberId === 'string' ? body.barberId : undefined,
    }
  }

  // Try from query params (for GET requests)
  const url = new URL(request.url)
  return {
    customerId: url.searchParams.get('customerId') || undefined,
    barberId: url.searchParams.get('barberId') || undefined,
  }
}

/**
 * Verify that the request comes from a legitimate user
 * by checking that the provided customerId or barberId exists in the database.
 * 
 * @param request - The incoming request
 * @param body - Optional pre-parsed body (to avoid double-parsing)
 */
export const verifyPushCaller = async (
  request: Request,
  body?: Record<string, unknown>
): Promise<PushCallerResult> => {
  const { customerId, barberId } = await extractUserIds(request, body)

  if (!customerId && !barberId) {
    return {
      success: false,
      response: NextResponse.json(
        { success: false, error: 'Either customerId or barberId is required' },
        { status: 401 }
      ),
    }
  }

  try {
    const supabase = createAdminClient()

    if (customerId) {
      if (!UUID_REGEX.test(customerId)) {
        return {
          success: false,
          response: NextResponse.json(
            { success: false, error: 'Invalid customerId format' },
            { status: 400 }
          ),
        }
      }

      const { data, error } = await supabase
        .from('customers')
        .select('id')
        .eq('id', customerId)
        .maybeSingle()

      if (error || !data) {
        return {
          success: false,
          response: NextResponse.json(
            { success: false, error: 'Customer not found' },
            { status: 401 }
          ),
        }
      }

      return { success: true, userId: customerId, userType: 'customer' }
    }

    if (barberId) {
      if (!UUID_REGEX.test(barberId)) {
        return {
          success: false,
          response: NextResponse.json(
            { success: false, error: 'Invalid barberId format' },
            { status: 400 }
          ),
        }
      }

      const { data, error } = await supabase
        .from('users')
        .select('id')
        .eq('id', barberId)
        .eq('is_barber', true)
        .maybeSingle()

      if (error || !data) {
        return {
          success: false,
          response: NextResponse.json(
            { success: false, error: 'Barber not found' },
            { status: 401 }
          ),
        }
      }

      return { success: true, userId: barberId, userType: 'barber' }
    }

    // Should not reach here, but handle gracefully
    return {
      success: false,
      response: NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      ),
    }
  } catch (err) {
    console.error('[PushAuth] Verification error:', err)
    return {
      success: false,
      response: NextResponse.json(
        { success: false, error: 'Authentication service error' },
        { status: 500 }
      ),
    }
  }
}

/**
 * Verify that the request comes from either:
 * 1. A legitimate user (customer/barber verified in DB), OR
 * 2. An internal API route (via X-Internal-Secret header)
 * 
 * Used for routes that can be called both from client and server.
 */
export const verifyPushCallerOrInternal = async (
  request: Request,
  body?: Record<string, unknown>
): Promise<PushCallerOrInternalResult> => {
  // Check internal secret first (cheaper than DB lookup)
  if (verifyInternalCall(request)) {
    return { success: true, internal: true }
  }

  // Fall back to user verification
  return verifyPushCaller(request, body)
}
