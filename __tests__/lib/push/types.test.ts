/**
 * Tests for lib/push/types.ts
 * 
 * Tests type structures and ensures they match expected interfaces.
 */

import { describe, it, expect } from 'vitest'
import type {
  NotificationType,
  RecipientType,
  DeviceType,
  NotificationPayload,
  ReminderContext,
  CancellationContext,
  BroadcastContext,
  BarberNotificationSettings,
  CustomerNotificationSettings,
  PushSubscriptionRecord,
  SendNotificationResult,
} from '@/lib/push/types'

describe('Push Notification Types', () => {
  describe('NotificationType', () => {
    it('should accept valid notification types', () => {
      const validTypes: NotificationType[] = [
        'reminder',
        'cancellation',
        'booking_confirmed',
        'chat_message',
        'barber_broadcast',
        'admin_broadcast',
      ]
      
      expect(validTypes).toHaveLength(6)
      validTypes.forEach(type => {
        expect(typeof type).toBe('string')
      })
    })
  })

  describe('RecipientType', () => {
    it('should accept valid recipient types', () => {
      const validTypes: RecipientType[] = ['customer', 'barber']
      expect(validTypes).toHaveLength(2)
    })
  })

  describe('DeviceType', () => {
    it('should accept valid device types', () => {
      const validTypes: DeviceType[] = ['ios', 'android', 'desktop']
      expect(validTypes).toHaveLength(3)
    })
  })

  describe('NotificationPayload', () => {
    it('should have required fields', () => {
      const payload: NotificationPayload = {
        title: 'Test Title',
        body: 'Test Body',
      }
      
      expect(payload.title).toBeDefined()
      expect(payload.body).toBeDefined()
    })

    it('should accept optional fields', () => {
      const payload: NotificationPayload = {
        title: 'Test Title',
        body: 'Test Body',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-72x72.png',
        image: '/images/promo.jpg',
        tag: 'test-tag',
        url: '/my-appointments',
        requireInteraction: true,
        badgeCount: 1,
        data: { type: 'reminder', reservationId: 'test-id' },
        actions: [
          { action: 'view', title: 'צפה' },
          { action: 'dismiss', title: 'סגור' },
        ],
      }
      
      expect(payload.icon).toBeDefined()
      expect(payload.badge).toBeDefined()
      expect(payload.actions).toHaveLength(2)
    })
  })

  describe('ReminderContext', () => {
    it('should have all required fields', () => {
      const context: ReminderContext = {
        reservationId: 'test-reservation-id',
        customerId: 'test-customer-id',
        barberId: 'test-barber-id',
        customerName: 'דניאל',
        barberName: 'רמאל',
        serviceName: 'תספורת',
        appointmentTime: Date.now(),
      }
      
      expect(context.reservationId).toBeDefined()
      expect(context.customerId).toBeDefined()
      expect(context.barberId).toBeDefined()
      expect(context.customerName).toBeDefined()
      expect(context.barberName).toBeDefined()
      expect(context.serviceName).toBeDefined()
      expect(context.appointmentTime).toBeDefined()
    })
  })

  describe('CancellationContext', () => {
    it('should extend ReminderContext with cancelledBy', () => {
      const context: CancellationContext = {
        reservationId: 'test-reservation-id',
        customerId: 'test-customer-id',
        barberId: 'test-barber-id',
        customerName: 'דניאל',
        barberName: 'רמאל',
        serviceName: 'תספורת',
        appointmentTime: Date.now(),
        cancelledBy: 'customer',
      }
      
      expect(context.cancelledBy).toBe('customer')
    })

    it('should accept optional reason', () => {
      const context: CancellationContext = {
        reservationId: 'test-reservation-id',
        customerId: 'test-customer-id',
        barberId: 'test-barber-id',
        customerName: 'דניאל',
        barberName: 'רמאל',
        serviceName: 'תספורת',
        appointmentTime: Date.now(),
        cancelledBy: 'barber',
        reason: 'בעיה טכנית',
      }
      
      expect(context.reason).toBe('בעיה טכנית')
    })
  })

  describe('BroadcastContext', () => {
    it('should have required fields', () => {
      const context: BroadcastContext = {
        senderId: 'test-sender-id',
        senderName: 'רמאל',
        message: 'הודעה לכל הלקוחות',
      }
      
      expect(context.senderId).toBeDefined()
      expect(context.senderName).toBeDefined()
      expect(context.message).toBeDefined()
    })

    it('should accept optional targetCustomerIds', () => {
      const context: BroadcastContext = {
        senderId: 'test-sender-id',
        senderName: 'רמאל',
        message: 'הודעה',
        targetCustomerIds: ['id1', 'id2', 'id3'],
      }
      
      expect(context.targetCustomerIds).toHaveLength(3)
    })
  })

  describe('BarberNotificationSettings', () => {
    it('should have all settings fields', () => {
      const settings: BarberNotificationSettings = {
        id: 'test-id',
        barber_id: 'test-barber-id',
        reminder_hours_before: 3,
        notify_on_customer_cancel: true,
        notify_on_new_booking: true,
        broadcast_enabled: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      
      expect(settings.reminder_hours_before).toBe(3)
      expect(settings.notify_on_customer_cancel).toBe(true)
      expect(settings.notify_on_new_booking).toBe(true)
      expect(settings.broadcast_enabled).toBe(true)
    })
  })

  describe('CustomerNotificationSettings', () => {
    it('should have all settings fields', () => {
      const settings: CustomerNotificationSettings = {
        id: 'test-id',
        customer_id: 'test-customer-id',
        pwa_installed: true,
        notifications_enabled: true,
        reminder_enabled: true,
        cancellation_alerts_enabled: true,
        marketing_enabled: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      
      expect(settings.notifications_enabled).toBe(true)
      expect(settings.reminder_enabled).toBe(true)
      expect(settings.marketing_enabled).toBe(false)
    })
  })

  describe('PushSubscriptionRecord', () => {
    it('should have required fields', () => {
      const record: PushSubscriptionRecord = {
        id: 'test-id',
        customer_id: 'test-customer-id',
        barber_id: null,
        endpoint: 'https://fcm.googleapis.com/...',
        p256dh: 'key-data',
        auth: 'auth-data',
        device_type: 'ios',
        device_name: 'iPhone',
        user_agent: 'Mozilla/5.0...',
        is_active: true,
        consecutive_failures: 0,
        last_delivery_status: 'success',
        last_used: new Date().toISOString(),
        created_at: new Date().toISOString(),
      }
      
      expect(record.endpoint).toBeDefined()
      expect(record.p256dh).toBeDefined()
      expect(record.auth).toBeDefined()
      expect(record.is_active).toBe(true)
    })

    it('should enforce either customer_id OR barber_id', () => {
      // Customer subscription
      const customerSub: PushSubscriptionRecord = {
        id: 'test-id',
        customer_id: 'customer-123',
        barber_id: null,
        endpoint: 'https://...',
        p256dh: 'key',
        auth: 'auth',
        device_type: 'android',
        device_name: null,
        user_agent: null,
        is_active: true,
        consecutive_failures: 0,
        last_delivery_status: null,
        last_used: new Date().toISOString(),
        created_at: new Date().toISOString(),
      }
      expect(customerSub.customer_id).toBeDefined()
      expect(customerSub.barber_id).toBeNull()

      // Barber subscription
      const barberSub: PushSubscriptionRecord = {
        id: 'test-id',
        customer_id: null,
        barber_id: 'barber-456',
        endpoint: 'https://...',
        p256dh: 'key',
        auth: 'auth',
        device_type: 'desktop',
        device_name: 'Windows PC',
        user_agent: null,
        is_active: true,
        consecutive_failures: 0,
        last_delivery_status: null,
        last_used: new Date().toISOString(),
        created_at: new Date().toISOString(),
      }
      expect(barberSub.barber_id).toBeDefined()
      expect(barberSub.customer_id).toBeNull()
    })
  })

  describe('SendNotificationResult', () => {
    it('should have success and count fields', () => {
      const result: SendNotificationResult = {
        success: true,
        sent: 2,
        failed: 0,
        errors: [],
      }
      
      expect(result.success).toBe(true)
      expect(result.sent).toBe(2)
      expect(result.failed).toBe(0)
      expect(result.errors).toHaveLength(0)
    })

    it('should include errors on failure', () => {
      const result: SendNotificationResult = {
        success: false,
        sent: 0,
        failed: 2,
        errors: ['Subscription expired', 'Invalid endpoint'],
      }
      
      expect(result.success).toBe(false)
      expect(result.errors).toHaveLength(2)
    })

    it('should optionally include logId', () => {
      const result: SendNotificationResult = {
        success: true,
        sent: 1,
        failed: 0,
        errors: [],
        logId: 'log-uuid-123',
      }
      
      expect(result.logId).toBe('log-uuid-123')
    })
  })
})

