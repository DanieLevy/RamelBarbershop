/**
 * Netlify Scheduled Function: Trigger Appointment Reminders
 * 
 * This is a lightweight trigger that calls the main Next.js API
 * to process and send reminders. All heavy processing happens
 * in the main application to avoid Netlify function limitations.
 * 
 * Schedule: Runs every 30 minutes (at :00 and :30)
 */

import type { Config, Context } from '@netlify/functions'

// Schedule configuration - runs every 30 minutes
export const config: Config = {
  schedule: '0,30 * * * *'
}

/**
 * Get the base URL for API calls
 */
function getBaseUrl(): string {
  const siteUrl = process.env.URL || process.env.DEPLOY_PRIME_URL
  return siteUrl || 'http://localhost:3000'
}

/**
 * Main handler - triggers the process-reminders API
 */
export default async function handler(_req: Request, _context: Context) {
  const startTime = Date.now()
  
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
