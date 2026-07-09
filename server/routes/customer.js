const express = require('express');
const router = express.Router();
const Customer = require('../models/Customer');
const Queue = require('../models/Queue');
const { broadcastQueueState, emitCustomerUpdate, checkReadyNotification, comingTimers } = require('../socket/handlers');

// ─── Helpers ────────────────────────────────────────────────────────────────

function getPosition(customerId, queue) {
  if (queue.nowServing && queue.nowServing.toString() === customerId.toString()) return 1;
  const index = queue.activeQueue.findIndex(id => id.toString() === customerId.toString());
  if (index === -1) return 'unknown';
  return (queue.nowServing ? 1 : 0) + index + 1;
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// ─── Check if this device already has a reservation today ───────────────────

router.get('/my-reservation', async (req, res) => {
  try {
    const { deviceId } = req.query;
    if (!deviceId) return res.json({ found: false });

    const today = startOfToday();
    const customer = await Customer.findOne({
      deviceId,
      joinedAt: { $gte: today },
      status: { $nin: ['served', 'no-show', 'removed', 'cancelled'] }
    });

    if (!customer) return res.json({ found: false });

    const queue = await Queue.findOne();
    const position = getPosition(customer._id, queue);
    return res.json({
      found: true,
      queueId: customer.queueId,
      status: customer.status,
      position,
      name: customer.name
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Queue open/closed status ────────────────────────────────────────────────

router.get('/queue-status', async (req, res) => {
  const queue = await Queue.findOne();
  res.json({ isOpen: !!(queue && queue.isOpen), dayStartedAt: queue ? queue.dayStartedAt : null });
});

// ─── Join queue ──────────────────────────────────────────────────────────────

router.post('/join', async (req, res) => {
  try {
    const { name, phone, deviceId } = req.body;
    if (!name || !phone) return res.status(400).json({ error: 'Name and phone required' });

    const queue = await Queue.findOne();
    if (!queue || !queue.isOpen) {
      return res.status(403).json({ error: "We're closed right now — please check back during business hours." });
    }

    // ── One-per-day check ────────────────────────────────────────────────────
    if (deviceId) {
      const today = startOfToday();
      const existing = await Customer.findOne({
        deviceId,
        joinedAt: { $gte: today },
        status: { $nin: ['served', 'no-show', 'removed', 'cancelled'] }
      });
      if (existing) {
        // Already in queue — return existing info so client redirects
        const position = getPosition(existing._id, queue);
        return res.status(409).json({
          alreadyReserved: true,
          queueId: existing.queueId,
          position,
          status: existing.status,
          name: existing.name
        });
      }
    }

    const { v4: uuidv4 } = require('uuid');
    const queueId = uuidv4().slice(0, 8);
    const customer = new Customer({ name, phone, queueId, deviceId: deviceId || null, status: 'waiting' });
    await customer.save();
    queue.activeQueue.push(customer._id);
    await queue.save();

    const position = getPosition(customer._id, queue);
    broadcastQueueState();
    emitCustomerUpdate(customer.queueId, { position, status: 'waiting' });
    await checkReadyNotification(position, customer._id);

    // Push: reservation confirmed
    const { notifyReservationConfirmed } = require('../utils/notifications');
    notifyReservationConfirmed(customer, position);

    res.status(201).json({ queueId: customer.queueId, position, totalWaiting: queue.activeQueue.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Get customer status ─────────────────────────────────────────────────────

router.get('/status/:identifier', async (req, res) => {
  const identifier = req.params.identifier;
  let customer = await Customer.findOne({ queueId: identifier });
  if (!customer) customer = await Customer.findOne({ phone: identifier });
  if (!customer) return res.status(404).json({ error: 'Not found' });
  const queue = await Queue.findOne();
  const position = getPosition(customer._id, queue);
  const nowServing = queue.nowServing?.toString() === customer._id.toString();
  res.json({
    queueId: customer.queueId,
    name: customer.name,
    phone: customer.phone,
    status: customer.status,
    position,
    nowServing,
    calledAt: customer.calledAt,
    totalWaiting: queue.activeQueue.length
  });
});

// ─── Confirm coming ──────────────────────────────────────────────────────────

router.post('/confirm-coming/:queueId', async (req, res) => {
  try {
    const queue = await Queue.findOne();
    if (!queue || !queue.nowServing) {
      return res.status(400).json({ error: 'No active session or customer is currently called.' });
    }

    const customer = await Customer.findOne({ queueId: req.params.queueId });
    if (!customer) return res.status(404).json({ error: 'Customer not found.' });

    if (queue.nowServing.toString() !== customer._id.toString()) {
      return res.status(400).json({ error: 'You are not the currently called customer.' });
    }

    if (customer.status !== 'called') {
      return res.status(400).json({ error: 'You have already confirmed or cannot confirm at this stage.' });
    }

    const elapsed = Date.now() - new Date(queue.nowServingCalledAt).getTime();
    if (elapsed > 10 * 60 * 1000) {
      return res.status(400).json({ error: 'Confirmation window (10 minutes) has expired.' });
    }

    customer.status = 'coming';
    await customer.save();

    const key = customer._id.toString();
    if (comingTimers.has(key)) {
      clearTimeout(comingTimers.get(key));
      comingTimers.delete(key);
    }

    emitCustomerUpdate(customer.queueId, { status: 'coming' });
    broadcastQueueState();

    res.json({ success: true, status: 'coming' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Cancel reservation ──────────────────────────────────────────────────────

router.post('/cancel/:queueId', async (req, res) => {
  try {
    const customer = await Customer.findOne({ queueId: req.params.queueId });
    if (!customer) return res.status(404).json({ error: 'Customer not found.' });

    if (['served', 'no-show', 'removed', 'cancelled'].includes(customer.status)) {
      return res.status(400).json({ error: 'Cannot cancel at this stage.' });
    }

    const queue = await Queue.findOne();
    if (!queue) return res.status(404).json({ error: 'Queue not found.' });

    // Remove from activeQueue if waiting
    const idx = queue.activeQueue.findIndex(id => id.toString() === customer._id.toString());
    if (idx > -1) {
      queue.activeQueue.splice(idx, 1);
      await queue.save();
    }

    // If they are currently being served/called, clear them and call next
    const { clearTimersForCustomer, callNextCustomer } = require('../socket/handlers');
    const wasBeingServed = queue.nowServing && queue.nowServing.toString() === customer._id.toString();
    if (wasBeingServed) {
      clearTimersForCustomer(customer._id);
      queue.nowServing = null;
      queue.nowServingCalledAt = null;
      await queue.save();
      await callNextCustomer();
    }

    customer.status = 'cancelled';
    await customer.save();

    const { notifyCancelled } = require('../utils/notifications');
    notifyCancelled(customer);

    emitCustomerUpdate(customer.queueId, { status: 'cancelled' });
    broadcastQueueState();

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Rejoin queue (after cancellation) ──────────────────────────────────────

router.post('/rejoin/:queueId', async (req, res) => {
  try {
    const oldCustomer = await Customer.findOne({ queueId: req.params.queueId });
    if (!oldCustomer) return res.status(404).json({ error: 'Customer not found.' });

    if (oldCustomer.status !== 'cancelled') {
      return res.status(400).json({ error: 'Only cancelled reservations can rejoin.' });
    }

    const queue = await Queue.findOne();
    if (!queue || !queue.isOpen) {
      return res.status(403).json({ error: "We're closed right now." });
    }

    const { v4: uuidv4 } = require('uuid');
    const newQueueId = uuidv4().slice(0, 8);

    // Create fresh customer record at end of queue, carrying over the deviceId
    const newCustomer = new Customer({
      name: oldCustomer.name,
      phone: oldCustomer.phone,
      queueId: newQueueId,
      deviceId: oldCustomer.deviceId,
      pushSubscription: oldCustomer.pushSubscription,
      status: 'waiting'
    });
    await newCustomer.save();

    // Mark old record as having rejoined
    oldCustomer.rejoinedAs = newQueueId;
    await oldCustomer.save();

    queue.activeQueue.push(newCustomer._id);
    await queue.save();

    const position = getPosition(newCustomer._id, queue);
    broadcastQueueState();
    emitCustomerUpdate(newCustomer.queueId, { position, status: 'waiting' });

    const { notifyReservationConfirmed } = require('../utils/notifications');
    notifyReservationConfirmed(newCustomer, position);

    res.status(201).json({ queueId: newCustomer.queueId, position, totalWaiting: queue.activeQueue.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Web Push subscription ───────────────────────────────────────────────────

router.post('/subscribe', async (req, res) => {
  try {
    const { queueId, subscription } = req.body;
    if (!queueId || !subscription) {
      return res.status(400).json({ error: 'queueId and subscription are required' });
    }
    const customer = await Customer.findOne({ queueId });
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    customer.pushSubscription = subscription;
    await customer.save();
    res.json({ success: true });
  } catch (err) {
    console.error('[WebPush] /subscribe error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;