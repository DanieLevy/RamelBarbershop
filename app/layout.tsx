import type { Metadata, Viewport } from 'next'
import { Toaster } from 'sonner'
import './globals.css'
import { Providers } from './providers'
import { AuthProvider } from '@/components/AuthProvider'
import { MobileBottomNav } from '@/components/ui/MobileBottomNav'
import { PWAProvider } from '@/components/pwa/PWAProvider'
import { PWAHead } from '@/components/pwa/PWAHead'

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
              {children}
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
              style: {
                background: 'var(--glass-bg-strong)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#F2F2F2',
                fontFamily: 'Ploni, Rubik, sans-serif',
              },
            }}
          />
        </Providers>
      </body>
    </html>
  )
}
