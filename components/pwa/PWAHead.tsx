'use client'

/**
 * PWA Meta Tags Component
 * Provides all necessary meta tags for iOS and PWA functionality
 * Includes splash screens for all modern iOS device sizes
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
      
      {/* iOS Splash Screens (Apple Touch Startup Images) */}
      {/* iPhone 15 Pro Max, 14 Pro Max (1290x2796 @3x) */}
      <link 
        rel="apple-touch-startup-image" 
        href="/splash/splash-1290x2796.png"
        media="(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)"
      />
      {/* iPhone 15 Pro, 15, 14 Pro (1179x2556 @3x) */}
      <link 
        rel="apple-touch-startup-image" 
        href="/splash/splash-1179x2556.png"
        media="(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3)"
      />
      {/* iPhone 14 Plus, 13 Pro Max, 12 Pro Max (1284x2778 @3x) */}
      <link 
        rel="apple-touch-startup-image" 
        href="/splash/splash-1284x2778.png"
        media="(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3)"
      />
      {/* iPhone 14, 13, 13 Pro, 12, 12 Pro (1170x2532 @3x) */}
      <link 
        rel="apple-touch-startup-image" 
        href="/splash/splash-1170x2532.png"
        media="(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)"
      />
      {/* iPhone 13 mini, 12 mini (1125x2436 @3x) */}
      <link 
        rel="apple-touch-startup-image" 
        href="/splash/splash-1125x2436.png"
        media="(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3)"
      />
      {/* iPhone 11 Pro Max, XS Max (1242x2688 @3x) */}
      <link 
        rel="apple-touch-startup-image" 
        href="/splash/splash-1242x2688.png"
        media="(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3)"
      />
      {/* iPhone 11, XR (828x1792 @2x) */}
      <link 
        rel="apple-touch-startup-image" 
        href="/splash/splash-828x1792.png"
        media="(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2)"
      />
      {/* iPhone 8 Plus, 7 Plus, 6s Plus, 6 Plus (1242x2208 @3x) */}
      <link 
        rel="apple-touch-startup-image" 
        href="/splash/splash-1242x2208.png"
        media="(device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3)"
      />
      {/* iPhone SE 2nd/3rd gen, 8, 7, 6s, 6 (750x1334 @2x) */}
      <link 
        rel="apple-touch-startup-image" 
        href="/splash/splash-750x1334.png"
        media="(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)"
      />
      {/* iPad Pro 12.9" (2048x2732 @2x) */}
      <link 
        rel="apple-touch-startup-image" 
        href="/splash/splash-2048x2732.png"
        media="(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2)"
      />
      {/* iPad Pro 11" (1668x2388 @2x) */}
      <link 
        rel="apple-touch-startup-image" 
        href="/splash/splash-1668x2388.png"
        media="(device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2)"
      />
      {/* iPad Air, iPad Pro 10.5" (1668x2224 @2x) */}
      <link 
        rel="apple-touch-startup-image" 
        href="/splash/splash-1668x2224.png"
        media="(device-width: 834px) and (device-height: 1112px) and (-webkit-device-pixel-ratio: 2)"
      />
      {/* iPad 10th gen (1640x2360 @2x) */}
      <link 
        rel="apple-touch-startup-image" 
        href="/splash/splash-1640x2360.png"
        media="(device-width: 820px) and (device-height: 1180px) and (-webkit-device-pixel-ratio: 2)"
      />
      {/* iPad mini, iPad 9th gen and older (1536x2048 @2x) */}
      <link 
        rel="apple-touch-startup-image" 
        href="/splash/splash-1536x2048.png"
        media="(device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2)"
      />
      
      {/* Favicons */}
      <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
      <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
      <link rel="shortcut icon" href="/favicon.ico" />
    </>
  )
}

