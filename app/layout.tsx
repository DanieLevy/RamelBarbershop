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
        {/* Pre-React chunk error recovery.
            Runs before ANY JS bundles load. If a chunk 404s (stale deployment),
            this catches the error globally and force-reloads with a cache-busting
            URL — even when React can't mount and error boundaries don't exist yet. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){
var PV=3,pvK='__purge_v';
try{
  var cv=+(localStorage.getItem(pvK)||0);
  console.log('[PurgeV] current='+cv+' required='+PV);
  if(cv<PV){
    console.log('[PurgeV] Outdated — running forced cleanup');
    localStorage.setItem(pvK,''+PV);
    var done=[];
    if('caches'in window)done.push(caches.keys().then(function(n){console.log('[PurgeV] Clearing '+n.length+' caches');return Promise.all(n.map(function(c){return caches.delete(c)}))}));
    if('serviceWorker'in navigator)done.push(navigator.serviceWorker.getRegistrations().then(function(regs){console.log('[PurgeV] Unregistering '+regs.length+' SW(s)');return Promise.all(regs.map(function(r){return r.unregister()}))}));
    Promise.all(done).catch(function(){}).then(function(){
      console.log('[PurgeV] Done — reloading');
      var u=location.pathname+location.search;
      location.replace(u+(u.indexOf('?')>=0?'&':'?')+'_purge='+PV+'&_cb='+Date.now())
    });
    return
  }
}catch(e){console.error('[PurgeV] Error:',e)}
if(location.search.indexOf('_purge=')>=0){try{var pu=new URL(location.href);pu.searchParams.delete('_purge');pu.searchParams.delete('_cb');history.replaceState(null,'',pu.pathname+(pu.search||'')+pu.hash)}catch(e){}}
var K='__chunk_recovery',W=30000;
function chk(m){return m&&(m.indexOf('ChunkLoadError')>=0||m.indexOf('Failed to load chunk')>=0||m.indexOf('Loading chunk')>=0||m.indexOf('dynamically imported module')>=0)}
function go(msg){
  console.log('[ChunkRecovery] Error detected:',msg);
  try{var l=+sessionStorage.getItem(K)||0;if(Date.now()-l<W){console.log('[ChunkRecovery] Within cooldown — skipping');return}}catch(e){}
  try{sessionStorage.setItem(K,''+Date.now())}catch(e){}
  console.log('[ChunkRecovery] Reloading to get fresh assets');
  location.reload();
}
window.addEventListener('error',function(e){if(chk(e.message||''))go(e.message)});
window.addEventListener('unhandledrejection',function(e){var r=e.reason;var m=r?(r.message||''+r):'';if(chk(m))go(m)});
if('serviceWorker'in navigator)navigator.serviceWorker.addEventListener('message',function(e){if(e.data&&e.data.type==='CHUNK_STALE'){console.log('[ChunkRecovery] SW notified stale chunk:',e.data.url);go('SW stale chunk: '+(e.data.url||'unknown'))}})
})()`,
          }}
        />
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
