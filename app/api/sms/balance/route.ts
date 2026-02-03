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
// Response can be either nested (wrapped in "balance" object) or flat at root level
interface O19BalanceResponse {
  // Nested format
  balance?: {
    status: number | string
    message?: string
    balance?: number | string
    interantional_balance?: number | string
  }
  // Flat format (balance fields at root level)
  status?: number | string
  message?: string
  interantional_balance?: number | string
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

    // Handle response - 019 can return either:
    // 1. Nested: { balance: { status, balance, interantional_balance, message } }
    // 2. Flat: { status, balance, interantional_balance, message }
    const isNested = responseData.balance && typeof responseData.balance === 'object'
    const status = isNested ? responseData.balance?.status : responseData.status
    const statusNum = typeof status === 'string' ? parseInt(status, 10) : (status ?? -1)
    
    console.log(`[${requestId}] 019 Balance Response:`, responseData)

    // Status 0 = success
    if (statusNum === 0) {
      // Get balance from nested or flat response
      // Note: In flat format, "balance" is the value itself, not an object
      let balance: number | string | undefined
      let internationalBalance: number | string | undefined
      let message: string | undefined
      
      if (isNested) {
        // Nested format: responseData.balance.balance
        balance = responseData.balance?.balance
        internationalBalance = responseData.balance?.interantional_balance
        message = responseData.balance?.message
      } else {
        // Flat format: responseData.balance is the actual balance value (when it's a string/number)
        // But we need to check if it's a number/string, not an object
        const rawBalance = (responseData as { balance?: string | number }).balance
        if (typeof rawBalance === 'string' || typeof rawBalance === 'number') {
          balance = rawBalance
        }
        internationalBalance = responseData.interantional_balance
        message = responseData.message
      }
      
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
