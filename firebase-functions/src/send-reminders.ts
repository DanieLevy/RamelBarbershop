/**
 * Firebase Cloud Function — Self-Contained Reminder Processing
 *
 * Ported from: app/api/cron/process-reminders/route.ts (Netlify Next.js)
 *
 * Runs every 30 minutes. Queries Supabase for appointments within the
 * barber's reminder window that haven't been reminded yet, then sends:
 *   - SMS via 019 API
 *   - Web Push via web-push (VAPID) for PWA subscribers
 *   - FCM push via firebase-admin for native iOS/Android subscribers
 *
 * DEDUPLICATION (same as Netlify):
 *   - Regular reservations: `sms_reminder_sent_at IS NULL` filter
 *   - Recurring appointments: `last_reminder_date != today` filter
 *   Both are set IMMEDIATELY after a successful send.
 *
 * DRY_RUN MODE (set DRY_RUN=true in Firebase env vars):
 *   Only the two whitelisted users actually receive notifications and
 *   have their dedup columns marked. Everyone else is left untouched
 *   so the existing Netlify cron continues to handle them.
 *   Set DRY_RUN=false once verified to take over fully.
 *
 * Required environment variables (set via Firebase CLI or console):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   O19_SMS_API_TOKEN
 *   O19_SMS_USERNAME
 *   O19_SMS_SOURCE                  (optional, default: 'RamelBarber')
 *   VAPID_PUBLIC_KEY                 (= Netlify's NEXT_PUBLIC_VAPID_PUBLIC_KEY)
 *   VAPID_PRIVATE_KEY
 *   VAPID_EMAIL
 *   DRY_RUN                          ('true' or 'false')
 *   DRY_RUN_WHITELIST_CUSTOMER_ID    (only used when DRY_RUN=true)
 *   DRY_RUN_WHITELIST_BARBER_ID      (only used when DRY_RUN=true)
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import webpush from 'web-push'
import * as admin from 'firebase-admin'
import * as logger from 'firebase-functions/logger'

// Initialize Firebase Admin SDK with Application Default Credentials.
// In Cloud Functions v2 runtime, ADC is automatically provided by GCP.
// Must be called before any admin.messaging() or admin.firestore() calls.
if (!admin.apps.length) {
  admin.initializeApp()
}

// ============================================================
// Types (mirrored from lib/push/types.ts)
// ============================================================

type DayOfWeek = 'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday'

interface ReservationForReminder {
  id: string
  time_timestamp: number
  customer_id: string
  customer_name: string
  customer_phone: string
  barber_id: string
  barber_name: string
  service_name: string
  isRecurring?: boolean
  recurringId?: string
}

interface CustomerSettings {
  customer_id: string
  sms_reminder_enabled: boolean | null
  push_reminder_enabled: boolean | null
  reminder_method: string | null
  reminder_enabled: boolean | null
}

interface PushSubscription {
  id: string
  endpoint: string
  p256dh: string
  auth: string
  token_type: 'web_push' | 'fcm' | 'expo' | null
  fcm_token: string | null
  is_active: boolean | null
}

interface BatchResults {
  total_reservations: number
  sms_sent: number
  sms_failed: number
  push_sent: number
  push_failed: number
  skipped_disabled: number
  skipped_no_phone: number
  dry_run_skipped: number
}

// ============================================================
// Israel Timezone Utilities (no external date-fns dep needed)
// ============================================================

const ISRAEL_TZ = 'Asia/Jerusalem'
const HOUR_MS = 3_600_000

function nowMs(): number {
  return Date.now()
}

/**
 * Returns the UTC timestamp for midnight (00:00:00.000) of the current
 * day in the Israel timezone. Uses Intl to detect current offset safely.
 */
function getIsraelDayStartMs(now = Date.now()): number {
  const israelDateStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: ISRAEL_TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(now))

  // Try both Israel DST offsets (+3 summer, +2 winter)
  for (const offsetH of [3, 2]) {
    const candidate = Date.parse(israelDateStr + 'T00:00:00Z') - offsetH * HOUR_MS
    const verify = new Intl.DateTimeFormat('en-US', {
      timeZone: ISRAEL_TZ,
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    }).format(new Date(candidate))
    if (verify === '00:00:00') return candidate
  }
  // Fallback (shouldn't happen in Israel)
  return Date.parse(israelDateStr + 'T00:00:00Z') - 2 * HOUR_MS
}

