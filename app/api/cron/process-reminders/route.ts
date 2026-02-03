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
import { getIsraelDayStart, getIsraelDayEnd, nowInIsraelMs, getDayKeyInIsrael, parseTimeString, israelDateToTimestamp, timestampToIsraelDate } from '@/lib/utils'
import type { DayOfWeek } from '@/types/database'

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
  isRecurring?: boolean // Flag to distinguish recurring from regular
  recurringId?: string  // Original recurring_appointments.id for marking sent
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
 * Get recurring appointments for today that haven't received reminder yet
 * 
 * DEDUPLICATION: Uses `last_reminder_date` column on recurring_appointments table
 * Only fetches recurring where last_reminder_date != today (or is null)
 */
async function getTodaysUnsentRecurring(): Promise<ReservationForReminder[]> {
  const supabase = getSupabase()
  const now = nowInIsraelMs()
  const todayStart = getIsraelDayStart(now)
  
  // Get today's day of week and date string
  const dayKey = getDayKeyInIsrael(now) as DayOfWeek
  const todayDateStr = new Date(todayStart).toISOString().split('T')[0]

  console.log(`[ProcessReminders] Querying recurring for day=${dayKey}, date=${todayDateStr}`)

  // Query recurring appointments for today's day of week
  // where last_reminder_date is not today (or is null)
  const { data, error } = await supabase
    .from('recurring_appointments')
    .select(`
      id,
      barber_id,
      customer_id,
      time_slot,
      last_reminder_date,
      customers!recurring_appointments_customer_id_fkey (fullname, phone),
      users!recurring_appointments_barber_id_fkey (fullname),
      services!recurring_appointments_service_id_fkey (name_he)
    `)
    .eq('day_of_week', dayKey)
    .eq('is_active', true)
    .or(`last_reminder_date.is.null,last_reminder_date.neq.${todayDateStr}`)

  if (error) {
    console.error('[ProcessReminders] Error fetching recurring:', error)
    return []
  }

  if (!data?.length) {
    console.log('[ProcessReminders] No unsent recurring appointments for today')
    return []
  }

  console.log(`[ProcessReminders] Found ${data.length} recurring appointments without reminder today`)

  // Check for barber closures today
  const barberIds = [...new Set(data.map(r => r.barber_id))]
  
  const { data: closuresData } = await supabase
    .from('barber_closures')
    .select('barber_id')
    .in('barber_id', barberIds)
    .lte('start_date', todayDateStr)
    .gte('end_date', todayDateStr)

  const barbersClosed = new Set<string>(closuresData?.map(c => c.barber_id) || [])

  // Get barber reminder settings
  const { data: settingsData } = await supabase
    .from('barber_notification_settings')
    .select('barber_id, reminder_hours_before')
    .in('barber_id', barberIds)

  const settingsMap = new Map<string, number>()
  settingsData?.forEach(s => settingsMap.set(s.barber_id, s.reminder_hours_before))

  // Convert to ReservationForReminder format
  const recurringReminders: ReservationForReminder[] = []

  for (const rec of data) {
    // Skip if barber has closure today
    if (barbersClosed.has(rec.barber_id)) {
      console.log(`[ProcessReminders] Skipping recurring ${rec.id} - barber closed today`)
      continue
    }

    // Parse time slot and create timestamp for today in Israel timezone
    const { hour, minute } = parseTimeString(rec.time_slot)
    
    // Get Israel date components from todayStart
    const israelDate = timestampToIsraelDate(todayStart)
    const year = israelDate.getFullYear()
    const month = israelDate.getMonth() + 1
    const day = israelDate.getDate()
    
    // Create proper timestamp for today's date + recurring time in Israel timezone
    const appointmentTime = israelDateToTimestamp(year, month, day, hour, minute)

    // Skip if appointment time has passed
    if (appointmentTime <= now) {
      continue
    }

    // Check if within reminder window
    const reminderHours = settingsMap.get(rec.barber_id) || 3
    const windowEnd = now + (reminderHours * HOUR_MS)

    if (appointmentTime > windowEnd) {
      continue // Not yet in reminder window
    }

    const customer = rec.customers as { fullname: string; phone: string } | null
    const barber = rec.users as { fullname: string } | null
    const service = rec.services as { name_he: string } | null

    recurringReminders.push({
      id: `recurring-${rec.id}`, // Synthetic ID for logging
      time_timestamp: appointmentTime,
      customer_id: rec.customer_id,
      customer_name: customer?.fullname || 'לקוח קבוע',
      customer_phone: customer?.phone || '',
      barber_id: rec.barber_id,
      barber_name: barber?.fullname || 'הספר',
      service_name: service?.name_he || 'שירות',
      isRecurring: true,
      recurringId: rec.id // Store the original ID for marking
    })
  }

  console.log(`[ProcessReminders] ${recurringReminders.length} recurring in reminder window`)
  return recurringReminders
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
 * Mark recurring appointment as having received reminder today
 * 
 * Updates the last_reminder_date column to today's date
 */
async function markRecurringReminderSent(recurringId: string): Promise<boolean> {
  const supabase = getSupabase()
  const todayStart = getIsraelDayStart(nowInIsraelMs())
  const todayDateStr = new Date(todayStart).toISOString().split('T')[0]
  
  const { error } = await supabase
    .from('recurring_appointments')
    .update({ last_reminder_date: todayDateStr })
    .eq('id', recurringId)

  if (error) {
    console.error(`[ProcessReminders] Failed to mark recurring sent for ${recurringId}:`, error)
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
    const regularReservations = await getTodaysUnsentReservations()
    
    // Also get today's recurring appointments that haven't received reminder today
    const recurringReservations = await getTodaysUnsentRecurring()
    
    // Merge both lists
    const reservations = [...regularReservations, ...recurringReservations]
    results.total_reservations = reservations.length
    
    console.log(`[ProcessReminders] Processing ${reservations.length} total (${regularReservations.length} regular + ${recurringReservations.length} recurring)`)

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
    
    // Pre-fetch push subscription status for all customers (optimization)
    const pushSubStatus = new Map<string, boolean>()
    await Promise.all(
      customerIds.map(async (customerId) => {
        const hasSub = await hasActivePushSubscription(customerId)
        pushSubStatus.set(customerId, hasSub)
      })
    )
    
    // PARALLEL PROCESSING: Process reservations in controlled batches
    // This significantly reduces execution time while maintaining safety
    const BATCH_SIZE = 5 // Process 5 at a time to avoid overwhelming APIs
    
    /**
     * Process a single reservation - sends SMS and Push, marks as sent
     * This function is self-contained and can run in parallel safely
     */
    const processOneReservation = async (res: ReservationForReminder): Promise<{
      detail: BatchResults['details'][0]
      smsSent: boolean
      smsFailed: boolean
      pushSent: boolean
      pushFailed: boolean
      skippedDisabled: boolean
      skippedNoPhone: boolean
    }> => {
      const detail: BatchResults['details'][0] = {
        reservationId: res.id,
        customerName: res.customer_name
      }
      
      const result = {
        detail,
        smsSent: false,
        smsFailed: false,
        pushSent: false,
        pushFailed: false,
        skippedDisabled: false,
        skippedNoPhone: false
      }

      try {
        // Get customer preferences (all pre-fetched, no async needed)
        const settings = customerSettings.get(res.customer_id)
        const hasValidPhone = isValidIsraeliMobile(res.customer_phone)
        const hasPushSub = pushSubStatus.get(res.customer_id) || false

        const { sendSms, sendPush } = getNotificationMethods(settings, hasValidPhone, hasPushSub)

        // Check if all notifications disabled
        if (!sendSms && !sendPush) {
          if (!hasValidPhone && !hasPushSub) {
            result.skippedNoPhone = true
          } else {
            result.skippedDisabled = true
          }
          return result
        }

        // Send SMS and Push in parallel for this reservation
        const [smsOutcome, pushOutcome] = await Promise.allSettled([
          // SMS Promise
          sendSms ? (async () => {
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
              let marked: boolean
              
              if (res.isRecurring && res.recurringId) {
                marked = await markRecurringReminderSent(res.recurringId)
              } else {
                marked = await markSmsReminderSent(res.id)
              }
              
              if (marked) {
                result.smsSent = true
                console.log(`[ProcessReminders] ✅ SMS sent and marked for ${res.id}${res.isRecurring ? ' (recurring)' : ''}`)
              } else {
                result.smsSent = true
                console.warn(`[ProcessReminders] ⚠️ SMS sent for ${res.id} but marking failed!`)
              }
            } else {
              result.smsFailed = true
              console.error(`[ProcessReminders] ❌ SMS failed for ${res.id}:`, smsResult.error)
            }
          })() : Promise.resolve(),
          
          // Push Promise
          sendPush ? (async () => {
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
              result.pushSent = true
              console.log(`[ProcessReminders] ✅ Push sent for ${res.id}`)
            } else {
              result.pushFailed = true
              console.error(`[ProcessReminders] ❌ Push failed for ${res.id}:`, pushResult.errors)
            }
          })() : Promise.resolve()
        ])
        
        // Log any unexpected errors from Promise.allSettled
        if (smsOutcome.status === 'rejected') {
          console.error(`[ProcessReminders] SMS promise rejected for ${res.id}:`, smsOutcome.reason)
          result.smsFailed = true
          detail.smsResult = { success: false, error: 'Promise rejected' }
        }
        if (pushOutcome.status === 'rejected') {
          console.error(`[ProcessReminders] Push promise rejected for ${res.id}:`, pushOutcome.reason)
          result.pushFailed = true
          detail.pushResult = { success: false, error: 'Promise rejected' }
        }
        
      } catch (err) {
        console.error(`[ProcessReminders] Error processing ${res.id}:`, err)
        detail.smsResult = { success: false, error: 'Processing error' }
        result.smsFailed = true
      }
      
      return result
    }
    
    // Process reservations in batches
    console.log(`[ProcessReminders] Processing in batches of ${BATCH_SIZE}...`)
    
    for (let i = 0; i < reservations.length; i += BATCH_SIZE) {
      const batch = reservations.slice(i, i + BATCH_SIZE)
      const batchNum = Math.floor(i / BATCH_SIZE) + 1
      const totalBatches = Math.ceil(reservations.length / BATCH_SIZE)
      
      console.log(`[ProcessReminders] Batch ${batchNum}/${totalBatches}: processing ${batch.length} reservations`)
      
      // Process batch in parallel
      const batchResults = await Promise.allSettled(
        batch.map(res => processOneReservation(res))
      )
      
      // Aggregate results from this batch
      for (const outcome of batchResults) {
        if (outcome.status === 'fulfilled') {
          const { detail, smsSent, smsFailed, pushSent, pushFailed, skippedDisabled, skippedNoPhone } = outcome.value
          results.details.push(detail)
          if (smsSent) results.sms_sent++
          if (smsFailed) results.sms_failed++
          if (pushSent) results.push_sent++
          if (pushFailed) results.push_failed++
          if (skippedDisabled) results.skipped_disabled++
          if (skippedNoPhone) results.skipped_no_phone++
        } else {
          // Entire promise rejected - should be rare
          console.error(`[ProcessReminders] Batch item promise rejected:`, outcome.reason)
          results.sms_failed++
        }
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
