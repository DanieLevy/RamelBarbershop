'use client'

import { useState } from 'react'
import { RefreshCw, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

interface UpdateModalProps {
  onUpdate: () => void
}

export function UpdateModal({ onUpdate }: UpdateModalProps) {
  const [isUpdating, setIsUpdating] = useState(false)

  const handleUpdate = () => {
    setIsUpdating(true)
    
    // Trigger update after a brief moment for UX
    setTimeout(() => {
      onUpdate()
    }, 500)
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background-dark/95 backdrop-blur-md">
      {/* Decorative background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-1/4 w-1/2 h-1/2 rounded-full bg-accent-gold/5 blur-3xl" />
        <div className="absolute bottom-1/4 -right-1/4 w-1/2 h-1/2 rounded-full bg-accent-gold/5 blur-3xl" />
      </div>

      {/* Modal Content */}
      <div
        className={cn(
          'relative w-full max-w-sm',
          'glass-elevated rounded-3xl',
          'p-8 text-center',
          'animate-fade-in-up'
        )}
      >
        {/* Update Icon with Animation */}
        <div className="relative mx-auto w-24 h-24 mb-6">
          {/* Glow ring */}
          <div className="absolute inset-0 rounded-full bg-accent-gold/20 animate-pulse-gold" />
          
          {/* Icon container */}
          <div className="relative w-full h-full rounded-full bg-gradient-to-br from-accent-gold to-accent-gold-dark flex items-center justify-center shadow-gold-lg">
            <Sparkles size={40} className="text-background-dark" />
          </div>
        </div>

        {/* Title */}
        <h2 className="text-2xl font-bold text-foreground-light mb-2">
          עדכון זמין! ✨
        </h2>

        {/* Description */}
        <p className="text-foreground-muted text-sm mb-8 leading-relaxed">
          גרסה חדשה של האפליקציה זמינה עם שיפורים ותכונות חדשות.
          <br />
          <span className="text-accent-gold font-medium">נא לעדכן כדי להמשיך.</span>
        </p>

        {/* Update Button */}
        <button
          onClick={handleUpdate}
          disabled={isUpdating}
          className={cn(
            'w-full py-4 px-6 rounded-2xl',
            'bg-accent-gold text-background-dark',
            'font-bold text-lg',
            'shadow-gold hover:shadow-gold-lg',
            'transition-all duration-300',
            'flex items-center justify-center gap-3',
            'disabled:opacity-70 disabled:cursor-not-allowed',
            !isUpdating && 'hover:scale-[1.02] active:scale-[0.98]'
          )}
        >
          {isUpdating ? (
            <>
              <RefreshCw size={22} className="animate-spin" />
              מעדכן...
            </>
          ) : (
            <>
              <RefreshCw size={22} />
              עדכן עכשיו
            </>
          )}
        </button>

        {/* Footer note */}
        <p className="text-foreground-muted text-xs mt-4 opacity-70">
          העדכון ייקח מספר שניות בלבד
        </p>
      </div>
    </div>
  )
}

