/**
 * Bug Report API Route
 * 
 * Receives bug reports and sends them via email
 */

import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { generateBugReportEmail, generateBugReportText } from '@/lib/bug-reporter/template'
import type { BugReportPayload } from '@/lib/bug-reporter/types'

// Initialize Resend client
const resend = new Resend(process.env.RESEND_API_KEY)

// Validate environment variables
const TO_EMAIL = process.env.BUG_REPORT_TO_EMAIL

export async function POST(request: NextRequest) {
  try {
    // Parse the request body
    const payload: BugReportPayload = await request.json()

    // Validate required fields
    if (!payload.error || !payload.action || !payload.reportId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Check if email configuration is set
    if (!process.env.RESEND_API_KEY || !TO_EMAIL) {
      console.warn('[BugReport] Email not configured, logging to console only')
      console.log('[BugReport] Report:', JSON.stringify(payload, null, 2))
      
      return NextResponse.json({
        success: true,
        reportId: payload.reportId,
        message: 'Bug report logged (email not configured)',
      })
    }

    // Generate email content
    const htmlContent = generateBugReportEmail(payload)
    const textContent = generateBugReportText(payload)

    // Determine severity emoji for subject
    const severityEmoji = {
      low: '🟢',
      medium: '🟡',
      high: '🟠',
      critical: '🔴',
    }[payload.severity || 'medium']

    // Truncate action for tags (max 256 chars for Resend tags)
    const truncatedAction = payload.action.substring(0, 50).replace(/[^a-zA-Z0-9-_]/g, '_')
    
    // Send email via Resend
    try {
      const { data, error } = await resend.emails.send({
        from: 'Ramel Bug Reporter <onboarding@resend.dev>',
        to: [TO_EMAIL],
        subject: `${severityEmoji} [Bug] ${payload.error.name}: ${payload.error.message.substring(0, 50)}${payload.error.message.length > 50 ? '...' : ''}`,
        html: htmlContent,
        text: textContent,
        tags: [
          { name: 'reportId', value: payload.reportId },
          { name: 'severity', value: payload.severity || 'medium' },
          { name: 'action', value: truncatedAction },
        ],
      })

      if (error) {
        console.error('[BugReport] Resend API error:', JSON.stringify(error, null, 2))
        
        // Still log the report even if email fails - but return success so the UI shows report was logged
        console.log('[BugReport] Report (email failed, logged locally):', JSON.stringify(payload, null, 2))
        
        return NextResponse.json({
          success: true,
          reportId: payload.reportId,
          message: 'Bug report logged (email delivery failed)',
          emailError: error.message,
        })
      }

      console.log('[BugReport] Email sent successfully:', data?.id)

      return NextResponse.json({
        success: true,
        reportId: payload.reportId,
        emailId: data?.id,
        message: 'Bug report sent successfully',
      })
    } catch (resendError) {
      console.error('[BugReport] Resend exception:', resendError)
      console.log('[BugReport] Report (logged locally due to exception):', JSON.stringify(payload, null, 2))
      
      // Return success since we logged it - don't fail the whole thing
      return NextResponse.json({
        success: true,
        reportId: payload.reportId,
        message: 'Bug report logged (email service unavailable)',
      })
    }

  } catch (error) {
    console.error('[BugReport] Server error:', error)
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    configured: Boolean(process.env.RESEND_API_KEY && TO_EMAIL),
  })
}

