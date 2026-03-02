'use client'

import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import { usePWA, wasInstallDismissed, getVisitCount } from '@/hooks/usePWA'
import { useBadgeManager } from '@/hooks/useBadgeManager'
import { InstallBanner } from './InstallBanner'
import { AutoPushSubscriber } from './AutoPushSubscriber'
import { PushDeniedBanner } from './PushDeniedBanner'
import { UpdateBanner } from './UpdateBanner'

interface PWAContextType {
  isInstalled: boolean
  isStandalone: boolean
  isInstallable: boolean
  isUpdateAvailable: boolean
  deviceOS: 'ios' | 'android' | 'desktop' | 'unknown'
  installApp: () => Promise<boolean>
  updateApp: () => void
  getInstallInstructions: () => { title: string; steps: string[] }
}

const PWAContext = createContext<PWAContextType | null>(null)

export const usePWAContext = () => {
  const context = useContext(PWAContext)
  if (!context) {
    throw new Error('usePWAContext must be used within PWAProvider')
  }
  return context
}

interface PWAProviderProps {
  children: ReactNode
}

export function PWAProvider({ children }: PWAProviderProps) {
  const pwa = usePWA()
  const [isMounted, setIsMounted] = useState(false)
  const [isInstallDismissed, setIsInstallDismissed] = useState(false)
  const [showUpdateBanner, setShowUpdateBanner] = useState(false)
  const autoUpdateTriggeredRef = useRef(false)

  useBadgeManager()

  useEffect(() => {
    setIsMounted(true)
    setIsInstallDismissed(wasInstallDismissed())
  }, [])

  useEffect(() => {
    if (!pwa.isUpdateAvailable || autoUpdateTriggeredRef.current) return

    const sessionKey = 'pwa_auto_updated_session'
    if (sessionStorage.getItem(sessionKey)) {
      console.log('[PWA] Already updated this session, skipping')
      return
    }

    autoUpdateTriggeredRef.current = true
    sessionStorage.setItem(sessionKey, 'true')

    // Apply update immediately — waiting means chunks may already be stale.
    // The UpdateBanner's "auto" variant shows a brief heads-up before reloading.
    const timer = setTimeout(() => {
      console.log('[PWA] Applying update immediately (waiting SW detected)')
      setShowUpdateBanner(true)
    }, 500)

    return () => clearTimeout(timer)
  }, [pwa.isUpdateAvailable])

  const handleInstallDismiss = useCallback(() => {
    pwa.dismissInstallPrompt()
    setIsInstallDismissed(true)
  }, [pwa])

  const shouldShowInstallBanner =
    !pwa.isInstalled &&
    !pwa.isStandalone &&
    !isInstallDismissed

  const visitCount = getVisitCount()
  const showAsModal = visitCount > 1

  const contextValue: PWAContextType = {
    isInstalled: pwa.isInstalled,
    isStandalone: pwa.isStandalone,
    isInstallable: pwa.isInstallable,
    isUpdateAvailable: pwa.isUpdateAvailable,
    deviceOS: pwa.deviceOS,
    installApp: pwa.installApp,
    updateApp: pwa.updateApp,
    getInstallInstructions: pwa.getInstallInstructions,
  }

  return (
    <PWAContext.Provider value={contextValue}>
      {children}

      {isMounted && (
        <>
          {shouldShowInstallBanner && (
            <InstallBanner
              isModal={showAsModal}
              deviceOS={pwa.deviceOS}
              isInstallable={pwa.isInstallable}
              onInstall={pwa.installApp}
              onDismiss={handleInstallDismiss}
              instructions={pwa.getInstallInstructions()}
            />
          )}

          {showUpdateBanner && (
            <UpdateBanner
              onUpdate={pwa.updateApp}
              version={pwa.newVersion}
              variant="auto"
            />
          )}

          <AutoPushSubscriber />
          <PushDeniedBanner />
        </>
      )}
    </PWAContext.Provider>
  )
}
