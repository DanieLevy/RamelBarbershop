/**
 * Barber Breakouts Service
 * 
 * Handles business logic for barber breaks (lunch, early departure, etc.)
 * These block specific time slots without creating actual reservation entries.
 */

import { createClient } from '@/lib/supabase/client'
import { reportSupabaseError } from '@/lib/bug-reporter/helpers'
import {
  BLOCKING_RESERVATION_STATUS,
  doesBreakoutApplyToDate,
  getSlotKey,
  timestampToIsraelDate,
  israelDateToTimestamp,
  getDayKeyInIsrael,
  getIsraelDateString,
  getTodayDateString,
  SLOT_INTERVAL_MINUTES,
  enumerateDateStringsInRange,
  getUpcomingDateStringsForDay,
  parseTimeToMinutes,
} from '@/lib/utils'
import type {
  BarberBreakout,
  BreakoutType,
  DayOfWeek,
} from '@/types/database'

// ============================================================
// Types
// ============================================================

export interface CreateBreakoutData {
  barberId: string
  breakoutType: BreakoutType
  startTime: string // HH:MM format
  endTime: string | null // HH:MM format or null for end of day
  startDate?: string // YYYY-MM-DD for single/date_range
  endDate?: string // YYYY-MM-DD for date_range
  dayOfWeek?: DayOfWeek // For recurring
  reason?: string
}

export interface ConflictingReservation {
  id: string
  customerName: string
  time: string // HH:MM
  date: string // YYYY-MM-DD
  serviceName: string
  timeTimestamp: number
}

// ============================================================
// Validation & Helpers
// ============================================================

/**
 * Parse time string (HH:MM) to minutes since midnight
 */
/**
 * Check if a slot timestamp falls within a time range
 */
const isTimestampInTimeRange = (
  timestamp: number,
  startTime: string,
  endTime: string | null,
  workDayEnd?: string // For "until end of day" case
): boolean => {
  const israelDate = timestampToIsraelDate(timestamp)
  const slotMinutes = israelDate.getHours() * 60 + israelDate.getMinutes()
  
  const startMinutes = parseTimeToMinutes(startTime)
  const endMinutes = endTime 
    ? parseTimeToMinutes(endTime) 
    : (workDayEnd ? parseTimeToMinutes(workDayEnd) : 24 * 60) // 24:00 if no end
  
  return slotMinutes >= startMinutes && slotMinutes < endMinutes
}

// ============================================================
// Client-Side Service Functions
// ============================================================

/**
 * Get all active breakouts for a barber
 */
