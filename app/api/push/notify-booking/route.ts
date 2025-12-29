/**
 * API Route: Notify Barber of New Booking
 * 
 * Called after a customer books an appointment to notify the barber.
 */

import { NextRequest, NextResponse } from 'next/server'
import { pushService } from '@/lib/push/push-service'
import type { ReminderContext } from '@/lib/push/types'

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
      customerName, 
      barberName, 
      serviceName, 
      appointmentTime 
    } = body
    
    // Validate required fields - ALL bookings require login, so customerId is required
    const missingFields: string[] = []
    if (!reservationId) missingFields.push('reservationId')
    if (!customerId) missingFields.push('customerId')  // Required - no guest bookings
    if (!barberId) missingFields.push('barberId')
    if (!customerName) missingFields.push('customerName')
    if (!serviceName) missingFields.push('serviceName')
    if (!appointmentTime) missingFields.push('appointmentTime')
    
    if (missingFields.length > 0) {
      console.log('[API notify-booking] Missing required fields:', missingFields)
      return NextResponse.json(
        { success: false, error: `Missing required fields: ${missingFields.join(', ')}` },
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
    
    if (!UUID_REGEX.test(customerId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid customerId format' },
        { status: 400 }
      )
    }
    
    if (!UUID_REGEX.test(barberId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid barberId format' },
        { status: 400 }
      )
    }
    
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
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

