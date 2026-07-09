const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Queue = require('../models/Queue');
const Customer = require('../models/Customer');
const { broadcastQueueState, emitCustomerUpdate, callNextCustomer, checkReadyNotification, handleNoShow, noShowTimers, clearTimersForCustomer } = require('../socket/handlers');

router.use(auth);

router.get('/', async (req, res) => {
  const queue = await Queue.findOne().populate('activeQueue nowServing');
  if (!queue) return res.status(404).json({ error: 'Queue not found' });
  const { formatQueueForAdmin } = require('../socket/handlers');
  res.json(formatQueueForAdmin(queue));
});

router.post('/add', async (req, res) => {
  const { name, phone } = req.body;
  if (!name || !phone) return res.status(400).json({ error: 'Name and phone required' });
  const queue = await Queue.findOne();
  if (!queue || !queue.isOpen) return res.status(400).json({ error: 'Start your working day before adding customers.' });
  const { v4: uuidv4 } = require('uuid');
  const queueId = uuidv4().slice(0, 8);
  const customer = new Customer({ name, phone, queueId, status: 'waiting' });
  await customer.save();
  queue.activeQueue.push(customer._id);
  await queue.save();
  broadcastQueueState();
  res.status(201).json(customer);
});

router.delete('/remove/:customerId', async (req, res) => {
  const queue = await Queue.findOne();
  if (!queue) return res.status(404).json({ error: 'Queue not found' });
  const index = queue.activeQueue.indexOf(req.params.customerId);
  if (index > -1) {
    queue.activeQueue.splice(index, 1);
    await queue.save();
    
    const customer = await Customer.findById(req.params.customerId);
    if (customer) {
      customer.status = 'removed';
      await customer.save();
      emitCustomerUpdate(customer.queueId, { status: 'removed' });
    }

    broadcastQueueState();
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Customer not in active queue' });
  }
});

router.post('/next', async (req, res) => {
  try {
    const queue = await Queue.findOne();
    if (!queue) return res.status(404).json({ error: 'Queue not found' });
    if (!queue.isOpen) return res.status(400).json({ error: 'Start your working day before serving customers.' });
    if (queue.nowServing) {
      const customer = await Customer.findById(queue.nowServing);
      if (customer) {
        customer.status = 'served';
        await customer.save();
        emitCustomerUpdate(customer.queueId, { status: 'served' });
      }
      queue.nowServing = null;
      queue.nowServingCalledAt = null;
      await queue.save();
      broadcastQueueState();
    }
    await callNextCustomer();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/arrived', async (req, res) => {
  try {
    const queue = await Queue.findOne();
    if (!queue || !queue.nowServing) {
      return res.status(400).json({ error: 'No one is currently being called.' });
    }

    const customer = await Customer.findById(queue.nowServing);
    if (customer) {
      customer.status = 'arrived';
      await customer.save();
    }

    // Stop the countdown for good — clearing nowServingCalledAt is what
    // makes useTimer() on the client return null / blank instead of
    // continuing to tick down.
    queue.nowServingCalledAt = null;
    await queue.save();

    // The client showed up, so cancel all pending timers for them.
    clearTimersForCustomer(queue.nowServing);

    broadcastQueueState();
    if (customer) {
      emitCustomerUpdate(customer.queueId, { status: 'arrived' });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/noshow', async (req, res) => {
  const queue = await Queue.findOne();
  if (!queue || !queue.nowServing) return res.status(400).json({ error: 'No one is being served' });
  await handleNoShow(queue.nowServing);
  res.json({ success: true });
});

router.post('/start-day', async (req, res) => {
  try {
    const queue = await Queue.findOne();
    if (!queue) return res.status(404).json({ error: 'Queue not found' });
    if (queue.isOpen) return res.status(400).json({ error: 'Working day already started.' });

    queue.isOpen = true;
    queue.dayStartedAt = new Date();
    queue.dayEndedAt = null;
    await queue.save();

    broadcastQueueState();
    res.json({ success: true, dayStartedAt: queue.dayStartedAt });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/end-day', async (req, res) => {
  try {
    const queue = await Queue.findOne();
    if (!queue) return res.status(404).json({ error: 'Queue not found' });
    if (!queue.isOpen) return res.status(400).json({ error: 'Working day already ended.' });

    queue.isOpen = false;
    queue.dayEndedAt = new Date();
    await queue.save();

    broadcastQueueState();
    res.json({ success: true, dayEndedAt: queue.dayEndedAt });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/log', async (req, res) => {
  const served = await Customer.find({ status: 'served' }).sort({ calledAt: -1 }).limit(50);
  const noShows = await Customer.find({ status: 'no-show' }).sort({ calledAt: -1 }).limit(50);
  res.json({ served, noShows });
});

module.exports = router;