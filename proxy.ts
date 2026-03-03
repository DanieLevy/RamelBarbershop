/**
 * Next.js Proxy (Next.js 16+ convention — replaces middleware.ts)
 *
 * Two responsibilities:
 * 1. API rate limiting with in-memory stores and suspicious-activity blocking
 * 2. Netlify CDN cache prevention for HTML pages (prevents stale-chunk 404s)
 *
 * RATE LIMITING LIMITATIONS:
 * - In-memory storage resets on serverless cold starts
 * - Not shared across multiple instances
 * - For production with high traffic, consider Redis (e.g., Upstash)
 *
 * For this barbershop app (single instance, moderate traffic), in-memory
 * rate limiting provides effective protection against abuse and spam.
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// ============================================================
// Configuration
// ============================================================

// Rate limit configuration per endpoint
const RATE_LIMITS: Record<string, { requests: number; windowMs: number }> = {
  // Push notification endpoints - limit to prevent spam
  '/api/push/notify-booking': { requests: 30, windowMs: 60000 }, // 30 per minute
  '/api/push/notify-cancellation': { requests: 30, windowMs: 60000 },
  '/api/push/subscribe': { requests: 10, windowMs: 60000 },
  '/api/push/send': { requests: 30, windowMs: 60000 },
  '/api/push/status': { requests: 60, windowMs: 60000 },
  '/api/push/mark-read': { requests: 30, windowMs: 60000 },
  '/api/push/unsubscribe': { requests: 10, windowMs: 60000 },
  
  // Bug report endpoint
  '/api/bug-report': { requests: 10, windowMs: 60000 },
  
  // Reservation creation - limit to prevent booking abuse
  '/api/reservations/create': { requests: 20, windowMs: 60000 },
  
  // Health check - allow more
  '/api/health': { requests: 60, windowMs: 60000 },
  
  // Auth confirm - limit to prevent brute force
  '/api/auth/confirm': { requests: 10, windowMs: 60000 },
  
  // Default for other API routes
  'default': { requests: 100, windowMs: 60000 }, // 100 per minute
}

// Violation thresholds for suspicious activity detection
const VIOLATION_THRESHOLD = 5 // Number of rate limit hits before flagging
const VIOLATION_WINDOW_MS = 5 * 60 * 1000 // 5 minute window for violations
const BLOCK_DURATION_MS = 15 * 60 * 1000 // 15 minute block for suspicious IPs

// ============================================================
// Types
// ============================================================

interface RateLimitEntry {
  count: number
  resetAt: number
}

interface ViolationEntry {
  count: number
  firstViolation: number
  lastViolation: number
  blocked: boolean
  blockedUntil: number
}

// ============================================================
// In-memory stores
// ============================================================

// Note: These reset on serverless function cold starts
// For a single-instance barbershop app, this provides sufficient protection
const rateLimitStore = new Map<string, RateLimitEntry>()
const violationStore = new Map<string, ViolationEntry>()

// Cleanup configuration
const CLEANUP_INTERVAL = 5 * 60 * 1000 // 5 minutes
let lastCleanup = Date.now()

// ============================================================
// Helper Functions
// ============================================================

/**
 * Clean up expired entries from stores
 */
const cleanupStores = () => {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return
  
  lastCleanup = now
  
  // Cleanup rate limit entries
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key)
    }
  }
  
  // Cleanup violation entries (but keep blocked ones until block expires)
  for (const [key, entry] of violationStore.entries()) {
    if (entry.blocked) {
      if (entry.blockedUntil < now) {
        violationStore.delete(key)
      }
    } else if (now - entry.lastViolation > VIOLATION_WINDOW_MS) {
      violationStore.delete(key)
    }
  }
}

/**
 * Extract client IP from request headers
 */
const getClientIP = (request: NextRequest): string => {
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim()
  }
  
  const realIP = request.headers.get('x-real-ip')
  if (realIP) return realIP
  
  const cfConnectingIP = request.headers.get('cf-connecting-ip')
  if (cfConnectingIP) return cfConnectingIP
  
  // Fallback for development
  return 'unknown-ip'
}

/**
 * Get rate limit config for a pathname
 */
const getRateLimitConfig = (pathname: string): { requests: number; windowMs: number } => {
  if (RATE_LIMITS[pathname]) {
    return RATE_LIMITS[pathname]
  }
  
  for (const [path, config] of Object.entries(RATE_LIMITS)) {
    if (path !== 'default' && pathname.startsWith(path)) {
      return config
    }
  }
  
  return RATE_LIMITS['default']
}

/**
 * Check if an IP is currently blocked
 */
