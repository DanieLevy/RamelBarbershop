'use client'

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { usePWA, wasInstallDismissed, getVisitCount } from '@/hooks/usePWA'
import { InstallBanner } from './InstallBanner'
import { UpdateModal } from './UpdateModal'
import { NotificationPermissionModal } from './NotificationPermissionModal'

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
  
  // Ensure PWA components only render on client after mount
  // This prevents hydration issues and SSR errors
  useEffect(() => {
    setIsMounted(true)
  }, [])
  
  // Determine if we should show install banner
  const shouldShowInstallBanner = 
    !pwa.isInstalled && 
    !pwa.isStandalone && 
    !wasInstallDismissed()
  
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
              onDismiss={pwa.dismissInstallPrompt}
              instructions={pwa.getInstallInstructions()}
            />
          )}
          
          {/* Notification Permission Modal - Shows in PWA for logged-in users */}
          <NotificationPermissionModal />
        </>
      )}
    </PWAContext.Provider>
  )
}

