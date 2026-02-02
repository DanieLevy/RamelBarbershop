/**
 * Push Notification Templates
 * Centralized Hebrew message templates for all notification types
 * 
 * IMPORTANT: All date/time formatting uses Israel timezone
 */

import { format } from 'date-fns'
import { he } from 'date-fns/locale'
import { timestampToIsraelDate } from '@/lib/utils'
import type { 
  NotificationPayload, 
  NotificationType,
  NotificationDataPayload,
  ReminderContext,
  CancellationContext,
  BroadcastContext 
} from './types'

// Format time from timestamp - ALWAYS ISRAEL TIMEZONE
function formatTime(timestamp: number): string {
  const israelDate = timestampToIsraelDate(timestamp)
  return format(israelDate, 'HH:mm', { locale: he })
}

// Format date from timestamp - ALWAYS ISRAEL TIMEZONE
function formatDate(timestamp: number): string {
  const israelDate = timestampToIsraelDate(timestamp)
  return format(israelDate, 'EEEE, d בMMMM', { locale: he })
}

// Format short date - ALWAYS ISRAEL TIMEZONE
function formatShortDate(timestamp: number): string {
  const israelDate = timestampToIsraelDate(timestamp)
  return format(israelDate, 'd/M', { locale: he })
}

// Format date for URL param (YYYY-MM-DD) - ALWAYS ISRAEL TIMEZONE
function formatUrlDate(timestamp: number): string {
  const israelDate = timestampToIsraelDate(timestamp)
  return format(israelDate, 'yyyy-MM-dd')
}

/**
 * Format time duration in proper Hebrew grammar
 * Handles special cases for 1, 2, and 3+ units
 */
function formatHebrewDuration(minutes: number): string {
  if (minutes < 60) {
    // Minutes
    if (minutes === 1) return 'דקה אחת'
    if (minutes === 2) return 'שתי דקות'
    if (minutes <= 10) return `${minutes} דקות`
    if (minutes <= 20) return `${minutes} דקות`
    return `${minutes} דקות`
  }
  
  const hours = Math.round(minutes / 60)
  
  // Hours - proper Hebrew grammar
  if (hours === 1) return 'שעה'
  if (hours === 2) return 'שעתיים'
  if (hours <= 10) return `${hours} שעות`
  if (hours === 11) return 'אחת עשרה שעות'
  if (hours === 12) return 'שתים עשרה שעות'
  return `${hours} שעות`
}

/**
 * Get notification template by type
 */
export function getNotificationTemplate(
  type: NotificationType,
  context: ReminderContext | CancellationContext | BroadcastContext | Record<string, unknown>
): NotificationPayload {
  switch (type) {
    case 'reminder':
      return getReminderTemplate(context as ReminderContext)
    case 'cancellation':
      return getCancellationTemplate(context as CancellationContext)
    case 'booking_confirmed':
      return getBookingConfirmedTemplate(context as ReminderContext)
    case 'chat_message':
      return getChatMessageTemplate(context as { senderName: string; message: string })
    case 'barber_broadcast':
      return getBarberBroadcastTemplate(context as BroadcastContext)
    case 'admin_broadcast':
      return getAdminBroadcastTemplate(context as BroadcastContext)
    default:
      return getDefaultTemplate()
  }
}

/**
 * Appointment reminder template
 * Includes deep link with highlight param to focus on the specific appointment
 * Dynamically shows time remaining until appointment with proper Hebrew grammar
 */
