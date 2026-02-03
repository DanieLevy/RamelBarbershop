/**
 * Shared Reminder Service
 * 
 * Core logic for sending appointment reminders.
 * Used by both Vercel Cron (/api/cron/send-reminders) and Netlify Functions.
 * 
 * This ensures consistent behavior across deployment platforms.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { pushService } from '@/lib/push/push-service'
import type { ReminderContext } from '@/lib/push/types'
import { nowInIsraelMs, getIsraelDayStart, getIsraelDayEnd, getDayKeyInIsrael, parseTimeString, israelDateToTimestamp, timestampToIsraelDate } from '@/lib/utils'
import type { DayOfWeek } from '@/types/database'

// Type for reservation with joined data from the reminder query
interface ReservationWithJoins {
  id: string
  time_timestamp: number
  customer_id: string | null
  customer_name: string
  barber_id: string
  users: { fullname: string } | null
  services: { name_he: string } | null
}

// Type for recurring appointment with joined data
interface RecurringWithJoins {
  id: string
  barber_id: string
  customer_id: string
  time_slot: string
  last_reminder_date: string | null
  customers: { fullname: string; phone: string } | null
  users: { fullname: string } | null
  services: { name_he: string } | null
}

// Constants
const HOUR_MS = 3600000

// Types
export interface AppointmentForReminder {
  id: string
  time_timestamp: number
  customer_id: string
  customer_name: string
  barber_id: string
  barber_name: string
  service_name: string
  reminder_hours_before: number
  isRecurring?: boolean // Flag for recurring appointments
  recurringId?: string  // Original recurring_appointments.id for marking
}

export interface ReminderJobResults {
  checked: number
  sent: number
  skipped: number
  alreadySent: number
  noSubscription: number
  disabled: number
  failed: number
  errors: string[]
}

export interface ReminderJobResponse {
  success: boolean
  message: string
  executedAt: string
  duration: number
  reminders: ReminderJobResults
}

/**
 * Create a Supabase client for the reminder service
 */
function getSupabaseClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

/**
 * Get appointments that need reminders sent right now
 * 
 * OPTIMIZED QUERY:
 * - Only TODAY's reservations (Israel timezone)
 * - Only UPCOMING (time_timestamp > now)
 * - Only CONFIRMED status
 * - Only with customer_id (registered customers)
 * 
 * This minimizes data transfer and processing time,
 * making it scalable for SMS reminders alongside push notifications.
 */
