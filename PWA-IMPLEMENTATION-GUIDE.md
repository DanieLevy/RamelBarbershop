# 🚀 Progressive Web App (PWA) Implementation Guide

## Complete Implementation Reference for Next.js 16+ PWA with Push Notifications

This guide provides production-ready code examples and patterns for building a full-featured PWA with iOS support, push notifications, Hebrew RTL support, and iOS 26-style design patterns.

---

## 📋 Table of Contents

1. [Project Structure](#project-structure)
2. [PWA Configuration](#pwa-configuration)
3. [Push Notifications](#push-notifications)
4. [iOS Design Patterns](#ios-design-patterns)
5. [Hebrew RTL Support](#hebrew-rtl-support)
6. [Native Device Features](#native-device-features)
7. [Service Worker](#service-worker)
8. [Database Schema](#database-schema)

---

## 🗂️ Project Structure

```
project/
├── app/
│   ├── api/
│   │   └── push/
│   │       ├── subscribe/route.ts    # Save push subscription
│   │       ├── send/route.ts         # Trigger push notification
│   │       └── vapid-key/route.ts    # Get public VAPID key
│   ├── globals.css                   # iOS design system + RTL
│   └── layout.tsx                    # Root layout with PWA providers
├── components/
│   ├── pwa-head.tsx                  # PWA meta tags
│   └── ui/
│       └── native-date-picker.tsx    # iOS native date picker
├── hooks/
│   └── use-push-notifications.ts     # Push notification hook
├── lib/
│   └── push-notification-service.ts  # Server-side push service
├── public/
│   ├── manifest.json                 # Web App Manifest
│   ├── sw.js                         # Service Worker
│   └── icons/                        # PWA icons (all sizes)
└── scripts/
    └── generate-vapid-keys.js        # VAPID key generator
```

---

## 📱 PWA Configuration

### manifest.json

```json
{
  "name": "Your App Name - מערכת",
  "short_name": "App Name",
  "description": "App description with Hebrew support",
  "lang": "he",
  "dir": "rtl",
  "scope": "/",
  "id": "/?source=pwa",
  "start_url": "/?source=pwa",
  "display": "standalone",
  "orientation": "portrait",
  "theme_color": "#f8f8fa",
  "background_color": "#ffffff",
  "categories": ["utilities", "lifestyle"],
  "prefer_related_applications": false,
  "display_override": ["window-controls-overlay", "standalone", "minimal-ui"],
  "launch_handler": {
    "client_mode": ["focus-existing", "auto"]
  },
  "handle_links": "preferred",
  "icons": [
    {
      "src": "/icons/icon-72x72.png",
      "sizes": "72x72",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "/icons/icon-96x96.png",
      "sizes": "96x96",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "/icons/icon-128x128.png",
      "sizes": "128x128",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "/icons/icon-144x144.png",
      "sizes": "144x144",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "/icons/icon-152x152.png",
      "sizes": "152x152",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "/icons/icon-384x384.png",
      "sizes": "384x384",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "/icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "/icon.svg",
      "sizes": "any",
      "type": "image/svg+xml",
      "purpose": "any"
    }
  ],
  "shortcuts": [
    {
      "name": "Quick Action",
      "short_name": "Action",
      "description": "Description",
      "url": "/action?source=pwa",
      "icons": [{ "src": "/icons/shortcut.png", "sizes": "96x96" }]
    }
  ]
}
```

### Required Icon Sizes

| Size | Purpose |
|------|---------|
| 72x72 | Android Chrome |
| 96x96 | Android Chrome |
| 128x128 | Chrome Web Store |
| 144x144 | Windows Metro |
| 152x152 | iPad (non-retina) |
| 167x167 | iPad Pro |
| 180x180 | iPhone (retina) |
| 192x192 | Android Chrome / PWA |
| 384x384 | PWA |
| 512x512 | PWA / Splash |

### Apple Touch Icons (Required for iOS)

```tsx
// components/pwa-head.tsx
export function PWAHead() {
  return (
    <>
      {/* PWA Meta Tags */}
      <meta name="mobile-web-app-capable" content="yes" />
      <meta name="apple-touch-fullscreen" content="yes" />
      <meta name="apple-mobile-web-app-title" content="App Name" />
      <meta name="application-name" content="App Name" />
      <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      
      {/* Standard Apple Touch Icons */}
      <link rel="apple-touch-icon" href="/icons/touch-icon-iphone-retina.png" />
      <link rel="apple-touch-icon" sizes="120x120" href="/icons/touch-icon-iphone.png" />
      <link rel="apple-touch-icon" sizes="152x152" href="/icons/touch-icon-ipad.png" />
      <link rel="apple-touch-icon" sizes="167x167" href="/icons/touch-icon-ipad-retina.png" />
      <link rel="apple-touch-icon" sizes="180x180" href="/icons/touch-icon-iphone-retina.png" />
      
      {/* Precomposed versions for older iOS */}
      <link rel="apple-touch-icon-precomposed" sizes="180x180" href="/icons/touch-icon-iphone-retina.png" />
      
      {/* iOS Splash Screens */}
      <link
        rel="apple-touch-startup-image"
        href="/icons/apple-splash-1125-2436.png"
        media="(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3)"
      />
      
      {/* PWA Standard Meta Tags */}
      <link rel="manifest" href="/manifest.json" />
      <meta name="msapplication-TileColor" content="#6366f1" />
    </>
  )
}
```

### Root Layout Configuration

```tsx
// app/layout.tsx
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "App Name",
  description: "App description",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "App Name",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' }
    ],
    apple: [
      { url: '/icons/touch-icon-iphone-retina.png', sizes: '180x180', type: 'image/png' }
    ]
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};
```

---

## 🔔 Push Notifications

### Prerequisites

1. **HTTPS Required** - Push notifications require HTTPS (localhost works for development)
2. **Service Worker** - Must be registered before subscribing
3. **User Permission** - Must request Notification permission
4. **VAPID Keys** - Required for web push authentication

### Step 1: Generate VAPID Keys

```javascript
// scripts/generate-vapid-keys.js
const webpush = require('web-push');
const fs = require('fs');

const vapidKeys = webpush.generateVAPIDKeys();

console.log('Add to .env.local:');
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`);
console.log(`VAPID_EMAIL=mailto:your@email.com`);

// Validate P-256 key format (iOS requirement)
const publicKeyBytes = Buffer.from(vapidKeys.publicKey, 'base64url');
if (publicKeyBytes.length === 65) {
  console.log('✅ Public key is valid P-256 format (65 bytes)');
}
```

Run: `node scripts/generate-vapid-keys.js`

### Step 2: Environment Variables

```env
# .env.local
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BNxH...your-public-key
VAPID_PRIVATE_KEY=abc123...your-private-key
VAPID_EMAIL=mailto:admin@yourdomain.com
```

### Step 3: Push Notification Service (Server)

```typescript
// lib/push-notification-service.ts
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';
const vapidEmail = process.env.VAPID_EMAIL || 'mailto:admin@example.com';

// Initialize web-push
if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey);
}

// Error codes that indicate subscription is invalid
const PERMANENT_ERROR_CODES = [410, 404, 401];

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  image?: string;
  url?: string;
  tag?: string;
  requireInteraction?: boolean;
  actions?: Array<{ action: string; title: string; icon?: string }>;
  data?: Record<string, unknown>;
  badgeCount?: number;
}

class PushNotificationService {
  async sendNotification(
    payload: PushPayload,
    targetUserIds?: string[]
  ): Promise<{ success: boolean; sent: number; failed: number; errors: string[] }> {
    const errors: string[] = [];
    let sent = 0;
    let failed = 0;

    // Get active subscriptions
    let query = supabase
      .from('push_subscriptions')
      .select('*')
      .eq('is_active', true);

    if (targetUserIds?.length) {
      query = query.in('user_id', targetUserIds);
    }

    const { data: subscriptions } = await query;

    if (!subscriptions?.length) {
      return { success: false, sent: 0, failed: 0, errors: ['No active subscriptions'] };
    }

    // Build notification payload
    const notificationPayload = JSON.stringify({
      notification: {
        title: payload.title,
        body: payload.body,
        icon: payload.icon || '/icons/icon-192x192.png',
        badge: payload.badge || '/icons/icon-72x72.png',
        image: payload.image,
        tag: payload.tag || 'notification',
        requireInteraction: payload.requireInteraction !== false,
        actions: payload.actions || [
          { action: 'view', title: 'View' },
          { action: 'dismiss', title: 'Dismiss' }
        ],
        data: {
          ...payload.data,
          url: payload.url || '/',
          timestamp: Date.now()
        }
      },
      badgeCount: payload.badgeCount ?? 1
    });

    // Send to each subscription
    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth }
          },
          notificationPayload
        );
        sent++;
        
        // Reset failure count on success
        await supabase
          .from('push_subscriptions')
          .update({ consecutive_failures: 0, last_delivery_status: 'success' })
          .eq('id', sub.id);
          
      } catch (error: any) {
        failed++;
        errors.push(`Failed: ${error.message}`);
        
        // Deactivate subscription if permanent error
        if (PERMANENT_ERROR_CODES.includes(error.statusCode)) {
          await supabase
            .from('push_subscriptions')
            .update({ is_active: false, last_delivery_status: 'failed' })
            .eq('id', sub.id);
        }
      }
    }

    return { success: sent > 0, sent, failed, errors };
  }

  async sendToUser(userId: string, payload: PushPayload) {
    return this.sendNotification(payload, [userId]);
  }

  getPublicKey(): string {
    return vapidPublicKey.trim().replace(/[\r\n\s]/g, '');
  }

  async savePushSubscription(data: {
    userId: string;
    username: string;
    email: string;
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } };
    deviceType: 'ios' | 'android' | 'desktop';
    userAgent: string;
  }) {
    const { data: existing } = await supabase
      .from('push_subscriptions')
      .select('id')
      .eq('endpoint', data.subscription.endpoint)
      .single();

    if (existing) {
      await supabase
        .from('push_subscriptions')
        .update({
          user_id: data.userId,
          username: data.username,
          email: data.email,
          p256dh: data.subscription.keys.p256dh,
          auth: data.subscription.keys.auth,
          device_type: data.deviceType,
          user_agent: data.userAgent,
          is_active: true,
          last_used: new Date().toISOString(),
        })
        .eq('endpoint', data.subscription.endpoint);
      return { subscriptionId: existing.id };
    }

    const { data: newSub } = await supabase
      .from('push_subscriptions')
      .insert({
        user_id: data.userId,
        username: data.username,
        email: data.email,
        endpoint: data.subscription.endpoint,
        p256dh: data.subscription.keys.p256dh,
        auth: data.subscription.keys.auth,
        device_type: data.deviceType,
        user_agent: data.userAgent,
        is_active: true,
      })
      .select('id')
      .single();

    return { subscriptionId: newSub?.id };
  }
}

