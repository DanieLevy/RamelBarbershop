import { createClient } from '@/lib/supabase/client'
import type { BarbershopSettings, BarbershopClosure, BarberSchedule, BarberClosure, BarberMessage } from '@/types/database'
import { reportSupabaseError } from '@/lib/bug-reporter/helpers'

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
    .gte('end_date', new Date().toISOString().split('T')[0])
  
  if (error) {
    console.error('Error fetching barbershop closures:', error)
    await reportSupabaseError(error, 'Fetching barbershop closures', { table: 'barbershop_closures', operation: 'select' })
    return []
  }
  
  return (data as BarbershopClosure[]) || []
}

/**
 * Get barber schedule
 */
export async function getBarberSchedule(barberId: string): Promise<BarberSchedule | null> {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('barber_schedules')
    .select('*')
    .eq('barber_id', barberId)
    .single()
  
  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching barber schedule:', error)
    await reportSupabaseError(error, 'Fetching barber schedule', { table: 'barber_schedules', operation: 'select' })
  }
  
  return data as BarberSchedule | null
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
    .gte('end_date', new Date().toISOString().split('T')[0])
  
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
 */
export function isDateAvailable(
  dateTimestamp: number,
  shopSettings: BarbershopSettings | null,
  shopClosures: BarbershopClosure[],
  barberSchedule: BarberSchedule | null,
  barberClosures: BarberClosure[]
): { available: boolean; reason?: string } {
  const date = new Date(dateTimestamp)
  const dateStr = date.toISOString().split('T')[0]
  const dayName = getDayName(date.getDay())
  
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
  
  // Check if barber works on this day
  if (barberSchedule && !barberSchedule.work_days.includes(dayName)) {
    return { available: false, reason: 'הספר לא עובד ביום זה' }
  }
  
  // If no barber schedule, use shop settings as fallback
  if (!barberSchedule && shopSettings && !shopSettings.open_days.includes(dayName)) {
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
 */
export function getWorkHours(
  shopSettings: BarbershopSettings | null,
  barberSchedule: BarberSchedule | null
): { start: string; end: string } {
  // Barber schedule takes priority
  if (barberSchedule) {
    return {
      start: barberSchedule.work_hours_start,
      end: barberSchedule.work_hours_end,
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

function getDayName(dayIndex: number): string {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  return days[dayIndex]
}