export async function getAppointmentsForReminders(
  supabase?: SupabaseClient
): Promise<AppointmentForReminder[]> {
  const client = supabase || getSupabaseClient()
  // Use Israel timezone-aware timestamp for accurate reminder window calculation
  const now = nowInIsraelMs()
  
  // Get today's boundaries in Israel timezone
  const todayStart = getIsraelDayStart(now)
  const todayEnd = getIsraelDayEnd(now)
  
  console.log(`[ReminderService] Querying: now=${now}, todayStart=${todayStart}, todayEnd=${todayEnd}`)

  const { data, error } = await client
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
    .eq('status', 'confirmed')           // Only confirmed (not cancelled)
    .gte('time_timestamp', todayStart)   // Today or later (Israel time)
    .lte('time_timestamp', todayEnd)     // Today only (Israel time)
    .gt('time_timestamp', now)           // Only upcoming (not passed)
    .not('customer_id', 'is', null)      // Only registered customers
    .order('time_timestamp', { ascending: true }) // Earliest first

  if (error) {
    console.error('[ReminderService] Error fetching appointments:', error)
    return []
  }

  if (!data || data.length === 0) {
    console.log('[ReminderService] No appointments found for today')
    return []
  }
  
  console.log(`[ReminderService] Found ${data.length} confirmed upcoming appointments for today`)

  // Get all unique barber IDs
  const barberIds = [...new Set(data.map(r => r.barber_id).filter(Boolean))]

  // Fetch barber notification settings
  const { data: settingsData, error: settingsError } = await client
    .from('barber_notification_settings')
    .select('barber_id, reminder_hours_before')
    .in('barber_id', barberIds)

  if (settingsError) {
    console.error('[ReminderService] Error fetching barber settings:', settingsError)
    return []
  }

  // Create a map of barber_id -> reminder_hours_before (default 3)
  const settingsMap = new Map<string, number>()
  settingsData?.forEach(s => {
    settingsMap.set(s.barber_id, s.reminder_hours_before)
  })

  // Filter appointments within their barber's reminder window
  // FIXED: Include ALL appointments from now until reminderHours ahead
  // The wasReminderAlreadySent check prevents duplicates, so we catch:
  // 1. Appointments in the normal window
  // 2. Late-booked appointments that missed earlier windows
  const appointmentsInWindow: AppointmentForReminder[] = []

  for (const reservation of data) {
    const reminderHours = settingsMap.get(reservation.barber_id) || 3
    const reminderWindowEnd = now + (reminderHours * HOUR_MS)

    // Include any appointment from NOW until reminderHours ahead
    // This ensures late-booked appointments still get reminders
    if (reservation.time_timestamp <= reminderWindowEnd) {
      const reservationData = reservation as unknown as ReservationWithJoins
      // Calculate actual hours until appointment for the notification
      const hoursUntil = Math.round((reservationData.time_timestamp - now) / HOUR_MS)
      
      appointmentsInWindow.push({
        id: reservationData.id,
        time_timestamp: reservationData.time_timestamp,
        customer_id: reservationData.customer_id!,
        customer_name: reservationData.customer_name,
        barber_id: reservationData.barber_id,
        barber_name: reservationData.users?.fullname || 'הספר',
        service_name: reservationData.services?.name_he || 'שירות',
        // Use actual hours until, capped at minimum 1 for display
        reminder_hours_before: Math.max(1, hoursUntil)
      })
    }
  }

  // Also get recurring appointments for today
  const recurringAppointments = await getRecurringAppointmentsForToday(client, now, todayStart)
  
  // Merge recurring with regular appointments
  const allAppointments = [...appointmentsInWindow, ...recurringAppointments]
  
  console.log(`[ReminderService] Total appointments (regular + recurring): ${allAppointments.length}`)
  
  return allAppointments
}

/**
 * Get recurring appointments for today that need reminders
 * 
 * Fetches active recurring appointments for today's day of week,
 * converts them to the standard reminder format with synthetic IDs.
 */
