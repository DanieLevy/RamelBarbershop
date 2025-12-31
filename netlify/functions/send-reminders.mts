/**
 * Netlify Scheduled Function: Send Appointment Reminders
 * 
 * This function runs every hour to send push notification reminders
 * for upcoming appointments. Netlify's free tier supports scheduled
 * functions without the limitations of Vercel's hobby plan.
 * 
 * Schedule: Every hour at minute 0 (0 * * * *)
 * 
 * Uses the same core logic as Vercel cron for consistency.
 */

import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'
import type { Config } from '@netlify/functions'

// Constants
const MAX_REMINDER_HOURS = 24
const HOUR_MS = 3600000

// Types
interface AppointmentForReminder {
  id: string
  time_timestamp: number
  customer_id: string
  customer_name: string
  barber_id: string
  barber_name: string
  service_name: string
  reminder_hours_before: number
}

interface ReminderJobResults {
  checked: number
  sent: number
  skipped: number
  alreadySent: number
  noSubscription: number
  disabled: number
  failed: number
  errors: string[]
}

// Initialize Supabase
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// Initialize web-push
function initWebPush() {
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || ''
  const vapidEmail = process.env.VAPID_EMAIL || 'mailto:admin@ramel-barbershop.co.il'

  if (vapidPublicKey && vapidPrivateKey) {
    webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey)
    return true
  }
  return false
}

/**
 * Get appointments that need reminders sent right now
 */
async function getAppointmentsForReminders(): Promise<AppointmentForReminder[]> {
  const supabase = getSupabase()
  const now = Date.now()
  const maxWindowEnd = now + (MAX_REMINDER_HOURS * HOUR_MS)

  const { data, error } = await supabase
    .from('reservations')
    .select(`
      id,
      time_timestamp,
      customer_id,
      customer_name,
      barber_id,
      users!reservations_barber_id_fkey (
        fullname
      ),
      services!reservations_service_id_fkey (
        name_he
      )
    `)
    .eq('status', 'confirmed')
    .gt('time_timestamp', now)
    .lte('time_timestamp', maxWindowEnd)
    .not('customer_id', 'is', null)

  if (error || !data?.length) {
    if (error) console.error('[Netlify] Error fetching appointments:', error)
    return []
  }

  // Get barber settings
  const barberIds = [...new Set(data.map(r => r.barber_id).filter(Boolean))]
  const { data: settingsData } = await supabase
    .from('barber_notification_settings')
    .select('barber_id, reminder_hours_before')
    .in('barber_id', barberIds)

  const settingsMap = new Map<string, number>()
  settingsData?.forEach(s => settingsMap.set(s.barber_id, s.reminder_hours_before))

  // Filter to appointments within their barber's reminder window
  // FIXED: Include ALL appointments from now until reminderHours ahead
  // The wasReminderSent check prevents duplicates, so we catch:
  // 1. Appointments in the normal window
  // 2. Late-booked appointments that missed earlier windows
  const appointments: AppointmentForReminder[] = []

  for (const res of data) {
    const reminderHours = settingsMap.get(res.barber_id) || 3
    const windowEnd = now + (reminderHours * HOUR_MS)

    // Include any appointment from NOW until reminderHours ahead
    // This ensures late-booked appointments still get reminders
    if (res.time_timestamp <= windowEnd) {
      // Calculate hours until appointment for the notification message
      const hoursUntil = Math.round((res.time_timestamp - now) / HOUR_MS)
      
      appointments.push({
        id: res.id,
        time_timestamp: res.time_timestamp,
        customer_id: res.customer_id!,
        customer_name: res.customer_name,
        barber_id: res.barber_id,
        barber_name: (res.users as { fullname?: string })?.fullname || 'הספר',
        service_name: (res.services as { name_he?: string })?.name_he || 'שירות',
        // Use actual hours until, capped at minimum 1 for display
        reminder_hours_before: Math.max(1, hoursUntil)
      })
    }
  }

  return appointments
}

/**
 * Check if reminder was already sent
 */
