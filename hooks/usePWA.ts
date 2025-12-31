'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

type DeviceOS = 'ios' | 'android' | 'desktop' | 'unknown'

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
  prompt(): Promise<void>
}

interface PWAState {
  isInstalled: boolean
  isStandalone: boolean
  isInstallable: boolean
  isUpdateAvailable: boolean
  isServiceWorkerReady: boolean
  deviceOS: DeviceOS
  currentVersion: string | null
}

interface UsePWAReturn extends PWAState {
  installApp: () => Promise<boolean>
  updateApp: () => void
  checkForUpdate: () => Promise<void>
  dismissInstallPrompt: () => void
  getInstallInstructions: () => { title: string; steps: string[] }
}

// Detect device OS
const detectOS = (): DeviceOS => {
  if (typeof window === 'undefined') return 'unknown'
  
  const ua = navigator.userAgent.toLowerCase()
  
  if (/iphone|ipad|ipod/.test(ua)) return 'ios'
  if (/android/.test(ua)) return 'android'
  if (/windows|macintosh|linux/.test(ua)) return 'desktop'
  
  return 'unknown'
}

// Check if running in standalone mode
// Uses Navigator.standalone for iOS - types defined in types/navigator.d.ts
const checkStandalone = (): boolean => {
  if (typeof window === 'undefined') return false
  
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    navigator.standalone === true ||
    document.referrer.includes('android-app://')
  )
}

// Local storage keys
const INSTALL_DISMISSED_KEY = 'pwa_install_dismissed'
const VISIT_COUNT_KEY = 'pwa_visit_count'

