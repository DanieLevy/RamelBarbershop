import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import { 
  getAuth, 
  RecaptchaVerifier, 
  signInWithPhoneNumber, 
  type ConfirmationResult,
  type Auth
} from 'firebase/auth'

// Debug logger with timestamp
const debug = (context: string, message: string, data?: unknown) => {
  const timestamp = new Date().toISOString().split('T')[1].slice(0, 12)
  console.log(`[${timestamp}] [Firebase/${context}]`, message, data !== undefined ? data : '')
}

const debugError = (context: string, message: string, error?: unknown) => {
  const timestamp = new Date().toISOString().split('T')[1].slice(0, 12)
  console.error(`[${timestamp}] [Firebase/${context}] ERROR:`, message, error)
}

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
}

// Initialize Firebase only once
let app: FirebaseApp
let auth: Auth

function getFirebaseApp(): FirebaseApp {
  debug('Init', 'getFirebaseApp called')
  
  if (!app) {
    debug('Init', 'Creating new Firebase app instance')
    debug('Init', 'Config check:', {
      hasApiKey: !!firebaseConfig.apiKey,
      authDomain: firebaseConfig.authDomain,
      projectId: firebaseConfig.projectId,
    })
    
    if (getApps().length === 0) {
      debug('Init', 'No existing apps, initializing new app')
      app = initializeApp(firebaseConfig)
    } else {
      debug('Init', 'Using existing Firebase app')
      app = getApps()[0]
    }
    
    debug('Init', 'Firebase app ready:', app.name)
  } else {
    debug('Init', 'Returning cached Firebase app')
  }
  
  return app
}

export function getFirebaseAuth(): Auth {
  debug('Auth', 'getFirebaseAuth called')
  
  if (!auth) {
    debug('Auth', 'Creating new Auth instance')
    auth = getAuth(getFirebaseApp())
    auth.languageCode = 'he'
    debug('Auth', 'Auth instance created, language set to Hebrew')
  } else {
    debug('Auth', 'Returning cached Auth instance')
  }
  
  return auth
}

// Clear and reset the reCAPTCHA verifier
export function clearRecaptchaVerifier(): void {
  debug('reCAPTCHA', 'clearRecaptchaVerifier called')
  
  if (typeof window !== 'undefined' && window.recaptchaVerifier) {
    debug('reCAPTCHA', 'Clearing existing verifier')
    try {
      window.recaptchaVerifier.clear()
      debug('reCAPTCHA', 'Verifier cleared successfully')
    } catch (e) {
      debugError('reCAPTCHA', 'Error clearing verifier:', e)
    }
    window.recaptchaVerifier = undefined
  } else {
    debug('reCAPTCHA', 'No verifier to clear')
  }
  
  if (typeof window !== 'undefined') {
    window.recaptchaWidgetId = undefined
  }
}

// Initialize reCAPTCHA verifier
export function initRecaptchaVerifier(containerId: string): RecaptchaVerifier | null {
  debug('reCAPTCHA', `initRecaptchaVerifier called with containerId: "${containerId}"`)
  
  // Check if we're in browser
  if (typeof window === 'undefined') {
    debugError('reCAPTCHA', 'Not in browser environment')
    return null
  }
  
  // Check if container exists
  const container = document.getElementById(containerId)
  debug('reCAPTCHA', `Container element found: ${!!container}`)
  if (!container) {
    debugError('reCAPTCHA', `Container with id "${containerId}" not found in DOM`)
    return null
  }
  
  const authInstance = getFirebaseAuth()
  debug('reCAPTCHA', 'Got Auth instance, creating RecaptchaVerifier')
  
  // Clear any existing verifier first
  clearRecaptchaVerifier()
  
  try {
    debug('reCAPTCHA', 'Creating new RecaptchaVerifier with invisible size')
    
    const verifier = new RecaptchaVerifier(authInstance, containerId, {
      size: 'invisible',
      callback: (response: string) => {
        debug('reCAPTCHA', 'reCAPTCHA callback triggered, response:', response?.substring(0, 20) + '...')
      },
      'expired-callback': () => {
        debug('reCAPTCHA', 'reCAPTCHA expired callback triggered')
        clearRecaptchaVerifier()
      },
    })
    
    window.recaptchaVerifier = verifier
    debug('reCAPTCHA', 'RecaptchaVerifier created and stored in window')
    
    return verifier
    
  } catch (error) {
    debugError('reCAPTCHA', 'Failed to create RecaptchaVerifier:', error)
    return null
  }
}

