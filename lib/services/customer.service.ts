import { createClient } from '@/lib/supabase/client'
import type { Customer } from '@/types/database'
import { reportBug } from '@/lib/bug-reporter'
import { reportSupabaseError } from '@/lib/bug-reporter/helpers'
import { withSupabaseRetry, isRetryableError } from '@/lib/utils/retry'

// Auth method types for customer authentication
export type AuthMethod = 'phone' | 'email' | 'both'

/**
 * Define commonly needed customer columns for optimized queries
 * 
 * DATABASE COLUMN NOTES:
 * - `provider_uid`: SMS provider user ID (e.g., "o19-0501234567" for 019 SMS provider)
 *   Format: {provider_prefix}-{phone_number}
 * - `supabase_uid`: Stores Supabase Auth user ID (used for email authentication)
 * - `auth_method`: Tracks which auth methods the customer has used ('phone', 'email', or 'both')
 */
const CUSTOMER_COLUMNS = 'id, phone, fullname, email, auth_method, provider_uid, supabase_uid, is_blocked, blocked_reason, last_login_at, created_at, updated_at'

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
 * Uses getOrCreateCustomer API route for secure server-side operation.
 * 
 * @param phone - Customer phone number
 * @param fullname - Customer full name
 * @param providerUid - SMS provider user ID (e.g., "o19-0501234567")
 */
export async function createCustomer(
  phone: string,
  fullname: string,
  providerUid?: string
): Promise<Customer | null> {
  // Delegate to getOrCreateCustomer which uses the API route
  return getOrCreateCustomer(phone, fullname, providerUid)
}

/**
 * Get or create a customer using SMS/Phone authentication
 * 
 * Auth method logic:
 * - New user: set auth_method to 'phone'
 * - Existing user with email (supabase_uid): set to 'both' 
 * - Existing user without email: keep as 'phone'
 * 
 * Uses API route for secure server-side operation (bypasses RLS).
 * 
 * @param phone - Customer phone number
 * @param fullname - Customer full name
 * @param providerUid - SMS provider user ID (e.g., "o19-0501234567")
 */
export async function getOrCreateCustomer(
  phone: string,
  fullname: string,
  providerUid?: string
): Promise<Customer | null> {
  try {
    const response = await fetch('/api/customers/get-or-create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, fullname, providerUid }),
    })
    
    const result = await response.json()
    
    if (!response.ok || !result.success) {
      console.error('[CustomerService] getOrCreateCustomer API error:', result.error)
      return null
    }
    
    return result.customer as Customer
  } catch (error) {
    console.error('[CustomerService] getOrCreateCustomer error:', error)
    await reportSupabaseError(
      { message: error instanceof Error ? error.message : String(error), code: 'API_ERROR' },
      'Get or create customer via API',
      { table: 'customers', operation: 'rpc' }
    )
    return null
  }
}

/**
 * Update customer's last login timestamp
 * 
 * @param customerId - Customer ID
 * @param providerUid - SMS provider user ID (e.g., "o19-0501234567")
 * @param supabaseUid - Supabase Auth user ID (for email authentication)
 */
