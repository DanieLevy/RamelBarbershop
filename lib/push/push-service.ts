/**
 * Server-Side Push Notification Service
 * 
 * This service handles sending push notifications to users via web-push.
 * It integrates with Supabase for subscription management.
 */

import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'
import type {
  NotificationPayload,
  SendNotificationResult,
  SaveSubscriptionData,
  PushSubscriptionRecord,
  DeviceType,
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

  /**
   * Send a notification to specific customers
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
   * Send a notification to specific barbers
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

  /**
   * Save a push subscription to the database
   */
  async saveSubscription(data: SaveSubscriptionData): Promise<{ subscriptionId: string | null; error?: string }> {
    try {
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
      // Try to extract device model
      const match = userAgent.match(/\(Linux;[^)]*;\s*([^)]+)\)/)
      if (match && match[1]) {
        const model = match[1].split(' Build')[0].trim()
        if (model && model !== 'Android') return model
      }
      return 'מכשיר אנדרואיד'
    }
    
    // Desktop
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

