'use client'

import { useEffect, useState, useRef } from 'react'
import { useBarberAuthStore } from '@/store/useBarberAuthStore'
import { createClient } from '@/lib/supabase/client'
import { uploadGalleryImage, deleteGalleryImage } from '@/lib/storage/upload'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Images, Upload, Trash2, GripVertical, Plus, Info, Loader2 } from 'lucide-react'
import Image from 'next/image'
import type { BarberGalleryImage } from '@/types/database'
import { useBugReporter } from '@/hooks/useBugReporter'

const MAX_GALLERY_IMAGES = 10

export default function GalleryPage() {
  const { report } = useBugReporter('GalleryPage')
  const { barber } = useBarberAuthStore()
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [images, setImages] = useState<BarberGalleryImage[]>([])
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (barber?.id) {
      fetchGalleryImages()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barber?.id])

  const fetchGalleryImages = async () => {
    if (!barber?.id) return
    
    const supabase = createClient()
    const { data, error } = await supabase
      .from('barber_gallery')
      .select('*')
      .eq('barber_id', barber.id)
      .order('display_order', { ascending: true })
    
    if (error) {
      console.error('Error fetching gallery:', error)
      await report(new Error(error.message), 'Fetching gallery images')
      toast.error('שגיאה בטעינת הגלריה')
    } else {
      setImages(data || [])
    }
    
    setLoading(false)
  }

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0 || !barber?.id) return
    
    if (images.length + files.length > MAX_GALLERY_IMAGES) {
      toast.error(`ניתן להעלות עד ${MAX_GALLERY_IMAGES} תמונות`)
      return
    }
    
    setUploading(true)
    
    const newImages: BarberGalleryImage[] = []
    const supabase = createClient()
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name} אינו קובץ תמונה`)
        continue
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name} גדול מדי (מקסימום 5MB)`)
        continue
      }
      
      const result = await uploadGalleryImage(file, barber.id)
      
      if (result.success && result.url) {
        // Save to database
        const { data, error } = await supabase
          .from('barber_gallery')
          .insert({
            barber_id: barber.id,
            image_url: result.url,
            display_order: images.length + newImages.length,
          })
          .select()
          .single()
        
        if (error) {
          console.error('Error saving gallery image:', error)
          await report(new Error(error.message), 'Saving gallery image to database')
          toast.error('שגיאה בשמירת התמונה')
        } else if (data) {
          newImages.push(data)
        }
      } else {
        toast.error(result.error || 'שגיאה בהעלאת התמונה')
      }
    }
    
    if (newImages.length > 0) {
      setImages([...images, ...newImages])
      toast.success(`${newImages.length} תמונות הועלו בהצלחה!`)
    }
    
    setUploading(false)
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleDeleteImage = async (imageId: string) => {
    if (!confirm('האם למחוק את התמונה?')) return
    
    // Find the image to get its URL
    const imageToDelete = images.find(img => img.id === imageId)
    if (!imageToDelete) return
    
    const supabase = createClient()
    
    // Delete from database first
    const { error } = await supabase
      .from('barber_gallery')
      .delete()
      .eq('id', imageId)
    
    if (error) {
      console.error('Error deleting image:', error)
      await report(new Error(error.message), 'Deleting gallery image from database')
      toast.error('שגיאה במחיקת התמונה')
      return
    }
    
    // Extract storage path from URL and delete from storage
    // URL format: https://xxx.supabase.co/storage/v1/object/public/gallery/barberId/timestamp-random.ext
    try {
      const url = new URL(imageToDelete.image_url)
      const pathMatch = url.pathname.match(/\/storage\/v1\/object\/public\/gallery\/(.+)/)
      if (pathMatch && pathMatch[1]) {
        const storagePath = pathMatch[1]
        await deleteGalleryImage(storagePath)
      }
    } catch (storageError) {
      // Log but don't fail - DB record is already deleted
      console.error('Error deleting from storage:', storageError)
      await report(storageError, 'Deleting gallery image from storage')
    }
    
    setImages(images.filter(img => img.id !== imageId))
    toast.success('התמונה נמחקה')
  }

  const handleDragStart = (index: number) => {
    setDraggedIndex(index)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === index) return
    
    const newImages = [...images]
    const draggedImage = newImages[draggedIndex]
    newImages.splice(draggedIndex, 1)
    newImages.splice(index, 0, draggedImage)
    
    setImages(newImages)
    setDraggedIndex(index)
  }

  const handleDragEnd = async () => {
    setDraggedIndex(null)
    
    // Update display order in database
    const supabase = createClient()
    
    for (let i = 0; i < images.length; i++) {
      if (images[i].display_order !== i) {
        await supabase
          .from('barber_gallery')
          .update({ display_order: i })
          .eq('id', images[i].id)
      }
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-accent-gold border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-medium text-foreground-light flex items-center gap-3">
          <Images size={24} className="text-accent-gold" />
          גלריית עבודות
        </h1>
        <p className="text-foreground-muted mt-1">
          הוסף תמונות של עבודות שלך - הן יוצגו בעמוד הפרופיל שלך
        </p>
      </div>

      {/* Info Card */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 mb-6">
        <div className="flex gap-3">
          <Info size={20} className="text-blue-400 shrink-0 mt-0.5" />
          <div className="text-sm text-blue-300">
            <p className="font-medium mb-1">איך זה עובד?</p>
            <ul className="space-y-1 text-blue-300/80">
              <li>• התמונות יוצגו כסליידר אוטומטי בעמוד הפרופיל שלך</li>
              <li>• גרור את התמונות כדי לשנות את הסדר</li>
              <li>• עד {MAX_GALLERY_IMAGES} תמונות, מקסימום 5MB לתמונה</li>
              <li>• אם אין תמונות בגלריה, תוצג תמונת הפרופיל שלך</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Upload Section */}
      <div className="bg-background-card border border-white/10 rounded-2xl p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-foreground-light">
            תמונות ({images.length}/{MAX_GALLERY_IMAGES})
          </h3>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || images.length >= MAX_GALLERY_IMAGES}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all',
              uploading || images.length >= MAX_GALLERY_IMAGES
                ? 'bg-foreground-muted/20 text-foreground-muted cursor-not-allowed'
                : 'bg-accent-gold text-background-dark hover:bg-accent-gold/90'
            )}
          >
            {uploading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Plus size={18} />
            )}
            {uploading ? 'מעלה...' : 'הוסף תמונות'}
          </button>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={handleImageUpload}
          className="hidden"
        />

        {/* Gallery Grid */}
        {images.length === 0 ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-white/10 rounded-xl p-12 text-center cursor-pointer hover:border-accent-gold/30 transition-colors"
          >
            <Upload size={48} className="mx-auto text-foreground-muted mb-4" />
            <p className="text-foreground-light mb-2">לחץ להעלאת תמונות</p>
            <p className="text-foreground-muted text-sm">
              JPEG, PNG או WebP • עד 5MB לתמונה
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {images.map((image, index) => (
              <div
                key={image.id}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className={cn(
                  'relative aspect-square rounded-xl overflow-hidden border-2 transition-all cursor-grab active:cursor-grabbing',
                  draggedIndex === index
                    ? 'border-accent-gold scale-105 shadow-gold-lg'
                    : 'border-white/10 hover:border-white/20'
                )}
              >
                <Image
                  src={image.image_url}
                  alt={`תמונה ${index + 1}`}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 50vw, 25vw"
                />
                
                {/* Overlay with actions */}
                <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <div className="absolute top-2 left-2 p-1.5 bg-background-dark/80 rounded-lg">
                    <GripVertical size={16} className="text-foreground-muted" />
                  </div>
                  <button
                    onClick={() => handleDeleteImage(image.id)}
                    className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                    aria-label="מחק תמונה"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
                
                {/* Order number */}
                <div className="absolute bottom-2 right-2 w-6 h-6 bg-background-dark/80 rounded-full flex items-center justify-center text-xs text-foreground-light">
                  {index + 1}
                </div>
              </div>
            ))}
            
            {/* Add more button */}
            {images.length < MAX_GALLERY_IMAGES && (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="aspect-square rounded-xl border-2 border-dashed border-white/10 hover:border-accent-gold/30 transition-colors flex flex-col items-center justify-center gap-2 text-foreground-muted hover:text-accent-gold"
              >
                {uploading ? (
                  <Loader2 size={24} className="animate-spin" />
                ) : (
                  <Plus size={24} />
                )}
                <span className="text-xs">הוסף</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Preview Info */}
      {images.length > 0 && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
          <p className="text-emerald-300 text-sm">
            ✓ הגלריה מוכנה! התמונות יוצגו כסליידר אוטומטי בעמוד הפרופיל שלך
          </p>
        </div>
      )}
    </div>
  )
}