export const pushService = new PushNotificationService();
```

### Step 4: API Routes

```typescript
// app/api/push/vapid-key/route.ts
import { NextResponse } from 'next/server';
import { pushService } from '@/lib/push-notification-service';

export async function GET() {
  const publicKey = pushService.getPublicKey();
  
  if (!publicKey) {
    return NextResponse.json({ error: 'VAPID keys not configured' }, { status: 500 });
  }
  
  return NextResponse.json({ success: true, publicKey });
}
```

```typescript
// app/api/push/subscribe/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { pushService } from '@/lib/push-notification-service';
import { getCurrentUser } from '@/lib/auth/jwt';

export async function POST(request: NextRequest) {
  // Require authentication
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { subscription } = await request.json();

  if (!subscription?.endpoint) {
    return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });
  }

  // Detect device type
  const userAgent = request.headers.get('user-agent') || '';
  const isIOS = /iPhone|iPad|iPod/i.test(userAgent);
  const isAndroid = /android/i.test(userAgent);
  const deviceType = isIOS ? 'ios' : isAndroid ? 'android' : 'desktop';

  await pushService.savePushSubscription({
    userId: user.userId,
    username: user.email,
    email: user.email,
    subscription,
    deviceType,
    userAgent
  });

  return NextResponse.json({ success: true, deviceType });
}
```

```typescript
// app/api/push/send/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { pushService } from '@/lib/push-notification-service';

