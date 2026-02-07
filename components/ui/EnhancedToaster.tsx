'use client'

/**
 * Enhanced Toaster Component - Powered by react-hot-toast
 * 
 * Mobile-optimized toast notification system with dark theme design.
 * Features:
 * - RTL support for Hebrew
 * - Dark theme styling
 * - iPhone notch/safe area aware positioning
 * - Touch-friendly sizing
 */

import { Toaster } from 'react-hot-toast'

/**
 * Enhanced Toaster with dark theme and safe area support
 * Place this in your root layout.tsx
 * 
 * containerStyle uses env(safe-area-inset-top) to push toasts below the iPhone notch.
 * The CSS variable falls back to 0px on devices without a notch.
 */
export const EnhancedToaster = () => {
  return (
    <Toaster
      position="top-center"
      reverseOrder={false}
      gutter={8}
      containerStyle={{
        // Respect iPhone notch / safe area - push toasts below the notch
        top: 'max(env(safe-area-inset-top, 0px), 8px)',
        direction: 'rtl',
      }}
      toastOptions={{
        duration: 4000,
        removeDelay: 500,
        style: {
          background: '#18181b',
          color: '#fff',
          borderRadius: '12px',
          border: '1px solid rgba(255,255,255,0.1)',
          padding: '12px 16px',
          fontSize: '14px',
          direction: 'rtl',
          fontFamily: 'var(--font-ploni), system-ui, sans-serif',
          maxWidth: '360px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
        },
        success: {
          duration: 3000,
          style: {
            borderColor: 'rgba(52,211,153,0.3)',
          },
          iconTheme: {
            primary: '#34d399',
            secondary: '#18181b',
          },
        },
        error: {
          duration: 5000,
          style: {
            borderColor: 'rgba(244,63,94,0.3)',
          },
          iconTheme: {
            primary: '#f43f5e',
            secondary: '#18181b',
          },
        },
        loading: {
          style: {
            borderColor: 'rgba(212,175,55,0.3)',
          },
          iconTheme: {
            primary: '#d4af37',
            secondary: '#18181b',
          },
        },
      }}
    />
  )
}

export default EnhancedToaster
