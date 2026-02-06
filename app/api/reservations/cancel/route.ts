/**
 * API Route: Cancel Reservation
 * 
 * Server-side reservation cancellation.
 * Uses service_role to bypass RLS for secure reservation management.
 * Supports both customer and barber cancellations with optimistic locking.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { reportApiError } from '@/lib/bug-reporter/helpers'

// UUID validation
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface CancelRequest {
  reservationId: string
  cancelledBy: 'customer' | 'barber' | 'system'
  reason?: string
  expectedVersion?: number
}

export async function POST(request: NextRequest) {
  try {
    const body: CancelRequest = await request.json()
    
    // Validate input
    if (!body.reservationId || !UUID_REGEX.test(body.reservationId)) {
      return NextResponse.json(
        { success: false, error: 'מזהה תור לא תקין' },
        { status: 400 }
      )
    }
    
    if (!['customer', 'barber', 'system'].includes(body.cancelledBy)) {
      return NextResponse.json(
        { success: false, error: 'סוג מבטל לא תקין' },
        { status: 400 }
      )
    }
    
    const supabase = createAdminClient()
    
    // Build update query with optimistic locking if version provided
    let query = supabase
      .from('reservations')
      .update({
        status: 'cancelled',
        cancelled_by: body.cancelledBy,
        cancellation_reason: body.reason || null,
      })
      .eq('id', body.reservationId)
      .eq('status', 'confirmed') // Only cancel if still confirmed
    
    // Add version check for optimistic locking
    if (body.expectedVersion !== undefined) {
      query = query.eq('version', body.expectedVersion)
    }
    
    const { data, error } = await query.select('id, status, version')
    
    if (error) {
      console.error('[API/Cancel] Database error:', error)
      
      // Report database errors with full request context
      await reportApiError(
        new Error(error.message),
        request,
        'Database Error during cancellation',
        {
          severity: 'high',
          additionalData: {
            errorCode: error.code,
            reservationId: body.reservationId,
            cancelledBy: body.cancelledBy,
          }
        }
      )
      
      return NextResponse.json(
        { success: false, error: 'שגיאה בביטול התור' },
        { status: 500 }
      )
    }
    
    if (!data || data.length === 0) {
      // No rows updated - either already cancelled or version mismatch
      console.warn('[API/Cancel] Cancel failed - concurrent modification or already cancelled')
      return NextResponse.json(
        { 
          success: false, 
          error: 'התור כבר בוטל או עודכן על ידי אחר',
          concurrencyConflict: true 
        },
        { status: 409 }
      )
    }
    
    console.log('[API/Cancel] Reservation cancelled:', body.reservationId)
    
    return NextResponse.json({
      success: true,
      reservation: data[0]
    })
    
  } catch (err) {
    console.error('[API/Cancel] Unexpected error:', err)
    
    // Report unexpected errors with full request context
    await reportApiError(
      err instanceof Error ? err : new Error(String(err)),
      request,
      'Unexpected Error during cancellation',
      { severity: 'critical' }
    )
    
    return NextResponse.json(
      { success: false, error: 'שגיאה בלתי צפויה' },
      { status: 500 }
    )
  }
}
