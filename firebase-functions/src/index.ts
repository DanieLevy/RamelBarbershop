/**
 * Firebase Cloud Functions — Ramel Barbershop
 *
 * Replaces the Netlify scheduled function for appointment reminders.
 * All processing runs directly inside this function — no HTTP hop to Netlify.
 *
 * Schedule: every 30 minutes, 07:00–22:00 Israel time (05:00–19:00 UTC covers both
 * UTC+2 winter and UTC+3 summer).
 *
 * MIGRATION STRATEGY:
 *   1. Deploy with DRY_RUN=true  → only whitelisted test users get real notifications.
 *      Netlify cron continues to handle everyone else. Monitor Firebase logs for 24-48h.
 *   2. Set DRY_RUN=false         → Firebase takes over ALL processing.
 *   3. After 48h stability       → delete netlify/functions/send-reminders.ts and redeploy.
 *
 * Required env vars (set via Firebase CLI: firebase functions:secrets:set <KEY>):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   O19_SMS_API_TOKEN
 *   O19_SMS_USERNAME
 *   VAPID_PUBLIC_KEY
 *   VAPID_PRIVATE_KEY
 *   FIREBASE_PROJECT_ID            (also needed for firebase-admin in push-service on Netlify)
 *   DRY_RUN                        ('true' or 'false')
 *   DRY_RUN_WHITELIST_CUSTOMER_ID
 *   DRY_RUN_WHITELIST_BARBER_ID
 *
 * Deploy:
 *   cd firebase-functions && npm install && npm run build
 *   firebase deploy --only functions
 */

import { onSchedule } from 'firebase-functions/v2/scheduler'
import * as logger from 'firebase-functions/logger'
import { processReminders } from './send-reminders'

export const sendReminders = onSchedule(
  {
    // Every 30 min, 05:00–19:00 UTC = 07:00–22:00 Israel (covers UTC+2 winter & UTC+3 summer)
    schedule: '0,30 5-19 * * *',
    timeZone: 'Asia/Jerusalem',
    region: 'europe-west1',
    memory: '512MiB',
    timeoutSeconds: 540, // 9 minutes — sufficient for any batch size
  },
  async () => {
    logger.info('[Firebase Cron] Starting reminder job', { time: new Date().toISOString() })
    const startTime = Date.now()

    try {
      const results = await processReminders()

      logger.info('[Firebase Cron] Completed', {
        durationMs: Date.now() - startTime,
        results,
      })
    } catch (err) {
      logger.error('[Firebase Cron] Fatal error in processReminders', {
        error: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - startTime,
      })
    }
  }
)
