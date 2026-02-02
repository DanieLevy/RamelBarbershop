import { createClient } from '@/lib/supabase/client'
import type { TrustedDevice, Customer } from '@/types/database'
import { reportSupabaseError } from '@/lib/bug-reporter/helpers'

// Device token expiration in days
const DEVICE_EXPIRATION_DAYS = 30

// LocalStorage key for device token
export const DEVICE_TOKEN_KEY = 'ramel_trusted_device_token'

/**
 * Result of device validation
 */
export interface TrustedDeviceResult {
  isValid: boolean
  customer?: Customer
  device?: TrustedDevice
  error?: string
}

/**
 * Generate a secure random device token
 * Format: td_{timestamp}_{random}
 */
export function generateDeviceToken(): string {
  const timestamp = Date.now().toString(36)
  const randomPart = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
  return `td_${timestamp}_${randomPart}`
}

/**
 * Calculate expiration date (30 days from now)
 */
function getExpirationDate(): string {
  const date = new Date()
  date.setDate(date.getDate() + DEVICE_EXPIRATION_DAYS)
  return date.toISOString()
}

/**
 * Get device token from localStorage
 */
export function getStoredDeviceToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(DEVICE_TOKEN_KEY)
}

/**
 * Save device token to localStorage
 */
export function saveDeviceToken(token: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(DEVICE_TOKEN_KEY, token)
}

/**
 * Remove device token from localStorage
 * Note: This does NOT deactivate the device in the database
 * The user can still use the token from another browser/device if they have it
 */
export function removeDeviceToken(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(DEVICE_TOKEN_KEY)
}

/**
 * Create a trusted device record after successful OTP verification
 * 
 * @param customerId - The customer's UUID
 * @param phone - The customer's phone number
 * @param userAgent - Optional browser user agent string
 * @returns The generated device token, or null on error
 */
export async function createTrustedDevice(
  customerId: string,
  phone: string,
  userAgent?: string
): Promise<string | null> {
  const supabase = createClient()
  
  const deviceToken = generateDeviceToken()
  const expiresAt = getExpirationDate()
  const normalizedPhone = phone.replace(/\D/g, '')
  
  // Create fingerprint from available data
  const deviceFingerprint = userAgent 
    ? `${normalizedPhone}-${userAgent.slice(0, 50)}`
    : normalizedPhone
  
  const { error } = await supabase
    .from('trusted_devices')
    .insert({
      customer_id: customerId,
      phone: normalizedPhone,
      device_token: deviceToken,
      device_fingerprint: deviceFingerprint,
      user_agent: userAgent || null,
      expires_at: expiresAt,
      is_active: true,
    })
  
  if (error) {
    console.error('[TrustedDevice] Error creating trusted device:', error)
    await reportSupabaseError(error, 'Creating trusted device', { table: 'trusted_devices', operation: 'insert' })
    return null
  }
  
  console.log(`[TrustedDevice] Created trusted device for phone ${normalizedPhone.slice(0, 3)}****${normalizedPhone.slice(-2)}, expires: ${expiresAt}`)
  return deviceToken
}

/**
 * Validate a trusted device token
 * 
 * @param phone - The phone number to check
 * @param token - The device token from localStorage
 * @returns Validation result with customer data if valid
 */
