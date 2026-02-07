/**
 * Tests for /api/barber/services API route
 * 
 * Comprehensive tests for barber service CRUD operations,
 * including auth verification, Zod validation, ownership checks,
 * and database operations.
 */

/* eslint-disable @typescript-eslint/no-unused-vars */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ============================================================
// Constants
// ============================================================

const VALID_BARBER_UUID = '550e8400-e29b-41d4-a716-446655440001'
const VALID_BARBER_UUID_2 = '660e8400-e29b-41d4-a716-446655440002'
const VALID_SERVICE_UUID = 'aaa6c9d5-eebe-4e8b-b55d-5f500a4163ea'

const mockBarber = {
  id: VALID_BARBER_UUID,
  username: 'ramel',
  fullname: 'Ramel Test',
  email: 'ramel@test.com',
  role: 'barber',
  is_barber: true,
  is_active: true,
}

const mockAdminBarber = {
  ...mockBarber,
  role: 'admin',
}

// ============================================================
// Mocks
// ============================================================

// Mock barber auth
let mockAuthResult: { success: boolean; barber?: typeof mockBarber; response?: Response } = {
  success: true,
  barber: mockBarber,
}

vi.mock('@/lib/auth/barber-api-auth', () => ({
  verifyBarber: vi.fn(() => Promise.resolve(mockAuthResult)),
  verifyOwnership: vi.fn((barber, ownerId) => {
    if (barber.role === 'admin') return true
    return barber.id === ownerId
  }),
}))

// Mock admin client with chainable methods
let mockInsertResult: { data: unknown; error: unknown } = { data: { id: VALID_SERVICE_UUID }, error: null }
let mockUpdateResult: { data: unknown; error: unknown } = { data: [{ id: VALID_SERVICE_UUID }], error: null }
let mockDeleteResult: { error: unknown } = { error: null }
let mockSelectResult: { data: unknown; error: unknown } = { data: { barber_id: VALID_BARBER_UUID }, error: null }

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve(mockInsertResult)),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => Promise.resolve(mockUpdateResult)),
        })),
      })),
      delete: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve(mockDeleteResult)),
        })),
      })),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(() => Promise.resolve(mockSelectResult)),
        })),
      })),
    })),
  })),
}))

// Mock bug reporter
vi.mock('@/lib/bug-reporter/helpers', () => ({
  reportApiError: vi.fn(),
}))

// ============================================================
// Imports (after mocks)
// ============================================================

import { POST, PUT, DELETE } from '@/app/api/barber/services/route'

// ============================================================
// Helpers
// ============================================================