async function wasReminderSent(reservationId: string): Promise<boolean> {
  const supabase = getSupabase()
  const { data } = await supabase
    .from('notification_logs')
    .select('id')
    .eq('notification_type', 'reminder')
    .eq('reservation_id', reservationId)
    .in('status', ['sent', 'partial'])
    .limit(1)

  return data !== null && data.length > 0
}

/**
 * Check if customer has active subscription
 */
async function hasActiveSubscription(customerId: string): Promise<boolean> {
  const supabase = getSupabase()
  const { count } = await supabase
    .from('push_subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', customerId)
    .eq('is_active', true)

  return (count || 0) > 0
}

/**
 * Check if customer has reminders enabled
 */
async function isReminderEnabled(customerId: string): Promise<boolean> {
  const supabase = getSupabase()
  const { data } = await supabase
    .from('customer_notification_settings')
    .select('reminder_enabled')
    .eq('customer_id', customerId)
    .single()

  return data?.reminder_enabled !== false
}

/**
 * Get customer subscriptions
 */
async function getCustomerSubscriptions(customerId: string) {
  const supabase = getSupabase()
  const { data } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('customer_id', customerId)
    .eq('is_active', true)

  return data || []
}

/**
 * Format time for notification
 */
function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jerusalem'
  }
  return new Intl.DateTimeFormat('he-IL', options).format(date)
}

/**
 * Format time duration in proper Hebrew grammar
 * Handles special cases for 1, 2, and 3+ units
 */
function formatHebrewDuration(minutes: number): string {
  if (minutes < 60) {
    // Minutes
    if (minutes === 1) return 'דקה אחת'
    if (minutes === 2) return 'שתי דקות'
    if (minutes <= 10) return `${minutes} דקות`
    if (minutes <= 20) return `${minutes} דקות`
    return `${minutes} דקות`
  }
  
  const hours = Math.round(minutes / 60)
  
  // Hours - proper Hebrew grammar
  if (hours === 1) return 'שעה'
  if (hours === 2) return 'שעתיים'
  if (hours <= 10) return `${hours} שעות`
  if (hours === 11) return 'אחת עשרה שעות'
  if (hours === 12) return 'שתים עשרה שעות'
  return `${hours} שעות`
}

/**
 * Get unread notification count for a customer
 */
async function getUnreadCount(customerId: string): Promise<number> {
  const supabase = getSupabase()
  const { count, error } = await supabase
    .from('notification_logs')
    .select('*', { count: 'exact', head: true })
    .eq('recipient_type', 'customer')
    .eq('recipient_id', customerId)
    .eq('is_read', false)
    .eq('status', 'sent')
    .in('notification_type', ['reminder', 'cancellation', 'booking_confirmed'])

  if (error) {
    console.error('[Netlify] Error getting unread count:', error)
    return 1
  }
  return count || 0
}

/**
 * Send reminder to customer
 */
