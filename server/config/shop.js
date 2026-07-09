/**
 * Aggregates everything the client needs from GET /api/config:
 *  - all editable content from site-content.js (the file to edit)
 *  - live SMS configuration status, so the UI can honestly show
 *    whether text notifications are actually going out
 *  - the public VAPID key for Web Push subscription
 */
const siteContent = require('./site-content');
const twilioConfig = require('./twilio');
const pushConfig = require('./push');

module.exports = {
  ...siteContent,
  smsEnabled: twilioConfig.enabled,
  vapidPublicKey: pushConfig.vapidPublicKey,
};
