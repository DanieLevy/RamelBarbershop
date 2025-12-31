/**
 * Push Notification Type Definitions
 */

// Device types supported
export type DeviceType = 'ios' | 'android' | 'desktop'

// Notification types for categorization
export type NotificationType = 
  | 'reminder'           // Appointment reminder
  | 'cancellation'       // Booking cancelled
  | 'booking_confirmed'  // New booking made
  | 'chat_message'       // User-barber message
  | 'barber_broadcast'   // Barber to their customers
  | 'admin_broadcast'    // Admin to all users

// Recipient types
export type RecipientType = 'customer' | 'barber'

// Notification log status
export type NotificationStatus = 'pending' | 'sent' | 'partial' | 'failed'

// Notification payload structure
export interface NotificationPayload {
  title: string
  body: string
  icon?: string
  badge?: string
  image?: string
  url?: string
  tag?: string
  requireInteraction?: boolean
  actions?: Array<{ action: string; title: string; icon?: string }>
  data?: Record<string, unknown>
  badgeCount?: number
  /**
   * Whether this notification type should increment the app badge.
   * High-priority notifications (reminders, cancellations, new bookings) should badge.
   * Low-priority notifications (broadcasts) should not badge to reduce noise.
   */
  shouldBadge?: boolean
}

// Extended payload with metadata for logging
export interface TypedNotificationPayload extends NotificationPayload {
  type: NotificationType
  recipientType: RecipientType
  recipientId: string
  reservationId?: string
  senderId?: string
}

// Push subscription data from browser
export interface WebPushSubscription {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
}

// Database push subscription record
export interface PushSubscriptionRecord {
  id: string
  customer_id: string | null
  barber_id: string | null
  endpoint: string
  p256dh: string
  auth: string
  device_type: DeviceType
  device_name: string | null
  user_agent: string | null
  is_active: boolean
  consecutive_failures: number
  last_delivery_status: 'success' | 'failed' | 'pending' | null
  last_used: string
  created_at: string
}

// Customer notification settings record
export interface CustomerNotificationSettings {
  id: string
  customer_id: string
  pwa_installed: boolean
  notifications_enabled: boolean
  reminder_enabled: boolean
  cancellation_alerts_enabled: boolean
  created_at: string
  updated_at: string
}

// Barber notification settings record
export interface BarberNotificationSettings {
  id: string
  barber_id: string
  reminder_hours_before: number
  notify_on_customer_cancel: boolean
  notify_on_new_booking: boolean
  broadcast_enabled: boolean
  created_at: string
  updated_at: string
}

// Notification log record (audit trail)
export interface NotificationLogRecord {
  id: string
  notification_type: NotificationType
  recipient_type: RecipientType
  recipient_id: string
  reservation_id: string | null
  sender_id: string | null
  title: string
  body: string
  payload: Record<string, unknown> | null
  devices_targeted: number
  devices_succeeded: number
  devices_failed: number
  status: NotificationStatus
  error_message: string | null
  created_at: string
  sent_at: string | null
  /** Whether the notification has been seen/read by the recipient */
  is_read: boolean
}

// Send notification result
export interface SendNotificationResult {
  success: boolean
  sent: number
  failed: number
  errors: string[]
  logId?: string
}

// Subscription save data
export interface SaveSubscriptionData {
  customerId?: string
  barberId?: string
  subscription: WebPushSubscription
  deviceType: DeviceType
  deviceName?: string
  userAgent: string
}

// Push notification status for a user
export interface PushStatus {
  isSupported: boolean
  permission: NotificationPermission | 'unavailable'
  isSubscribed: boolean
  pwaInstalled: boolean
  notificationsEnabled: boolean
  devices: DeviceInfo[]
}

// Device info for display
export interface DeviceInfo {
  id: string
  deviceType: DeviceType
  deviceName: string | null
  lastUsed: string
  createdAt: string
}

// Reminder context for sending reminders
export interface ReminderContext {
  reservationId: string
  customerId: string
  barberId: string
  customerName: string
  barberName: string
  serviceName: string
  appointmentTime: number
}

// Cancellation context for sending alerts
export interface CancellationContext {
  reservationId: string
  customerId: string
  barberId: string
  cancelledBy: 'customer' | 'barber'
  customerName: string
  barberName: string
  serviceName: string
  appointmentTime: number
  reason?: string
}

// Broadcast context for sending broadcasts
export interface BroadcastContext {
  senderId: string
  senderName: string
  message: string
  targetCustomerIds?: string[]
}
