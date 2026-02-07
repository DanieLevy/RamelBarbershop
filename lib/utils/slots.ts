/**
 * Time Slot Normalization Functions
 *
 * Critical for consistent slot matching across the system.
 * All time slots are 30-minute intervals (configurable).
 */

import { timestampToIsraelDate, israelDateToTimestamp } from './timezone'

/** Default slot interval in minutes (30 minutes for barbershop) */
export const SLOT_INTERVAL_MINUTES = 30

/** Slot interval in milliseconds */
export const SLOT_INTERVAL_MS = SLOT_INTERVAL_MINUTES * 60 * 1000

/**
 * Normalize a timestamp to the START of its time slot
 * 
 * This is CRITICAL for consistent slot matching:
 * - Input: 1770219042952 (17:30:42.952)
 * - Output: 1770219000000 (17:30:00.000)
 * 
 * The slot interval is 30 minutes, so:
 * - 17:00:00 to 17:29:59 → 17:00:00
 * - 17:30:00 to 17:59:59 → 17:30:00
 * - 18:00:00 to 18:29:59 → 18:00:00
 * 
 * @param timestamp - Any timestamp in milliseconds
 * @returns Normalized timestamp at the start of the slot (seconds=0, ms=0)
 */
export function normalizeToSlotBoundary(timestamp: number): number {
  // Convert to Israel time to get correct hour/minute
  const israelDate = timestampToIsraelDate(timestamp)
  const year = israelDate.getFullYear()
  const month = israelDate.getMonth() + 1
  const day = israelDate.getDate()
  const hour = israelDate.getHours()
  const minute = israelDate.getMinutes()
  
  // Round minute down to nearest slot boundary (0 or 30 for 30-min slots)
  const normalizedMinute = Math.floor(minute / SLOT_INTERVAL_MINUTES) * SLOT_INTERVAL_MINUTES
  
  // Create clean timestamp with normalized minute and zero seconds/ms
  return israelDateToTimestamp(year, month, day, hour, normalizedMinute)
}

/**
 * Get a unique slot key for comparison (avoids floating-point issues)
 * Format: "YYYY-MM-DD-HH-MM" where MM is always 00 or 30
 * 
 * @param timestamp - Any timestamp in milliseconds
 * @returns Slot key string for exact comparison
 */
export function getSlotKey(timestamp: number): string {
  const israelDate = timestampToIsraelDate(timestamp)
  const year = israelDate.getFullYear()
  const month = String(israelDate.getMonth() + 1).padStart(2, '0')
  const day = String(israelDate.getDate()).padStart(2, '0')
  const hour = String(israelDate.getHours()).padStart(2, '0')
  const minute = Math.floor(israelDate.getMinutes() / SLOT_INTERVAL_MINUTES) * SLOT_INTERVAL_MINUTES
  const minuteStr = String(minute).padStart(2, '0')
  
  return `${year}-${month}-${day}-${hour}-${minuteStr}`
}

/**
 * Check if two timestamps are in the same time slot
 * This is the SAFEST way to compare time slots
 * 
 * @param ts1 - First timestamp
 * @param ts2 - Second timestamp
 * @returns true if both are in the same 30-minute slot
 */
export function isSameSlot(ts1: number, ts2: number): boolean {
  return getSlotKey(ts1) === getSlotKey(ts2)
}

/**
 * Normalize timestamp format from seconds to milliseconds if needed
 * 
 * Handles legacy data where timestamps might be stored in seconds instead of ms
 * Threshold: January 1, 2000 in milliseconds (946684800000)
 * 
 * @param timestamp - Timestamp that might be in seconds or milliseconds
 * @returns Timestamp in milliseconds
 */
export function normalizeTimestampFormat(timestamp: number): number {
  // If timestamp is less than year 2000 in ms, it's likely in seconds
  if (timestamp < 946684800000) {
    return timestamp * 1000
  }
  return timestamp
}
