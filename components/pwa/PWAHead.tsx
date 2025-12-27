'use client'

/**
 * PWA Meta Tags Component
 * Provides all necessary meta tags for iOS and PWA functionality
 */
export function PWAHead() {
  return (
    <>
      {/* Standard PWA Meta Tags */}
      <meta name="mobile-web-app-capable" content="yes" />
      <meta name="apple-touch-fullscreen" content="yes" />
      <meta name="apple-mobile-web-app-title" content="רמאל ברברשופ" />
      <meta name="application-name" content="רמאל ברברשופ" />
      <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      <meta name="msapplication-TileColor" content="#080b0d" />
      <meta name="msapplication-TileImage" content="/icons/icon-144x144.png" />
      
      {/* Apple Touch Icons */}
      <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      <link rel="apple-touch-icon" sizes="152x152" href="/icons/apple-touch-icon-152x152.png" />
      <link rel="apple-touch-icon" sizes="167x167" href="/icons/apple-touch-icon-167x167.png" />
      <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon-180x180.png" />
      
      {/* Precomposed for older iOS */}
      <link rel="apple-touch-icon-precomposed" sizes="180x180" href="/icons/apple-touch-icon-180x180.png" />
      
      {/* Favicons */}
      <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
      <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
      <link rel="shortcut icon" href="/favicon.ico" />
    </>
  )
}

