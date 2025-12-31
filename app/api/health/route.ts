/**
 * Health Check API Endpoint
 * 
 * Provides system health status for monitoring and alerting.
 * Checks:
 * - Database connectivity
 * - Push notification service status
 * - Environment configuration
 */

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  version: string
  checks: {
    database: CheckResult
    environment: CheckResult
    push: CheckResult
  }
  uptime?: number
}

interface CheckResult {
  status: 'pass' | 'fail' | 'warn'
  message: string
  latency?: number
}

// Track server start time for uptime
const startTime = Date.now()

/**
 * Check database connectivity
 */
async function checkDatabase(): Promise<CheckResult> {
  const start = Date.now()
  
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    if (!supabaseUrl || !supabaseKey) {
      return {
        status: 'fail',
        message: 'Database configuration missing',
      }
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    // Simple query to check connectivity
    const { error } = await supabase
      .from('barbershop_settings')
      .select('id')
      .limit(1)
      .single()
    
    const latency = Date.now() - start
    
    if (error && error.code !== 'PGRST116') {
      // PGRST116 is "no rows returned" - that's OK for health check
      return {
        status: 'fail',
        message: `Database query failed: ${error.message}`,
        latency,
      }
    }
    
    if (latency > 2000) {
      return {
        status: 'warn',
        message: 'Database responding slowly',
        latency,
      }
    }
    
    return {
      status: 'pass',
      message: 'Database connected',
      latency,
    }
  } catch (error) {
    return {
      status: 'fail',
      message: error instanceof Error ? error.message : 'Database check failed',
      latency: Date.now() - start,
    }
  }
}

/**
 * Check environment configuration
 */
function checkEnvironment(): CheckResult {
  const requiredVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  ]
  
  const optionalVars = [
    'VAPID_PUBLIC_KEY',
    'VAPID_PRIVATE_KEY',
    'RESEND_API_KEY',
    'BUG_REPORT_TO_EMAIL',
  ]
  
  const missingRequired = requiredVars.filter(v => !process.env[v])
  const missingOptional = optionalVars.filter(v => !process.env[v])
  
  if (missingRequired.length > 0) {
    return {
      status: 'fail',
      message: `Missing required env vars: ${missingRequired.join(', ')}`,
    }
  }
  
  if (missingOptional.length > 0) {
    return {
      status: 'warn',
      message: `Missing optional env vars: ${missingOptional.join(', ')}`,
    }
  }
  
  return {
    status: 'pass',
    message: 'All environment variables configured',
  }
}

/**
 * Check push notification service status
 */
function checkPush(): CheckResult {
  const publicKey = process.env.VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  
  if (!publicKey || !privateKey) {
    return {
      status: 'warn',
      message: 'Push notifications not configured',
    }
  }
  
  // Basic validation of VAPID keys
  if (publicKey.length < 50 || privateKey.length < 30) {
    return {
      status: 'fail',
      message: 'Invalid VAPID key format',
    }
  }
  
  return {
    status: 'pass',
    message: 'Push notification service configured',
  }
}

/**
 * Calculate overall health status
 */
function calculateOverallStatus(checks: HealthStatus['checks']): 'healthy' | 'degraded' | 'unhealthy' {
  const results = Object.values(checks)
  
  if (results.some(c => c.status === 'fail')) {
    // Check if critical services failed
    if (checks.database.status === 'fail') {
      return 'unhealthy'
    }
    return 'degraded'
  }
  
  if (results.some(c => c.status === 'warn')) {
    return 'degraded'
  }
  
  return 'healthy'
}

export async function GET() {
  try {
    const [database, environment, push] = await Promise.all([
      checkDatabase(),
      Promise.resolve(checkEnvironment()),
      Promise.resolve(checkPush()),
    ])
    
    const checks = { database, environment, push }
    const status = calculateOverallStatus(checks)
    
    const health: HealthStatus = {
      status,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      checks,
      uptime: Math.floor((Date.now() - startTime) / 1000),
    }
    
    // Return appropriate HTTP status based on health
    const httpStatus = status === 'unhealthy' ? 503 : status === 'degraded' ? 200 : 200
    
    return NextResponse.json(health, {
      status: httpStatus,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    })
  } catch (error) {
    console.error('[Health] Check failed:', error)
    
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Health check failed',
      },
      { status: 503 }
    )
  }
}
