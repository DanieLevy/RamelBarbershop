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

    // Send email via Resend
    const { data, error } = await resend.emails.send({
      from: 'Ramel Bug Reporter <onboarding@resend.dev>',
      to: [TO_EMAIL],
      subject: `${severityEmoji} [Bug] ${payload.error.name}: ${payload.error.message.substring(0, 50)}${payload.error.message.length > 50 ? '...' : ''}`,
      html: htmlContent,
      text: textContent,
      tags: [
        { name: 'reportId', value: payload.reportId },
        { name: 'severity', value: payload.severity || 'medium' },
        { name: 'action', value: payload.action.substring(0, 50) },
      ],
    })

    if (error) {
      console.error('[BugReport] Failed to send email:', error)
      
      // Still log the report even if email fails
      console.log('[BugReport] Report (email failed):', JSON.stringify(payload, null, 2))
      
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to send email',
          reportId: payload.reportId,
          details: error.message,
        },
        { status: 500 }
      )
    }

    console.log('[BugReport] Email sent successfully:', data?.id)

    return NextResponse.json({
      success: true,
      reportId: payload.reportId,
      emailId: data?.id,
      message: 'Bug report sent successfully',
    })

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