function getReminderTemplate(context: ReminderContext): NotificationPayload {
  const time = formatTime(context.appointmentTime)
  const date = formatShortDate(context.appointmentTime)
  const fullDate = formatDate(context.appointmentTime)
  
  // Calculate time until appointment
  const now = Date.now()
  const msUntil = context.appointmentTime - now
  const minutesUntil = Math.round(msUntil / 60000)
  
  // Build dynamic time text with proper Hebrew grammar
  let timeUntilText: string
  if (minutesUntil < 60) {
    timeUntilText = `בעוד ${formatHebrewDuration(minutesUntil)}`
  } else if (minutesUntil < 360) { // Less than 6 hours
    timeUntilText = `בעוד ${formatHebrewDuration(minutesUntil)}`
  } else {
    timeUntilText = `היום בשעה ${time}`
  }
  
  // Deep link with highlight param for focused view
  const deepLinkUrl = `/my-appointments?highlight=${context.reservationId}`
  
  const notificationData: NotificationDataPayload = {
    type: 'reminder',
    recipientType: 'customer',
    reservationId: context.reservationId,
    appointmentTime: context.appointmentTime,
    date,
    url: deepLinkUrl
  }
  
  return {
    title: `⏰ תזכורת: התור שלך ${timeUntilText}`,
    body: `היי ${context.customerName}! יש לך תור ל${context.serviceName} אצל ${context.barberName} ב${fullDate} בשעה ${time}`,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    tag: `reminder-${context.reservationId}`,
    url: deepLinkUrl,
    requireInteraction: true,
    shouldBadge: true, // High priority - should show badge
    data: notificationData,
    actions: [
      { action: 'view', title: 'צפה בתור' },
      { action: 'dismiss', title: 'סגור' }
    ]
  }
}

/**
 * Cancellation notification template
 * Routes to appropriate destination based on who cancelled:
 * - Customer cancelled → Barber gets notification with highlight on cancelled reservations
 * - Barber cancelled → Customer gets notification with highlight on their appointments
 */
function getCancellationTemplate(context: CancellationContext): NotificationPayload {
  const time = formatTime(context.appointmentTime)
  const date = formatDate(context.appointmentTime)
  const urlDate = formatUrlDate(context.appointmentTime)
  const isCancelledByCustomer = context.cancelledBy === 'customer'
  
  if (isCancelledByCustomer) {
    // Notification to barber when customer cancels
    // Deep link with highlight param, cancelled tab, and date filter
    const barberDeepLinkUrl = `/barber/dashboard/reservations?highlight=${context.reservationId}&tab=cancelled&date=${urlDate}`
    
    const barberNotificationData: NotificationDataPayload = {
      type: 'cancellation',
      recipientType: 'barber',
      reservationId: context.reservationId,
      cancelledBy: 'customer',
      reason: context.reason,
      url: barberDeepLinkUrl
    }
    
    return {
      title: '❌ תור בוטל',
      body: `${context.customerName} ביטל/ה את התור ל${context.serviceName} ב${date} בשעה ${time}`,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      tag: `cancel-${context.reservationId}`,
      url: barberDeepLinkUrl,
      requireInteraction: true,
      shouldBadge: true, // High priority - should show badge
      data: barberNotificationData,
      actions: [
        { action: 'view', title: 'צפה בלוח' },
        { action: 'dismiss', title: 'סגור' }
      ]
    }
  }
  
  // Notification to customer when barber cancels
  // Deep link with highlight param to show the cancelled appointment
  const customerDeepLinkUrl = `/my-appointments?highlight=${context.reservationId}&tab=cancelled`
  
  const customerNotificationData: NotificationDataPayload = {
    type: 'cancellation',
    recipientType: 'customer',
    reservationId: context.reservationId,
    cancelledBy: 'barber',
    reason: context.reason,
    url: customerDeepLinkUrl
  }
  
  return {
    title: '❌ התור שלך בוטל',
    body: `${context.barberName} ביטל את התור שלך ל${context.serviceName} ב${date} בשעה ${time}`,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    tag: `cancel-${context.reservationId}`,
    url: customerDeepLinkUrl,
    requireInteraction: true,
    shouldBadge: true, // High priority - should show badge
    data: customerNotificationData,
    actions: [
      { action: 'rebook', title: 'קבע תור חדש' },
      { action: 'dismiss', title: 'סגור' }
    ]
  }
}

/**
 * Booking confirmed template (for barber when customer books)
 * Deep links to barber reservations page with highlight on the new booking
 */
