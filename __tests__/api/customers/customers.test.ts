/**
 * Customer API Routes Tests
 * 
 * Tests for customer-related API routes.
 * All tests are READ-ONLY - use mocked Supabase responses.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock Supabase admin client
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
          single: vi.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ 
            data: { id: 'new-customer-id', phone: '0501234567', fullname: 'Test User' },
            error: null 
          })),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ 
              data: { id: 'customer-id', phone: '0501234567', fullname: 'Updated User' },
              error: null 
            })),
          })),
        })),
      })),
    })),
  })),
}))

// Mock bug reporter
vi.mock('@/lib/bug-reporter/helpers', () => ({
  reportServerError: vi.fn(),
}))

describe('Customer API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('POST /api/customers/get-or-create', () => {
    it('should validate required fields', async () => {
      const { POST } = await import('@/app/api/customers/get-or-create/route')
      
      const request = new NextRequest('http://localhost/api/customers/get-or-create', {
        method: 'POST',
        body: JSON.stringify({}),
      })
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
    })

    it('should validate phone number length', async () => {
      const { POST } = await import('@/app/api/customers/get-or-create/route')
      
      const request = new NextRequest('http://localhost/api/customers/get-or-create', {
        method: 'POST',
        body: JSON.stringify({
          phone: '123', // Too short
          fullname: 'Test User',
        }),
      })
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
    })

    it('should validate fullname length', async () => {
      const { POST } = await import('@/app/api/customers/get-or-create/route')
      
      const request = new NextRequest('http://localhost/api/customers/get-or-create', {
        method: 'POST',
        body: JSON.stringify({
          phone: '0501234567',
          fullname: 'A', // Too short
        }),
      })
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
    })

    it('should accept valid request', async () => {
      const { POST } = await import('@/app/api/customers/get-or-create/route')
      
      const request = new NextRequest('http://localhost/api/customers/get-or-create', {
        method: 'POST',
        body: JSON.stringify({
          phone: '0501234567',
          fullname: 'Test User',
        }),
      })
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.customer).toBeDefined()
    })

    it('should accept optional providerUid', async () => {
      const { POST } = await import('@/app/api/customers/get-or-create/route')
      
      const request = new NextRequest('http://localhost/api/customers/get-or-create', {
        method: 'POST',
        body: JSON.stringify({
          phone: '0501234567',
          fullname: 'Test User',
          providerUid: 'o19-0501234567',
        }),
      })
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })
  })

  describe('POST /api/customers/update', () => {
    it('should validate customerId format', async () => {
      const { POST } = await import('@/app/api/customers/update/route')
      
      const request = new NextRequest('http://localhost/api/customers/update', {
        method: 'POST',
        body: JSON.stringify({
          customerId: 'invalid-uuid',
          fullname: 'New Name',
        }),
      })
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
    })

    it('should require at least one field to update', async () => {
      const { POST } = await import('@/app/api/customers/update/route')
      
      const request = new NextRequest('http://localhost/api/customers/update', {
        method: 'POST',
        body: JSON.stringify({
          customerId: '123e4567-e89b-12d3-a456-426614174000',
        }),
      })
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
    })

    it('should accept valid update request', async () => {
      const { POST } = await import('@/app/api/customers/update/route')
      
      const request = new NextRequest('http://localhost/api/customers/update', {
        method: 'POST',
        body: JSON.stringify({
          customerId: '123e4567-e89b-12d3-a456-426614174000',
          fullname: 'Updated Name',
        }),
      })
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should validate email format', async () => {
      const { POST } = await import('@/app/api/customers/update/route')
      
      const request = new NextRequest('http://localhost/api/customers/update', {
        method: 'POST',
        body: JSON.stringify({
          customerId: '123e4567-e89b-12d3-a456-426614174000',
          email: 'invalid-email',
        }),
      })
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
    })
  })

  describe('Notification Settings API', () => {
    it('should require customerId for GET request', async () => {
      const { GET } = await import('@/app/api/customers/notification-settings/route')
      
      const request = new NextRequest('http://localhost/api/customers/notification-settings')
      
      const response = await GET(request)
      const data = await response.json()
      
      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
    })

    it('should validate customerId format for POST request', async () => {
      const { POST } = await import('@/app/api/customers/notification-settings/route')
      
      const request = new NextRequest('http://localhost/api/customers/notification-settings', {
        method: 'POST',
        body: JSON.stringify({
          customerId: 'invalid-uuid',
          reminderEnabled: true,
        }),
      })
      
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
    })
  })
})