const createPostRequest = (body: object): NextRequest => {
  return new NextRequest('http://localhost:3000/api/barber/services', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const createPutRequest = (body: object): NextRequest => {
  return new NextRequest('http://localhost:3000/api/barber/services', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const createDeleteRequest = (body: object): NextRequest => {
  return new NextRequest('http://localhost:3000/api/barber/services', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const validServicePayload = {
  barberId: VALID_BARBER_UUID,
  name_he: 'תספורת גבר',
  duration: 30,
  price: 80,
}

// ============================================================
// Tests
// ============================================================

describe('/api/barber/services', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthResult = { success: true, barber: mockBarber }
    mockInsertResult = { data: { id: VALID_SERVICE_UUID, ...validServicePayload }, error: null }
    mockUpdateResult = { data: [{ id: VALID_SERVICE_UUID }], error: null }
    mockDeleteResult = { error: null }
    mockSelectResult = { data: { barber_id: VALID_BARBER_UUID }, error: null }
  })

  // ============================================================
  // Authentication Tests
  // ============================================================

  describe('Authentication', () => {
    it('should reject POST when auth fails', async () => {
      mockAuthResult = {
        success: false,
        response: new Response(JSON.stringify({ error: 'UNAUTHORIZED' }), { status: 401 }),
      }

      const request = createPostRequest(validServicePayload)
      const response = await POST(request)

      expect(response.status).toBe(401)
    })

    it('should reject PUT when auth fails', async () => {
      mockAuthResult = {
        success: false,
        response: new Response(JSON.stringify({ error: 'UNAUTHORIZED' }), { status: 401 }),
      }

      const request = createPutRequest({ ...validServicePayload, serviceId: VALID_SERVICE_UUID })
      const response = await PUT(request)

      expect(response.status).toBe(401)
    })

    it('should reject DELETE when auth fails', async () => {
      mockAuthResult = {
        success: false,
        response: new Response(JSON.stringify({ error: 'UNAUTHORIZED' }), { status: 401 }),
      }

      const request = createDeleteRequest({ barberId: VALID_BARBER_UUID, serviceId: VALID_SERVICE_UUID })
      const response = await DELETE(request)

      expect(response.status).toBe(401)
    })
  })

  // ============================================================
  // POST (Create) Tests
  // ============================================================

  describe('POST - Create Service', () => {
    it('should create a service with valid payload', async () => {
      const request = createPostRequest(validServicePayload)
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toBeDefined()
    })

    it('should reject missing name_he', async () => {
      const { name_he, ...payload } = validServicePayload
      const request = createPostRequest(payload)
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('VALIDATION_ERROR')
    })

    it('should reject negative price', async () => {
      const request = createPostRequest({ ...validServicePayload, price: -10 })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('VALIDATION_ERROR')
    })

    it('should reject duration less than 5 minutes', async () => {
      const request = createPostRequest({ ...validServicePayload, duration: 2 })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('VALIDATION_ERROR')
    })

    it('should reject invalid barberId UUID', async () => {
      const request = createPostRequest({ ...validServicePayload, barberId: 'not-uuid' })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('VALIDATION_ERROR')
    })

    it('should handle database error on create', async () => {
      mockInsertResult = { data: null, error: { message: 'Unique constraint violation' } }

      const request = createPostRequest(validServicePayload)
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('DATABASE_ERROR')
    })

    it('should accept optional description', async () => {
      const request = createPostRequest({
        ...validServicePayload,
        description: 'תיאור שירות',
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })
  })

  // ============================================================
  // PUT (Update) Tests
  // ============================================================

  describe('PUT - Update Service', () => {
    const validUpdatePayload = {
      ...validServicePayload,
      serviceId: VALID_SERVICE_UUID,
    }

    it('should update a service with valid payload', async () => {
      const request = createPutRequest(validUpdatePayload)
      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should reject update without serviceId', async () => {
      const request = createPutRequest(validServicePayload)
      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('VALIDATION_ERROR')
    })

    it('should return 404 when service not found', async () => {
      mockSelectResult = { data: null, error: null }

      const request = createPutRequest(validUpdatePayload)
      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('NOT_FOUND')
    })

    it('should reject update by non-owner barber', async () => {
      // Service belongs to another barber
      mockSelectResult = { data: { barber_id: VALID_BARBER_UUID_2 }, error: null }

      const request = createPutRequest(validUpdatePayload)
      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toBe('FORBIDDEN')
    })
  })

  // ============================================================
  // DELETE Tests
  // ============================================================

  describe('DELETE - Delete Service', () => {
    const validDeletePayload = {
      barberId: VALID_BARBER_UUID,
      serviceId: VALID_SERVICE_UUID,
    }

    it('should delete a service with valid payload', async () => {
      const request = createDeleteRequest(validDeletePayload)
      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should reject delete without serviceId', async () => {
      const request = createDeleteRequest({ barberId: VALID_BARBER_UUID })
      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('VALIDATION_ERROR')
    })

    it('should reject delete by non-owner barber', async () => {
      mockSelectResult = { data: { barber_id: VALID_BARBER_UUID_2 }, error: null }

      const request = createDeleteRequest(validDeletePayload)
      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toBe('FORBIDDEN')
    })

    it('should handle database error on delete', async () => {
      mockDeleteResult = { error: { message: 'Foreign key constraint' } }

      const request = createDeleteRequest(validDeletePayload)
      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('DATABASE_ERROR')
    })
  })

  // ============================================================
  // Error Handling
  // ============================================================

  describe('Error Handling', () => {
    it('should handle invalid JSON body gracefully', async () => {
      const request = new NextRequest('http://localhost:3000/api/barber/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json',
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('UNKNOWN_ERROR')
    })
  })
})
