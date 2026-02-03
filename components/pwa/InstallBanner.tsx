'use client'

import { useState, useEffect } from 'react'
import { X, Download, Share, Smartphone, Monitor, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useNotificationManager, useNotificationTiming } from '@/components/NotificationManager'

interface InstallBannerProps {
  isModal: boolean
  deviceOS: 'ios' | 'android' | 'desktop' | 'unknown'
  isInstallable: boolean
  onInstall: () => Promise<boolean>
  onDismiss: () => void
  instructions: {
    title: string
    steps: string[]
  }
}

/**
 * PWA Install Banner
 * 
 * Design Philosophy: Peaceful and Non-Intrusive
 * - Simple, friendly invitation to install
 * - Easy dismiss with no guilt-tripping
 * - No confirmation dialogs for dismissal
 * - Respects user's choice
 */
export function InstallBanner({
  isModal,
  deviceOS,
  isInstallable,
  onInstall,
  onDismiss,
  instructions,
}: InstallBannerProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [hasRequested, setHasRequested] = useState(false)
  
  const { requestNotification, dismissNotification, canShowNotification } = useNotificationManager()
  const delay = useNotificationTiming('pwa-install')

  // Request to show via notification manager (coordinated with other notifications)
  useEffect(() => {
    if (hasRequested) return
    
    const timer = setTimeout(() => {
      setHasRequested(true)
      requestNotification('pwa-install')
    }, delay)

    return () => clearTimeout(timer)
  }, [delay, hasRequested, requestNotification])
  
  // Show only when notification manager allows
  useEffect(() => {
    if (hasRequested && canShowNotification('pwa-install')) {
      setIsVisible(true)
    }
  }, [hasRequested, canShowNotification])

  const handleClose = () => {
    // Simple dismiss - no confirmation needed
    setIsClosing(true)
    setTimeout(() => {
      dismissNotification('pwa-install')
      onDismiss()
    }, 200)
  }

  const handleInstall = async () => {
    const success = await onInstall()
    if (success) {
      setIsClosing(true)
      setTimeout(() => {
        dismissNotification('pwa-install')
        onDismiss()
      }, 200)
    }
  }

  if (!isVisible) return null

  // Get device-specific icon
  const DeviceIcon = deviceOS === 'ios' ? Share : deviceOS === 'android' ? Download : Monitor

  // Bottom Toast Banner (non-modal)
  if (!isModal) {
    return (
      <div
        className={cn(
          'fixed bottom-20 md:bottom-4 left-4 right-4 z-50',
          'transition-all duration-200 ease-out',
          isClosing ? 'translate-y-full opacity-0' : 'translate-y-0 opacity-100'
        )}
      >
        <div className="mx-auto max-w-md glass-elevated rounded-2xl p-4 flex items-center gap-4 border border-white/10">
          {/* App Icon */}
          <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-accent-gold/20 flex items-center justify-center">
            <Smartphone size={24} className="text-accent-gold" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-foreground-light truncate">
              הוסף למסך הבית
            </h3>
            <p className="text-xs text-foreground-muted mt-0.5">
              גישה מהירה + התראות על תורים
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {isInstallable ? (
              <button
                onClick={handleInstall}
                className="px-4 py-2 bg-accent-gold text-background-dark rounded-xl text-sm font-medium hover:bg-accent-gold/90 transition-colors"
              >
                התקן
              </button>
            ) : (
              <button
                onClick={() => {/* Will trigger modal */}}
                className="px-3 py-2 bg-white/10 text-foreground-light rounded-xl text-sm font-medium hover:bg-white/20 transition-colors flex items-center gap-1"
              >
                <ChevronDown size={16} />
                איך?
              </button>
            )}
            
            <button
              onClick={handleClose}
              className="p-2 text-foreground-muted hover:text-foreground-light transition-colors"
              aria-label="לא עכשיו"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Full Modal with Instructions (iOS or when user clicks "How?")
  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center p-4',
        'transition-all duration-200',
        isClosing ? 'opacity-0 pointer-events-none' : 'opacity-100'
      )}
    >
      {/* Backdrop */}
      <div
        className={cn(
          'absolute inset-0 bg-black/60 backdrop-blur-sm',
          isClosing && 'pointer-events-none'
        )}
        onClick={handleClose}
      />

      {/* Modal */}
      <div
        className={cn(
          'relative w-full max-w-sm',
          'glass-elevated rounded-3xl',
          'p-6 text-center',
          'transform transition-all duration-200',
          isClosing ? 'scale-95 opacity-0' : 'scale-100 opacity-100'
        )}
      >
        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute top-4 left-4 p-2 text-foreground-muted hover:text-foreground-light transition-colors rounded-full hover:bg-white/10 flex items-center justify-center"
          aria-label="סגור"
        >
          <X size={20} />
        </button>

        {/* App Icon */}
        <div className="mx-auto w-20 h-20 rounded-2xl bg-accent-gold/20 shadow-gold flex items-center justify-center mb-4">
          <DeviceIcon size={36} className="text-accent-gold" />
        </div>

        {/* Title */}
        <h2 className="text-xl font-bold text-foreground-light mb-2">
          {instructions.title}
        </h2>

        <p className="text-foreground-muted text-sm mb-6">
          גישה מהירה מהמסך הראשי + קבלת התראות על תורים
        </p>

        {/* Installation Steps */}
        <div className="text-right space-y-3 mb-6">
          {instructions.steps.map((step, index) => (
            <div key={index} className="flex items-start gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-accent-gold/20 text-accent-gold text-sm font-bold flex items-center justify-center">
                {index + 1}
              </div>
              <p className="text-foreground-light text-sm pt-0.5">{step}</p>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleClose}
            className="flex-1 py-3 px-4 rounded-xl bg-white/10 text-foreground-light font-medium hover:bg-white/20 transition-colors flex items-center justify-center"
          >
            לא עכשיו
          </button>
          
          {isInstallable && (
            <button
              onClick={handleInstall}
              className="flex-1 py-3 px-4 rounded-xl bg-accent-gold text-background-dark font-bold hover:bg-accent-gold/90 transition-colors flex items-center justify-center gap-2"
            >
              <Download size={18} />
              התקן עכשיו
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
