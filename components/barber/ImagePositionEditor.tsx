'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { Move, Check, RotateCcw, Eye } from 'lucide-react'

interface ImagePositionEditorProps {
  imageUrl: string
  initialX?: number
  initialY?: number
  onSave: (x: number, y: number) => Promise<void>
  barberName: string
}

/**
 * Image Position Editor - Allows barbers to adjust their profile image focal point
 * The position determines how the image is cropped in different aspect ratios
 */
export function ImagePositionEditor({
  imageUrl,
  initialX = 50,
  initialY = 30,
  onSave,
  barberName,
}: ImagePositionEditorProps) {
  const [posX, setPosX] = useState(initialX)
  const [posY, setPosY] = useState(initialY)
  const [isDragging, setIsDragging] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const editorRef = useRef<HTMLDivElement>(null)
  
  const hasChanges = posX !== initialX || posY !== initialY

  // Handle mouse/touch movement
  const handleMove = useCallback((clientX: number, clientY: number) => {
    if (!editorRef.current) return
    
    const rect = editorRef.current.getBoundingClientRect()
    const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100))
    const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100))
    
    setPosX(Math.round(x))
    setPosY(Math.round(y))
  }, [])

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
    handleMove(e.clientX, e.clientY)
  }

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging) {
      handleMove(e.clientX, e.clientY)
    }
  }, [isDragging, handleMove])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true)
    const touch = e.touches[0]
    handleMove(touch.clientX, touch.clientY)
  }

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (isDragging && e.touches[0]) {
      handleMove(e.touches[0].clientX, e.touches[0].clientY)
    }
  }, [isDragging, handleMove])

  // Add/remove global event listeners
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      window.addEventListener('touchmove', handleTouchMove)
      window.addEventListener('touchend', handleMouseUp)
    }
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', handleMouseUp)
    }
  }, [isDragging, handleMouseMove, handleMouseUp, handleTouchMove])

  const handleReset = () => {
    setPosX(50)
    setPosY(30)
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await onSave(posX, posY)
    } finally {
      setIsSaving(false)
    }
  }

  const objectPosition = `${posX}% ${posY}%`

  return (
    <div className="space-y-4">
      {/* Editor Label */}
      <div className="flex items-center justify-between">
        <label className="text-foreground-light text-sm flex items-center gap-2">
          <Move size={14} className="text-accent-gold" />
          מיקום התמונה
        </label>
        <button
          type="button"
          onClick={() => setShowPreview(!showPreview)}
          className="text-xs text-foreground-muted hover:text-foreground-light flex items-center gap-1 transition-colors"
        >
          <Eye size={12} />
          {showPreview ? 'הסתר תצוגה מקדימה' : 'הצג תצוגה מקדימה'}
        </button>
      </div>

      {/* Main Editor */}
      <div className="bg-background-dark border border-white/10 rounded-xl p-4 space-y-4">
        {/* Instructions */}
        <p className="text-foreground-muted text-xs text-center">
          גרור את הנקודה כדי לבחור את מוקד התמונה
        </p>

        {/* Draggable Editor Area */}
        <div
          ref={editorRef}
          className={cn(
            'relative aspect-square w-full max-w-[280px] mx-auto rounded-xl overflow-hidden cursor-crosshair',
            'border-2 border-dashed transition-colors',
            isDragging ? 'border-accent-gold' : 'border-white/20'
          )}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
        >
          {/* Image */}
          <Image
            src={imageUrl}
            alt={barberName}
            fill
            className="object-cover pointer-events-none"
            style={{ objectPosition }}
            sizes="280px"
          />
          
          {/* Overlay Grid */}
          <div className="absolute inset-0 pointer-events-none">
            {/* Horizontal lines */}
            <div className="absolute top-1/3 left-0 right-0 h-px bg-white/20" />
            <div className="absolute top-2/3 left-0 right-0 h-px bg-white/20" />
            {/* Vertical lines */}
            <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/20" />
            <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/20" />
          </div>
          
          {/* Focal Point Indicator */}
          <div
            className="absolute w-8 h-8 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            style={{ left: `${posX}%`, top: `${posY}%` }}
          >
            <div className="absolute inset-0 rounded-full border-2 border-accent-gold bg-accent-gold/20 animate-pulse" />
            <div className="absolute inset-2 rounded-full bg-accent-gold" />
          </div>
          
          {/* Corner guides */}
          <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-white/40 rounded-tl" />
          <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-white/40 rounded-tr" />
          <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-white/40 rounded-bl" />
          <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-white/40 rounded-br" />
        </div>

        {/* Position Display */}
        <div className="flex justify-center gap-4 text-xs text-foreground-muted">
          <span>X: {posX}%</span>
          <span>Y: {posY}%</span>
        </div>
      </div>

      {/* Preview Section */}
      {showPreview && (
        <div className="bg-background-dark border border-white/10 rounded-xl p-4 space-y-3">
          <p className="text-foreground-muted text-xs text-center">כך התמונה תיראה:</p>
          
          <div className="flex gap-4 justify-center flex-wrap">
            {/* Card Preview - Portrait aspect ratio matching BarberCard (aspect-[3/4]) */}
            <div className="text-center">
              <p className="text-[10px] text-foreground-muted mb-1">כרטיס בדף הבית</p>
              <div className="relative w-[60px] aspect-[3/4] rounded-lg overflow-hidden border border-white/10">
                <Image
                  src={imageUrl}
                  alt="תצוגה מקדימה"
                  fill
                  className="object-cover"
                  style={{ objectPosition }}
                  sizes="60px"
                />
              </div>
            </div>
            
            {/* Profile Preview - Mobile aspect ratio (aspect-[3/4]) */}
            <div className="text-center">
              <p className="text-[10px] text-foreground-muted mb-1">פרופיל (נייד)</p>
              <div className="relative w-[54px] aspect-[3/4] rounded-lg overflow-hidden border border-white/10">
                <Image
                  src={imageUrl}
                  alt="תצוגה מקדימה"
                  fill
                  className="object-cover"
                  style={{ objectPosition }}
                  sizes="54px"
                />
              </div>
            </div>
            
            {/* Profile Preview - Desktop aspect ratio (aspect-[4/3]) */}
            <div className="text-center">
              <p className="text-[10px] text-foreground-muted mb-1">פרופיל (מחשב)</p>
              <div className="relative w-[80px] aspect-[4/3] rounded-lg overflow-hidden border border-white/10">
                <Image
                  src={imageUrl}
                  alt="תצוגה מקדימה"
                  fill
                  className="object-cover"
                  style={{ objectPosition }}
                  sizes="80px"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleReset}
          disabled={posX === 50 && posY === 30}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all',
            'bg-white/5 text-foreground-muted hover:bg-white/10 hover:text-foreground-light',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          <RotateCcw size={14} />
          איפוס
        </button>
        
        <button
          type="button"
          onClick={handleSave}
          disabled={!hasChanges || isSaving}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all',
            'bg-accent-gold text-background-dark hover:bg-accent-gold/90',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          {isSaving ? (
            <span className="animate-spin">⏳</span>
          ) : (
            <Check size={14} />
          )}
          {isSaving ? 'שומר...' : 'שמור מיקום'}
        </button>
      </div>
    </div>
  )
}
