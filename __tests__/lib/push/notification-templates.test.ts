/**
 * Tests for lib/push/notification-templates.ts
 * 
 * Tests notification template generation for all notification types.
 */

import { describe, it, expect } from 'vitest'
import { getNotificationTemplate } from '@/lib/push/notification-templates'
import type { ReminderContext, CancellationContext, BroadcastContext } from '@/lib/push/types'

// Test data
const VALID_UUID = '550e8400-e29b-41d4-a716-446655440001'
const CUSTOMER_UUID = 'd2f078fd-c497-40f5-824d-7fe0ef4b2d25'
const RESERVATION_UUID = 'aaa6c9d5-eebe-4e8b-b55d-5f500a4163ea'

describe('Notification Templates', () => {
  describe('getNotificationTemplate', () => {
    describe('reminder notification', () => {
      const reminderContext: ReminderContext = {
        reservationId: RESERVATION_UUID,
        customerId: CUSTOMER_UUID,
        barberId: VALID_UUID,
        customerName: 'דניאל לוי',
        barberName: 'רם אל לאוסאני',
        serviceName: 'תספורת גבר',
        appointmentTime: Date.now() + 3600000,
      }

      it('should generate reminder template with correct title', () => {
        const template = getNotificationTemplate('reminder', reminderContext)
        expect(template.title).toContain('תזכורת')
      })

      it('should include barber name in body', () => {
        const template = getNotificationTemplate('reminder', reminderContext)
        expect(template.body).toContain(reminderContext.barberName)
      })

      it('should include service name in body', () => {
        const template = getNotificationTemplate('reminder', reminderContext)
        expect(template.body).toContain(reminderContext.serviceName)
      })

      it('should have proper icon and badge paths', () => {
        const template = getNotificationTemplate('reminder', reminderContext)
        expect(template.icon).toContain('/icons/')
        expect(template.badge).toContain('/icons/')
      })

      it('should include reservation ID in tag', () => {
        const template = getNotificationTemplate('reminder', reminderContext)
        expect(template.tag).toContain(reminderContext.reservationId)
      })

      it('should have deep link URL with highlight parameter', () => {
        const template = getNotificationTemplate('reminder', reminderContext)
        expect(template.url).toContain('/my-appointments')
        expect(template.url).toContain(`highlight=${reminderContext.reservationId}`)
      })

      it('should set requireInteraction to true', () => {
        const template = getNotificationTemplate('reminder', reminderContext)
        expect(template.requireInteraction).toBe(true)
      })

      it('should include data with type and reservationId', () => {
        const template = getNotificationTemplate('reminder', reminderContext)
        expect(template.data?.type).toBe('reminder')
        expect(template.data?.reservationId).toBe(reminderContext.reservationId)
      })

      it('should have view and dismiss actions', () => {
        const template = getNotificationTemplate('reminder', reminderContext)
        expect(template.actions).toHaveLength(2)
        expect(template.actions?.some(a => a.action === 'view')).toBe(true)
        expect(template.actions?.some(a => a.action === 'dismiss')).toBe(true)
      })
    })

    describe('cancellation notification - by customer', () => {
      const cancellationByCustomer: CancellationContext = {
        reservationId: RESERVATION_UUID,
        customerId: CUSTOMER_UUID,
        barberId: VALID_UUID,
        cancelledBy: 'customer',
        customerName: 'דניאל לוי',
        barberName: 'רם אל לאוסאני',
        serviceName: 'תספורת גבר',
        appointmentTime: Date.now() + 3600000,
        reason: 'שינוי תכניות',
      }

      it('should generate cancellation template for barber', () => {
        const template = getNotificationTemplate('cancellation', cancellationByCustomer)
        expect(template.title).toContain('בוטל')
      })

      it('should include customer name when cancelled by customer', () => {
        const template = getNotificationTemplate('cancellation', cancellationByCustomer)
        expect(template.body).toContain(cancellationByCustomer.customerName)
      })

      it('should direct to barber dashboard', () => {
        const template = getNotificationTemplate('cancellation', cancellationByCustomer)
        expect(template.url).toContain('/barber/dashboard')
      })

      it('should include data with cancelledBy', () => {
        const template = getNotificationTemplate('cancellation', cancellationByCustomer)
        expect(template.data?.cancelledBy).toBe('customer')
      })
    })

    describe('cancellation notification - by barber', () => {
      const cancellationByBarber: CancellationContext = {
        reservationId: RESERVATION_UUID,
        customerId: CUSTOMER_UUID,
        barberId: VALID_UUID,
        cancelledBy: 'barber',
        customerName: 'דניאל לוי',
        barberName: 'רם אל לאוסאני',
        serviceName: 'תספורת גבר',
        appointmentTime: Date.now() + 3600000,
      }

      it('should generate cancellation template for customer', () => {
        const template = getNotificationTemplate('cancellation', cancellationByBarber)
        expect(template.title).toContain('בוטל')
      })

      it('should include barber name when cancelled by barber', () => {
        const template = getNotificationTemplate('cancellation', cancellationByBarber)
        expect(template.body).toContain(cancellationByBarber.barberName)
      })

      it('should direct to my-appointments with deep link', () => {
        const template = getNotificationTemplate('cancellation', cancellationByBarber)
        expect(template.url).toContain('/my-appointments')
        expect(template.url).toContain('highlight=')
      })

      it('should include rebook action', () => {
        const template = getNotificationTemplate('cancellation', cancellationByBarber)
        expect(template.actions?.some(a => a.action === 'rebook')).toBe(true)
      })

      it('should include data with cancelledBy barber', () => {
        const template = getNotificationTemplate('cancellation', cancellationByBarber)
        expect(template.data?.cancelledBy).toBe('barber')
      })
    })

    describe('booking_confirmed notification', () => {
      const bookingContext: ReminderContext = {
        reservationId: RESERVATION_UUID,
        customerId: CUSTOMER_UUID,
        barberId: VALID_UUID,
        customerName: 'דניאל לוי',
        barberName: 'רם אל לאוסאני',
        serviceName: 'תספורת גבר',
        appointmentTime: Date.now() + 86400000,
      }

      it('should generate booking confirmed template', () => {
        const template = getNotificationTemplate('booking_confirmed', bookingContext)
        expect(template.title).toContain('תור חדש')
      })

      it('should include customer name', () => {
        const template = getNotificationTemplate('booking_confirmed', bookingContext)
        expect(template.body).toContain(bookingContext.customerName)
      })

      it('should direct to barber reservations', () => {
        const template = getNotificationTemplate('booking_confirmed', bookingContext)
        expect(template.url).toContain('/barber/dashboard/reservations')
      })

      it('should have booking_confirmed type in data', () => {
        const template = getNotificationTemplate('booking_confirmed', bookingContext)
        expect(template.data?.type).toBe('booking_confirmed')
      })
    })

    describe('chat_message notification', () => {
      const chatContext = {
        senderName: 'רם אל לאוסאני',
        message: 'היי, האם אתה זמין לתספורת מחר?',
      }

      it('should generate chat message template', () => {
        const template = getNotificationTemplate('chat_message', chatContext)
        expect(template.title).toContain('הודעה')
        expect(template.title).toContain(chatContext.senderName)
      })

      it('should include message in body', () => {
        const template = getNotificationTemplate('chat_message', chatContext)
        expect(template.body).toContain(chatContext.message)
      })

      it('should truncate long messages', () => {
        const longMessage = 'א'.repeat(150)
        const template = getNotificationTemplate('chat_message', {
          senderName: 'Test',
          message: longMessage,
        })
        expect(template.body.length).toBeLessThanOrEqual(103) // 100 + '...'
      })
    })

    describe('barber_broadcast notification', () => {
      const broadcastContext: BroadcastContext = {
        senderId: VALID_UUID,
        senderName: 'רם אל לאוסאני',
        message: 'שינוי בשעות הפעילות השבוע',
      }

      it('should generate barber broadcast template', () => {
        const template = getNotificationTemplate('barber_broadcast', broadcastContext)
        expect(template.title).toContain('הודעה')
        expect(template.title).toContain(broadcastContext.senderName)
      })

      it('should include message in body', () => {
        const template = getNotificationTemplate('barber_broadcast', broadcastContext)
        expect(template.body).toBe(broadcastContext.message)
      })

      it('should have barber_broadcast type in data', () => {
        const template = getNotificationTemplate('barber_broadcast', broadcastContext)
        expect(template.data?.type).toBe('barber_broadcast')
        expect(template.data?.senderId).toBe(broadcastContext.senderId)
      })
    })

    describe('admin_broadcast notification', () => {
      const adminBroadcastContext: BroadcastContext = {
        senderId: VALID_UUID,
        senderName: 'מנהל',
        message: 'שנה טובה לכל הלקוחות שלנו!',
      }

      it('should generate admin broadcast template', () => {
        const template = getNotificationTemplate('admin_broadcast', adminBroadcastContext)
        expect(template.title).toContain('רם אל')
      })

      it('should include message in body', () => {
        const template = getNotificationTemplate('admin_broadcast', adminBroadcastContext)
        expect(template.body).toBe(adminBroadcastContext.message)
      })

      it('should have admin_broadcast type in data', () => {
        const template = getNotificationTemplate('admin_broadcast', adminBroadcastContext)
        expect(template.data?.type).toBe('admin_broadcast')
      })
    })

    describe('default/unknown notification', () => {
      it('should return default template for unknown type', () => {
        const template = getNotificationTemplate('unknown' as never, {})
        expect(template.title).toBeDefined()
        expect(template.body).toBeDefined()
        expect(template.url).toBe('/')
      })
    })
  })

  describe('Template Structure', () => {
    const reminderContext: ReminderContext = {
      reservationId: RESERVATION_UUID,
      customerId: CUSTOMER_UUID,
      barberId: VALID_UUID,
      customerName: 'Test',
      barberName: 'Barber',
      serviceName: 'Service',
      appointmentTime: Date.now(),
    }
    
    const broadcastContext: BroadcastContext = {
      senderId: VALID_UUID,
      senderName: 'Test Sender',
      message: 'Test message',
    }

    it('reminder template should have required fields', () => {
      const template = getNotificationTemplate('reminder', reminderContext)
      expect(template.title).toBeDefined()
      expect(template.title.length).toBeGreaterThan(0)
      expect(template.body).toBeDefined()
      expect(template.icon).toBeDefined()
      expect(template.url).toBeDefined()
    })

    it('cancellation template should have required fields', () => {
      const template = getNotificationTemplate('cancellation', { 
        ...reminderContext, 
        cancelledBy: 'customer' as const 
      })
      expect(template.title).toBeDefined()
      expect(template.body).toBeDefined()
      expect(template.icon).toBeDefined()
      expect(template.url).toBeDefined()
    })

    it('booking_confirmed template should have required fields', () => {
      const template = getNotificationTemplate('booking_confirmed', reminderContext)
      expect(template.title).toBeDefined()
      expect(template.body).toBeDefined()
      expect(template.icon).toBeDefined()
      expect(template.url).toBeDefined()
    })

    it('barber_broadcast template should have required fields', () => {
      const template = getNotificationTemplate('barber_broadcast', broadcastContext)
      expect(template.title).toBeDefined()
      expect(template.body).toBeDefined()
      expect(template.icon).toBeDefined()
      expect(template.url).toBeDefined()
    })

    it('admin_broadcast template should have required fields', () => {
      const template = getNotificationTemplate('admin_broadcast', broadcastContext)
      expect(template.title).toBeDefined()
      expect(template.body).toBeDefined()
      expect(template.icon).toBeDefined()
      expect(template.url).toBeDefined()
    })
  })
})

