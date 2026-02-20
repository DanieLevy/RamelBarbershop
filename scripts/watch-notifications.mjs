#!/usr/bin/env node
/**
 * Live push notification watcher — polls Supabase notification_logs
 * and prints new entries to the terminal in real time.
 *
 * Usage (from RamelBarbershop dir):
 *   node scripts/watch-notifications.mjs
 *
 * Shows new notification_logs rows as they are inserted, including
 * all FCM errors, push results, and per-device outcomes.
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing env vars — run with dotenv or set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  console.error('Tip: NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/watch-notifications.mjs')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

let lastChecked = new Date().toISOString()

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
}

function statusColor(status) {
  if (status === 'sent') return COLORS.green
  if (status === 'partial') return COLORS.yellow
  return COLORS.red
}

async function poll() {
  const { data: logs, error } = await supabase
    .from('notification_logs')
    .select('*')
    .gt('created_at', lastChecked)
    .order('created_at', { ascending: true })

  if (error) {
    console.error(`${COLORS.red}[watch] Supabase error:${COLORS.reset}`, error.message)
    return
  }

  if (!logs?.length) return

  lastChecked = logs[logs.length - 1].created_at

  for (const log of logs) {
    const time = new Date(log.created_at).toLocaleTimeString('he-IL', { timeZone: 'Asia/Jerusalem', hour12: false })
    const color = statusColor(log.status)
    const statusStr = `${color}${log.status?.toUpperCase()}${COLORS.reset}`
    const typeStr = `${COLORS.cyan}${log.notification_type}${COLORS.reset}`
    const target = log.devices_targeted || 0
    const ok = log.devices_succeeded || 0
    const fail = log.devices_failed || 0

    console.log(`${COLORS.bold}[${time}]${COLORS.reset} ${typeStr} → ${statusStr} | devices: ${ok}✓ ${fail}✗ / ${target} total`)

    if (log.recipient_id) {
      console.log(`  ${COLORS.dim}recipient: ${log.recipient_id} (${log.recipient_type})${COLORS.reset}`)
    }
    if (log.reservation_id) {
      console.log(`  ${COLORS.dim}reservation: ${log.reservation_id}${COLORS.reset}`)
    }
    if (log.error_message) {
      console.log(`  ${COLORS.red}ERROR: ${log.error_message}${COLORS.reset}`)
    }
    if (log.sent_at) {
      console.log(`  ${COLORS.dim}sent_at: ${new Date(log.sent_at).toLocaleTimeString('he-IL', { timeZone: 'Asia/Jerusalem' })}${COLORS.reset}`)
    }
    console.log()
  }
}

console.log(`${COLORS.bold}🔔 Watching notification_logs... (Ctrl+C to stop)${COLORS.reset}`)
console.log(`${COLORS.dim}Started at ${new Date().toLocaleTimeString('he-IL', { timeZone: 'Asia/Jerusalem' })}${COLORS.reset}\n`)

// Poll every 2 seconds
setInterval(poll, 2000)
poll()
