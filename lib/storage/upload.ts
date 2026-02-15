import { createClient } from '@/lib/supabase/client'
import { reportBug, getEnvironmentInfo } from '@/lib/bug-reporter'

const AVATARS_BUCKET = 'avatars'
const PRODUCTS_BUCKET = 'products'
const GALLERY_BUCKET = 'gallery'

export interface UploadResult {
  success: boolean
  url?: string
  path?: string
  error?: string
}

/**
 * Upload an avatar image for a barber
 * @param file - The file to upload
 * @param barberId - The barber's ID (used for folder structure)
 * @returns Upload result with public URL
 */
export async function uploadAvatar(file: File, barberId: string): Promise<UploadResult> {
  try {
    const supabase = createClient()
    
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowedTypes.includes(file.type)) {
      return { 
        success: false, 
        error: 'סוג קובץ לא נתמך. יש להעלות תמונה בפורמט JPEG, PNG, WebP או GIF.' 
      }
    }
    
    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      return { 
        success: false, 
        error: 'גודל הקובץ חייב להיות עד 5MB' 
      }
    }
    
    // Generate unique filename with timestamp
    const ext = file.name.split('.').pop() || 'jpg'
    const timestamp = Date.now()
    const fileName = `${barberId}/${timestamp}.${ext}`
    
    // Upload to Supabase Storage
    // Cache for 1 year - URLs include timestamps so new uploads always produce new URLs
    const { data, error } = await supabase.storage
      .from(AVATARS_BUCKET)
      .upload(fileName, file, {
        cacheControl: '31536000',
        upsert: true, // Overwrite if exists
      })
    
    if (error) {
      console.error('Storage upload error:', error)
      await reportBug(new Error(error.message), 'Avatar upload to storage', {
        environment: getEnvironmentInfo(),
        additionalData: { bucket: AVATARS_BUCKET, barberId, fileType: file.type, fileSize: file.size },
        severity: 'high',
      })
      return { 
        success: false, 
        error: `שגיאה בהעלאת התמונה: ${error.message}` 
      }
    }
    
    // Get public URL
    const { data: urlData } = supabase.storage
      .from(AVATARS_BUCKET)
      .getPublicUrl(data.path)
    
    return {
      success: true,
      url: urlData.publicUrl,
      path: data.path,
    }
  } catch (err) {
    console.error('Unexpected upload error:', err)
    await reportBug(err, 'Unexpected avatar upload error', {
      environment: getEnvironmentInfo(),
      severity: 'high',
    })
    return { 
      success: false, 
      error: 'שגיאה בלתי צפויה בהעלאת התמונה' 
    }
  }
}

/**
 * Delete an avatar image
 * @param path - The storage path of the image
 */
export async function deleteAvatar(path: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient()
    
    const { error } = await supabase.storage
      .from(AVATARS_BUCKET)
      .remove([path])
    
    if (error) {
      console.error('Storage delete error:', error)
      await reportBug(new Error(error.message), 'Avatar delete from storage', {
        environment: getEnvironmentInfo(),
        additionalData: { bucket: AVATARS_BUCKET, path },
        severity: 'medium',
      })
      return { 
        success: false, 
        error: `שגיאה במחיקת התמונה: ${error.message}` 
      }
    }
    
    return { success: true }
  } catch (err) {
    console.error('Unexpected delete error:', err)
    await reportBug(err, 'Unexpected avatar delete error', {
      environment: getEnvironmentInfo(),
      severity: 'medium',
    })
    return { 
      success: false, 
      error: 'שגיאה בלתי צפויה במחיקת התמונה' 
    }
  }
}

/**
 * Get public URL for a storage path
 * @param path - The storage path
 */
export function getAvatarUrl(path: string): string {
  const supabase = createClient()
  const { data } = supabase.storage.from(AVATARS_BUCKET).getPublicUrl(path)
  return data.publicUrl
}

/**
 * Check if a URL is from Supabase Storage
 * @param url - The URL to check
 */
export function isSupabaseStorageUrl(url: string): boolean {
  return url.includes('supabase.co/storage')
}

// ============================================
// Product Image Upload Functions
// ============================================

/**
 * Upload a product image
 * @param file - The file to upload
 * @param productId - The product's ID (used for folder structure)
 * @returns Upload result with public URL
 */
export async function uploadProductImage(file: File, productId: string): Promise<UploadResult> {
  try {
    const supabase = createClient()
    
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
    if (!allowedTypes.includes(file.type)) {
      return { 
        success: false, 
        error: 'סוג קובץ לא נתמך. יש להעלות תמונה בפורמט JPEG, PNG או WebP.' 
      }
    }
    
    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      return { 
        success: false, 
        error: 'גודל הקובץ חייב להיות עד 5MB' 
      }
    }
    
    // Generate unique filename with timestamp
    const ext = file.name.split('.').pop() || 'jpg'
    const timestamp = Date.now()
    const fileName = `${productId}/${timestamp}.${ext}`
    
    // Upload to Supabase Storage
    // Cache for 1 year - URLs include timestamps so new uploads always produce new URLs
    const { data, error } = await supabase.storage
      .from(PRODUCTS_BUCKET)
      .upload(fileName, file, {
        cacheControl: '31536000',
        upsert: true,
      })
    
    if (error) {
      console.error('Product image upload error:', error)
      await reportBug(new Error(error.message), 'Product image upload to storage', {
        environment: getEnvironmentInfo(),
        additionalData: { bucket: PRODUCTS_BUCKET, productId, fileType: file.type, fileSize: file.size },
        severity: 'high',
      })
      return { 
        success: false, 
        error: `שגיאה בהעלאת התמונה: ${error.message}` 
      }
    }
    
    // Get public URL
    const { data: urlData } = supabase.storage
      .from(PRODUCTS_BUCKET)
      .getPublicUrl(data.path)
    
    return {
      success: true,
      url: urlData.publicUrl,
      path: data.path,
    }
  } catch (err) {
    console.error('Unexpected product upload error:', err)
    await reportBug(err, 'Unexpected product image upload error', {
      environment: getEnvironmentInfo(),
      severity: 'high',
    })
    return { 
      success: false, 
      error: 'שגיאה בלתי צפויה בהעלאת התמונה' 
    }
  }
}

