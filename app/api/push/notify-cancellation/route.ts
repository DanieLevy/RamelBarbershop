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

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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
    const missingFields: string[] = []
    if (!reservationId) missingFields.push('reservationId')
    if (!barberId) missingFields.push('barberId')
    if (!cancelledBy) missingFields.push('cancelledBy')
    if (!customerName) missingFields.push('customerName')
    if (!serviceName) missingFields.push('serviceName')
    if (!appointmentTime) missingFields.push('appointmentTime')
    
    if (missingFields.length > 0) {
      console.log('[API notify-cancellation] Missing required fields:', missingFields)
      return NextResponse.json(
        { success: false, error: `Missing required fields: ${missingFields.join(', ')}` },
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
    
    // Validate UUIDs
    if (!UUID_REGEX.test(reservationId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid reservationId format' },
        { status: 400 }
      )
    }
    
    if (!UUID_REGEX.test(barberId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid barberId format' },
        { status: 400 }
      )
    }
    
    // When barber cancels, customerId is required to notify the customer
    if (cancelledBy === 'barber') {
      if (!customerId) {
        console.log('[API notify-cancellation] Barber cancelled but no customerId provided')
        return NextResponse.json(
          { success: false, error: 'customerId required when barber cancels' },
          { status: 400 }
        )
      }
      if (!UUID_REGEX.test(customerId)) {
        return NextResponse.json(
          { success: false, error: 'Invalid customerId format' },
          { status: 400 }
        )
      }
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
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

