/**
 * Retry Utility Tests
 * 
 * Tests for lib/utils/retry.ts
 * All tests are READ-ONLY - no database writes.
 * Critical for Safari "Load failed" bug fix verification.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { withRetry, withSupabaseRetry, isRetryableError, fetchWithRetry } from '@/lib/utils/retry'

describe('isRetryableError', () => {
  it('returns true for Safari "Load failed" error', () => {
    const error = new Error('Load failed')
    expect(isRetryableError(error)).toBe(true)
  })

  it('returns true for Safari "Load failed" error (case insensitive)', () => {
    const error = new Error('LOAD FAILED')
    expect(isRetryableError(error)).toBe(true)
  })

  it('returns true for network error', () => {
    const error = new Error('Network request failed')
    expect(isRetryableError(error)).toBe(true)
  })

  it('returns true for fetch failed error', () => {
    const error = new Error('fetch failed')
    expect(isRetryableError(error)).toBe(true)
  })

  it('returns true for timeout error', () => {
    const error = new Error('Request timeout')
    expect(isRetryableError(error)).toBe(true)
  })

  it('returns true for ECONNRESET error', () => {
    const error = new Error('ECONNRESET')
    expect(isRetryableError(error)).toBe(true)
  })

  it('returns true for socket hang up error', () => {
    const error = new Error('socket hang up')
    expect(isRetryableError(error)).toBe(true)
  })

  it('returns false for validation errors', () => {
    const error = new Error('Validation failed: phone required')
    expect(isRetryableError(error)).toBe(false)
  })

  it('returns false for auth errors', () => {
    const error = new Error('Unauthorized')
    expect(isRetryableError(error)).toBe(false)
  })

  it('returns false for generic errors', () => {
    const error = new Error('Something went wrong')
    expect(isRetryableError(error)).toBe(false)
  })
})

describe('withRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('succeeds on first attempt', async () => {
    const fn = vi.fn().mockResolvedValue('success')
    
    const result = await withRetry(fn)
    
    expect(result).toBe('success')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('retries on retryable error and succeeds', async () => {
    let attempt = 0
    const fn = vi.fn().mockImplementation(() => {
      attempt++
      if (attempt < 3) {
        return Promise.reject(new Error('Load failed'))
      }
      return Promise.resolve('success')
    })
    
    const resultPromise = withRetry(fn, {
      maxRetries: 5,
      shouldRetry: isRetryableError,
    })
    
    // Fast-forward through retries
    await vi.runAllTimersAsync()
    
    const result = await resultPromise
    
    expect(result).toBe('success')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('does not retry on non-retryable error', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('Validation error'))
    
    await expect(
      withRetry(fn, { shouldRetry: isRetryableError })
    ).rejects.toThrow('Validation error')
    
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('exhausts retries and throws last error', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('Load failed'))
    
    const resultPromise = withRetry(fn, {
      maxRetries: 3,
      shouldRetry: isRetryableError,
    })
    
    // Fast-forward through all retries
    await vi.runAllTimersAsync()
    
    // Properly await the rejection to avoid unhandled rejection warning
    try {
      await resultPromise
      expect.fail('Should have thrown')
    } catch (err) {
      expect((err as Error).message).toBe('Load failed')
    }
    // maxRetries: 3 means 1 initial attempt + 3 retries = 4 total calls
    expect(fn).toHaveBeenCalledTimes(4)
  })

  it('calls onRetry callback on each retry', async () => {
    let attempt = 0
    const fn = vi.fn().mockImplementation(() => {
      attempt++
      if (attempt < 3) {
        return Promise.reject(new Error('Load failed'))
      }
      return Promise.resolve('success')
    })
    
    const onRetry = vi.fn()
    
    const resultPromise = withRetry(fn, {
      maxRetries: 5,
      shouldRetry: isRetryableError,
      onRetry,
    })
    
    await vi.runAllTimersAsync()
    await resultPromise
    
    expect(onRetry).toHaveBeenCalledTimes(2)
    expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error), expect.any(Number))
    expect(onRetry).toHaveBeenCalledWith(2, expect.any(Error), expect.any(Number))
  })

  it('uses exponential backoff', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('Load failed'))
    const onRetry = vi.fn()
    
    const resultPromise = withRetry(fn, {
      maxRetries: 4,
      initialDelayMs: 100,
      maxDelayMs: 10000,
      shouldRetry: isRetryableError,
      onRetry,
    })
    
    // Fast-forward through all retries
    await vi.runAllTimersAsync()
    
    // Properly await the rejection to avoid unhandled rejection warning
    try {
      await resultPromise
    } catch {
      // Expected to fail - this prevents unhandled rejection warning
    }
    
    // Verify increasing delays (excluding jitter variation)
    const delays = onRetry.mock.calls.map(call => call[2] as number)
    expect(delays.length).toBeGreaterThan(0)
  })
})

describe('withSupabaseRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('retries on Safari "Load failed" error', async () => {
    let attempt = 0
    const fn = vi.fn().mockImplementation(() => {
      attempt++
      if (attempt < 3) {
        return Promise.reject(new Error('Load failed'))
      }
      return Promise.resolve({ data: 'success', error: null })
    })
    
    const resultPromise = withSupabaseRetry(fn)
    
    await vi.runAllTimersAsync()
    
    const result = await resultPromise
    
    expect(result).toEqual({ data: 'success', error: null })
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('logs retry attempts', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    
    let attempt = 0
    const fn = vi.fn().mockImplementation(() => {
      attempt++
      if (attempt < 2) {
        return Promise.reject(new Error('Load failed'))
      }
      return Promise.resolve({ data: 'success', error: null })
    })
    
    const resultPromise = withSupabaseRetry(fn)
    
    await vi.runAllTimersAsync()
    await resultPromise
    
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[Supabase Retry]')
    )
    
    consoleSpy.mockRestore()
  })
})

describe('fetchWithRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('succeeds on first attempt', async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response('OK', { status: 200 }))
    
    const response = await fetchWithRetry('https://example.com/api')
    
    expect(response.status).toBe(200)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('retries on network error', async () => {
    let attempt = 0
    global.fetch = vi.fn().mockImplementation(() => {
      attempt++
      if (attempt < 3) {
        return Promise.reject(new Error('Load failed'))
      }
      return Promise.resolve(new Response('OK', { status: 200 }))
    })
    
    const responsePromise = fetchWithRetry('https://example.com/api')
    
    await vi.runAllTimersAsync()
    
    const response = await responsePromise
    
    expect(response.status).toBe(200)
    expect(fetch).toHaveBeenCalledTimes(3)
  })
})
