/**
 * API Route: Notify Barber of New Booking
 * 
 * Called after a customer books an appointment to notify the barber.
 */

import { NextRequest, NextResponse } from 'next/server'
import { pushService } from '@/lib/push/push-service'
import { validateRequestBody, NotifyBookingSchema } from '@/lib/validation/api-schemas'
import type { ReminderContext } from '@/lib/push/types'
import { reportApiError } from '@/lib/bug-reporter/helpers'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    // Validate request body using Zod schema
    const validation = await validateRequestBody(request, NotifyBookingSchema)
    
    if (!validation.success) {
      return validation.response
    }
    
    const { 
      reservationId, 
      customerId, 
      barberId, 
      customerName, 
      barberName, 
      serviceName, 
      appointmentTime 
    } = validation.data
    
    console.log('[API notify-booking] Sending notification:', {
      reservationId,
      barberId,
      customerName
    })
    
    const context: ReminderContext = {
      reservationId,
      customerId: customerId || '',
      barberId,
      customerName,
      barberName: barberName || 'הספר',
      serviceName,
      appointmentTime
    }
    
    const result = await pushService.sendBookingConfirmed(context)
    
    console.log('[API notify-booking] Result:', result)
    
    return NextResponse.json({
      success: result.success,
      sent: result.sent,
      failed: result.failed,
      errors: result.errors
    })
  } catch (error) {
    console.error('[API notify-booking] Error:', error)
    await reportApiError(error, request, 'Notify booking failed', {
      severity: 'high',
    })
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
