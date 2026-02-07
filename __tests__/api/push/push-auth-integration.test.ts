/**
 * Tests for push notification API route authentication integration
 * 
 * These tests verify that push API routes correctly reject
 * unauthenticated requests and accept authenticated ones.
 * Tests the auth guard integration, NOT the auth logic itself
 * (that's tested in push-api-auth.test.ts).
 */

/* eslint-disable @typescript-eslint/no-unused-vars */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

// ============================================================
// Constants
// ============================================================

const VALID_CUSTOMER_UUID = 'd2f078fd-c497-40f5-824d-7fe0ef4b2d25'
const VALID_BARBER_UUID = '550e8400-e29b-41d4-a716-446655440001'
const INTERNAL_SECRET = 'test-internal-secret-that-is-at-least-32-characters-long'

// ============================================================
// Mocks - set up controllable auth results
// ============================================================

let mockPushCallerResult: { success: boolean; response?: Response; userId?: string; userType?: string }
let mockPushCallerOrInternalResult: { success: boolean; response?: Response; internal?: boolean; userId?: string; userType?: string }
let mockInternalCallResult = false
let mockBarberAuthResult: { success: boolean; response?: Response; barber?: object }

vi.mock('@/lib/auth/push-api-auth', () => ({
  verifyPushCaller: vi.fn(() => Promise.resolve(mockPushCallerResult)),
  verifyPushCallerOrInternal: vi.fn(() => Promise.resolve(mockPushCallerOrInternalResult)),
  verifyInternalCall: vi.fn(() => mockInternalCallResult),
}))

vi.mock('@/lib/auth/barber-api-auth', () => ({
  verifyBarber: vi.fn(() => Promise.resolve(mockBarberAuthResult)),
}))

vi.mock('@/lib/push/push-service', () => ({
  pushService: {
    subscribe: vi.fn().mockResolvedValue({ id: 'sub-id', created_at: new Date().toISOString() }),
    saveSubscription: vi.fn().mockResolvedValue({ id: 'sub-id', created_at: new Date().toISOString() }),
    sendCustomNotification: vi.fn().mockResolvedValue({ success: true, sent: 1, failed: 0, errors: [] }),
    sendBookingConfirmed: vi.fn().mockResolvedValue({ success: true, sent: 1, failed: 0, errors: [] }),
    sendCancellationAlert: vi.fn().mockResolvedValue({ success: true, sent: 1, failed: 0, errors: [] }),
    markAllRead: vi.fn().mockResolvedValue(undefined),
    markAllAsRead: vi.fn().mockResolvedValue(true),
    getUnreadCount: vi.fn().mockResolvedValue(0),
    getCustomerSubscriptions: vi.fn().mockResolvedValue([]),
    getBarberSubscriptions: vi.fn().mockResolvedValue([]),
  },
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  })),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  })),
}))

vi.mock('@/lib/bug-reporter/helpers', () => ({
  reportApiError: vi.fn(),
}))

vi.mock('@/lib/validation/api-schemas', () => ({
  validateRequestBody: vi.fn().mockImplementation(async (request, _schema) => {
    try {
      const body = await request.json()
      return { success: true, data: body }
    } catch {
      return {
        success: false,
        response: new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 }),
      }
    }
  }),
  NotifyBookingSchema: {},
  NotifyCancellationSchema: {},
}))

// ============================================================
// Helpers
// ============================================================

const createUnauthedFailure = () => ({
  success: false,
  response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
})

const createAuthedSuccess = (type: 'customer' | 'barber' = 'customer') => ({
  success: true,
  userId: type === 'customer' ? VALID_CUSTOMER_UUID : VALID_BARBER_UUID,
  userType: type,
})

const createInternalSuccess = () => ({
  success: true,
  internal: true,
})

// ============================================================
// Tests
// ============================================================

