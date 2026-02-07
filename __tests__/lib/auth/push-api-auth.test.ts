/**
 * Tests for lib/auth/push-api-auth.ts
 * 
 * Unit tests for push notification authentication helpers used by
 * /api/push/* API routes.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ============================================================
// Mocks
// ============================================================

const VALID_CUSTOMER_UUID = 'd2f078fd-c497-40f5-824d-7fe0ef4b2d25'
const VALID_BARBER_UUID = '550e8400-e29b-41d4-a716-446655440001'
const INTERNAL_SECRET = 'test-internal-secret-that-is-at-least-32-characters-long'

let mockMaybeSingleResult: { data: unknown; error: unknown } = { data: { id: VALID_CUSTOMER_UUID }, error: null }

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn((table: string) => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => {
          // For 'users' table (barbers), we need an extra .eq for is_barber
          if (table === 'users') {
            return {
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(() => Promise.resolve(mockMaybeSingleResult)),
              })),
            }
          }
          // For 'customers' table, maybeSingle is directly available
          return {
            maybeSingle: vi.fn(() => Promise.resolve(mockMaybeSingleResult)),
          }
        }),
      })),
    })),
  })),
}))

// ============================================================
// Tests
// ============================================================

import {
  verifyInternalCall,
  verifyPushCaller,
  verifyPushCallerOrInternal,
} from '@/lib/auth/push-api-auth'

const createRequest = (
  method: string,
  body?: object,
  searchParams?: Record<string, string>,
  headers?: Record<string, string>
): Request => {
  const url = new URL('http://localhost:3000/api/push/subscribe')
  if (searchParams) {
    Object.entries(searchParams).forEach(([key, value]) => {
      url.searchParams.set(key, value)
    })
  }

  const init: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  }
  if (body) {
    init.body = JSON.stringify(body)
  }

  return new Request(url.toString(), init)
}

describe('push-api-auth', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.clearAllMocks()
    mockMaybeSingleResult = { data: { id: VALID_CUSTOMER_UUID }, error: null }
    process.env = { ...originalEnv, INTERNAL_API_SECRET: INTERNAL_SECRET }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  // ============================================================
  // verifyInternalCall
  // ============================================================

  describe('verifyInternalCall', () => {
    it('should return true when X-Internal-Secret matches', () => {
      const request = createRequest('POST', undefined, undefined, {
        'X-Internal-Secret': INTERNAL_SECRET,
      })
      expect(verifyInternalCall(request)).toBe(true)
    })

    it('should return false when X-Internal-Secret does not match', () => {
      const request = createRequest('POST', undefined, undefined, {
        'X-Internal-Secret': 'wrong-secret',
      })
      expect(verifyInternalCall(request)).toBe(false)
    })

    it('should return false when X-Internal-Secret header is missing', () => {
      const request = createRequest('POST')
      expect(verifyInternalCall(request)).toBe(false)
    })

    it('should return false when INTERNAL_API_SECRET env var is not set', () => {
      delete process.env.INTERNAL_API_SECRET
      const request = createRequest('POST', undefined, undefined, {
        'X-Internal-Secret': INTERNAL_SECRET,
      })
      expect(verifyInternalCall(request)).toBe(false)
    })
  })

  // ============================================================
  // verifyPushCaller
  // ============================================================

  describe('verifyPushCaller', () => {
    it('should return failure when neither customerId nor barberId is provided', async () => {
      const request = createRequest('POST')
      const result = await verifyPushCaller(request, {})

      expect(result.success).toBe(false)
      if (!result.success) {
        const data = await result.response.json()
        expect(data.error).toContain('customerId or barberId is required')
      }
    })

    it('should return failure for invalid customerId format', async () => {
      const request = createRequest('POST')
      const result = await verifyPushCaller(request, { customerId: 'invalid' })

      expect(result.success).toBe(false)
      if (!result.success) {
        const data = await result.response.json()
        expect(data.error).toContain('Invalid customerId format')
      }
    })

    it('should return failure for invalid barberId format', async () => {
      const request = createRequest('POST')
      const result = await verifyPushCaller(request, { barberId: 'invalid' })

      expect(result.success).toBe(false)
      if (!result.success) {
        const data = await result.response.json()
        expect(data.error).toContain('Invalid barberId format')
      }
    })

    it('should return success for a valid customer', async () => {
      const request = createRequest('POST')
      const result = await verifyPushCaller(request, { customerId: VALID_CUSTOMER_UUID })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.userId).toBe(VALID_CUSTOMER_UUID)
        expect(result.userType).toBe('customer')
      }
    })

    it('should return success for a valid barber', async () => {
      mockMaybeSingleResult = { data: { id: VALID_BARBER_UUID }, error: null }

      const request = createRequest('POST')
      const result = await verifyPushCaller(request, { barberId: VALID_BARBER_UUID })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.userId).toBe(VALID_BARBER_UUID)
        expect(result.userType).toBe('barber')
      }
    })

    it('should return failure when customer not found in DB', async () => {
      mockMaybeSingleResult = { data: null, error: null }

      const request = createRequest('POST')
      const result = await verifyPushCaller(request, { customerId: VALID_CUSTOMER_UUID })

      expect(result.success).toBe(false)
      if (!result.success) {
        const data = await result.response.json()
        expect(data.error).toContain('Customer not found')
      }
    })

    it('should return failure when barber not found in DB', async () => {
      mockMaybeSingleResult = { data: null, error: null }

      const request = createRequest('POST')
      const result = await verifyPushCaller(request, { barberId: VALID_BARBER_UUID })

      expect(result.success).toBe(false)
      if (!result.success) {
        const data = await result.response.json()
        expect(data.error).toContain('Barber not found')
      }
    })

    it('should extract IDs from query params for GET requests', async () => {
      const request = createRequest('GET', undefined, { customerId: VALID_CUSTOMER_UUID })
      const result = await verifyPushCaller(request)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.userId).toBe(VALID_CUSTOMER_UUID)
        expect(result.userType).toBe('customer')
      }
    })

    it('should prefer customerId when both are provided', async () => {
      const request = createRequest('POST')
      const result = await verifyPushCaller(request, {
        customerId: VALID_CUSTOMER_UUID,
        barberId: VALID_BARBER_UUID,
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.userType).toBe('customer')
      }
    })
  })

  // ============================================================
  // verifyPushCallerOrInternal
  // ============================================================

  describe('verifyPushCallerOrInternal', () => {
    it('should accept internal calls with valid secret', async () => {
      const request = createRequest('POST', undefined, undefined, {
        'X-Internal-Secret': INTERNAL_SECRET,
      })
      const result = await verifyPushCallerOrInternal(request, {})

      expect(result.success).toBe(true)
      if (result.success && 'internal' in result) {
        expect(result.internal).toBe(true)
      }
    })

    it('should fall back to user verification when no internal secret', async () => {
      const request = createRequest('POST')
      const result = await verifyPushCallerOrInternal(request, { customerId: VALID_CUSTOMER_UUID })

      expect(result.success).toBe(true)
      if (result.success && 'userId' in result) {
        expect(result.userId).toBe(VALID_CUSTOMER_UUID)
      }
    })

    it('should reject when neither internal secret nor valid user', async () => {
      mockMaybeSingleResult = { data: null, error: null }

      const request = createRequest('POST')
      const result = await verifyPushCallerOrInternal(request, { customerId: VALID_CUSTOMER_UUID })

      expect(result.success).toBe(false)
    })

    it('should prefer internal secret over user verification', async () => {
      const request = createRequest('POST', undefined, undefined, {
        'X-Internal-Secret': INTERNAL_SECRET,
      })
      const result = await verifyPushCallerOrInternal(request, { customerId: VALID_CUSTOMER_UUID })

      expect(result.success).toBe(true)
      if (result.success && 'internal' in result) {
        expect(result.internal).toBe(true)
      }
    })
  })
})
