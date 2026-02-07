/**
 * Tests for lib/auth/barber-api-auth.ts
 * 
 * Unit tests for barber authentication helpers used by
 * /api/barber/* API routes.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'

// ============================================================
// Mocks
// ============================================================

const VALID_BARBER_UUID = '550e8400-e29b-41d4-a716-446655440001'
const VALID_BARBER_UUID_2 = '660e8400-e29b-41d4-a716-446655440002'

const mockBarberData = {
  id: VALID_BARBER_UUID,
  username: 'ramel',
  fullname: 'Ramel Test',
  email: 'ramel@test.com',
  role: 'barber',
  is_barber: true,
  is_active: true,
}

const mockAdminData = {
  ...mockBarberData,
  role: 'admin',
}

let mockMaybeSingleResult: { data: unknown; error: unknown } = { data: mockBarberData, error: null }

const mockMaybeSingle = vi.fn(() => Promise.resolve(mockMaybeSingleResult))
const mockEqChain = vi.fn().mockReturnThis()
const mockSelect = vi.fn(() => ({
  eq: vi.fn(() => ({
    eq: vi.fn(() => ({
      maybeSingle: mockMaybeSingle,
    })),
  })),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: mockSelect,
    })),
  })),
}))

// ============================================================
// Tests
// ============================================================

import {
  extractBarberId,
  verifyBarber,
  verifyAdmin,
  verifyOwnership,
  type VerifiedBarber,
} from '@/lib/auth/barber-api-auth'

const createRequest = (
  method: string,
  body?: object,
  searchParams?: Record<string, string>
): Request => {
  const url = new URL('http://localhost:3000/api/barber/services')
  if (searchParams) {
    Object.entries(searchParams).forEach(([key, value]) => {
      url.searchParams.set(key, value)
    })
  }

  const init: RequestInit = { method }
  if (body) {
    init.headers = { 'Content-Type': 'application/json' }
    init.body = JSON.stringify(body)
  }

  return new Request(url.toString(), init)
}

describe('barber-api-auth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockMaybeSingleResult = { data: mockBarberData, error: null }
  })

  // ============================================================
  // extractBarberId
  // ============================================================

  describe('extractBarberId', () => {
    it('should extract barberId from provided body', async () => {
      const request = createRequest('POST')
      const result = await extractBarberId(request, { barberId: VALID_BARBER_UUID })
      expect(result).toBe(VALID_BARBER_UUID)
    })

    it('should extract barberId from query params for GET requests', async () => {
      const request = createRequest('GET', undefined, { barberId: VALID_BARBER_UUID })
      const result = await extractBarberId(request)
      expect(result).toBe(VALID_BARBER_UUID)
    })

    it('should return null when no barberId is present', async () => {
      const request = createRequest('GET')
      const result = await extractBarberId(request)
      expect(result).toBeNull()
    })

    it('should prefer body over query params', async () => {
      const request = createRequest('POST', undefined, { barberId: 'from-query' })
      const result = await extractBarberId(request, { barberId: VALID_BARBER_UUID })
      expect(result).toBe(VALID_BARBER_UUID)
    })
  })

  // ============================================================
  // verifyBarber
  // ============================================================

  describe('verifyBarber', () => {
    it('should return failure when no barberId is provided', async () => {
      const request = createRequest('POST')
      const result = await verifyBarber(request, {})

      expect(result.success).toBe(false)
      if (!result.success) {
        const data = await result.response.json()
        expect(data.error).toBe('UNAUTHORIZED')
        expect(data.message).toContain('barberId is required')
      }
    })

    it('should return failure for invalid UUID format', async () => {
      const request = createRequest('POST')
      const result = await verifyBarber(request, { barberId: 'not-a-uuid' })

      expect(result.success).toBe(false)
      if (!result.success) {
        const data = await result.response.json()
        expect(data.error).toBe('VALIDATION_ERROR')
        expect(data.message).toContain('Invalid barberId format')
      }
    })

    it('should return success for a valid, active barber', async () => {
      const request = createRequest('POST')
      const result = await verifyBarber(request, { barberId: VALID_BARBER_UUID })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.barber.id).toBe(VALID_BARBER_UUID)
        expect(result.barber.is_barber).toBe(true)
      }
    })

    it('should return failure when barber is not found in DB', async () => {
      mockMaybeSingleResult = { data: null, error: null }

      const request = createRequest('POST')
      const result = await verifyBarber(request, { barberId: VALID_BARBER_UUID })

      expect(result.success).toBe(false)
      if (!result.success) {
        const data = await result.response.json()
        expect(data.error).toBe('UNAUTHORIZED')
      }
    })

    it('should return failure on database error', async () => {
      mockMaybeSingleResult = { data: null, error: { message: 'Connection refused' } }

      const request = createRequest('POST')
      const result = await verifyBarber(request, { barberId: VALID_BARBER_UUID })

      expect(result.success).toBe(false)
      if (!result.success) {
        const data = await result.response.json()
        expect(data.error).toBe('DATABASE_ERROR')
      }
    })

    it('should extract barberId from query params when no body is provided', async () => {
      const request = createRequest('GET', undefined, { barberId: VALID_BARBER_UUID })
      const result = await verifyBarber(request)

      expect(result.success).toBe(true)
    })
  })

  // ============================================================
  // verifyAdmin
  // ============================================================

  describe('verifyAdmin', () => {
    it('should return success for an admin barber', async () => {
      mockMaybeSingleResult = { data: mockAdminData, error: null }

      const request = createRequest('POST')
      const result = await verifyAdmin(request, { barberId: VALID_BARBER_UUID })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.barber.role).toBe('admin')
      }
    })

    it('should return forbidden for a non-admin barber', async () => {
      // mockBarberData has role: 'barber'
      const request = createRequest('POST')
      const result = await verifyAdmin(request, { barberId: VALID_BARBER_UUID })

      expect(result.success).toBe(false)
      if (!result.success) {
        const data = await result.response.json()
        expect(data.error).toBe('FORBIDDEN')
      }
    })

    it('should propagate underlying verifyBarber failures', async () => {
      const request = createRequest('POST')
      const result = await verifyAdmin(request, {})

      expect(result.success).toBe(false)
      if (!result.success) {
        const data = await result.response.json()
        expect(data.error).toBe('UNAUTHORIZED')
      }
    })
  })

  // ============================================================
  // verifyOwnership
  // ============================================================

  describe('verifyOwnership', () => {
    it('should return true when barber owns the resource', () => {
      const barber = mockBarberData as VerifiedBarber
      expect(verifyOwnership(barber, VALID_BARBER_UUID)).toBe(true)
    })

    it('should return false when barber does not own the resource', () => {
      const barber = mockBarberData as VerifiedBarber
      expect(verifyOwnership(barber, VALID_BARBER_UUID_2)).toBe(false)
    })

    it('should return true for admins regardless of ownership', () => {
      const admin = mockAdminData as VerifiedBarber
      expect(verifyOwnership(admin, VALID_BARBER_UUID_2)).toBe(true)
    })
  })
})
