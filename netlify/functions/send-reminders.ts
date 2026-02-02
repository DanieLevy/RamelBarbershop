/**
 * Netlify Scheduled Function: Trigger Appointment Reminders
 * 
 * This is a lightweight trigger that calls the main Next.js API
 * to process and send reminders. All heavy processing happens
 * in the main application to avoid Netlify function limitations.
 * 
 * Schedule: Every 30 minutes (*/30 * * * *)
 */

import { schedule } from '@netlify/functions'

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
const handler = schedule('*/30 * * * *', async () => {
  const startTime = Date.now()
  
  console.log('[Netlify Trigger] Starting reminder job trigger')

  try {
    const baseUrl = getBaseUrl()
    const cronSecret = process.env.CRON_SECRET
    
    if (!cronSecret) {
      console.error('[Netlify Trigger] CRON_SECRET not configured')
      return {
        statusCode: 500,
        body: JSON.stringify({ success: false, error: 'CRON_SECRET not configured' })
      }
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
      return {
        statusCode: response.status,
        body: JSON.stringify({
          success: false,
          error: data.error || 'API error',
          triggerDuration: duration,
          apiResponse: data
        })
      }
    }

    console.log('[Netlify Trigger] Completed successfully:', {
      triggerDuration: duration,
      apiDuration: data.duration,
      results: data.results
    })

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        source: 'netlify',
        triggerDuration: duration,
        ...data
      })
    }

  } catch (error) {
    const duration = Date.now() - startTime
    console.error('[Netlify Trigger] Error:', error)

    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        source: 'netlify',
        error: error instanceof Error ? error.message : 'Unknown error',
        triggerDuration: duration
      })
    }
  }
})

export { handler }
