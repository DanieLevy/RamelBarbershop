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
var PV=4,pvK='__purge_v';
console.log('[Audit:boot] url='+location.href+' time='+new Date().toISOString());
try{
  var hasSW='serviceWorker'in navigator;
  var hasCaches='caches'in window;
  console.log('[Audit:boot] hasSW='+hasSW+' hasCaches='+hasCaches+' online='+navigator.onLine+' standalone='+!!(window.matchMedia&&window.matchMedia('(display-mode: standalone)').matches));
  if(hasSW&&navigator.serviceWorker.controller){
    var ctrl=navigator.serviceWorker.controller;
    console.log('[Audit:boot] SW controller active url='+ctrl.scriptURL+' state='+ctrl.state);
  }else{
    console.log('[Audit:boot] No SW controller — page not controlled');
  }
  if(hasSW){navigator.serviceWorker.getRegistration('/').then(function(r){
    if(r)console.log('[Audit:boot] SW reg scope='+r.scope+' active='+(r.active?r.active.state:'none')+' waiting='+(r.waiting?r.waiting.state:'none')+' installing='+(r.installing?r.installing.state:'none'));
    else console.log('[Audit:boot] No SW registration found');
  }).catch(function(e){console.warn('[Audit:boot] getRegistration error:',e)})}
  if(hasCaches){caches.keys().then(function(n){console.log('[Audit:boot] Caches('+n.length+'): ['+n.join(', ')+']')}).catch(function(){})}
}catch(e){console.warn('[Audit:boot] Snapshot error:',e)}
try{
  var cv=+(localStorage.getItem(pvK)||0);
  console.log('[PurgeV] current='+cv+' required='+PV);
  if(cv<PV){
    console.log('[PurgeV] Outdated — running forced cleanup ('+cv+' -> '+PV+')');
    localStorage.setItem(pvK,''+PV);
    var done=[];
    if('caches'in window)done.push(caches.keys().then(function(n){console.log('[PurgeV] Clearing '+n.length+' caches: ['+n.join(', ')+']');return Promise.all(n.map(function(c){return caches.delete(c)}))}));
    if('serviceWorker'in navigator)done.push(navigator.serviceWorker.getRegistrations().then(function(regs){console.log('[PurgeV] Unregistering '+regs.length+' SW(s)');return Promise.all(regs.map(function(r){return r.unregister()}))}));
    Promise.all(done).catch(function(){}).then(function(){
      console.log('[PurgeV] Cleanup done — reloading');
      var u=location.pathname+location.search;
      location.replace(u+(u.indexOf('?')>=0?'&':'?')+'_purge='+PV+'&_cb='+Date.now())
    });
    return
  }else{
    console.log('[PurgeV] Up to date — no cleanup needed');
  }
}catch(e){console.error('[PurgeV] Error:',e)}
if(location.search.indexOf('_purge=')>=0){try{var pu=new URL(location.href);pu.searchParams.delete('_purge');pu.searchParams.delete('_cb');history.replaceState(null,'',pu.pathname+(pu.search||'')+pu.hash);console.log('[PurgeV] Cleaned _purge params from URL')}catch(e){}}
var K='__chunk_recovery',W=30000;
function chk(m){return m&&(m.indexOf('ChunkLoadError')>=0||m.indexOf('Failed to load chunk')>=0||m.indexOf('Loading chunk')>=0||m.indexOf('dynamically imported module')>=0)}
function go(msg){
  var l=0;try{l=+sessionStorage.getItem(K)||0}catch(e){}
  var elapsed=Date.now()-l;
  console.log('[ChunkRecovery:inline] error="'+String(msg).slice(0,120)+'" elapsed='+elapsed+'ms cooldown='+W+'ms');
  if(elapsed<W){console.log('[ChunkRecovery:inline] Within cooldown — skipping');return}
  try{sessionStorage.setItem(K,''+Date.now())}catch(e){}
  console.log('[ChunkRecovery:inline] Reloading for fresh assets');
  location.reload();
}
window.addEventListener('error',function(e){if(chk(e.message||'')){console.warn('[ChunkRecovery:inline] window.error: '+e.message+' file='+e.filename+' line='+e.lineno);go(e.message)}});
window.addEventListener('unhandledrejection',function(e){var r=e.reason;var m=r?(r.message||''+r):'';if(chk(m)){console.warn('[ChunkRecovery:inline] unhandledrejection: '+m);go(m)}});
if('serviceWorker'in navigator)navigator.serviceWorker.addEventListener('message',function(e){if(e.data&&e.data.type==='CHUNK_STALE'){console.log('[ChunkRecovery:inline] SW CHUNK_STALE url='+e.data.url);go('SW stale chunk: '+(e.data.url||'unknown'))}});
console.log('[Audit:boot] Inline script complete — listeners registered');
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
