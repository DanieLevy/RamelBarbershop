/**
 * VAPID Key Generator for Push Notifications
 * 
 * Run this script once to generate VAPID keys for web push:
 * node scripts/generate-vapid-keys.js
 * 
 * Then add the output to your .env.local file
 */

import webpush from 'web-push';

const vapidKeys = webpush.generateVAPIDKeys();

console.log('\n🔐 VAPID Keys Generated Successfully!\n');
console.log('Add these to your .env.local file:\n');
console.log('═══════════════════════════════════════════════════════════════\n');
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`);
console.log(`VAPID_EMAIL=mailto:admin@ramel-barbershop.co.il`);
console.log('\n═══════════════════════════════════════════════════════════════\n');

// Validate P-256 key format (iOS requirement)
const publicKeyBytes = Buffer.from(vapidKeys.publicKey, 'base64url');
if (publicKeyBytes.length === 65) {
  console.log('✅ Public key is valid P-256 format (65 bytes) - iOS compatible\n');
} else {
  console.log('⚠️  Warning: Public key length is', publicKeyBytes.length, 'bytes\n');
}