export async function POST(request: NextRequest) {
  const { title, body, url, targetUserIds, ...options } = await request.json();

  if (!title || !body) {
    return NextResponse.json({ error: 'Title and body required' }, { status: 400 });
  }

  const result = await pushService.sendNotification(
    { title, body, url, ...options },
    targetUserIds
  );

  return NextResponse.json(result);
}
```

### Step 5: Client-Side Hook

```typescript
// hooks/use-push-notifications.ts
'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

interface PushManagerState {
  isSupported: boolean;
  permission: NotificationPermission;
  isSubscribed: boolean;
  isLoading: boolean;
  error: string | null;
  badgeCount: number;
}

// Convert VAPID key for iOS compatibility
const urlBase64ToUint8Array = (base64String: string): Uint8Array => {
  base64String = base64String.trim();
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

// Badge API (iOS 16.4+)
export const setAppBadge = async (count: number): Promise<boolean> => {
  if (!('setAppBadge' in navigator)) return false;
  try {
    if (count > 0) {
      await (navigator as any).setAppBadge(count);
    } else {
      await (navigator as any).clearAppBadge();
    }
    return true;
  } catch {
    return false;
  }
};

export const usePushNotifications = () => {
  const [state, setState] = useState<PushManagerState>({
    isSupported: false,
    permission: 'default',
    isSubscribed: false,
    isLoading: true,
    error: null,
    badgeCount: 0
  });

  useEffect(() => {
    const checkSupport = async () => {
      const isSupported = 
        'serviceWorker' in navigator &&
        'PushManager' in window &&
        'Notification' in window;

      if (!isSupported) {
        setState(prev => ({ ...prev, isSupported: false, isLoading: false }));
        return;
      }

      const permission = Notification.permission;
      let isSubscribed = false;

      if (permission === 'granted') {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        isSubscribed = !!subscription;
      }

      setState(prev => ({
        ...prev,
        isSupported: true,
        permission,
        isSubscribed,
        isLoading: false
      }));
    };

    checkSupport();
  }, []);

  const subscribe = useCallback(async () => {
    if (state.isLoading || state.isSubscribed) return;
    
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      // Request permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        toast.error('Notification permission denied');
        setState(prev => ({ ...prev, isLoading: false, permission }));
        return;
      }

      // Get service worker
      const registration = await navigator.serviceWorker.ready;

      // Get VAPID key
      const vapidResponse = await fetch('/api/push/vapid-key');
      const { publicKey } = await vapidResponse.json();
      const applicationServerKey = urlBase64ToUint8Array(publicKey);

      // Subscribe
      const pushSubscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey
      });

      // Save to server
      const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ subscription: pushSubscription.toJSON() })
      });

      if (!response.ok) throw new Error('Failed to save subscription');

      setState(prev => ({ ...prev, isSubscribed: true, isLoading: false, permission: 'granted' }));
      toast.success('🔔 Push notifications enabled!');
    } catch (error) {
      setState(prev => ({ ...prev, isLoading: false }));
      toast.error('Failed to enable notifications');
    }
  }, [state.isLoading, state.isSubscribed]);

  const unsubscribe = useCallback(async () => {
    if (state.isLoading || !state.isSubscribed) return;
    
    setState(prev => ({ ...prev, isLoading: true }));
    
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        await subscription.unsubscribe();
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint })
        });
      }
      
      setState(prev => ({ ...prev, isSubscribed: false, isLoading: false }));
      toast.success('Notifications disabled');
    } catch {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [state.isLoading, state.isSubscribed]);

  const setBadge = useCallback(async (count: number) => {
    const success = await setAppBadge(count);
    if (success) setState(prev => ({ ...prev, badgeCount: count }));
    return success;
  }, []);

  return {
    ...state,
    subscribe,
    unsubscribe,
    setBadge,
    isBadgeSupported: 'setAppBadge' in navigator
  };
};
```

### Step 6: Service Worker Push Handler

```javascript
// public/sw.js

