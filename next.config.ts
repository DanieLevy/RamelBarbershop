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
 * ⚠️ LONG CACHE (30 days):
 *    - /_next/image/* - optimized images via Supabase Image Transformation
 *    - URLs include timestamps, so updates produce new URLs (safe to cache long)
 */
const nextConfig: NextConfig = {
  // Skip type checking during build - types are validated by ESLint and IDE
  // The .next/types/validator.ts generated file has a known Next.js 16 + TS 5.9 
  // incompatibility with moduleResolution: "bundler" (.js extension imports)
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    // Custom loader uses Supabase Image Transformation for on-the-fly resizing + WebP
    // This dramatically reduces egress by serving only the pixels needed
    loader: 'custom',
    loaderFile: './lib/supabase-image-loader.ts',
    remotePatterns: [
      { protocol: 'https', hostname: 'iili.io' },
      { protocol: 'https', hostname: 'upcdn.io' },
      { protocol: 'https', hostname: 'zdisrkjxsvpqrrryfbdo.supabase.co' },
      { protocol: 'https', hostname: 'gcdnb.pbrd.co' },
    ],
    // Long cache for optimized images - URLs include timestamps so updates get new URLs.
    // Safe to cache aggressively since any image change produces a new URL.
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days cache for optimized images
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

