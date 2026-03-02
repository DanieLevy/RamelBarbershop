/**
 * Bug Report Email Template
 * 
 * Creates a well-formatted HTML email for bug reports
 */

import type { BugReportPayload } from './types'

const SEVERITY_COLORS = {
  low: '#22c55e',      // green
  medium: '#eab308',   // yellow
  high: '#f97316',     // orange
  critical: '#ef4444', // red
}

const SEVERITY_LABELS = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
}

export function generateBugReportEmail(report: BugReportPayload): string {
  const severity = report.severity || 'medium'
  const severityColor = SEVERITY_COLORS[severity]
  const severityLabel = SEVERITY_LABELS[severity]
  
  const timestamp = new Date(report.timestamp).toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short'
  })

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bug Report - ${report.error.name}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0a0a; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #141414; border-radius: 12px; overflow: hidden; border: 1px solid #2a2a2a;">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #1a1a1a 0%, #0d0d0d 100%); padding: 24px 30px; border-bottom: 1px solid #2a2a2a;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 600;">
                      🐛 Bug Report
                    </h1>
                    <p style="margin: 8px 0 0; color: #888888; font-size: 12px;">
                      Report ID: <code style="background: #2a2a2a; padding: 2px 6px; border-radius: 4px; color: #d4a853;">${report.reportId}</code>
                    </p>
                  </td>
                  <td align="right">
                    <span style="display: inline-block; padding: 6px 14px; background-color: ${severityColor}22; color: ${severityColor}; border-radius: 20px; font-size: 12px; font-weight: 600; border: 1px solid ${severityColor}44;">
                      ${severityLabel} Severity
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Timestamp -->
          <tr>
            <td style="padding: 16px 30px; background-color: #1a1a1a; border-bottom: 1px solid #2a2a2a;">
              <p style="margin: 0; color: #666666; font-size: 13px;">
                📅 <strong style="color: #888888;">Reported:</strong> ${timestamp}
              </p>
            </td>
          </tr>

          <!-- Error Summary -->
          <tr>
            <td style="padding: 24px 30px; border-bottom: 1px solid #2a2a2a;">
              <h2 style="margin: 0 0 16px; color: #ef4444; font-size: 16px; font-weight: 600;">
                ❌ Error Summary
              </h2>
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #1a1a1a; border-radius: 8px; border: 1px solid #2a2a2a;">
                <tr>
                  <td style="padding: 16px;">
                    <p style="margin: 0 0 8px; color: #888888; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Error Type</p>
                    <p style="margin: 0; color: #ffffff; font-size: 14px; font-weight: 500;">${escapeHtml(report.error.name)}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 0 16px 16px; border-top: 1px solid #2a2a2a; padding-top: 16px;">
                    <p style="margin: 0 0 8px; color: #888888; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Message</p>
                    <p style="margin: 0; color: #f97316; font-size: 14px; font-family: 'SF Mono', Monaco, 'Courier New', monospace;">
                      ${escapeHtml(report.error.message)}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Location Context -->
          <tr>
            <td style="padding: 24px 30px; border-bottom: 1px solid #2a2a2a;">
              <h2 style="margin: 0 0 16px; color: #3b82f6; font-size: 16px; font-weight: 600;">
                📍 Location Context
              </h2>
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #1a1a1a; border-radius: 8px; border: 1px solid #2a2a2a;">
                <tr>
                  <td width="50%" style="padding: 12px 16px; border-bottom: 1px solid #2a2a2a;">
                    <p style="margin: 0 0 4px; color: #666666; font-size: 11px; text-transform: uppercase;">Action</p>
                    <p style="margin: 0; color: #ffffff; font-size: 13px;">${escapeHtml(report.action)}</p>
                  </td>
                  <td width="50%" style="padding: 12px 16px; border-bottom: 1px solid #2a2a2a; border-left: 1px solid #2a2a2a;">
                    <p style="margin: 0 0 4px; color: #666666; font-size: 11px; text-transform: uppercase;">Page</p>
                    <p style="margin: 0; color: #ffffff; font-size: 13px;">${escapeHtml(report.page)}</p>
                  </td>
                </tr>
                ${report.route || report.component ? `
                <tr>
                  ${report.route ? `
                  <td width="50%" style="padding: 12px 16px;">
                    <p style="margin: 0 0 4px; color: #666666; font-size: 11px; text-transform: uppercase;">Route</p>
                    <p style="margin: 0; color: #d4a853; font-size: 13px; font-family: 'SF Mono', Monaco, 'Courier New', monospace;">${escapeHtml(report.route)}</p>
                  </td>
                  ` : ''}
                  ${report.component ? `
                  <td width="50%" style="padding: 12px 16px; border-left: 1px solid #2a2a2a;">
                    <p style="margin: 0 0 4px; color: #666666; font-size: 11px; text-transform: uppercase;">Component</p>
                    <p style="margin: 0; color: #22c55e; font-size: 13px; font-family: 'SF Mono', Monaco, 'Courier New', monospace;">${escapeHtml(report.component)}</p>
                  </td>
                  ` : ''}
                </tr>
                ` : ''}
              </table>
            </td>
          </tr>

          <!-- User Context -->
          ${report.user ? `
          <tr>
            <td style="padding: 24px 30px; border-bottom: 1px solid #2a2a2a;">
              <h2 style="margin: 0 0 16px; color: #8b5cf6; font-size: 16px; font-weight: 600;">
                👤 User Context
              </h2>
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #1a1a1a; border-radius: 8px; border: 1px solid #2a2a2a;">
                <tr>
                  <td style="padding: 12px 16px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td width="25%" style="padding: 4px 0;">
                          <span style="color: #666666; font-size: 12px;">Type:</span>
                          <span style="color: #ffffff; font-size: 12px; margin-left: 8px;">${escapeHtml(report.user.type)}</span>
                        </td>
                        ${report.user.id ? `
                        <td width="25%" style="padding: 4px 0;">
                          <span style="color: #666666; font-size: 12px;">ID:</span>
                          <code style="color: #d4a853; font-size: 11px; margin-left: 8px; background: #2a2a2a; padding: 2px 6px; border-radius: 4px;">${escapeHtml(report.user.id.substring(0, 8))}...</code>
                        </td>
                        ` : ''}
                        ${report.user.name ? `
                        <td width="25%" style="padding: 4px 0;">
                          <span style="color: #666666; font-size: 12px;">Name:</span>
                          <span style="color: #ffffff; font-size: 12px; margin-left: 8px;">${escapeHtml(report.user.name)}</span>
                        </td>
                        ` : ''}
                        ${report.user.phone ? `
                        <td width="25%" style="padding: 4px 0;">
                          <span style="color: #666666; font-size: 12px;">Phone:</span>
                          <span style="color: #ffffff; font-size: 12px; margin-left: 8px;">${escapeHtml(report.user.phone)}</span>
                        </td>
                        ` : ''}
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ` : ''}

          <!-- Environment -->
          ${report.environment ? `
          <tr>
            <td style="padding: 24px 30px; border-bottom: 1px solid #2a2a2a;">
              <h2 style="margin: 0 0 16px; color: #06b6d4; font-size: 16px; font-weight: 600;">
                🖥️ Environment
              </h2>
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #1a1a1a; border-radius: 8px; border: 1px solid #2a2a2a; font-size: 12px;">
                <tr>
                  <td style="padding: 12px 16px; color: #888888;">
                    ${report.environment.platform ? `<div style="margin-bottom: 6px;"><strong>Platform:</strong> <span style="color: #ffffff;">${escapeHtml(report.environment.platform)}</span></div>` : ''}
                    ${report.environment.screenWidth && report.environment.screenHeight ? `<div style="margin-bottom: 6px;"><strong>Screen:</strong> <span style="color: #ffffff;">${report.environment.screenWidth}x${report.environment.screenHeight}</span></div>` : ''}
                    ${report.environment.viewportWidth && report.environment.viewportHeight ? `<div style="margin-bottom: 6px;"><strong>Viewport:</strong> <span style="color: #ffffff;">${report.environment.viewportWidth}x${report.environment.viewportHeight}</span></div>` : ''}
                    ${report.environment.timezone ? `<div style="margin-bottom: 6px;"><strong>Timezone:</strong> <span style="color: #ffffff;">${escapeHtml(report.environment.timezone)}</span></div>` : ''}
                    ${report.environment.online !== undefined ? `<div><strong>Online:</strong> <span style="color: ${report.environment.online ? '#22c55e' : '#ef4444'};">${report.environment.online ? 'Yes' : 'No'}</span></div>` : ''}
                  </td>
                </tr>
                ${report.environment.userAgent ? `
                <tr>
                  <td style="padding: 12px 16px; border-top: 1px solid #2a2a2a;">
                    <p style="margin: 0 0 6px; color: #666666; font-size: 11px; text-transform: uppercase;">User Agent</p>
                    <p style="margin: 0; color: #888888; font-size: 11px; word-break: break-all; font-family: 'SF Mono', Monaco, 'Courier New', monospace;">
                      ${escapeHtml(report.environment.userAgent)}
                    </p>
                  </td>
                </tr>
                ` : ''}
              </table>
            </td>
          </tr>
          ` : ''}

          <!-- Chunk / Cache Diagnostics (only for chunk errors) -->
          ${report.additionalData?.chunkDiagnostics ? (() => {
            const cd = report.additionalData.chunkDiagnostics as Record<string, unknown>
            return `
          <tr>
            <td style="padding: 24px 30px; border-bottom: 1px solid #2a2a2a;">
              <h2 style="margin: 0 0 16px; color: #f59e0b; font-size: 16px; font-weight: 600;">
                ⚙️ Chunk &amp; Cache Diagnostics
              </h2>
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #1a1a1a; border-radius: 8px; border: 1px solid #2a2a2a; font-size: 12px;">
                ${cd.failedChunkUrl ? `<tr><td style="padding: 10px 16px; border-bottom: 1px solid #2a2a2a;"><strong style="color: #888;">Failed Chunk:</strong> <code style="color: #ef4444; background: #2a2a2a; padding: 2px 6px; border-radius: 4px; word-break: break-all;">${escapeHtml(String(cd.failedChunkUrl))}</code></td></tr>` : ''}
                <tr><td style="padding: 10px 16px; border-bottom: 1px solid #2a2a2a;">
                  <strong style="color: #888;">Recovery Source:</strong> <span style="color: #d4a853;">${escapeHtml(String(cd.recoverySource || 'unknown'))}</span>
                  ${cd.previousRecoveryTs ? ` &nbsp;|&nbsp; <strong style="color: #888;">Previous Recovery:</strong> <span style="color: #ef4444;">${escapeHtml(String(cd.previousRecoveryTs))}</span>` : ''}
                </td></tr>
                <tr><td style="padding: 10px 16px; border-bottom: 1px solid #2a2a2a;">
                  <strong style="color: #888;">SW Installed:</strong> <span style="color: ${cd.swInstalled ? '#22c55e' : '#ef4444'};">${cd.swInstalled ? 'Yes' : 'No'}</span>
                  &nbsp;|&nbsp; <strong style="color: #888;">SW Controller:</strong> <span style="color: ${cd.swController ? '#22c55e' : '#ef4444'};">${cd.swController ? 'Yes' : 'No'}</span>
                  &nbsp;|&nbsp; <strong style="color: #888;">SW Waiting:</strong> <span style="color: ${cd.swWaiting ? '#f97316' : '#22c55e'};">${cd.swWaiting ? 'Yes (update pending!)' : 'No'}</span>
                </td></tr>
                ${cd.swVersion ? `<tr><td style="padding: 10px 16px; border-bottom: 1px solid #2a2a2a;"><strong style="color: #888;">SW Version:</strong> <code style="color: #3b82f6; background: #2a2a2a; padding: 2px 6px; border-radius: 4px;">${escapeHtml(String(cd.swVersion))}</code></td></tr>` : ''}
                ${cd.swControllerUrl ? `<tr><td style="padding: 10px 16px; border-bottom: 1px solid #2a2a2a;"><strong style="color: #888;">SW URL:</strong> <span style="color: #888; word-break: break-all; font-size: 11px;">${escapeHtml(String(cd.swControllerUrl))}</span></td></tr>` : ''}
                <tr><td style="padding: 10px 16px; border-bottom: 1px solid #2a2a2a;">
                  <strong style="color: #888;">Cached Chunks:</strong> <span style="color: #ffffff;">${cd.cachedChunkCount ?? 'N/A'}</span>
                  &nbsp;|&nbsp; <strong style="color: #888;">Cache Names:</strong> <span style="color: #888; font-size: 11px;">${cd.cacheNames && Array.isArray(cd.cacheNames) ? (cd.cacheNames as string[]).join(', ') || '(none)' : 'N/A'}</span>
                </td></tr>
                <tr><td style="padding: 10px 16px;">
                  <strong style="color: #888;">PWA Mode:</strong> <span style="color: ${cd.isPWA ? '#a855f7' : '#888'};">${cd.isPWA ? 'Standalone (PWA)' : 'Browser'}</span>
                  ${cd.displayMode ? ` &nbsp;|&nbsp; <strong style="color: #888;">Display:</strong> <span style="color: #888;">${escapeHtml(String(cd.displayMode))}</span>` : ''}
                </td></tr>
              </table>
            </td>
          </tr>`
          })() : ''}

          <!-- Stack Trace -->
          ${report.error.stack ? `
          <tr>
            <td style="padding: 24px 30px; border-bottom: 1px solid #2a2a2a;">
              <h2 style="margin: 0 0 16px; color: #f43f5e; font-size: 16px; font-weight: 600;">
                📜 Stack Trace
              </h2>
              <div style="background-color: #0d0d0d; border-radius: 8px; border: 1px solid #2a2a2a; overflow: hidden;">
                <pre style="margin: 0; padding: 16px; color: #e5e5e5; font-size: 11px; font-family: 'SF Mono', Monaco, 'Courier New', monospace; white-space: pre-wrap; word-break: break-all; line-height: 1.6; overflow-x: auto;">${escapeHtml(report.error.stack)}</pre>
              </div>
            </td>
          </tr>
          ` : ''}

          <!-- Additional Data -->
          ${report.additionalData && Object.keys(report.additionalData).length > 0 ? `
          <tr>
            <td style="padding: 24px 30px; border-bottom: 1px solid #2a2a2a;">
              <h2 style="margin: 0 0 16px; color: #a855f7; font-size: 16px; font-weight: 600;">
                📦 Additional Data
              </h2>
              <div style="background-color: #0d0d0d; border-radius: 8px; border: 1px solid #2a2a2a; overflow: hidden;">
                <pre style="margin: 0; padding: 16px; color: #e5e5e5; font-size: 11px; font-family: 'SF Mono', Monaco, 'Courier New', monospace; white-space: pre-wrap; word-break: break-all; line-height: 1.6;">${escapeHtml(JSON.stringify(report.additionalData, null, 2))}</pre>
              </div>
            </td>
          </tr>
          ` : ''}

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 30px; background-color: #0d0d0d;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <p style="margin: 0; color: #666666; font-size: 11px;">
                      Ramel Barbershop Bug Reporter v${report.appVersion}
                    </p>
                  </td>
                  <td align="right">
                    <p style="margin: 0; color: #666666; font-size: 11px;">
                      This is an automated message
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()
}

