/**
 * Israel Timezone Constants and Conversion Functions
 *
 * Core timezone utilities used throughout the application.
 * All date/time operations should use these functions to ensure
 * consistent Israel timezone handling.
 */

import { format } from 'date-fns'
import { toZonedTime, fromZonedTime } from 'date-fns-tz'

// ============================================================
// ISRAEL TIMEZONE CONSTANTS
// ============================================================

/**
 * Israel timezone identifier - USE THIS CONSTANT EVERYWHERE
 * Never hardcode 'Asia/Jerusalem' elsewhere
 */
export const ISRAEL_TIMEZONE = 'Asia/Jerusalem'

// ============================================================
// CORE TIMEZONE CONVERSION FUNCTIONS
// ============================================================

/**
 * Get current time in Israel timezone
 * This is the PRIMARY function for getting "now" in Israel
 */
export function nowInIsrael(): Date {
  return toZonedTime(new Date(), ISRAEL_TIMEZONE)
}

/**
 * Convert a Date to Israel timezone
 */
export function toIsraelTime(date: Date): Date {
  return toZonedTime(date, ISRAEL_TIMEZONE)
}

/**
 * Convert a timestamp (milliseconds) to Israel timezone Date
 * IMPORTANT: This converts UTC timestamp to Israel local representation
 */
export function timestampToIsraelDate(timestamp: number): Date {
  return toZonedTime(new Date(timestamp), ISRAEL_TIMEZONE)
}

/**
 * Create a Date in Israel timezone and get its UTC timestamp
 * Use when you have year/month/day/hour/minute in Israel local time
 * and need the UTC timestamp for storage
 */
export function israelDateToTimestamp(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0
): number {
  const israelDate = fromZonedTime(
    new Date(year, month - 1, day, hour, minute, 0, 0),
    ISRAEL_TIMEZONE
  )
  return israelDate.getTime()
}

/**
 * Get current timestamp in milliseconds
 * Note: Date.now() is timezone-agnostic (always UTC)
 * Use this for comparisons with stored timestamps
 */
export function nowInIsraelMs(): number {
  return Date.now()
}

// ============================================================
// ISRAEL DAY BOUNDARY FUNCTIONS
// Critical for queries that filter by date
// ============================================================

/**
 * Get start of day (00:00:00.000) in Israel timezone as UTC timestamp
 * USE THIS for database queries filtering by day start
 */
export function getIsraelDayStart(date: Date | number): number {
  const israelDate = typeof date === 'number' 
    ? timestampToIsraelDate(date) 
    : toIsraelTime(date)
  
  const year = israelDate.getFullYear()
  const month = israelDate.getMonth() + 1 // getMonth is 0-indexed
  const day = israelDate.getDate()
  
  return israelDateToTimestamp(year, month, day, 0, 0)
}

/**
 * Get end of day (23:59:59.999) in Israel timezone as UTC timestamp
 * USE THIS for database queries filtering by day end
 */
export function getIsraelDayEnd(date: Date | number): number {
  const dayStart = getIsraelDayStart(date)
  // Add 24 hours minus 1 millisecond
  return dayStart + (24 * 60 * 60 * 1000) - 1
}

/**
 * Get start of day as Date object in Israel timezone
 */
export function startOfDayInIsrael(date: Date | number): Date {
  const timestamp = getIsraelDayStart(date)
  return timestampToIsraelDate(timestamp)
}

/**
 * Get end of day as Date object in Israel timezone
 */
export function endOfDayInIsrael(date: Date | number): Date {
  const timestamp = getIsraelDayEnd(date)
  return timestampToIsraelDate(timestamp)
}

// ============================================================
// DAY OF WEEK FUNCTIONS (ISRAEL TIMEZONE)
// ============================================================

/**
 * Get day of week (0-6, Sunday=0) for a timestamp in Israel timezone
 * ALWAYS use this instead of new Date(timestamp).getDay()
 */
export function getDayIndexInIsrael(timestamp: number): number {
  const israelDate = timestampToIsraelDate(timestamp)
  return israelDate.getDay()
}

/**
 * Get day key (lowercase string) for a timestamp in Israel timezone
 */
export function getDayKeyInIsrael(timestamp: number): string {
  const dayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  return dayKeys[getDayIndexInIsrael(timestamp)]
}

// ============================================================
// DATE COMPARISON FUNCTIONS
// ============================================================

/**
 * Check if a timestamp is today in Israel timezone
 */
export function isTodayInIsrael(timestamp: number): boolean {
  const nowIsraelDate = nowInIsrael()
  const dateIsrael = timestampToIsraelDate(timestamp)
  return format(nowIsraelDate, 'yyyy-MM-dd') === format(dateIsrael, 'yyyy-MM-dd')
}

/**
 * Check if a timestamp is in the past
 * Note: This is timezone-agnostic as it compares UTC timestamps
 */
export function isPastInIsrael(timestamp: number): boolean {
  return timestamp < Date.now()
}

/**
 * Check if a date string (YYYY-MM-DD) is today in Israel
 */
export function isDateStringToday(dateString: string): boolean {
  const nowIsraelDate = nowInIsrael()
  return format(nowIsraelDate, 'yyyy-MM-dd') === dateString
}

/**
 * Get today's date string in Israel timezone (YYYY-MM-DD)
 */
export function getTodayDateString(): string {
  return format(nowInIsrael(), 'yyyy-MM-dd')
}

/**
 * Get ISO date string for a timestamp in Israel timezone
 */
export function getIsraelDateString(timestamp: number): string {
  const date = timestampToIsraelDate(timestamp)
  return format(date, 'yyyy-MM-dd')
}

/**
 * Compare two timestamps by date only (ignoring time) in Israel timezone
 */
export function isSameDayInIsrael(timestamp1: number, timestamp2: number): boolean {
  return getIsraelDateString(timestamp1) === getIsraelDateString(timestamp2)
}
