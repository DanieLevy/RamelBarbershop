import type { Metadata, Viewport } from 'next'
import { Toaster } from 'sonner'
import './globals.css'
import { Providers } from './providers'
import { AuthProvider } from '@/components/AuthProvider'
import { MobileBottomNav } from '@/components/ui/MobileBottomNav'
import { PWAProvider } from '@/components/pwa/PWAProvider'
import { PWAHead } from '@/components/pwa/PWAHead'
import ErrorBoundary from '@/components/ErrorBoundary'
import { CookieNotice } from '@/components/legal/CookieNotice'
import { SkipLink } from '@/components/a11y/SkipLink'

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
    <html lang="he" dir="rtl" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <PWAHead />
      </head>
      <body className="min-h-screen bg-background-dark" suppressHydrationWarning>
        <SkipLink />
        <Providers>
          <AuthProvider>
            <PWAProvider>
              <ErrorBoundary component="RootLayout">
                {children}
              </ErrorBoundary>
              <MobileBottomNav />
              <CookieNotice />
            </PWAProvider>
          </AuthProvider>
          <Toaster
            position="top-center"
            dir="rtl"
            closeButton
            richColors
            theme="light"
            toastOptions={{
              className: 'mt-16 md:mt-0',
              classNames: {
                toast: 'bg-white/95 backdrop-blur-xl border shadow-xl font-ploni rounded-xl',
                title: 'font-medium text-sm',
                description: 'text-xs opacity-80',
                closeButton: '!bg-transparent hover:!bg-black/5 !border-0 !w-4 !h-4 !p-0 !m-0 !right-1.5 !top-1.5 [&>svg]:!w-2.5 [&>svg]:!h-2.5 !text-gray-400 hover:!text-gray-600 !transition-colors',
                success: '!bg-emerald-50/95 !border-emerald-200 !text-emerald-800 [&>[data-icon]]:text-emerald-500',
                error: '!bg-rose-50/95 !border-rose-200 !text-rose-800 [&>[data-icon]]:text-rose-500',
                warning: '!bg-amber-50/95 !border-amber-200 !text-amber-800 [&>[data-icon]]:text-amber-500',
                info: '!bg-sky-50/95 !border-sky-200 !text-sky-800 [&>[data-icon]]:text-sky-500',
              },
            }}
          />
        </Providers>
      </body>
    </html>
  )
}
