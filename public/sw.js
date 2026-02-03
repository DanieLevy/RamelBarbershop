// Service Worker for Ramel Barbershop PWA
// Version is updated automatically during build
const APP_VERSION = '2.0.0-2026.02.04.0059';
const CACHE_NAME = `ramel-pwa-${APP_VERSION}`;

// Icon version - increment when icons change to bust cache
const ICON_VERSION = 2;

// Assets to cache - critical for app shell and fast loading
// These are pre-cached on install for offline app shell
const STATIC_ASSETS = [
  '/manifest.json',
  // Fonts
  '/fonts/ploni-regular-aaa.otf',
  '/fonts/ploni-light-aaa.otf',
  '/fonts/ploni-ultralight-aaa.otf',
  // PWA Icons (versioned for cache busting)
  `/icons/icon-72x72.png?v=${ICON_VERSION}`,
  `/icons/icon-96x96.png?v=${ICON_VERSION}`,
  `/icons/icon-128x128.png?v=${ICON_VERSION}`,
  `/icons/icon-144x144.png?v=${ICON_VERSION}`,
  `/icons/icon-152x152.png?v=${ICON_VERSION}`,
  `/icons/icon-192x192.png?v=${ICON_VERSION}`,
  `/icons/icon-384x384.png?v=${ICON_VERSION}`,
  `/icons/icon-512x512.png?v=${ICON_VERSION}`,
  // Apple Touch Icons
  '/apple-touch-icon.png',
  `/icons/apple-touch-icon-180x180.png?v=${ICON_VERSION}`,
  `/icons/apple-touch-icon-152x152.png?v=${ICON_VERSION}`,
  // Main branding
  '/icon.png',
  '/logo.png',
  '/favicon.ico'
];

// Next.js static assets pattern - only production chunks should be cached
const NEXT_STATIC_PATTERN = /^\/_next\/static\//;

// Development-only patterns that should NEVER be cached
// These are only present in development mode but we exclude them for safety
const DEV_PATTERNS = [
  /turbopack/i,           // Turbopack dev chunks
  /hmr-client/i,          // Hot Module Replacement
  /webpack-hmr/i,         // Webpack HMR
  /_devtools/i,           // Dev tools
  /\.hot-update\./i,      // Hot updates
];

