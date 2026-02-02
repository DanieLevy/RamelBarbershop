/**
 * API Route: Get SMS Balance
 * 
 * Retrieves the current SMS credit balance from the 019 SMS provider.
 * Protected endpoint for admin/dev use only.
 * 
 * Endpoint: GET /api/sms/balance
 * Headers: X-Dev-Token (required for auth)
 * 
 * @see https://docs.019sms.co.il - 019 SMS API Documentation
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateDevToken, unauthorizedResponse } from '@/lib/auth/dev-auth'

export const dynamic = 'force-dynamic'

// 019 API Response type for balance
interface O19BalanceResponse {
  balance?: {
    status: number | string
    message?: string
    balance?: number | string
    interantional_balance?: number | string
  }
  status?: number | string
  message?: string
}

export async function GET(request: NextRequest) {
  const requestId = `sms-balance-${Date.now()}`
  
  try {
    // Validate dev token using consistent auth method
    if (!validateDevToken(request)) {
      return unauthorizedResponse()
    }
    
    // Validate environment variables
    const apiToken = process.env.O19_SMS_API_TOKEN
    const username = process.env.O19_SMS_USERNAME
    
    if (!apiToken || !username) {
      console.error(`[${requestId}] Missing 019 SMS environment variables`)
      return NextResponse.json(
        { success: false, error: 'SMS service not configured' },
        { status: 500 }
      )
    }

    // Build 019 API request body for balance check
    const o19RequestBody = {
      balance: {
        user: {
          username: username
        }
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
    let responseData: O19BalanceResponse
    
    try {
      responseData = JSON.parse(responseText)
    } catch {
      console.error(`[${requestId}] Failed to parse 019 response:`, responseText)
      return NextResponse.json(
        { success: false, error: 'Failed to parse provider response' },
        { status: 502 }
      )
    }

    // Handle response - 019 may wrap in "balance" object
    const status = responseData.balance?.status ?? responseData.status
    const statusNum = typeof status === 'string' ? parseInt(status, 10) : status
    
    console.log(`[${requestId}] 019 Balance Response:`, responseData)

    // Status 0 = success
    if (statusNum === 0) {
      const balance = responseData.balance?.balance
      const internationalBalance = responseData.balance?.interantional_balance
      const message = responseData.balance?.message ?? responseData.message
      
      return NextResponse.json({
        success: true,
        balance: typeof balance === 'string' ? parseFloat(balance) : balance,
        internationalBalance: typeof internationalBalance === 'string' 
          ? parseFloat(internationalBalance) 
          : internationalBalance,
        message,
        lastChecked: new Date().toISOString()
      })
    }

    // Handle error
    console.error(`[${requestId}] 019 API balance error:`, statusNum)
    
    return NextResponse.json(
      { success: false, error: 'Failed to fetch balance', statusCode: statusNum },
      { status: 400 }
    )
    
  } catch (error) {
    console.error(`[${requestId}] Error fetching SMS balance:`, error)
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unexpected error'
      },
      { status: 500 }
    )
  }
}
