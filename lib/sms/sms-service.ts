/**
 * SMS OTP Service - 019 SMS Provider Integration
 * 
 * This module provides SMS OTP authentication via the 019 Israeli SMS provider.
 * It communicates with our internal API routes which handle the actual 019 API calls
 * to keep the API token secure on the server side.
 * 
 * Features:
 * - Send OTP codes via SMS
 * - Verify OTP codes
 * - Test user bypass for development
 * - Proper phone number formatting for Israeli numbers
 * 
 * DATABASE NOTES:
 * - The `customers` table has a `provider_uid` column for SMS provider UIDs
 * - Format: "{provider}-{phone}" (e.g., "o19-0501234567" for 019 SMS)
 * - The `auth_method` column tracks: 'phone', 'email', or 'both'
 * 
 * @author Ram El Barbershop
 * @since 2026-02-02
 * @see https://docs.019sms.co.il - 019 SMS API Documentation
 */

// =============================================================================
// Types
// =============================================================================

/**
 * Represents an active OTP verification session
 * This is returned by sendSmsOtp and passed to verifySmsOtp
 */
export interface OtpSession {
  /** Unique session/verification ID */
  sessionId: string
  /** Phone number in Israeli format (e.g., 0502879998) */
  phoneNumber: string
  /** When this session was created (Unix timestamp) */
  createdAt: number
  /** When this session expires (Unix timestamp) */
  expiresAt: number
  /** Provider-specific metadata */
  metadata?: Record<string, unknown>
}

/**
 * Result of sending an OTP
 */
export interface SendOtpResult {
  success: boolean
  session?: OtpSession
  error?: string
  /** For development/testing: indicates if test mode was used */
  isTestMode?: boolean
}

/**
 * Result of verifying an OTP
 */
export interface VerifyOtpResult {
  success: boolean
  /** Provider's unique user ID (to be stored in DB) */
  providerUid?: string
  error?: string
}

// =============================================================================
// Test User Configuration (Development Only)
// =============================================================================

/**
 * Test user for development - bypasses real SMS
 * In production, this is disabled
 */
export const TEST_USER = {
  phone: '+972502879998',
  phoneRaw: '0502879998',
  otpCode: '123456',
  name: 'דניאל לוי',
}

/**
 * Check if a phone number matches the test user
 */
export function isTestUser(phone: string): boolean {
  if (process.env.NODE_ENV !== 'development') {
    return false
  }
  
  const normalized = phone.replace(/\D/g, '')
  return (
    normalized === TEST_USER.phoneRaw ||
    normalized === TEST_USER.phoneRaw.replace(/^0/, '972') ||
    phone === TEST_USER.phone
  )
}

// Debug mode flag for test users
let skipDebugMode = false

export function setSkipDebugMode(skip: boolean): void {
  skipDebugMode = skip
}

export function shouldUseDebugMode(): boolean {
  return !skipDebugMode
}

// =============================================================================
// Mock Implementation for Test Users (Development Only)
// =============================================================================

/**
 * Mock OTP session for test user
 */
function createTestSession(phoneNumber: string): OtpSession {
  return {
    sessionId: `test-session-${Date.now()}`,
    phoneNumber: formatPhoneFor019(phoneNumber),
    createdAt: Date.now(),
    expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
    metadata: { isTest: true },
  }
}

/**
 * Mock verification for test user
 */
function verifyTestOtp(code: string): VerifyOtpResult {
  if (code === TEST_USER.otpCode || code === TEST_USER.otpCode.slice(0, 4)) {
    return {
      success: true,
      providerUid: `test-uid-${Date.now()}`,
    }
  }
  
  return {
    success: false,
    error: 'קוד אימות שגוי',
  }
}

// =============================================================================
// Main SMS OTP Functions
// =============================================================================

/**
 * Send OTP code via SMS to the specified phone number
 * 
 * Uses our internal API route (/api/sms/send-otp) which handles the
 * actual 019 SMS provider API call, keeping the API token secure.
 * 
 * @param phoneNumber - Phone number in any format (will be normalized)
 * @param _containerId - Unused, kept for API compatibility
 * @param forceRealOtp - If true, skip test user bypass (for testing real SMS in dev)
 * @returns SendOtpResult with session info on success
 */
