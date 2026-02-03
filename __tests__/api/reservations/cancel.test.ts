/**
 * Reservation Cancel API Route Tests
 * 
 * Tests for POST /api/reservations/cancel
 * All tests are READ-ONLY - use mocked Supabase responses.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Track mock return values
let mockQueryResult = { data: [{ id: 'res-id', status: 'cancelled', version: 2 }], error: null }

// Create chainable query builder mock
const createQueryBuilder = () => {
  const builder: Record<string, unknown> = {}
  builder.eq = vi.fn().mockReturnValue(builder)
  builder.select = vi.fn().mockImplementation(() => Promise.resolve(mockQueryResult))
  return builder
}

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn(() => ({
      update: vi.fn(() => createQueryBuilder()),
    })),
  })),
}))

describe('POST /api/reservations/cancel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset to success result
    mockQueryResult = { data: [{ id: 'res-id', status: 'cancelled', version: 2 }], error: null }
  })

  it('should validate reservationId format', async () => {
    const { POST } = await import('@/app/api/reservations/cancel/route')
    
    const request = new NextRequest('http://localhost/api/reservations/cancel', {
      method: 'POST',
      body: JSON.stringify({
        reservationId: 'invalid-uuid',
        cancelledBy: 'customer',
      }),
    })
    
    const response = await POST(request)
    const data = await response.json()
    
    expect(response.status).toBe(400)
    expect(data.success).toBe(false)
    expect(data.error).toContain('מזהה תור לא תקין')
  })

  it('should validate cancelledBy field', async () => {
    const { POST } = await import('@/app/api/reservations/cancel/route')
    
    const request = new NextRequest('http://localhost/api/reservations/cancel', {
      method: 'POST',
      body: JSON.stringify({
        reservationId: '123e4567-e89b-12d3-a456-426614174000',
        cancelledBy: 'invalid-type',
      }),
    })
    
    const response = await POST(request)
    const data = await response.json()
    
    expect(response.status).toBe(400)
    expect(data.success).toBe(false)
    expect(data.error).toContain('סוג מבטל לא תקין')
  })

  it('should accept valid customer cancellation', async () => {
    const { POST } = await import('@/app/api/reservations/cancel/route')
    
    const request = new NextRequest('http://localhost/api/reservations/cancel', {
      method: 'POST',
      body: JSON.stringify({
        reservationId: '123e4567-e89b-12d3-a456-426614174000',
        cancelledBy: 'customer',
      }),
    })
    
    const response = await POST(request)
    const data = await response.json()
    
    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.reservation).toBeDefined()
  })

  it('should accept valid barber cancellation', async () => {
    const { POST } = await import('@/app/api/reservations/cancel/route')
    
    const request = new NextRequest('http://localhost/api/reservations/cancel', {
      method: 'POST',
      body: JSON.stringify({
        reservationId: '123e4567-e89b-12d3-a456-426614174000',
        cancelledBy: 'barber',
        reason: 'מספרה סגורה',
      }),
    })
    
    const response = await POST(request)
    const data = await response.json()
    
    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
  })

  it('should accept system cancellation', async () => {
    const { POST } = await import('@/app/api/reservations/cancel/route')
    
    const request = new NextRequest('http://localhost/api/reservations/cancel', {
      method: 'POST',
      body: JSON.stringify({
        reservationId: '123e4567-e89b-12d3-a456-426614174000',
        cancelledBy: 'system',
        reason: 'Automatic cleanup',
      }),
    })
    
    const response = await POST(request)
    const data = await response.json()
    
    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
  })

  it('should support optimistic locking with expectedVersion', async () => {
    const { POST } = await import('@/app/api/reservations/cancel/route')
    
    const request = new NextRequest('http://localhost/api/reservations/cancel', {
      method: 'POST',
      body: JSON.stringify({
        reservationId: '123e4567-e89b-12d3-a456-426614174000',
        cancelledBy: 'customer',
        expectedVersion: 1,
      }),
    })
    
    const response = await POST(request)
    const data = await response.json()
    
    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
  })

  it('should return 409 on concurrent modification', async () => {
    // Empty data means no rows were updated (version mismatch)
    mockQueryResult = { data: [], error: null }
    
    const { POST } = await import('@/app/api/reservations/cancel/route')
    
    const request = new NextRequest('http://localhost/api/reservations/cancel', {
      method: 'POST',
      body: JSON.stringify({
        reservationId: '123e4567-e89b-12d3-a456-426614174000',
        cancelledBy: 'customer',
        expectedVersion: 1,
      }),
    })
    
    const response = await POST(request)
    const data = await response.json()
    
    expect(response.status).toBe(409)
    expect(data.success).toBe(false)
    expect(data.concurrencyConflict).toBe(true)
  })
})
