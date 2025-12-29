// Service Worker for Ramel Barbershop PWA
// Version is updated automatically during build
const APP_VERSION = '2.0.0-2025.12.29.1320';
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
    title: 'רמאל ברברשופ',
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
 * Handle notification click
 * Supports deep linking for reminders and cancellations
 */
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.action);
  
  // Close the notification
  event.notification.close();

  const notificationData = event.notification.data || {};
  let targetUrl = notificationData.url || '/';

  // Handle different actions
  if (event.action === 'dismiss') {
    // User dismissed, just clear badge
    event.waitUntil(updateBadge(0));
    return;
  }

  // Handle rebook action - go to home page to book new appointment
  if (event.action === 'rebook') {
    event.waitUntil(
      Promise.all([
        updateBadge(0),
        openOrFocusWindow('/')
      ])
    );
    return;
  }

  // For reminder notifications, ensure we use the deep link URL
  if (notificationData.type === 'reminder' && notificationData.reservationId) {
    targetUrl = `/my-appointments?highlight=${notificationData.reservationId}`;
  }
  
  // For cancellation notifications to customer, use deep link
  if (notificationData.type === 'cancellation' && notificationData.cancelledBy === 'barber' && notificationData.reservationId) {
    targetUrl = `/my-appointments?highlight=${notificationData.reservationId}`;
  }

  if (event.action === 'view' || !event.action) {
    // Navigate to the target URL
    event.waitUntil(
      Promise.all([
        updateBadge(0),
        openOrFocusWindow(targetUrl)
      ])
    );
  }
});

/**
 * Handle notification close (swipe away)
 */
self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification closed');
  // Optionally track closed notifications
});

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

