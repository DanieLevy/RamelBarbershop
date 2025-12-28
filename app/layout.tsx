import type { Metadata, Viewport } from 'next'
import { Toaster } from 'sonner'
import './globals.css'
import { Providers } from './providers'
import { AuthProvider } from '@/components/AuthProvider'
import { MobileBottomNav } from '@/components/ui/MobileBottomNav'
import { PWAProvider } from '@/components/pwa/PWAProvider'
import { PWAHead } from '@/components/pwa/PWAHead'
import ErrorBoundary from '@/components/ErrorBoundary'

export const metadata: Metadata = {
  title: 'רמאל ברברשופ - Ramel Barbershop',
  description: 'מספרה מקצועית בירושלים - רמאל ברברשופ | קביעת תורים אונליין',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'רמאל ברברשופ',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/apple-touch-icon-180x180.png', sizes: '180x180', type: 'image/png' },
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
        <Providers>
          <AuthProvider>
            <PWAProvider>
              <ErrorBoundary component="RootLayout">
                {children}
              </ErrorBoundary>
              <MobileBottomNav />
            </PWAProvider>
          </AuthProvider>
          <Toaster
            position="bottom-center"
            dir="rtl"
            closeButton
            richColors
            theme="dark"
            toastOptions={{
              className: 'mb-16 md:mb-0',
              classNames: {
                toast: 'bg-background-card/95 backdrop-blur-xl border border-white/10 text-foreground-light font-ploni shadow-xl',
                title: 'text-foreground-light font-medium text-sm',
                description: 'text-foreground-muted text-xs',
                closeButton: '!bg-transparent hover:!bg-white/10 !border-0 !w-4 !h-4 !p-0 !m-0 !right-1.5 !top-1.5 [&>svg]:!w-2.5 [&>svg]:!h-2.5 !text-foreground-muted hover:!text-foreground-light !transition-colors',
                success: '!border-green-500/30 [&>[data-icon]]:text-green-400',
                error: '!border-red-500/30 [&>[data-icon]]:text-red-400',
                warning: '!border-amber-500/30 [&>[data-icon]]:text-amber-400',
                info: '!border-blue-500/30 [&>[data-icon]]:text-blue-400',
              },
            }}
          />
        </Providers>
      </body>
    </html>
  )
}
