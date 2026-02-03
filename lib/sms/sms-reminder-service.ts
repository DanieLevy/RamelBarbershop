/**
 * SMS Reminder Service
 * 
 * Sends SMS reminders for appointments using the 019 SMS API.
 * Used alongside push notifications for comprehensive reminder coverage.
 * 
 * Character Limit: 70 characters (Hebrew uses UCS-2 encoding)
 * Message Format: "היי {firstName}, תזכורת לתור היום ב{time}. מספרת רם אל"
 * 
 * @see https://docs.019sms.co.il - 019 SMS API Documentation
 */

import { getO19ErrorMessage } from './error-codes'

// Constants
const MAX_FIRST_NAME_LENGTH = 10 // Truncate names longer than this
const SMS_CHAR_LIMIT = 70 // Hebrew SMS limit (UCS-2 encoding)

// Response types
interface O19SendSmsResponse {
  sms?: {
    status: number | string
    message?: string
    shipment_id?: string
  }
  status?: number | string
  message?: string
  shipment_id?: string
}

export interface SmsReminderResult {
  success: boolean
  shipmentId?: string
  error?: string
  messageLength?: number
}

/**
 * Format phone number for 019 API (Israeli format: 05xxxxxxx)
 * Converts +972 or other formats to local Israeli format
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
 * Validate phone number is a valid Israeli mobile number
 */
export function isValidIsraeliMobile(phone: string): boolean {
  const formatted = formatPhoneFor019(phone)
  // Israeli mobile numbers: 05X-XXXXXXX (10 digits starting with 05)
  return /^05[0-9]{8}$/.test(formatted)
}

/**
 * Extract first name from full name
 * Truncates to MAX_FIRST_NAME_LENGTH if too long
 */
export function extractFirstName(fullName: string): string {
  const firstName = fullName.trim().split(/\s+/)[0] || fullName.trim()
  
  if (firstName.length > MAX_FIRST_NAME_LENGTH) {
    return firstName.slice(0, MAX_FIRST_NAME_LENGTH)
  }
  
  return firstName
}

/**
 * Format time from timestamp to HH:MM in Israel timezone
 */
export function formatTimeForSms(timestamp: number): string {
  const date = new Date(timestamp)
  return new Intl.DateTimeFormat('he-IL', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jerusalem',
    hour12: false
  }).format(date)
}

/**
 * Build the SMS reminder message
 * Target: Under 70 characters for single SMS billing
 * 
 * Format: "היי {firstName}, תזכורת לתור היום ב{time}. מספרת רם אל"
 */
export function buildReminderMessage(firstName: string, time: string): string {
  const truncatedName = extractFirstName(firstName)
  return `היי ${truncatedName}, תזכורת לתור שלך היום בשעה: ${time}. מספרת רם אל`
}

/**
 * Check if message is within the single SMS character limit
 */
export function isWithinCharLimit(message: string): boolean {
  return message.length <= SMS_CHAR_LIMIT
}

/**
 * Send SMS reminder to a customer
 * 
 * @param phone - Customer phone number (any format)
 * @param firstName - Customer's first name
 * @param appointmentTimestamp - Appointment time as Unix timestamp (ms)
 * @returns Result with success status and optional error
 */
export async function sendSmsReminder(
  phone: string,
  firstName: string,
  appointmentTimestamp: number
): Promise<SmsReminderResult> {
  try {
    // Validate environment variables
    const apiToken = process.env.O19_SMS_API_TOKEN
    const username = process.env.O19_SMS_USERNAME
    const source = process.env.O19_SMS_SOURCE || 'RamelBarber'
    
    if (!apiToken || !username) {
      return {
        success: false,
        error: 'SMS service not configured'
      }
    }

    // Format phone number
    const formattedPhone = formatPhoneFor019(phone)
    
    // Validate phone
    if (!isValidIsraeliMobile(phone)) {
      return {
        success: false,
        error: `Invalid phone number: ${formattedPhone}`
      }
    }

    // Build message
    const time = formatTimeForSms(appointmentTimestamp)
    const message = buildReminderMessage(firstName, time)
    
    // Log character count for monitoring
    const messageLength = message.length
    if (!isWithinCharLimit(message)) {
      console.warn(`[SMS Reminder] Message exceeds ${SMS_CHAR_LIMIT} chars (${messageLength}): will be billed as 2 SMS`)
    }

    // Build 019 API request body (JSON format)
    const requestBody = {
      sms: {
        user: {
          username: username
        },
        source: source,
        destinations: {
          phone: formattedPhone
        },
        message: message
      }
    }

    // Call 019 SMS API
    const response = await fetch('https://019sms.co.il/api', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiToken}`
      },
      body: JSON.stringify(requestBody)
    })

    // Parse response
    const responseText = await response.text()
    let responseData: O19SendSmsResponse
    
    try {
      responseData = JSON.parse(responseText)
    } catch {
      console.error('[SMS Reminder] Failed to parse 019 response:', responseText)
      return {
        success: false,
        error: 'Failed to parse SMS provider response',
        messageLength
      }
    }

    // Handle response
    const status = responseData.sms?.status ?? responseData.status
    const statusNum = typeof status === 'string' ? parseInt(status, 10) : status
    const shipmentId = responseData.sms?.shipment_id ?? responseData.shipment_id

    // Status 0 = success
    if (statusNum === 0) {
      return {
        success: true,
        shipmentId,
        messageLength
      }
    }

    // Handle error
    const errorMessage = getO19ErrorMessage(statusNum ?? -1)
    console.error(`[SMS Reminder] Error sending to ${formattedPhone}:`, statusNum, errorMessage)
    
    return {
      success: false,
      error: errorMessage,
      messageLength
    }
    
  } catch (error) {
    console.error('[SMS Reminder] Exception:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Send bulk SMS reminders (up to 2500 at once)
 * Uses the 019 bulk SMS API for efficiency
 * 
 * @param reminders - Array of reminder details
 * @returns Results for each reminder
 */
export async function sendBulkSmsReminders(
  reminders: Array<{
    phone: string
    firstName: string
    appointmentTimestamp: number
    reservationId: string
  }>
): Promise<Map<string, SmsReminderResult>> {
  const results = new Map<string, SmsReminderResult>()
  
  // For now, send individually (can be optimized to bulk API later)
  // The bulk API has different format and we need proper error handling per message
  const promises = reminders.map(async (reminder) => {
    const result = await sendSmsReminder(
      reminder.phone,
      reminder.firstName,
      reminder.appointmentTimestamp
    )
    results.set(reminder.reservationId, result)
  })

  await Promise.allSettled(promises)
  
  return results
}