export const usePWA = (): UsePWAReturn => {
  const [state, setState] = useState<PWAState>({
    isInstalled: false,
    isStandalone: false,
    isInstallable: false,
    isUpdateAvailable: false,
    isServiceWorkerReady: false,
    deviceOS: 'unknown',
    currentVersion: null,
  })

  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null)
  const swRegistrationRef = useRef<ServiceWorkerRegistration | null>(null)
  
  // Track statechange listeners for cleanup to prevent memory leaks
  const stateChangeCleanupRef = useRef<Array<{ worker: ServiceWorker; handler: () => void }>>([])

  // Initialize PWA state
  useEffect(() => {
    const isStandalone = checkStandalone()
    const deviceOS = detectOS()

    setState((prev) => ({
      ...prev,
      isStandalone,
      isInstalled: isStandalone,
      deviceOS,
    }))

    // Track visit count
    const visitCount = parseInt(localStorage.getItem(VISIT_COUNT_KEY) || '0', 10)
    localStorage.setItem(VISIT_COUNT_KEY, String(visitCount + 1))
  }, [])

  // Register service worker
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

    let updateInterval: NodeJS.Timeout | null = null

    const registerSW = async () => {
      try {
        // Check for existing registration first
        const existingReg = await navigator.serviceWorker.getRegistration('/')
        if (existingReg?.waiting) {
          console.log('[PWA] Existing waiting service worker found immediately')
          setState((prev) => ({ ...prev, isUpdateAvailable: true, isServiceWorkerReady: true }))
        }
        
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          updateViaCache: 'none',
        })

        swRegistrationRef.current = registration
        console.log('[PWA] Service Worker registered')

        setState((prev) => ({ ...prev, isServiceWorkerReady: true }))

        // Check if there's already a waiting worker (user closed app before updating)
        if (registration.waiting) {
          console.log('[PWA] Found waiting service worker on load')
          setState((prev) => ({ ...prev, isUpdateAvailable: true }))
        }

        // Check for updates immediately
        registration.update()
        
        // Check for updates every 1 minute for faster update detection
        updateInterval = setInterval(() => {
          registration.update()
        }, 1 * 60 * 1000)

        // Listen for new service worker
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing
          if (!newWorker) return

          console.log('[PWA] New service worker found, tracking state...')

          // Create handler and track it for cleanup
          const handleStateChange = () => {
            console.log('[PWA] New worker state:', newWorker.state)
            
            if (newWorker.state === 'installed') {
              if (navigator.serviceWorker.controller) {
                // New SW installed while old one is still controlling
                console.log('[PWA] New version installed and waiting!')
                setState((prev) => ({ ...prev, isUpdateAvailable: true }))
              } else {
                // First install - no update needed, just fresh install
                console.log('[PWA] First install complete')
              }
              // Remove listener once installed state is reached
              newWorker.removeEventListener('statechange', handleStateChange)
              stateChangeCleanupRef.current = stateChangeCleanupRef.current.filter(
                (item) => item.worker !== newWorker
              )
            }
          }
          
          newWorker.addEventListener('statechange', handleStateChange)
          stateChangeCleanupRef.current.push({ worker: newWorker, handler: handleStateChange })
        })
      } catch (error) {
        console.error('[PWA] Service Worker registration failed:', error)
      }
    }

    registerSW()

    // Listen for SW messages
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SW_UPDATED') {
        console.log('[PWA] Received update notification, version:', event.data.version)
        setState((prev) => ({
          ...prev,
          isUpdateAvailable: true,
          currentVersion: event.data.version,
        }))
      }
    }
    navigator.serviceWorker.addEventListener('message', handleMessage)

    // Handle controller change (new SW took over)
    const handleControllerChange = () => {
      console.log('[PWA] Controller changed, reloading...')
      window.location.reload()
    }
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange)

    return () => {
      if (updateInterval) clearInterval(updateInterval)
      navigator.serviceWorker.removeEventListener('message', handleMessage)
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange)
      
      // Clean up all tracked statechange listeners to prevent memory leaks
      stateChangeCleanupRef.current.forEach(({ worker, handler }) => {
        worker.removeEventListener('statechange', handler)
      })
      stateChangeCleanupRef.current = []
    }
  }, [])

  // Listen for install prompt
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      deferredPromptRef.current = e as BeforeInstallPromptEvent
      setState((prev) => ({ ...prev, isInstallable: true }))
      console.log('[PWA] Install prompt available')
    }

    const handleAppInstalled = () => {
      console.log('[PWA] App installed')
      deferredPromptRef.current = null
      setState((prev) => ({
        ...prev,
        isInstalled: true,
        isInstallable: false,
      }))
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  // Install the app
  const installApp = useCallback(async (): Promise<boolean> => {
    if (!deferredPromptRef.current) {
      console.log('[PWA] No install prompt available')
      return false
    }

    try {
      await deferredPromptRef.current.prompt()
      const { outcome } = await deferredPromptRef.current.userChoice
      
      deferredPromptRef.current = null
      
      if (outcome === 'accepted') {
        console.log('[PWA] User accepted install')
        return true
      } else {
        console.log('[PWA] User dismissed install')
        return false
      }
    } catch (error) {
      console.error('[PWA] Install failed:', error)
      return false
    }
  }, [])

  // Update the app
  const updateApp = useCallback(() => {
    const registration = swRegistrationRef.current
    
    if (!registration) {
      console.log('[PWA] No registration found, reloading...')
      window.location.reload()
      return
    }

    // Try waiting worker first
    if (registration.waiting) {
      console.log('[PWA] Telling waiting worker to skip waiting...')
      registration.waiting.postMessage({ type: 'SKIP_WAITING' })
      return
    }

    // If no waiting worker, check for installing worker
    if (registration.installing) {
      console.log('[PWA] Worker still installing, waiting...')
      const worker = registration.installing
      
      // Create handler that auto-cleans up after firing
      const handleStateChange = () => {
        if (worker.state === 'installed') {
          console.log('[PWA] Worker now installed, skip waiting...')
          worker.postMessage({ type: 'SKIP_WAITING' })
          // Self-cleanup after handling
          worker.removeEventListener('statechange', handleStateChange)
          stateChangeCleanupRef.current = stateChangeCleanupRef.current.filter(
            (item) => item.worker !== worker
          )
        }
      }
      
      worker.addEventListener('statechange', handleStateChange)
      stateChangeCleanupRef.current.push({ worker, handler: handleStateChange })
      return
    }

    // Fallback: just reload
    console.log('[PWA] No worker to update, reloading...')
    window.location.reload()
  }, [])

  // Check for updates manually
  const checkForUpdate = useCallback(async () => {
    if (!swRegistrationRef.current) return
    
    try {
      await swRegistrationRef.current.update()
      console.log('[PWA] Update check completed')
    } catch (error) {
      console.error('[PWA] Update check failed:', error)
    }
  }, [])

  // Dismiss install prompt
  const dismissInstallPrompt = useCallback(() => {
    const dismissedUntil = Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
    localStorage.setItem(INSTALL_DISMISSED_KEY, String(dismissedUntil))
  }, [])

  // Get OS-specific installation instructions
  const getInstallInstructions = useCallback((): { title: string; steps: string[] } => {
    switch (state.deviceOS) {
      case 'ios':
        return {
          title: 'התקנה באייפון/אייפד',
          steps: [
            'לחצו על כפתור השיתוף (החץ למעלה)',
            'גללו למטה ובחרו "הוסף למסך הבית"',
            'לחצו "הוסף" בפינה הימנית העליונה',
          ],
        }
      case 'android':
        return {
          title: 'התקנה באנדרואיד',
          steps: [
            'לחצו על תפריט הדפדפן (שלוש נקודות)',
            'בחרו "התקן אפליקציה" או "הוסף למסך הבית"',
            'אשרו את ההתקנה',
          ],
        }
      default:
        return {
          title: 'התקנה במחשב',
          steps: [
            'לחצו על אייקון ההתקנה בשורת הכתובת',
            'או פתחו את תפריט הדפדפן ובחרו "התקן"',
            'אשרו את ההתקנה',
          ],
        }
    }
  }, [state.deviceOS])

  return {
    ...state,
    installApp,
    updateApp,
    checkForUpdate,
    dismissInstallPrompt,
    getInstallInstructions,
  }
}

// Helper to check if install was dismissed
export const wasInstallDismissed = (): boolean => {
  if (typeof window === 'undefined') return false
  
  const dismissedUntil = localStorage.getItem(INSTALL_DISMISSED_KEY)
  if (!dismissedUntil) return false
  
  return Date.now() < parseInt(dismissedUntil, 10)
}

// Helper to get visit count
export const getVisitCount = (): number => {
  if (typeof window === 'undefined') return 0
  return parseInt(localStorage.getItem(VISIT_COUNT_KEY) || '0', 10)
}

