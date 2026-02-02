'use client'

/**
 * Branded Loading Screen
 * 
 * Displays immediately while Next.js loads the page content.
 * Features Ramel logo with subtle pulse animation and loading indicator.
 */
export default function Loading() {
  return (
    <div 
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background-dark"
      style={{ 
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {/* Subtle background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-background-dark via-background-dark/95 to-background-dark" />
      
      {/* Animated gradient orb */}
      <div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 opacity-20"
        style={{
          background: 'radial-gradient(circle, rgba(255, 170, 61, 0.3) 0%, transparent 70%)',
          animation: 'pulse 2s ease-in-out infinite',
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-6">
        {/* Logo with pulse */}
        <div className="relative">
          {/* Glow backdrop */}
          <div 
            className="absolute inset-0 rounded-full bg-accent-gold/15 blur-2xl scale-150"
            style={{ animation: 'pulse 2s ease-in-out infinite' }}
          />
          
          {/* Logo container */}
          <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden border-2 border-accent-gold/30 shadow-lg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icon.png"
              alt="רם אל ברברשופ"
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        {/* Brand name */}
        <div className="text-center">
          <h1 className="text-xl font-semibold text-foreground-light">
            רם אל <span className="text-accent-gold">ברברשופ</span>
          </h1>
        </div>

        {/* Loading indicator */}
        <div className="flex items-center gap-2 mt-2">
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-accent-gold"
                style={{
                  animation: 'bounce 1s ease-in-out infinite',
                  animationDelay: `${i * 150}ms`,
                }}
              />
            ))}
          </div>
          <span className="text-sm text-foreground-muted">טוען...</span>
        </div>
      </div>

      {/* Inline keyframes for loading animations */}
      <style jsx>{`
        @keyframes bounce {
          0%, 80%, 100% {
            transform: translateY(0);
            opacity: 0.5;
          }
          40% {
            transform: translateY(-6px);
            opacity: 1;
          }
        }
        @keyframes pulse {
          0%, 100% {
            opacity: 0.15;
            transform: scale(1);
          }
          50% {
            opacity: 0.25;
            transform: scale(1.05);
          }
        }
      `}</style>
    </div>
  )
}

