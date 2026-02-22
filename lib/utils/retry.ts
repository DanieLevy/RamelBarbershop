/**
 * Retry Utility for Transient Failures
 * 
 * Provides exponential backoff retry logic for network operations
 * and database queries that may fail transiently.
 */

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number
  /** Initial delay in milliseconds (default: 1000) */
  initialDelayMs?: number
  /** Maximum delay in milliseconds (default: 10000) */
  maxDelayMs?: number
  /** Backoff multiplier (default: 2) */
  backoffMultiplier?: number
  /** Function to determine if error is retryable (default: all errors) */
  shouldRetry?: (error: Error) => boolean
  /** Callback for each retry attempt */
  onRetry?: (attempt: number, error: Error, nextDelayMs: number) => void
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  shouldRetry: () => true,
  onRetry: () => {},
}

/**
 * Check if an error is a transient network error (Safari "Load failed", etc.)
 * Use this to decide whether to suppress bug reports for expected mobile failures.
 * Unlike isRetryableError(), this does NOT include DB errors or rate limits.
 */
export function isTransientNetworkError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()
  const errorName = error instanceof Error ? (error.name?.toLowerCase() || '') : ''

  return (
    message.includes('load failed') ||
    message.includes('failed to fetch') ||
    message.includes('fetch failed') ||
    message.includes('network request failed') ||
    message.includes('networkerror') ||
    message.includes('the internet connection appears to be offline') ||
    message.includes('cancelled') ||
    message.includes('aborted') ||
    (errorName === 'typeerror' && (message.includes('load') || message.includes('fetch')))
  )
}

/**
 * Default retryable error checker
 * Returns true for network errors and transient database errors
 */
export function isRetryableError(error: Error): boolean {
  const message = error.message.toLowerCase()
  const errorName = error.name?.toLowerCase() || ''
  
  // Network errors (including Safari-specific "Load failed")
  // "Load failed" is Safari/WebKit's generic fetch failure error
  // This commonly occurs on iOS PWAs during app wake-up or network transitions
  // Also check for TypeError with network-related messages (common on iOS)
  if (message.includes('network') || 
      message.includes('timeout') ||
      message.includes('connection') ||
      message.includes('econnreset') ||
      message.includes('socket hang up') ||
      message.includes('load failed') ||  // Safari/iOS specific
      message.includes('fetch failed') ||  // Generic fetch failure
      message.includes('failed to fetch') ||  // Chrome/generic
      message.includes('network request failed') ||  // Various browsers
      message.includes('the internet connection appears to be offline') ||  // Safari offline
      message.includes('cancelled') ||  // Request was cancelled (iOS background)
      message.includes('aborted') ||  // Request aborted
      (errorName === 'typeerror' && (message.includes('load') || message.includes('fetch')))) {  // TypeError: Load failed
    return true
  }
  
  // Supabase/PostgreSQL transient errors
  if (message.includes('could not connect') ||
      message.includes('too many connections') ||
      message.includes('connection refused') ||
      message.includes('connection closed')) {
    return true
  }
  
  // Rate limiting (should retry after delay)
  if (message.includes('rate limit') || message.includes('429')) {
    return true
  }
  
  // Don't retry validation errors, auth errors, etc.
  if (message.includes('invalid') ||
      message.includes('unauthorized') ||
      message.includes('forbidden') ||
      message.includes('not found') ||
      message.includes('already exists')) {
    return false
  }
  
  return false
}

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateDelay(attempt: number, options: Required<RetryOptions>): number {
  const baseDelay = options.initialDelayMs * Math.pow(options.backoffMultiplier, attempt - 1)
  // Add jitter (±25%) to prevent thundering herd
  const jitter = baseDelay * 0.25 * (Math.random() * 2 - 1)
  return Math.min(baseDelay + jitter, options.maxDelayMs)
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Safely convert any thrown value to a proper Error instance.
 * Handles Supabase PostgrestError objects, plain objects with .message,
 * and cross-realm objects where `instanceof Error` fails (common on iOS WebKit PWAs).
 */
function toError(thrown: unknown): Error {
  if (thrown instanceof Error) return thrown

  if (thrown && typeof thrown === 'object') {
    const obj = thrown as Record<string, unknown>
    const message = typeof obj.message === 'string'
      ? obj.message
      : typeof obj.error === 'string'
        ? obj.error
        : safeStringify(thrown)
    const err = new Error(message)
    if (typeof obj.name === 'string') err.name = obj.name
    if (typeof obj.stack === 'string') err.stack = obj.stack
    return err
  }

  if (typeof thrown === 'string') return new Error(thrown)

  return new Error(String(thrown))
}

function safeStringify(obj: unknown): string {
  try {
    return JSON.stringify(obj)
  } catch {
    return 'Unknown error object'
  }
}

/**
 * Execute a function with automatic retry on failure
 * 
 * @example
 * const data = await withRetry(
 *   () => fetch('/api/data').then(r => r.json()),
 *   { maxRetries: 3, onRetry: (attempt, err) => console.log(`Retry ${attempt}`) }
 * )
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts: Required<RetryOptions> = { ...DEFAULT_OPTIONS, ...options }
  
  let lastError: Error | null = null
  
  for (let attempt = 1; attempt <= opts.maxRetries + 1; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = toError(error)
      
      // Check if we've exhausted retries
      if (attempt > opts.maxRetries) {
        break
      }
      
      // Check if error is retryable
      if (!opts.shouldRetry(lastError)) {
        break
      }
      
      // Calculate delay and wait
      const delayMs = calculateDelay(attempt, opts)
      opts.onRetry(attempt, lastError, delayMs)
      await sleep(delayMs)
    }
  }
  
  throw lastError
}

/**
 * Retry wrapper specifically for Supabase operations
 * Uses isRetryableError as the default shouldRetry function
 */
export async function withSupabaseRetry<T>(
  fn: () => Promise<T>,
  options: Omit<RetryOptions, 'shouldRetry'> = {}
): Promise<T> {
  return withRetry(fn, {
    ...options,
    shouldRetry: isRetryableError,
    onRetry: options.onRetry || ((attempt, error, delay) => {
      console.log(`[Supabase Retry] Attempt ${attempt} failed: ${error.message}. Retrying in ${delay}ms...`)
    }),
  })
}

/**
 * Retry wrapper for fetch operations
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retryOptions: RetryOptions = {}
): Promise<Response> {
  return withRetry(
    async () => {
      const response = await fetch(url, options)
      
      // Retry on 5xx errors and 429 (rate limit)
      if (response.status >= 500 || response.status === 429) {
        const error = new Error(`HTTP ${response.status}: ${response.statusText}`)
        throw error
      }
      
      return response
    },
    {
      shouldRetry: isRetryableError,
      ...retryOptions,
    }
  )
}
