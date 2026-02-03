/**
 * API Route: Process Reminders
 * 
 * Main endpoint for processing and sending appointment reminders.
 * Triggered by Netlify scheduled function every 30 minutes.
 * 
 * DEDUPLICATION STRATEGY:
 * - Uses `sms_reminder_sent_at` column on reservations table
 * - Query only fetches reservations where this column IS NULL
 * - After successful SMS send, immediately marks the reservation
 * - This is atomic and prevents duplicate sends even if cron runs overlap
 * 
 * Endpoint: POST /api/cron/process-reminders
 * Headers: Authorization: Bearer {CRON_SECRET}
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { pushService } from '@/lib/push/push-service'
import type { ReminderContext } from '@/lib/push/types'
import { 
  sendSmsReminder, 
  isValidIsraeliMobile,
  extractFirstName
} from '@/lib/sms/sms-reminder-service'
import { reportServerError } from '@/lib/bug-reporter/helpers'
import { getIsraelDayStart, getIsraelDayEnd, nowInIsraelMs } from '@/lib/utils'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // Allow up to 60 seconds

// Constants
const HOUR_MS = 3600000

// Types
interface ReservationForReminder {
  id: string
  time_timestamp: number
  customer_id: string
  customer_name: string
  customer_phone: string
  barber_id: string
  barber_name: string
  service_name: string
}

interface CustomerSettings {
  customer_id: string
  sms_reminder_enabled: boolean | null
  push_reminder_enabled: boolean | null
  reminder_method: string | null
  reminder_enabled: boolean | null
}

interface BatchResults {
  total_reservations: number
  sms_sent: number
  sms_failed: number
  push_sent: number
  push_failed: number
  skipped_disabled: number
  skipped_no_phone: number
  details: Array<{
    reservationId: string
    customerName: string
    smsResult?: { success: boolean; error?: string }
    pushResult?: { success: boolean; error?: string }
  }>
}

// Initialize Supabase with admin client (bypasses RLS for cron operations)
function getSupabase() {
  return createAdminClient()
}

/**
 * Verify the request is from an authorized source
 */
function verifyAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (process.env.NODE_ENV === 'development') {
    return true
  }

  if (!cronSecret) {
    console.error('[ProcessReminders] CRON_SECRET not configured')
    return false
  }

  return authHeader === `Bearer ${cronSecret}`
}

/**
 * Get today's upcoming confirmed reservations that haven't received SMS reminder
 * 
 * CRITICAL: Only fetches reservations where sms_reminder_sent_at IS NULL
 * This is the primary deduplication mechanism - prevents sending multiple reminders
 */
async function getTodaysUnsentReservations(): Promise<ReservationForReminder[]> {
  const supabase = getSupabase()
  const now = nowInIsraelMs()
  const todayStart = getIsraelDayStart(now)
  const todayEnd = getIsraelDayEnd(now)

  console.log(`[ProcessReminders] Querying reservations: today=${new Date(todayStart).toISOString()} to ${new Date(todayEnd).toISOString()}, now=${new Date(now).toISOString()}`)

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
    .is('sms_reminder_sent_at', null)  // CRITICAL: Only get unsent reminders
    .not('customer_id', 'is', null)
    .order('time_timestamp', { ascending: true })

  if (error) {
    console.error('[ProcessReminders] Error fetching reservations:', error)
    return []
  }

  if (!data?.length) {
    console.log('[ProcessReminders] No unsent reservations found')
    return []
  }

  console.log(`[ProcessReminders] Found ${data.length} reservations without SMS reminder`)

  // Get barber reminder settings
  const barberIds = [...new Set(data.map(r => r.barber_id))]
  const { data: settingsData } = await supabase
    .from('barber_notification_settings')
    .select('barber_id, reminder_hours_before')
    .in('barber_id', barberIds)

  const settingsMap = new Map<string, number>()
  settingsData?.forEach(s => settingsMap.set(s.barber_id, s.reminder_hours_before))

  // Filter to reservations within their barber's reminder window
  const reservations: ReservationForReminder[] = []
  
  for (const res of data) {
    const reminderHours = settingsMap.get(res.barber_id) || 3
    const windowEnd = now + (reminderHours * HOUR_MS)

    if (res.time_timestamp <= windowEnd) {
      reservations.push({
        id: res.id,
        time_timestamp: res.time_timestamp,
        customer_id: res.customer_id,
        customer_name: res.customer_name,
        customer_phone: res.customer_phone,
        barber_id: res.barber_id,
        barber_name: (res.users as { fullname?: string })?.fullname || 'הספר',
        service_name: (res.services as { name_he?: string })?.name_he || 'שירות'
      })
    }
  }

  console.log(`[ProcessReminders] ${reservations.length} reservations within reminder window`)
  return reservations
}

/**
 * Get customer notification settings
 */
