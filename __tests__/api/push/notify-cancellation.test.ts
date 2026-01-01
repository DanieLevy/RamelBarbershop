/**
 * Tests for /api/push/notify-cancellation API route
 * 
 * These tests verify the cancellation notification API endpoint
 * validates input correctly and handles various scenarios.
 */

/* eslint-disable @typescript-eslint/no-unused-vars */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/push/notify-cancellation/route'

// Mock the push service
vi.mock('@/lib/push/push-service', () => ({
  pushService: {
    sendCancellationAlert: vi.fn().mockResolvedValue({
      success: true,
      sent: 1,
      failed: 0,
      errors: [],
    }),
  },
}))

// Test data
const VALID_UUID = '550e8400-e29b-41d4-a716-446655440001'
const CUSTOMER_UUID = 'd2f078fd-c497-40f5-824d-7fe0ef4b2d25'
const RESERVATION_UUID = 'aaa6c9d5-eebe-4e8b-b55d-5f500a4163ea'

const validPayloadByCustomer = {
  reservationId: RESERVATION_UUID,
  customerId: CUSTOMER_UUID,
  barberId: VALID_UUID,
  cancelledBy: 'customer' as const,
  customerName: 'דניאל לוי',
  barberName: 'רמאל לאוסאני',
  serviceName: 'תספורת גבר',
  appointmentTime: Date.now() + 86400000,
}

const validPayloadByBarber = {
  reservationId: RESERVATION_UUID,
  customerId: CUSTOMER_UUID,
  barberId: VALID_UUID,
  cancelledBy: 'barber' as const,
  customerName: 'דניאל לוי',
  barberName: 'רמאל לאוסאני',
  serviceName: 'תספורת גבר',
  appointmentTime: Date.now() + 86400000,
  reason: 'בעיה טכנית',
}

const createRequest = (body: object): NextRequest => {
  return new NextRequest('http://localhost:3000/api/push/notify-cancellation', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

describe('/api/push/notify-cancellation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Input Validation', () => {
    it('should reject request without reservationId', async () => {
      const { reservationId: _reservationId, ...payload } = validPayloadByCustomer
      const request = createRequest(payload)
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid request')
      expect(data.message).toContain('reservationId')
    })

    it('should reject request without barberId', async () => {
      const { barberId: _barberId, ...payload } = validPayloadByCustomer
      const request = createRequest(payload)
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid request')
      expect(data.message).toContain('barberId')
    })

    it('should reject request without cancelledBy', async () => {
      const { cancelledBy: _cancelledBy, ...payload } = validPayloadByCustomer
      const request = createRequest(payload)
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid request')
      expect(data.message).toContain('cancelledBy')
    })

    it('should reject request without customerName', async () => {
      const { customerName: _customerName, ...payload } = validPayloadByCustomer
      const request = createRequest(payload)
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid request')
      expect(data.message).toContain('customerName')
    })

    it('should reject request without serviceName', async () => {
      const { serviceName: _serviceName, ...payload } = validPayloadByCustomer
      const request = createRequest(payload)
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid request')
      expect(data.message).toContain('serviceName')
    })

    it('should reject request without appointmentTime', async () => {
      const { appointmentTime: _appointmentTime, ...payload } = validPayloadByCustomer
      const request = createRequest(payload)
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid request')
      expect(data.message).toContain('appointmentTime')
    })

    it('should reject invalid cancelledBy value', async () => {
      const payload = { ...validPayloadByCustomer, cancelledBy: 'invalid' }
      const request = createRequest(payload)
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid request')
      expect(data.message).toContain('cancelledBy')
    })

    it('should reject invalid reservationId UUID format', async () => {
      const payload = { ...validPayloadByCustomer, reservationId: 'not-a-uuid' }
      const request = createRequest(payload)
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid request')
      expect(data.message).toContain('reservationId')
      expect(data.message).toContain('UUID')
    })

    it('should reject invalid barberId UUID format', async () => {
      const payload = { ...validPayloadByCustomer, barberId: 'invalid' }
      const request = createRequest(payload)
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid request')
      expect(data.message).toContain('barberId')
      expect(data.message).toContain('UUID')
    })
  })

  describe('Customer Cancellation (notify barber)', () => {
    it('should accept request without customerId when cancelled by customer', async () => {
      const { customerId: _customerId, ...payload } = validPayloadByCustomer
      const request = createRequest(payload)
      
      const response = await POST(request)
      const data = await response.json()
      
      // Should succeed because we're notifying the barber, not the customer
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should return success response for valid customer cancellation', async () => {
      const request = createRequest(validPayloadByCustomer)
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.sent).toBe(1)
    })

    it('should call sendCancellationAlert with customer context', async () => {
      const { pushService } = await import('@/lib/push/push-service')
      
      const request = createRequest(validPayloadByCustomer)
      await POST(request)
      
      expect(pushService.sendCancellationAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          cancelledBy: 'customer',
          barberId: validPayloadByCustomer.barberId,
        })
      )
    })
  })

  describe('Barber Cancellation (notify customer)', () => {
    it('should REQUIRE customerId when cancelled by barber', async () => {
      const { customerId: _customerId, ...payload } = validPayloadByBarber
      const request = createRequest(payload)
      
      const response = await POST(request)
      const data = await response.json()
      
      // Must fail because we need customer ID to notify them
      expect(response.status).toBe(400)
      expect(data.error).toContain('customerId required when barber cancels')
    })

    it('should reject invalid customerId when cancelled by barber', async () => {
      const payload = { ...validPayloadByBarber, customerId: 'invalid-uuid' }
      const request = createRequest(payload)
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid request')
      expect(data.message).toContain('customerId')
      expect(data.message).toContain('UUID')
    })

    it('should return success response for valid barber cancellation', async () => {
      const request = createRequest(validPayloadByBarber)
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.sent).toBe(1)
    })

    it('should include reason in context when provided', async () => {
      const { pushService } = await import('@/lib/push/push-service')
      
      const request = createRequest(validPayloadByBarber)
      await POST(request)
      
      expect(pushService.sendCancellationAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          cancelledBy: 'barber',
          customerId: validPayloadByBarber.customerId,
          reason: validPayloadByBarber.reason,
        })
      )
    })
  })

  describe('Error Handling', () => {
    it('should handle invalid JSON gracefully', async () => {
      const request = new NextRequest('http://localhost:3000/api/push/notify-cancellation', {
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
      // The validation details include field names in the message
      expect(data.message).toContain('reservationId')
      expect(data.message).toContain('barberId')
      expect(data.message).toContain('cancelledBy')
      expect(data.message).toContain('customerName')
      expect(data.message).toContain('serviceName')
      expect(data.message).toContain('appointmentTime')
    })
  })
})
