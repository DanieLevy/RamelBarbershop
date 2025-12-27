'use client'

import { useState, useEffect } from 'react'
import { RefreshCw, Sparkles, Scissors } from 'lucide-react'
import { cn } from '@/lib/utils'

interface UpdateModalProps {
  onUpdate: () => void
  version?: string | null
}

export function UpdateModal({ onUpdate, version }: UpdateModalProps) {
  const [isUpdating, setIsUpdating] = useState(false)
  const [showFallback, setShowFallback] = useState(false)

  // Fallback: if update doesn't happen within 5 seconds, show reload option
  useEffect(() => {
    if (isUpdating) {
      const timeout = setTimeout(() => {
        setShowFallback(true)
      }, 5000)
      return () => clearTimeout(timeout)
    }
  }, [isUpdating])

  const handleUpdate = () => {
    setIsUpdating(true)
    
    // Trigger update after a brief moment for UX
    setTimeout(() => {
      onUpdate()
    }, 300)
  }

  const handleForceReload = () => {
    // Force hard reload to get the new version
    window.location.reload()
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
            {isUpdating ? (
              <Scissors size={40} className="text-background-dark animate-spin" />
            ) : (
              <Sparkles size={40} className="text-background-dark" />
            )}
          </div>
        </div>

        {/* Title */}
        <h2 className="text-2xl font-bold text-foreground-light mb-2">
          {isUpdating ? 'מעדכן...' : 'עדכון זמין! ✨'}
        </h2>

        {/* Description */}
        <p className="text-foreground-muted text-sm mb-6 leading-relaxed">
          {isUpdating ? (
            'אנא המתן, האפליקציה מתעדכנת...'
          ) : (
            <>
              גרסה חדשה של האפליקציה זמינה עם שיפורים ותכונות חדשות.
              <br />
              <span className="text-accent-gold font-medium">נא לעדכן כדי להמשיך.</span>
            </>
          )}
        </p>

        {/* Version badge */}
        {version && (
          <div className="inline-block px-3 py-1 rounded-full bg-white/5 border border-white/10 text-foreground-muted text-xs mb-6 font-mono">
            גרסה {version}
          </div>
        )}

        {/* Update Button */}
        {!showFallback ? (
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
        ) : (
          <div className="space-y-3">
            <p className="text-amber-400 text-sm mb-3">
              העדכון לוקח יותר זמן מהצפוי
            </p>
            <button
              onClick={handleForceReload}
              className={cn(
                'w-full py-4 px-6 rounded-2xl',
                'bg-accent-gold text-background-dark',
                'font-bold text-lg',
                'shadow-gold',
                'transition-all duration-300',
                'flex items-center justify-center gap-3',
                'hover:scale-[1.02] active:scale-[0.98]'
              )}
            >
              <RefreshCw size={22} />
              רענן את הדף
            </button>
          </div>
        )}

        {/* Footer note */}
        {!showFallback && (
          <p className="text-foreground-muted text-xs mt-4 opacity-70">
            העדכון ייקח מספר שניות בלבד
          </p>
        )}
      </div>
    </div>
  )
}