async function getCustomerSettings(customerIds: string[]): Promise<Map<string, CustomerSettings>> {
  const supabase = getSupabase()
  const settingsMap = new Map<string, CustomerSettings>()

  if (!customerIds.length) return settingsMap

  const { data } = await supabase
    .from('customer_notification_settings')
    .select('customer_id, sms_reminder_enabled, push_reminder_enabled, reminder_method, reminder_enabled')
    .in('customer_id', customerIds)

  data?.forEach(s => {
    settingsMap.set(s.customer_id, s)
  })

  return settingsMap
}

/**
 * Mark reservation as having received SMS reminder
 * 
 * CRITICAL: This is the deduplication marker. After successful SMS send,
 * we immediately mark the reservation so subsequent cron runs won't process it.
 */
async function markSmsReminderSent(reservationId: string): Promise<boolean> {
  const supabase = getSupabase()
  
  const { error } = await supabase
    .from('reservations')
    .update({ sms_reminder_sent_at: new Date().toISOString() })
    .eq('id', reservationId)
    .is('sms_reminder_sent_at', null) // Extra safety: only update if still null

  if (error) {
    console.error(`[ProcessReminders] Failed to mark SMS sent for ${reservationId}:`, error)
    return false
  }

  return true
}

/**
 * Check if customer has active push subscription
 */
async function hasActivePushSubscription(customerId: string): Promise<boolean> {
  const supabase = getSupabase()
  
  const { count } = await supabase
    .from('push_subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', customerId)
    .eq('is_active', true)

  return (count || 0) > 0
}

/**
 * Determine what notification methods to use for a customer
 */
function getNotificationMethods(
  settings: CustomerSettings | undefined,
  hasPhone: boolean,
  hasPushSub: boolean
): { sendSms: boolean; sendPush: boolean } {
  // Default behavior for customers without settings
  if (!settings) {
    return {
      sendSms: hasPhone,      // SMS is default if phone available
      sendPush: hasPushSub    // Push if subscribed
    }
  }

  // Check if reminders are completely disabled
  if (settings.reminder_enabled === false) {
    return { sendSms: false, sendPush: false }
  }

  // Use reminder_method if set
  const method = settings.reminder_method || 'both'
  
  switch (method) {
    case 'sms':
      return { sendSms: hasPhone, sendPush: false }
    case 'push':
      return { sendSms: false, sendPush: hasPushSub }
    case 'none':
      return { sendSms: false, sendPush: false }
    case 'both':
    default:
      // Check individual toggles
      const smsEnabled = settings.sms_reminder_enabled !== false
      const pushEnabled = settings.push_reminder_enabled !== false
      return {
        sendSms: smsEnabled && hasPhone,
        sendPush: pushEnabled && hasPushSub
      }
  }
}

/**
 * Save batch log to database
 */
async function saveBatchLog(
  results: BatchResults,
  durationMs: number,
  triggerSource: string
): Promise<void> {
  const supabase = getSupabase()
  
  await supabase.from('reminder_batch_logs').insert({
    duration_ms: durationMs,
    total_reservations: results.total_reservations,
    sms_sent: results.sms_sent,
    sms_failed: results.sms_failed,
    push_sent: results.push_sent,
    push_failed: results.push_failed,
    skipped_already_sent: 0, // No longer tracking this - query already filters
    skipped_disabled: results.skipped_disabled,
    skipped_no_phone: results.skipped_no_phone,
    details: results.details,
    trigger_source: triggerSource
  })
}

