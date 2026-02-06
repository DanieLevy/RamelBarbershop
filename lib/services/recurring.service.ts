/**
 * Recurring Appointments Service
 * 
 * Handles business logic for recurring (pre-set) appointments.
 * These are patterns stored in the database that block time slots
 * without creating actual reservation entries each time.
 */

import { createClient } from '@/lib/supabase/client'
import { reportSupabaseError } from '@/lib/bug-reporter/helpers'
import { getSlotKey, timestampToIsraelDate, israelDateToTimestamp, getIsraelDayStart, getDayKeyInIsrael } from '@/lib/utils'
import { withSupabaseRetry } from '@/lib/utils/retry'
import type {
  RecurringAppointment,
  RecurringAppointmentWithDetails,
  CreateRecurringAppointmentData,
  CustomerRecurringAppointment,
  DayOfWeek,
} from '@/types/database'
import { DAY_OF_WEEK_HEBREW } from '@/types/database'

// ============================================================
// Types
// ============================================================

export interface CreateRecurringResult {
  success: boolean
  recurring?: RecurringAppointment
  error?: RecurringErrorCode
  message?: string
}

export interface DeleteRecurringResult {
  success: boolean
  error?: string
}

export type RecurringErrorCode =
  | 'SLOT_CONFLICT'
  | 'CUSTOMER_BLOCKED'
  | 'CUSTOMER_NOT_FOUND'
  | 'BARBER_NOT_WORKING'
  | 'INVALID_TIME_SLOT'
  | 'SERVICE_NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'DATABASE_ERROR'
  | 'UNKNOWN_ERROR'

// ============================================================
// Error Messages (Hebrew)
// ============================================================

const ERROR_MESSAGES: Record<RecurringErrorCode, string> = {
  SLOT_CONFLICT: 'כבר קיים תור קבוע בשעה זו.',
  CUSTOMER_BLOCKED: 'הלקוח חסום ולא ניתן להוסיף תור קבוע.',
  CUSTOMER_NOT_FOUND: 'הלקוח לא נמצא במערכת.',
  BARBER_NOT_WORKING: 'אינך עובד ביום או בשעה זו.',
  INVALID_TIME_SLOT: 'שעת התור אינה תקינה.',
  SERVICE_NOT_FOUND: 'השירות לא נמצא.',
  VALIDATION_ERROR: 'חסרים נתונים ליצירת תור קבוע.',
  DATABASE_ERROR: 'שגיאה ביצירת תור קבוע. נסה שוב.',
  UNKNOWN_ERROR: 'שגיאה בלתי צפויה. נסה שוב.',
}

// ============================================================
// UUID Validation
// ============================================================

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const isValidUUID = (value: string): boolean => {
  return UUID_REGEX.test(value)
}

// ============================================================
// Time Slot Validation
// ============================================================

const TIME_SLOT_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/

const isValidTimeSlot = (value: string): boolean => {
  return TIME_SLOT_REGEX.test(value)
}

// ============================================================
// Day of Week Validation
// ============================================================

const VALID_DAYS: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

const isValidDayOfWeek = (value: string): value is DayOfWeek => {
  return VALID_DAYS.includes(value as DayOfWeek)
}

// ============================================================
// Client-Side Service Functions
// ============================================================

/**
 * Get all active recurring appointments for a barber
 */
export const getRecurringByBarber = async (
  barberId: string
): Promise<RecurringAppointmentWithDetails[]> => {
  if (!barberId || !isValidUUID(barberId)) {
    return []
  }

  try {
    const supabase = createClient()
    
    const { data, error } = await supabase
      .from('recurring_appointments')
      .select(`
        *,
        customers!recurring_appointments_customer_id_fkey (id, fullname, phone),
        services!recurring_appointments_service_id_fkey (id, name_he, price, duration),
        users!recurring_appointments_barber_id_fkey (id, fullname)
      `)
      .eq('barber_id', barberId)
      .eq('is_active', true)
      .order('day_of_week')
      .order('time_slot')
    
    if (error) {
      console.error('[RecurringService] Error fetching barber recurring:', error)
      await reportSupabaseError(error, 'Fetching barber recurring appointments', {
        table: 'recurring_appointments',
        operation: 'select',
      })
      return []
    }
    
    // Map the results to match the expected interface
    // The FK hints rename the relations, so we need to cast appropriately
    return (data || []).map(rec => ({
      ...rec,
      users: rec.users,
      customers: rec.customers,
      services: rec.services,
    })) as unknown as RecurringAppointmentWithDetails[]
  } catch (err) {
    console.error('[RecurringService] Exception fetching barber recurring:', err)
    return []
  }
}

/**
 * Get all active recurring appointments for a customer
 */
