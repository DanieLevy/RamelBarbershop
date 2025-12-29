/**
 * Environment Variable Validation
 * 
 * This module provides type-safe access to environment variables with validation.
 * It validates both client-side (NEXT_PUBLIC_*) and server-side variables.
 * 
 * Usage:
 * - Import { env } for server-side code
 * - Import { clientEnv } for client-side code
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
  
  // Firebase Auth
  NEXT_PUBLIC_FIREBASE_API_KEY: z.string().min(1, 'Firebase API key is required'),
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: z.string().min(1, 'Firebase auth domain is required'),
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: z.string().min(1, 'Firebase project ID is required'),
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: z.string().optional(),
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: z.string().optional(),
  NEXT_PUBLIC_FIREBASE_APP_ID: z.string().min(1, 'Firebase app ID is required'),
  NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: z.string().optional(),
  
  // Push Notifications (VAPID)
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().min(1, 'VAPID public key is required'),
  VAPID_PRIVATE_KEY: z.string().min(1, 'VAPID private key is required'),
  VAPID_EMAIL: z.string().email().optional().default('mailto:admin@ramel-barbershop.co.il'),
  
  // Email (Resend) - optional, used for bug reports
  RESEND_API_KEY: z.string().optional(),
  BUG_REPORT_TO_EMAIL: z.string().email().optional(),
  
  // App info
  NEXT_PUBLIC_APP_VERSION: z.string().optional().default('2.0.0'),
  
  // Node environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
})

/**
 * Client-side environment variables schema
 * These are exposed to the browser via NEXT_PUBLIC_ prefix
 */
const clientEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('Invalid Supabase URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'Supabase anon key is required'),
  NEXT_PUBLIC_FIREBASE_API_KEY: z.string().min(1, 'Firebase API key is required'),
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: z.string().min(1, 'Firebase auth domain is required'),
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: z.string().min(1, 'Firebase project ID is required'),
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: z.string().optional(),
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: z.string().optional(),
  NEXT_PUBLIC_FIREBASE_APP_ID: z.string().min(1, 'Firebase app ID is required'),
  NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: z.string().optional(),
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
    NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    NEXT_PUBLIC_APP_VERSION: process.env.NEXT_PUBLIC_APP_VERSION,
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

