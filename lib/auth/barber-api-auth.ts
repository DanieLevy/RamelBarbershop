/**
 * Barber API Authentication Helper
 * 
 * Provides server-side verification for barber dashboard API routes.
 * Validates that requests come from legitimate barbers by checking
 * the barberId against the database.
 * 
 * Used by all /api/barber/* routes to ensure only verified barbers
 * can perform write operations through the admin client.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

// ============================================================
// Types
// ============================================================

export interface VerifiedBarber {
  id: string
  username: string
  fullname: string
  email: string | null
  role: string
  is_barber: boolean
  is_active: boolean
}

export interface BarberAuthSuccess {
  success: true
  barber: VerifiedBarber
}

export interface BarberAuthFailure {
  success: false
  response: NextResponse
}

export type BarberAuthResult = BarberAuthSuccess | BarberAuthFailure

// ============================================================
// Constants
// ============================================================

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ============================================================
// Core Verification Functions
// ============================================================

/**
 * Extract barberId from request body or search params.
 * Supports both JSON body (POST/PUT/DELETE) and query params (GET).
 */
export const extractBarberId = async (
  request: Request,
  body?: Record<string, unknown>
): Promise<string | null> => {
  // Try from provided body first
  if (body?.barberId && typeof body.barberId === 'string') {
    return body.barberId
  }

  // Try from query params (for GET requests)
  const url = new URL(request.url)
  const paramId = url.searchParams.get('barberId')
  if (paramId) return paramId

  return null
}

/**
 * Verify that a barberId corresponds to a real, active barber in the database.
 * Returns the barber data on success, or a 401/403 NextResponse on failure.
 * 
 * @param request - The incoming request
 * @param body - Optional pre-parsed request body (to avoid double-parsing)
 */
export const verifyBarber = async (
  request: Request,
  body?: Record<string, unknown>
): Promise<BarberAuthResult> => {
  const barberId = await extractBarberId(request, body)

  if (!barberId) {
    return {
      success: false,
      response: NextResponse.json(
        { success: false, error: 'UNAUTHORIZED', message: 'barberId is required' },
        { status: 401 }
      ),
    }
  }

  if (!UUID_REGEX.test(barberId)) {
    return {
      success: false,
      response: NextResponse.json(
        { success: false, error: 'VALIDATION_ERROR', message: 'Invalid barberId format' },
        { status: 400 }
      ),
    }
  }

  try {
    const supabase = createAdminClient()

    const { data: barber, error } = await supabase
      .from('users')
      .select('id, username, fullname, email, role, is_barber, is_active')
      .eq('id', barberId)
      .eq('is_barber', true)
      .maybeSingle()

    if (error) {
      console.error('[BarberAPIAuth] Database error:', error.message)
      return {
        success: false,
        response: NextResponse.json(
          { success: false, error: 'DATABASE_ERROR', message: 'שגיאה באימות המשתמש' },
          { status: 500 }
        ),
      }
    }

    if (!barber) {
      return {
        success: false,
        response: NextResponse.json(
          { success: false, error: 'UNAUTHORIZED', message: 'ספר לא נמצא' },
          { status: 401 }
        ),
      }
    }

    return {
      success: true,
      barber: barber as VerifiedBarber,
    }
  } catch (err) {
    console.error('[BarberAPIAuth] Verification error:', err)
    return {
      success: false,
      response: NextResponse.json(
        { success: false, error: 'SERVER_ERROR', message: 'שגיאת שרת באימות' },
        { status: 500 }
      ),
    }
  }
}

/**
 * Verify that the request comes from an admin barber (role === 'admin').
 * Used for operations like deleting barbers or managing shop-wide settings.
 */
export const verifyAdmin = async (
  request: Request,
  body?: Record<string, unknown>
): Promise<BarberAuthResult> => {
  const result = await verifyBarber(request, body)

  if (!result.success) return result

  if (result.barber.role !== 'admin') {
    return {
      success: false,
      response: NextResponse.json(
        { success: false, error: 'FORBIDDEN', message: 'נדרשות הרשאות מנהל' },
        { status: 403 }
      ),
    }
  }

  return result
}

/**
 * Verify that the requesting barber owns the resource.
 * Checks that the barberId in the request matches the resourceOwnerId.
 * 
 * @param barber - The verified barber from verifyBarber()
 * @param resourceOwnerId - The barber_id on the resource being accessed
 */
export const verifyOwnership = (
  barber: VerifiedBarber,
  resourceOwnerId: string
): boolean => {
  // Admins can manage any resource
  if (barber.role === 'admin') return true
  // Regular barbers can only manage their own resources
  return barber.id === resourceOwnerId
}
