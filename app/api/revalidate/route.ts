/**
 * API Route: Cache Revalidation
 *
 * Allows client-side code to trigger server-side cache tag invalidation.
 * Used when barber data changes (e.g., toggling is_active) from client components
 * that cannot directly call revalidateTag.
 *
 * Accepts: { tag: string } — one of the known safe cache tags.
 */

import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'

// Only allow revalidation of known, safe cache tags
const ALLOWED_TAGS = new Set(['barbers', 'shop-settings', 'products', 'services', 'shop-closures'])

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { tag } = body as { tag?: string }

    if (!tag || !ALLOWED_TAGS.has(tag)) {
      return NextResponse.json(
        { success: false, error: 'Invalid or disallowed tag' },
        { status: 400 }
      )
    }

    revalidateTag(tag, 'max')
    console.log(`[API/Revalidate] Cache tag "${tag}" invalidated`)

    return NextResponse.json({ success: true, tag })
  } catch (err) {
    console.error('[API/Revalidate] Error:', err)
    return NextResponse.json(
      { success: false, error: 'Revalidation failed' },
      { status: 500 }
    )
  }
}
