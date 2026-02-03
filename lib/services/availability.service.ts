import { createClient } from '@/lib/supabase/client'
import type { BarbershopSettings, BarbershopClosure, BarberClosure, BarberMessage, WorkDay, BarberBookingSettings } from '@/types/database'
import { reportSupabaseError } from '@/lib/bug-reporter/helpers'
import { getTodayDateString, getIsraelDateString, getDayKeyInIsrael } from '@/lib/utils'

/**
 * Day-specific work hours for a barber
 * Maps day name to hours
 */
export type DayWorkHours = {
  [day: string]: {
    isWorking: boolean
    startTime: string | null
    endTime: string | null
  }
}

/**
 * Get barbershop settings
 */
export async function getBarbershopSettings(): Promise<BarbershopSettings | null> {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('barbershop_settings')
    .select('*')
    .single()
  
  if (error) {
    console.error('Error fetching barbershop settings:', error)
    await reportSupabaseError(error, 'Fetching barbershop settings', { table: 'barbershop_settings', operation: 'select' })
    return null
  }
  
  return data as BarbershopSettings
}

/**
 * Get all barbershop closures
 */
export async function getBarbershopClosures(): Promise<BarbershopClosure[]> {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('barbershop_closures')
    .select('*')
    .gte('end_date', getTodayDateString())
  
  if (error) {
    console.error('Error fetching barbershop closures:', error)
    await reportSupabaseError(error, 'Fetching barbershop closures', { table: 'barbershop_closures', operation: 'select' })
    return []
  }
  
  return (data as BarbershopClosure[]) || []
}

/**
 * Get barber work days with day-specific hours
 * Returns an array of WorkDay objects, one per day of week
 */
export async function getBarberWorkDays(barberId: string): Promise<WorkDay[]> {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('work_days')
    .select('*')
    .eq('user_id', barberId)
  
  if (error) {
    console.error('Error fetching barber work days:', error)
    await reportSupabaseError(error, 'Fetching barber work days', { table: 'work_days', operation: 'select' })
    return []
  }
  
  return (data as WorkDay[]) || []
}

/**
 * Get barber work days as a convenient map
 * Returns object with day names as keys for quick lookup
 */
export async function getBarberWorkDaysMap(barberId: string): Promise<DayWorkHours> {
  const workDays = await getBarberWorkDays(barberId)
  
  const map: DayWorkHours = {}
  for (const wd of workDays) {
    map[wd.day_of_week] = {
      isWorking: wd.is_working || false,
      startTime: wd.start_time,
      endTime: wd.end_time,
    }
  }
  
  return map
}

/**
 * Convert WorkDay array to DayWorkHours map (for client-side use)
 */
export function workDaysToMap(workDays: WorkDay[]): DayWorkHours {
  const map: DayWorkHours = {}
  for (const wd of workDays) {
    map[wd.day_of_week] = {
      isWorking: wd.is_working || false,
      startTime: wd.start_time,
      endTime: wd.end_time,
    }
  }
  return map
}

/**
 * Get barber closures (upcoming)
 */
export async function getBarberClosures(barberId: string): Promise<BarberClosure[]> {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('barber_closures')
    .select('*')
    .eq('barber_id', barberId)
    .gte('end_date', getTodayDateString())
  
  if (error) {
    console.error('Error fetching barber closures:', error)
    await reportSupabaseError(error, 'Fetching barber closures', { table: 'barber_closures', operation: 'select' })
    return []
  }
  
  return (data as BarberClosure[]) || []
}

/**
 * Get active barber messages
 */
export async function getBarberMessages(barberId: string): Promise<BarberMessage[]> {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('barber_messages')
    .select('*')
    .eq('barber_id', barberId)
    .eq('is_active', true)
  
  if (error) {
    console.error('Error fetching barber messages:', error)
    await reportSupabaseError(error, 'Fetching barber messages', { table: 'barber_messages', operation: 'select' })
    return []
  }
  
  return (data as BarberMessage[]) || []
}

/**
 * Check if a specific date is available for booking
 * Uses day-specific work hours via barberWorkDays
 */
