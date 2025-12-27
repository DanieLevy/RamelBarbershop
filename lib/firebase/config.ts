import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import { 
  getAuth, 
  RecaptchaVerifier, 
  signInWithPhoneNumber, 
  type ConfirmationResult,
  type Auth
} from 'firebase/auth'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
}

let app: FirebaseApp
let auth: Auth

function getFirebaseApp(): FirebaseApp {
  if (!app) {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]
  }
  return app
}

export function getFirebaseAuth(): Auth {
  if (!auth) {
    auth = getAuth(getFirebaseApp())
    auth.languageCode = 'he'
  }
  return auth
}

export function clearRecaptchaVerifier(): void {
  if (typeof window !== 'undefined' && window.recaptchaVerifier) {
    try {
      window.recaptchaVerifier.clear()
    } catch (e) {
      console.error('Error clearing reCAPTCHA verifier:', e)
    }
    window.recaptchaVerifier = undefined
  }
  
  if (typeof window !== 'undefined') {
    window.recaptchaWidgetId = undefined
  }
}

export function initRecaptchaVerifier(containerId: string): RecaptchaVerifier | null {
  if (typeof window === 'undefined') {
    return null
  }
  
  const container = document.getElementById(containerId)
  if (!container) {
    console.error(`reCAPTCHA container "${containerId}" not found`)
    return null
  }
  
  const authInstance = getFirebaseAuth()
  clearRecaptchaVerifier()
  
  try {
    const verifier = new RecaptchaVerifier(authInstance, containerId, {
      size: 'invisible',
      callback: () => {},
      'expired-callback': () => clearRecaptchaVerifier(),
    })
    
    window.recaptchaVerifier = verifier
    return verifier
  } catch (error) {
    console.error('Failed to create reCAPTCHA verifier:', error)
    return null
  }
}

export async function sendPhoneOtp(
  phoneNumber: string,
  containerId: string = 'recaptcha-container'
): Promise<{ success: boolean; confirmation?: ConfirmationResult; error?: string }> {
  try {
    const authInstance = getFirebaseAuth()
    
    let verifier = window.recaptchaVerifier
    if (!verifier) {
      const newVerifier = initRecaptchaVerifier(containerId)
      if (!newVerifier) {
        return { 
          success: false, 
          error: 'שגיאה באתחול reCAPTCHA - רענן את הדף ונסה שוב' 
        }
      }
      verifier = newVerifier
    }
    
    const confirmation = await signInWithPhoneNumber(authInstance, phoneNumber, verifier)
    return { success: true, confirmation }
    
  } catch (error) {
    console.error('OTP send error:', error)
    clearRecaptchaVerifier()
    
    const errorCode = (error as { code?: string })?.code || ''
    const errorMessage = (error as Error)?.message || 'Unknown error'
    
    let userFriendlyMessage = 'שגיאה בשליחת קוד האימות'
    
    if (errorCode.includes('auth/invalid-app-credential')) {
      userFriendlyMessage = 'שגיאת הגדרות Firebase - יש להפעיל אימות טלפון ולהוסיף את הדומיין לרשימה המאושרת'
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

export async function verifyOtp(
  confirmation: ConfirmationResult,
  code: string
): Promise<{ success: boolean; firebaseUid?: string; error?: string }> {
  try {
    const result = await confirmation.confirm(code)
    clearRecaptchaVerifier()
    return { success: true, firebaseUid: result.user.uid }
  } catch (error) {
    console.error('OTP verify error:', error)
    
    const errorCode = (error as { code?: string })?.code || ''
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
