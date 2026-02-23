/**
 * Custom Image Loader for Next.js
 *
 * Handles two image sources:
 * 1. **Cloudflare R2** — Images are pre-optimized on upload, so URLs are
 *    returned as-is (R2 CDN handles caching with zero egress).
 * 2. **Supabase Storage** (legacy) — Rewrites to the `/render/image/` endpoint
 *    for on-the-fly transforms. Kept for backward compatibility during migration.
 */

const SUPABASE_PROJECT_ID = 'zdisrkjxsvpqrrryfbdo'
const R2_PUBLIC_HOST = 'pub-7e0259bff3af437b82c83f29dd40ad29.r2.dev'

type ImageLoaderParams = {
  src: string
  width: number
  quality?: number
}

const imageLoader = ({ src, width, quality }: ImageLoaderParams): string => {
  // R2 images — already optimized on upload, serve directly from CDN
  if (src.includes(R2_PUBLIC_HOST)) {
    return src
  }

  // Supabase Storage images (legacy) — apply server-side transforms
  if (src.includes(`${SUPABASE_PROJECT_ID}.supabase.co/storage`)) {
    const transformedSrc = src.replace(
      '/storage/v1/object/public/',
      '/storage/v1/render/image/public/'
    )

    const baseUrl = transformedSrc.includes('/render/image/')
      ? transformedSrc
      : src.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/')

    const separator = baseUrl.includes('?') ? '&' : '?'
    return `${baseUrl}${separator}width=${width}&quality=${quality || 75}`
  }

  // External or local images — return as-is
  return src
}

export default imageLoader
