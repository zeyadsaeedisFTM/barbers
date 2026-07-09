/**
 * Web Push configuration.
 *
 * On first start, if VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY are not set in
 * server/.env, this module auto-generates a VAPID key pair and logs it with
 * copy-paste instructions.  The keys are used for the lifetime of that
 * process, but you MUST persist them in .env for production so that existing
 * subscriptions keep working across restarts.
 */

const webpush = require('web-push');

let vapidPublicKey = process.env.VAPID_PUBLIC_KEY || '';
let vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';
let configured = false;

if (vapidPublicKey && vapidPrivateKey) {
  try {
    webpush.setVapidDetails(
      'mailto:admin@example.com',
      vapidPublicKey,
      vapidPrivateKey
    );
    configured = true;
    console.log('[WebPush] VAPID keys loaded from .env — push notifications are ENABLED.');
  } catch (err) {
    console.error('[WebPush] Failed to set VAPID details:', err.message);
  }
} else {
  // Auto-generate so the feature works out-of-the-box during development.
  const keys = webpush.generateVAPIDKeys();
  vapidPublicKey = keys.publicKey;
  vapidPrivateKey = keys.privateKey;
  try {
    webpush.setVapidDetails('mailto:admin@example.com', vapidPublicKey, vapidPrivateKey);
    configured = true;
  } catch (err) {
    console.error('[WebPush] Failed to set auto-generated VAPID details:', err.message);
  }
  console.warn(
    '[WebPush] No VAPID keys found in .env — auto-generated a temporary pair.\n' +
    '          Push notifications will work this session, but subscriptions will\n' +
    '          break on restart unless you persist these keys.\n' +
    '          Add the following to server/.env:\n\n' +
    `VAPID_PUBLIC_KEY=${vapidPublicKey}\n` +
    `VAPID_PRIVATE_KEY=${vapidPrivateKey}\n`
  );
}

/**
 * Send a push notification to a single subscription object.
 * Returns { sent: true } on success or { sent: false, reason } on failure.
 */
async function sendPushNotification(subscription, title, body, extra = {}) {
  if (!configured || !subscription) {
    return { sent: false, reason: 'web_push_not_configured_or_no_subscription' };
  }
  try {
    const payload = JSON.stringify({ title, body, ...extra });
    await webpush.sendNotification(subscription, payload);
    return { sent: true };
  } catch (err) {
    // 410 Gone means the subscription expired — safe to ignore
    if (err.statusCode === 410) {
      console.warn('[WebPush] Subscription expired (410 Gone) — ignoring.');
    } else {
      console.error('[WebPush] Failed to send push:', err.message);
    }
    return { sent: false, reason: err.message };
  }
}

function isWebPushConfigured() {
  return configured;
}

module.exports = {
  vapidPublicKey,
  isWebPushConfigured,
  sendPushNotification,
};
