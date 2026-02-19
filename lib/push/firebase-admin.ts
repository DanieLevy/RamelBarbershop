/**
 * Firebase Admin SDK — singleton initializer
 *
 * Reads credentials from Netlify environment variables:
 *   FIREBASE_PROJECT_ID
 *   FIREBASE_CLIENT_EMAIL
 *   FIREBASE_PRIVATE_KEY  (paste raw RSA key including -----BEGIN...END-----)
 *
 * Only initializes if all three are present — safe to import even in dev
 * without Firebase credentials (FCM path will simply be skipped).
 *
 * FCM messaging is lazy-initialized via getFCMMessaging() to avoid calling
 * admin.messaging() at module load, which would throw during builds when
 * Firebase env vars are not available.
 */

import * as admin from 'firebase-admin'

export const isFCMConfigured = (): boolean =>
  Boolean(
    process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_CLIENT_EMAIL &&
      process.env.FIREBASE_PRIVATE_KEY
  )

const ensureInitialized = (): void => {
  if (isFCMConfigured() && !admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID!,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
        // Netlify stores multi-line env vars with literal \n — replace them
        privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
      }),
    })
  }
}

let _messaging: admin.messaging.Messaging | null = null

export const getFCMMessaging = (): admin.messaging.Messaging => {
  if (!_messaging) {
    ensureInitialized()
    _messaging = admin.messaging()
  }
  return _messaging
}