export async function validateTrustedDevice(
  phone: string,
  token: string
): Promise<TrustedDeviceResult> {
  const supabase = createClient()
  const normalizedPhone = phone.replace(/\D/g, '')
  
  // Find the device by token
  const { data: device, error: deviceError } = await supabase
    .from('trusted_devices')
    .select('*')
    .eq('device_token', token)
    .eq('phone', normalizedPhone)
    .eq('is_active', true)
    .maybeSingle()
  
  if (deviceError) {
    console.error('[TrustedDevice] Error finding device:', deviceError)
    return { isValid: false, error: 'שגיאה באימות המכשיר' }
  }
  
  if (!device) {
    console.log('[TrustedDevice] Device not found or not active')
    return { isValid: false, error: 'מכשיר לא מזוהה' }
  }
  
  // Check if expired
  const now = new Date()
  const expiresAt = new Date(device.expires_at)
  
  if (now > expiresAt) {
    console.log('[TrustedDevice] Device token expired')
    // Deactivate the expired device
    await deactivateDevice(token)
    return { isValid: false, error: 'אימות המכשיר פג תוקף' }
  }
  
  // Get the customer
  const { data: customer, error: customerError } = await supabase
    .from('customers')
    .select('*')
    .eq('id', device.customer_id)
    .maybeSingle()
  
  if (customerError || !customer) {
    console.error('[TrustedDevice] Customer not found:', customerError)
    return { isValid: false, error: 'משתמש לא נמצא' }
  }
  
  // Check if customer is blocked
  if (customer.is_blocked) {
    console.log('[TrustedDevice] Customer is blocked')
    return { isValid: false, error: 'חשבון המשתמש חסום' }
  }
  
  // Update last_used_at
  await supabase
    .from('trusted_devices')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', device.id)
  
  console.log(`[TrustedDevice] Valid device for customer ${customer.fullname}`)
  return {
    isValid: true,
    customer: customer as Customer,
    device: device as TrustedDevice,
  }
}

/**
 * Extend device expiration by 30 days from now
 * Called after successful use of the device
 */
export async function extendDeviceExpiration(token: string): Promise<void> {
  const supabase = createClient()
  const newExpiresAt = getExpirationDate()
  
  const { error } = await supabase
    .from('trusted_devices')
    .update({
      expires_at: newExpiresAt,
      last_used_at: new Date().toISOString(),
    })
    .eq('device_token', token)
  
  if (error) {
    console.error('[TrustedDevice] Error extending expiration:', error)
  } else {
    console.log(`[TrustedDevice] Extended device expiration to ${newExpiresAt}`)
  }
}

/**
 * Deactivate a device (mark as inactive)
 * Does not delete the record for audit purposes
 */
export async function deactivateDevice(token: string): Promise<void> {
  const supabase = createClient()
  
  const { error } = await supabase
    .from('trusted_devices')
    .update({ is_active: false })
    .eq('device_token', token)
  
  if (error) {
    console.error('[TrustedDevice] Error deactivating device:', error)
  } else {
    console.log('[TrustedDevice] Device deactivated')
  }
}

/**
 * Deactivate all devices for a customer
 * Used when customer wants to log out from all devices
 */
export async function deactivateAllCustomerDevices(customerId: string): Promise<void> {
  const supabase = createClient()
  
  const { error } = await supabase
    .from('trusted_devices')
    .update({ is_active: false })
    .eq('customer_id', customerId)
  
  if (error) {
    console.error('[TrustedDevice] Error deactivating all devices:', error)
  } else {
    console.log('[TrustedDevice] All devices deactivated for customer')
  }
}

/**
 * Get count of active trusted devices for a customer
 * Useful for future device limit feature
 */
export async function getActiveDeviceCount(customerId: string): Promise<number> {
  const supabase = createClient()
  
  const { count, error } = await supabase
    .from('trusted_devices')
    .select('*', { count: 'exact', head: true })
    .eq('customer_id', customerId)
    .eq('is_active', true)
    .gt('expires_at', new Date().toISOString())
  
  if (error) {
    console.error('[TrustedDevice] Error counting devices:', error)
    return 0
  }
  
  return count || 0
}

/**
 * Cleanup expired devices
 * Can be called from a cron job to keep the table clean
 * 
 * @returns Number of devices cleaned up
 */
export async function cleanupExpiredDevices(): Promise<number> {
  const supabase = createClient()
  
  // Deactivate expired devices (don't delete for audit trail)
  const { data, error } = await supabase
    .from('trusted_devices')
    .update({ is_active: false })
    .eq('is_active', true)
    .lt('expires_at', new Date().toISOString())
    .select('id')
  
  if (error) {
    console.error('[TrustedDevice] Error cleaning up expired devices:', error)
    return 0
  }
  
  const count = data?.length || 0
  if (count > 0) {
    console.log(`[TrustedDevice] Cleaned up ${count} expired devices`)
  }
  
  return count
}
