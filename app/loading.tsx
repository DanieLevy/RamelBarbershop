'use client'

/**
 * Minimal Page Transition Loading Indicator
 * 
 * Shows a subtle progress bar at the top of the screen during page navigation.
 * This avoids the jarring full-screen overlay that causes a "reload" feeling.
 * 
 * The previous full-screen branded loading was causing poor UX during SPA navigation.
 */
export default function Loading() {
  return (
    <>
      {/* Top progress bar - subtle, non-blocking */}
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

