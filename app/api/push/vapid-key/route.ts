/**
 * GET /api/push/vapid-key
 * Returns the public VAPID key for push subscription
 */

import { NextResponse } from 'next/server'
import { pushService } from '@/lib/push/push-service'
import { reportServerError } from '@/lib/bug-reporter/helpers'

export async function GET() {
  try {
    const publicKey = pushService.getPublicKey()
    
    if (!publicKey) {
      return NextResponse.json(
        { success: false, error: 'Push notifications not configured' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      success: true,
      publicKey,
      configured: pushService.isConfigured()
    })
  } catch (error) {
    console.error('[API] Error getting VAPID key:', error)
    await reportServerError(error, 'Get VAPID key failed', {
      route: '/api/push/vapid-key',
      severity: 'high',
    })
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

