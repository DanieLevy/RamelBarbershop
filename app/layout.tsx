import type { Metadata, Viewport } from 'next'
import { Toaster } from 'sonner'
import './globals.css'
import { Providers } from './providers'
import { AuthProvider } from '@/components/AuthProvider'
import { MobileBottomNav } from '@/components/ui/MobileBottomNav'

export const metadata: Metadata = {
  title: 'Ramel BarberShop',
  description: 'מספרה מקצועית בירושלים - רמאל ברברשופ',
  icons: {
    icon: '/NewIcon.png',
    apple: '/NewIcon.png',
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Ramel Barbershop',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#080b0d',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="he" dir="rtl">
      <head>
        {/* Unregister stale service workers */}
        <script src="/unregister-sw.js" defer />
      </head>
      <body className="min-h-screen bg-background-dark" suppressHydrationWarning>
        <Providers>
          <AuthProvider>
            {children}
            <MobileBottomNav />
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
                background: '#1a1a1a',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#F2F2F2',
              },
            }}
          />
        </Providers>
      </body>
    </html>
  )
}
