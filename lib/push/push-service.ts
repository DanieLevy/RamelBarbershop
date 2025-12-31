/**
 * Server-Side Push Notification Service
 * 
 * User-based push notification service with logging and type-aware sending.
 * Every notification is tied to an authenticated user and logged for auditing.
 */

import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'
import { getNotificationTemplate } from './notification-templates'
import type {
  NotificationPayload,
  SendNotificationResult,
  SaveSubscriptionData,
  PushSubscriptionRecord,
  DeviceType,
  NotificationType,
  RecipientType,
  ReminderContext,
  CancellationContext,
  BroadcastContext,
  BarberNotificationSettings,
  CustomerNotificationSettings,
} from './types'

// Initialize Supabase client for server-side operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// VAPID configuration
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || ''
const vapidEmail = process.env.VAPID_EMAIL || 'mailto:admin@ramel-barbershop.co.il'

// Initialize web-push with VAPID credentials
if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey)
}

// HTTP error codes that indicate the subscription is permanently invalid
const PERMANENT_ERROR_CODES = [410, 404, 401]

// Configuration for subscription health management
const MAX_CONSECUTIVE_FAILURES = 5 // Deactivate after this many consecutive failures
const MAX_RETRY_ATTEMPTS = 2 // Number of retry attempts for transient failures
const RETRY_DELAY_MS = 1000 // Base delay between retries (exponential backoff applied)

/**
 * Push Notification Service Class
 */
class PushNotificationService {
  /**
   * Get the public VAPID key for client-side subscription
   */
  getPublicKey(): string {
    return vapidPublicKey.trim().replace(/[\r\n\s]/g, '')
  }

  /**
   * Check if push notifications are configured
   */
  isConfigured(): boolean {
    return Boolean(vapidPublicKey && vapidPrivateKey)
  }

  // ============================================================
  // Type-Aware Notification Methods
  // ============================================================

  /**
   * Send an appointment reminder to a customer
   */
  async sendReminder(context: ReminderContext): Promise<SendNotificationResult> {
    // Get barber's notification settings for reminder timing
    const barberSettings = await this.getBarberNotificationSettings(context.barberId)
    
    // Check if customer has reminders enabled
    const customerSettings = await this.getCustomerNotificationSettings(context.customerId)
    if (customerSettings && !customerSettings.reminder_enabled) {
      return { success: false, sent: 0, failed: 0, errors: ['Customer has disabled reminders'] }
    }

    const payload = getNotificationTemplate('reminder', context)
    
    return this.sendTypedNotification({
      type: 'reminder',
      recipientType: 'customer',
      recipientId: context.customerId,
      reservationId: context.reservationId,
      payload,
      metadata: { barberReminderHours: barberSettings?.reminder_hours_before || 3 }
    })
  }

  /**
   * Send a cancellation notification
   */
  async sendCancellationAlert(context: CancellationContext): Promise<SendNotificationResult> {
    const payload = getNotificationTemplate('cancellation', context)
    
    // Determine recipient based on who cancelled
    const recipientType: RecipientType = context.cancelledBy === 'customer' ? 'barber' : 'customer'
    const recipientId = context.cancelledBy === 'customer' ? context.barberId : context.customerId
    
    // Check settings based on recipient type
    if (recipientType === 'customer') {
      const settings = await this.getCustomerNotificationSettings(recipientId)
      if (settings && !settings.cancellation_alerts_enabled) {
        return { success: false, sent: 0, failed: 0, errors: ['Customer has disabled cancellation alerts'] }
      }
    } else {
      const settings = await this.getBarberNotificationSettings(recipientId)
      if (settings && !settings.notify_on_customer_cancel) {
        return { success: false, sent: 0, failed: 0, errors: ['Barber has disabled cancellation alerts'] }
      }
    }

    return this.sendTypedNotification({
      type: 'cancellation',
      recipientType,
      recipientId,
      reservationId: context.reservationId,
      senderId: context.cancelledBy === 'customer' ? context.customerId : context.barberId,
      payload
    })
  }

