/**
 * API Route: Verify SMS OTP
 * 
 * Verifies an OTP code entered by the user via the 019 SMS provider.
 * This is a server-side route that keeps the API token secure.
 * 
 * Endpoint: POST /api/sms/verify-otp
 * Body: { phone: string, code: string }
 * 
 * @see https://docs.019sms.co.il - 019 SMS API Documentation
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { reportServerError } from '@/lib/bug-reporter/helpers'
import { getO19ErrorMessage } from '@/lib/sms/error-codes'

export const dynamic = 'force-dynamic'

// Request validation schema
const verifyOtpSchema = z.object({
  phone: z.string()
    .min(9, 'מספר טלפון קצר מדי')
    .max(15, 'מספר טלפון ארוך מדי'),
  code: z.string()
    .length(6, 'קוד האימות חייב להכיל 6 ספרות')
    .regex(/^[0-9]+$/, 'קוד האימות חייב להכיל ספרות בלבד'),
})

// Format phone number for 019 API (Israeli format: 05xxxxxxx)
function formatPhoneFor019(phone: string): string {
  const cleaned = phone.replace(/\D/g, '')
  
  // Convert from international format +972 to local 0
  if (cleaned.startsWith('972')) {
    return '0' + cleaned.slice(3)
  }
  
  // Already in local format with leading 0
  if (cleaned.startsWith('0')) {
    return cleaned
  }
  
  // No leading 0, add it
  return '0' + cleaned
}

// 019 API Response type
interface O19VerifyOtpResponse {
  sms?: {
    status: number | string
    message?: string
  }
  status?: number | string
  message?: string
}

export async function POST(request: NextRequest) {
  const requestId = `sms-verify-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  
  try {
    // Validate environment variables
    const apiToken = process.env.O19_SMS_API_TOKEN
    const username = process.env.O19_SMS_USERNAME
    
    if (!apiToken || !username) {
      console.error(`[${requestId}] Missing 019 SMS environment variables`)
      return NextResponse.json(
        { success: false, error: 'שירות ה-SMS לא מוגדר כראוי' },
        { status: 500 }
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const validation = verifyOtpSchema.safeParse(body)
    
    if (!validation.success) {
      const errorMessage = validation.error.issues[0]?.message || 'נתונים לא תקינים'
      return NextResponse.json(
        { success: false, error: errorMessage },
        { status: 400 }
      )
    }

    const { phone, code } = validation.data
    const formattedPhone = formatPhoneFor019(phone)
    
    console.log(`[${requestId}] Verifying OTP for: ${formattedPhone.slice(0, 3)}****${formattedPhone.slice(-2)}`)

    // Build 019 API request body
    const o19RequestBody = {
      validate_otp: {
        user: {
          username: username
        },
        phone: formattedPhone,
        code: code
      }
    }

    // Call 019 SMS API
    const response = await fetch('https://019sms.co.il/api', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiToken}`
      },
      body: JSON.stringify(o19RequestBody)
    })

    // Parse response
    const responseText = await response.text()
    let responseData: O19VerifyOtpResponse
    
    try {
      responseData = JSON.parse(responseText)
    } catch {
      console.error(`[${requestId}] Failed to parse 019 response:`, responseText)
      return NextResponse.json(
        { success: false, error: 'שגיאה בתקשורת עם שירות ה-SMS' },
        { status: 502 }
      )
    }

    // Handle response - 019 may wrap in "sms" object
    const status = responseData.sms?.status ?? responseData.status
    const statusNum = typeof status === 'string' ? parseInt(status, 10) : status
    
    console.log(`[${requestId}] 019 Verify Response status:`, statusNum, 'message:', responseData.sms?.message ?? responseData.message)

    // Status 0 = success (code validated)
    if (statusNum === 0) {
      // Generate a DETERMINISTIC provider UID for this verified phone
      // Format: o19-{normalized_phone}
      // This ensures the same phone always gets the same UID
      // The o19- prefix identifies this as a 019 SMS provider UID
      // (vs legacy Firebase UIDs or future provider UIDs)
      const providerUid = `o19-${formattedPhone}`
      
      console.log(`[${requestId}] OTP verified successfully, providerUid: ${providerUid}`)
      
      return NextResponse.json({
        success: true,
        providerUid,
        message: 'קוד האימות אומת בהצלחה'
      })
    }

    // Status 12 = Unverified code (wrong code)
    if (statusNum === 12) {
      return NextResponse.json(
        { success: false, error: 'קוד אימות שגוי' },
        { status: 400 }
      )
    }

    // Handle other errors
    const errorMessage = getO19ErrorMessage(statusNum ?? -1)
    console.error(`[${requestId}] 019 API verify error:`, statusNum, errorMessage)
    
    return NextResponse.json(
      { success: false, error: errorMessage, statusCode: statusNum },
      { status: 400 }
    )
    
  } catch (error) {
    console.error(`[${requestId}] Error verifying OTP:`, error)
    
    await reportServerError(error, 'POST /api/sms/verify-otp', {
      route: '/api/sms/verify-otp',
      severity: 'high',
      additionalData: { requestId }
    })
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'שגיאה לא צפויה באימות הקוד'
      },
      { status: 500 }
    )
  }
}
