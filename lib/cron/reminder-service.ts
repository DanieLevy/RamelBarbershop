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
import { nowInIsraelMs } from '@/lib/utils'

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

// Constants
const MAX_REMINDER_HOURS = 24
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
 * Uses smart time-window query to minimize data scanned
 */
export async function getAppointmentsForReminders(
  supabase?: SupabaseClient
): Promise<AppointmentForReminder[]> {
  const client = supabase || getSupabaseClient()
  // Use Israel timezone-aware timestamp for accurate reminder window calculation
  const now = nowInIsraelMs()
  const maxWindowEnd = now + (MAX_REMINDER_HOURS * HOUR_MS)

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
    .eq('status', 'confirmed')
    .gt('time_timestamp', now)
    .lte('time_timestamp', maxWindowEnd)
    .not('customer_id', 'is', null)

  if (error) {
    console.error('[ReminderService] Error fetching appointments:', error)
    return []
  }

  if (!data || data.length === 0) {
    return []
  }

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

  return appointmentsInWindow
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
          console.log(`[ReminderService] Reminder sent for reservation ${apt.id}`)
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