/**
 * Delete a product image
 * @param path - The storage path of the image
 */
export async function deleteProductImage(path: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient()
    
    const { error } = await supabase.storage
      .from(PRODUCTS_BUCKET)
      .remove([path])
    
    if (error) {
      console.error('Product image delete error:', error)
      await reportBug(new Error(error.message), 'Product image delete from storage', {
        environment: getEnvironmentInfo(),
        additionalData: { bucket: PRODUCTS_BUCKET, path },
        severity: 'medium',
      })
      return { 
        success: false, 
        error: `שגיאה במחיקת התמונה: ${error.message}` 
      }
    }
    
    return { success: true }
  } catch (err) {
    console.error('Unexpected product delete error:', err)
    await reportBug(err, 'Unexpected product image delete error', {
      environment: getEnvironmentInfo(),
      severity: 'medium',
    })
    return { 
      success: false, 
      error: 'שגיאה בלתי צפויה במחיקת התמונה' 
    }
  }
}

/**
 * Get public URL for a product image path
 * @param path - The storage path
 */
export function getProductImageUrl(path: string): string {
  const supabase = createClient()
  const { data } = supabase.storage.from(PRODUCTS_BUCKET).getPublicUrl(path)
  return data.publicUrl
}

// ============================================
// Gallery Image Upload Functions
// ============================================

/**
 * Upload a gallery image for a barber
 * @param file - The file to upload
 * @param barberId - The barber's ID (used for folder structure)
 * @returns Upload result with public URL
 */
export async function uploadGalleryImage(file: File, barberId: string): Promise<UploadResult> {
  try {
    const supabase = createClient()
    
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
    if (!allowedTypes.includes(file.type)) {
      return { 
        success: false, 
        error: 'סוג קובץ לא נתמך. יש להעלות תמונה בפורמט JPEG, PNG או WebP.' 
      }
    }
    
    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      return { 
        success: false, 
        error: 'גודל הקובץ חייב להיות עד 5MB' 
      }
    }
    
    // Generate unique filename with timestamp and random suffix
    const ext = file.name.split('.').pop() || 'jpg'
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 8)
    const fileName = `${barberId}/${timestamp}-${random}.${ext}`
    
    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(GALLERY_BUCKET)
      .upload(fileName, file, {
        cacheControl: '31536000', // 1 year cache for gallery images
        upsert: false, // Don't overwrite
      })
    
    if (error) {
      console.error('Gallery image upload error:', error)
      await reportBug(new Error(error.message), 'Gallery image upload to storage', {
        environment: getEnvironmentInfo(),
        additionalData: { bucket: GALLERY_BUCKET, barberId, fileType: file.type, fileSize: file.size },
        severity: 'high',
      })
      return { 
        success: false, 
        error: `שגיאה בהעלאת התמונה: ${error.message}` 
      }
    }
    
    // Get public URL
    const { data: urlData } = supabase.storage
      .from(GALLERY_BUCKET)
      .getPublicUrl(data.path)
    
    return {
      success: true,
      url: urlData.publicUrl,
      path: data.path,
    }
  } catch (err) {
    console.error('Unexpected gallery upload error:', err)
    await reportBug(err, 'Unexpected gallery image upload error', {
      environment: getEnvironmentInfo(),
      severity: 'high',
    })
    return { 
      success: false, 
      error: 'שגיאה בלתי צפויה בהעלאת התמונה' 
    }
  }
}

/**
 * Delete a gallery image
 * @param path - The storage path of the image
 */
export async function deleteGalleryImage(path: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient()
    
    const { error } = await supabase.storage
      .from(GALLERY_BUCKET)
      .remove([path])
    
    if (error) {
      console.error('Gallery image delete error:', error)
      await reportBug(new Error(error.message), 'Gallery image delete from storage', {
        environment: getEnvironmentInfo(),
        additionalData: { bucket: GALLERY_BUCKET, path },
        severity: 'medium',
      })
      return { 
        success: false, 
        error: `שגיאה במחיקת התמונה: ${error.message}` 
      }
    }
    
    return { success: true }
  } catch (err) {
    console.error('Unexpected gallery delete error:', err)
    await reportBug(err, 'Unexpected gallery image delete error', {
      environment: getEnvironmentInfo(),
      severity: 'medium',
    })
    return { 
      success: false, 
      error: 'שגיאה בלתי צפויה במחיקת התמונה' 
    }
  }
}

