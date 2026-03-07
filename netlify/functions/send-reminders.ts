/**
 * Netlify Scheduled Function: Trigger Appointment Reminders
 * 
 * This is a lightweight trigger that calls the main Next.js API
 * to process and send reminders. All heavy processing happens
 * in the main application to avoid Netlify function limitations.
 * 
 * Schedule: Runs every 30 minutes during business-relevant hours only (5:00-20:00 UTC)
 * Israel timezone is UTC+2 (winter) / UTC+3 (summer), so:
 *   5:00 UTC = 07:00-08:00 Israel time (covers early morning reminders)
 *   20:00 UTC = 22:00-23:00 Israel time (covers late evening reminders)
 * This reduces from 48 runs/day to 30 runs/day (saving 18 invocations/day).
 * Combined with Monday/Saturday skip, this significantly reduces function usage.
 */

import type { Config, Context } from '@netlify/functions'

// Schedule: every 30 minutes, but only during hours 5-19 UTC (7:00-22:00 Israel)
// Before: 0,30 * * * * (48 runs/day)
// After: 0,30 5-19 * * * (30 runs/day) — saves 37.5% of invocations
export const config: Config = {
  schedule: '0,30 5-19 * * *'
}

/**
 * Get the base URL for API calls
 */
function getBaseUrl(): string {
  const siteUrl = process.env.URL || process.env.DEPLOY_PRIME_URL
  return siteUrl || 'http://localhost:3000'
}

/**
 * Check if today is a closed day (Monday or Saturday) in Israel timezone.
 * Barbershop is always closed on these days - hardcoded, no DB needed.
 * Skipping these days saves ~96 function invocations per week (48 per day × 2 days).
 */
function isClosedDay(): boolean {
  // Get current day in Israel timezone (Asia/Jerusalem)
  const israelDay = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    timeZone: 'Asia/Jerusalem',
  }).format(new Date())

  // Monday = 1, Saturday = 6 in JS Date — but using string comparison for clarity
  return israelDay === 'Monday' || israelDay === 'Saturday'
}

/**
 * Main handler - triggers the process-reminders API
 */
export default async function handler(_req: Request, _context: Context) {
  const startTime = Date.now()
  const reminderSource = process.env.REMINDER_SOURCE || 'netlify'

  if (reminderSource === 'firebase') {
    console.log('[Netlify Trigger] 🔴 DISABLED — REMINDER_SOURCE=firebase. Reminders handled by Firebase Cloud Functions.')
    return new Response(JSON.stringify({
      success: true,
      source: 'netlify',
      skipped: true,
      reason: 'REMINDER_SOURCE=firebase — reminders managed by Firebase Cloud Functions',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }

  console.log('[Netlify Trigger] 🟢 ACTIVE — REMINDER_SOURCE=netlify (or not set). Handling reminders via Netlify.')

  // Skip Monday and Saturday — barbershop is always closed on these days (hardcoded)
  if (isClosedDay()) {
    console.log('[Netlify Trigger] Skipping — barbershop is closed today (Monday/Saturday)')
    return new Response(JSON.stringify({
      success: true,
      source: 'netlify',
      skipped: true,
      reason: 'Barbershop closed (Monday/Saturday)',
      triggerDuration: Date.now() - startTime,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  
  console.log('[Netlify Trigger] Starting reminder job trigger')

  try {
    const baseUrl = getBaseUrl()
    const cronSecret = process.env.CRON_SECRET
    
    if (!cronSecret) {
      console.error('[Netlify Trigger] CRON_SECRET not configured')
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'CRON_SECRET not configured' 
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const apiUrl = `${baseUrl}/api/cron/process-reminders`
    console.log(`[Netlify Trigger] Calling ${apiUrl}`)

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cronSecret}`,
        'X-Trigger-Source': 'netlify'
      }
    })

    const data = await response.json()
    const duration = Date.now() - startTime

    if (!response.ok) {
      console.error('[Netlify Trigger] API returned error:', data)
      return new Response(JSON.stringify({
        success: false,
        error: data.error || 'API error',
        triggerDuration: duration,
        apiResponse: data
      }), { 
        status: response.status,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('[Netlify Trigger] Completed successfully:', {
      triggerDuration: duration,
      apiDuration: data.duration,
      results: data.results
    })

    return new Response(JSON.stringify({
      success: true,
      source: 'netlify',
      triggerDuration: duration,
      ...data
    }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    const duration = Date.now() - startTime
    console.error('[Netlify Trigger] Error:', error)

    return new Response(JSON.stringify({
      success: false,
      source: 'netlify',
      error: error instanceof Error ? error.message : 'Unknown error',
      triggerDuration: duration
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
