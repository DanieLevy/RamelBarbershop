/**
 * Push Notification Type Definitions
 */

// Device types supported
export type DeviceType = 'ios' | 'android' | 'desktop'

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

// Send notification result
export interface SendNotificationResult {
  success: boolean
  sent: number
  failed: number
  errors: string[]
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

