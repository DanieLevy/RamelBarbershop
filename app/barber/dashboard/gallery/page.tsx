'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useBarberAuthStore } from '@/store/useBarberAuthStore'
import { createClient } from '@/lib/supabase/client'
import { uploadGalleryImage, deleteGalleryImage } from '@/lib/storage/upload'
import { showToast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { Images, Upload, Trash2, GripVertical, Plus, Info, Loader2, Move, X, Check, RotateCcw } from 'lucide-react'
import Image from 'next/image'
import type { BarberGalleryImage } from '@/types/database'
import { useBugReporter } from '@/hooks/useBugReporter'
import { Button } from '@heroui/react'

const MAX_GALLERY_IMAGES = 10

export default function GalleryPage() {
  const { report } = useBugReporter('GalleryPage')
  const { barber } = useBarberAuthStore()
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [images, setImages] = useState<BarberGalleryImage[]>([])
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Position editor state
  const [positionModal, setPositionModal] = useState<{
    isOpen: boolean
    image: BarberGalleryImage | null
    posX: number
    posY: number
  }>({ isOpen: false, image: null, posX: 50, posY: 50 })
  const [savingPosition, setSavingPosition] = useState(false)
  const positionEditorRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)

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
      showToast.error('שגיאה בטעינת הגלריה')
    } else {
      setImages(data || [])
    }
    
    setLoading(false)
  }

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0 || !barber?.id) return
    
    if (images.length + files.length > MAX_GALLERY_IMAGES) {
      showToast.error(`ניתן להעלות עד ${MAX_GALLERY_IMAGES} תמונות`)
      return
    }
    
    setUploading(true)
    
    const newImages: BarberGalleryImage[] = []
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      
      // Validate file type
      if (!file.type.startsWith('image/')) {
        showToast.error(`${file.name} אינו קובץ תמונה`)
        continue
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        showToast.error(`${file.name} גדול מדי (מקסימום 5MB)`)
        continue
      }
      
      const result = await uploadGalleryImage(file, barber.id)
      
      if (result.success && result.url) {
        // Save to database via API route
        try {
          const res = await fetch('/api/barber/gallery', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              barberId: barber.id,
              image_url: result.url,
              display_order: images.length + newImages.length,
            }),
          })
          const apiResult = await res.json()
          
          if (!apiResult.success) {
            console.error('Error saving gallery image:', apiResult.message)
            await report(new Error(apiResult.message || 'Gallery save failed'), 'Saving gallery image to database')
            showToast.error('שגיאה בשמירת התמונה')
          } else if (apiResult.data) {
            newImages.push(apiResult.data)
          }
        } catch (err) {
          console.error('Error saving gallery image:', err)
          await report(err, 'Saving gallery image to database')
          showToast.error('שגיאה בשמירת התמונה')
        }
      } else {
        showToast.error(result.error || 'שגיאה בהעלאת התמונה')
      }
    }
    
    if (newImages.length > 0) {
      setImages([...images, ...newImages])
      showToast.success(`${newImages.length} תמונות הועלו בהצלחה!`)
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
    
    // Delete from database first via API route
    try {
      const res = await fetch('/api/barber/gallery', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barberId: barber?.id, imageId }),
      })
      const result = await res.json()
      
      if (!result.success) {
        console.error('Error deleting image:', result.message)
        await report(new Error(result.message || 'Gallery delete failed'), 'Deleting gallery image from database')
        showToast.error('שגיאה במחיקת התמונה')
        return
      }
    } catch (err) {
      console.error('Error deleting image:', err)
      await report(err, 'Deleting gallery image from database')
      showToast.error('שגיאה במחיקת התמונה')
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
    showToast.success('התמונה נמחקה')
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
    
    // Update display order in database via API route
    const changedImages = images
      .map((img, i) => ({ id: img.id, display_order: i }))
      .filter((img, i) => images[i].display_order !== i)

    if (changedImages.length > 0) {
      try {
        await fetch('/api/barber/gallery', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ barberId: barber?.id, images: changedImages }),
        })
      } catch (err) {
        console.error('Error updating gallery order:', err)
      }
    }
  }

  // Position Editor Handlers
  const openPositionEditor = (image: BarberGalleryImage) => {
    setPositionModal({
      isOpen: true,
      image,
      posX: image.position_x ?? 50,
      posY: image.position_y ?? 50,
    })
  }

  const closePositionEditor = () => {
    setPositionModal({ isOpen: false, image: null, posX: 50, posY: 50 })
  }

  const handlePositionMove = useCallback((clientX: number, clientY: number) => {
    if (!positionEditorRef.current) return
    
    const rect = positionEditorRef.current.getBoundingClientRect()
    const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100))
    const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100))
    
    setPositionModal(prev => ({ ...prev, posX: Math.round(x), posY: Math.round(y) }))
  }, [])

  const handlePositionMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
    handlePositionMove(e.clientX, e.clientY)
  }

  const handlePositionMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging) {
      handlePositionMove(e.clientX, e.clientY)
    }
  }, [isDragging, handlePositionMove])

  const handlePositionMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handlePositionTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true)
    const touch = e.touches[0]
    handlePositionMove(touch.clientX, touch.clientY)
  }

  const handlePositionTouchMove = useCallback((e: TouchEvent) => {
    if (isDragging && e.touches[0]) {
      handlePositionMove(e.touches[0].clientX, e.touches[0].clientY)
    }
  }, [isDragging, handlePositionMove])

  // Add/remove global event listeners for position dragging
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handlePositionMouseMove)
      window.addEventListener('mouseup', handlePositionMouseUp)
      window.addEventListener('touchmove', handlePositionTouchMove)
      window.addEventListener('touchend', handlePositionMouseUp)
    }
    
    return () => {
      window.removeEventListener('mousemove', handlePositionMouseMove)
      window.removeEventListener('mouseup', handlePositionMouseUp)
      window.removeEventListener('touchmove', handlePositionTouchMove)
      window.removeEventListener('touchend', handlePositionMouseUp)
    }
  }, [isDragging, handlePositionMouseMove, handlePositionMouseUp, handlePositionTouchMove])

  const handleSavePosition = async () => {
    if (!positionModal.image) return
    
    setSavingPosition(true)
    
    try {
      const res = await fetch('/api/barber/gallery', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          barberId: barber?.id,
          imageId: positionModal.image.id,
          position_x: positionModal.posX,
          position_y: positionModal.posY,
        }),
      })
      const result = await res.json()
      
      if (!result.success) {
        console.error('Error saving position:', result.message)
        await report(new Error(result.message || 'Position save failed'), 'Saving gallery image position')
        showToast.error('שגיאה בשמירת המיקום')
      } else {
        // Update local state
        setImages(images.map(img => 
          img.id === positionModal.image?.id 
            ? { ...img, position_x: positionModal.posX, position_y: positionModal.posY }
            : img
        ))
        showToast.success('מיקום התמונה נשמר!')
        closePositionEditor()
      }
    } catch (err) {
      console.error('Error saving position:', err)
      await report(err, 'Saving gallery image position')
      showToast.error('שגיאה בשמירת המיקום')
    }
    
    setSavingPosition(false)
  }

  const handleResetPosition = () => {
    setPositionModal(prev => ({ ...prev, posX: 50, posY: 50 }))
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
              <li>• לחץ על <Move size={12} className="inline mx-1" /> כדי לכוון את מיקום התמונה</li>
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
          <Button
            onPress={() => fileInputRef.current?.click()}
            isDisabled={uploading || images.length >= MAX_GALLERY_IMAGES}
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
          </Button>
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
                  style={{ objectPosition: `${image.position_x ?? 50}% ${image.position_y ?? 50}%` }}
                  sizes="(max-width: 640px) 50vw, 25vw"
                />
                
                {/* Overlay with actions */}
                <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <div className="absolute top-2 left-2 p-1.5 bg-background-dark/80 rounded-lg">
                    <GripVertical size={16} className="text-foreground-muted" />
                  </div>
                  
                  {/* Position button */}
                  <Button
                    onPress={() => openPositionEditor(image)}
                    isIconOnly
                    className="min-w-[36px] w-9 h-9 p-2 bg-accent-gold text-background-dark rounded-lg hover:bg-accent-gold/90 transition-colors"
                    aria-label="כוון מיקום התמונה"
                  >
                    <Move size={18} />
                  </Button>
                  
                  {/* Delete button */}
                  <Button
                    onPress={() => handleDeleteImage(image.id)}
                    isIconOnly
                    className="min-w-[36px] w-9 h-9 p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                    aria-label="מחק תמונה"
                  >
                    <Trash2 size={18} />
                  </Button>
                </div>
                
                {/* Order number + position indicator */}
                <div className="absolute bottom-2 right-2 flex items-center gap-1">
                  {(image.position_x !== null && image.position_x !== 50) || (image.position_y !== null && image.position_y !== 50) ? (
                    <div className="w-5 h-5 bg-accent-gold/80 rounded-full flex items-center justify-center" title="מיקום מותאם">
                      <Move size={10} className="text-background-dark" />
                    </div>
                  ) : null}
                  <div className="w-6 h-6 bg-background-dark/80 rounded-full flex items-center justify-center text-xs text-foreground-light">
                    {index + 1}
                  </div>
                </div>
              </div>
            ))}
            
            {/* Add more button */}
            {images.length < MAX_GALLERY_IMAGES && (
              <Button
                onPress={() => fileInputRef.current?.click()}
                isDisabled={uploading}
                variant="ghost"
                className="aspect-square rounded-xl border-2 border-dashed border-white/10 hover:border-accent-gold/30 transition-colors flex flex-col items-center justify-center gap-2 text-foreground-muted hover:text-accent-gold"
              >
                {uploading ? (
                  <Loader2 size={24} className="animate-spin" />
                ) : (
                  <Plus size={24} />
                )}
                <span className="text-xs">הוסף</span>
              </Button>
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

      {/* Position Editor Modal */}
      {positionModal.isOpen && positionModal.image && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={closePositionEditor}
          />
          
          {/* Modal */}
          <div className="relative w-full max-w-md bg-background-card border border-white/10 rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-foreground-light flex items-center gap-2">
                <Move size={18} className="text-accent-gold" />
                מיקום התמונה
              </h3>
              <Button
                onPress={closePositionEditor}
                isIconOnly
                variant="ghost"
                className="min-w-[36px] w-9 h-9 p-2 hover:bg-white/10 rounded-lg transition-colors"
                aria-label="סגור"
              >
                <X size={20} className="text-foreground-muted" />
              </Button>
            </div>
            
            {/* Instructions */}
            <p className="text-foreground-muted text-sm mb-4 text-center">
              גרור את הנקודה כדי לבחור את מוקד התמונה
            </p>
            
            {/* Position Editor */}
            <div
              ref={positionEditorRef}
              className={cn(
                'relative aspect-[4/3] w-full rounded-xl overflow-hidden cursor-crosshair mb-4',
                'border-2 border-dashed transition-colors',
                isDragging ? 'border-accent-gold' : 'border-white/20'
              )}
              onMouseDown={handlePositionMouseDown}
              onTouchStart={handlePositionTouchStart}
            >
              {/* Image */}
              <Image
                src={positionModal.image.image_url}
                alt="תצוגה מקדימה"
                fill
                className="object-cover pointer-events-none"
                style={{ objectPosition: `${positionModal.posX}% ${positionModal.posY}%` }}
                sizes="400px"
              />
              
              {/* Grid overlay */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/3 left-0 right-0 h-px bg-white/20" />
                <div className="absolute top-2/3 left-0 right-0 h-px bg-white/20" />
                <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/20" />
                <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/20" />
              </div>
              
              {/* Focal Point Indicator */}
              <div
                className="absolute w-8 h-8 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                style={{ left: `${positionModal.posX}%`, top: `${positionModal.posY}%` }}
              >
                <div className="absolute inset-0 rounded-full border-2 border-accent-gold bg-accent-gold/20 animate-pulse" />
                <div className="absolute inset-2 rounded-full bg-accent-gold" />
              </div>
            </div>
            
            {/* Preview - How it will look */}
            <div className="mb-4">
              <p className="text-foreground-muted text-xs text-center mb-2">כך התמונה תיראה בגלריה:</p>
              <div className="flex justify-center gap-3">
                {/* Mobile preview */}
                <div className="text-center">
                  <div className="relative w-16 h-20 rounded-lg overflow-hidden border border-white/10">
                    <Image
                      src={positionModal.image.image_url}
                      alt="תצוגה מקדימה"
                      fill
                      className="object-cover"
                      style={{ objectPosition: `${positionModal.posX}% ${positionModal.posY}%` }}
                      sizes="64px"
                    />
                  </div>
                  <p className="text-[10px] text-foreground-muted mt-1">נייד</p>
                </div>
                {/* Desktop preview */}
                <div className="text-center">
                  <div className="relative w-24 h-16 rounded-lg overflow-hidden border border-white/10">
                    <Image
                      src={positionModal.image.image_url}
                      alt="תצוגה מקדימה"
                      fill
                      className="object-cover"
                      style={{ objectPosition: `${positionModal.posX}% ${positionModal.posY}%` }}
                      sizes="96px"
                    />
                  </div>
                  <p className="text-[10px] text-foreground-muted mt-1">מחשב</p>
                </div>
              </div>
            </div>
            
            {/* Position Display */}
            <div className="flex justify-center gap-4 text-xs text-foreground-muted mb-4">
              <span>X: {positionModal.posX}%</span>
              <span>Y: {positionModal.posY}%</span>
            </div>
            
            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button
                onPress={handleResetPosition}
                isDisabled={positionModal.posX === 50 && positionModal.posY === 50}
                variant="ghost"
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all',
                  'bg-white/5 text-foreground-muted hover:bg-white/10 hover:text-foreground-light',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                <RotateCcw size={14} />
                איפוס
              </Button>
              
              <Button
                onPress={handleSavePosition}
                isDisabled={savingPosition}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all',
                  'bg-accent-gold text-background-dark hover:bg-accent-gold/90',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                {savingPosition ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Check size={14} />
                )}
                {savingPosition ? 'שומר...' : 'שמור מיקום'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
