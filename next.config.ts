import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'iili.io' },
      { protocol: 'https', hostname: 'upcdn.io' },
      { protocol: 'https', hostname: 'zdisrkjxsvpqrrryfbdo.supabase.co' },
      { protocol: 'https', hostname: 'gcdnb.pbrd.co' },
    ],
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
}

export default nextConfig