export const getRecurringByCustomer = async (
  customerId: string
): Promise<CustomerRecurringAppointment[]> => {
  if (!customerId || !isValidUUID(customerId)) {
    return []
  }

  try {
    // Use retry wrapper for resilience against transient network errors
    // (especially Safari "Load failed" on iOS PWA wake-up)
    return await withSupabaseRetry(async () => {
      const supabase = createClient()
      
      const { data, error } = await supabase
        .from('recurring_appointments')
        .select(`
          id,
          day_of_week,
          time_slot,
          users!recurring_appointments_barber_id_fkey (fullname),
          services!recurring_appointments_service_id_fkey (name_he)
        `)
        .eq('customer_id', customerId)
        .eq('is_active', true)
        .order('day_of_week')
        .order('time_slot')
      
      if (error) {
        console.error('[RecurringService] Error fetching customer recurring:', error)
        await reportSupabaseError(error, 'Fetching customer recurring appointments', {
          table: 'recurring_appointments',
          operation: 'select',
        })
        return []
      }
      
      // Transform to customer-friendly format
      return (data || []).map((rec) => ({
        id: rec.id,
        barber_name: (rec.users as { fullname: string })?.fullname || '',
        service_name: (rec.services as { name_he: string })?.name_he || '',
        day_of_week: rec.day_of_week as DayOfWeek,
        day_of_week_hebrew: DAY_OF_WEEK_HEBREW[rec.day_of_week as DayOfWeek],
        time_slot: rec.time_slot,
      }))
    }, { maxRetries: 2, initialDelayMs: 500 })
  } catch (err) {
    console.error('[RecurringService] Exception fetching customer recurring:', err)
    return []
  }
}

/**
 * Get recurring appointments for a specific barber on a specific day
 * Used by TimeSelection to block recurring slots
 */
export const getRecurringForDay = async (
  barberId: string,
  dayOfWeek: DayOfWeek
): Promise<Array<{ time_slot: string; customer_name: string }>> => {
  if (!barberId || !isValidUUID(barberId) || !isValidDayOfWeek(dayOfWeek)) {
    return []
  }

  try {
    const supabase = createClient()
    
    const { data, error } = await supabase
      .from('recurring_appointments')
      .select(`
        time_slot,
        customers!recurring_appointments_customer_id_fkey (fullname)
      `)
      .eq('barber_id', barberId)
      .eq('day_of_week', dayOfWeek)
      .eq('is_active', true)
    
    if (error) {
      console.error('[RecurringService] Error fetching day recurring:', error)
      return []
    }
    
    return (data || []).map((rec) => ({
      time_slot: rec.time_slot,
      customer_name: (rec.customers as { fullname: string })?.fullname || 'לקוח קבוע',
    }))
  } catch (err) {
    console.error('[RecurringService] Exception fetching day recurring:', err)
    return []
  }
}

/**
 * Check if a slot conflicts with existing recurring appointment
 */
export const checkRecurringConflict = async (
  barberId: string,
  dayOfWeek: DayOfWeek,
  timeSlot: string
): Promise<boolean> => {
  if (!barberId || !isValidUUID(barberId)) {
    return false
  }

  try {
    const supabase = createClient()
    
    const { data, error } = await supabase
      .from('recurring_appointments')
      .select('id')
      .eq('barber_id', barberId)
      .eq('day_of_week', dayOfWeek)
      .eq('time_slot', timeSlot)
      .eq('is_active', true)
      .maybeSingle()
    
    if (error) {
      console.error('[RecurringService] Error checking conflict:', error)
      return false
    }
    
    return data !== null
  } catch (err) {
    console.error('[RecurringService] Exception checking conflict:', err)
    return false
  }
}

/**
 * Create a recurring appointment via API route
 */
