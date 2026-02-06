'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { RefreshCw, Sparkles, Scissors, Check, AlertTriangle, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@heroui/react'
import { useAuthStore } from '@/store/useAuthStore'
import { useBarberAuthStore } from '@/store/useBarberAuthStore'

// Update stages for progress indication
type UpdateStage = 
  | 'ready'           // Update available, waiting for user action
  | 'saving'          // Saving user state
  | 'activating'      // Sending skipWaiting to SW
  | 'waiting'         // Waiting for new SW to take control
  | 'reloading'       // About to reload the page
  | 'error'           // Something went wrong

interface UpdateModalProps {
  onUpdate: () => void
  version?: string | null
}

// Key for storing user state during update
const UPDATE_STATE_KEY = 'pwa_update_state'
const UPDATE_REDIRECT_KEY = 'pwa_update_redirect'

// Parse version to extract major/minor for comparison
function parseVersion(version: string): { major: number; minor: number; patch: number } {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)/)
  if (!match) return { major: 0, minor: 0, patch: 0 }
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10)
  }
}

// Check if this is a critical update (major version bump)
function isCriticalUpdate(currentVersion: string, newVersion: string): boolean {
  const current = parseVersion(currentVersion)
  const next = parseVersion(newVersion)
  return next.major > current.major
}