/**
 * Generate plain text version of the email
 */
export function generateBugReportText(report: BugReportPayload): string {
  const lines = [
    '═══════════════════════════════════════════════════════════════',
    `BUG REPORT - ${report.error.name}`,
    '═══════════════════════════════════════════════════════════════',
    '',
    `Report ID: ${report.reportId}`,
    `Severity: ${(report.severity || 'medium').toUpperCase()}`,
    `Timestamp: ${report.timestamp}`,
    `App Version: ${report.appVersion}`,
    '',
    '───────────────────────────────────────────────────────────────',
    'ERROR SUMMARY',
    '───────────────────────────────────────────────────────────────',
    `Type: ${report.error.name}`,
    `Message: ${report.error.message}`,
    '',
    '───────────────────────────────────────────────────────────────',
    'LOCATION CONTEXT',
    '───────────────────────────────────────────────────────────────',
    `Action: ${report.action}`,
    `Page: ${report.page}`,
  ]

  if (report.route) lines.push(`Route: ${report.route}`)
  if (report.component) lines.push(`Component: ${report.component}`)

  if (report.user) {
    lines.push('')
    lines.push('───────────────────────────────────────────────────────────────')
    lines.push('USER CONTEXT')
    lines.push('───────────────────────────────────────────────────────────────')
    lines.push(`Type: ${report.user.type}`)
    if (report.user.id) lines.push(`ID: ${report.user.id}`)
    if (report.user.name) lines.push(`Name: ${report.user.name}`)
    if (report.user.phone) lines.push(`Phone: ${report.user.phone}`)
  }

  if (report.environment) {
    lines.push('')
    lines.push('───────────────────────────────────────────────────────────────')
    lines.push('ENVIRONMENT')
    lines.push('───────────────────────────────────────────────────────────────')
    if (report.environment.platform) lines.push(`Platform: ${report.environment.platform}`)
    if (report.environment.screenWidth) lines.push(`Screen: ${report.environment.screenWidth}x${report.environment.screenHeight}`)
    if (report.environment.userAgent) lines.push(`User Agent: ${report.environment.userAgent}`)
  }

  if (report.additionalData?.chunkDiagnostics) {
    const cd = report.additionalData.chunkDiagnostics as Record<string, unknown>
    lines.push('')
    lines.push('───────────────────────────────────────────────────────────────')
    lines.push('CHUNK & CACHE DIAGNOSTICS')
    lines.push('───────────────────────────────────────────────────────────────')
    if (cd.failedChunkUrl) lines.push(`Failed Chunk: ${cd.failedChunkUrl}`)
    lines.push(`Recovery Source: ${cd.recoverySource || 'unknown'}`)
    if (cd.previousRecoveryTs) lines.push(`Previous Recovery: ${cd.previousRecoveryTs}`)
    lines.push(`SW Installed: ${cd.swInstalled ? 'Yes' : 'No'}`)
    lines.push(`SW Controller: ${cd.swController ? 'Yes' : 'No'}`)
    lines.push(`SW Waiting: ${cd.swWaiting ? 'Yes (update pending!)' : 'No'}`)
    if (cd.swVersion) lines.push(`SW Version: ${cd.swVersion}`)
    if (cd.swControllerUrl) lines.push(`SW URL: ${cd.swControllerUrl}`)
    lines.push(`Cached Chunks: ${cd.cachedChunkCount ?? 'N/A'}`)
    if (cd.cacheNames && Array.isArray(cd.cacheNames)) lines.push(`Cache Names: ${(cd.cacheNames as string[]).join(', ') || '(none)'}`)
    lines.push(`PWA Mode: ${cd.isPWA ? 'Standalone (PWA)' : 'Browser'}`)
    if (cd.displayMode) lines.push(`Display Mode: ${cd.displayMode}`)
  }

  if (report.error.stack) {
    lines.push('')
    lines.push('───────────────────────────────────────────────────────────────')
    lines.push('STACK TRACE')
    lines.push('───────────────────────────────────────────────────────────────')
    lines.push(report.error.stack)
  }

  if (report.additionalData && Object.keys(report.additionalData).length > 0) {
    lines.push('')
    lines.push('───────────────────────────────────────────────────────────────')
    lines.push('ADDITIONAL DATA')
    lines.push('───────────────────────────────────────────────────────────────')
    lines.push(JSON.stringify(report.additionalData, null, 2))
  }

  lines.push('')
  lines.push('═══════════════════════════════════════════════════════════════')

  return lines.join('\n')
}

/**
 * Escape HTML special characters
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

