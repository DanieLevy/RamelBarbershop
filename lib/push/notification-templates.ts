/**
 * Push Notification Templates
 * Centralized Hebrew message templates for all notification types
 */

import { format } from 'date-fns'
import { he } from 'date-fns/locale'
import type { 
  NotificationPayload, 
  NotificationType,
  ReminderContext,
  CancellationContext,
  BroadcastContext 
} from './types'

// Format time from timestamp
function formatTime(timestamp: number): string {
  return format(new Date(timestamp), 'HH:mm', { locale: he })
}

// Format date from timestamp
function formatDate(timestamp: number): string {
  return format(new Date(timestamp), 'EEEE, d בMMMM', { locale: he })
}

// Format short date
function formatShortDate(timestamp: number): string {
  return format(new Date(timestamp), 'd/M', { locale: he })
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
  
  return {
    title: `⏰ תזכורת: התור שלך ${timeUntilText}`,
    body: `היי ${context.customerName}! יש לך תור ל${context.serviceName} אצל ${context.barberName} ב${fullDate} בשעה ${time}`,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    tag: `reminder-${context.reservationId}`,
    url: deepLinkUrl,
    requireInteraction: true,
    shouldBadge: true, // High priority - should show badge
    data: {
      type: 'reminder',
      reservationId: context.reservationId,
      appointmentTime: context.appointmentTime,
      date,
      url: deepLinkUrl
    },
    actions: [
      { action: 'view', title: 'צפה בתור' },
      { action: 'dismiss', title: 'סגור' }
    ]
  }
}

/**
 * Cancellation notification template
 */
function getCancellationTemplate(context: CancellationContext): NotificationPayload {
  const time = formatTime(context.appointmentTime)
  const date = formatDate(context.appointmentTime)
  const isCancelledByCustomer = context.cancelledBy === 'customer'
  
  if (isCancelledByCustomer) {
    // Notification to barber when customer cancels
    return {
      title: '❌ תור בוטל',
      body: `${context.customerName} ביטל/ה את התור ל${context.serviceName} ב${date} בשעה ${time}`,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      tag: `cancel-${context.reservationId}`,
      url: '/barber/dashboard/reservations',
      requireInteraction: true,
      shouldBadge: true, // High priority - should show badge
      data: {
        type: 'cancellation',
        reservationId: context.reservationId,
        cancelledBy: 'customer',
        reason: context.reason
      },
      actions: [
        { action: 'view', title: 'צפה בלוח' },
        { action: 'dismiss', title: 'סגור' }
      ]
    }
  }
  
  // Notification to customer when barber cancels
  // Deep link with highlight param to show the cancelled appointment
  const deepLinkUrl = `/my-appointments?highlight=${context.reservationId}`
  
  return {
    title: '❌ התור שלך בוטל',
    body: `${context.barberName} ביטל את התור שלך ל${context.serviceName} ב${date} בשעה ${time}`,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    tag: `cancel-${context.reservationId}`,
    url: deepLinkUrl,
    requireInteraction: true,
    shouldBadge: true, // High priority - should show badge
    data: {
      type: 'cancellation',
      reservationId: context.reservationId,
      cancelledBy: 'barber',
      reason: context.reason,
      url: deepLinkUrl
    },
    actions: [
      { action: 'rebook', title: 'קבע תור חדש' },
      { action: 'dismiss', title: 'סגור' }
    ]
  }
}

/**
 * Booking confirmed template (for barber when customer books)
 */
function getBookingConfirmedTemplate(context: ReminderContext): NotificationPayload {
  const time = formatTime(context.appointmentTime)
  const date = formatDate(context.appointmentTime)
  
  return {
    title: '📅 תור חדש!',
    body: `${context.customerName} קבע/ה תור ל${context.serviceName} ב${date} בשעה ${time}`,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    tag: `booking-${context.reservationId}`,
    url: '/barber/dashboard/reservations',
    requireInteraction: false,
    shouldBadge: true, // Medium priority - should show badge for barbers
    data: {
      type: 'booking_confirmed',
      reservationId: context.reservationId
    },
    actions: [
      { action: 'view', title: 'צפה בפרטים' },
      { action: 'dismiss', title: 'סגור' }
    ]
  }
}

/**
 * Chat message template
 */
function getChatMessageTemplate(context: { senderName: string; message: string }): NotificationPayload {
  // Truncate message if too long
  const truncatedMessage = context.message.length > 100 
    ? context.message.substring(0, 97) + '...'
    : context.message
  
  return {
    title: `💬 הודעה מ${context.senderName}`,
    body: truncatedMessage,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    tag: 'chat-message',
    url: '/my-appointments',
    requireInteraction: true,
    data: {
      type: 'chat_message'
    },
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
  return {
    title: `📢 הודעה מ${context.senderName}`,
    body: context.message,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    tag: 'barber-broadcast',
    url: '/',
    requireInteraction: false,
    shouldBadge: false, // Low priority - informational only, no badge
    data: {
      type: 'barber_broadcast',
      senderId: context.senderId
    },
    actions: [
      { action: 'view', title: 'צפה' },
      { action: 'dismiss', title: 'סגור' }
    ]
  }
}

/**
 * Admin broadcast template (admin to all users)
 * NOTE: Broadcasts do NOT increment badge to reduce noise
 */
function getAdminBroadcastTemplate(context: BroadcastContext): NotificationPayload {
  return {
    title: '📣 רמאל ברברשופ',
    body: context.message,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    tag: 'admin-broadcast',
    url: '/',
    requireInteraction: false,
    shouldBadge: false, // Low priority - informational only, no badge
    data: {
      type: 'admin_broadcast',
      senderId: context.senderId
    },
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
  return {
    title: 'רמאל ברברשופ',
    body: 'יש לך הודעה חדשה',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    tag: 'default',
    url: '/',
    requireInteraction: false
  }
}