// Push notification received
self.addEventListener('push', (event) => {
  let notificationData = {
    title: 'App Name',
    body: 'New notification',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    data: { url: '/' },
    badgeCount: 1
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      if (payload.notification) {
        notificationData = { ...notificationData, ...payload.notification };
      }
      if (payload.badgeCount !== undefined) {
        notificationData.badgeCount = payload.badgeCount;
      }
    } catch (err) {
      notificationData.body = event.data.text();
    }
  }

  const options = {
    body: notificationData.body,
    icon: notificationData.icon,
    badge: notificationData.badge,
    image: notificationData.image,
    vibrate: [200, 100, 200],
    tag: notificationData.tag || 'notification',
    requireInteraction: notificationData.requireInteraction !== false,
    actions: notificationData.actions || [
      { action: 'view', title: 'View' },
      { action: 'dismiss', title: 'Dismiss' }
    ],
    data: notificationData.data || { url: '/' },
    dir: 'rtl', // For Hebrew
    lang: 'he'
  };

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(notificationData.title, options),
      updateBadge(notificationData.badgeCount)
    ])
  );
});

// Badge API helper
async function updateBadge(count) {
  if ('setAppBadge' in navigator) {
    try {
      if (count > 0) {
        await navigator.setAppBadge(count);
      } else {
        await navigator.clearAppBadge();
      }
    } catch (err) {}
  }
}

