/**
 * Supabase Admin Client
 * 
 * Uses the service_role key to bypass RLS policies.
 * IMPORTANT: Only use in server-side code (API routes, server actions).
 * Never import this in client-side code or expose the key.
 * 
 * The service_role key has full access to all tables regardless of RLS.
 * Use this for:
 * - Customer mutations (create, update, delete)
 * - Reservation operations
 * - Push subscription management
 * - Trusted device management
 * - Any write operation that should bypass RLS
 */

import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

/**
 * Creates a Supabase admin client with service_role privileges.
 * This client bypasses all RLS policies.
 * 
 * @throws Error if SUPABASE_SERVICE_ROLE_KEY is not set
 * @returns Supabase client with admin privileges
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable')
  }

  if (!serviceRoleKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable')
  }

  return createSupabaseClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      // Don't persist sessions for admin client
      persistSession: false,
      // Auto-refresh is not needed for service role
      autoRefreshToken: false,
      // Detect session in URL is not needed
      detectSessionInUrl: false,
    },
  })
}

/**
 * Singleton admin client for reuse within the same request
 * Note: In serverless environments, this may not provide significant benefit
 * but helps avoid creating multiple clients in the same request cycle.
 */
let adminClientInstance: ReturnType<typeof createAdminClient> | null = null

export function getAdminClient() {
  if (!adminClientInstance) {
    adminClientInstance = createAdminClient()
  }
  return adminClientInstance
}
