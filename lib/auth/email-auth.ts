'use client'

import { createClient } from '@/lib/supabase/client'

/**
 * Email OTP Authentication Service
 * 
 * Uses Supabase Auth for email-based OTP authentication as a fallback
 * when Firebase SMS OTP fails or is unavailable.
 */

// Error messages in Hebrew for user-friendly display
const ERROR_MESSAGES: Record<string, string> = {
  'invalid_email': 'כתובת אימייל לא תקינה',
  'email_not_confirmed': 'האימייל לא אומת',
  'over_email_send_rate_limit': 'יותר מדי ניסיונות, נסה שוב מאוחר יותר',
  'otp_expired': 'הקוד פג תוקף, בקש קוד חדש',
  'otp_disabled': 'אימות באימייל לא זמין כרגע',
  'validation_failed': 'קוד אימות שגוי',
  'user_not_found': 'משתמש לא נמצא',
  'email_address_invalid': 'כתובת אימייל לא תקינה',
  'rate_limit_exceeded': 'יותר מדי ניסיונות, המתן מספר דקות',
  'unknown': 'שגיאה בשליחת קוד האימות',
}

/**
 * Get a user-friendly error message in Hebrew
 */
function getErrorMessage(errorCode: string | undefined, defaultMessage?: string): string {
  if (!errorCode) return defaultMessage || ERROR_MESSAGES.unknown
  
  // Check for partial matches
  for (const [key, message] of Object.entries(ERROR_MESSAGES)) {
    if (errorCode.toLowerCase().includes(key.toLowerCase())) {
      return message
    }
  }
  
  return defaultMessage || ERROR_MESSAGES.unknown
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email.trim())
}

/**
 * Send OTP code to email address using Supabase Auth
 * 
 * @param email - The email address to send OTP to
 * @returns Result object with success status and optional error message
 */
export async function sendEmailOtp(
  email: string
): Promise<{ success: boolean; error?: string }> {
  if (!isValidEmail(email)) {
    return { success: false, error: ERROR_MESSAGES.invalid_email }
  }

  try {
    const supabase = createClient()
    
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        // Allow new users to be created via email OTP
        shouldCreateUser: true,
      },
    })

    if (error) {
      console.error('Supabase email OTP send error:', error)
      return {
        success: false,
        error: getErrorMessage(error.code || error.message, error.message),
      }
    }

    return { success: true }
  } catch (err) {
    console.error('Email OTP send error:', err)
    return {
      success: false,
      error: ERROR_MESSAGES.unknown,
    }
  }
}

/**
 * Verify OTP code sent to email
 * 
 * @param email - The email address that received the OTP
 * @param token - The 6-digit OTP code
 * @returns Result object with success status, Supabase user ID, and optional error
 */
export async function verifyEmailOtp(
  email: string,
  token: string
): Promise<{ success: boolean; supabaseUserId?: string; error?: string }> {
  if (!isValidEmail(email)) {
    return { success: false, error: ERROR_MESSAGES.invalid_email }
  }

  if (!token || token.length !== 6) {
    return { success: false, error: 'נא להזין קוד בן 6 ספרות' }
  }

  try {
    const supabase = createClient()
    
    const { data, error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: token,
      type: 'email',
    })

    if (error) {
      console.error('Supabase email OTP verify error:', error)
      return {
        success: false,
        error: getErrorMessage(error.code || error.message, 'קוד אימות שגוי'),
      }
    }

    if (!data.user) {
      return {
        success: false,
        error: ERROR_MESSAGES.user_not_found,
      }
    }

    return {
      success: true,
      supabaseUserId: data.user.id,
    }
  } catch (err) {
    console.error('Email OTP verify error:', err)
    return {
      success: false,
      error: 'שגיאה באימות הקוד',
    }
  }
}

/**
 * Sign out from Supabase Auth (for email-authenticated users)
 */
export async function signOutSupabase(): Promise<void> {
  try {
    const supabase = createClient()
    await supabase.auth.signOut()
  } catch (err) {
    console.error('Supabase sign out error:', err)
  }
}

/**
 * Check if Supabase has an active session
 */
export async function getSupabaseSession() {
  try {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    return session
  } catch (err) {
    console.error('Error getting Supabase session:', err)
    return null
  }
}
