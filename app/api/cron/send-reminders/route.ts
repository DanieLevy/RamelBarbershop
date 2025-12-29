/**
 * Cron Job: Send Appointment Reminders (Vercel)
 * 
 * This endpoint is triggered by Vercel Cron to send push notification
 * reminders for upcoming appointments.
 * 
 * Note: Vercel free tier limits cron to 2 runs per day.
 * For hourly reminders, use Netlify Functions as fallback.
 * 
 * Schedule: See vercel.json
 */

import { NextResponse } from 'next/server'
import { processReminders } from '@/lib/cron/reminder-service'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Verify the request is from Vercel Cron
 */
function verifyCronSecret(request: Request): boolean {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (process.env.NODE_ENV === 'development') {
    return true
  }

  if (!cronSecret) {
    console.error('[Cron] CRON_SECRET not configured')
    return false
  }

  return authHeader === `Bearer ${cronSecret}`
}

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    console.error('[Cron] Unauthorized cron request')
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  console.log('[Cron/Vercel] Send reminders job triggered')
  
  const result = await processReminders()

  if (result.success) {
    return NextResponse.json(result)
  } else {
    return NextResponse.json(result, { status: 500 })
  }
}
