'use client'

/**
 * Enhanced Toaster Component
 * 
 * Mobile-optimized toast notification system with dark theme design.
 * Features:
 * - RTL support for Hebrew
 * - Dark glassmorphism design
 * - Smooth animations
 * - Touch-friendly sizing
 * - Safe area aware positioning
 * - Custom icons and colors matching brand
 */

import { Toaster as SonnerToaster } from 'sonner'
import './toast-styles.css'

/**
 * Enhanced Toaster with dark theme and mobile-optimized styling
 * Place this in your root layout.tsx
 */
export const EnhancedToaster = () => {
  return (
    <SonnerToaster
      position="top-center"
      dir="rtl"
      closeButton
      richColors={false}
      theme="dark"
      gap={8}
      visibleToasts={3}
      expand={false}
      toastOptions={{
        duration: 4000,
        className: 'enhanced-toast',
        classNames: {
          // Main toast container - Dark theme
          toast: [
            'group',
            'font-ploni',
            // Dark glass effect
            '!bg-zinc-900/95',
            'backdrop-blur-xl',
            // Border
            '!border !border-white/10',
            // Shadow
            'shadow-[0_8px_32px_rgba(0,0,0,0.4)]',
            // Shape
            'rounded-xl',
            // Sizing - compact
            'min-h-[48px]',
            'px-4 py-3',
            // Mobile margin
            'mt-16 md:mt-2',
            // Width
            'w-[calc(100vw-32px)] sm:w-auto sm:min-w-[280px] sm:max-w-[360px]',
          ].join(' '),
          
          // Title text
          title: [
            'font-medium',
            'text-sm',
            'leading-snug',
            '!text-white',
          ].join(' '),
          
          // Description text
          description: [
            'text-xs',
            'leading-relaxed',
            '!text-zinc-400',
            'mt-0.5',
          ].join(' '),
          
          // Close button - inside toast, RTL positioned (left side)
          closeButton: [
            '!static',
            '!relative',
            '!bg-white/10',
            '!border-0',
            '!w-6 !h-6',
            '!p-0',
            '!ml-2',
            '!flex-shrink-0',
            '[&>svg]:!w-3 [&>svg]:!h-3',
            '!text-zinc-400',
            'hover:!text-white',
            'hover:!bg-white/20',
            '!transition-all !duration-150',
            '!rounded-md',
          ].join(' '),
          
          // Action button
          actionButton: [
            '!bg-accent-gold',
            '!text-zinc-900',
            '!font-medium',
            '!text-xs',
            '!px-3 !py-1.5',
            '!rounded-lg',
            '!border-0',
            'hover:!bg-accent-gold-light',
            '!transition-colors',
          ].join(' '),
          
          // Cancel button
          cancelButton: [
            '!bg-white/10',
            '!text-zinc-300',
            '!font-medium',
            '!text-xs',
            '!px-3 !py-1.5',
            '!rounded-lg',
            '!border-0',
            'hover:!bg-white/20',
            '!transition-colors',
          ].join(' '),
          
          // Icon container
          icon: [
            'flex-shrink-0',
            '[&>svg]:w-[18px] [&>svg]:h-[18px]',
          ].join(' '),
          
          // ============================================
          // Variant-specific styles - Dark Theme
          // ============================================
          
          // Success variant
          success: [
            '!bg-zinc-900/95',
            '!border-emerald-500/30',
            // Icon
            '[&>[data-icon]]:!text-emerald-400',
            // Left accent bar
            'before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-emerald-500 before:rounded-l-xl',
          ].join(' '),
          
          // Error variant
          error: [
            '!bg-zinc-900/95',
            '!border-rose-500/30',
            '[&>[data-icon]]:!text-rose-400',
            'before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-rose-500 before:rounded-l-xl',
          ].join(' '),
          
          // Warning variant
          warning: [
            '!bg-zinc-900/95',
            '!border-amber-500/30',
            '[&>[data-icon]]:!text-amber-400',
            'before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-amber-500 before:rounded-l-xl',
          ].join(' '),
          
          // Info variant
          info: [
            '!bg-zinc-900/95',
            '!border-sky-500/30',
            '[&>[data-icon]]:!text-sky-400',
            'before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-sky-500 before:rounded-l-xl',
          ].join(' '),
          
          // Loading variant
          loading: [
            '!bg-zinc-900/95',
            '!border-accent-gold/30',
            '[&>[data-icon]]:!text-accent-gold',
          ].join(' '),
        },
      }}
    />
  )
}

export default EnhancedToaster