export function isDateAvailable(
  dateTimestamp: number,
  shopSettings: BarbershopSettings | null,
  shopClosures: BarbershopClosure[],
  barberClosures: BarberClosure[],
  barberWorkDays?: DayWorkHours
): { available: boolean; reason?: string } {
  // Use Israel timezone for date calculations
  const dateStr = getIsraelDateString(dateTimestamp)
  // Use Israel timezone for day of week
  const dayName = getDayKeyInIsrael(dateTimestamp)
  
  // Check if shop is open on this day
  if (shopSettings && !shopSettings.open_days.includes(dayName)) {
    return { available: false, reason: 'המספרה סגורה ביום זה' }
  }
  
  // Check shop closures
  const shopClosure = shopClosures.find(c => 
    dateStr >= c.start_date && dateStr <= c.end_date
  )
  if (shopClosure) {
    return { available: false, reason: shopClosure.reason || 'המספרה סגורה בתאריך זה' }
  }
  
  // Check if barber works on this day using day-specific work days
  if (barberWorkDays && barberWorkDays[dayName]) {
    if (!barberWorkDays[dayName].isWorking) {
      return { available: false, reason: 'הספר לא עובד ביום זה' }
    }
  } else if (!barberWorkDays && shopSettings && !shopSettings.open_days.includes(dayName)) {
    // If no work days data, use shop settings as fallback
    return { available: false, reason: 'הספר לא עובד ביום זה' }
  }
  
  // Check barber closures
  const barberClosure = barberClosures.find(c => 
    dateStr >= c.start_date && dateStr <= c.end_date
  )
  if (barberClosure) {
    return { available: false, reason: barberClosure.reason || 'הספר לא זמין בתאריך זה' }
  }
  
  return { available: true }
}

/**
 * Get work hours for a barber on a specific date
 * Uses day-specific hours via barberWorkDays
 * 
 * @param shopSettings - Barbershop settings (fallback)
 * @param dayName - Day of week (e.g., 'sunday', 'monday')
 * @param barberWorkDays - Day-specific work hours map
 */
export function getWorkHours(
  shopSettings: BarbershopSettings | null,
  dayName?: string,
  barberWorkDays?: DayWorkHours
): { start: string; end: string } {
  // Day-specific hours take priority
  if (dayName && barberWorkDays && barberWorkDays[dayName]) {
    const dayHours = barberWorkDays[dayName]
    if (dayHours.isWorking && dayHours.startTime && dayHours.endTime) {
      // Normalize time format (remove seconds if present)
      const normalizeTime = (time: string): string => {
        const parts = time.split(':')
        return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`
      }
      return {
        start: normalizeTime(dayHours.startTime),
        end: normalizeTime(dayHours.endTime),
      }
    }
  }
  
  // Fall back to shop settings
  if (shopSettings) {
    return {
      start: shopSettings.work_hours_start,
      end: shopSettings.work_hours_end,
    }
  }
  
  // Default hours
  return { start: '09:00', end: '19:00' }
}

/**
 * Get work hours for a specific day from work days array
 * Convenience function for use in components
 */
export function getDayWorkHours(
  workDays: WorkDay[],
  dayName: string,
  shopSettings: BarbershopSettings | null
): { start: string; end: string; isWorking: boolean } {
  const normalizeTime = (time: string | null): string => {
    if (!time) return '09:00'
    const parts = time.split(':')
    return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`
  }
  
  const dayData = workDays.find(wd => wd.day_of_week === dayName)
  
  if (dayData) {
    return {
      start: normalizeTime(dayData.start_time),
      end: normalizeTime(dayData.end_time),
      isWorking: dayData.is_working || false,
    }
  }
  
  // Fallback to shop settings
  if (shopSettings) {
    return {
      start: normalizeTime(shopSettings.work_hours_start),
      end: normalizeTime(shopSettings.work_hours_end),
      isWorking: shopSettings.open_days.includes(dayName),
    }
  }
  
  return { start: '09:00', end: '19:00', isWorking: false }
}

/**
 * Get barber booking settings
 * Contains booking and cancellation policies separate from notification settings
 * 
 * Settings include:
 * - max_booking_days_ahead: Maximum days ahead for booking (default: 15)
 * - min_hours_before_booking: Minimum hours before slot to allow booking (default: 1)
 * - min_cancel_hours: Minimum hours before appointment to allow cancellation (default: 2)
 */
export async function getBarberBookingSettings(barberId: string): Promise<BarberBookingSettings | null> {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('barber_booking_settings')
    .select('*')
    .eq('barber_id', barberId)
    .single()
  
  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching barber booking settings:', error)
    await reportSupabaseError(error, 'Fetching barber booking settings', { table: 'barber_booking_settings', operation: 'select' })
  }
  
  return data as BarberBookingSettings | null
}

/**
 * Get barber booking settings with defaults
 * Returns default values if no settings found for barber
 */
export async function getBarberBookingSettingsWithDefaults(barberId: string): Promise<{
  max_booking_days_ahead: number
  min_hours_before_booking: number
  min_cancel_hours: number
}> {
  const settings = await getBarberBookingSettings(barberId)
  
  return {
    max_booking_days_ahead: settings?.max_booking_days_ahead ?? 15,
    min_hours_before_booking: settings?.min_hours_before_booking ?? 1,
    min_cancel_hours: settings?.min_cancel_hours ?? 2,
  }
}
