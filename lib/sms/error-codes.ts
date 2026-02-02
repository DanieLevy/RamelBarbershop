/**
 * 019 SMS Provider Error Codes
 * 
 * Maps 019 SMS API status codes to user-friendly Hebrew error messages.
 * Based on: https://docs.019sms.co.il/sms/errors-and-status.html
 * 
 * @see https://docs.019sms.co.il - 019 SMS API Documentation
 */

/**
 * 019 SMS API Error Codes mapped to Hebrew messages
 * 
 * Status 0 = Success (no error)
 * Other statuses indicate various error conditions
 */
export const O19_ERROR_CODES: Record<number, string> = {
  // Success
  0: '', // No error
  
  // Request/Parse Errors
  1: 'בעיה בפענוח הבקשה. אנא נסה שוב.',
  2: 'חסר שדה נדרש בבקשה.',
  
  // Authentication Errors
  3: 'שגיאת אימות. אנא נסה שוב מאוחר יותר.',
  10: 'שגיאת אימות. אנא נסה שוב מאוחר יותר.',
  11: 'שגיאת אימות. אנא נסה שוב מאוחר יותר.',
  
  // Balance/Credit Errors
  4: 'שירות ה-SMS לא זמין כרגע. אנא נסה שוב מאוחר יותר.',
  
  // Time/Permission Errors
  5: 'אין אפשרות לשלוח SMS בזמן זה.',
  
  // Process Errors
  6: 'כשל בתהליך. אנא נסה שוב.',
  7: 'פורמט שליחה לא תקין.',
  8: 'כל המספרים חסומים.',
  9: 'מספר טלפון לא תקין - קצר או ארוך מדי.',
  
  // OTP Specific Errors
  12: 'קוד אימות שגוי. אנא בדוק והזן שוב.',
  
  // General/API Errors
  502: 'שגיאת שרת. אנא נסה שוב.',
  503: 'שם משתמש לא קיים.',
  504: 'טוקן לא תקין.',
  510: 'אין מספרי טלפון לאימות.',
  511: 'אין הרשאה לפעולה זו.',
  515: 'מקור לא מאומת.',
  
  // Phone/Number Errors
  714: 'ערך לא תקין.',
  715: 'כל המספרים חסומים זמנית.',
  
  // Campaign Errors (not relevant for OTP but included for completeness)
  933: 'טלפון או סיבה לא תקינים.',
  944: 'חלק מהמספרים לא ברשימה השחורה.',
  955: 'הקמפיין כבר בוטל.',
  966: 'הקמפיין כבר נשלח.',
  970: 'הקמפיין לא בוטל. צור קשר עם התמיכה.',
  977: 'קמפיין לא קיים.',
  
  // Link Errors
  980: 'קישור לא תקין.',
  981: 'שגיאה ביצירת קישור.',
  
  // Configuration Errors
  986: 'שגיאה בערך הסרה.',
  988: 'רשימת אנשי קשר לא קיימת.',
  989: 'ההודעה ארוכה או קצרה מדי.',
  990: 'סכום חייב להיות קטן מהיתרה.',
  991: 'הסכום חייב להכיל ספרות בלבד.',
  992: 'מקור ארוך או קצר מדי.',
  993: 'סיסמה ארוכה או קצרה מדי.',
  994: 'שם משתמש כבר קיים.',
  995: 'שם משתמש ארוך או קצר מדי.',
  996: 'השם ארוך או קצר מדי.',
  997: 'פקודה לא תקינה.',
  998: 'שגיאה לא ידועה בבקשה.',
  999: 'צור קשר עם התמיכה.',
}

/**
 * DLR (Delivery Report) Status Codes
 * For tracking message delivery status
 */
export const O19_DLR_STATUSES: Record<number, string> = {
  '-1': 'נשלח - ללא אישור מסירה',
  0: 'הגיע ליעד',
  1: 'נכשל',
  2: 'פג זמן',
  3: 'נכשל',
  4: 'נכשל - סלולר',
  5: 'נכשל',
  6: 'נכשל',
  7: 'אין יתרה',
  14: 'נכשל - עבר תהליך store&forward',
  15: 'מספר כשר',
  16: 'אין הרשאת שעת שליחה',
  17: 'חסום להודעות פרסומיות',
  18: 'הודעה לא חוקית',
  101: 'לא הגיע ליעד',
  102: 'הגיע ליעד',
  103: 'פג תוקף',
  104: 'נמחק',
  105: 'לא הגיע ליעד',
  106: 'לא הגיע ליעד',
  107: 'לא הגיע ליעד',
  108: 'נדחה',
  201: 'נחסם לפי בקשה',
  747: 'מנוי מחוץ לכיסוי רשת',
  998: 'אין הרשאה',
  999: 'שגיאה לא ידועה',
}

/**
 * Get user-friendly error message for 019 status code
 * 
 * @param statusCode - The status code from 019 API
 * @returns Hebrew error message
 */
export function getO19ErrorMessage(statusCode: number): string {
  return O19_ERROR_CODES[statusCode] || 'שגיאה לא צפויה. אנא נסה שוב.'
}

/**
 * Get DLR status message
 * 
 * @param statusCode - The DLR status code
 * @returns Hebrew status message
 */
export function getO19DlrStatus(statusCode: number): string {
  return O19_DLR_STATUSES[statusCode] || 'סטטוס לא ידוע'
}

/**
 * Check if the status code indicates success
 * 
 * @param statusCode - The status code from 019 API
 * @returns true if success (status = 0)
 */
export function isO19Success(statusCode: number): boolean {
  return statusCode === 0
}

/**
 * Check if the error is recoverable (user can retry)
 * 
 * @param statusCode - The status code from 019 API
 * @returns true if the user should retry
 */
export function isRecoverableError(statusCode: number): boolean {
  // These errors are temporary and may succeed on retry
  const recoverableErrors = [1, 2, 6, 502, 998, 999]
  return recoverableErrors.includes(statusCode)
}

/**
 * Check if this is an authentication/configuration error
 * These require developer attention, not user action
 * 
 * @param statusCode - The status code from 019 API
 * @returns true if configuration issue
 */
export function isConfigurationError(statusCode: number): boolean {
  const configErrors = [3, 10, 11, 503, 504, 511, 515]
  return configErrors.includes(statusCode)
}
