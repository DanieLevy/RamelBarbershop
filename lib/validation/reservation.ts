/**
 * Reservation Validation Utilities
 * 
 * Type guards and validation functions for ensuring
 * reservation data integrity before database operations.
 */

import { getCanonicalReservationDayFields } from '@/lib/utils'

export interface ReservationCreateData {
  barber_id: string
  service_id: string
  customer_id: string
  customer_name: string
  customer_phone: string
  date_timestamp: number
  time_timestamp: number
  day_name?: string
  day_num?: string
  status?: 'confirmed' | 'cancelled' | 'completed'
}

export interface ReservationValidationResult {
  valid: boolean
  errors: string[]
  data?: ReservationCreateData
}

/**
 * Validate reservation data before creation
 */
export function validateReservationData(data: Partial<ReservationCreateData>): ReservationValidationResult {
  const errors: string[] = []

  // Required fields
  if (!data.barber_id?.trim()) {
    errors.push('barber_id is required')
  }
  
  if (!data.service_id?.trim()) {
    errors.push('service_id is required')
  }
  
  if (!data.customer_name?.trim()) {
    errors.push('customer_name is required')
  }
  
  if (!data.customer_phone?.trim()) {
    errors.push('customer_phone is required')
  }
  
  if (!data.date_timestamp || typeof data.date_timestamp !== 'number') {
    errors.push('date_timestamp is required and must be a number')
  }
  
  if (!data.time_timestamp || typeof data.time_timestamp !== 'number') {
    errors.push('time_timestamp is required and must be a number')
  }
  
  // customer_id is required for the current production booking contract
  if (!data.customer_id?.trim()) {
    errors.push('customer_id is required')
  }

  // UUID format validation
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  
  if (data.barber_id && !uuidRegex.test(data.barber_id)) {
    errors.push('barber_id must be a valid UUID')
  }
  
  if (data.service_id && !uuidRegex.test(data.service_id)) {
    errors.push('service_id must be a valid UUID')
  }
  
  if (data.customer_id && !uuidRegex.test(data.customer_id)) {
    errors.push('customer_id must be a valid UUID')
  }

  if (errors.length > 0) {
    return { valid: false, errors }
  }

  const derivedDayFields = getCanonicalReservationDayFields(data.time_timestamp!)

  return {
    valid: true,
    errors: [],
    data: {
      barber_id: data.barber_id!,
      service_id: data.service_id!,
      customer_id: data.customer_id!,  // Now required
      customer_name: data.customer_name!,
      customer_phone: data.customer_phone!,
      date_timestamp: data.date_timestamp!,
      time_timestamp: data.time_timestamp!,
      day_name: data.day_name?.trim() || derivedDayFields.dayName,
      day_num: data.day_num?.trim() || derivedDayFields.dayNum,
      status: data.status || 'confirmed'
    }
  }
}

/**
 * Alias kept for compatibility with older imports.
 */
export const validateLoggedInReservation = validateReservationData

/**
 * Type guard to check if reservation has customer_id
 */
export function hasCustomerId<T extends { customer_id?: string | null }>(
  reservation: T
): reservation is T & { customer_id: string } {
  return typeof reservation.customer_id === 'string' && reservation.customer_id.length > 0
}

/**
 * Type guard to check if reservation has barber_id
 */
export function hasBarberId<T extends { barber_id?: string | null }>(
  reservation: T
): reservation is T & { barber_id: string } {
  return typeof reservation.barber_id === 'string' && reservation.barber_id.length > 0
}