// Notification click handling
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const notificationData = event.notification.data || {};
  let targetUrl = notificationData.url || '/';
  
  if (event.action === 'dismiss') {
    return;
  }
  
  event.waitUntil(
    Promise.all([
      updateBadge(0),
      openOrFocusWindow(targetUrl)
    ])
  );
});

async function openOrFocusWindow(urlToOpen) {
  const windowClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
  
  for (const client of windowClients) {
    if (client.url.includes(self.location.origin) && 'focus' in client) {
      await client.navigate(urlToOpen);
      return client.focus();
    }
  }
  
  if (clients.openWindow) {
    return clients.openWindow(urlToOpen);
  }
}
```

### Triggering Push Notifications

**From API Route:**

```typescript
import { pushService } from '@/lib/push-notification-service';

// Send to specific user
await pushService.sendToUser(userId, {
  title: '🔔 New Notification',
  body: 'You have a new message',
  url: '/notifications',
  badgeCount: 1
});

// Send to all users
await pushService.sendNotification({
  title: 'System Update',
  body: 'New features available!',
  url: '/'
});
```

**From Scheduled Function (Netlify):**

```javascript
// netlify/functions/scheduled-push.mjs
import webpush from 'web-push';

export const handler = async (event) => {
  // Initialize web-push
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );

  // Send notifications...
};

export const config = {
  schedule: "*/5 * * * *" // Every 5 minutes
};
```

### Push Notification Limitations

| Platform | Limitations |
|----------|-------------|
| **iOS Safari** | Requires PWA installed to home screen (Add to Home Screen), iOS 16.4+ |
| **iOS PWA** | No background sync, notifications only when app is installed |
| **Android** | Full support, works in browser and PWA |
| **Desktop Chrome** | Full support |
| **Desktop Safari** | macOS Ventura+, limited support |
| **Firefox** | Full support |

**iOS-Specific Requirements:**
1. Must be installed as PWA (Add to Home Screen)
2. User must grant notification permission
3. P-256 curve VAPID keys required
4. `userVisibleOnly: true` is mandatory
5. No silent push notifications

---

## 🎨 iOS Design Patterns

### Liquid Glass Design System (iOS 26 Style)

```css
/* app/globals.css */

