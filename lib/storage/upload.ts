/**
 * Image Upload/Delete utilities — Cloudflare R2 via API routes.
 *
 * All uploads go through /api/barber/r2/upload (FormData).
 * All deletes go through /api/barber/r2/delete (JSON).
 * The API routes handle auth verification and S3-compatible R2 operations.
 */

const R2_PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? process.env.R2_PUBLIC_URL ?? ''

export interface UploadResult {
  success: boolean
  url?: string
  key?: string
  error?: string
}

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/jpg']
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 MB

const validateFile = (file: File): string | null => {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return 'סוג קובץ לא נתמך. יש להעלות תמונה בפורמט JPEG, PNG, WebP או GIF.'
  }
  if (file.size > MAX_FILE_SIZE) {
    return 'גודל הקובץ חייב להיות עד 5MB'
  }
  return null
}

const uploadToR2 = async (
  file: File,
  key: string,
  barberId: string
): Promise<UploadResult> => {
  const formData = new FormData()
  formData.append('barberId', barberId)
  formData.append('key', key)
  formData.append('file', file)

  const res = await fetch('/api/barber/r2/upload', {
    method: 'POST',
    body: formData,
  })

  const data = await res.json().catch(() => null)

  if (!res.ok || !data?.success) {
    const message = data?.message ?? 'שגיאה בהעלאת התמונה'
    console.error('[R2 Upload]', data?.error ?? res.status, message)
    return { success: false, error: message }
  }

  return { success: true, url: data.data.url, key: data.data.key }
}

const deleteFromR2 = async (
  key: string,
  barberId: string
): Promise<{ success: boolean; error?: string }> => {
  const res = await fetch('/api/barber/r2/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ barberId, key }),
  })

  const data = await res.json().catch(() => null)

  if (!res.ok || !data?.success) {
    const message = data?.message ?? 'שגיאה במחיקת התמונה'
    console.error('[R2 Delete]', data?.error ?? res.status, message)
    return { success: false, error: message }
  }

  return { success: true }
}

/**
 * Extracts the R2 object key from a full public R2 URL.
 * Returns undefined if the URL is not an R2 URL.
 */
export const extractR2Key = (url: string): string | undefined => {
  const base = R2_PUBLIC_URL.replace(/\/$/, '')
  if (!base || !url.startsWith(base)) return undefined
  return url.slice(base.length + 1)
}

// ── Avatar ──

export const uploadAvatar = async (file: File, barberId: string): Promise<UploadResult> => {
  const validationError = validateFile(file)
  if (validationError) return { success: false, error: validationError }

  const ext = file.name.split('.').pop() || 'jpg'
  const key = `avatars/${barberId}/${Date.now()}.${ext}`
  return uploadToR2(file, key, barberId)
}

export const deleteAvatar = async (url: string, barberId: string) => {
  const key = extractR2Key(url)
  if (!key) return { success: false, error: 'Invalid image URL' }
  return deleteFromR2(key, barberId)
}

// ── Product ──

export const uploadProductImage = async (file: File, productId: string, barberId: string): Promise<UploadResult> => {
  const validationError = validateFile(file)
  if (validationError) return { success: false, error: validationError }

  const ext = file.name.split('.').pop() || 'jpg'
  const key = `products/${productId}/${Date.now()}.${ext}`
  return uploadToR2(file, key, barberId)
}

export const deleteProductImage = async (url: string, barberId: string) => {
  const key = extractR2Key(url)
  if (!key) return { success: false, error: 'Invalid image URL' }
  return deleteFromR2(key, barberId)
}

// ── Gallery ──

export const uploadGalleryImage = async (file: File, barberId: string): Promise<UploadResult> => {
  const validationError = validateFile(file)
  if (validationError) return { success: false, error: validationError }

  const ext = file.name.split('.').pop() || 'jpg'
  const random = Math.random().toString(36).substring(2, 8)
  const key = `gallery/${barberId}/${Date.now()}-${random}.${ext}`
  return uploadToR2(file, key, barberId)
}

export const deleteGalleryImage = async (url: string, barberId: string) => {
  const key = extractR2Key(url)
  if (!key) return { success: false, error: 'Invalid image URL' }
  return deleteFromR2(key, barberId)
}

/**
 * Check if a URL is from R2 storage.
 */
export const isR2StorageUrl = (url: string): boolean => {
  const base = R2_PUBLIC_URL.replace(/\/$/, '')
  return !!base && url.startsWith(base)
}

/**
 * @deprecated Use isR2StorageUrl instead. Kept for backward compatibility.
 */
export const isSupabaseStorageUrl = (url: string): boolean =>
  url.includes('supabase.co/storage')
