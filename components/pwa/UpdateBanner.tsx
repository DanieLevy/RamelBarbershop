'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useAuthStore } from '@/store/useAuthStore'
import { useBarberAuthStore } from '@/store/useBarberAuthStore'

interface UpdateBannerProps {
  onUpdate: () => void
  version?: string | null
  variant?: 'subtle' | 'auto'
}

const UPDATE_STATE_KEY = 'pwa_update_state'
const UPDATE_REDIRECT_KEY = 'pwa_update_redirect'

export function UpdateBanner({ onUpdate, version, variant = 'subtle' }: UpdateBannerProps) {
  const [isUpdating, setIsUpdating] = useState(variant === 'auto')
  const [isDismissed, setIsDismissed] = useState(false)
  const { customer } = useAuthStore()
  const { barber } = useBarberAuthStore()
  const fallbackTimerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    return () => {
      if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (variant !== 'auto') return

    const saveState = () => {
      try {
        const state = {
          currentPath: window.location.pathname + window.location.search,
          customerId: customer?.id || null,
          barberId: barber?.id || null,
          scrollPosition: window.scrollY,
          timestamp: Date.now(),
        }
        sessionStorage.setItem(UPDATE_STATE_KEY, JSON.stringify(state))
        sessionStorage.setItem(UPDATE_REDIRECT_KEY, state.currentPath)
      } catch { /* ignore */ }
    }

    saveState()

    const timer = setTimeout(() => {
      onUpdate()

      fallbackTimerRef.current = setTimeout(() => {
        window.location.reload()
      }, 8000)
    }, 2000)

    return () => clearTimeout(timer)
  }, [variant, onUpdate, customer?.id, barber?.id])

  const handleUpdate = useCallback(() => {
    setIsUpdating(true)

    try {
      const state = {
        currentPath: window.location.pathname + window.location.search,
        customerId: customer?.id || null,
        barberId: barber?.id || null,
        scrollPosition: window.scrollY,
        timestamp: Date.now(),
      }
      sessionStorage.setItem(UPDATE_STATE_KEY, JSON.stringify(state))
      sessionStorage.setItem(UPDATE_REDIRECT_KEY, state.currentPath)
    } catch { /* ignore */ }

    onUpdate()

    fallbackTimerRef.current = setTimeout(() => {
      window.location.reload()
    }, 8000)
  }, [onUpdate, customer?.id, barber?.id])

  const handleDismiss = useCallback(() => {
    setIsDismissed(true)
  }, [])

  if (isDismissed) return null

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[200] animate-slide-down pointer-events-none"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <div className="mx-auto max-w-lg px-4 pt-3 pb-2 pointer-events-auto">
        <div className="flex items-center justify-between gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-accent-gold/15 to-accent-gold/5 border border-accent-gold/20 backdrop-blur-xl shadow-lg shadow-accent-gold/5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-7 h-7 rounded-full bg-accent-gold/20 flex items-center justify-center flex-shrink-0">
              {isUpdating ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffaa3d" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                  <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                  <path d="M21 3v5h-5" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffaa3d" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                  <path d="M21 3v5h-5" />
                </svg>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground-light leading-tight">
                {isUpdating ? 'מעדכן...' : 'עדכון זמין'}
              </p>
              {version && !isUpdating && (
                <p className="text-[11px] text-foreground-muted leading-tight mt-0.5 font-mono">
                  v{version}
                </p>
              )}
              {isUpdating && (
                <p className="text-[11px] text-foreground-muted leading-tight mt-0.5">
                  טוען גרסה חדשה...
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {!isUpdating && (
              <>
                <button
                  onClick={handleUpdate}
                  className="px-3 py-1.5 rounded-xl bg-accent-gold/20 text-accent-gold text-xs font-medium hover:bg-accent-gold/30 transition-colors"
                  aria-label="עדכן עכשיו"
                  tabIndex={0}
                >
                  עדכן
                </button>
                <button
                  onClick={handleDismiss}
                  className="p-1.5 rounded-lg text-foreground-muted hover:text-foreground-light hover:bg-white/5 transition-colors"
                  aria-label="סגור התראת עדכון"
                  tabIndex={0}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export function restoreUpdateState(): { path: string; scrollY: number } | null {
  if (typeof window === 'undefined') return null

  try {
    const stateJson = sessionStorage.getItem(UPDATE_STATE_KEY)
    if (!stateJson) return null

    const state = JSON.parse(stateJson)

    if (Date.now() - state.timestamp > 30000) {
      sessionStorage.removeItem(UPDATE_STATE_KEY)
      sessionStorage.removeItem(UPDATE_REDIRECT_KEY)
      return null
    }

    sessionStorage.removeItem(UPDATE_STATE_KEY)
    sessionStorage.removeItem(UPDATE_REDIRECT_KEY)

    return {
      path: state.currentPath,
      scrollY: state.scrollPosition || 0,
    }
  } catch {
    return null
  }
}
