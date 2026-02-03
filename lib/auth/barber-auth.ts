import bcrypt from 'bcryptjs'
import { createClient } from '@/lib/supabase/client'
import type { User, BarberSession, UserRole } from '@/types/database'
import { reportSupabaseError } from '@/lib/bug-reporter/helpers'
import { withSupabaseRetry, isRetryableError } from '@/lib/utils/retry'

const SALT_ROUNDS = 10
const SESSION_KEY = 'ramel_barber_session'
// Session never expires - only manual logout clears the session
// This ensures barbers stay logged in permanently for best UX

/**
 * Hash a password
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

/**
 * Compare password with hash
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

/**
 * Login barber with email and password
 */
export async function loginBarber(
  email: string,
  password: string
): Promise<{ success: boolean; user?: User; error?: string }> {
  const supabase = createClient()
  
  const normalizedEmail = email.toLowerCase().trim()
  
  // Find user by email - use maybeSingle to handle not found gracefully
  // Note: We do NOT filter by is_active here - paused barbers should still be able to log in
  // The is_active flag only controls visibility for public booking, not dashboard access
  const { data: user, error } = await supabase
    .from('users')
    .select('id, username, fullname, email, phone, role, is_barber, is_active, img_url, img_position_x, img_position_y, password_hash, name_en, instagram_url, created_at, updated_at')
    .eq('email', normalizedEmail)
    .eq('is_barber', true)
    .maybeSingle()
  
  if (error) {
    console.error('Login error:', error)
    await reportSupabaseError(error, 'Barber Login - Database Query', {
      table: 'users',
      operation: 'select',
    })
    return { success: false, error: 'שגיאה בהתחברות. נסה שוב.' }
  }
  
  if (!user) {
    return { success: false, error: 'אימייל או סיסמה שגויים' }
  }
  
  const barber = user as User
  
  if (!barber.password_hash) {
    return { success: false, error: 'חשבון לא מאותחל - פנה למנהל' }
  }
  
  // Verify password
  const isValid = await comparePassword(password, barber.password_hash)
  
  if (!isValid) {
    return { success: false, error: 'אימייל או סיסמה שגויים' }
  }
  
  // Save session
  saveBarberSession(barber)
  
  return { success: true, user: barber }
}

/**
 * Save barber session to localStorage
 * Sessions are permanent - no expiration (only manual logout clears them)
 */
