/**
 * Cron Job: Send Appointment Reminders
 * 
 * This endpoint is triggered by Vercel Cron every hour to send
 * push notification reminders for upcoming appointments.
 * 
 * Schedule: Every hour at minute 0 (0 * * * *)
 * 
 * Security: Verifies CRON_SECRET in Authorization header
 */

import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // Allow up to 60 seconds for processing

/**
 * Verify the request is from Vercel Cron
 */
function verifyCronSecret(request: Request): boolean {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  
  // In development, allow requests without secret
  if (process.env.NODE_ENV === 'development') {
    return true
  }
  
  // In production, verify the secret
  if (!cronSecret) {
    console.error('[Cron] CRON_SECRET not configured')
    return false
  }
  
  return authHeader === `Bearer ${cronSecret}`
}

export async function GET(request: Request) {
  // Verify the request is authorized
  if (!verifyCronSecret(request)) {
    console.error('[Cron] Unauthorized cron request')
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    )
  }

  const startTime = Date.now()
  
  try {
    // STUB: Reminder logic will be implemented here
    // 
    // Implementation will:
    // 1. Query reservations where time_timestamp is within reminder window
    // 2. Check barber_notification_settings for reminder_hours_before
    // 3. Filter customers who have reminder_enabled = true
    // 4. Call pushService.sendReminder() for each qualifying appointment
    // 5. Log results to notification_logs
    
    console.log('[Cron] Send reminders job started')
    
    // Placeholder response
    const result = {
      success: true,
      message: 'Cron job executed successfully (stub)',
      executedAt: new Date().toISOString(),
      duration: Date.now() - startTime,
      reminders: {
        checked: 0,
        sent: 0,
        skipped: 0
      }
    }
    
    console.log('[Cron] Send reminders job completed', result)
    
    return NextResponse.json(result)
  } catch (error) {
    console.error('[Cron] Error in send-reminders job:', error)
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        executedAt: new Date().toISOString(),
        duration: Date.now() - startTime
      },
      { status: 500 }
    )
  }
}

