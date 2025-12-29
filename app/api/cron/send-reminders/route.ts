/**
 * Cron Job: Send Appointment Reminders
 * 
 * This endpoint is triggered by Vercel Cron every hour to send
 * push notification reminders for upcoming appointments.
 * 
 * Schedule: Every hour at minute 0 (0 * * * *)
 * 
 * Smart Query Strategy:
 * - Only fetches appointments in the reminder window (next 24h max)
 * - Each barber's reminder_hours_before determines their window
 * - Deduplicates via notification_logs to prevent double-sends
 * - Filters only confirmed appointments with registered customers
 */

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { pushService } from '@/lib/push/push-service'
import type { ReminderContext } from '@/lib/push/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Maximum reminder window (24 hours in milliseconds)
const MAX_REMINDER_HOURS = 24
const HOUR_MS = 3600000

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

/**
 * Verify the request is from Vercel Cron
 */
function verifyCronSecret(request: Request): boolean {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  
  if (process.env.NODE_ENV === 'development') {
    return true
  }
  
  if (!cronSecret) {
    console.error('[Cron] CRON_SECRET not configured')
    return false
  }
  
  return authHeader === `Bearer ${cronSecret}`
}

/**
 * Get appointments that need reminders sent right now
 * Uses smart time-window query to minimize data scanned
 */
async function getAppointmentsForReminders(): Promise<AppointmentForReminder[]> {
  const now = Date.now()
  const maxWindowEnd = now + (MAX_REMINDER_HOURS * HOUR_MS)
  
  // Query appointments in the reminder window with their barber's settings
  // This query is optimized to only fetch relevant appointments
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
  
  if (error) {
    console.error('[Cron] Error fetching appointments:', error)
    return []
  }
  
  if (!data || data.length === 0) {
    return []
  }
  
  // Get all unique barber IDs
  const barberIds = [...new Set(data.map(r => r.barber_id).filter(Boolean))]
  
  // Fetch barber notification settings
  const { data: settingsData, error: settingsError } = await supabase
    .from('barber_notification_settings')
    .select('barber_id, reminder_hours_before')
    .in('barber_id', barberIds)
  
  if (settingsError) {
    console.error('[Cron] Error fetching barber settings:', settingsError)
    return []
  }
  
  // Create a map of barber_id -> reminder_hours_before (default 3)
  const settingsMap = new Map<string, number>()
  settingsData?.forEach(s => {
    settingsMap.set(s.barber_id, s.reminder_hours_before)
  })
  
  // Filter appointments that fall within their barber's reminder window
  const appointmentsInWindow: AppointmentForReminder[] = []
  
  for (const reservation of data) {
    const reminderHours = settingsMap.get(reservation.barber_id) || 3
    const reminderWindowStart = now + ((reminderHours - 1) * HOUR_MS)
    const reminderWindowEnd = now + (reminderHours * HOUR_MS)
    
    // Check if appointment falls within this hour's reminder window
    if (reservation.time_timestamp > reminderWindowStart && 
        reservation.time_timestamp <= reminderWindowEnd) {
      appointmentsInWindow.push({
        id: reservation.id,
        time_timestamp: reservation.time_timestamp,
        customer_id: reservation.customer_id!,
        customer_name: reservation.customer_name,
        barber_id: reservation.barber_id,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        barber_name: (reservation.users as any)?.fullname || 'הספר',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        service_name: (reservation.services as any)?.name_he || 'שירות',
        reminder_hours_before: reminderHours
      })
    }
  }
  
  return appointmentsInWindow
}

/**
 * Check if a reminder was already sent for this reservation
 */
async function wasReminderAlreadySent(reservationId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('notification_logs')
    .select('id')
    .eq('notification_type', 'reminder')
    .eq('reservation_id', reservationId)
    .in('status', ['sent', 'partial'])
    .limit(1)
  
  if (error) {
    console.error('[Cron] Error checking reminder status:', error)
    return false // Allow retry on error
  }
  
  return data !== null && data.length > 0
}

/**
 * Check if customer has reminders enabled
 */
async function isReminderEnabledForCustomer(customerId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('customer_notification_settings')
    .select('reminder_enabled')
    .eq('customer_id', customerId)
    .single()
  
  if (error && error.code !== 'PGRST116') {
    console.error('[Cron] Error checking customer settings:', error)
    return true // Default to enabled if can't check
  }
  
  // Default to enabled if no settings exist
  return data?.reminder_enabled !== false
}

/**
 * Check if customer has active push subscriptions
 */
async function hasActiveSubscription(customerId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from('push_subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', customerId)
    .eq('is_active', true)
  
  if (error) {
    console.error('[Cron] Error checking subscription:', error)
    return false
  }
  
  return (count || 0) > 0
}

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    console.error('[Cron] Unauthorized cron request')
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const startTime = Date.now()
  const results = {
    checked: 0,
    sent: 0,
    skipped: 0,
    alreadySent: 0,
    noSubscription: 0,
    disabled: 0,
    failed: 0,
    errors: [] as string[]
  }
  
  try {
    console.log('[Cron] Send reminders job started')
    
    // Get appointments in reminder windows
    const appointments = await getAppointmentsForReminders()
    results.checked = appointments.length
    
    console.log(`[Cron] Found ${appointments.length} appointments in reminder windows`)
    
    // Process each appointment
    const sendPromises = appointments.map(async (apt) => {
      try {
        // Check if reminder was already sent
        if (await wasReminderAlreadySent(apt.id)) {
          results.alreadySent++
          return
        }
        
        // Check if customer has push subscriptions
        if (!await hasActiveSubscription(apt.customer_id)) {
          results.noSubscription++
          return
        }
        
        // Check if customer has reminders enabled
        if (!await isReminderEnabledForCustomer(apt.customer_id)) {
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
          console.log(`[Cron] Reminder sent for reservation ${apt.id}`)
        } else {
          results.failed++
          results.errors.push(`Reservation ${apt.id}: ${result.errors.join(', ')}`)
        }
      } catch (err) {
        results.failed++
        const errorMsg = err instanceof Error ? err.message : 'Unknown error'
        results.errors.push(`Reservation ${apt.id}: ${errorMsg}`)
        console.error(`[Cron] Error processing reservation ${apt.id}:`, err)
      }
    })
    
    // Wait for all sends to complete
    await Promise.allSettled(sendPromises)
    
    results.skipped = results.alreadySent + results.noSubscription + results.disabled
    
    const response = {
      success: true,
      message: 'Cron job completed',
      executedAt: new Date().toISOString(),
      duration: Date.now() - startTime,
      reminders: results
    }
    
    console.log('[Cron] Send reminders job completed', response)
    
    return NextResponse.json(response)
  } catch (error) {
    console.error('[Cron] Error in send-reminders job:', error)
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        executedAt: new Date().toISOString(),
        duration: Date.now() - startTime,
        reminders: results
      },
      { status: 500 }
    )
  }
}