export function UpdateModal({ onUpdate, version }: UpdateModalProps) {
  const [stage, setStage] = useState<UpdateStage>('ready')
  const [progress, setProgress] = useState(0)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isCritical, setIsCritical] = useState(false)
  
  const { customer } = useAuthStore()
  const { barber } = useBarberAuthStore()
  
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Check if update is critical on mount
  useEffect(() => {
    const checkCritical = async () => {
      if (!version) return
      
      try {
        // Get current SW version via message
        const reg = await navigator.serviceWorker.getRegistration('/')
        if (reg?.active) {
          const messageChannel = new MessageChannel()
          messageChannel.port1.onmessage = (event) => {
            if (event.data?.version) {
              setIsCritical(isCriticalUpdate(event.data.version, version))
            }
          }
          reg.active.postMessage({ type: 'GET_VERSION' }, [messageChannel.port2])
        }
      } catch {
        // Ignore errors, just proceed normally
      }
    }
    
    checkCritical()
  }, [version])

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current)
    }
  }, [])

  // Save user state before update
  const saveUserState = useCallback(() => {
    try {
      const state = {
        currentPath: window.location.pathname + window.location.search,
        customerId: customer?.id || null,
        barberId: barber?.id || null,
        scrollPosition: window.scrollY,
        timestamp: Date.now()
      }
      sessionStorage.setItem(UPDATE_STATE_KEY, JSON.stringify(state))
      
      // Save redirect URL separately for immediate access after reload
      sessionStorage.setItem(UPDATE_REDIRECT_KEY, state.currentPath)
      
      console.log('[UpdateModal] User state saved:', state.currentPath)
      return true
    } catch (error) {
      console.error('[UpdateModal] Failed to save state:', error)
      return false
    }
  }, [customer?.id, barber?.id])

  // Animate progress bar
  const animateProgress = useCallback((targetProgress: number, duration: number) => {
    const startProgress = progress
    const startTime = Date.now()
    
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current)
    }
    
    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime
      const progressPercent = Math.min(elapsed / duration, 1)
      const easedProgress = 1 - Math.pow(1 - progressPercent, 3) // Ease out cubic
      
      setProgress(startProgress + (targetProgress - startProgress) * easedProgress)
      
      if (progressPercent >= 1) {
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current)
        }
      }
    }, 16) // ~60fps
  }, [progress])

  // Main update handler with stages
  const handleUpdate = useCallback(async () => {
    try {
      // Stage 1: Save user state
      setStage('saving')
      animateProgress(20, 300)
      
      await new Promise(resolve => setTimeout(resolve, 200))
      saveUserState()
      
      // Stage 2: Activate new service worker
      setStage('activating')
      animateProgress(50, 400)
      
      // Trigger the update (this sends SKIP_WAITING to SW)
      onUpdate()
      
      // Stage 3: Wait for controller change
      setStage('waiting')
      animateProgress(80, 500)
      
      // The controllerchange event in usePWA will trigger reload
      // Set a fallback timeout in case it doesn't happen
      timeoutRef.current = setTimeout(() => {
        // If we're still here after 8 seconds, something went wrong
        setStage('reloading')
        animateProgress(100, 200)
        
        // Give a brief moment to show 100% then force reload
        setTimeout(() => {
          window.location.reload()
        }, 300)
      }, 8000)
      
    } catch (error) {
      console.error('[UpdateModal] Update failed:', error)
      setStage('error')
      setErrorMessage('העדכון נכשל. אנא נסה שוב.')
    }
  }, [onUpdate, saveUserState, animateProgress])

  // Handle force reload
  const handleForceReload = useCallback(() => {
    saveUserState()
    
    const doReload = () => window.location.reload()
    
    // Clear all caches before reload for clean slate
    if (typeof window !== 'undefined' && 'caches' in window) {
      caches.keys()
        .then(names => Promise.all(names.map(name => caches.delete(name))))
        .then(doReload)
        .catch(doReload)
    } else {
      doReload()
    }
  }, [saveUserState])

  // Retry after error
  const handleRetry = useCallback(() => {
    setStage('ready')
    setProgress(0)
    setErrorMessage(null)
  }, [])

  // Get stage-specific content
  const getStageContent = () => {
    switch (stage) {
      case 'ready':
        return {
          icon: <Sparkles size={40} className="text-background-dark" />,
          title: isCritical ? 'עדכון חשוב! ⚡' : 'עדכון זמין! ✨',
          description: isCritical 
            ? 'גרסה חדשה עם שיפורים משמעותיים. נדרש עדכון כדי להמשיך להשתמש באפליקציה.'
            : 'גרסה חדשה של האפליקציה זמינה עם שיפורים ותכונות חדשות.',
          buttonText: 'עדכן עכשיו',
          showProgress: false
        }
      case 'saving':
        return {
          icon: <Check size={40} className="text-background-dark animate-pulse" />,
          title: 'שומר נתונים...',
          description: 'שומר את המצב הנוכחי שלך',
          buttonText: null,
          showProgress: true
        }
      case 'activating':
        return {
          icon: <Zap size={40} className="text-background-dark animate-pulse" />,
          title: 'מפעיל עדכון...',
          description: 'מתקין את הגרסה החדשה',
          buttonText: null,
          showProgress: true
        }
      case 'waiting':
        return {
          icon: <Scissors size={40} className="text-background-dark animate-spin" />,
          title: 'מחכה לעדכון...',
          description: 'האפליקציה מתעדכנת, נא להמתין',
          buttonText: null,
          showProgress: true
        }
      case 'reloading':
        return {
          icon: <RefreshCw size={40} className="text-background-dark animate-spin" />,
          title: 'מרענן...',
          description: 'האפליקציה תיטען מחדש עוד רגע',
          buttonText: null,
          showProgress: true
        }
      case 'error':
        return {
          icon: <AlertTriangle size={40} className="text-background-dark" />,
          title: 'שגיאה בעדכון',
          description: errorMessage || 'משהו השתבש. אנא נסה שוב.',
          buttonText: 'נסה שוב',
          showProgress: false
        }
    }
  }

  const content = getStageContent()
  const isProcessing = ['saving', 'activating', 'waiting', 'reloading'].includes(stage)

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
          <div className={cn(
            'absolute inset-0 rounded-full animate-pulse-gold',
            isCritical && stage === 'ready' ? 'bg-orange-500/30' : 'bg-accent-gold/20',
            stage === 'error' && 'bg-red-500/20'
          )} />
          
          {/* Icon container */}
          <div className={cn(
            'relative w-full h-full rounded-full flex items-center justify-center shadow-gold-lg',
            stage === 'error' 
              ? 'bg-gradient-to-br from-red-500 to-red-600'
              : isCritical && stage === 'ready'
              ? 'bg-gradient-to-br from-orange-400 to-orange-500'
              : 'bg-gradient-to-br from-accent-gold to-accent-gold-dark'
          )}>
            {content.icon}
          </div>
        </div>

        {/* Title */}
        <h2 className="text-2xl font-bold text-foreground-light mb-2">
          {content.title}
        </h2>

        {/* Description */}
        <p className="text-foreground-muted text-sm mb-6 leading-relaxed">
          {content.description}
          {stage === 'ready' && (
            <>
              <br />
              <span className={cn(
                'font-medium',
                isCritical ? 'text-orange-400' : 'text-accent-gold'
              )}>
                {isCritical ? 'העדכון הכרחי להמשך שימוש.' : 'נא לעדכן כדי להמשיך.'}
              </span>
            </>
          )}
        </p>

        {/* Progress bar */}
        {content.showProgress && (
          <div className="mb-6">
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-accent-gold to-accent-orange rounded-full transition-all duration-100"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-foreground-muted text-xs mt-2">
              {Math.round(progress)}%
            </p>
          </div>
        )}

        {/* Version badge */}
        {version && !isProcessing && (
          <div className={cn(
            'inline-block px-3 py-1 rounded-full border text-xs mb-6 font-mono',
            isCritical 
              ? 'bg-orange-500/10 border-orange-500/30 text-orange-300'
              : 'bg-white/5 border-white/10 text-foreground-muted'
          )}>
            גרסה {version}
          </div>
        )}

        {/* Action Buttons */}
        {stage === 'ready' && (
          <Button
            variant={isCritical ? 'danger' : 'primary'}
            onPress={handleUpdate}
            className="w-full py-4 text-lg font-bold"
            size="lg"
          >
            <RefreshCw size={22} />
            {content.buttonText}
          </Button>
        )}

        {stage === 'error' && (
          <div className="space-y-3">
            <Button
              variant="primary"
              onPress={handleRetry}
              className="w-full py-4 text-lg font-bold"
              size="lg"
            >
              <RefreshCw size={22} />
              נסה שוב
            </Button>
            <Button
              variant="secondary"
              onPress={handleForceReload}
              className="w-full text-sm"
            >
              רענן את הדף ידנית
            </Button>
          </div>
        )}

        {/* Processing indicator */}
        {isProcessing && (
          <div className="flex items-center justify-center gap-2 text-foreground-muted text-sm">
            <div className="w-2 h-2 rounded-full bg-accent-gold animate-pulse" />
            <span>אנא אל תסגור את האפליקציה</span>
          </div>
        )}

        {/* Footer note for ready state */}
        {stage === 'ready' && !isCritical && (
          <p className="text-foreground-muted text-xs mt-4 opacity-70">
            העדכון ישמור את המיקום הנוכחי שלך
          </p>
        )}
      </div>
    </div>
  )
}

// Export helper to restore user state after update
export function restoreUpdateState(): { path: string; scrollY: number } | null {
  if (typeof window === 'undefined') return null
  
  try {
    const stateJson = sessionStorage.getItem(UPDATE_STATE_KEY)
    if (!stateJson) return null
    
    const state = JSON.parse(stateJson)
    
    // Check if state is recent (within last 30 seconds)
    if (Date.now() - state.timestamp > 30000) {
      sessionStorage.removeItem(UPDATE_STATE_KEY)
      sessionStorage.removeItem(UPDATE_REDIRECT_KEY)
      return null
    }
    
    // Clear the state after reading
    sessionStorage.removeItem(UPDATE_STATE_KEY)
    sessionStorage.removeItem(UPDATE_REDIRECT_KEY)
    
    return {
      path: state.currentPath,
      scrollY: state.scrollPosition || 0
    }
  } catch {
    return null
  }
}

