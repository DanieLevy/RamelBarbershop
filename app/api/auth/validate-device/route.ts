import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { validateTrustedDevice, extendDeviceExpiration } from '@/lib/services/trusted-device.service'
import { reportServerError } from '@/lib/bug-reporter/helpers'

/**
 * Validate Device API
 * 
 * Checks if a device token is valid for a given phone number.
 * If valid, returns the customer data for automatic login.
 * Also extends the device expiration on successful validation.
 */

const validateDeviceSchema = z.object({
  phone: z.string().min(9, 'מספר טלפון לא תקין').max(15),
  deviceToken: z.string().min(10, 'טוקן לא תקין'),
})

export async function POST(request: NextRequest) {
  const requestId = `validate-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  
  try {
    const body = await request.json()
    const validation = validateDeviceSchema.safeParse(body)
    
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.issues[0]?.message || 'נתונים לא תקינים' },
        { status: 400 }
      )
    }
    
    const { phone, deviceToken } = validation.data
    
    console.log(`[${requestId}] Validating device for phone: ${phone.slice(0, 3)}****${phone.slice(-2)}`)
    
    // Validate the device
    const result = await validateTrustedDevice(phone, deviceToken)
    
    if (!result.isValid) {
      console.log(`[${requestId}] Device validation failed: ${result.error}`)
      return NextResponse.json(
        { success: false, error: result.error || 'אימות נכשל' },
        { status: 401 }
      )
    }
    
    // Extend expiration on successful validation
    await extendDeviceExpiration(deviceToken)
    
    console.log(`[${requestId}] Device validated successfully for customer: ${result.customer?.fullname}`)
    
    return NextResponse.json({
      success: true,
      customer: {
        id: result.customer!.id,
        phone: result.customer!.phone,
        fullname: result.customer!.fullname,
        email: result.customer!.email,
        auth_method: result.customer!.auth_method,
      },
      message: 'מכשיר מאומת בהצלחה',
    })
    
  } catch (error) {
    console.error(`[${requestId}] Error validating device:`, error)
    
    await reportServerError(error, 'POST /api/auth/validate-device', {
      route: '/api/auth/validate-device',
      severity: 'medium',
      additionalData: { requestId },
    })
    
    return NextResponse.json(
      { success: false, error: 'שגיאה באימות המכשיר' },
      { status: 500 }
    )
  }
}
