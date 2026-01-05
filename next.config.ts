import type { NextConfig } from 'next'

/**
 * Next.js Configuration
 * 
 * CACHING STRATEGY - What's cached vs real-time:
 * ================================================
 * ✅ CACHED (static, never changes):
 *    - /_next/static/* (JS/CSS with content hashes) - immutable forever
 *    - /fonts/* - immutable forever
 *    - /icons/* - 30 days
 *    - /manifest.json - 1 day
 * 
 * ❌ NEVER CACHED (real-time for reservations):
 *    - /api/* - all API endpoints
 *    - Page routes (SSR/RSC data)
 *    - Supabase database queries
 *    - RSC payloads (?_rsc=*)
 * 
 * ⚠️ SHORT CACHE (1 hour):
 *    - /_next/image/* - optimized images (user-uploaded photos)
 */
const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'iili.io' },
      { protocol: 'https', hostname: 'upcdn.io' },
      { protocol: 'https', hostname: 'zdisrkjxsvpqrrryfbdo.supabase.co' },
      { protocol: 'https', hostname: 'gcdnb.pbrd.co' },
    ],
    // Short cache for optimized images - user-uploaded images (barber photos, products)
    // should be relatively fresh. The URL includes timestamps so updates get new URLs,
    // but keeping this short (1 hour) ensures any edge cases refresh quickly.
    minimumCacheTTL: 60 * 60, // 1 hour cache for optimized images
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
  },
  // Turbopack configuration to resolve lockfile warning
  turbopack: {
    root: process.cwd(),
  },
  // Suppress known streaming errors in development
  logging: {
    fetches: {
      fullUrl: false,
    },
  },
  // Optimized caching headers for static assets
  async headers() {
    return [
      {
        // Next.js static assets (JS/CSS with content hash) - immutable, cache forever
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // Fonts - long cache, rarely change
        source: '/fonts/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // Icons - long cache
        source: '/icons/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=2592000, stale-while-revalidate=86400',
          },
        ],
      },
      {
        // Manifest and PWA assets
        source: '/manifest.json',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, stale-while-revalidate=3600',
          },
        ],
      },
      {
        // Service worker - check for updates but cache
        source: '/sw.js',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
        ],
      },
      {
        // API routes - NEVER cache, always fresh data for reservations
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, proxy-revalidate',
          },
          {
            key: 'Pragma',
            value: 'no-cache',
          },
          {
            key: 'Expires',
            value: '0',
          },
        ],
      },
    ]
  },
}

export default nextConfig

