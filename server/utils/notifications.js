const twilioConfig = require('../config/twilio');
const shopConfig = require('../config/shop');
const { sendPushNotification } = require('../config/push');

let twilioClient = null;
if (twilioConfig.enabled) {
  try {
    const twilio = require('twilio');
    twilioClient = twilio(twilioConfig.accountSid, twilioConfig.authToken);
  } catch (err) {
    console.error('[SMS] Failed to initialize Twilio client:', err.message);
    twilioClient = null;
  }
} else {
  console.warn(
    '[SMS] Twilio is not configured — SMS notifications are DISABLED. ' +
    'Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER in server/.env to enable them. ' +
    'The site will still notify customers in-app (toast + sound + browser notification).'
  );
}

/** Whether SMS is actually able to send right now. Exposed to the client via /api/config. */
function isSmsConfigured() {
  return !!twilioClient;
}

async function sendSms(to, body) {
  console.log(`[SMS] To: ${to} | Body: ${body}`);

  if (!twilioClient) {
    console.warn(`[SMS] Not sent — Twilio is not configured. (Would have sent to ${to})`);
    return { sent: false, reason: 'twilio_not_configured' };
  }

  try {
    await twilioClient.messages.create({ body, from: twilioConfig.phoneNumber, to });
    return { sent: true };
  } catch (error) {
    console.error(`[SMS] Failed to send to ${to}:`, error.message);
    return { sent: false, reason: error.message };
  }
}

/**
 * Send a Web Push notification to the customer, if they have a pushSubscription
 * stored.  Runs independently of SMS — one failing doesn't block the other.
 */
async function sendPush(customer, title, body, url) {
  if (!customer.pushSubscription) return { sent: false, reason: 'no_subscription' };
  try {
    const payload = { title, body, url: url || `/status/${customer.queueId}` };
    return await sendPushNotification(customer.pushSubscription, title, body, payload);
  } catch (err) {
    console.error(`[WebPush] Failed for customer ${customer.queueId}:`, err.message);
    return { sent: false, reason: err.message };
  }
}

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

function notifyCalled(customer) {
  const msg = `It's your turn at ${shopConfig.shopName}! You have 15 minutes to arrive. Check status: ${CLIENT_URL}/status/${customer.queueId}`;
  const smsResult = sendSms(customer.phone, msg);
  const pushResult = sendPush(customer, "It's your turn!", 'You have 15 minutes to arrive. Open the app to confirm.');
  return Promise.allSettled([smsResult, pushResult]);
}

function notifyReady(customer) {
  const msg = `Heads up! Only 2 people ahead of you at ${shopConfig.shopName}. Be ready.`;
  const smsResult = sendSms(customer.phone, msg);
  const pushResult = sendPush(customer, 'Get Ready!', 'Only a couple people ahead of you.');
  return Promise.allSettled([smsResult, pushResult]);
}

function notifyReservationConfirmed(customer, position) {
  const msg = `You're in! Your reservation at ${shopConfig.shopName} is confirmed. You are #${position} in the queue. Track your spot: ${CLIENT_URL}/status/${customer.queueId}`;
  const pushResult = sendPush(customer, 'Reservation Confirmed! 🎉', `You are #${position} in the queue.`);
  return Promise.allSettled([pushResult]);
}

function notifyBarberStarted(customer, position) {
  const msg = `${shopConfig.shopName} is now open! You are #${position} in the queue. Track: ${CLIENT_URL}/status/${customer.queueId}`;
  const pushResult = sendPush(customer, '✂️ Barber is Open!', `The barber has started. You are #${position}.`);
  return Promise.allSettled([pushResult]);
}

function notifyBarberEnded(customer) {
  const pushResult = sendPush(customer, 'Shop Closed for Today', 'The barber has ended the day. Your spot is saved for next time.');
  return Promise.allSettled([pushResult]);
}

function notifyMovedToBack(customer, newPosition) {
  const msg = `You were moved to the back of the queue at ${shopConfig.shopName} because you did not confirm within 10 minutes. You are now #${newPosition}.`;
  const pushResult = sendPush(customer, '⚠️ Moved to Back of Queue', `You did not confirm in time. You are now #${newPosition}.`);
  return Promise.allSettled([pushResult]);
}

function notifyCancelled(customer) {
  const pushResult = sendPush(customer, 'Reservation Cancelled', 'Your reservation has been cancelled. You can rejoin anytime.');
  return Promise.allSettled([pushResult]);
}

module.exports = {
  notifyCalled,
  notifyReady,
  notifyReservationConfirmed,
  notifyBarberStarted,
  notifyBarberEnded,
  notifyMovedToBack,
  notifyCancelled,
  isSmsConfigured
};

