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
const checkStandalone = (): boolean => {
  if (typeof window === 'undefined') return false
  
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true ||
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

    const registerSW = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          updateViaCache: 'none',
        })

        swRegistrationRef.current = registration
        console.log('[PWA] Service Worker registered')

        setState((prev) => ({ ...prev, isServiceWorkerReady: true }))

        // Check for updates immediately and periodically
        registration.update()
        
        // Check for updates every 5 minutes
        const updateInterval = setInterval(() => {
          registration.update()
        }, 5 * 60 * 1000)

        // Listen for new service worker
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing
          if (!newWorker) return

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('[PWA] New version available!')
              setState((prev) => ({ ...prev, isUpdateAvailable: true }))
            }
          })
        })

        return () => clearInterval(updateInterval)
      } catch (error) {
        console.error('[PWA] Service Worker registration failed:', error)
      }
    }

    registerSW()

    // Listen for SW messages
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'SW_UPDATED') {
        console.log('[PWA] Received update notification, version:', event.data.version)
        setState((prev) => ({
          ...prev,
          isUpdateAvailable: true,
          currentVersion: event.data.version,
        }))
      }
    })

    // Handle controller change (new SW took over)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('[PWA] Controller changed, reloading...')
      window.location.reload()
    })
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
    if (!swRegistrationRef.current?.waiting) {
      console.log('[PWA] No waiting worker to activate')
      window.location.reload()
      return
    }

    // Tell the waiting SW to skip waiting
    swRegistrationRef.current.waiting.postMessage({ type: 'SKIP_WAITING' })
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