  /**
   * Send new booking notification to barber
   */
  async sendBookingConfirmed(context: ReminderContext): Promise<SendNotificationResult> {
    // Check if barber has new booking notifications enabled
    const settings = await this.getBarberNotificationSettings(context.barberId)
    if (settings && !settings.notify_on_new_booking) {
      return { success: false, sent: 0, failed: 0, errors: ['Barber has disabled new booking alerts'] }
    }

    const payload = getNotificationTemplate('booking_confirmed', context)
    
    return this.sendTypedNotification({
      type: 'booking_confirmed',
      recipientType: 'barber',
      recipientId: context.barberId,
      reservationId: context.reservationId,
      senderId: context.customerId,
      payload
    })
  }

  /**
   * Send a barber broadcast to their customers with future appointments
   */
  async sendBarberBroadcast(context: BroadcastContext): Promise<SendNotificationResult> {
    // Check if barber has broadcasting enabled
    const settings = await this.getBarberNotificationSettings(context.senderId)
    if (settings && !settings.broadcast_enabled) {
      return { success: false, sent: 0, failed: 0, errors: ['Barber has disabled broadcasting'] }
    }

    const payload = getNotificationTemplate('barber_broadcast', context)
    
    // Get all customers with future appointments for this barber
    const customerIds = context.targetCustomerIds || await this.getBarberCustomerIds(context.senderId)
    
    if (!customerIds.length) {
      return { success: false, sent: 0, failed: 0, errors: ['No customers to notify'] }
    }

    // Send to all customers
    const results = await Promise.all(
      customerIds.map(customerId => 
        this.sendTypedNotification({
          type: 'barber_broadcast',
          recipientType: 'customer',
          recipientId: customerId,
          senderId: context.senderId,
          payload
        })
      )
    )

    // Aggregate results
    const sent = results.reduce((acc, r) => acc + r.sent, 0)
    const failed = results.reduce((acc, r) => acc + r.failed, 0)
    const errors = results.flatMap(r => r.errors)

    return { success: sent > 0, sent, failed, errors }
  }

  /**
   * Send an admin broadcast to all registered users
   */
  async sendAdminBroadcast(context: BroadcastContext): Promise<SendNotificationResult> {
    const payload = getNotificationTemplate('admin_broadcast', context)
    
    // Get all customers and barbers with active subscriptions
    const { data: subscriptions } = await supabase
      .from('push_subscriptions')
      .select('customer_id, barber_id')
      .eq('is_active', true)

    if (!subscriptions?.length) {
      return { success: false, sent: 0, failed: 0, errors: ['No active subscriptions'] }
    }

    // Get unique user IDs
    const customerIds = [...new Set(subscriptions.filter(s => s.customer_id).map(s => s.customer_id!))]
    const barberIds = [...new Set(subscriptions.filter(s => s.barber_id).map(s => s.barber_id!))]

    // Send to all users
    const results: SendNotificationResult[] = []

    for (const customerId of customerIds) {
      results.push(await this.sendTypedNotification({
        type: 'admin_broadcast',
        recipientType: 'customer',
        recipientId: customerId,
        senderId: context.senderId,
        payload
      }))
    }

    for (const barberId of barberIds) {
      results.push(await this.sendTypedNotification({
        type: 'admin_broadcast',
        recipientType: 'barber',
        recipientId: barberId,
        senderId: context.senderId,
        payload
      }))
    }

    const sent = results.reduce((acc, r) => acc + r.sent, 0)
    const failed = results.reduce((acc, r) => acc + r.failed, 0)
    const errors = results.flatMap(r => r.errors)

    return { success: sent > 0, sent, failed, errors }
  }

  // ============================================================
  // Core Send Methods (with Logging)
  // ============================================================