async function getRecurringAppointmentsForToday(
  client: SupabaseClient,
  now: number,
  todayStart: number
): Promise<AppointmentForReminder[]> {
  // Get today's day of week in Israel timezone
  const dayKey = getDayKeyInIsrael(now) as DayOfWeek
  
  // Calculate today's date string for deduplication
  const todayDateStr = new Date(todayStart).toISOString().split('T')[0]
  
  console.log(`[ReminderService] Fetching recurring appointments for ${dayKey}, date=${todayDateStr}`)
  
  // Query recurring appointments that haven't received reminder today
  const { data, error } = await client
    .from('recurring_appointments')
    .select(`
      id,
      barber_id,
      customer_id,
      time_slot,
      last_reminder_date,
      customers!recurring_appointments_customer_id_fkey (
        fullname,
        phone
      ),
      users!recurring_appointments_barber_id_fkey (
        fullname
      ),
      services!recurring_appointments_service_id_fkey (
        name_he
      )
    `)
    .eq('day_of_week', dayKey)
    .eq('is_active', true)
    .or(`last_reminder_date.is.null,last_reminder_date.neq.${todayDateStr}`)
  
  if (error) {
    console.error('[ReminderService] Error fetching recurring appointments:', error)
    return []
  }
  
  if (!data || data.length === 0) {
    console.log('[ReminderService] No recurring appointments for today')
    return []
  }
  
  console.log(`[ReminderService] Found ${data.length} recurring appointments for ${dayKey}`)
  
  // Get all unique barber IDs from recurring
  const barberIds = [...new Set(data.map(r => r.barber_id).filter(Boolean))]
  
  // Check for barber closures today (reusing todayDateStr from above)
  const { data: closuresData, error: closuresError } = await client
    .from('barber_closures')
    .select('barber_id')
    .in('barber_id', barberIds)
    .lte('start_date', todayDateStr)
    .gte('end_date', todayDateStr)
  
  if (closuresError) {
    console.error('[ReminderService] Error fetching barber closures:', closuresError)
  }
  
  // Create a set of barber IDs with closures today
  const barbersClosed = new Set<string>(
    closuresData?.map(c => c.barber_id) || []
  )
  
  if (barbersClosed.size > 0) {
    console.log(`[ReminderService] ${barbersClosed.size} barbers have closures today - skipping their recurring`)
  }
  
  // Fetch barber notification settings
  const { data: settingsData, error: settingsError } = await client
    .from('barber_notification_settings')
    .select('barber_id, reminder_hours_before')
    .in('barber_id', barberIds)
  
  if (settingsError) {
    console.error('[ReminderService] Error fetching barber settings for recurring:', settingsError)
  }
  
  // Create a map of barber_id -> reminder_hours_before (default 3)
  const settingsMap = new Map<string, number>()
  settingsData?.forEach(s => {
    settingsMap.set(s.barber_id, s.reminder_hours_before)
  })
  
  // Convert recurring appointments to the standard format
  const recurringReminders: AppointmentForReminder[] = []
  
  for (const rec of data) {
    const recData = rec as unknown as RecurringWithJoins
    
    // Skip if barber has a closure today
    if (barbersClosed.has(recData.barber_id)) {
      console.log(`[ReminderService] Skipping recurring ${recData.id} - barber has closure today`)
      continue
    }
    
    // Parse time slot (HH:MM) and create timestamp for today in Israel timezone
    const { hour, minute } = parseTimeString(recData.time_slot)
    
    // Get Israel date components from todayStart
    const israelDate = timestampToIsraelDate(todayStart)
    const year = israelDate.getFullYear()
    const month = israelDate.getMonth() + 1
    const day = israelDate.getDate()
    
    // Create proper timestamp for today's date + recurring time in Israel timezone
    const appointmentTime = israelDateToTimestamp(year, month, day, hour, minute)
    
    // Skip if appointment time has already passed
    if (appointmentTime <= now) {
      continue
    }
    
    // Check if within reminder window
    const reminderHours = settingsMap.get(recData.barber_id) || 3
    const reminderWindowEnd = now + (reminderHours * 60 * 60 * 1000)
    
    if (appointmentTime > reminderWindowEnd) {
      continue // Not yet in reminder window
    }
    
    // Calculate hours until appointment
    const hoursUntil = Math.round((appointmentTime - now) / (60 * 60 * 1000))
    
    // Create a synthetic ID for the recurring instance (date-based)
    // Format: recurring-{id}-{YYYYMMDD}
    const dateStr = israelDate.toISOString().split('T')[0].replace(/-/g, '')
    const syntheticId = `recurring-${recData.id}-${dateStr}`
    
    recurringReminders.push({
      id: syntheticId,
      time_timestamp: appointmentTime,
      customer_id: recData.customer_id,
      customer_name: recData.customers?.fullname || 'לקוח קבוע',
      barber_id: recData.barber_id,
      barber_name: recData.users?.fullname || 'הספר',
      service_name: recData.services?.name_he || 'שירות',
      reminder_hours_before: Math.max(1, hoursUntil),
      isRecurring: true,
      recurringId: recData.id // Original ID for marking
    })
  }
  
  console.log(`[ReminderService] ${recurringReminders.length} recurring appointments in reminder window`)
  
  return recurringReminders
}

/**
 * Check if a reminder was already sent for this reservation
 */
export async function wasReminderAlreadySent(
  reservationId: string,
  supabase?: SupabaseClient
): Promise<boolean> {
  const client = supabase || getSupabaseClient()
  
  const { data, error } = await client
    .from('notification_logs')
    .select('id')
    .eq('notification_type', 'reminder')
    .eq('reservation_id', reservationId)
    .in('status', ['sent', 'partial'])
    .limit(1)

  if (error) {
    console.error('[ReminderService] Error checking reminder status:', error)
    return false
  }

  return data !== null && data.length > 0
}

/**
 * Check if customer has reminders enabled
 */
