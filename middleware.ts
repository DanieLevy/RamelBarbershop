import { NextResponse, type NextRequest } from 'next/server'

/**
 * Middleware to prevent Netlify Durable Cache from storing stale HTML.
 *
 * Problem: @netlify/plugin-nextjs marks prerendered pages with
 *   Netlify-CDN-Cache-Control: durable, s-maxage=31536000 (1 year).
 * After a deploy, the Durable Cache still serves OLD HTML that references
 * OLD chunk hashes (/_next/static/chunks/abc.js) which no longer exist
 * on the new deploy → 404 → text/plain MIME → browser refuses to execute.
 *
 * Fix: Set Netlify-CDN-Cache-Control at the APPLICATION level (middleware).
 * Application-level headers override both plugin headers and netlify.toml,
 * so this prevents the plugin from storing HTML in Durable Cache.
 *
 * Static assets (/_next/static/*) are excluded via the matcher below
 * and keep their immutable long-cache headers from netlify.toml.
 */
export const middleware = (request: NextRequest) => {
  const response = NextResponse.next()

  response.headers.set(
    'Netlify-CDN-Cache-Control',
    'no-cache, no-store, must-revalidate'
  )
  response.headers.set(
    'Cache-Control',
    'public, max-age=0, must-revalidate'
  )

  return response
}

export const config = {
  matcher: [
    /*
     * Match all page routes. Exclude:
     * - /_next/static  (hashed JS/CSS — immutable, cache forever)
     * - /_next/image   (optimized images — own cache headers)
     * - /favicon.ico, /icon.png, /logo.png, /apple-touch-icon.png
     * - /fonts, /icons, /static  (truly static assets)
     * - /sw.js, /manifest.json  (PWA assets — own cache headers)
     * - /api           (API routes — already have no-store)
     */
    '/((?!_next/static|_next/image|favicon\\.ico|icon\\.png|logo\\.png|apple-touch-icon\\.png|fonts/|icons/|static/|sw\\.js|manifest\\.json|api/).*)',
  ],
}
