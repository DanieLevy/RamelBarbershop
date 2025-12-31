import { createClient } from '@/lib/supabase/client'
import type { Customer } from '@/types/database'
import { reportSupabaseError } from '@/lib/bug-reporter/helpers'

// Define commonly needed customer columns for optimized queries
const CUSTOMER_COLUMNS = 'id, phone, fullname, firebase_uid, is_blocked, blocked_reason, last_login_at, created_at, updated_at'

/**
 * Find a customer by phone number
 */
export async function findCustomerByPhone(phone: string): Promise<Customer | null> {
  const supabase = createClient()
  
  // Normalize phone - remove leading 0 if present and ensure consistent format
  const normalizedPhone = phone.replace(/\D/g, '')
  
  // Use maybeSingle() to avoid 406 error when customer doesn't exist
  const { data, error } = await supabase
    .from('customers')
    .select(CUSTOMER_COLUMNS)
    .eq('phone', normalizedPhone)
    .maybeSingle()
  
  if (error) {
    console.error('Error finding customer by phone:', error)
    return null
  }
  
  return data as Customer | null
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
  
  const { data, error } = await supabase.from('customers')
    .insert({
      phone: normalizedPhone,
      fullname,
      firebase_uid: firebaseUid || null,
    })
    .select()
    .single()
  
  if (error) {
    console.error('Error creating customer:', error)
    await reportSupabaseError(error, 'Creating new customer', { table: 'customers', operation: 'insert' })
    return null
  }
  
  return data as Customer
}

/**
 * Get or create a customer - optimized upsert logic using single query where possible
 */
export async function getOrCreateCustomer(
  phone: string,
  fullname: string,
  firebaseUid?: string
): Promise<Customer | null> {
  const supabase = createClient()
  const normalizedPhone = phone.replace(/\D/g, '')
  
  // Try to upsert in a single operation for better performance
  // This inserts if not exists, updates if exists (based on unique phone constraint)
  const { data, error } = await supabase.from('customers')
    .upsert(
      {
        phone: normalizedPhone,
        fullname,
        firebase_uid: firebaseUid || null,
        last_login_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { 
        onConflict: 'phone',
        ignoreDuplicates: false 
      }
    )
    .select()
    .single()
  
  if (error) {
    // If upsert fails (e.g., on old Supabase versions), fall back to original logic
    console.warn('Upsert failed, falling back to find+create:', error)
    
    const existing = await findCustomerByPhone(phone)
    if (existing) {
      await updateLastLogin(existing.id, firebaseUid)
      return { ...existing, firebase_uid: firebaseUid || existing.firebase_uid }
    }
    
    return createCustomer(phone, fullname, firebaseUid)
  }
  
  return data as Customer
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
  
  const { error } = await supabase.from('customers')
    .update(updateData)
    .eq('id', customerId)
  
  if (error) {
    console.error('Error updating last login:', error)
    await reportSupabaseError(error, 'Updating customer last login', { table: 'customers', operation: 'update' })
  }
}

/**
 * Get customer by ID
 */
export async function getCustomerById(customerId: string): Promise<Customer | null> {
  const supabase = createClient()
  
  // Use maybeSingle() to avoid 406 error when customer doesn't exist
  const { data, error } = await supabase
    .from('customers')
    .select(CUSTOMER_COLUMNS)
    .eq('id', customerId)
    .maybeSingle()
  
  if (error) {
    console.error('Error getting customer by ID:', error)
    return null
  }
  
  return data as Customer | null
}

/**
 * Update customer details
 */
export async function updateCustomer(
  customerId: string,
  updates: { fullname?: string }
): Promise<Customer | null> {
  const supabase = createClient()
  
  const { data, error } = await supabase.from('customers')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', customerId)
    .select()
    .single()
  
  if (error) {
    console.error('Error updating customer:', error)
    await reportSupabaseError(error, 'Updating customer profile', { table: 'customers', operation: 'update' })
    return null
  }
  
  return data as Customer
}

/**
 * Update customer name only
 */
export async function updateCustomerName(
  customerId: string,
  fullname: string
): Promise<boolean> {
  const supabase = createClient()
  
  const { error } = await supabase.from('customers')
    .update({ fullname: fullname.trim() })
    .eq('id', customerId)
  
  if (error) {
    console.error('Error updating customer name:', error)
    await reportSupabaseError(error, 'Updating customer name', { table: 'customers', operation: 'update' })
    return false
  }
  
  return true
}

/**
 * Check if a customer is blocked
 */
export async function isCustomerBlocked(customerId: string): Promise<boolean> {
  const supabase = createClient()
  
  const { data, error } = await supabase.from('customers')
    .select('is_blocked')
    .eq('id', customerId)
    .single()
  
  if (error || !data) {
    return false
  }
  
  return data.is_blocked === true
}

/**
 * Toggle customer blocked status
 */
export async function toggleCustomerBlocked(
  customerId: string,
  block: boolean,
  reason?: string
): Promise<boolean> {
  const supabase = createClient()
  
  const updateData = block
    ? { is_blocked: true, blocked_at: new Date().toISOString(), blocked_reason: reason || null }
    : { is_blocked: false, blocked_at: null, blocked_reason: null }
  
  const { error } = await supabase.from('customers')
    .update(updateData)
    .eq('id', customerId)
  
  if (error) {
    console.error('Error toggling customer blocked status:', error)
    await reportSupabaseError(error, 'Toggling customer blocked status', { table: 'customers', operation: 'update' })
    return false
  }
  
  return true
}

/**
 * Get all customers (for admin)
 */
export async function getAllCustomers(): Promise<Customer[]> {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('customers')
    .select(CUSTOMER_COLUMNS)
    .order('created_at', { ascending: false })
  
  if (error) {
    console.error('Error fetching all customers:', error)
    await reportSupabaseError(error, 'Fetching all customers', { table: 'customers', operation: 'select' })
    return []
  }
  
  return (data as Customer[]) || []
}

/**
 * Delete a customer by ID
 */
export async function deleteCustomer(customerId: string): Promise<boolean> {
  const supabase = createClient()
  
  const { error } = await supabase
    .from('customers')
    .delete()
    .eq('id', customerId)
  
  if (error) {
    console.error('Error deleting customer:', error)
    await reportSupabaseError(error, 'Deleting customer', { table: 'customers', operation: 'delete' })
    return false
  }
  
  return true
}

/**
 * Check if a given ID is a customer (vs barber)
 */
export async function isCustomerId(id: string): Promise<boolean> {
  const supabase = createClient()
  
  const { data } = await supabase
    .from('customers')
    .select('id')
    .eq('id', id)
    .single()
  
  return data !== null
}