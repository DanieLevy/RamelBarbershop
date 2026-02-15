/**
 * Supabase Image Loader for Next.js
 * 
 * Leverages Supabase Image Transformation to serve optimized, resized images.
 * This reduces egress significantly by:
 * 1. Serving images at the exact size needed (not original 5MB uploads)
 * 2. Automatic WebP conversion for supported browsers
 * 3. Quality optimization (default 75%)
 * 
 * Used by next.config.ts as the custom image loader.
 * 
 * @see https://supabase.com/docs/guides/storage/serving/image-transformations
 */

const PROJECT_ID = 'zdisrkjxsvpqrrryfbdo'

type ImageLoaderParams = {
  src: string
  width: number
  quality?: number
}

const supabaseImageLoader = ({ src, width, quality }: ImageLoaderParams): string => {
  // Only transform Supabase Storage URLs
  if (src.includes(`${PROJECT_ID}.supabase.co/storage`)) {
    // Convert /object/public/ to /render/image/public/ for transformation
    const transformedSrc = src.replace(
      '/storage/v1/object/public/',
      '/storage/v1/render/image/public/'
    )

    // If URL already has render path, use it
    const baseUrl = transformedSrc.includes('/render/image/')
      ? transformedSrc
      : src.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/')

    // Add transformation params
    const separator = baseUrl.includes('?') ? '&' : '?'
    return `${baseUrl}${separator}width=${width}&quality=${quality || 75}`
  }

  // For non-Supabase images, return as-is with width param if external CDN
  if (src.startsWith('http')) {
    return src
  }

  // For local images, return as-is
  return src
}

export default supabaseImageLoader