:root {
  /* iOS 26 Liquid Glass Variables */
  --glass-blur: 20px;
  --glass-blur-subtle: 12px;
  --glass-blur-strong: 28px;
  --glass-blur-intense: 36px;
  --glass-bg: rgba(255, 255, 255, 0.72);
  --glass-bg-subtle: rgba(255, 255, 255, 0.5);
  --glass-bg-strong: rgba(255, 255, 255, 0.85);
  --glass-border: rgba(255, 255, 255, 0.35);
  --glass-border-subtle: rgba(255, 255, 255, 0.2);
  --glass-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
  --glass-shadow-elevated: 0 16px 48px rgba(0, 0, 0, 0.12);
  
  /* iOS Larger Border Radii */
  --glass-radius-sm: 12px;
  --glass-radius-md: 16px;
  --glass-radius-lg: 20px;
  --glass-radius-xl: 24px;
  --glass-radius-2xl: 28px;
  --glass-radius-3xl: 32px;
  
  /* iOS Animation Timing */
  --glass-transition: 200ms cubic-bezier(0.4, 0, 0.2, 1);
  --glass-transition-spring: 400ms cubic-bezier(0.34, 1.56, 0.64, 1);
}

.dark {
  --glass-bg: rgba(28, 28, 30, 0.72);
  --glass-bg-subtle: rgba(28, 28, 30, 0.5);
  --glass-bg-strong: rgba(28, 28, 30, 0.88);
  --glass-border: rgba(255, 255, 255, 0.12);
  --glass-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
}

/* Glass Card Component */
.glass-card {
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur)) saturate(180%);
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(180%);
  border: 1px solid var(--glass-border);
  border-radius: var(--glass-radius-2xl);
  box-shadow: var(--glass-shadow);
}

/* Glass Elevated (for floating elements) */
.glass-elevated {
  background: var(--glass-bg-strong);
  backdrop-filter: blur(var(--glass-blur-strong)) saturate(200%);
  -webkit-backdrop-filter: blur(var(--glass-blur-strong)) saturate(200%);
  border: 1px solid var(--glass-border);
  border-radius: var(--glass-radius-2xl);
  box-shadow: var(--glass-shadow-elevated);
}
```

### iOS Safe Areas

```css
/* Safe Area CSS Variables */
:root {
  --safe-area-inset-top: 0px;
  --safe-area-inset-right: 0px;
  --safe-area-inset-bottom: 0px;
  --safe-area-inset-left: 0px;
}

/* iOS 11.0 - 11.2 */
@supports (padding-top: constant(safe-area-inset-top)) {
  :root {
    --safe-area-inset-top: constant(safe-area-inset-top);
    --safe-area-inset-right: constant(safe-area-inset-right);
    --safe-area-inset-bottom: constant(safe-area-inset-bottom);
    --safe-area-inset-left: constant(safe-area-inset-left);
  }
}

/* iOS 11.2+ */
@supports (padding-top: env(safe-area-inset-top)) {
  :root {
    --safe-area-inset-top: env(safe-area-inset-top);
    --safe-area-inset-right: env(safe-area-inset-right);
    --safe-area-inset-bottom: env(safe-area-inset-bottom);
    --safe-area-inset-left: env(safe-area-inset-left);
  }
}

/* Apply to bottom navigation */
.bottom-nav {
  padding-bottom: max(env(safe-area-inset-bottom, 0px), 12px);
}

/* Main content with bottom nav */
@media (display-mode: standalone) {
  main {
    padding-bottom: calc(5.5rem + var(--safe-area-inset-bottom, 0));
  }
}
```

### Haptic Feedback Hook

```typescript
// hooks/use-haptics.ts
import { useCallback } from 'react';

type HapticPattern = VibratePattern;

const PATTERNS: Record<string, HapticPattern> = {
  light: 10,
  medium: 20,
  heavy: 30,
  success: [10, 50, 10],
  error: [50, 100, 50],
  warning: [30, 50, 30],
  selection: 8,
  impact: 15,
  notification: [15, 100, 15, 100, 30],
};

