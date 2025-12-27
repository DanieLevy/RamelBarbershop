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
}

export default nextConfig