  /**
   * Send a typed notification with logging
   * 
   * Badge count logic:
   * - If payload.shouldBadge is true, calculates accurate unread count
   * - If payload.shouldBadge is false, sends badgeCount: 0 (no badge change)
   */
  private async sendTypedNotification(params: {
    type: NotificationType
    recipientType: RecipientType
    recipientId: string
    reservationId?: string
    senderId?: string
    payload: NotificationPayload
    metadata?: Record<string, unknown>
  }): Promise<SendNotificationResult> {
    const { type, recipientType, recipientId, reservationId, senderId, payload, metadata } = params

    // Validate recipientId - must be a valid UUID, not empty
    if (!recipientId || recipientId.trim() === '') {
      console.error(`[PushService] Cannot send ${type} notification: recipientId is empty`)
      return { 
        success: false, 
        sent: 0, 
        failed: 0, 
        errors: [`Invalid recipientId for ${recipientType}`] 
      }
    }

    // Create log entry (this notification will be unread)
    const logId = await this.createNotificationLog({
      notification_type: type,
      recipient_type: recipientType,
      recipient_id: recipientId,
      reservation_id: reservationId || null,
      sender_id: senderId || null,
      title: payload.title,
      body: payload.body,
      payload: { ...payload.data, ...metadata }
    })

    // Calculate badge count based on shouldBadge flag
    let badgeCount = 0
    if (payload.shouldBadge !== false) {
      // Get current unread count + 1 for this new notification
      const currentUnread = await this.getUnreadCount(recipientType, recipientId)
      badgeCount = currentUnread // Already includes this notification since we just created the log entry
      console.log(`[PushService] Badge count for ${recipientType} ${recipientId}: ${badgeCount}`)
    }

    // Prepare payload with accurate badge count
    const payloadWithBadge: NotificationPayload = {
      ...payload,
      badgeCount: payload.shouldBadge !== false ? badgeCount : 0
    }

    // Get subscriptions for recipient
    const subscriptions = recipientType === 'customer'
      ? await this.getCustomerSubscriptions(recipientId)
      : await this.getBarberSubscriptions(recipientId)

    if (!subscriptions.length) {
      await this.updateNotificationLog(logId, {
        status: 'failed',
        error_message: 'No active subscriptions for recipient'
      })
      return { success: false, sent: 0, failed: 0, errors: ['No active subscriptions'], logId }
    }

    // Send notifications with badge count
    const result = await this.sendToSubscriptions(subscriptions, payloadWithBadge)

    // Update log with results
    await this.updateNotificationLog(logId, {
      devices_targeted: subscriptions.length,
      devices_succeeded: result.sent,
      devices_failed: result.failed,
      status: result.sent === subscriptions.length ? 'sent' : result.sent > 0 ? 'partial' : 'failed',
      error_message: result.errors.length > 0 ? result.errors.join('; ') : null,
      sent_at: new Date().toISOString()
    })

    return { ...result, logId }
  }

  /**
   * Send a notification to specific customers (legacy support)
   */
  async sendToCustomers(
    customerIds: string[],
    payload: NotificationPayload
  ): Promise<SendNotificationResult> {
    // Only select columns needed for sending notifications
    const { data: subscriptions } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth, customer_id, barber_id, device_type, is_active, consecutive_failures')
      .in('customer_id', customerIds)
      .eq('is_active', true)

    return this.sendToSubscriptions(subscriptions as PushSubscriptionRecord[] || [], payload)
  }

  /**
   * Send a notification to a specific customer (all their devices)
   */
  async sendToCustomer(
    customerId: string,
    payload: NotificationPayload
  ): Promise<SendNotificationResult> {
    return this.sendToCustomers([customerId], payload)
  }