export async function getBarberBreakouts(barberId: string): Promise<BarberBreakout[]> {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('barber_breakouts')
    .select('id, barber_id, breakout_type, start_time, end_time, start_date, end_date, day_of_week, reason, is_active, created_at, deactivated_at')
    .eq('barber_id', barberId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
  
  if (error) {
    console.error('Error fetching barber breakouts:', error)
    await reportSupabaseError(error, 'Fetching barber breakouts', {
      table: 'barber_breakouts',
      operation: 'select',
    })
    return []
  }
  
  return (data as BarberBreakout[]) || []
}

/**
 * Get breakouts applicable to a specific date
 * This handles all three types: single, date_range, and recurring
 */
export async function getBreakoutsForDate(
  barberId: string,
  dateTimestamp: number
): Promise<BarberBreakout[]> {
  const supabase = createClient()
  const dateString = getIsraelDateString(dateTimestamp)
  const dayOfWeek = getDayKeyInIsrael(dateTimestamp) as DayOfWeek
  
  // Fetch all active breakouts for this barber
  const { data, error } = await supabase
    .from('barber_breakouts')
    .select('id, barber_id, breakout_type, start_time, end_time, start_date, end_date, day_of_week, reason, is_active, created_at, deactivated_at')
    .eq('barber_id', barberId)
    .eq('is_active', true)
  
  if (error) {
    console.error('Error fetching breakouts for date:', error)
    await reportSupabaseError(error, 'Fetching breakouts for date', {
      table: 'barber_breakouts',
      operation: 'select',
    })
    return []
  }
  
  if (!data) return []
  
  // Filter breakouts applicable to this date
  const applicableBreakouts = (data as BarberBreakout[]).filter(breakout => {
    return doesBreakoutApplyToDate(breakout, dateString, dayOfWeek)
  })
  
  return applicableBreakouts
}

/**
 * Check if a specific time slot is blocked by a breakout
 */
export function isSlotInBreakout(
  slotTimestamp: number,
  breakouts: BarberBreakout[],
  workDayEndTime?: string
): { blocked: boolean; reason?: string } {
  for (const breakout of breakouts) {
    if (isTimestampInTimeRange(
      slotTimestamp,
      breakout.start_time,
      breakout.end_time,
      workDayEndTime
    )) {
      return {
        blocked: true,
        reason: breakout.reason || undefined,
      }
    }
  }
  
  return { blocked: false }
}

/**
 * Get all slot keys blocked by breakouts for a specific date
 */
export function getBlockedSlotKeys(
  dateTimestamp: number,
  breakouts: BarberBreakout[],
  workDayStart: string,
  workDayEnd: string
): Set<string> {
  const blockedKeys = new Set<string>()
  
  // Get the Israel date components
  const israelDate = timestampToIsraelDate(dateTimestamp)
  const year = israelDate.getFullYear()
  const month = israelDate.getMonth() + 1
  const day = israelDate.getDate()
  
  // Parse work hours
  const startMinutes = parseTimeToMinutes(workDayStart)
  const endMinutes = parseTimeToMinutes(workDayEnd)
  
  // Generate all slots in the work day
  for (let minutes = startMinutes; minutes < endMinutes; minutes += SLOT_INTERVAL_MINUTES) {
    const hour = Math.floor(minutes / 60)
    const minute = minutes % 60
    const slotTimestamp = israelDateToTimestamp(year, month, day, hour, minute)
    
    const { blocked } = isSlotInBreakout(slotTimestamp, breakouts, workDayEnd)
    if (blocked) {
      blockedKeys.add(getSlotKey(slotTimestamp))
    }
  }
  
  return blockedKeys
}

/**
 * Check for conflicting reservations before creating a breakout
 */
export async function checkBreakoutConflicts(
  barberId: string,
  data: CreateBreakoutData
): Promise<ConflictingReservation[]> {
  const supabase = createClient()
  const conflicts: ConflictingReservation[] = []
  const today = getTodayDateString()
  
  // Build date range to check based on breakout type
  let datesToCheck: string[] = []
  
  switch (data.breakoutType) {
    case 'single':
      if (data.startDate && data.startDate >= today) {
        datesToCheck = [data.startDate]
      }
      break
    
    case 'date_range':
      if (data.startDate && data.endDate) {
        datesToCheck = enumerateDateStringsInRange(data.startDate, data.endDate, 30)
          .filter((dateStr) => dateStr >= today)
      }
      break
    
    case 'recurring':
      if (data.dayOfWeek) {
        datesToCheck = getUpcomingDateStringsForDay(data.dayOfWeek, 4)
          .filter((dateStr) => dateStr >= today)
      }
      break
  }
  
  if (datesToCheck.length === 0) return []
  
  // Parse time range
  const startMinutes = parseTimeToMinutes(data.startTime)
  const endMinutes = data.endTime ? parseTimeToMinutes(data.endTime) : 24 * 60
  
  // Fetch reservations for these dates
  for (const dateStr of datesToCheck) {
    // Calculate day start/end timestamps for this date
    const [year, month, day] = dateStr.split('-').map(Number)
    const dayStart = israelDateToTimestamp(year, month, day, 0, 0)
    const dayEnd = israelDateToTimestamp(year, month, day, 23, 59)
    
    const { data: reservations, error } = await supabase
      .from('reservations')
      .select(`
        id,
        time_timestamp,
        date_timestamp,
        status,
        customers!inner (
          fullname
        ),
        services!inner (
          name
        )
      `)
      .eq('barber_id', barberId)
      .eq('status', BLOCKING_RESERVATION_STATUS)
      .gte('time_timestamp', dayStart)
      .lte('time_timestamp', dayEnd)
    
    if (error) {
      console.error('Error checking conflicts:', error)
      await reportSupabaseError(error, 'Checking breakout conflicts', {
        table: 'reservations',
        operation: 'select',
      })
      continue
    }
    
    if (!reservations) continue
    
    // Check each reservation against the time range
    for (const res of reservations) {
      const resIsraelDate = timestampToIsraelDate(res.time_timestamp)
      const resMinutes = resIsraelDate.getHours() * 60 + resIsraelDate.getMinutes()
      
      if (resMinutes >= startMinutes && resMinutes < endMinutes) {
        // Type assertion for joined data
        const customer = res.customers as { fullname: string }
        const service = res.services as { name: string }
        
        conflicts.push({
          id: res.id,
          customerName: customer.fullname,
          time: `${String(resIsraelDate.getHours()).padStart(2, '0')}:${String(resIsraelDate.getMinutes()).padStart(2, '0')}`,
          date: dateStr,
          serviceName: service.name,
          timeTimestamp: res.time_timestamp,
        })
      }
    }
  }
  
  return conflicts
}

// ============================================================
// Hebrew Day of Week Mapping
// ============================================================

export const DAY_OF_WEEK_HEBREW_MAP: Record<DayOfWeek, string> = {
  sunday: 'ראשון',
  monday: 'שני',
  tuesday: 'שלישי',
  wednesday: 'רביעי',
  thursday: 'חמישי',
  friday: 'שישי',
  saturday: 'שבת',
}
