import type { Metadata, Viewport } from 'next'
import './globals.css'
import { Providers } from './providers'
import { AuthProvider } from '@/components/AuthProvider'
import { MobileBottomNav } from '@/components/ui/MobileBottomNav'
import { PWAProvider } from '@/components/pwa/PWAProvider'
import { PWAHead } from '@/components/pwa/PWAHead'
import ErrorBoundary from '@/components/ErrorBoundary'
import { CookieNotice } from '@/components/legal/CookieNotice'
import { SkipLink } from '@/components/a11y/SkipLink'
import { NotificationManagerProvider } from '@/components/NotificationManager'
import { PhoneCollectionManager } from '@/components/profile/PhoneCollectionManager'
import { EnhancedToaster } from '@/components/ui/EnhancedToaster'

export const metadata: Metadata = {
  title: 'רם אל ברברשופ - Ramel Barbershop',
  description: 'מספרה מקצועית בירושלים - רם אל ברברשופ | קביעת תורים אונליין',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'רם אל ברברשופ',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/apple-touch-icon-180x180.png', sizes: '180x180', type: 'image/png' },
      { url: '/icons/apple-touch-icon-167x167.png', sizes: '167x167', type: 'image/png' },
      { url: '/icons/apple-touch-icon-152x152.png', sizes: '152x152', type: 'image/png' },
      { url: '/icons/apple-touch-icon-120x120.png', sizes: '120x120', type: 'image/png' },
      { url: '/icons/apple-touch-icon-76x76.png', sizes: '76x76', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#080b0d',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="he"
      dir="rtl"
      data-theme="dark"
      className="dark"
      data-scroll-behavior="smooth"
      style={{ backgroundColor: '#080b0d' }}
      suppressHydrationWarning
    >
      <head>
        <PWAHead />
      </head>
      <body
        className="min-h-screen bg-background text-foreground font-ploni"
        style={{ backgroundColor: '#080b0d' }}
        suppressHydrationWarning
      >
        <SkipLink />
        <Providers>
          <NotificationManagerProvider>
            <AuthProvider>
              <PWAProvider>
                <ErrorBoundary component="RootLayout">
                  {children}
                </ErrorBoundary>
                <MobileBottomNav />
                <CookieNotice />
                <PhoneCollectionManager />
              </PWAProvider>
            </AuthProvider>
          </NotificationManagerProvider>
          <EnhancedToaster />
        </Providers>
      </body>
    </html>
  )
}