function getIsraelDayEndMs(now = Date.now()): number {
  return getIsraelDayStartMs(now) + 24 * HOUR_MS - 1
}

function getDayKeyInIsrael(now = Date.now()): DayOfWeek {
  const dayName = new Intl.DateTimeFormat('en-US', {
    timeZone: ISRAEL_TZ, weekday: 'long',
  }).format(new Date(now))
  return dayName.toLowerCase() as DayOfWeek
}

function getTodayDateStr(now = Date.now()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ISRAEL_TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(now))
}

function getIsraelDateComponents(timestamp: number): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: ISRAEL_TZ,
    year: 'numeric', month: 'numeric', day: 'numeric',
  }).formatToParts(new Date(timestamp))
  const get = (type: string) => parseInt(parts.find(p => p.type === type)?.value || '0')
  return { year: get('year'), month: get('month'), day: get('day') }
}

/**
 * Convert Israel local date/time to UTC timestamp.
 * Uses the same offset detection trick as getIsraelDayStartMs.
 */
function israelDateToTimestamp(year: number, month: number, day: number, hour = 0, minute = 0): number {
  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  const dayStartMs = getIsraelDayStartMs(Date.parse(dateStr + 'T12:00:00Z'))
  return dayStartMs + (hour * 3600 + minute * 60) * 1000
}

function parseTimeString(timeStr: string): { hour: number; minute: number } {
  const [hour, minute] = timeStr.split(':').map(Number)
  return { hour: hour || 0, minute: minute || 0 }
}

function formatTimeForNotification(timestamp: number): string {
  return new Intl.DateTimeFormat('he-IL', {
    hour: '2-digit', minute: '2-digit',
    timeZone: ISRAEL_TZ, hour12: false,
  }).format(new Date(timestamp))
}

// ============================================================
// Clients (lazily initialized)
// ============================================================

// Using `any` here because this standalone Firebase project has no Database type schema.
// All table shapes are enforced by explicit TypeScript interfaces above.
let supabaseClient: SupabaseClient<any> | null = null

function getSupabase(): SupabaseClient<any> {
  if (!supabaseClient) {
    const url = process.env.SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) throw new Error('[Reminders] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    supabaseClient = createClient<any>(url, key)
  }
  return supabaseClient
}

let vapidConfigured = false

function ensureVapid() {
  if (vapidConfigured) return
  const pub = process.env.VAPID_PUBLIC_KEY?.trim()
  const priv = process.env.VAPID_PRIVATE_KEY?.trim()
  const email = process.env.VAPID_EMAIL || 'mailto:admin@ramel-barbershop.co.il'
  if (pub && priv) {
    webpush.setVapidDetails(email, pub, priv)
    vapidConfigured = true
  }
}

// ============================================================
// DRY RUN
// ============================================================

function isDryRun(): boolean {
  return process.env.DRY_RUN === 'true'
}

function isWhitelisted(customerId: string, barberId: string): boolean {
  const wlCustomer = process.env.DRY_RUN_WHITELIST_CUSTOMER_ID
  const wlBarber = process.env.DRY_RUN_WHITELIST_BARBER_ID
  return customerId === wlCustomer || barberId === wlBarber
}

// ============================================================
// SMS — 019 API
// ============================================================

function formatPhoneFor019(phone: string): string {
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.startsWith('972')) return '0' + cleaned.slice(3)
  if (cleaned.startsWith('0')) return cleaned
  return '0' + cleaned
}

function isValidIsraeliMobile(phone: string): boolean {
  return /^05[0-9]{8}$/.test(formatPhoneFor019(phone))
}

function extractFirstName(fullName: string): string {
  const first = fullName.trim().split(/\s+/)[0] || fullName.trim()
  return first.length > 10 ? first.slice(0, 10) : first
}

