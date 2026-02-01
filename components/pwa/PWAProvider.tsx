'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { usePWA, wasInstallDismissed, getVisitCount } from '@/hooks/usePWA'
import { useBadgeManager } from '@/hooks/useBadgeManager'
import { InstallBanner } from './InstallBanner'
import { UpdateModal } from './UpdateModal'
import { AutoPushSubscriber } from './AutoPushSubscriber'
import { PushDeniedBanner } from './PushDeniedBanner'

// PWA Context
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
  
  // Track if install banner is dismissed - this state triggers re-render to unmount the modal
  const [isInstallDismissed, setIsInstallDismissed] = useState(false)
  
  // Badge manager handles clearing badges when app is opened
  useBadgeManager()
  
  // Ensure PWA components only render on client after mount
  // This prevents hydration issues and SSR errors
  useEffect(() => {
    setIsMounted(true)
    // Check localStorage on mount
    setIsInstallDismissed(wasInstallDismissed())
  }, [])
  
  // Handle install banner dismiss - updates state to trigger re-render
  const handleInstallDismiss = useCallback(() => {
    pwa.dismissInstallPrompt()
    setIsInstallDismissed(true) // This triggers re-render to unmount the modal
  }, [pwa])
  
  // Determine if we should show install banner
  const shouldShowInstallBanner = 
    !pwa.isInstalled && 
    !pwa.isStandalone && 
    !isInstallDismissed
  
  // Get visit count for smart banner behavior
  const visitCount = getVisitCount()
  const showAsModal = visitCount > 1 // Show modal on 2nd+ visit

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
      
      {/* Only render PWA-related modals after client mount to prevent SSR issues */}
      {isMounted && (
        <>
          {/* Force Update Modal - Non-dismissible */}
          {pwa.isUpdateAvailable && (
            <UpdateModal onUpdate={pwa.updateApp} version={pwa.currentVersion} />
          )}
          
          {/* Install Banner - Smart behavior based on visit count */}
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
          
          {/* Auto Push Subscriber - Silently triggers native OS permission after PWA install */}
          <AutoPushSubscriber />
          
          {/* Push Denied Banner - Shows only when user declined, with recovery instructions */}
          <PushDeniedBanner />
        </>
      )}
    </PWAContext.Provider>
  )
}

