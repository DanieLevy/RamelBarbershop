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
  isUpdating: boolean
  deviceOS: DeviceOS
  currentVersion: string | null
  newVersion: string | null
}

interface UsePWAReturn extends PWAState {
  installApp: () => Promise<boolean>
  updateApp: () => void
  checkForUpdate: () => Promise<void>
  dismissInstallPrompt: () => void
  getInstallInstructions: () => { title: string; steps: string[] }
  clearCache: () => Promise<boolean>
  cleanupDevAssets: () => Promise<number>
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
const INSTALL_DISMISS_COUNT_KEY = 'pwa_install_dismiss_count'
const VISIT_COUNT_KEY = 'pwa_visit_count'

// Dismiss duration based on how many times user dismissed (gets shorter each time)
const getDismissDuration = (dismissCount: number): number => {
  switch (dismissCount) {
    case 0: return 2 * 60 * 60 * 1000 // First dismiss: 2 hours
    case 1: return 1 * 60 * 60 * 1000 // Second dismiss: 1 hour
    case 2: return 30 * 60 * 1000     // Third dismiss: 30 minutes
    case 3: return 15 * 60 * 1000     // Fourth dismiss: 15 minutes
    default: return 10 * 60 * 1000    // After that: 10 minutes
  }
}

// BroadcastChannel for cross-tab update coordination
const UPDATE_CHANNEL_NAME = 'pwa-update-channel'

// Singleton guard — prevent duplicate SW registration across React re-mounts
let swRegistered = false

export const usePWA = (): UsePWAReturn => {
  const [state, setState] = useState<PWAState>({
    isInstalled: false,
    isStandalone: false,
    isInstallable: false,
    isUpdateAvailable: false,
    isServiceWorkerReady: false,
    isUpdating: false,
    deviceOS: 'unknown',
    currentVersion: null,
    newVersion: null,
  })

  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null)
  const swRegistrationRef = useRef<ServiceWorkerRegistration | null>(null)
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null)
  
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

    // Initialize BroadcastChannel for cross-tab coordination
    if ('BroadcastChannel' in window) {
      broadcastChannelRef.current = new BroadcastChannel(UPDATE_CHANNEL_NAME)
      console.log('[usePWA:init] BroadcastChannel created')
      broadcastChannelRef.current.onmessage = (event) => {
        console.log(`[usePWA:broadcast] Received type=${event.data?.type}`, event.data)
        if (event.data?.type === 'UPDATE_TRIGGERED') {
          setState((prev) => ({ ...prev, isUpdating: true }))
        }
        if (event.data?.type === 'UPDATE_AVAILABLE') {
          setState((prev) => ({ 
            ...prev, 
            isUpdateAvailable: true,
            newVersion: event.data.version || prev.newVersion
          }))
        }
      }
    }

    // Get current version from active service worker
    const getCurrentVersion = async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration('/')
        console.log(`[usePWA:getVersion] Registration found=${!!reg} active=${reg?.active?.state || 'none'}`)
        if (reg?.active) {
          const messageChannel = new MessageChannel()
          messageChannel.port1.onmessage = (event) => {
            if (event.data?.version) {
              console.log(`[usePWA:getVersion] Active SW version=${event.data.version}`)
              setState((prev) => ({ ...prev, currentVersion: event.data.version }))
            }
          }
          reg.active.postMessage({ type: 'GET_VERSION' }, [messageChannel.port2])
        }
      } catch (error) {
        console.warn('[usePWA:getVersion] Failed:', error)
      }
    }

    const registerSW = async () => {
      if (swRegistered) {
        console.log('[usePWA:registerSW] Already registered (singleton guard) — skipping')
        return
      }
      swRegistered = true

      try {
        const controller = navigator.serviceWorker.controller
        console.log(`[usePWA:registerSW] Starting — controller=${controller ? 'yes' : 'none'} controllerUrl=${controller?.scriptURL || 'n/a'}`)

        const existingReg = await navigator.serviceWorker.getRegistration('/')
        console.log(`[usePWA:registerSW] Existing registration: active=${existingReg?.active?.state || 'none'} waiting=${existingReg?.waiting?.state || 'none'} installing=${existingReg?.installing?.state || 'none'}`)
        
        if (existingReg?.waiting) {
          console.log('[usePWA:registerSW] Waiting SW found pre-register — setting isUpdateAvailable=true')
          setState((prev) => ({ ...prev, isUpdateAvailable: true, isServiceWorkerReady: true }))
        }
        
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          updateViaCache: 'none',
        })

        swRegistrationRef.current = registration
        console.log(`[usePWA:registerSW] Registered — scope=${registration.scope} active=${registration.active?.state || 'none'} waiting=${registration.waiting?.state || 'none'} installing=${registration.installing?.state || 'none'}`)

        setState((prev) => ({ ...prev, isServiceWorkerReady: true }))
        
        getCurrentVersion()

        if (registration.waiting) {
          console.log('[usePWA:registerSW] Waiting worker found post-register — setting isUpdateAvailable=true')
          setState((prev) => ({ ...prev, isUpdateAvailable: true }))
        }

        setTimeout(() => {
          console.log('[usePWA:registerSW] Running first update check (10s delay)')
          registration.update()
        }, 10000)
        
        updateInterval = setInterval(() => {
          console.log('[usePWA:registerSW] Periodic update check (5min interval)')
          registration.update()
        }, 5 * 60 * 1000)

        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing
          if (!newWorker) {
            console.log('[usePWA:updatefound] No installing worker — skipping')
            return
          }

          console.log(`[usePWA:updatefound] New SW installing — state=${newWorker.state} scriptURL=${newWorker.scriptURL}`)

          const handleStateChange = () => {
            console.log(`[usePWA:statechange] New worker state=${newWorker.state} hasController=${!!navigator.serviceWorker.controller}`)
            
            if (newWorker.state === 'installed') {
              if (navigator.serviceWorker.controller) {
                console.log('[usePWA:statechange] New version installed+waiting — existing controller active')
                setState((prev) => ({ ...prev, isUpdateAvailable: true }))
                
                if (broadcastChannelRef.current) {
                  broadcastChannelRef.current.postMessage({ type: 'UPDATE_AVAILABLE' })
                  console.log('[usePWA:statechange] Broadcast UPDATE_AVAILABLE to other tabs')
                }
              } else {
                console.log('[usePWA:statechange] First install complete — no controller existed')
              }
              newWorker.removeEventListener('statechange', handleStateChange)
              stateChangeCleanupRef.current = stateChangeCleanupRef.current.filter(
                (item) => item.worker !== newWorker
              )
            }

            if (newWorker.state === 'activated') {
              console.log('[usePWA:statechange] New worker ACTIVATED — should be controlling now')
            }

            if (newWorker.state === 'redundant') {
              console.warn('[usePWA:statechange] New worker went REDUNDANT — install/activate failed or superseded')
            }
          }
          
          newWorker.addEventListener('statechange', handleStateChange)
          stateChangeCleanupRef.current.push({ worker: newWorker, handler: handleStateChange })
        })
      } catch (error) {
        console.error('[usePWA:registerSW] Registration failed:', error)
      }
    }

    registerSW()

    const handleMessage = (event: MessageEvent) => {
      console.log(`[usePWA:message] Received type=${event.data?.type || 'unknown'}`, event.data)
      if (event.data?.type === 'SW_UPDATED') {
        console.log(`[usePWA:message] SW_UPDATED — version=${event.data.version}`)
        setState((prev) => ({
          ...prev,
          isUpdateAvailable: false,
          isUpdating: false,
          currentVersion: event.data.version,
        }))
      }
    }
    navigator.serviceWorker.addEventListener('message', handleMessage)

    const SW_RELOAD_KEY = '__sw_controller_reload_ts'
    const SW_RELOAD_COOLDOWN_MS = 30_000
    const handleControllerChange = () => {
      const newController = navigator.serviceWorker.controller
      const lastReload = Number(sessionStorage.getItem(SW_RELOAD_KEY) || '0')
      const elapsed = Date.now() - lastReload
      console.log(`[usePWA:controllerchange] New controller=${newController ? 'yes' : 'none'} url=${newController?.scriptURL || 'n/a'} elapsed=${elapsed}ms cooldown=${SW_RELOAD_COOLDOWN_MS}ms`)

      if (elapsed < SW_RELOAD_COOLDOWN_MS) {
        console.log('[usePWA:controllerchange] Within cooldown — skipping reload')
        return
      }

      console.log('[usePWA:controllerchange] Reloading page in 250ms')
      sessionStorage.setItem(SW_RELOAD_KEY, Date.now().toString())
      setTimeout(() => {
        window.location.reload()
      }, 250)
    }
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange)

    return () => {
      if (updateInterval) clearInterval(updateInterval)
      navigator.serviceWorker.removeEventListener('message', handleMessage)
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange)
      
      // Close BroadcastChannel
      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.close()
        broadcastChannelRef.current = null
      }
      
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

  const updateApp = useCallback(() => {
    const registration = swRegistrationRef.current
    
    console.log(`[usePWA:updateApp] Called — registration=${!!registration} waiting=${registration?.waiting?.state || 'none'} installing=${registration?.installing?.state || 'none'} active=${registration?.active?.state || 'none'}`)
    
    setState((prev) => ({ ...prev, isUpdating: true }))
    
    if (broadcastChannelRef.current) {
      broadcastChannelRef.current.postMessage({ type: 'UPDATE_TRIGGERED' })
      console.log('[usePWA:updateApp] Broadcast UPDATE_TRIGGERED')
    }
    
    if (!registration) {
      console.log('[usePWA:updateApp] No registration — falling back to reload')
      window.location.reload()
      return
    }

    if (registration.waiting) {
      console.log('[usePWA:updateApp] Sending SKIP_WAITING to waiting worker')
      registration.waiting.postMessage({ type: 'SKIP_WAITING' })
      return
    }

    if (registration.installing) {
      console.log('[usePWA:updateApp] Worker still installing — waiting for installed state')
      const worker = registration.installing
      
      const handleStateChange = () => {
        console.log(`[usePWA:updateApp:statechange] Installing worker state=${worker.state}`)
        if (worker.state === 'installed') {
          console.log('[usePWA:updateApp:statechange] Now installed — sending SKIP_WAITING')
          worker.postMessage({ type: 'SKIP_WAITING' })
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

    console.log('[usePWA:updateApp] No waiting/installing worker — forcing update check')
    registration.update().then(() => {
      setTimeout(() => {
        if (registration.waiting) {
          console.log('[usePWA:updateApp] Post-check: waiting worker found — sending SKIP_WAITING')
          registration.waiting.postMessage({ type: 'SKIP_WAITING' })
        } else {
          console.log('[usePWA:updateApp] Post-check: no waiting worker — falling back to reload')
          window.location.reload()
        }
      }, 1000)
    }).catch(() => {
      window.location.reload()
    })
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
    // Track dismiss count
    const currentCount = parseInt(localStorage.getItem(INSTALL_DISMISS_COUNT_KEY) || '0', 10)
    const newCount = currentCount + 1
    localStorage.setItem(INSTALL_DISMISS_COUNT_KEY, String(newCount))
    
    // Get duration based on dismiss count (gets shorter each time)
    const duration = getDismissDuration(currentCount)
    const dismissedUntil = Date.now() + duration
    localStorage.setItem(INSTALL_DISMISSED_KEY, String(dismissedUntil))
    
    console.log(`[PWA] Install dismissed ${newCount} time(s), will show again in ${Math.round(duration / 60000)} minutes`)
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

  // Clear all caches - useful for troubleshooting
  const clearCache = useCallback(async (): Promise<boolean> => {
    try {
      // First try via service worker message
      const registration = swRegistrationRef.current
      const activeWorker = registration?.active
      
      if (activeWorker) {
        return new Promise((resolve) => {
          const handleMessage = (event: MessageEvent) => {
            if (event.data?.type === 'CACHE_CLEARED') {
              navigator.serviceWorker.removeEventListener('message', handleMessage)
              resolve(event.data.success)
            }
          }
          
          navigator.serviceWorker.addEventListener('message', handleMessage)
          activeWorker.postMessage({ type: 'CLEAR_CACHE' })
          
          // Timeout after 5 seconds
          setTimeout(() => {
            navigator.serviceWorker.removeEventListener('message', handleMessage)
            resolve(false)
          }, 5000)
        })
      }
      
      // Fallback: clear caches directly
      if ('caches' in window) {
        const cacheNames = await caches.keys()
        await Promise.all(cacheNames.map(name => caches.delete(name)))
        console.log('[PWA] Cleared all caches directly')
        return true
      }
      
      return false
    } catch (error) {
      console.error('[PWA] Failed to clear cache:', error)
      return false
    }
  }, [])

  // Cleanup development assets from cache
  const cleanupDevAssets = useCallback(async (): Promise<number> => {
    try {
      const registration = swRegistrationRef.current
      const activeWorker = registration?.active
      
      if (activeWorker) {
        return new Promise((resolve) => {
          const handleMessage = (event: MessageEvent) => {
            if (event.data?.type === 'DEV_ASSETS_CLEANED') {
              navigator.serviceWorker.removeEventListener('message', handleMessage)
              resolve(event.data.count || 0)
            }
          }
          
          navigator.serviceWorker.addEventListener('message', handleMessage)
          activeWorker.postMessage({ type: 'CLEANUP_DEV_ASSETS' })
          
          // Timeout after 5 seconds
          setTimeout(() => {
            navigator.serviceWorker.removeEventListener('message', handleMessage)
            resolve(0)
          }, 5000)
        })
      }
      
      return 0
    } catch (error) {
      console.error('[PWA] Failed to cleanup dev assets:', error)
      return 0
    }
  }, [])

  return {
    ...state,
    installApp,
    updateApp,
    checkForUpdate,
    dismissInstallPrompt,
    getInstallInstructions,
    clearCache,
    cleanupDevAssets,
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

// Helper to get dismiss count (how many times user dismissed the install prompt)
export const getDismissCount = (): number => {
  if (typeof window === 'undefined') return 0
  return parseInt(localStorage.getItem(INSTALL_DISMISS_COUNT_KEY) || '0', 10)
}