async function sendSmsReminder(
  phone: string,
  firstName: string,
  timestamp: number
): Promise<{ success: boolean; error?: string }> {
  const apiToken = process.env.O19_SMS_API_TOKEN
  const username = process.env.O19_SMS_USERNAME
  const source = process.env.O19_SMS_SOURCE || 'RamelBarber'

  if (!apiToken || !username) return { success: false, error: 'SMS not configured' }
  if (!isValidIsraeliMobile(phone)) return { success: false, error: `Invalid phone: ${phone}` }

  const time = new Intl.DateTimeFormat('he-IL', {
    hour: '2-digit', minute: '2-digit', timeZone: ISRAEL_TZ, hour12: false,
  }).format(new Date(timestamp))

  const truncatedName = firstName.length > 10 ? firstName.slice(0, 10) : firstName
  const message = `היי ${truncatedName}, תזכורת לתור שלך היום בשעה: ${time}. מספרת רם אל`

  const body = {
    sms: {
      user: { username },
      source,
      destinations: { phone: formatPhoneFor019(phone) },
      message,
    },
  }

  try {
    const res = await fetch('https://019sms.co.il/api', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiToken}`,
      },
      body: JSON.stringify(body),
    })
    const text = await res.text()
    const data = JSON.parse(text)
    const status = data.sms?.status ?? data.status
    const statusNum = typeof status === 'string' ? parseInt(status, 10) : status
    if (statusNum === 0) return { success: true }
    return { success: false, error: `019 status: ${statusNum}` }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}

// ============================================================
// Push Notification — build reminder payload
// ============================================================

interface ReminderPayload {
  title: string
  body: string
  url: string
  reservationId: string
  appointmentTime: number
}

function buildReminderPayload(res: ReservationForReminder): ReminderPayload {
  const time = formatTimeForNotification(res.time_timestamp)
  const barberFirstName = res.barber_name.split(' ')[0] || res.barber_name

  return {
    title: `תזכורת לתור שלך היום אצל ${barberFirstName}`,
    body: `היי ${res.customer_name}! יש לך תור ל${res.service_name} היום בשעה ${time} 💈`,
    url: `/my-appointments?highlight=${res.id}`,
    reservationId: res.id,
    appointmentTime: res.time_timestamp,
  }
}

// ============================================================
// Push — Web Push (VAPID)
// ============================================================

async function sendWebPush(
  sub: PushSubscription,
  payload: ReminderPayload
): Promise<{ success: boolean; permanent?: boolean; error?: string }> {
  ensureVapid()
  const pushSub = {
    endpoint: sub.endpoint,
    keys: { p256dh: sub.p256dh, auth: sub.auth },
  }
  const notification = JSON.stringify({
    title: payload.title,
    body: payload.body,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    tag: `reminder-${payload.reservationId}`,
    requireInteraction: true,
    data: {
      type: 'reminder',
      recipientType: 'customer',
      reservationId: payload.reservationId,
      appointmentTime: payload.appointmentTime,
      url: payload.url,
    },
  })

  try {
    await webpush.sendNotification(pushSub, notification)
    return { success: true }
  } catch (err: unknown) {
    const e = err as { statusCode?: number; message?: string }
    const code = e?.statusCode
    const permanent = code === 410 || code === 404 || code === 401
    return { success: false, permanent, error: `HTTP ${code}: ${e?.message}` }
  }
}

// ============================================================
// Push — FCM (firebase-admin)
// ============================================================

async function sendFcmPush(
  fcmToken: string,
  payload: ReminderPayload
): Promise<{ success: boolean; permanent?: boolean; error?: string }> {
  try {
    await admin.messaging().send({
      token: fcmToken,
      notification: { title: payload.title, body: payload.body },
      apns: {
        headers: { 'apns-priority': '10' },
        payload: {
          aps: {
            badge: 1,
            sound: 'default',
          },
        },
      },
      android: {
        priority: 'high',
        notification: { sound: 'default', channelId: 'default' },
      },
      data: {
        url: payload.url,
        type: 'reminder',
        reservationId: payload.reservationId,
        appointmentTime: String(payload.appointmentTime),
      },
    })
    return { success: true }
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string }
    const code = e?.code || ''
    const permanent = [
      'messaging/registration-token-not-registered',
      'messaging/invalid-registration-token',
    ].includes(code)
    // APNs key errors — server-side config, not a bad token; log prominently
    if (code === 'messaging/third-party-auth-error' || code === 'messaging/apns-auth-key-expired') {
      logger.error('[Reminders] 🚨 APNs KEY ERROR — upload a valid APNs auth key in Firebase Console > Cloud Messaging', {
        code,
        message: e?.message,
        url: 'https://console.firebase.google.com/project/ramel-barbershop-9b054/settings/cloudmessaging',
      })
    }
    return { success: false, permanent, error: `${code}: ${e?.message}` }
  }
}

// ============================================================
// Supabase — Queries
// ============================================================

async function getTodaysUnsentReservations(): Promise<ReservationForReminder[]> {
  const supabase = getSupabase()
  const now = nowMs()
  const todayStart = getIsraelDayStartMs(now)
  const todayEnd = getIsraelDayEndMs(now)

  logger.info('[Reminders] Querying regular reservations', {
    from: new Date(todayStart).toISOString(),
    to: new Date(todayEnd).toISOString(),
    now: new Date(now).toISOString(),
  })

  const { data, error } = await supabase
    .from('reservations')
    .select(`
      id,
      time_timestamp,
      customer_id,
      customer_name,
      customer_phone,
      barber_id,
      sms_reminder_sent_at,
      users!reservations_barber_id_fkey (fullname),
      services!reservations_service_id_fkey (name_he)
    `)
    .eq('status', 'confirmed')
    .gte('time_timestamp', todayStart)
    .lte('time_timestamp', todayEnd)
    .gt('time_timestamp', now)
    .is('sms_reminder_sent_at', null)
    .not('customer_id', 'is', null)
    .order('time_timestamp', { ascending: true })

  if (error) {
    logger.error('[Reminders] Error fetching reservations', { error })
    return []
  }
  if (!data?.length) return []

  // Get barber reminder window settings
  const barberIds = [...new Set(data.map(r => r.barber_id))]
  const { data: settingsData } = await supabase
    .from('barber_notification_settings')
    .select('barber_id, reminder_hours_before')
    .in('barber_id', barberIds)

  const settingsMap = new Map<string, number>()
  settingsData?.forEach(s => settingsMap.set(s.barber_id, s.reminder_hours_before))

  const reservations: ReservationForReminder[] = []
  for (const res of data) {
    const reminderHours = settingsMap.get(res.barber_id) || 3
    if (res.time_timestamp <= now + reminderHours * HOUR_MS) {
      reservations.push({
        id: res.id,
        time_timestamp: res.time_timestamp,
        customer_id: res.customer_id,
        customer_name: res.customer_name,
        customer_phone: res.customer_phone,
        barber_id: res.barber_id,
        barber_name: (res.users as { fullname?: string })?.fullname || 'הספר',
        service_name: (res.services as { name_he?: string })?.name_he || 'שירות',
      })
    }
  }

  return reservations
}

function isRecurringActiveToday(
  frequency: string | null,
  startDate: string | null,
  todayDateStr: string
): boolean {
  if (frequency !== 'biweekly') return true
  if (!startDate) return true
  const startMs = new Date(startDate).getTime()
  const todayMs = new Date(todayDateStr).getTime()
  const diffDays = Math.round((todayMs - startMs) / 86400000)
  return diffDays >= 0 && diffDays % 14 === 0
}

async function getTodaysUnsentRecurring(): Promise<ReservationForReminder[]> {
  const supabase = getSupabase()
  const now = nowMs()
  const todayStart = getIsraelDayStartMs(now)
  const dayKey = getDayKeyInIsrael(now)
  const todayDateStr = getTodayDateStr(now)

  logger.info('[Reminders] Querying recurring appointments', { dayKey, todayDateStr })

  const { data, error } = await supabase
    .from('recurring_appointments')
    .select(`
      id,
      barber_id,
      customer_id,
      time_slot,
      last_reminder_date,
      frequency,
      start_date,
      customers!recurring_appointments_customer_id_fkey (fullname, phone),
      users!recurring_appointments_barber_id_fkey (fullname),
      services!recurring_appointments_service_id_fkey (name_he)
    `)
    .eq('day_of_week', dayKey)
    .eq('is_active', true)
    .or(`last_reminder_date.is.null,last_reminder_date.neq.${todayDateStr}`)

  if (error) {
    logger.error('[Reminders] Error fetching recurring', { error })
    return []
  }
  if (!data?.length) return []

  // Filter biweekly recurring to only the active alternating week
  const activeData = data.filter(rec =>
    isRecurringActiveToday(rec.frequency, rec.start_date, todayDateStr)
  )

  if (activeData.length < data.length) {
    logger.info('[Reminders] Filtered biweekly recurring on off-week', {
      total: data.length,
      active: activeData.length,
    })
  }

  if (!activeData.length) return []

  // Check barber closures
  const barberIds = [...new Set(activeData.map(r => r.barber_id))]
  const { data: closuresData } = await supabase
    .from('barber_closures')
    .select('barber_id')
    .in('barber_id', barberIds)
    .lte('start_date', todayDateStr)
    .gte('end_date', todayDateStr)

  const barbersClosed = new Set<string>(closuresData?.map(c => c.barber_id) || [])

  const { data: settingsData } = await supabase
    .from('barber_notification_settings')
    .select('barber_id, reminder_hours_before')
    .in('barber_id', barberIds)

  const settingsMap = new Map<string, number>()
  settingsData?.forEach(s => settingsMap.set(s.barber_id, s.reminder_hours_before))

  const result: ReservationForReminder[] = []

  for (const rec of activeData) {
    if (barbersClosed.has(rec.barber_id)) continue

    const { hour, minute } = parseTimeString(rec.time_slot)
    const { year, month, day } = getIsraelDateComponents(todayStart)
    const appointmentTime = israelDateToTimestamp(year, month, day, hour, minute)

    if (appointmentTime <= now) continue

    const reminderHours = settingsMap.get(rec.barber_id) || 3
    if (appointmentTime > now + reminderHours * HOUR_MS) continue

    const customer = rec.customers as unknown as { fullname: string; phone: string } | null
    const barber = rec.users as unknown as { fullname: string } | null
    const service = rec.services as unknown as { name_he: string } | null

    result.push({
      id: `recurring-${rec.id}`,
      time_timestamp: appointmentTime,
      customer_id: rec.customer_id,
      customer_name: customer?.fullname || 'לקוח קבוע',
      customer_phone: customer?.phone || '',
      barber_id: rec.barber_id,
      barber_name: barber?.fullname || 'הספר',
      service_name: service?.name_he || 'שירות',
      isRecurring: true,
      recurringId: rec.id,
    })
  }

  return result
}

async function getCustomerSettings(ids: string[]): Promise<Map<string, CustomerSettings>> {
  const map = new Map<string, CustomerSettings>()
  if (!ids.length) return map

  const supabase = getSupabase()
  const { data } = await supabase
    .from('customer_notification_settings')
    .select('customer_id, sms_reminder_enabled, push_reminder_enabled, reminder_method, reminder_enabled')
    .in('customer_id', ids)

  data?.forEach(s => map.set(s.customer_id, s))
  return map
}

async function getCustomerPushSubscriptions(customerId: string): Promise<PushSubscription[]> {
  const supabase = getSupabase()
  const { data } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth, token_type, fcm_token, is_active')
    .eq('customer_id', customerId)
    .eq('is_active', true)

  return (data as PushSubscription[]) || []
}

async function markSmsReminderSent(reservationId: string): Promise<void> {
  const supabase = getSupabase()
  for (let attempt = 0; attempt < 3; attempt++) {
    const { error } = await supabase
      .from('reservations')
      .update({ sms_reminder_sent_at: new Date().toISOString() })
      .eq('id', reservationId)
      .is('sms_reminder_sent_at', null)
    if (!error) return
    if (attempt < 2) {
      await new Promise(r => setTimeout(r, 400 * (attempt + 1)))
    } else {
      logger.error('[Reminders] ❌ Failed to mark sms_reminder_sent_at after 3 attempts', { reservationId })
    }
  }
}

async function markRecurringReminderSent(recurringId: string): Promise<void> {
  const supabase = getSupabase()
  for (let attempt = 0; attempt < 3; attempt++) {
    const { error } = await supabase
      .from('recurring_appointments')
      .update({ last_reminder_date: getTodayDateStr() })
      .eq('id', recurringId)
    if (!error) return
    if (attempt < 2) {
      await new Promise(r => setTimeout(r, 400 * (attempt + 1)))
    } else {
      logger.error('[Reminders] ❌ Failed to mark last_reminder_date after 3 attempts', { recurringId })
    }
  }
}

async function deactivateSubscription(subId: string): Promise<void> {
  const supabase = getSupabase()
  await supabase
    .from('push_subscriptions')
    .update({ is_active: false, consecutive_failures: 5 })
    .eq('id', subId)
}

async function saveBatchLog(results: BatchResults, durationMs: number): Promise<void> {
  try {
    const supabase = getSupabase()
    await supabase.from('reminder_batch_logs').insert({
      duration_ms: durationMs,
      total_reservations: results.total_reservations,
      sms_sent: results.sms_sent,
      sms_failed: results.sms_failed,
      push_sent: results.push_sent,
      push_failed: results.push_failed,
      skipped_already_sent: 0,
      skipped_disabled: results.skipped_disabled,
      skipped_no_phone: results.skipped_no_phone,
      trigger_source: 'firebase',
    })
  } catch (err) {
    logger.warn('[Reminders] Could not save batch log', { err })
  }
}

// ============================================================
// Notification method logic
// ============================================================

function getNotificationMethods(
  settings: CustomerSettings | undefined,
  hasPhone: boolean,
  hasPushSub: boolean
): { sendSms: boolean; sendPush: boolean } {
  if (!settings) return { sendSms: hasPhone, sendPush: hasPushSub }
  if (settings.reminder_enabled === false) return { sendSms: false, sendPush: false }

  const method = settings.reminder_method || 'both'
  switch (method) {
    case 'sms':   return { sendSms: hasPhone, sendPush: false }
    case 'push':  return { sendSms: false, sendPush: hasPushSub }
    case 'none':  return { sendSms: false, sendPush: false }
    default: {
      const smsOk  = settings.sms_reminder_enabled  !== false
      const pushOk = settings.push_reminder_enabled !== false
      return { sendSms: smsOk && hasPhone, sendPush: pushOk && hasPushSub }
    }
  }
}

// ============================================================
// Mark completed reservations
// ============================================================

async function markCompletedReservations(): Promise<number> {
  const supabase = getSupabase()
  const nowMs = Date.now()

  const { data, error } = await supabase
    .from('reservations')
    .update({ status: 'completed' })
    .eq('status', 'confirmed')
    .lt('time_timestamp', nowMs)
    .select('id')

  if (error) {
    logger.error('[Completed] Error marking reservations completed', { error })
    return 0
  }

  const count = data?.length || 0
  if (count > 0) {
    logger.info(`[Completed] Marked ${count} past reservations as completed`)
  }
  return count
}

// ============================================================
// Main export
// ============================================================

export async function processReminders(): Promise<BatchResults> {
  const start = Date.now()
  const dryRun = isDryRun()

  logger.info('[Reminders] ========================================')
  logger.info('[Reminders] Starting reminder batch', {
    dryRun,
    time: new Date().toISOString(),
  })

  // Mark past confirmed reservations as completed before processing reminders
  await markCompletedReservations()

  const results: BatchResults = {
    total_reservations: 0,
    sms_sent: 0,
    sms_failed: 0,
    push_sent: 0,
    push_failed: 0,
    skipped_disabled: 0,
    skipped_no_phone: 0,
    dry_run_skipped: 0,
  }

  const [regular, recurring] = await Promise.all([
    getTodaysUnsentReservations(),
    getTodaysUnsentRecurring(),
  ])

  const reservations = [...regular, ...recurring]
  results.total_reservations = reservations.length

  logger.info('[Reminders] Found reservations', {
    total: reservations.length,
    regular: regular.length,
    recurring: recurring.length,
  })

  if (!reservations.length) {
    await saveBatchLog(results, Date.now() - start)
    return results
  }

  // Pre-fetch customer settings and push subscriptions
  const customerIds = [...new Set(reservations.map(r => r.customer_id))]
  const [customerSettings, ...pushSubArrays] = await Promise.all([
    getCustomerSettings(customerIds),
    ...customerIds.map(id => getCustomerPushSubscriptions(id)),
  ])

  const pushSubMap = new Map<string, PushSubscription[]>()
  customerIds.forEach((id, i) => pushSubMap.set(id, pushSubArrays[i]))

  // Process in batches of 5
  const BATCH_SIZE = 5
  for (let i = 0; i < reservations.length; i += BATCH_SIZE) {
    const batch = reservations.slice(i, i + BATCH_SIZE)

    const batchOutcomes = await Promise.allSettled(batch.map(async res => {
      const settings = customerSettings.get(res.customer_id)
      const subs = pushSubMap.get(res.customer_id) || []
      const hasPhone = isValidIsraeliMobile(res.customer_phone)
      const hasPushSub = subs.length > 0

      const { sendSms, sendPush } = getNotificationMethods(settings, hasPhone, hasPushSub)

      if (!sendSms && !sendPush) {
        if (!hasPhone && !hasPushSub) return { type: 'no_phone' as const }
        return { type: 'disabled' as const }
      }

      // DRY RUN: skip non-whitelisted users silently
      if (dryRun && !isWhitelisted(res.customer_id, res.barber_id)) {
        return { type: 'dry_run_skipped' as const }
      }

      // Always mark dedup after successful send.
      // DRY_RUN=true: Firebase sends only to whitelisted users and marks their rows.
      // Netlify (runs 97s later) sees rows already marked → naturally skips them.
      const skipDedup = false

      const payload = buildReminderPayload(res)
      let smsSent = false, smsFailed = false, pushSent = false, pushFailed = false

      // SMS
      if (sendSms) {
        const firstName = extractFirstName(res.customer_name)
        const smsResult = await sendSmsReminder(res.customer_phone, firstName, res.time_timestamp)

        if (smsResult.success) {
          smsSent = true
          if (!skipDedup) {
            if (res.isRecurring && res.recurringId) {
              await markRecurringReminderSent(res.recurringId)
            } else {
              await markSmsReminderSent(res.id)
            }
          }
          logger.info('[Reminders] ✅ SMS sent', { id: res.id, recurring: res.isRecurring, skipDedup })
        } else {
          smsFailed = true
          logger.error('[Reminders] ❌ SMS failed', { id: res.id, error: smsResult.error })
        }
      }

      // Push
      if (sendPush) {
        const pushResults = await Promise.allSettled(subs.map(async sub => {
          let result: { success: boolean; permanent?: boolean; error?: string }
          const subType = sub.token_type === 'fcm' ? 'FCM' : 'web_push'

          if (sub.token_type === 'fcm' && sub.fcm_token) {
            result = await sendFcmPush(sub.fcm_token, payload)
          } else {
            result = await sendWebPush(sub, payload)
          }

          if (result.success) {
            logger.info('[Reminders] ✅ Push delivered', { subId: sub.id, type: subType, resId: res.id })
          } else {
            logger.warn('[Reminders] ❌ Push failed', {
              subId: sub.id,
              type: subType,
              resId: res.id,
              error: result.error,
              permanent: result.permanent ?? false,
            })
          }

          if (!result.success && result.permanent) {
            await deactivateSubscription(sub.id)
          }
          return result
        }))

        const succeeded = pushResults.filter(r => r.status === 'fulfilled' && r.value.success).length
        const failed = pushResults.length - succeeded

        if (succeeded > 0) {
          pushSent = true
          logger.info('[Reminders] ✅ Push batch done', { id: res.id, sent: succeeded, failed })
        }
        if (failed > 0) {
          pushFailed = true
          logger.warn('[Reminders] ⚠️ Push batch had failures', { id: res.id, sent: succeeded, failed })
        }
      }

      return { type: 'processed' as const, smsSent, smsFailed, pushSent, pushFailed }
    }))

    for (const outcome of batchOutcomes) {
      if (outcome.status === 'rejected') {
        logger.error('[Reminders] Unexpected batch error', { err: outcome.reason })
        results.sms_failed++
        continue
      }
      const v = outcome.value
      if (v.type === 'dry_run_skipped') { results.dry_run_skipped++; continue }
      if (v.type === 'disabled') { results.skipped_disabled++; continue }
      if (v.type === 'no_phone') { results.skipped_no_phone++; continue }
      if (v.smsSent)   results.sms_sent++
      if (v.smsFailed) results.sms_failed++
      if (v.pushSent)  results.push_sent++
      if (v.pushFailed) results.push_failed++
    }
  }

  const durationMs = Date.now() - start
  await saveBatchLog(results, durationMs)

  logger.info('[Reminders] ========================================')
  logger.info('[Reminders] Completed', {
    durationMs,
    dryRun,
    results,
  })

  return results
}