export const useHaptics = () => {
  const isSupported = typeof navigator !== 'undefined' && 'vibrate' in navigator;

  const vibrate = useCallback((pattern: HapticPattern): void => {
    if (!isSupported) return;
    try {
      navigator.vibrate(pattern);
    } catch {}
  }, [isSupported]);

  return {
    light: useCallback(() => vibrate(PATTERNS.light), [vibrate]),
    medium: useCallback(() => vibrate(PATTERNS.medium), [vibrate]),
    heavy: useCallback(() => vibrate(PATTERNS.heavy), [vibrate]),
    success: useCallback(() => vibrate(PATTERNS.success), [vibrate]),
    error: useCallback(() => vibrate(PATTERNS.error), [vibrate]),
    warning: useCallback(() => vibrate(PATTERNS.warning), [vibrate]),
    selection: useCallback(() => vibrate(PATTERNS.selection), [vibrate]),
    impact: useCallback(() => vibrate(PATTERNS.impact), [vibrate]),
    notification: useCallback(() => vibrate(PATTERNS.notification), [vibrate]),
    custom: (pattern: HapticPattern) => vibrate(pattern),
    isSupported,
  };
};
```

---

## 🔤 Hebrew RTL Support

### HTML Setup

```tsx
// app/layout.tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" suppressHydrationWarning>
      {/* ... */}
    </html>
  );
}
```

### CSS RTL Support

```css
/* RTL Base Styles */
[dir="rtl"] {
  direction: rtl;
  text-align: right;
}

/* Ensure proper font rendering for Hebrew */
html {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* Hebrew Font with Fallback */
@font-face {
  font-family: 'Ploni';
  src: url('/fonts/ploni-regular-aaa.otf') format('opentype');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
  ascent-override: 90%;
  descent-override: 10%;
}

body {
  font-family: 'Ploni', system-ui, -apple-system, sans-serif;
}

/* Optimize font rendering for Hebrew */
@supports (font-synthesis: none) {
  body {
    font-synthesis: none;
    text-rendering: optimizeLegibility;
  }
}
```

---

## 📱 Native Device Features

### iOS Native Date Picker

```tsx
// components/ui/native-date-picker.tsx
"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Calendar } from "lucide-react"
import { format } from "date-fns"
import { he } from "date-fns/locale"

interface NativeDatePickerProps {
  value?: Date
  onChange?: (date: Date | undefined) => void
  minDate?: Date
  maxDate?: Date
  placeholder?: string
  disabled?: boolean
  className?: string
}

// Format date for native input (YYYY-MM-DD)
const formatForInput = (date: Date | undefined): string => {
  if (!date) return ''
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

// Parse date from native input
const parseFromInput = (value: string): Date | undefined => {
  if (!value) return undefined
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export const NativeDatePicker = React.forwardRef<HTMLInputElement, NativeDatePickerProps>(
  ({ value, onChange, minDate, maxDate, placeholder = "Select date", disabled, className }, ref) => {
    const inputRef = React.useRef<HTMLInputElement>(null)
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange?.(parseFromInput(e.target.value))
    }
    
    const handleContainerClick = () => {
      inputRef.current?.showPicker?.()
      inputRef.current?.focus()
    }

    const displayValue = value ? format(value, "dd/MM/yyyy", { locale: he }) : placeholder

    return (
      <div className={cn("relative group", className)}>
        {/* Styled visible container */}
        <div
          onClick={handleContainerClick}
          className={cn(
            "flex items-center gap-2 h-11 w-full rounded-xl border bg-background/50 backdrop-blur-sm px-4",
            "cursor-pointer touch-manipulation transition-all duration-200",
            "hover:border-primary/50 focus-within:ring-2 focus-within:ring-primary/50",
            disabled && "pointer-events-none opacity-50"
          )}
        >
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className={cn("text-base", !value && "text-muted-foreground")}>
            {displayValue}
          </span>
        </div>
        
        {/* Hidden native input - triggers iOS date wheel */}
        <input
          ref={inputRef}
          type="date"
          value={formatForInput(value)}
          onChange={handleChange}
          min={minDate ? formatForInput(minDate) : undefined}
          max={maxDate ? formatForInput(maxDate) : undefined}
          disabled={disabled}
          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
          style={{ WebkitAppearance: 'none', colorScheme: 'light dark' }}
        />
      </div>
    )
  }
)
```

### Prevent iOS Input Zoom

```css
/* Prevent iOS zoom on input focus */
input[type="text"],
input[type="email"],
input[type="password"],
input[type="tel"],
input[type="number"],
textarea {
  font-size: 16px !important;
}
```

### Touch Optimization

```css
/* Prevent tap highlight and enable touch manipulation */
button, [role="button"] {
  -webkit-user-select: none;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}

.touch-manipulation {
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

/* Prevent iOS bounce */
@media screen and (display-mode: standalone) {
  body {
    overscroll-behavior: none;
    -webkit-overflow-scrolling: touch;
  }
}
```

---

## 🔧 Service Worker

### Complete Service Worker Template

```javascript
// public/sw.js
const VERSION = 'v1.0';
const CACHE_NAME = `app-${VERSION}`;
const STATIC_ASSETS = ['/offline', '/manifest.json', '/icon.svg'];

// Install
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
});

// Activate
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) => 
        Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
      ),
      self.registration.navigationPreload?.enable(),
      self.clients.claim()
    ])
  );
});