export const createRecurring = async (
  data: CreateRecurringAppointmentData
): Promise<CreateRecurringResult> => {
  // Validate required fields
  const validationErrors: string[] = []
  
  if (!data.barber_id?.trim() || !isValidUUID(data.barber_id)) {
    validationErrors.push('barber_id is required and must be a valid UUID')
  }
  if (!data.customer_id?.trim() || !isValidUUID(data.customer_id)) {
    validationErrors.push('customer_id is required and must be a valid UUID')
  }
  if (!data.service_id?.trim() || !isValidUUID(data.service_id)) {
    validationErrors.push('service_id is required and must be a valid UUID')
  }
  if (!isValidDayOfWeek(data.day_of_week)) {
    validationErrors.push('day_of_week is required and must be a valid day')
  }
  if (!isValidTimeSlot(data.time_slot)) {
    validationErrors.push('time_slot is required and must be in HH:MM format')
  }
  if (!data.created_by?.trim() || !isValidUUID(data.created_by)) {
    validationErrors.push('created_by is required and must be a valid UUID')
  }
  
  if (validationErrors.length > 0) {
    console.error('[RecurringService] Validation failed:', validationErrors)
    return {
      success: false,
      error: 'VALIDATION_ERROR',
      message: ERROR_MESSAGES.VALIDATION_ERROR,
    }
  }

  try {
    const response = await fetch('/api/recurring', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    
    const result = await response.json()
    
    if (!response.ok || !result.success) {
      console.error('[RecurringService] API error:', result)
      
      const errorCode = (result.error as RecurringErrorCode) || 'DATABASE_ERROR'
      const message = result.message || ERROR_MESSAGES[errorCode] || ERROR_MESSAGES.DATABASE_ERROR
      
      return {
        success: false,
        error: errorCode,
        message,
      }
    }
    
    return {
      success: true,
      recurring: result.recurring as RecurringAppointment,
    }
  } catch (err) {
    console.error('[RecurringService] Exception creating recurring:', err)
    await reportSupabaseError(
      { message: err instanceof Error ? err.message : String(err), code: 'RECURRING_EXCEPTION' },
      'Creating recurring appointment - unexpected error',
      { table: 'recurring_appointments', operation: 'insert' }
    )
    return {
      success: false,
      error: 'UNKNOWN_ERROR',
      message: ERROR_MESSAGES.UNKNOWN_ERROR,
    }
  }
}

/**
 * Deactivate (soft delete) a recurring appointment via API route
 */
export const deleteRecurring = async (
  recurringId: string,
  barberId: string
): Promise<DeleteRecurringResult> => {
  if (!recurringId || !isValidUUID(recurringId)) {
    return { success: false, error: 'מזהה תור קבוע לא תקין' }
  }
  if (!barberId || !isValidUUID(barberId)) {
    return { success: false, error: 'מזהה ספר לא תקין' }
  }

  try {
    const response = await fetch('/api/recurring', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recurringId, barberId }),
    })
    
    const result = await response.json()
    
    if (!response.ok || !result.success) {
      console.error('[RecurringService] Delete error:', result.error)
      return { success: false, error: result.error || 'שגיאה במחיקת תור קבוע' }
    }
    
    return { success: true }
  } catch (err) {
    console.error('[RecurringService] Exception deleting recurring:', err)
    await reportSupabaseError(
      { message: err instanceof Error ? err.message : String(err), code: 'RECURRING_DELETE_EXCEPTION' },
      'Deleting recurring appointment - unexpected error',
      { table: 'recurring_appointments', operation: 'update' }
    )
    return { success: false, error: 'שגיאה בלתי צפויה במחיקת תור קבוע' }
  }
}

// ============================================================
// Conflict Detection Functions
// ============================================================

/**
 * Conflicting reservation details for display
 */
export interface ConflictingReservation {
  id: string
  date: string // YYYY-MM-DD
  dateFormatted: string // Localized display format
  time: string // HH:MM
  customer_name: string
  customer_id: string
}

/**
 * Check for conflicting existing reservations when creating a recurring appointment
 * Returns list of regular reservations that conflict with the proposed recurring slot
 * 
 * The reservations table uses time_timestamp (bigint - milliseconds since epoch)
 * representing the full date+time of the appointment
 */
