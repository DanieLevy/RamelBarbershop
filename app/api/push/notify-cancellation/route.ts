/**
 * API Route: Notify of Cancellation
 * 
 * Called when a reservation is cancelled to notify the appropriate party.
 * - If cancelled by customer → notify barber
 * - If cancelled by barber → notify customer
 */

import { NextRequest, NextResponse } from 'next/server'
import { pushService } from '@/lib/push/push-service'
import { validateRequestBody, NotifyCancellationSchema } from '@/lib/validation/api-schemas'
import type { CancellationContext } from '@/lib/push/types'
import { reportApiError } from '@/lib/bug-reporter/helpers'
import { verifyPushCallerOrInternal } from '@/lib/auth/push-api-auth'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    // Validate request body using Zod schema
    const validation = await validateRequestBody(request, NotifyCancellationSchema)
    
    if (!validation.success) {
      return validation.response
    }
    
    const { 
      reservationId, 
      customerId, 
      barberId, 
      cancelledBy,
      customerName, 
      barberName, 
      serviceName, 
      appointmentTime,
      reason
    } = validation.data
    
    // Verify caller is a legitimate user or internal API call
    const auth = await verifyPushCallerOrInternal(request, { customerId, barberId })
    if (!auth.success) return auth.response

    // When barber cancels, customerId is required to notify the customer
    if (cancelledBy === 'barber' && !customerId) {
      console.log('[API notify-cancellation] Barber cancelled but no customerId provided')
      return NextResponse.json(
        { success: false, error: 'customerId required when barber cancels' },
        { status: 400 }
      )
    }
    
    const context: CancellationContext = {
      reservationId,
      customerId: customerId || '',
      barberId,
      cancelledBy,
      customerName,
      barberName: barberName || 'הספר',
      serviceName,
      appointmentTime,
      reason
    }
    
    console.log('[API notify-cancellation] Sending cancellation notification:', {
      type: 'cancellation',
      cancelledBy,
      recipientType: cancelledBy === 'customer' ? 'barber' : 'customer',
      recipientId: cancelledBy === 'customer' ? barberId : customerId
    })
    
    const result = await pushService.sendCancellationAlert(context)
    
    return NextResponse.json({
      success: result.success,
      sent: result.sent,
      failed: result.failed,
      errors: result.errors
    })
  } catch (error) {
    console.error('[API] Error in notify-cancellation:', error)
    await reportApiError(error, request, 'Notify cancellation failed', {
      severity: 'high',
    })
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
