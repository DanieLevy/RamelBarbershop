/**
 * Environment Variable Validation
 * 
 * This module provides type-safe access to environment variables with validation.
 * It validates both client-side (NEXT_PUBLIC_*) and server-side variables.
 * 
 * Usage:
 * - Import { env } for server-side code
 * - Import { clientEnv } for client-side code
 * 
 * SMS Provider Notes:
 * - Firebase Auth has been removed (as of Jan 2026)
 * - New SMS provider environment variables should be added here when integrated
 * - Example: SMS_API_KEY, SMS_SENDER_ID, etc.
 */

import { z } from 'zod'

/**
 * Server-side environment variables schema
 * These are only available in server components and API routes
 */
const serverEnvSchema = z.object({
  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('Invalid Supabase URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'Supabase anon key is required'),
  
  // 019 SMS Provider (Israeli SMS service for OTP)
  O19_SMS_API_TOKEN: z.string().min(1, '019 SMS API token is required'),
  O19_SMS_USERNAME: z.string().min(1, '019 SMS username is required'),
  O19_SMS_SOURCE: z.string().default('Ramel'),
  
  // Push Notifications (VAPID)
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().min(1, 'VAPID public key is required'),
  VAPID_PRIVATE_KEY: z.string().min(1, 'VAPID private key is required'),
  VAPID_EMAIL: z.string().email().optional().default('mailto:admin@ramel-barbershop.co.il'),
  
  // Email (Resend) - optional, used for bug reports
  RESEND_API_KEY: z.string().optional(),
  BUG_REPORT_TO_EMAIL: z.string().email().optional(),
  
  // Vercel Cron - required in production for secure cron job execution
  CRON_SECRET: z.string().min(32, 'CRON_SECRET should be at least 32 characters').optional(),
  
  // Internal API secret for server-to-server calls between API routes
  // Used to authenticate internal push notification calls (e.g., from /api/reservations/create)
  INTERNAL_API_SECRET: z.string().min(32, 'INTERNAL_API_SECRET should be at least 32 characters').optional(),
  
  // App info
  NEXT_PUBLIC_APP_VERSION: z.string().optional().default('2.0.0'),
  
  // Node environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
})

/**
 * Client-side environment variables schema
 * These are exposed to the browser via NEXT_PUBLIC_ prefix
 * 
 * Note: SMS OTP is handled via server-side API routes for security
 * The 019 SMS provider token is never exposed to the client
 */
const clientEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('Invalid Supabase URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'Supabase anon key is required'),
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().min(1, 'VAPID public key is required'),
  NEXT_PUBLIC_APP_VERSION: z.string().optional().default('2.0.0'),
})

// Type definitions
export type ServerEnv = z.infer<typeof serverEnvSchema>
export type ClientEnv = z.infer<typeof clientEnvSchema>

/**
 * Validate and parse server environment variables
 */
const parseServerEnv = (): ServerEnv => {
  // Only validate on server
  if (typeof window !== 'undefined') {
    throw new Error('Server environment variables cannot be accessed on the client')
  }
  
  const result = serverEnvSchema.safeParse(process.env)
  
  if (!result.success) {
    const errors = result.error.flatten().fieldErrors
    const errorMessages = Object.entries(errors)
      .map(([key, messages]) => `  ${key}: ${messages?.join(', ')}`)
      .join('\n')
    
    console.error('❌ Invalid server environment variables:\n' + errorMessages)
    
    // In development, log helpful message
    if (process.env.NODE_ENV === 'development') {
      console.error('\n💡 Check your .env.local file and ensure all required variables are set.')
    }
    
    throw new Error('Invalid server environment variables')
  }
  
  return result.data
}

/**
 * Validate and parse client environment variables
 */
const parseClientEnv = (): ClientEnv => {
  const clientVars = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    NEXT_PUBLIC_APP_VERSION: process.env.NEXT_PUBLIC_APP_VERSION,
    // Add new SMS provider client variables here when integrated
  }
  
  const result = clientEnvSchema.safeParse(clientVars)
  
  if (!result.success) {
    const errors = result.error.flatten().fieldErrors
    const errorMessages = Object.entries(errors)
      .map(([key, messages]) => `  ${key}: ${messages?.join(', ')}`)
      .join('\n')
    
    console.error('❌ Invalid client environment variables:\n' + errorMessages)
    throw new Error('Invalid client environment variables')
  }
  
  return result.data
}

/**
 * Server environment variables (validated)
 * Only use this in server components, API routes, or server actions
 */
export const getServerEnv = (): ServerEnv => parseServerEnv()

/**
 * Client environment variables (validated)
 * Safe to use in both client and server code
 */
export const clientEnv: ClientEnv = parseClientEnv()

/**
 * Helper to check if we're in development mode
 */
export const isDevelopment = process.env.NODE_ENV === 'development'

/**
 * Helper to check if we're in production mode
 */
export const isProduction = process.env.NODE_ENV === 'production'