function getBookingConfirmedTemplate(context: ReminderContext): NotificationPayload {
  const time = formatTime(context.appointmentTime)
  const date = formatDate(context.appointmentTime)
  const urlDate = formatUrlDate(context.appointmentTime)
  
  // Deep link with highlight param and date for focused view
  const barberDeepLinkUrl = `/barber/dashboard/reservations?highlight=${context.reservationId}&date=${urlDate}`
  
  const notificationData: NotificationDataPayload = {
    type: 'booking_confirmed',
    recipientType: 'barber',
    reservationId: context.reservationId,
    appointmentTime: context.appointmentTime,
    url: barberDeepLinkUrl
  }
  
  return {
    title: '📅 תור חדש!',
    body: `${context.customerName} קבע/ה תור ל${context.serviceName} ב${date} בשעה ${time}`,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    tag: `booking-${context.reservationId}`,
    url: barberDeepLinkUrl,
    requireInteraction: false,
    shouldBadge: true, // Medium priority - should show badge for barbers
    data: notificationData,
    actions: [
      { action: 'view', title: 'צפה בפרטים' },
      { action: 'dismiss', title: 'סגור' }
    ]
  }
}

/**
 * Chat message template
 * Placeholder for future chat functionality
 */
function getChatMessageTemplate(context: { senderName: string; message: string; recipientType?: 'customer' | 'barber' }): NotificationPayload {
  // Truncate message if too long
  const truncatedMessage = context.message.length > 100 
    ? context.message.substring(0, 97) + '...'
    : context.message
  
  // Determine URL based on recipient type
  const recipientType = context.recipientType || 'customer'
  const deepLinkUrl = recipientType === 'barber' 
    ? '/barber/dashboard/reservations'
    : '/my-appointments'
  
  const notificationData: NotificationDataPayload = {
    type: 'chat_message',
    recipientType,
    url: deepLinkUrl
  }
  
  return {
    title: `💬 הודעה מ${context.senderName}`,
    body: truncatedMessage,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    tag: 'chat-message',
    url: deepLinkUrl,
    requireInteraction: true,
    data: notificationData,
    actions: [
      { action: 'reply', title: 'השב' },
      { action: 'dismiss', title: 'סגור' }
    ]
  }
}

/**
 * Barber broadcast template (barber to their customers)
 * NOTE: Broadcasts do NOT increment badge to reduce noise
 */
function getBarberBroadcastTemplate(context: BroadcastContext): NotificationPayload {
  const notificationData: NotificationDataPayload = {
    type: 'barber_broadcast',
    recipientType: 'customer',
    senderId: context.senderId,
    url: '/'
  }
  
  return {
    title: `📢 הודעה מ${context.senderName}`,
    body: context.message,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    tag: 'barber-broadcast',
    url: '/',
    requireInteraction: false,
    shouldBadge: false, // Low priority - informational only, no badge
    data: notificationData,
    actions: [
      { action: 'view', title: 'צפה' },
      { action: 'dismiss', title: 'סגור' }
    ]
  }
}

/**
 * Admin broadcast template (admin to all users)
 * NOTE: Broadcasts do NOT increment badge to reduce noise
 * recipientType will be set dynamically when sending to customers vs barbers
 */
function getAdminBroadcastTemplate(context: BroadcastContext & { recipientType?: 'customer' | 'barber' }): NotificationPayload {
  const recipientType = context.recipientType || 'customer'
  
  const notificationData: NotificationDataPayload = {
    type: 'admin_broadcast',
    recipientType,
    senderId: context.senderId,
    url: '/'
  }
  
  return {
    title: '📣 רם אל ברברשופ',
    body: context.message,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    tag: 'admin-broadcast',
    url: '/',
    requireInteraction: false,
    shouldBadge: false, // Low priority - informational only, no badge
    data: notificationData,
    actions: [
      { action: 'view', title: 'צפה' },
      { action: 'dismiss', title: 'סגור' }
    ]
  }
}

/**
 * Default template fallback
 */
function getDefaultTemplate(): NotificationPayload {
  const notificationData: NotificationDataPayload = {
    type: 'admin_broadcast', // Default to admin_broadcast as fallback type
    recipientType: 'customer',
    url: '/'
  }
  
  return {
    title: 'רם אל ברברשופ',
    body: 'יש לך הודעה חדשה',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    tag: 'default',
    url: '/',
    requireInteraction: false,
    data: notificationData
  }
}

