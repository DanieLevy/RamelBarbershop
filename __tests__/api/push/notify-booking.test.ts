/**
 * Tests for /api/push/notify-booking API route
 * 
 * These tests verify the booking notification API endpoint
 * validates input correctly and handles various scenarios.
 */

/* eslint-disable @typescript-eslint/no-unused-vars */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/push/notify-booking/route'

// Mock the push service
vi.mock('@/lib/push/push-service', () => ({
  pushService: {
    sendBookingConfirmed: vi.fn().mockResolvedValue({
      success: true,
      sent: 1,
      failed: 0,
      errors: [],
    }),
  },
}))

// Mock push auth to always succeed (auth is tested separately)
vi.mock('@/lib/auth/push-api-auth', () => ({
  verifyPushCallerOrInternal: vi.fn().mockResolvedValue({
    success: true,
    internal: true,
  }),
}))

// Test data
const VALID_UUID = '550e8400-e29b-41d4-a716-446655440001'
const CUSTOMER_UUID = 'd2f078fd-c497-40f5-824d-7fe0ef4b2d25'
const RESERVATION_UUID = 'aaa6c9d5-eebe-4e8b-b55d-5f500a4163ea'

const validPayload = {
  reservationId: RESERVATION_UUID,
  customerId: CUSTOMER_UUID,
  barberId: VALID_UUID,
  customerName: 'דניאל לוי',
  barberName: 'רם אל לאוסאני',
  serviceName: 'תספורת גבר',
  appointmentTime: Date.now() + 86400000,
}

const createRequest = (body: object): NextRequest => {
  return new NextRequest('http://localhost:3000/api/push/notify-booking', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

describe('/api/push/notify-booking', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Input Validation', () => {
    it('should reject request without reservationId', async () => {
      const { reservationId: _reservationId, ...payload } = validPayload
      const request = createRequest(payload)
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid request')
      expect(data.message).toContain('reservationId')
    })

    it('should reject request without barberId', async () => {
      const { barberId: _barberId, ...payload } = validPayload
      const request = createRequest(payload)
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid request')
      expect(data.message).toContain('barberId')
    })

    it('should reject request without customerName', async () => {
      const { customerName: _customerName, ...payload } = validPayload
      const request = createRequest(payload)
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid request')
      expect(data.message).toContain('customerName')
    })

    it('should reject request without serviceName', async () => {
      const { serviceName: _serviceName, ...payload } = validPayload
      const request = createRequest(payload)
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid request')
      expect(data.message).toContain('serviceName')
    })

    it('should reject request without appointmentTime', async () => {
      const { appointmentTime: _appointmentTime, ...payload } = validPayload
      const request = createRequest(payload)
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid request')
      expect(data.message).toContain('appointmentTime')
    })

    it('should reject invalid reservationId UUID format', async () => {
      const payload = { ...validPayload, reservationId: 'not-a-uuid' }
      const request = createRequest(payload)
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid request')
      expect(data.message).toContain('reservationId')
      expect(data.message).toContain('UUID')
    })

    it('should reject invalid barberId UUID format', async () => {
      const payload = { ...validPayload, barberId: 'invalid' }
      const request = createRequest(payload)
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid request')
      expect(data.message).toContain('barberId')
      expect(data.message).toContain('UUID')
    })

    it('should reject invalid customerId UUID format when provided', async () => {
      const payload = { ...validPayload, customerId: 'bad-id' }
      const request = createRequest(payload)
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid request')
      expect(data.message).toContain('customerId')
      expect(data.message).toContain('UUID')
    })

    it('should accept request without customerId (customerId is optional in schema)', async () => {
      const { customerId: _customerId, ...payload } = validPayload
      const request = createRequest(payload)
      
      const response = await POST(request)
      const data = await response.json()
      
      // In NotifyBookingSchema, customerId is optional
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })
  })

  describe('Successful Notification', () => {
    it('should return success response for valid payload', async () => {
      const request = createRequest(validPayload)
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.sent).toBe(1)
      expect(data.failed).toBe(0)
    })

    it('should call pushService.sendBookingConfirmed with correct context', async () => {
      const { pushService } = await import('@/lib/push/push-service')
      
      const request = createRequest(validPayload)
      await POST(request)
      
      expect(pushService.sendBookingConfirmed).toHaveBeenCalledWith(
        expect.objectContaining({
          reservationId: validPayload.reservationId,
          barberId: validPayload.barberId,
          customerName: validPayload.customerName,
        })
      )
    })
  })

  describe('Error Handling', () => {
    it('should handle invalid JSON gracefully', async () => {
      const request = new NextRequest('http://localhost:3000/api/push/notify-booking', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: 'invalid json',
      })
      
      const response = await POST(request)
      const data = await response.json()
      
      // validateRequestBody catches JSON parse errors and returns 400
      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid JSON body')
    })
  })

  describe('Missing Multiple Fields', () => {
    it('should report all missing required fields at once', async () => {
      const request = createRequest({})
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid request')
      expect(data.message).toContain('reservationId')
      expect(data.message).toContain('barberId')
      expect(data.message).toContain('customerName')
      expect(data.message).toContain('serviceName')
      expect(data.message).toContain('appointmentTime')
    })
  })
})
