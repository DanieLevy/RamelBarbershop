/**
 * API Route: Send SMS OTP
 * 
 * Sends an OTP verification code via the 019 SMS provider.
 * This is a server-side route that keeps the API token secure.
 * 
 * Endpoint: POST /api/sms/send-otp
 * Body: { phone: string }
 * 
 * @see https://docs.019sms.co.il - 019 SMS API Documentation
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { reportServerError } from '@/lib/bug-reporter/helpers'
import { getO19ErrorMessage } from '@/lib/sms/error-codes'

export const dynamic = 'force-dynamic'

// Request validation schema
const sendOtpSchema = z.object({
  phone: z.string()
    .min(9, 'מספר טלפון קצר מדי')
    .max(15, 'מספר טלפון ארוך מדי')
    .regex(/^[0-9+\-\s()]+$/, 'מספר טלפון לא תקין'),
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
interface O19SendOtpResponse {
  sms?: {
    status: number | string
    code?: string
    message?: string
  }
  status?: number | string
  code?: string
  message?: string
  source_error?: number | string
}

export async function POST(request: NextRequest) {
  const requestId = `sms-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  
  try {
    // Validate environment variables
    const apiToken = process.env.O19_SMS_API_TOKEN
    const username = process.env.O19_SMS_USERNAME
    const source = process.env.O19_SMS_SOURCE || 'Ramel'
    
    if (!apiToken || !username) {
      console.error(`[${requestId}] Missing 019 SMS environment variables`)
      return NextResponse.json(
        { success: false, error: 'שירות ה-SMS לא מוגדר כראוי' },
        { status: 500 }
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const validation = sendOtpSchema.safeParse(body)
    
    if (!validation.success) {
      const errorMessage = validation.error.issues[0]?.message || 'מספר טלפון לא תקין'
      return NextResponse.json(
        { success: false, error: errorMessage },
        { status: 400 }
      )
    }

    const { phone } = validation.data
    const formattedPhone = formatPhoneFor019(phone)
    
    console.log(`[${requestId}] Sending OTP to: ${formattedPhone.slice(0, 3)}****${formattedPhone.slice(-2)}`)

    // Build 019 API request body
    // Source is REQUIRED by 019 API - must be either:
    // 1. A verified phone number (e.g., "0501234567")  
    // 2. A verified text name (requires ID verification process with 019)
    // Set O19_SMS_SOURCE in .env.local to your verified source
    const o19RequestBody = {
      send_otp: {
        user: {
          username: username
        },
        phone: formattedPhone,
        source: source,
        max_tries: 3,
        valid_time: 5,
        text: 'קוד האימות שלך באפליקציית רם אל: [code]'
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
    let responseData: O19SendOtpResponse
    
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
    const sourceError = responseData.source_error
    const sourceErrorNum = typeof sourceError === 'string' ? parseInt(sourceError, 10) : sourceError
    
    console.log(`[${requestId}] 019 Response status:`, statusNum, 'source_error:', sourceErrorNum, 'message:', responseData.sms?.message ?? responseData.message)

    // Status 0 = success
    if (statusNum === 0) {
      // Create session info (don't expose the actual OTP code for security)
      const session = {
        sessionId: `o19-${formattedPhone}-${Date.now()}`,
        phoneNumber: formattedPhone,
        createdAt: Date.now(),
        expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
      }

      return NextResponse.json({
        success: true,
        session,
        message: 'קוד אימות נשלח בהצלחה'
      })
    }

    // Handle source verification error specifically
    if (sourceErrorNum === 515) {
      console.error(`[${requestId}] 019 API: Source "${source}" is not verified`)
      return NextResponse.json(
        { 
          success: false, 
          error: 'שירות ה-SMS לא מוגדר כראוי. אנא פנה לתמיכה.',
          statusCode: 515,
          details: 'SMS source not verified with provider'
        },
        { status: 500 }
      )
    }

    // Handle error - use source_error if available, otherwise use main status
    const effectiveError = sourceErrorNum ?? statusNum ?? -1
    const errorMessage = getO19ErrorMessage(effectiveError)
    console.error(`[${requestId}] 019 API error:`, effectiveError, errorMessage)
    
    return NextResponse.json(
      { success: false, error: errorMessage, statusCode: statusNum },
      { status: 400 }
    )
    
  } catch (error) {
    console.error(`[${requestId}] Error sending OTP:`, error)
    
    await reportServerError(error, 'POST /api/sms/send-otp', {
      route: '/api/sms/send-otp',
      severity: 'high',
      additionalData: { requestId }
    })
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'שגיאה לא צפויה בשליחת קוד אימות'
      },
      { status: 500 }
    )
  }
}
