import bcrypt from 'bcryptjs'
import { createClient } from '@/lib/supabase/client'
import type { User, BarberSession, UserRole } from '@/types/database'
import { reportSupabaseError } from '@/lib/bug-reporter/helpers'
import { withSupabaseRetry, isRetryableError } from '@/lib/utils/retry'
import { saveSessionDual, readSessionDual, clearSessionDual } from '@/lib/utils/session-storage'

const SALT_ROUNDS = 10
const SESSION_KEY = 'ramel_barber_session'
const COOKIE_KEY = 'rb_barber_s'
// Session never expires - only manual logout clears the session
// This ensures barbers stay logged in permanently for best UX
// Dual-storage: localStorage + cookie fallback for iOS resilience

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
 * Login error codes for specific error handling
 */
export type LoginErrorCode = 
  | 'USER_NOT_FOUND'
  | 'WRONG_PASSWORD'
  | 'NO_PASSWORD_SET'
  | 'NOT_A_BARBER'
  | 'DATABASE_ERROR'
  | 'NETWORK_ERROR'
  | 'INVALID_INPUT'

/**
 * Login result with detailed error information
 */
export interface LoginResult {
  success: boolean
  user?: User
  error?: string
  errorCode?: LoginErrorCode
}

/**
 * Login barber with email and password
 * Returns detailed error codes for informative UI feedback
 */
export async function loginBarber(
  email: string,
  password: string
): Promise<LoginResult> {
  // Validate input
  if (!email?.trim()) {
    return { 
      success: false, 
      error: 'נא להזין כתובת אימייל',
      errorCode: 'INVALID_INPUT'
    }
  }
  
  if (!password) {
    return { 
      success: false, 
      error: 'נא להזין סיסמה',
      errorCode: 'INVALID_INPUT'
    }
  }
  
  const supabase = createClient()
  const normalizedEmail = email.toLowerCase().trim()
  
  try {
    // First, check if email exists at all (any user)
    const { data: anyUser, error: checkError } = await supabase
      .from('users')
      .select('id, is_barber')
      .eq('email', normalizedEmail)
      .maybeSingle()
    
    if (checkError) {
      console.error('[BarberLogin] Database check error:', checkError)
      await reportSupabaseError(checkError, 'Barber Login - Email Check', {
        table: 'users',
        operation: 'select',
      })
      return { 
        success: false, 
        error: 'שגיאה בבדיקת החשבון. נסה שוב.',
        errorCode: 'DATABASE_ERROR'
      }
    }
    
    // Email not found at all
    if (!anyUser) {
      console.log('[BarberLogin] Email not found:', normalizedEmail)
      return { 
        success: false, 
        error: 'כתובת האימייל לא רשומה במערכת',
        errorCode: 'USER_NOT_FOUND'
      }
    }
    
    // Email exists but not a barber account
    if (!anyUser.is_barber) {
      console.log('[BarberLogin] User exists but is not a barber:', normalizedEmail)
      return { 
        success: false, 
        error: 'חשבון זה אינו חשבון ספר. האם התכוונת להתחבר כלקוח?',
        errorCode: 'NOT_A_BARBER'
      }
    }
    
    // User is a barber - now get full details
    const { data: user, error } = await supabase
      .from('users')
      .select('id, username, fullname, email, phone, role, is_barber, is_active, img_url, img_position_x, img_position_y, password_hash, name_en, instagram_url, created_at, updated_at')
      .eq('email', normalizedEmail)
      .eq('is_barber', true)
      .maybeSingle()
    
    if (error) {
      console.error('[BarberLogin] Database query error:', error)
      await reportSupabaseError(error, 'Barber Login - Fetch User', {
        table: 'users',
        operation: 'select',
      })
      return { 
        success: false, 
        error: 'שגיאה בהתחברות. נסה שוב.',
        errorCode: 'DATABASE_ERROR'
      }
    }
    
    if (!user) {
      return { 
        success: false, 
        error: 'שגיאה בטעינת פרטי המשתמש',
        errorCode: 'DATABASE_ERROR'
      }
    }
    
    const barber = user as User
    
    // Check if password is set
    if (!barber.password_hash) {
      console.log('[BarberLogin] No password set for barber:', normalizedEmail)
      return { 
        success: false, 
        error: 'טרם הוגדרה סיסמה לחשבון זה. פנה למנהל המערכת להגדרת סיסמה.',
        errorCode: 'NO_PASSWORD_SET'
      }
    }
    
    // Verify password
    const isValid = await comparePassword(password, barber.password_hash)
    
    if (!isValid) {
      console.log('[BarberLogin] Wrong password for barber:', normalizedEmail)
      return { 
        success: false, 
        error: 'הסיסמה שהוזנה שגויה. נסה שוב.',
        errorCode: 'WRONG_PASSWORD'
      }
    }
    
    // Save session
    saveBarberSession(barber)
    
    return { success: true, user: barber }
    
  } catch (err) {
    console.error('[BarberLogin] Unexpected error:', err)
    
    // Check if it's a network error
    const errorMessage = err instanceof Error ? err.message : String(err)
    if (errorMessage.toLowerCase().includes('network') || 
        errorMessage.toLowerCase().includes('load failed') ||
        errorMessage.toLowerCase().includes('fetch')) {
      return {
        success: false,
        error: 'בעיית תקשורת. בדוק את החיבור לאינטרנט ונסה שוב.',
        errorCode: 'NETWORK_ERROR'
      }
    }
    
    await reportSupabaseError(
      { message: errorMessage, code: 'LOGIN_EXCEPTION' },
      'Barber Login - Unexpected Error',
      { table: 'users', operation: 'select' }
    )
    
    return { 
      success: false, 
      error: 'שגיאה בלתי צפויה. נסה שוב.',
      errorCode: 'DATABASE_ERROR'
    }
  }
}

