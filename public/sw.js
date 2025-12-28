// Service Worker for Ramel Barbershop PWA
// Version is updated automatically during build
const APP_VERSION = '2025.12.28.1348';
const CACHE_NAME = `ramel-pwa-${APP_VERSION}`;

// Assets to cache (minimal - only critical for app shell)
const STATIC_ASSETS = [
  '/manifest.json',
  '/fonts/ploni-regular-aaa.otf',
  '/fonts/ploni-light-aaa.otf',
  '/fonts/ploni-ultralight-aaa.otf',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/apple-touch-icon.png'
];

// Install event - cache static assets
// IMPORTANT: Do NOT call skipWaiting() here - we want the SW to enter "waiting" state
// so the user can see the update modal and choose when to update
self.addEventListener('install', (event) => {
  console.log(`[SW] Installing version ${APP_VERSION}`);
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[SW] Installation complete - waiting for activation');
        // Do NOT call skipWaiting() here - let the update modal handle it
        // The user will trigger skipWaiting via the update modal
      })
  );
});

// Activate event - clean old caches and notify clients
self.addEventListener('activate', (event) => {
  console.log(`[SW] Activating version ${APP_VERSION}`);
  
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name.startsWith('ramel-pwa-') && name !== CACHE_NAME)
            .map((name) => {
              console.log(`[SW] Deleting old cache: ${name}`);
              return caches.delete(name);
            })
        );
      }),
      // Take control of all clients immediately
      self.clients.claim()
    ]).then(() => {
      // Notify all clients about the update
      return self.clients.matchAll({ type: 'window' }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'SW_UPDATED',
            version: APP_VERSION
          });
        });
      });
    })
  );
});

// Fetch event - Network first, cache fallback for static assets only
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip API calls - always fresh data
  if (url.pathname.startsWith('/api/')) return;

  // Skip Supabase and external requests
  if (!url.origin.includes(self.location.origin)) return;

  // For navigation requests - always network first
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .catch(() => {
          // Could return offline page here if needed
          return new Response('Offline', { status: 503 });
        })
    );
    return;
  }

  // For static assets (fonts, icons) - cache first, network fallback
  const isStaticAsset = 
    url.pathname.startsWith('/fonts/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/manifest.json' ||
    url.pathname === '/apple-touch-icon.png';

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request).then((networkResponse) => {
          // Cache the new response
          if (networkResponse.ok) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // All other requests - network only (real-time data)
  // Don't cache dynamic content
});

// Message handler for skip waiting
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW] Skip waiting requested');
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: APP_VERSION });
  }
});

// Background sync for offline booking attempts (future feature)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-bookings') {
    console.log('[SW] Syncing offline bookings...');
    // Future implementation for offline-first booking
  }
});

console.log(`[SW] Service Worker loaded - Version ${APP_VERSION}`);