export async function isReminderEnabledForCustomer(
  customerId: string,
  supabase?: SupabaseClient
): Promise<boolean> {
  const client = supabase || getSupabaseClient()
  
  const { data, error } = await client
    .from('customer_notification_settings')
    .select('reminder_enabled')
    .eq('customer_id', customerId)
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('[ReminderService] Error checking customer settings:', error)
    return true
  }

  return data?.reminder_enabled !== false
}

/**
 * Check if customer has active push subscriptions
 */
export async function hasActiveSubscription(
  customerId: string,
  supabase?: SupabaseClient
): Promise<boolean> {
  const client = supabase || getSupabaseClient()
  
  const { count, error } = await client
    .from('push_subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', customerId)
    .eq('is_active', true)

  if (error) {
    console.error('[ReminderService] Error checking subscription:', error)
    return false
  }

  return (count || 0) > 0
}

/**
 * Mark recurring appointment as having received reminder today
 */
async function markRecurringReminderSent(
  recurringId: string,
  supabase?: SupabaseClient
): Promise<boolean> {
  const client = supabase || getSupabaseClient()
  const now = nowInIsraelMs()
  const todayStart = getIsraelDayStart(now)
  const todayDateStr = new Date(todayStart).toISOString().split('T')[0]
  
  const { error } = await client
    .from('recurring_appointments')
    .update({ last_reminder_date: todayDateStr })
    .eq('id', recurringId)

  if (error) {
    console.error(`[ReminderService] Failed to mark recurring sent for ${recurringId}:`, error)
    return false
  }

  return true
}

/**
 * Main function to process and send all pending reminders
 */
export async function processReminders(): Promise<ReminderJobResponse> {
  const startTime = Date.now()
  const supabase = getSupabaseClient()
  
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
    console.log('[ReminderService] Starting reminder job')

    // Get appointments in reminder windows
    const appointments = await getAppointmentsForReminders(supabase)
    results.checked = appointments.length

    console.log(`[ReminderService] Found ${appointments.length} appointments in reminder windows`)

    // Process each appointment
    const sendPromises = appointments.map(async (apt) => {
      try {
        // Check if reminder was already sent
        if (await wasReminderAlreadySent(apt.id, supabase)) {
          results.alreadySent++
          return
        }

        // Check if customer has push subscriptions
        if (!await hasActiveSubscription(apt.customer_id, supabase)) {
          results.noSubscription++
          return
        }

        // Check if customer has reminders enabled
        if (!await isReminderEnabledForCustomer(apt.customer_id, supabase)) {
          results.disabled++
          return
        }

        // Build reminder context
        const context: ReminderContext = {
          reservationId: apt.id,
          customerId: apt.customer_id,
          barberId: apt.barber_id,
          customerName: apt.customer_name,
          barberName: apt.barber_name,
          serviceName: apt.service_name,
          appointmentTime: apt.time_timestamp
        }

        // Send the reminder
        const result = await pushService.sendReminder(context)

        if (result.success) {
          results.sent++
          console.log(`[ReminderService] Reminder sent for reservation ${apt.id}${apt.isRecurring ? ' (recurring)' : ''}`)
          
          // For recurring, mark as sent today
          if (apt.isRecurring && apt.recurringId) {
            await markRecurringReminderSent(apt.recurringId, supabase)
          }
        } else {
          results.failed++
          results.errors.push(`Reservation ${apt.id}: ${result.errors.join(', ')}`)
        }
      } catch (err) {
        results.failed++
        const errorMsg = err instanceof Error ? err.message : 'Unknown error'
        results.errors.push(`Reservation ${apt.id}: ${errorMsg}`)
        console.error(`[ReminderService] Error processing reservation ${apt.id}:`, err)
      }
    })

    // Wait for all sends to complete
    await Promise.allSettled(sendPromises)

    results.skipped = results.alreadySent + results.noSubscription + results.disabled

    const response: ReminderJobResponse = {
      success: true,
      message: 'Reminder job completed',
      executedAt: new Date().toISOString(),
      duration: Date.now() - startTime,
      reminders: results
    }

    console.log('[ReminderService] Job completed', response)

    return response
  } catch (error) {
    console.error('[ReminderService] Error in reminder job:', error)

    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
      executedAt: new Date().toISOString(),
      duration: Date.now() - startTime,
      reminders: results
    }
  }
}

