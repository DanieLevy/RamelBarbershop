/**
 * API Route: Notify Barber of New Booking
 * 
 * Called after a customer books an appointment to notify the barber.
 */

import { NextRequest, NextResponse } from 'next/server'
import { pushService } from '@/lib/push/push-service'
import type { ReminderContext } from '@/lib/push/types'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const { 
      reservationId, 
      customerId, 
      barberId, 
      customerName, 
      barberName, 
      serviceName, 
      appointmentTime 
    } = body
    
    // Validate required fields
    if (!reservationId || !barberId || !customerName || !serviceName || !appointmentTime) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }
    
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
    
    return NextResponse.json({
      success: result.success,
      sent: result.sent,
      failed: result.failed,
      errors: result.errors
    })
  } catch (error) {
    console.error('[API] Error in notify-booking:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