// Send OTP to phone number
export async function sendPhoneOtp(
  phoneNumber: string,
  containerId: string = 'recaptcha-container'
): Promise<{ success: boolean; confirmation?: ConfirmationResult; error?: string }> {
  debug('OTP', '========== SEND OTP STARTED ==========')
  debug('OTP', `Phone: ${phoneNumber}, Container: ${containerId}`)
  
  try {
    // Step 1: Get auth instance
    debug('OTP', 'Step 1: Getting auth instance')
    const authInstance = getFirebaseAuth()
    debug('OTP', 'Auth instance obtained')
    
    // Step 2: Initialize or get reCAPTCHA verifier
    debug('OTP', 'Step 2: Setting up reCAPTCHA verifier')
    let verifier = window.recaptchaVerifier
    
    if (!verifier) {
      debug('OTP', 'No existing verifier, creating new one')
      const newVerifier = initRecaptchaVerifier(containerId)
      
      if (!newVerifier) {
        debugError('OTP', 'Failed to create reCAPTCHA verifier')
        return { 
          success: false, 
          error: 'שגיאה באתחול reCAPTCHA - רענן את הדף ונסה שוב' 
        }
      }
      verifier = newVerifier
    } else {
      debug('OTP', 'Using existing verifier')
    }
    
    // Step 3: Send verification code
    debug('OTP', 'Step 3: Calling signInWithPhoneNumber')
    debug('OTP', `Sending to: ${phoneNumber}`)
    
    const confirmation = await signInWithPhoneNumber(authInstance, phoneNumber, verifier)
    
    debug('OTP', 'signInWithPhoneNumber SUCCESS')
    debug('OTP', 'Confirmation result received:', !!confirmation)
    debug('OTP', '========== SEND OTP COMPLETED ==========')
    
    return { success: true, confirmation }
    
  } catch (error) {
    debugError('OTP', '========== SEND OTP FAILED ==========')
    debugError('OTP', 'Error object:', error)
    
    // Reset reCAPTCHA on error so user can try again
    clearRecaptchaVerifier()
    
    // Parse Firebase error codes
    const errorCode = (error as { code?: string })?.code || ''
    const errorMessage = (error as Error)?.message || 'Unknown error'
    
    debug('OTP', `Error code: ${errorCode}`)
    debug('OTP', `Error message: ${errorMessage}`)
    
    let userFriendlyMessage = 'שגיאה בשליחת קוד האימות'
    
    if (errorCode.includes('auth/invalid-app-credential')) {
      userFriendlyMessage = 'שגיאת הגדרות Firebase - יש להפעיל אימות טלפון ולהוסיף את הדומיין לרשימה המאושרת'
      debugError('OTP', '=== FIREBASE CONSOLE SETUP REQUIRED ===')
      debugError('OTP', '1. Go to Firebase Console > Authentication > Sign-in method')
      debugError('OTP', '2. Enable "Phone" provider')
      debugError('OTP', '3. Go to Settings > Authorized domains')
      debugError('OTP', '4. Add "localhost" to the list')
      debugError('OTP', '=======================================')
    } else if (errorCode.includes('auth/invalid-phone-number')) {
      userFriendlyMessage = 'מספר טלפון לא תקין'
    } else if (errorCode.includes('auth/too-many-requests')) {
      userFriendlyMessage = 'יותר מדי ניסיונות, נסה שוב מאוחר יותר'
    } else if (errorCode.includes('auth/quota-exceeded')) {
      userFriendlyMessage = 'חריגה ממכסת SMS, נסה שוב מאוחר יותר'
    } else if (errorCode.includes('auth/network-request-failed')) {
      userFriendlyMessage = 'שגיאת רשת, בדוק את החיבור לאינטרנט'
    } else if (errorCode.includes('auth/captcha-check-failed')) {
      userFriendlyMessage = 'אימות reCAPTCHA נכשל, נסה שוב'
    } else if (errorCode.includes('auth/missing-phone-number')) {
      userFriendlyMessage = 'מספר טלפון חסר'
    } else if (errorCode.includes('auth/operation-not-allowed')) {
      userFriendlyMessage = 'אימות טלפון לא מופעל - יש להפעיל בקונסול Firebase'
    } else if (errorMessage.includes('reCAPTCHA')) {
      userFriendlyMessage = 'שגיאה בטעינת reCAPTCHA, רענן את הדף'
    }
    
    return { 
      success: false, 
      error: `${userFriendlyMessage} (${errorCode || 'UNKNOWN'})` 
    }
  }
}

// Verify OTP code
export async function verifyOtp(
  confirmation: ConfirmationResult,
  code: string
): Promise<{ success: boolean; error?: string }> {
  debug('Verify', '========== VERIFY OTP STARTED ==========')
  debug('Verify', `Code length: ${code.length}`)
  
  try {
    debug('Verify', 'Calling confirmation.confirm()')
    const result = await confirmation.confirm(code)
    
    debug('Verify', 'Verification SUCCESS')
    debug('Verify', 'User UID:', result.user.uid)
    debug('Verify', '========== VERIFY OTP COMPLETED ==========')
    
    // Clear reCAPTCHA after successful verification
    clearRecaptchaVerifier()
    
    return { success: true }
    
  } catch (error) {
    debugError('Verify', '========== VERIFY OTP FAILED ==========')
    debugError('Verify', 'Error:', error)
    
    const errorCode = (error as { code?: string })?.code || ''
    debug('Verify', `Error code: ${errorCode}`)
    
    let userFriendlyMessage = 'קוד שגוי'
    
    if (errorCode.includes('auth/invalid-verification-code')) {
      userFriendlyMessage = 'קוד אימות שגוי'
    } else if (errorCode.includes('auth/code-expired')) {
      userFriendlyMessage = 'הקוד פג תוקף, בקש קוד חדש'
    } else if (errorCode.includes('auth/session-expired')) {
      userFriendlyMessage = 'הסשן פג תוקף, בקש קוד חדש'
    }
    
    return { 
      success: false, 
      error: `${userFriendlyMessage} (${errorCode || 'UNKNOWN'})` 
    }
  }
}

// Declare global types for reCAPTCHA
declare global {
  interface Window {
    recaptchaVerifier: RecaptchaVerifier | undefined
    recaptchaWidgetId: number | undefined
    grecaptcha: {
      reset: (widgetId?: number) => void
      getResponse: (widgetId?: number) => string
    }
  }
}