async function sendReminder(apt: AppointmentForReminder): Promise<{ sent: number; failed: number; errors: string[] }> {
  const supabase = getSupabase()
  const subscriptions = await getCustomerSubscriptions(apt.customer_id)
  
  if (!subscriptions.length) {
    return { sent: 0, failed: 0, errors: ['No subscriptions'] }
  }

  const formattedTime = formatTime(apt.time_timestamp)
  
  // Build dynamic title with proper Hebrew grammar
  const minutesUntil = Math.round((apt.time_timestamp - Date.now()) / 60000)
  const timeText = formatHebrewDuration(minutesUntil)

  // First, create the notification log (so it counts in the badge)
  const { data: logData } = await supabase.from('notification_logs').insert({
    notification_type: 'reminder',
    recipient_type: 'customer',
    recipient_id: apt.customer_id,
    reservation_id: apt.id,
    title: `תזכורת לתור`,
    body: `תור ל${apt.service_name} עם ${apt.barber_name}`,
    status: 'pending',
    is_read: false, // New notifications are unread
    devices_targeted: subscriptions.length,
    devices_succeeded: 0,
    devices_failed: 0
  }).select('id').single()

  // Get accurate unread count (includes this new notification)
  const badgeCount = await getUnreadCount(apt.customer_id)
  console.log(`[Netlify] Badge count for customer ${apt.customer_id}: ${badgeCount}`)

  const payload = JSON.stringify({
    notification: {
      title: `⏰ תזכורת: התור שלך בעוד ${timeText}`,
      body: `היי ${apt.customer_name}! יש לך תור ל${apt.service_name} עם ${apt.barber_name} ב${formattedTime}`,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      tag: `reminder-${apt.id}`,
      requireInteraction: true,
      data: {
        url: `/my-appointments?highlight=${apt.id}`,
        type: 'reminder',
        reservationId: apt.id
      }
    },
    badgeCount: badgeCount || 1 // Fallback to 1 if count is 0
  })

  let sent = 0
  let failed = 0
  const errors: string[] = []

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      )
      sent++

      await supabase
        .from('push_subscriptions')
        .update({ last_used: new Date().toISOString(), consecutive_failures: 0 })
        .eq('id', sub.id)
    } catch (err: unknown) {
      failed++
      const error = err as { message?: string; statusCode?: number }
      errors.push(error.message || 'Unknown error')

      if (error.statusCode && [410, 404, 401].includes(error.statusCode)) {
        await supabase
          .from('push_subscriptions')
          .update({ is_active: false })
          .eq('id', sub.id)
      }
    }
  }

  // Update the notification log with results
  if (logData?.id) {
    await supabase.from('notification_logs').update({
      status: sent === subscriptions.length ? 'sent' : sent > 0 ? 'partial' : 'failed',
      devices_succeeded: sent,
      devices_failed: failed,
      sent_at: new Date().toISOString()
    }).eq('id', logData.id)
  }

  return { sent, failed, errors }
}

/**
 * Main handler
 */
const handler = async (_req: Request) => {
  const startTime = Date.now()
  
  console.log('[Netlify] Send reminders function triggered')

  // Initialize VAPID
  if (!initWebPush()) {
    console.error('[Netlify] VAPID keys not configured')
    return new Response(JSON.stringify({
      success: false,
      error: 'VAPID keys not configured'
    }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }

  const results: ReminderJobResults = {
    checked: 0,
    sent: 0,
    skipped: 0,
    alreadySent: 0,
    noSubscription: 0,
    disabled: 0,
    failed: 0,
    errors: []
  }

  try {
    // Get appointments
    const appointments = await getAppointmentsForReminders()
    results.checked = appointments.length
    console.log(`[Netlify] Found ${appointments.length} appointments in reminder windows`)

    // Process each appointment
    for (const apt of appointments) {
      try {
        if (await wasReminderSent(apt.id)) {
          results.alreadySent++
          continue
        }

        if (!await hasActiveSubscription(apt.customer_id)) {
          results.noSubscription++
          continue
        }

        if (!await isReminderEnabled(apt.customer_id)) {
          results.disabled++
          continue
        }

        const result = await sendReminder(apt)
        results.sent += result.sent
        results.failed += result.failed
        results.errors.push(...result.errors)

        console.log(`[Netlify] Reminder sent for ${apt.id}: ${result.sent} sent, ${result.failed} failed`)
      } catch (err) {
        results.failed++
        const errorMsg = err instanceof Error ? err.message : 'Unknown error'
        results.errors.push(`${apt.id}: ${errorMsg}`)
        console.error(`[Netlify] Error processing ${apt.id}:`, err)
      }
    }

    results.skipped = results.alreadySent + results.noSubscription + results.disabled

    const response = {
      success: true,
      source: 'netlify',
      message: 'Reminder job completed',
      executedAt: new Date().toISOString(),
      duration: Date.now() - startTime,
      reminders: results
    }

    console.log('[Netlify] Job completed', response)

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('[Netlify] Error:', error)

    return new Response(JSON.stringify({
      success: false,
      source: 'netlify',
      error: error instanceof Error ? error.message : 'Unknown error',
      executedAt: new Date().toISOString(),
      duration: Date.now() - startTime,
      reminders: results
    }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}

/**
 * Schedule: Run every hour at minute 0
 * This provides much more frequent execution than Vercel's free tier (2/day)
 */
export const config: Config = {
  schedule: '0 * * * *'
}

export default handler