export async function sendSmsOtp(
  phoneNumber: string,
  _containerId?: string,
  forceRealOtp: boolean = false
): Promise<SendOtpResult> {
  // Development: Test user bypass
  if (isTestUser(phoneNumber) && shouldUseDebugMode() && !forceRealOtp) {
    console.log('📱 Test user detected - bypassing real OTP')
    return {
      success: true,
      session: createTestSession(phoneNumber),
      isTestMode: true,
    }
  }
  
  try {
    console.log('[SMS Service] Sending OTP via API route')
    
    // Call our internal API route (which handles the 019 API call)
    const response = await fetch('/api/sms/send-otp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phone: formatPhoneFor019(phoneNumber),
      }),
    })
    
    const data = await response.json()
    
    if (!response.ok || !data.success) {
      console.error('[SMS Service] Send OTP failed:', data.error)
      return {
        success: false,
        error: data.error || 'שגיאה בשליחת קוד אימות',
      }
    }
    
    console.log('[SMS Service] OTP sent successfully')
    
    return {
      success: true,
      session: data.session as OtpSession,
    }
  } catch (error) {
    console.error('[SMS Service] Error sending OTP:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'שגיאה לא צפויה בשליחת קוד אימות',
    }
  }
}

/**
 * Verify OTP code entered by user
 * 
 * Uses our internal API route (/api/sms/verify-otp) which handles the
 * actual 019 SMS provider API call, keeping the API token secure.
 * 
 * @param session - The OTP session returned from sendSmsOtp
 * @param code - The 6-digit code entered by user
 * @returns VerifyOtpResult with provider UID on success
 */
export async function verifySmsOtp(
  session: OtpSession,
  code: string
): Promise<VerifyOtpResult> {
  // Development: Test user verification
  if (session.metadata?.isTest) {
    console.log('📱 Test user - verifying with test code')
    return verifyTestOtp(code)
  }
  
  try {
    console.log('[SMS Service] Verifying OTP via API route')
    
    // Call our internal API route (which handles the 019 API call)
    const response = await fetch('/api/sms/verify-otp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phone: session.phoneNumber,
        code: code,
      }),
    })
    
    const data = await response.json()
    
    if (!response.ok || !data.success) {
      console.error('[SMS Service] Verify OTP failed:', data.error)
      return {
        success: false,
        error: data.error || 'קוד אימות שגוי',
      }
    }
    
    console.log('[SMS Service] OTP verified successfully')
    
    return {
      success: true,
      providerUid: data.providerUid,
    }
  } catch (error) {
    console.error('[SMS Service] Error verifying OTP:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'שגיאה לא צפויה באימות הקוד',
    }
  }
}

/**
 * Cleanup function - call when component unmounts or user navigates away
 * 
 * The 019 SMS provider doesn't require client-side cleanup,
 * but we keep this function for API compatibility with components.
 */
export function cleanupSmsSession(): void {
  // 019 SMS provider doesn't require client-side cleanup
  // Session management is handled by the provider
  console.log('[SMS Service] Cleanup called (no action needed for 019)')
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Format phone number for 019 API (Israeli format: 05xxxxxxx)
 * 
 * 019 requires local Israeli format, not international format.
 * 
 * @param phone - Phone number in any format
 * @returns Phone number in 05xxxxxxx format
 */
export function formatPhoneFor019(phone: string): string {
  const cleaned = phone.replace(/\D/g, '')
  
  // Convert from international format +972 to local 0
  if (cleaned.startsWith('972')) {
    return '0' + cleaned.slice(3)
  }
  
  // Already in local format with leading 0
  if (cleaned.startsWith('0')) {
    return cleaned
  }
  
  // No leading 0, add it
  return '0' + cleaned
}

/**
 * Format phone number to international format (+972...)
 * 
 * Used for display and database storage.
 * 
 * @param phone - Phone number in any format
 * @returns Phone number in +972xxxxxxxxx format
 */
export function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, '')
  
  if (cleaned.startsWith('0')) {
    return `+972${cleaned.slice(1)}`
  }
  
  if (cleaned.startsWith('972')) {
    return `+${cleaned}`
  }
  
  return `+972${cleaned}`
}

/**
 * Validate Israeli phone number format
 * 
 * @param phone - Phone number to validate
 * @returns true if valid Israeli mobile number
 */
export function isValidIsraeliPhone(phone: string): boolean {
  const cleaned = phone.replace(/\D/g, '')
  
  // Israeli mobile: 05XXXXXXXX (10 digits) or 9725XXXXXXXX (12 digits)
  if (cleaned.length === 10 && cleaned.startsWith('05')) {
    return true
  }
  
  if (cleaned.length === 12 && cleaned.startsWith('9725')) {
    return true
  }
  
  return false
}

// =============================================================================
// Legacy Compatibility Note
// =============================================================================

// These were previously used for Firebase compatibility.
// All code has been updated to use the new API.
//
// If you see any code still importing these deprecated names:
// - sendPhoneOtp → use sendSmsOtp
// - verifyOtp → use verifySmsOtp  
// - clearRecaptchaVerifier → use cleanupSmsSession
