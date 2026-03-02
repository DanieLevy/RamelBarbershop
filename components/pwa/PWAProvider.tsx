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
    console.log(`[PWAProvider:mount] Mounted — standalone=${pwa.isStandalone} installed=${pwa.isInstalled} os=${pwa.deviceOS}`)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    console.log(`[PWAProvider:updateCheck] isUpdateAvailable=${pwa.isUpdateAvailable} autoTriggered=${autoUpdateTriggeredRef.current} swReady=${pwa.isServiceWorkerReady} currentVer=${pwa.currentVersion} newVer=${pwa.newVersion}`)

    if (!pwa.isUpdateAvailable || autoUpdateTriggeredRef.current) return

    autoUpdateTriggeredRef.current = true
    console.log('[PWAProvider:updateCheck] Scheduling update banner in 500ms')

    const timer = setTimeout(() => {
      console.log('[PWAProvider:updateCheck] Showing update banner')
      setShowUpdateBanner(true)
    }, 500)

    return () => clearTimeout(timer)
  }, [pwa.isUpdateAvailable, pwa.isServiceWorkerReady, pwa.currentVersion, pwa.newVersion])

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