export const checkReservationConflicts = async (
  barberId: string,
  dayOfWeek: DayOfWeek,
  timeSlot: string,
  maxDaysAhead: number = 21
): Promise<ConflictingReservation[]> => {
  if (!barberId || !isValidUUID(barberId) || !isValidDayOfWeek(dayOfWeek)) {
    return []
  }

  try {
    const supabase = createClient()
    
    // Calculate date range in milliseconds (today to maxDaysAhead)
    // Using Israel timezone for consistency
    const nowMs = Date.now()
    const startOfTodayIsrael = getIsraelDayStart(nowMs)
    const endMs = startOfTodayIsrael + (maxDaysAhead * 24 * 60 * 60 * 1000)
    
    // Get target day number (0 = Sunday, etc.)
    const targetDayIndex = VALID_DAYS.indexOf(dayOfWeek)
    
    // Parse time slot
    const [hours, minutes] = timeSlot.split(':').map(Number)
    
    // Calculate all matching timestamps within range
    const matchingTimestamps: number[] = []
    
    for (let dayOffset = 0; dayOffset <= maxDaysAhead; dayOffset++) {
      const dayMs = startOfTodayIsrael + (dayOffset * 24 * 60 * 60 * 1000)
      
      // Get day of week in Israel timezone using proper utility
      const israelDate = timestampToIsraelDate(dayMs)
      
      if (israelDate.getDay() === targetDayIndex) {
        // This day matches our target day of week
        // Calculate the exact timestamp using Israel timezone (handles DST correctly)
        const appointmentTimestamp = israelDateToTimestamp(
          israelDate.getFullYear(),
          israelDate.getMonth() + 1,
          israelDate.getDate(),
          hours,
          minutes
        )
        // Only include if it's in the future
        if (appointmentTimestamp > nowMs) {
          matchingTimestamps.push(appointmentTimestamp)
        }
      }
    }
    
    if (matchingTimestamps.length === 0) {
      return []
    }
    
    // Query reservations within the date range that match our timestamps
    // We query all active reservations and filter by matching timestamps
    const { data, error } = await supabase
      .from('reservations')
      .select(`
        id,
        time_timestamp,
        customer_id,
        customers!reservations_customer_id_fkey (fullname)
      `)
      .eq('barber_id', barberId)
      .eq('status', 'active')
      .gte('time_timestamp', startOfTodayIsrael)
      .lte('time_timestamp', endMs)
    
    if (error) {
      console.error('[RecurringService] Error checking reservation conflicts:', error)
      return []
    }
    
    // Filter reservations that match our target timestamps using slot key matching
    // This is robust and handles any timestamp variations within the same 30-min slot
    const targetSlotKeys = new Set(matchingTimestamps.map(ts => getSlotKey(ts)))
    const conflicts = (data || []).filter(r => {
      const reservationSlotKey = getSlotKey(r.time_timestamp)
      return targetSlotKeys.has(reservationSlotKey)
    })
    
    // Format for display
    return conflicts.map(r => {
      const date = new Date(r.time_timestamp)
      const israelDate = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }))
      const dateString = israelDate.toISOString().split('T')[0]
      const timeString = israelDate.toTimeString().substring(0, 5)
      
      return {
        id: r.id,
        date: dateString,
        dateFormatted: formatDateHebrew(dateString),
        time: timeString,
        customer_name: (r.customers as { fullname: string })?.fullname || 'לקוח',
        customer_id: r.customer_id,
      }
    })
  } catch (err) {
    console.error('[RecurringService] Exception checking reservation conflicts:', err)
    return []
  }
}

// getStartOfDayInIsrael has been removed - now using getIsraelDayStart from lib/utils.ts directly

/**
 * Format date to Hebrew display format
 */
const formatDateHebrew = (dateString: string): string => {
  const date = new Date(dateString + 'T00:00:00')
  const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']
  const dayName = dayNames[date.getDay()]
  const day = date.getDate()
  const month = date.getMonth() + 1
  return `יום ${dayName}, ${day}/${month}`
}

/**
 * Cancel multiple reservations by their IDs
 */
export const cancelConflictingReservations = async (
  reservationIds: string[],
  barberId: string
): Promise<{ success: boolean; error?: string }> => {
  if (!reservationIds.length || !barberId || !isValidUUID(barberId)) {
    return { success: false, error: 'Invalid parameters' }
  }

  try {
    const response = await fetch('/api/recurring', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'cancel_conflicts',
        reservationIds,
        barberId,
      }),
    })

    const result = await response.json()
    
    if (!response.ok || !result.success) {
      return { success: false, error: result.error || 'Failed to cancel reservations' }
    }

    return { success: true }
  } catch (err) {
    console.error('[RecurringService] Exception canceling conflicts:', err)
    return { success: false, error: 'שגיאה בביטול התורים המתנגשים' }
  }
}

// ============================================================
// Utility Functions
// ============================================================

/**
 * Convert a time slot string (HH:MM) to a timestamp for a specific date
 * Uses Israel timezone for proper conversion
 */
export const timeSlotToTimestamp = (timeSlot: string, dateTimestamp: number): number => {
  const [hours, minutes] = timeSlot.split(':').map(Number)
  // Convert to Israel timezone to get correct year/month/day
  const israelDate = timestampToIsraelDate(dateTimestamp)
  // Create timestamp using Israel timezone components
  return israelDateToTimestamp(
    israelDate.getFullYear(),
    israelDate.getMonth() + 1,
    israelDate.getDate(),
    hours,
    minutes
  )
}

/**
 * Get the day of week key from a timestamp (in Israel timezone)
 * Uses the shared utility for consistency
 */
export const getDayOfWeekFromTimestamp = (timestamp: number): DayOfWeek => {
  // Use shared utility for Israel timezone day key
  return getDayKeyInIsrael(timestamp) as DayOfWeek
}

/**
 * Export error messages for use in components
 */
export { ERROR_MESSAGES as RECURRING_ERROR_MESSAGES }
