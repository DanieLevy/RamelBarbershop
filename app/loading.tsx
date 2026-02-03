'use client'

import { ScissorsLoader } from '@/components/ui/ScissorsLoader'

/**
 * Global Page Transition Loading Indicator
 * 
 * Shows the branded scissors loader during page navigation.
 * Creates a consistent visual language across all page transitions.
 */
export default function Loading() {
  return (
    <>
      {/* Top progress bar - for visual continuity */}
      <div 
        className="fixed top-0 left-0 right-0 z-[9999] h-0.5 bg-background-dark"
        style={{ 
          paddingTop: 'env(safe-area-inset-top, 0px)',
        }}
      >
        <div 
          className="h-full bg-gradient-to-r from-accent-gold via-accent-orange to-accent-gold"
          style={{
            animation: 'loading-progress 1s ease-in-out infinite',
          }}
        />
      </div>

      {/* Full screen scissors loader */}
      <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-background-dark/80 backdrop-blur-sm">
        <ScissorsLoader size="lg" text="טוען..." />
      </div>

      {/* Inline keyframes for loading animation */}
      <style jsx>{`
        @keyframes loading-progress {
          0% {
            width: 0%;
            opacity: 1;
          }
          50% {
            width: 70%;
            opacity: 1;
          }
          100% {
            width: 100%;
            opacity: 0;
          }
        }
      `}</style>
    </>
  )
}

