/**
 * API Route: Notify of Cancellation
 * 
 * Called when a reservation is cancelled to notify the appropriate party.
 * - If cancelled by customer → notify barber
 * - If cancelled by barber → notify customer
 */

import { NextRequest, NextResponse } from 'next/server'
import { pushService } from '@/lib/push/push-service'
import type { CancellationContext } from '@/lib/push/types'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
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
    } = body
    
    // Validate required fields
    if (!reservationId || !barberId || !cancelledBy || !customerName || !serviceName || !appointmentTime) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }
    
    // Validate cancelledBy
    if (cancelledBy !== 'customer' && cancelledBy !== 'barber') {
      return NextResponse.json(
        { success: false, error: 'Invalid cancelledBy value' },
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
    
    const result = await pushService.sendCancellationAlert(context)
    
    return NextResponse.json({
      success: result.success,
      sent: result.sent,
      failed: result.failed,
      errors: result.errors
    })
  } catch (error) {
    console.error('[API] Error in notify-cancellation:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