export async function updateLastLogin(
  customerId: string,
  providerUid?: string,
  supabaseUid?: string
): Promise<void> {
  const supabase = createClient()
  
  const updateData: { last_login_at: string; provider_uid?: string; supabase_uid?: string } = {
    last_login_at: new Date().toISOString(),
  }
  
  if (providerUid) {
    updateData.provider_uid = providerUid
  }
  
  if (supabaseUid) {
    updateData.supabase_uid = supabaseUid
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
 * Get customer by ID - used for session validation
 * 
 * This function is called during app startup to validate sessions.
 * It uses retry logic for transient network failures (iOS Safari "Load failed").
 * 
 * IMPORTANT: Throws on network errors to allow calling code to handle offline state.
 * Returns null only when customer is genuinely not found.
 */
export async function getCustomerById(customerId: string): Promise<Customer | null> {
  const supabase = createClient()
  
  try {
    // Use retry logic for transient network failures
    const result = await withSupabaseRetry(async () => {
      // Use maybeSingle() to avoid 406 error when customer doesn't exist
      const { data, error } = await supabase
        .from('customers')
        .select(CUSTOMER_COLUMNS)
        .eq('id', customerId)
        .maybeSingle()
      
      if (error) {
        // Throw to trigger retry for transient errors
        throw error
      }
      
      return data
    }, {
      maxRetries: 3,
      initialDelayMs: 500,
      onRetry: (attempt, error, delay) => {
        console.log(`[CustomerService] getCustomerById retry ${attempt}: ${error.message}. Retrying in ${delay}ms...`)
      }
    })
    
    return result as Customer | null
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    console.error('[CustomerService] Error getting customer by ID:', err.message)
    
    // Determine if this is a retryable network error
    if (isRetryableError(err)) {
      // Network error - throw to allow store to handle offline state
      console.warn('[CustomerService] Network error fetching customer - allowing retry')
      await reportSupabaseError(
        { message: err.message, code: 'NETWORK_ERROR', details: 'Transient network failure' },
        'Customer Session Validation - Network Error',
        { table: 'customers', operation: 'select' }
      )
      throw err
    }
    
    // Non-network error - log and return null
    return null
  }
}

/**
 * Update customer details
 * Uses API route for secure server-side operation.
 */
export async function updateCustomer(
  customerId: string,
  updates: { fullname?: string; email?: string }
): Promise<Customer | null> {
  try {
    const response = await fetch('/api/customers/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId, ...updates }),
    })
    
    const result = await response.json()
    
    if (!response.ok || !result.success) {
      console.error('[CustomerService] updateCustomer API error:', result.error)
      return null
    }
    
    return result.customer as Customer
  } catch (error) {
    console.error('[CustomerService] updateCustomer error:', error)
    await reportSupabaseError(
      { message: error instanceof Error ? error.message : String(error), code: 'API_ERROR' },
      'Update customer via API',
      { table: 'customers', operation: 'rpc' }
    )
    return null
  }
}

/**
 * Update customer name only
 * Delegates to updateCustomer API route.
 */
export async function updateCustomerName(
  customerId: string,
  fullname: string
): Promise<boolean> {
  const result = await updateCustomer(customerId, { fullname: fullname.trim() })
  return result !== null
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

// ============================================
// Email Authentication Methods
// ============================================

/**
 * Find a customer by email address
 */
export async function findCustomerByEmail(email: string): Promise<Customer | null> {
  const supabase = createClient()
  
  const normalizedEmail = email.trim().toLowerCase()
  
  const { data, error } = await supabase
    .from('customers')
    .select(CUSTOMER_COLUMNS)
    .eq('email', normalizedEmail)
    .maybeSingle()
  
  if (error) {
    console.error('Error finding customer by email:', error)
    return null
  }
  
  return data as Customer | null
}

/**
 * Get or create a customer using email authentication
 * This is used when a user signs up via email fallback
 * Uses API route to bypass RLS restrictions
 */
export async function getOrCreateCustomerWithEmail(
  phone: string,
  fullname: string,
  email: string,
  supabaseUid?: string
): Promise<Customer | null> {
  try {
    const response = await fetch('/api/customers/get-or-create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone,
        fullname,
        email,
        supabaseUid,
      }),
    })
    
    const result = await response.json()
    
    if (!response.ok || !result.success) {
      console.error('Error creating customer with email:', result.error)
      await reportBug(
        new Error(result.error || 'Failed to create customer with email'),
        'Creating customer with email via API',
        { additionalData: { phone: phone.slice(0, 3) + '****', email: email.split('@')[0] + '@***' } }
      )
      return null
    }
    
    return result.customer as Customer
  } catch (error) {
    console.error('Error in getOrCreateCustomerWithEmail:', error)
    await reportBug(
      error instanceof Error ? error : new Error(String(error)),
      'Creating customer with email via API'
    )
    return null
  }
}

/**
 * Link email to an existing customer account
 * Used when a phone-registered user adds email as fallback
 * Uses API route to bypass RLS restrictions
 * 
 * Auth method logic:
 * - If user has provider_uid (previously used SMS) → set to 'both'
 * - If user has no provider_uid (never used SMS) → set to 'email'
 */
export async function linkEmailToCustomer(
  customerId: string,
  email: string,
  supabaseUid?: string
): Promise<Customer | null> {
  const supabase = createClient()
  const normalizedEmail = email.trim().toLowerCase()
  
  // Check if email is already used by another customer (read-only operation)
  const existingWithEmail = await findCustomerByEmail(normalizedEmail)
  if (existingWithEmail && existingWithEmail.id !== customerId) {
    console.error('Email already linked to another customer')
    return null
  }
  
  // First, fetch the current customer to check their provider_uid (read-only)
  const { data: currentCustomer } = await supabase
    .from('customers')
    .select('provider_uid, auth_method')
    .eq('id', customerId)
    .single()
  
  // Determine the correct auth_method:
  // - If user has provider_uid → they've used SMS before → 'both'
  // - If user has no provider_uid → never used SMS → 'email'
  const hasUsedSms = currentCustomer?.provider_uid !== null && currentCustomer?.provider_uid !== undefined
  const newAuthMethod: AuthMethod = hasUsedSms ? 'both' : 'email'
  
  try {
    // Use API route for UPDATE operation (bypasses RLS)
    const response = await fetch('/api/customers/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId,
        email: normalizedEmail,
        authMethod: newAuthMethod,
        supabaseUid,
        lastLoginAt: true,
      }),
    })
    
    const result = await response.json()
    
    if (!response.ok || !result.success) {
      console.error('Error linking email to customer:', result.error)
      await reportBug(
        new Error(result.error || 'Failed to link email'),
        'Linking email to customer via API',
        { additionalData: { customerId, email: normalizedEmail.split('@')[0] + '@***' } }
      )
      return null
    }
    
    console.log(`[CustomerService] Linked email to customer ${customerId}, auth_method set to '${newAuthMethod}'`)
    return result.customer as Customer
  } catch (error) {
    console.error('Error in linkEmailToCustomer:', error)
    await reportBug(
      error instanceof Error ? error : new Error(String(error)),
      'Linking email to customer via API'
    )
    return null
  }
}