// Check if a URL is a development-only asset
function isDevAsset(pathname) {
  return DEV_PATTERNS.some(pattern => pattern.test(pathname));
}

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
      // Clean up old version caches completely
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
      // Clean up any dev assets from current cache
      caches.open(CACHE_NAME).then(async (cache) => {
        const requests = await cache.keys();
        const deletePromises = [];
        
        for (const request of requests) {
          const url = new URL(request.url);
          if (isDevAsset(url.pathname)) {
            console.log(`[SW] Removing dev asset from cache: ${url.pathname}`);
            deletePromises.push(cache.delete(request));
          }
        }
        
        if (deletePromises.length > 0) {
          console.log(`[SW] Cleaned ${deletePromises.length} dev assets from cache`);
        }
        
        return Promise.all(deletePromises);
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
// 
// IMPORTANT: What gets cached vs what stays REAL-TIME:
// ======================================================
// ✅ CACHED (truly static, never changes):
//    - /_next/static/* (JS/CSS with content hashes - immutable)
//    - /fonts/* (static font files)
//    - /icons/* (static icons)
//    - /manifest.json, /icon.png, etc.
//
// ❌ NEVER CACHED (must be real-time for reservations):
//    - /api/* (all API endpoints)
//    - Supabase requests (database queries)
//    - RSC payloads (?_rsc=* params - dynamic React data)
//    - /_next/data/* (getServerSideProps data)
//    - Page navigations (always network-first)
//    - /_next/image/* (optimized images - short cache via headers)
//
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // ========================================
  // NEVER CACHE - Real-time data sources
  // ========================================
  
  // Skip API calls - ALWAYS fresh data for reservations, availability, etc.
  if (url.pathname.startsWith('/api/')) return;

  // Skip Supabase and external requests - database must be real-time
  if (!url.origin.includes(self.location.origin)) return;

  // Skip RSC (React Server Components) payloads - these contain dynamic data
  // RSC payloads have ?_rsc= query parameter and must be fresh for reservations
  if (url.searchParams.has('_rsc')) return;

  // Skip Next.js data routes (getServerSideProps/getStaticProps with revalidation)
  if (url.pathname.startsWith('/_next/data/')) return;

  // Skip optimized images - let browser cache headers handle these
  // User-uploaded images (barber photos, products) should be fresh
  if (url.pathname.startsWith('/_next/image')) return;

  // Skip development-only assets - NEVER cache these
  // This prevents dev chunks from being cached if SW is used in dev mode
  if (isDevAsset(url.pathname)) {
    console.log('[SW] Skipping dev asset:', url.pathname);
    return;
  }

  // ========================================
  // Navigation - Network first with offline fallback
  // ========================================
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .catch(() => {
          // Return branded offline page
          return new Response(getOfflinePage(), {
            status: 503,
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
          });
        })
    );
    return;
  }

  // For Next.js static assets - cache-first strategy (no background revalidation)
  // IMPORTANT: Next.js static chunks have content hashes in filenames, so they're immutable
  // We don't need stale-while-revalidate because the hash changes when content changes
  // This prevents duplicate fetches that were doubling our network requests!
  if (NEXT_STATIC_PATTERN.test(url.pathname)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cachedResponse = await cache.match(request);
        
        if (cachedResponse) {
          // Cache hit - return immediately, NO background fetch
          // These files are immutable (content hash in filename)
          return cachedResponse;
        }
        
        // Cache miss - fetch from network and cache for future
        try {
          const networkResponse = await fetch(request);
          if (networkResponse.ok) {
            // Clone before caching since response body can only be read once
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        } catch (error) {
          // Network failed and no cache - return error
          console.error('[SW] Failed to fetch static asset:', url.pathname);
          throw error;
        }
      })
    );
    return;
  }

  // For static assets (fonts, icons, images) - cache first, network fallback
  const isStaticAsset = 
    url.pathname.startsWith('/fonts/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/manifest.json' ||
    url.pathname === '/apple-touch-icon.png' ||
    url.pathname === '/icon.png';

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

/**
 * Generate branded offline page HTML
 */
function getOfflinePage() {
  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <meta name="theme-color" content="#080b0d">
  <title>אין חיבור לאינטרנט - רם אל ברברשופ</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: #080b0d;
      color: #e5e5e5;
      font-family: system-ui, -apple-system, sans-serif;
      padding: 24px;
      padding-top: env(safe-area-inset-top, 24px);
      padding-bottom: env(safe-area-inset-bottom, 24px);
    }
    .container {
      text-align: center;
      max-width: 320px;
    }
    .logo {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      margin-bottom: 24px;
      border: 2px solid rgba(255, 170, 61, 0.3);
      opacity: 0.8;
    }
    h1 {
      font-size: 1.25rem;
      font-weight: 600;
      margin-bottom: 8px;
    }
    .gold { color: #ffaa3d; }
    p {
      color: #9ca3af;
      font-size: 0.9rem;
      margin-bottom: 24px;
      line-height: 1.6;
    }
    .icon {
      width: 48px;
      height: 48px;
      margin-bottom: 16px;
      opacity: 0.5;
    }
    button {
      background: #ffaa3d;
      color: #080b0d;
      border: none;
      padding: 12px 24px;
      border-radius: 12px;
      font-size: 0.9rem;
      font-weight: 500;
      cursor: pointer;
      transition: opacity 0.2s;
    }
    button:hover { opacity: 0.9; }
  </style>
</head>
<body>
  <div class="container">
    <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="1.5">
      <path d="M1 1l22 22M9 9v-3a3 3 0 0 1 5.12-2.12M15 15.53c-.28.17-.58.31-.88.43-1.46.6-3.24.6-4.7 0A7 7 0 0 1 5 9m14 0a7 7 0 0 1-.33 2.12M5 19a10.94 10.94 0 0 0 7 2.54c2.24 0 4.3-.63 6-1.7" stroke-linecap="round"/>
    </svg>
    <img src="/icon.png" alt="" class="logo">
    <h1>רם אל <span class="gold">ברברשופ</span></h1>
    <p>אין חיבור לאינטרנט.<br>אנא בדוק את החיבור ונסה שוב.</p>
    <button onclick="location.reload()">נסה שוב</button>
  </div>
</body>
</html>`;
}

// Message handler for skip waiting and cache management
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW] Skip waiting requested');
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: APP_VERSION });
  }
  
  // Handle cache clear request - useful for troubleshooting
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    console.log('[SW] Clear cache requested');
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          console.log(`[SW] Deleting cache: ${name}`);
          return caches.delete(name);
        })
      );
    }).then(() => {
      console.log('[SW] All caches cleared');
      // Notify the requesting client
      if (event.source) {
        event.source.postMessage({ type: 'CACHE_CLEARED', success: true });
      }
    }).catch((error) => {
      console.error('[SW] Failed to clear caches:', error);
      if (event.source) {
        event.source.postMessage({ type: 'CACHE_CLEARED', success: false, error: error.message });
      }
    });
  }
  
  // Handle cleanup of dev assets from cache
  if (event.data && event.data.type === 'CLEANUP_DEV_ASSETS') {
    console.log('[SW] Cleanup dev assets requested');
    caches.open(CACHE_NAME).then(async (cache) => {
      const requests = await cache.keys();
      let cleaned = 0;
      
      for (const request of requests) {
        const url = new URL(request.url);
        if (isDevAsset(url.pathname)) {
          await cache.delete(request);
          cleaned++;
        }
      }
      
      console.log(`[SW] Cleaned ${cleaned} dev assets`);
      if (event.source) {
        event.source.postMessage({ type: 'DEV_ASSETS_CLEANED', count: cleaned });
      }
    });
  }
});

// Background sync for offline booking attempts (future feature)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-bookings') {
    console.log('[SW] Syncing offline bookings...');
    // Future implementation for offline-first booking
  }
});

// =============================================================================
// PUSH NOTIFICATIONS
// =============================================================================

/**
 * Handle incoming push notifications
 */
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');

  // Default notification data
  let notificationData = {
    title: 'רם אל ברברשופ',
    body: 'יש לך התראה חדשה',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    tag: 'ramel-notification',
    requireInteraction: false,
    data: { url: '/' },
    badgeCount: 1
  };

  // Parse push payload if available
  if (event.data) {
    try {
      const payload = event.data.json();
      
      if (payload.notification) {
        notificationData = {
          ...notificationData,
          ...payload.notification
        };
      }
      
      if (payload.badgeCount !== undefined) {
        notificationData.badgeCount = payload.badgeCount;
      }
    } catch (err) {
      // If JSON parse fails, use text as body
      console.log('[SW] Failed to parse push payload, using text');
      notificationData.body = event.data.text();
    }
  }

  // Build notification options with RTL/Hebrew support
  const options = {
    body: notificationData.body,
    icon: notificationData.icon,
    badge: notificationData.badge,
    image: notificationData.image,
    vibrate: [200, 100, 200],
    tag: notificationData.tag,
    requireInteraction: notificationData.requireInteraction,
    actions: notificationData.actions || [
      { action: 'view', title: 'צפה' },
      { action: 'dismiss', title: 'סגור' }
    ],
    data: notificationData.data || { url: '/' },
    dir: 'rtl', // Right-to-left for Hebrew
    lang: 'he'  // Hebrew language
  };

  event.waitUntil(
    Promise.all([
      // Show the notification
      self.registration.showNotification(notificationData.title, options),
      // Update app badge (iOS 16.4+)
      updateBadge(notificationData.badgeCount)
    ])
  );
});

/**
 * Get the target URL for a notification based on type and recipient
 * This provides recipient-type-aware routing with fallback logic
 * 
 * @param {Object} data - Notification data payload
 * @param {string} action - The action clicked (view, rebook, dismiss, etc.)
 * @returns {string} - The target URL to navigate to
 */
function getTargetUrlForNotification(data, action) {
  // Handle rebook action - always go to home for booking
  if (action === 'rebook') {
    return '/?action=book';
  }
  
  // If URL is provided in notification data, use it (preferred)
  if (data && data.url) {
    return data.url;
  }
  
  // Fallback routing based on notification type and recipient
  const { type, recipientType, reservationId, cancelledBy } = data || {};
  
  // Barber-targeted notifications
  if (recipientType === 'barber') {
    if (reservationId) {
      // For booking_confirmed and cancellation (to barber), link to reservations with highlight
      if (type === 'cancellation' && cancelledBy === 'customer') {
        return `/barber/dashboard/reservations?highlight=${reservationId}&tab=cancelled`;
      }
      // For cancel_request, link to reservations with highlight
      if (type === 'cancel_request') {
        return `/barber/dashboard/reservations?highlight=${reservationId}`;
      }
      return `/barber/dashboard/reservations?highlight=${reservationId}`;
    }
    return '/barber/dashboard/reservations';
  }
  
  // Customer-targeted notifications (default)
  if (reservationId) {
    // For reminder and cancellation (to customer), link to my-appointments with highlight
    if (type === 'cancellation' && cancelledBy === 'barber') {
      return `/my-appointments?highlight=${reservationId}&tab=cancelled`;
    }
    return `/my-appointments?highlight=${reservationId}`;
  }
  
  // Default fallback based on type
  if (type === 'reminder' || type === 'cancellation' || type === 'booking_confirmed') {
    return recipientType === 'barber' ? '/barber/dashboard/reservations' : '/my-appointments';
  }
  
  // Final fallback
  return '/';
}

/**
 * Handle notification click
 * Supports deep linking for all notification types with recipient-type awareness
 */
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.action);
  
  // Close the notification
  event.notification.close();

  const notificationData = event.notification.data || {};
  
  // Log notification data for debugging
  console.log('[SW] Notification data:', JSON.stringify(notificationData));

  // Handle dismiss action - just clear badge and notify clients
  if (event.action === 'dismiss') {
    event.waitUntil(
      Promise.all([
        updateBadge(0),
        notifyClientsNotificationClicked(notificationData)
      ])
    );
    return;
  }

  // Handle rebook action - go to home page to book new appointment
  if (event.action === 'rebook') {
    event.waitUntil(
      Promise.all([
        updateBadge(0),
        openOrFocusWindow('/?action=book'),
        notifyClientsNotificationClicked(notificationData)
      ])
    );
    return;
  }
  
  // Handle reply action (placeholder for future chat feature)
  if (event.action === 'reply') {
    // For now, just navigate to the URL
    const targetUrl = getTargetUrlForNotification(notificationData, event.action);
    event.waitUntil(
      Promise.all([
        updateBadge(0),
        openOrFocusWindow(targetUrl),
        notifyClientsNotificationClicked(notificationData)
      ])
    );
    return;
  }

  // Handle view action or no action (direct click on notification body)
  if (event.action === 'view' || !event.action) {
    const targetUrl = getTargetUrlForNotification(notificationData, event.action);
    console.log('[SW] Navigating to:', targetUrl);
    
    event.waitUntil(
      Promise.all([
        updateBadge(0),
        openOrFocusWindow(targetUrl),
        notifyClientsNotificationClicked(notificationData)
      ])
    );
  }
});

/**
 * Handle notification close (swipe away)
 */
self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification closed');
  // Clear badge when notification is dismissed by swipe
  event.waitUntil(
    Promise.all([
      updateBadge(0),
      notifyClientsNotificationClicked(event.notification.data || {})
    ])
  );
});

/**
 * Notify all clients that a notification was clicked/dismissed
 * This allows the client to mark notifications as read and update UI
 */
async function notifyClientsNotificationClicked(notificationData) {
  const windowClients = await clients.matchAll({
    type: 'window',
    includeUncontrolled: true
  });

  // Post message to all clients
  for (const client of windowClients) {
    client.postMessage({
      type: 'NOTIFICATION_CLICKED',
      data: notificationData
    });
  }
  
  console.log('[SW] Notified clients of notification click');
}

/**
 * Update app badge count (iOS 16.4+, Android)
 */
async function updateBadge(count) {
  if (!('setAppBadge' in navigator)) {
    return;
  }

  try {
    if (count > 0) {
      await navigator.setAppBadge(count);
    } else {
      await navigator.clearAppBadge();
    }
    console.log(`[SW] Badge updated: ${count}`);
  } catch (err) {
    console.log('[SW] Badge API error:', err);
  }
}

/**
 * Open existing window or create new one
 */
async function openOrFocusWindow(urlToOpen) {
  const fullUrl = new URL(urlToOpen, self.location.origin).href;

  // Check if there's already an open window
  const windowClients = await clients.matchAll({
    type: 'window',
    includeUncontrolled: true
  });

  // Try to find an existing window to focus
  for (const client of windowClients) {
    if (client.url.startsWith(self.location.origin) && 'focus' in client) {
      // Navigate the existing window
      await client.navigate(fullUrl);
      return client.focus();
    }
  }

  // No existing window, open a new one
  if (clients.openWindow) {
    return clients.openWindow(fullUrl);
  }
}

/**
 * Handle push subscription change (when subscription expires/changes)
 */
self.addEventListener('pushsubscriptionchange', (event) => {
  console.log('[SW] Push subscription changed');
  
  event.waitUntil(
    // Re-subscribe and update server
    self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: null // Will be set by the subscribe flow
    }).then((subscription) => {
      // Notify the app to update the subscription on the server
      return self.clients.matchAll({ type: 'window' }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'PUSH_SUBSCRIPTION_CHANGED',
            subscription: subscription.toJSON()
          });
        });
      });
    })
  );
});

// =============================================================================

console.log(`[SW] Service Worker loaded - Version ${APP_VERSION}`);