/**
 * Save barber session to localStorage + cookie fallback
 * Sessions are permanent - no expiration (only manual logout clears them)
 * Dual-storage ensures iOS localStorage eviction doesn't cause logouts
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
  
  saveSessionDual(SESSION_KEY, COOKIE_KEY, session)
}

/**
 * Get barber session from localStorage with cookie fallback
 * Sessions are permanent - only manual logout clears them
 * If localStorage was evicted (iOS), recovers from cookie automatically
 */
export function getBarberSession(): BarberSession | null {
  if (typeof window === 'undefined') return null
  
  const session = readSessionDual<BarberSession>(SESSION_KEY, COOKIE_KEY)
  if (!session) return null
  
  // Sessions are now permanent - skip expiration check
  // expiresAt === 0 means never expires (new behavior)
  // For backward compatibility, also accept old sessions with future dates
  // Only reject if expiresAt is set to a past date AND is not 0
  if (session.expiresAt !== 0 && session.expiresAt > 0 && session.expiresAt < Date.now()) {
    // Migrate old expired sessions: re-save without expiration
    console.log('[BarberAuth] Migrating old session to permanent format')
    session.expiresAt = 0
    saveSessionDual(SESSION_KEY, COOKIE_KEY, session)
  }
  
  return session
}

/**
 * Clear barber session from all storage layers
 */
export function clearBarberSession(): void {
  if (typeof window === 'undefined') return
  clearSessionDual(SESSION_KEY, COOKIE_KEY)
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
    // Properly serialize error message to avoid [object Object]
    const getErrorMessage = (e: unknown): string => {
      if (e instanceof Error) return e.message
      if (typeof e === 'string') return e
      if (e && typeof e === 'object') {
        // Handle Supabase/PostgrestError objects
        const obj = e as Record<string, unknown>
        if (typeof obj.message === 'string') return obj.message
        if (typeof obj.error === 'string') return obj.error
        try {
          return JSON.stringify(e)
        } catch {
          return 'Unknown error object'
        }
      }
      return String(e)
    }
    
    const errorMessage = getErrorMessage(error)
    const err = error instanceof Error ? error : new Error(errorMessage)
    console.error('[BarberAuth] Session validation failed:', errorMessage)
    
    // Determine if this is a network error vs. an auth error
    const isNetworkError = isRetryableError(err)
    
    if (isNetworkError) {
      // Network error - DON'T clear session, the user might just have poor connectivity
      // Return null to indicate validation failed, but preserve the session for retry
      console.warn('[BarberAuth] Network error during session validation - session preserved for retry')
      await reportSupabaseError(
        { message: errorMessage, code: 'NETWORK_ERROR', details: 'Transient network failure - session preserved' },
        'Barber Session Validation - Network Error',
        { table: 'users', operation: 'select' }
      )
      // Throw the error so the store can handle the offline case
      throw err
    } else {
      // Non-network error (auth issue, etc.) - clear session and report
      console.error('[BarberAuth] Auth error - clearing session')
      await reportSupabaseError(
        { message: errorMessage, code: 'AUTH_ERROR' },
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
    .select('id, username, fullname, name_en, img_url, img_position_x, img_position_y, phone, email, is_barber, is_active, role, display_order, instagram_url, blocked_customers')
    .eq('id', barberId)
    .eq('is_barber', true)
    .single()
  
  if (error || !data) {
    return null
  }
  
  return data as User
}