/**
 * Update customer's last login timestamp with optional Supabase UID
 */
export async function updateLastLoginWithSupabase(
  customerId: string,
  supabaseUid?: string
): Promise<void> {
  const supabase = createClient()
  
  const updateData: Record<string, unknown> = {
    last_login_at: new Date().toISOString(),
  }
  
  if (supabaseUid) {
    updateData.supabase_uid = supabaseUid
  }
  
  const { error } = await supabase.from('customers')
    .update(updateData)
    .eq('id', customerId)
  
  if (error) {
    console.error('Error updating last login with supabase:', error)
    await reportSupabaseError(error, 'Updating customer last login', { table: 'customers', operation: 'update' })
  }
}

/**
 * Get customer's authentication method
 * Returns the primary auth method used by the customer
 */
export async function getCustomerAuthMethod(phone: string): Promise<AuthMethod | null> {
  const customer = await findCustomerByPhone(phone)
  if (!customer) return null
  
  return (customer.auth_method as AuthMethod) || 'phone'
}

// ============================================
// Duplicate Prevention Methods
// ============================================

export type DuplicateCheckResult = {
  isDuplicate: boolean
  conflictType?: 'email_exists' | 'phone_exists' | 'email_different_phone' | 'phone_different_email'
  existingCustomer?: Customer
  message?: string
}

/**
 * Check if email is already registered to a different phone number
 * Used to prevent duplicate accounts
 */
export async function checkEmailDuplicate(
  email: string,
  currentPhone?: string
): Promise<DuplicateCheckResult> {
  const normalizedEmail = email.trim().toLowerCase()
  const existingByEmail = await findCustomerByEmail(normalizedEmail)
  
  if (!existingByEmail) {
    return { isDuplicate: false }
  }
  
  // If checking with a phone number, see if it matches
  if (currentPhone) {
    const normalizedPhone = currentPhone.replace(/\D/g, '')
    if (existingByEmail.phone === normalizedPhone) {
      // Same phone - this is the same user, not a duplicate
      return { isDuplicate: false, existingCustomer: existingByEmail }
    }
  }
  
  // Email exists with different phone
  return {
    isDuplicate: true,
    conflictType: 'email_different_phone',
    existingCustomer: existingByEmail,
    message: 'כתובת האימייל כבר רשומה למספר טלפון אחר'
  }
}

/**
 * Check if phone is already registered to a different email
 * Used to prevent duplicate accounts
 */
export async function checkPhoneDuplicate(
  phone: string,
  currentEmail?: string
): Promise<DuplicateCheckResult> {
  const normalizedPhone = phone.replace(/\D/g, '')
  const existingByPhone = await findCustomerByPhone(normalizedPhone)
  
  if (!existingByPhone) {
    return { isDuplicate: false }
  }
  
  // If user has email and we're checking against a different email
  if (currentEmail && existingByPhone.email) {
    const normalizedEmail = currentEmail.trim().toLowerCase()
    if (existingByPhone.email !== normalizedEmail) {
      return {
        isDuplicate: true,
        conflictType: 'phone_different_email',
        existingCustomer: existingByPhone,
        message: 'מספר הטלפון כבר רשום לכתובת אימייל אחרת'
      }
    }
  }
  
  // Phone exists - return the existing customer
  return { isDuplicate: false, existingCustomer: existingByPhone }
}

/**
 * Comprehensive duplicate check for both email and phone
 */
export async function checkForDuplicates(
  phone: string,
  email?: string
): Promise<DuplicateCheckResult> {
  const normalizedPhone = phone.replace(/\D/g, '')
  
  // First check if phone exists
  const phoneCheck = await checkPhoneDuplicate(normalizedPhone, email)
  if (phoneCheck.isDuplicate) {
    return phoneCheck
  }
  
  // If email provided, check email
  if (email) {
    const emailCheck = await checkEmailDuplicate(email, normalizedPhone)
    if (emailCheck.isDuplicate) {
      return emailCheck
    }
  }
  
  return { isDuplicate: false, existingCustomer: phoneCheck.existingCustomer }
}