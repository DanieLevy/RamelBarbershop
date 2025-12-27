import { createClient } from '@/lib/supabase/client'
import type { Customer } from '@/types/database'

/**
 * Find a customer by phone number
 */
export async function findCustomerByPhone(phone: string): Promise<Customer | null> {
  const supabase = createClient()
  
  // Normalize phone - remove leading 0 if present and ensure consistent format
  const normalizedPhone = phone.replace(/\D/g, '')
  
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('phone', normalizedPhone)
    .single()
  
  if (error || !data) {
    return null
  }
  
  return data as Customer
}

/**
 * Create a new customer
 */
export async function createCustomer(
  phone: string,
  fullname: string,
  firebaseUid?: string
): Promise<Customer | null> {
  const supabase = createClient()
  
  const normalizedPhone = phone.replace(/\D/g, '')
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('customers') as any)
    .insert({
      phone: normalizedPhone,
      fullname,
      firebase_uid: firebaseUid || null,
    })
    .select()
    .single()
  
  if (error) {
    console.error('Error creating customer:', error)
    return null
  }
  
  return data as Customer
}

/**
 * Get or create a customer - upsert logic
 */
export async function getOrCreateCustomer(
  phone: string,
  fullname: string,
  firebaseUid?: string
): Promise<Customer | null> {
  // First try to find existing customer
  const existing = await findCustomerByPhone(phone)
  
  if (existing) {
    // Update last login and firebase_uid if provided
    await updateLastLogin(existing.id, firebaseUid)
    return { ...existing, firebase_uid: firebaseUid || existing.firebase_uid }
  }
  
  // Create new customer
  return createCustomer(phone, fullname, firebaseUid)
}

/**
 * Update customer's last login timestamp
 */
export async function updateLastLogin(
  customerId: string,
  firebaseUid?: string
): Promise<void> {
  const supabase = createClient()
  
  const updateData: { last_login_at: string; firebase_uid?: string } = {
    last_login_at: new Date().toISOString(),
  }
  
  if (firebaseUid) {
    updateData.firebase_uid = firebaseUid
  }
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('customers') as any)
    .update(updateData)
    .eq('id', customerId)
  
  if (error) {
    console.error('Error updating last login:', error)
  }
}

/**
 * Get customer by ID
 */
export async function getCustomerById(customerId: string): Promise<Customer | null> {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('id', customerId)
    .single()
  
  if (error || !data) {
    return null
  }
  
  return data as Customer
}

/**
 * Update customer details
 */
export async function updateCustomer(
  customerId: string,
  updates: { fullname?: string }
): Promise<Customer | null> {
  const supabase = createClient()
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('customers') as any)
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', customerId)
    .select()
    .single()
  
  if (error) {
    console.error('Error updating customer:', error)
    return null
  }
  
  return data as Customer
}