export function saveBarberSession(user: User): void {
  if (typeof window === 'undefined') return
  
  const session: BarberSession = {
    barberId: user.id,
    email: user.email || '',
    fullname: user.fullname,
    role: user.role as UserRole,
    expiresAt: 0, // 0 = never expires (kept for backward compatibility)
  }
  
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

/**
 * Get barber session from localStorage
 * Sessions are permanent - only manual logout clears them
 */
export function getBarberSession(): BarberSession | null {
  if (typeof window === 'undefined') return null
  
  const stored = localStorage.getItem(SESSION_KEY)
  if (!stored) return null
  
  try {
    const session: BarberSession = JSON.parse(stored)
    
    // Sessions are now permanent - skip expiration check
    // expiresAt === 0 means never expires (new behavior)
    // For backward compatibility, also accept old sessions with future dates
    // Only reject if expiresAt is set to a past date AND is not 0
    if (session.expiresAt !== 0 && session.expiresAt > 0 && session.expiresAt < Date.now()) {
      // Migrate old expired sessions: re-save without expiration
      // This allows previously logged-in barbers to stay logged in
      console.log('[BarberAuth] Migrating old session to permanent format')
      session.expiresAt = 0
      localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    }
    
    return session
  } catch {
    localStorage.removeItem(SESSION_KEY)
    return null
  }
}

/**
 * Clear barber session
 */
export function clearBarberSession(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(SESSION_KEY)
}

/**
 * Validate session against database
 * 
 * IMPORTANT: Uses retry logic for transient network failures (e.g., iOS Safari "Load failed")
 * Only clears session on authentication errors (user not found), NOT on network errors.
 */
export async function validateBarberSession(): Promise<User | null> {
  const session = getBarberSession()
  if (!session) return null
  
  const supabase = createClient()
  
  try {
    // Use retry logic for transient network failures (iOS Safari "Load failed", etc.)
    const result = await withSupabaseRetry(async () => {
      // Note: We do NOT filter by is_active here - paused barbers should still be able to access their dashboard
      // The is_active flag only controls visibility for public booking, not dashboard access
      const { data: user, error } = await supabase
        .from('users')
        .select('id, username, fullname, email, phone, role, is_barber, is_active, img_url, img_position_x, img_position_y, name_en, instagram_url, created_at, updated_at')
        .eq('id', session.barberId)
        .eq('is_barber', true)
        .maybeSingle()
      
      if (error) {
        // Throw to trigger retry for transient errors
        throw error
      }
      
      return user
    }, {
      maxRetries: 3,
      initialDelayMs: 500,
      onRetry: (attempt, error, delay) => {
        console.log(`[BarberAuth] Session validation retry ${attempt}: ${error.message}. Retrying in ${delay}ms...`)
      }
    })
    
    if (!result) {
      // User genuinely not found in database - clear session (they were deleted or barber status removed)
      console.log('[BarberAuth] User not found in database - clearing session')
      clearBarberSession()
      return null
    }
    
    return result as User
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    console.error('[BarberAuth] Session validation failed:', err.message)
    
    // Determine if this is a network error vs. an auth error
    const isNetworkError = isRetryableError(err)
    
    if (isNetworkError) {
      // Network error - DON'T clear session, the user might just have poor connectivity
      // Return null to indicate validation failed, but preserve the session for retry
      console.warn('[BarberAuth] Network error during session validation - session preserved for retry')
      await reportSupabaseError(
        { message: err.message, code: 'NETWORK_ERROR', details: 'Transient network failure - session preserved' },
        'Barber Session Validation - Network Error',
        { table: 'users', operation: 'select' }
      )
      // Throw the error so the store can handle the offline case
      throw err
    } else {
      // Non-network error (auth issue, etc.) - clear session and report
      console.error('[BarberAuth] Auth error - clearing session')
      await reportSupabaseError(
        { message: err.message, code: 'AUTH_ERROR' },
        'Barber Session Validation - Auth Error',
        { table: 'users', operation: 'select' }
      )
      clearBarberSession()
      return null
    }
  }
}

/**
 * Create or update barber password
 */
export async function setBarberPassword(
  barberId: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient()
  
  const passwordHash = await hashPassword(newPassword)
  
  const { error } = await supabase.from('users')
    .update({ password_hash: passwordHash, updated_at: new Date().toISOString() })
    .eq('id', barberId)
  
  if (error) {
    console.error('Error setting password:', error)
    await reportSupabaseError(error, 'Setting Barber Password', {
      table: 'users',
      operation: 'update',
    })
    return { success: false, error: 'שגיאה בעדכון הסיסמה' }
  }
  
  return { success: true }
}

/**
 * Create a new barber user with default work days and schedule
 * Uses API route to bypass RLS restrictions for related tables
 */
export async function createBarber(data: {
  username: string
  fullname: string
  email: string
  password: string
  phone?: string
  role?: 'admin' | 'barber'
}): Promise<{ success: boolean; user?: User; error?: string }> {
  try {
    const response = await fetch('/api/barbers/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: data.username,
        fullname: data.fullname,
        email: data.email,
        password: data.password,
        phone: data.phone,
        role: data.role || 'barber',
      }),
    })
    
    const result = await response.json()
    
    if (!response.ok || !result.success) {
      console.error('Error creating barber:', result.error)
      return { success: false, error: result.error || 'שגיאה ביצירת ספר' }
    }
    
    return { success: true, user: result.user as User }
  } catch (error) {
    console.error('Error in createBarber:', error)
    await reportSupabaseError(
      { message: error instanceof Error ? error.message : 'Unknown error', code: 'NETWORK_ERROR' },
      'Creating New Barber via API',
      { operation: 'insert' }
    )
    return { success: false, error: 'שגיאה בתקשורת עם השרת' }
  }
}

/**
 * Update barber details
 */
export async function updateBarber(
  barberId: string,
  updates: {
    fullname?: string
    email?: string
    phone?: string
    img_url?: string
    img_position_x?: number
    img_position_y?: number
    is_active?: boolean
    username?: string
    name_en?: string
    instagram_url?: string | null
  }
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient()
  
  const { error } = await supabase.from('users')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', barberId)
  
  if (error) {
    console.error('Error updating barber:', error)
    await reportSupabaseError(error, 'Updating Barber Profile', {
      table: 'users',
      operation: 'update',
    })
    return { success: false, error: 'שגיאה בעדכון המשתמש' }
  }
  
  return { success: true }
}

/**
 * Get all barbers
 */
export async function getAllBarbers(): Promise<User[]> {
  const supabase = createClient()
  
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, username, fullname, email, phone, role, is_barber, is_active, img_url, display_order, created_at, updated_at')
      .eq('is_barber', true)
      .order('display_order', { ascending: true })
    
    if (error) {
      console.error('Error fetching barbers:', error)
      console.error('Error code:', error.code)
      console.error('Error message:', error.message)
      console.error('Error details:', JSON.stringify(error, null, 2))
      await reportSupabaseError(error, 'Fetching All Barbers', {
        table: 'users',
        operation: 'select',
      })
      throw error
    }
    
    return (data as User[]) || []
  } catch (error) {
    console.error('Exception in getAllBarbers:', error)
    return []
  }
}

/**
 * Get barber by ID
 */
export async function getBarberById(barberId: string): Promise<User | null> {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', barberId)
    .eq('is_barber', true)
    .single()
  
  if (error || !data) {
    return null
  }
  
  return data as User
}

