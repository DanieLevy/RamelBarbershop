/**
 * Cron Job: Clean Up Stale Push Subscriptions and Old Notification Logs
 * 
 * This endpoint is triggered periodically to maintain database health by:
 * - Deactivating push subscriptions with too many consecutive failures
 * - Deactivating push subscriptions not used in 90+ days  
 * - Deleting notification logs older than 30 days
 * 
 * Recommended schedule: Weekly (e.g., Sunday 3:00 AM Israel time)
 */

import { NextResponse } from 'next/server'
import { pushService } from '@/lib/push/push-service'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Verify the request is from an authorized source (Vercel Cron or admin)
 */
function verifyCronSecret(request: Request): boolean {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (process.env.NODE_ENV === 'development') {
    return true
  }

  if (!cronSecret) {
    console.error('[Cron Cleanup] CRON_SECRET not configured')
    return false
  }

  return authHeader === `Bearer ${cronSecret}`
}

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    console.error('[Cron Cleanup] Unauthorized request')
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  console.log('[Cron Cleanup] Starting push subscriptions and notification logs cleanup')
  
  const startTime = Date.now()
  
  try {
    // Run cleanup
    const cleanupResult = await pushService.cleanupStaleData()
    
    // Get current stats for reporting
    const stats = await pushService.getSubscriptionStats()
    
    const response = {
      success: true,
      message: 'Cleanup completed',
      executedAt: new Date().toISOString(),
      duration: Date.now() - startTime,
      cleanup: cleanupResult,
      currentStats: stats
    }
    
    console.log('[Cron Cleanup] Completed:', response)
    
    return NextResponse.json(response)
  } catch (error) {
    console.error('[Cron Cleanup] Error:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      executedAt: new Date().toISOString(),
      duration: Date.now() - startTime
    }, { status: 500 })
  }
}
