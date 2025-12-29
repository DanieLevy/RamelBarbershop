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

    // Create log entry
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

    // Send notifications
    const result = await this.sendToSubscriptions(subscriptions, payload)

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
    const { data: subscriptions } = await supabase
      .from('push_subscriptions')
      .select('*')
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
    const { data: subscriptions } = await supabase
      .from('push_subscriptions')
      .select('*')
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
    const { data: subscriptions } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('is_active', true)

    return this.sendToSubscriptions(subscriptions as PushSubscriptionRecord[] || [], payload)
  }

  /**
   * Core function to send notifications to a list of subscriptions
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

    // Send to each subscription
    const sendPromises = subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth }
          },
          notificationPayload
        )

        // Update success status
        await supabase
          .from('push_subscriptions')
          .update({
            consecutive_failures: 0,
            last_delivery_status: 'success',
            last_used: new Date().toISOString()
          })
          .eq('id', sub.id)

        sent++
      } catch (error: unknown) {
        failed++
        const err = error as { message?: string; statusCode?: number }
        errors.push(`Subscription ${sub.id}: ${err.message || 'Unknown error'}`)

        // Deactivate subscription if permanent error
        if (err.statusCode && PERMANENT_ERROR_CODES.includes(err.statusCode)) {
          await supabase
            .from('push_subscriptions')
            .update({
              is_active: false,
              last_delivery_status: 'failed'
            })
            .eq('id', sub.id)
        } else {
          // Increment failure count for transient errors
          await supabase
            .from('push_subscriptions')
            .update({
              consecutive_failures: (sub.consecutive_failures || 0) + 1,
              last_delivery_status: 'failed'
            })
            .eq('id', sub.id)
        }
      }
    })

    await Promise.allSettled(sendPromises)

    return { success: sent > 0, sent, failed, errors }
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
        status: 'pending'
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
      .select('*')
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
      .select('*')
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
}

// Export singleton instance
export const pushService = new PushNotificationService()