  /**
   * Send a notification to specific barbers (legacy support)
   */
  async sendToBarbers(
    barberIds: string[],
    payload: NotificationPayload
  ): Promise<SendNotificationResult> {
    // Only select columns needed for sending notifications
    const { data: subscriptions } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth, customer_id, barber_id, device_type, is_active, consecutive_failures')
      .in('barber_id', barberIds)
      .eq('is_active', true)

    return this.sendToSubscriptions(subscriptions as PushSubscriptionRecord[] || [], payload)
  }

  /**
   * Send a notification to a specific barber (all their devices)
   */
  async sendToBarber(
    barberId: string,
    payload: NotificationPayload
  ): Promise<SendNotificationResult> {
    return this.sendToBarbers([barberId], payload)
  }

  /**
   * Send a notification to all active subscriptions (broadcast)
   */
  async sendToAll(payload: NotificationPayload): Promise<SendNotificationResult> {
    // Only select columns needed for sending notifications
    const { data: subscriptions } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth, customer_id, barber_id, device_type, is_active, consecutive_failures')
      .eq('is_active', true)

    return this.sendToSubscriptions(subscriptions as PushSubscriptionRecord[] || [], payload)
  }

  /**
   * Core function to send notifications to a list of subscriptions
   * Includes retry logic with exponential backoff and automatic deactivation
   */
  private async sendToSubscriptions(
    subscriptions: PushSubscriptionRecord[],
    payload: NotificationPayload
  ): Promise<SendNotificationResult> {
    const errors: string[] = []
    let sent = 0
    let failed = 0

    if (!subscriptions.length) {
      return { success: false, sent: 0, failed: 0, errors: ['No active subscriptions found'] }
    }

    // Filter out subscriptions with too many consecutive failures
    const healthySubscriptions = subscriptions.filter(sub => {
      if ((sub.consecutive_failures || 0) >= MAX_CONSECUTIVE_FAILURES) {
        console.log(`[PushService] Skipping subscription ${sub.id} - too many consecutive failures (${sub.consecutive_failures})`)
        // Mark as inactive asynchronously (don't await to avoid blocking)
        supabase
          .from('push_subscriptions')
          .update({ is_active: false, last_delivery_status: 'failed' })
          .eq('id', sub.id)
          .then(() => console.log(`[PushService] Auto-deactivated subscription ${sub.id}`))
        return false
      }
      return true
    })

    if (!healthySubscriptions.length) {
      return { success: false, sent: 0, failed: 0, errors: ['All subscriptions exceeded failure threshold'] }
    }

    // Build notification payload for web-push
    const notificationPayload = JSON.stringify({
      notification: {
        title: payload.title,
        body: payload.body,
        icon: payload.icon || '/icons/icon-192x192.png',
        badge: payload.badge || '/icons/icon-72x72.png',
        image: payload.image,
        tag: payload.tag || 'ramel-notification',
        requireInteraction: payload.requireInteraction !== false,
        actions: payload.actions || [
          { action: 'view', title: 'צפה' },
          { action: 'dismiss', title: 'סגור' }
        ],
        data: {
          ...payload.data,
          url: payload.url || '/',
          timestamp: Date.now()
        }
      },
      badgeCount: payload.badgeCount ?? 1
    })

    // Send to each subscription with retry logic
    const sendPromises = healthySubscriptions.map(async (sub) => {
      let lastError: { message?: string; statusCode?: number } | null = null
      
      // Retry loop with exponential backoff
      for (let attempt = 0; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth }
            },
            notificationPayload
          )

          // Update success status - reset failure count
          await supabase
            .from('push_subscriptions')
            .update({
              consecutive_failures: 0,
              last_delivery_status: 'success',
              last_used: new Date().toISOString()
            })
            .eq('id', sub.id)

          sent++
          return // Success - exit retry loop
        } catch (error: unknown) {
          lastError = error as { message?: string; statusCode?: number }
          
          // Don't retry permanent errors
          if (lastError.statusCode && PERMANENT_ERROR_CODES.includes(lastError.statusCode)) {
            console.log(`[PushService] Permanent error for ${sub.id}: ${lastError.statusCode}`)
            break // Exit retry loop for permanent errors
          }
          
          // Wait before retrying (exponential backoff)
          if (attempt < MAX_RETRY_ATTEMPTS) {
            const delay = RETRY_DELAY_MS * Math.pow(2, attempt)
            console.log(`[PushService] Retry ${attempt + 1}/${MAX_RETRY_ATTEMPTS} for ${sub.id} in ${delay}ms`)
            await new Promise(resolve => setTimeout(resolve, delay))
          }
        }
      }
      
      // All retries failed
      failed++
      errors.push(`Subscription ${sub.id}: ${lastError?.message || 'Unknown error'}`)

      // Handle permanent vs transient errors
      if (lastError?.statusCode && PERMANENT_ERROR_CODES.includes(lastError.statusCode)) {
        // Deactivate immediately for permanent errors
        await supabase
          .from('push_subscriptions')
          .update({
            is_active: false,
            last_delivery_status: 'failed'
          })
          .eq('id', sub.id)
        console.log(`[PushService] Deactivated subscription ${sub.id} due to permanent error`)
      } else {
        // Increment failure count for transient errors
        const newFailureCount = (sub.consecutive_failures || 0) + 1
        const shouldDeactivate = newFailureCount >= MAX_CONSECUTIVE_FAILURES
        
        await supabase
          .from('push_subscriptions')
          .update({
            consecutive_failures: newFailureCount,
            last_delivery_status: 'failed',
            is_active: !shouldDeactivate
          })
          .eq('id', sub.id)
        
        if (shouldDeactivate) {
          console.log(`[PushService] Auto-deactivated subscription ${sub.id} after ${newFailureCount} consecutive failures`)
        }
      }
    })

    await Promise.allSettled(sendPromises)

    return { success: sent > 0, sent, failed, errors }
  }

  // ============================================================
  // Badge Count Management
  // ============================================================

  /**
   * Get unread notification count for a recipient
   * Only counts notifications where shouldBadge would be true
   */
  async getUnreadCount(recipientType: RecipientType, recipientId: string): Promise<number> {
    const { count, error } = await supabase
      .from('notification_logs')
      .select('*', { count: 'exact', head: true })
      .eq('recipient_type', recipientType)
      .eq('recipient_id', recipientId)
      .eq('is_read', false)
      .eq('status', 'sent')
      // Only count high-priority notification types that show badges
      .in('notification_type', ['reminder', 'cancellation', 'booking_confirmed'])

    if (error) {
      console.error('[PushService] Failed to get unread count:', error)
      return 1 // Default to 1 on error
    }

    return count || 0
  }

  /**
   * Mark all notifications as read for a recipient
   */
  async markAllAsRead(recipientType: RecipientType, recipientId: string): Promise<boolean> {
    const { error } = await supabase
      .from('notification_logs')
      .update({ is_read: true })
      .eq('recipient_type', recipientType)
      .eq('recipient_id', recipientId)
      .eq('is_read', false)

    if (error) {
      console.error('[PushService] Failed to mark notifications as read:', error)
      return false
    }

    return true
  }

  // ============================================================
  // Notification Logging
  // ============================================================

  /**
   * Create a notification log entry
   */
  private async createNotificationLog(data: {
    notification_type: NotificationType
    recipient_type: RecipientType
    recipient_id: string
    reservation_id: string | null
    sender_id: string | null
    title: string
    body: string
    payload?: Record<string, unknown> | null
  }): Promise<string> {
    const { data: log, error } = await supabase
      .from('notification_logs')
      .insert({
        ...data,
        status: 'pending',
        is_read: false // New notifications start as unread
      })
      .select('id')
      .single()

    if (error) {
      console.error('[PushService] Failed to create notification log:', error)
      return ''
    }

    return log?.id || ''
  }

  /**
   * Update a notification log entry
   */
  private async updateNotificationLog(
    logId: string,
    data: Partial<{
      devices_targeted: number
      devices_succeeded: number
      devices_failed: number
      status: 'pending' | 'sent' | 'partial' | 'failed'
      error_message: string | null
      sent_at: string
    }>
  ): Promise<void> {
    if (!logId) return

    await supabase
      .from('notification_logs')
      .update(data)
      .eq('id', logId)
  }

  // ============================================================
  // Settings Helpers
  // ============================================================

  /**
   * Get barber notification settings
   */
  async getBarberNotificationSettings(barberId: string): Promise<BarberNotificationSettings | null> {
    const { data } = await supabase
      .from('barber_notification_settings')
      .select('barber_id, reminder_hours_before, notify_on_customer_cancel, notify_on_new_booking, broadcast_enabled')
      .eq('barber_id', barberId)
      .single()

    return data as BarberNotificationSettings | null
  }

  /**
   * Get customer notification settings
   */
  async getCustomerNotificationSettings(customerId: string): Promise<CustomerNotificationSettings | null> {
    const { data } = await supabase
      .from('customer_notification_settings')
      .select('customer_id, pwa_installed, notifications_enabled, reminder_enabled, cancellation_alerts_enabled')
      .eq('customer_id', customerId)
      .single()

    return data as CustomerNotificationSettings | null
  }

  /**
   * Get or create barber notification settings with defaults
   */
  async ensureBarberNotificationSettings(barberId: string): Promise<BarberNotificationSettings> {
    const existing = await this.getBarberNotificationSettings(barberId)
    if (existing) return existing

    const { data, error } = await supabase
      .from('barber_notification_settings')
      .insert({ barber_id: barberId })
      .select('*')
      .single()

    if (error) {
      console.error('[PushService] Failed to create barber settings:', error)
      // Return defaults
      return {
        id: '',
        barber_id: barberId,
        reminder_hours_before: 3,
        notify_on_customer_cancel: true,
        notify_on_new_booking: true,
        broadcast_enabled: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    }

    return data as BarberNotificationSettings
  }

  /**
   * Get customer IDs with future appointments for a barber
   */
  private async getBarberCustomerIds(barberId: string): Promise<string[]> {
    const now = Date.now()
    
    const { data } = await supabase
      .from('reservations')
      .select('customer_id')
      .eq('barber_id', barberId)
      .eq('status', 'confirmed')
      .gt('time_timestamp', now)
      .not('customer_id', 'is', null)

    if (!data) return []

    // Get unique customer IDs
    const customerIds = [...new Set(data.map(r => r.customer_id).filter(Boolean))]
    return customerIds as string[]
  }

  // ============================================================
  // Subscription Management
  // ============================================================

  /**
   * Save a push subscription to the database
   */
  async saveSubscription(data: SaveSubscriptionData): Promise<{ subscriptionId: string | null; error?: string }> {
    try {
      // Validate that user ID is provided (enforces user-based subscriptions)
      if (!data.customerId && !data.barberId) {
        return { subscriptionId: null, error: 'Either customerId or barberId is required' }
      }

      // Check if subscription already exists (by endpoint)
      const { data: existing } = await supabase
        .from('push_subscriptions')
        .select('id')
        .eq('endpoint', data.subscription.endpoint)
        .single()

      const subscriptionData = {
        customer_id: data.customerId || null,
        barber_id: data.barberId || null,
        endpoint: data.subscription.endpoint,
        p256dh: data.subscription.keys.p256dh,
        auth: data.subscription.keys.auth,
        device_type: data.deviceType,
        device_name: data.deviceName || this.generateDeviceName(data.deviceType, data.userAgent),
        user_agent: data.userAgent,
        is_active: true,
        consecutive_failures: 0,
        last_delivery_status: null,
        last_used: new Date().toISOString()
      }

      if (existing) {
        // Update existing subscription
        const { error } = await supabase
          .from('push_subscriptions')
          .update(subscriptionData)
          .eq('id', existing.id)

        if (error) {
          return { subscriptionId: null, error: error.message }
        }

        // Update notification settings if customer
        if (data.customerId) {
          await this.updateNotificationSettings(data.customerId, true)
        }

        return { subscriptionId: existing.id }
      }

      // Insert new subscription
      const { data: newSub, error } = await supabase
        .from('push_subscriptions')
        .insert(subscriptionData)
        .select('id')
        .single()

      if (error) {
        return { subscriptionId: null, error: error.message }
      }

      // Update notification settings if customer
      if (data.customerId) {
        await this.updateNotificationSettings(data.customerId, true)
      }

      return { subscriptionId: newSub?.id || null }
    } catch (err) {
      return { subscriptionId: null, error: String(err) }
    }
  }

  /**
   * Remove a subscription
   */
  async removeSubscription(subscriptionId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('push_subscriptions')
        .delete()
        .eq('id', subscriptionId)

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  }

  /**
   * Deactivate a subscription by endpoint
   */
  async deactivateByEndpoint(endpoint: string): Promise<void> {
    await supabase
      .from('push_subscriptions')
      .update({ is_active: false })
      .eq('endpoint', endpoint)
  }

  /**
   * Get all subscriptions for a customer
   */
  async getCustomerSubscriptions(customerId: string): Promise<PushSubscriptionRecord[]> {
    const { data } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('customer_id', customerId)
      .eq('is_active', true)
      .order('last_used', { ascending: false })

    return (data as PushSubscriptionRecord[]) || []
  }

  /**
   * Get all subscriptions for a barber
   */
  async getBarberSubscriptions(barberId: string): Promise<PushSubscriptionRecord[]> {
    const { data } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('barber_id', barberId)
      .eq('is_active', true)
      .order('last_used', { ascending: false })

    return (data as PushSubscriptionRecord[]) || []
  }

  /**
   * Update customer notification settings
   */
  private async updateNotificationSettings(customerId: string, enabled: boolean): Promise<void> {
    const { data: existing } = await supabase
      .from('customer_notification_settings')
      .select('id')
      .eq('customer_id', customerId)
      .single()

    if (existing) {
      await supabase
        .from('customer_notification_settings')
        .update({
          notifications_enabled: enabled,
          updated_at: new Date().toISOString()
        })
        .eq('customer_id', customerId)
    } else {
      await supabase
        .from('customer_notification_settings')
        .insert({
          customer_id: customerId,
          notifications_enabled: enabled,
          pwa_installed: true
        })
    }
  }

  /**
   * Generate a user-friendly device name from user agent
   */
  private generateDeviceName(deviceType: DeviceType, userAgent: string): string {
    if (deviceType === 'ios') {
      if (userAgent.includes('iPad')) return 'iPad'
      return 'iPhone'
    }
    
    if (deviceType === 'android') {
      const match = userAgent.match(/\(Linux;[^)]*;\s*([^)]+)\)/)
      if (match && match[1]) {
        const model = match[1].split(' Build')[0].trim()
        if (model && model !== 'Android') return model
      }
      return 'מכשיר אנדרואיד'
    }
    
    if (userAgent.includes('Windows')) return 'מחשב Windows'
    if (userAgent.includes('Mac')) return 'מחשב Mac'
    if (userAgent.includes('Linux')) return 'מחשב Linux'
    
    return 'מכשיר לא מזוהה'
  }

  /**
   * Get total active subscription count
   */
  async getActiveSubscriptionCount(): Promise<number> {
    const { count } = await supabase
      .from('push_subscriptions')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)

    return count || 0
  }

  // ============================================================
  // Maintenance & Cleanup
  // ============================================================

  /**
   * Clean up stale subscriptions and old notification logs
   * Should be called periodically (e.g., via cron job)
   * 
   * @returns Summary of cleanup operations
   */
  async cleanupStaleData(): Promise<{
    deactivatedSubscriptions: number
    deletedLogs: number
    errors: string[]
  }> {
    const results = {
      deactivatedSubscriptions: 0,
      deletedLogs: 0,
      errors: [] as string[]
    }

    try {
      // 1. Deactivate subscriptions with high consecutive failures
      const { data: failedSubs, error: failedError } = await supabase
        .from('push_subscriptions')
        .update({ is_active: false })
        .eq('is_active', true)
        .gte('consecutive_failures', MAX_CONSECUTIVE_FAILURES)
        .select('id')

      if (failedError) {
        results.errors.push(`Failed to deactivate high-failure subscriptions: ${failedError.message}`)
      } else {
        results.deactivatedSubscriptions = failedSubs?.length || 0
        if (results.deactivatedSubscriptions > 0) {
          console.log(`[PushService Cleanup] Deactivated ${results.deactivatedSubscriptions} high-failure subscriptions`)
        }
      }

      // 2. Deactivate subscriptions not used in 90 days
      const ninetyDaysAgo = new Date()
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
      
      const { data: staleSubs, error: staleError } = await supabase
        .from('push_subscriptions')
        .update({ is_active: false })
        .eq('is_active', true)
        .lt('last_used', ninetyDaysAgo.toISOString())
        .select('id')

      if (staleError) {
        results.errors.push(`Failed to deactivate stale subscriptions: ${staleError.message}`)
      } else {
        const staleCount = staleSubs?.length || 0
        results.deactivatedSubscriptions += staleCount
        if (staleCount > 0) {
          console.log(`[PushService Cleanup] Deactivated ${staleCount} stale subscriptions (90+ days unused)`)
        }
      }

      // 3. Delete old notification logs (older than 30 days)
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      
      // First count how many we're going to delete
      const { count: toDeleteCount } = await supabase
        .from('notification_logs')
        .select('id', { count: 'exact', head: true })
        .lt('created_at', thirtyDaysAgo.toISOString())
      
      // Then delete them
      const { error: deleteError } = await supabase
        .from('notification_logs')
        .delete()
        .lt('created_at', thirtyDaysAgo.toISOString())

      if (deleteError) {
        results.errors.push(`Failed to delete old notification logs: ${deleteError.message}`)
      } else {
        results.deletedLogs = toDeleteCount || 0
        if (results.deletedLogs > 0) {
          console.log(`[PushService Cleanup] Deleted ${results.deletedLogs} old notification logs (30+ days)`)
        }
      }

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      results.errors.push(`Cleanup failed: ${message}`)
      console.error('[PushService Cleanup] Error:', error)
    }

    return results
  }

  /**
   * Get subscription health statistics
   * Useful for monitoring and debugging
   */
  async getSubscriptionStats(): Promise<{
    total: number
    active: number
    inactive: number
    highFailure: number
    byDeviceType: Record<string, number>
  }> {
    const stats = {
      total: 0,
      active: 0,
      inactive: 0,
      highFailure: 0,
      byDeviceType: {} as Record<string, number>
    }

    try {
      // Get all subscriptions for analysis
      const { data, error } = await supabase
        .from('push_subscriptions')
        .select('is_active, consecutive_failures, device_type')

      if (error || !data) {
        console.error('[PushService] Error fetching subscription stats:', error)
        return stats
      }

      stats.total = data.length

      for (const sub of data) {
        if (sub.is_active) {
          stats.active++
        } else {
          stats.inactive++
        }

        if ((sub.consecutive_failures || 0) >= MAX_CONSECUTIVE_FAILURES) {
          stats.highFailure++
        }

        const deviceType = sub.device_type || 'unknown'
        stats.byDeviceType[deviceType] = (stats.byDeviceType[deviceType] || 0) + 1
      }

    } catch (error) {
      console.error('[PushService] Error calculating stats:', error)
    }

    return stats
  }
}

// Export singleton instance
export const pushService = new PushNotificationService()