describe('Push API Route Auth Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default to unauthed
    mockPushCallerResult = createUnauthedFailure()
    mockPushCallerOrInternalResult = createUnauthedFailure()
    mockInternalCallResult = false
    mockBarberAuthResult = createUnauthedFailure()
  })

  // ============================================================
  // /api/push/subscribe
  // ============================================================

  describe('/api/push/subscribe', () => {
    it('should reject unauthenticated subscribe request', async () => {
      const { POST } = await import('@/app/api/push/subscribe/route')

      const request = new NextRequest('http://localhost:3000/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: VALID_CUSTOMER_UUID,
          subscription: { endpoint: 'https://push.example.com', keys: { p256dh: 'key', auth: 'auth' } },
          deviceType: 'desktop',
        }),
      })

      const response = await POST(request)
      expect(response.status).toBe(401)
    })

    it('should accept authenticated subscribe request', async () => {
      mockPushCallerResult = createAuthedSuccess('customer')

      const { POST } = await import('@/app/api/push/subscribe/route')

      const request = new NextRequest('http://localhost:3000/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: VALID_CUSTOMER_UUID,
          subscription: { endpoint: 'https://push.example.com', keys: { p256dh: 'key', auth: 'auth' } },
          deviceType: 'desktop',
        }),
      })

      const response = await POST(request)
      expect(response.status).toBe(200)
    })
  })

  // ============================================================
  // /api/push/send (barber only)
  // ============================================================

  describe('/api/push/send', () => {
    it('should reject unauthenticated send request', async () => {
      const { POST } = await import('@/app/api/push/send/route')

      const request = new NextRequest('http://localhost:3000/api/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          barberId: VALID_BARBER_UUID,
          customerId: VALID_CUSTOMER_UUID,
          title: 'Test',
          body: 'Test notification',
        }),
      })

      const response = await POST(request)
      expect(response.status).toBe(401)
    })

    it('should accept authenticated barber send request', async () => {
      mockBarberAuthResult = {
        success: true,
        barber: {
          id: VALID_BARBER_UUID,
          username: 'test',
          fullname: 'Test',
          email: null,
          role: 'barber',
          is_barber: true,
          is_active: true,
        },
      }

      const { POST } = await import('@/app/api/push/send/route')

      const request = new NextRequest('http://localhost:3000/api/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          barberId: VALID_BARBER_UUID,
          customerId: VALID_CUSTOMER_UUID,
          title: 'Test',
          body: 'Test notification',
        }),
      })

      const response = await POST(request)
      // Should not be 401/403
      expect(response.status).not.toBe(401)
      expect(response.status).not.toBe(403)
    })
  })

  // ============================================================
  // /api/push/notify-blocked-attempt (internal only)
  // ============================================================

  describe('/api/push/notify-blocked-attempt', () => {
    it('should reject non-internal calls', async () => {
      mockInternalCallResult = false

      const { POST } = await import('@/app/api/push/notify-blocked-attempt/route')

      const request = new NextRequest('http://localhost:3000/api/push/notify-blocked-attempt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          barberId: VALID_BARBER_UUID,
          customerName: 'Test Customer',
          customerPhone: '0501234567',
        }),
      })

      const response = await POST(request)
      expect(response.status).toBe(401)
      const data = await response.json()
      expect(data.error).toContain('internal access only')
    })

    it('should accept internal calls', async () => {
      mockInternalCallResult = true

      const { POST } = await import('@/app/api/push/notify-blocked-attempt/route')

      const request = new NextRequest('http://localhost:3000/api/push/notify-blocked-attempt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Secret': INTERNAL_SECRET,
        },
        body: JSON.stringify({
          barberId: VALID_BARBER_UUID,
          customerName: 'Test Customer',
          customerPhone: '0501234567',
        }),
      })

      const response = await POST(request)
      // Should not be 401
      expect(response.status).not.toBe(401)
    })
  })

  // ============================================================
  // /api/push/mark-read
  // ============================================================

  describe('/api/push/mark-read', () => {
    it('should reject unauthenticated mark-read request', async () => {
      const { POST } = await import('@/app/api/push/mark-read/route')

      const request = new NextRequest('http://localhost:3000/api/push/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: VALID_CUSTOMER_UUID,
          markAll: true,
        }),
      })

      const response = await POST(request)
      expect(response.status).toBe(401)
    })

    it('should accept authenticated mark-read request', async () => {
      mockPushCallerResult = createAuthedSuccess('customer')

      const { POST } = await import('@/app/api/push/mark-read/route')

      const request = new NextRequest('http://localhost:3000/api/push/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: VALID_CUSTOMER_UUID,
          markAll: true,
        }),
      })

      const response = await POST(request)
      expect(response.status).toBe(200)
    })
  })

  // ============================================================
  // /api/push/request-cancel
  // ============================================================

  describe('/api/push/request-cancel', () => {
    it('should reject unauthenticated request-cancel', async () => {
      const { POST } = await import('@/app/api/push/request-cancel/route')

      const request = new NextRequest('http://localhost:3000/api/push/request-cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reservationId: 'aaa6c9d5-eebe-4e8b-b55d-5f500a4163ea',
          barberId: VALID_BARBER_UUID,
          customerId: VALID_CUSTOMER_UUID,
          customerName: 'Test',
          appointmentTime: Date.now() + 86400000,
        }),
      })

      const response = await POST(request)
      expect(response.status).toBe(401)
    })
  })
})
