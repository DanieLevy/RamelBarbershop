/**
 * API Route: Request Cancellation from Barber
 * 
 * Called when a customer is blocked from cancelling (within cancel policy window)
 * and wants to request the barber to cancel on their behalf.
 * 
 * - Sends push notification to barber
 * - Logs the request in reservation notes
 * - Tracks the request in notification logs
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { pushService } from '@/lib/push/push-service'
import { reportApiError } from '@/lib/bug-reporter/helpers'

export const dynamic = 'force-dynamic'

// Initialize Supabase admin client (bypasses RLS for write operations)
const supabase = createAdminClient()

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      reservationId, 
      barberId, 
      customerId, 
      customerName, 
      serviceName, 
      appointmentTime 
    } = body

    // Validate required fields
    if (!reservationId || !barberId || !customerName || !appointmentTime) {
      console.error('[Request Cancel] Missing required fields:', { reservationId, barberId, customerName, appointmentTime })
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    console.log('[Request Cancel] Processing request:', {
      reservationId,
      barberId,
      customerName,
      serviceName
    })

    // Send notification using pushService (includes retry logic, logging, error handling)
    const result = await pushService.sendCancelRequest({
      reservationId,
      barberId,
      customerId: customerId || '',
      customerName,
      serviceName: serviceName || 'התור',
      appointmentTime
    })

    console.log('[Request Cancel] Push result:', result)

    // Log the cancel request to reservation notes (for barber visibility)
    await logCancelRequestToReservation(reservationId, customerName, result.success)

    // Return result
    if (!result.success && result.sent === 0) {
      // No subscriptions or all failed
      const noSubs = result.errors.some(e => e.includes('No active subscriptions'))
      
      return NextResponse.json({
        success: true, // Request was logged even if notification failed
        message: noSubs 
          ? 'Request logged, but barber has no push notifications enabled'
          : 'Request logged, but notification delivery failed',
        notificationSent: false,
        logId: result.logId
      })
    }

    return NextResponse.json({
      success: true,
      message: `Cancel request sent to ${result.sent} device(s)`,
      notificationSent: result.sent > 0,
      devicesTargeted: result.sent + result.failed,
      devicesSucceeded: result.sent,
      devicesFailed: result.failed,
      logId: result.logId
    })
  } catch (error) {
    console.error('[Request Cancel] Error:', error)
    await reportApiError(error, request, 'Request cancel failed', {
      severity: 'high',
    })
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * Log cancel request to reservation notes for barber visibility
 * This provides an audit trail even if push fails
 */
async function logCancelRequestToReservation(
  reservationId: string,
  customerName: string,
  notificationSent: boolean
): Promise<void> {
  try {
    // Get current notes
    const { data: reservation, error: fetchError } = await supabase
      .from('reservations')
      .select('barber_notes')
      .eq('id', reservationId)
      .single()

    if (fetchError) {
      console.error('[Request Cancel] Error fetching reservation:', fetchError)
      return
    }
    
    const existingNotes = reservation?.barber_notes || ''
    const timestamp = new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' })
    const status = notificationSent ? '✓' : '⚠️ (ללא התראה)'
    const newNote = `[${timestamp}] ${status} בקשת ביטול מ${customerName}`
    const updatedNotes = existingNotes ? `${existingNotes}\n${newNote}` : newNote
    
    // Update with the new note appended
    const { error: updateError } = await supabase
      .from('reservations')
      .update({ barber_notes: updatedNotes })
      .eq('id', reservationId)

    if (updateError) {
      console.error('[Request Cancel] Error updating reservation notes:', updateError)
    } else {
      console.log('[Request Cancel] Logged cancel request to reservation notes')
    }
  } catch (err) {
    console.error('[Request Cancel] Error logging cancel request:', err)
    // Don't throw - this is non-critical
  }
}