// Fetch
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;
  if (url.pathname.startsWith('/api/')) return;

  event.respondWith(
    fetch(request, { credentials: 'include' })
      .then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request).then(cached => cached || caches.match('/offline')))
  );
});

// Push
self.addEventListener('push', (event) => {
  let data = { title: 'Notification', body: 'New message' };
  if (event.data) {
    try {
      const payload = event.data.json();
      data = { ...data, ...payload.notification };
    } catch {}
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      dir: 'rtl',
      lang: 'he',
      data: data.data || { url: '/' }
    })
  );
});

// Notification Click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(clients.openWindow(url));
});
```

---

## 🗄️ Database Schema

### Push Subscriptions Table (Supabase/PostgreSQL)

```sql
CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  email TEXT,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  device_type TEXT DEFAULT 'desktop' CHECK (device_type IN ('ios', 'android', 'desktop')),
  user_agent TEXT,
  is_active BOOLEAN DEFAULT true,
  consecutive_failures INTEGER DEFAULT 0,
  last_delivery_status TEXT CHECK (last_delivery_status IN ('success', 'failed', 'pending')),
  last_failure_reason TEXT,
  last_used TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_push_subscriptions_user ON push_subscriptions(user_id);
CREATE INDEX idx_push_subscriptions_active ON push_subscriptions(is_active) WHERE is_active = true;
CREATE INDEX idx_push_subscriptions_endpoint ON push_subscriptions(endpoint);

-- RLS Policy
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own subscriptions"
  ON push_subscriptions
  FOR ALL
  USING (auth.uid() = user_id);
```

---

## 📦 Dependencies

```json
{
  "dependencies": {
    "next": "^16.0.0",
    "react": "^19.0.0",
    "web-push": "^3.6.7",
    "@supabase/supabase-js": "^2.86.0",
    "date-fns": "^4.1.0",
    "framer-motion": "^12.0.0",
    "sonner": "^2.0.0",
    "tailwind-merge": "^3.0.0"
  }
}
```

---

## ✅ Checklist for New Project

- [ ] Generate VAPID keys and add to `.env.local`
- [ ] Create all PWA icon sizes (72 to 512px)
- [ ] Configure `manifest.json` with RTL support
- [ ] Add `PWAHead` component to layout
- [ ] Create and register service worker
- [ ] Implement push notification API routes
- [ ] Set up Supabase push_subscriptions table
- [ ] Add `usePushNotifications` hook
- [ ] Configure iOS safe areas in CSS
- [ ] Add Hebrew fonts with proper loading strategy
- [ ] Test on iOS (must install as PWA for push)
- [ ] Test on Android Chrome
- [ ] Test on Desktop browsers

---

*Last Updated: December 2024*
*Compatible with: Next.js 16+, React 19+, iOS 16.4+, Chrome, Firefox, Safari*