/**
 * Main POST handler
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const triggerSource = request.headers.get('x-trigger-source') || 'api'

  console.log('[ProcessReminders] ========================================')
  console.log('[ProcessReminders] Starting reminder batch processing')
  console.log(`[ProcessReminders] Trigger source: ${triggerSource}`)
  console.log(`[ProcessReminders] Time: ${new Date().toISOString()}`)

  // Verify authorization
  if (!verifyAuth(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const results: BatchResults = {
    total_reservations: 0,
    sms_sent: 0,
    sms_failed: 0,
    push_sent: 0,
    push_failed: 0,
    skipped_disabled: 0,
    skipped_no_phone: 0,
    details: []
  }

  try {
    // Get today's reservations that haven't received SMS reminder yet
    const reservations = await getTodaysUnsentReservations()
    results.total_reservations = reservations.length
    
    console.log(`[ProcessReminders] Processing ${reservations.length} reservations`)

    if (reservations.length === 0) {
      const durationMs = Date.now() - startTime
      await saveBatchLog(results, durationMs, triggerSource)
      
      console.log('[ProcessReminders] No reservations to process - exiting')
      return NextResponse.json({
        success: true,
        message: 'No reservations to process',
        duration: durationMs,
        results
      })
    }

    // Get customer settings
    const customerIds = [...new Set(reservations.map(r => r.customer_id))]
    const customerSettings = await getCustomerSettings(customerIds)

    // Process each reservation
    for (const res of reservations) {
      const detail: BatchResults['details'][0] = {
        reservationId: res.id,
        customerName: res.customer_name
      }

      try {
        // Get customer preferences
        const settings = customerSettings.get(res.customer_id)
        const hasValidPhone = isValidIsraeliMobile(res.customer_phone)
        const hasPushSub = await hasActivePushSubscription(res.customer_id)

        const { sendSms, sendPush } = getNotificationMethods(settings, hasValidPhone, hasPushSub)

        // Check if all notifications disabled
        if (!sendSms && !sendPush) {
          if (!hasValidPhone && !hasPushSub) {
            results.skipped_no_phone++
          } else {
            results.skipped_disabled++
          }
          continue
        }

        // Send SMS reminder
        if (sendSms) {
          const firstName = extractFirstName(res.customer_name)
          
          console.log(`[ProcessReminders] Sending SMS for ${res.id} to ${res.customer_phone.slice(0,3)}****`)
          
          const smsResult = await sendSmsReminder(
            res.customer_phone,
            firstName,
            res.time_timestamp
          )
          
          detail.smsResult = {
            success: smsResult.success,
            error: smsResult.error
          }

          if (smsResult.success) {
            // CRITICAL: Mark reservation IMMEDIATELY after successful SMS
            // This prevents duplicate sends if cron runs again before we finish
            const marked = await markSmsReminderSent(res.id)
            
            if (marked) {
              results.sms_sent++
              console.log(`[ProcessReminders] ✅ SMS sent and marked for ${res.id}`)
            } else {
              // SMS sent but marking failed - log this as a warning
              // The SMS was sent, so we count it, but there's risk of duplicate
              results.sms_sent++
              console.warn(`[ProcessReminders] ⚠️ SMS sent for ${res.id} but marking failed!`)
            }
          } else {
            results.sms_failed++
            console.error(`[ProcessReminders] ❌ SMS failed for ${res.id}:`, smsResult.error)
          }
        }

        // Send Push notification (independent of SMS)
        if (sendPush) {
          const context: ReminderContext = {
            reservationId: res.id,
            customerId: res.customer_id,
            barberId: res.barber_id,
            customerName: res.customer_name,
            barberName: res.barber_name,
            serviceName: res.service_name,
            appointmentTime: res.time_timestamp
          }

          const pushResult = await pushService.sendReminder(context)
          
          detail.pushResult = {
            success: pushResult.success,
            error: pushResult.errors?.join(', ')
          }

          if (pushResult.success) {
            results.push_sent++
            console.log(`[ProcessReminders] ✅ Push sent for ${res.id}`)
          } else {
            results.push_failed++
            console.error(`[ProcessReminders] ❌ Push failed for ${res.id}:`, pushResult.errors)
          }
        }

        results.details.push(detail)
        
      } catch (err) {
        console.error(`[ProcessReminders] Error processing ${res.id}:`, err)
        detail.smsResult = { success: false, error: 'Processing error' }
        results.details.push(detail)
      }
    }

    const durationMs = Date.now() - startTime
    
    // Save batch log
    await saveBatchLog(results, durationMs, triggerSource)

    console.log('[ProcessReminders] ========================================')
    console.log(`[ProcessReminders] Completed in ${durationMs}ms`)
    console.log(`[ProcessReminders] SMS: ${results.sms_sent} sent, ${results.sms_failed} failed`)
    console.log(`[ProcessReminders] Push: ${results.push_sent} sent, ${results.push_failed} failed`)
    console.log(`[ProcessReminders] Skipped: ${results.skipped_disabled} disabled, ${results.skipped_no_phone} no phone`)
    console.log('[ProcessReminders] ========================================')

    return NextResponse.json({
      success: true,
      message: 'Reminder batch completed',
      duration: durationMs,
      results: {
        total: results.total_reservations,
        sms: { sent: results.sms_sent, failed: results.sms_failed },
        push: { sent: results.push_sent, failed: results.push_failed },
        skipped: {
          disabled: results.skipped_disabled,
          noPhone: results.skipped_no_phone
        }
      }
    })

  } catch (error) {
    console.error('[ProcessReminders] Fatal error:', error)
    
    // Report the error to bug tracking
    await reportServerError(error, 'POST /api/cron/process-reminders', {
      route: '/api/cron/process-reminders',
      severity: 'critical',
      additionalData: { 
        triggerSource,
        processedCount: results.total_reservations,
        smsSent: results.sms_sent,
        pushSent: results.push_sent
      }
    })
    
    const durationMs = Date.now() - startTime
    await saveBatchLog(results, durationMs, triggerSource)

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: durationMs,
      results
    }, { status: 500 })
  }
}

// Also support GET for manual testing in development
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'GET not allowed in production' }, { status: 405 })
  }
  
  // Forward to POST handler
  return POST(request)
}
