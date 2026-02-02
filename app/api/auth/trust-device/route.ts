import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createTrustedDevice } from '@/lib/services/trusted-device.service'
import { reportServerError } from '@/lib/bug-reporter/helpers'

/**
 * Trust Device API
 * 
 * Creates a trusted device record after successful OTP verification.
 * Returns a device token to be stored in the browser.
 */

const trustDeviceSchema = z.object({
  customerId: z.string().uuid('מזהה לקוח לא תקין'),
  phone: z.string().min(9, 'מספר טלפון לא תקין').max(15),
})

export async function POST(request: NextRequest) {
  const requestId = `trust-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  
  try {
    const body = await request.json()
    const validation = trustDeviceSchema.safeParse(body)
    
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.issues[0]?.message || 'נתונים לא תקינים' },
        { status: 400 }
      )
    }
    
    const { customerId, phone } = validation.data
    
    // Get user agent from request
    const userAgent = request.headers.get('user-agent') || undefined
    
    console.log(`[${requestId}] Creating trusted device for phone: ${phone.slice(0, 3)}****${phone.slice(-2)}`)
    
    // Create the trusted device
    const deviceToken = await createTrustedDevice(customerId, phone, userAgent)
    
    if (!deviceToken) {
      console.log(`[${requestId}] Failed to create trusted device`)
      return NextResponse.json(
        { success: false, error: 'שגיאה ביצירת אימות מכשיר' },
        { status: 500 }
      )
    }
    
    console.log(`[${requestId}] Trusted device created successfully`)
    
    return NextResponse.json({
      success: true,
      deviceToken,
      message: 'המכשיר נרשם בהצלחה',
    })
    
  } catch (error) {
    console.error(`[${requestId}] Error creating trusted device:`, error)
    
    await reportServerError(error, 'POST /api/auth/trust-device', {
      route: '/api/auth/trust-device',
      severity: 'medium',
      additionalData: { requestId },
    })
    
    return NextResponse.json(
      { success: false, error: 'שגיאה ברישום המכשיר' },
      { status: 500 }
    )
  }
}