const isBlocked = (ip: string): boolean => {
  const entry = violationStore.get(ip)
  if (!entry) return false
  
  const now = Date.now()
  if (entry.blocked && entry.blockedUntil > now) {
    return true
  }
  
  // Block expired, unblock
  if (entry.blocked) {
    entry.blocked = false
    entry.blockedUntil = 0
    entry.count = 0
    entry.firstViolation = 0
    entry.lastViolation = 0
  }
  
  return false
}

/**
 * Record a rate limit violation for an IP
 */
const recordViolation = (ip: string) => {
  const now = Date.now()
  const entry = violationStore.get(ip)
  
  if (!entry) {
    violationStore.set(ip, {
      count: 1,
      firstViolation: now,
      lastViolation: now,
      blocked: false,
      blockedUntil: 0,
    })
    return
  }
  
  // Reset if outside window
  if (now - entry.firstViolation > VIOLATION_WINDOW_MS) {
    entry.count = 1
    entry.firstViolation = now
    entry.lastViolation = now
    return
  }
  
  entry.count++
  entry.lastViolation = now
  
  // Check if should block
  if (entry.count >= VIOLATION_THRESHOLD) {
    entry.blocked = true
    entry.blockedUntil = now + BLOCK_DURATION_MS
    
    console.warn(`[Proxy] Blocked suspicious IP: ${ip} - ${entry.count} violations in ${Math.round((now - entry.firstViolation) / 1000)}s`)
  }
}

/**
 * Check rate limit and return status
 */
const checkRateLimit = (ip: string, pathname: string): { 
  allowed: boolean
  remaining: number
  resetAt: number
  reason?: string 
} => {
  // First check if IP is blocked
  if (isBlocked(ip)) {
    const entry = violationStore.get(ip)!
    const retryAfter = Math.ceil((entry.blockedUntil - Date.now()) / 1000)
    
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.blockedUntil,
      reason: `Temporarily blocked due to suspicious activity. Retry in ${retryAfter}s`,
    }
  }
  
  const config = getRateLimitConfig(pathname)
  const key = `${ip}:${pathname}`
  const now = Date.now()
  
  // Cleanup periodically
  cleanupStores()
  
  const entry = rateLimitStore.get(key)
  
  if (!entry || entry.resetAt < now) {
    // New window
    rateLimitStore.set(key, { count: 1, resetAt: now + config.windowMs })
    return { allowed: true, remaining: config.requests - 1, resetAt: now + config.windowMs }
  }
  
  if (entry.count >= config.requests) {
    // Rate limit exceeded - record violation
    recordViolation(ip)
    
    console.log(`[Proxy] Rate limit exceeded: IP=${ip}, path=${pathname}, count=${entry.count}`)
    
    return { 
      allowed: false, 
      remaining: 0, 
      resetAt: entry.resetAt,
      reason: 'Rate limit exceeded. Please try again later.',
    }
  }
  
  // Increment count
  entry.count++
  return { allowed: true, remaining: config.requests - entry.count, resetAt: entry.resetAt }
}

// ============================================================
// Proxy Handler (Next.js 16+ convention)
// ============================================================

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ── API routes → rate limiting ───────────────────────────────
  if (pathname.startsWith('/api/')) {
    if (pathname.startsWith('/api/cron/') || pathname.startsWith('/api/dev/')) {
      return NextResponse.next()
    }

    const ip = getClientIP(request)
    const { allowed, remaining, resetAt, reason } = checkRateLimit(ip, pathname)

    if (!allowed) {
      const retryAfter = Math.ceil((resetAt - Date.now()) / 1000)

      return NextResponse.json(
        {
          success: false,
          error: reason || 'Rate limit exceeded. Please try again later.',
          retryAfter,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(retryAfter),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(Math.ceil(resetAt / 1000)),
          },
        }
      )
    }

    const response = NextResponse.next()
    response.headers.set('X-RateLimit-Remaining', String(remaining))
    response.headers.set('X-RateLimit-Reset', String(Math.ceil(resetAt / 1000)))
    return response
  }

  // ── Page routes → prevent Netlify Durable Cache ──────────────
  // @netlify/plugin-nextjs marks prerendered pages with a 1-year
  // Netlify-CDN-Cache-Control. After a deploy the Durable Cache
  // serves OLD HTML whose chunk hashes no longer exist → 404 →
  // text/plain MIME → browser refuses to execute scripts.
  // Application-level headers (set here) override the plugin.
  const response = NextResponse.next()
  response.headers.set(
    'Netlify-CDN-Cache-Control',
    'no-cache, no-store, must-revalidate'
  )
  response.headers.set('Cache-Control', 'public, max-age=0, must-revalidate')
  return response
}

export const config = {
  matcher: [
    // All routes except static assets, images, fonts, icons, PWA files
    '/((?!_next/static|_next/image|favicon\\.ico|icon\\.png|logo\\.png|apple-touch-icon\\.png|fonts/|icons/|static/|sw\\.js|manifest\\.json).*)',
  ],
}
