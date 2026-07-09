let io;
let lastKnownIsOpen = null; // tracks transitions for barber start/end push notifications
const TIMEOUT_DURATION = 15 * 60 * 1000;
const COMING_TIMEOUT_DURATION = 10 * 60 * 1000;
const noShowTimers = new Map();
const comingTimers = new Map();

function initSocket(httpServer) {
  io = require('socket.io')(httpServer, { cors: { origin: '*' } });

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    socket.emit('serverTime', { serverTime: Date.now() });

    socket.on('joinAdmin', () => {
      socket.join('admin');
      broadcastQueueState();
    });

    socket.on('joinCustomer', (customerId) => {
      socket.join(`customer-${customerId}`);
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });

  return io;
}

function broadcastQueueState() {
  if (!io) return;
  const Queue = require('../models/Queue');
  Queue.findOne().populate('activeQueue nowServing')
    .then(async queue => {
      if (queue) {
        // Broadcast open/closed status to all clients
        io.emit('queueOpenStatus', { isOpen: queue.isOpen });

        // Detect barber start / end transitions and push-notify all waiting customers
        const isOpenChanged = lastKnownIsOpen !== null && lastKnownIsOpen !== queue.isOpen;
        if (isOpenChanged) {
          const { notifyBarberStarted, notifyBarberEnded } = require('../utils/notifications');
          const Customer = require('../models/Customer');
          const waitingCustomers = await Customer.find({ _id: { $in: queue.activeQueue.map(c => c._id) } });
          waitingCustomers.forEach((customer, index) => {
            const position = (queue.nowServing ? 1 : 0) + index + 1;
            if (queue.isOpen) {
              notifyBarberStarted(customer, position);
            } else {
              notifyBarberEnded(customer);
            }
          });
          // Also notify nowServing customer if day ended
          if (!queue.isOpen && queue.nowServing) {
            notifyBarberEnded(queue.nowServing);
          }
        }
        lastKnownIsOpen = queue.isOpen;

        // 1. Update the Admin Dashboard
        io.to('admin').emit('queueState', formatQueueForAdmin(queue));

        // 2. Update all waiting customers instantly
        queue.activeQueue.forEach((customer, index) => {
          const position = (queue.nowServing ? 1 : 0) + index + 1;
          emitCustomerUpdate(customer.queueId, {
            position: position,
            totalWaiting: queue.activeQueue.length
          });
          checkReadyNotification(position, customer._id);
        });
      }
    })
    .catch(err => console.error('broadcastQueueState error:', err));
}

function formatQueueForAdmin(queue) {
  const nowServing = queue.nowServing ? {
    _id: queue.nowServing._id,
    name: queue.nowServing.name,
    phone: queue.nowServing.phone,
    queueId: queue.nowServing.queueId,
    status: queue.nowServing.status,
    calledAt: queue.nowServingCalledAt
  } : null;

  const active = queue.activeQueue.map(c => ({
    _id: c._id,
    name: c.name,
    phone: c.phone,
    queueId: c.queueId,
    status: c.status,
    joinedAt: c.joinedAt
  }));

  // A single combined view of everyone currently in the shop (the customer
  // being served plus everyone waiting), each tagged with their status, so
  // the dashboard can render one "Complete queue" list alongside the more
  // detailed "Current customer" / "Waiting customers" panels.
  const completeQueue = [
    ...(nowServing ? [{ ...nowServing, position: 1 }] : []),
    ...active.map((c, idx) => ({ ...c, position: (nowServing ? 1 : 0) + idx + 1 }))
  ];

  return {
    nowServing,
    activeQueue: active,
    nowServingCalledAt: queue.nowServingCalledAt,
    completeQueue,
    isOpen: queue.isOpen,
    dayStartedAt: queue.dayStartedAt,
    dayEndedAt: queue.dayEndedAt
  };
}

function emitCustomerUpdate(customerId, data) {
  if (io) io.to(`customer-${customerId}`).emit('customerUpdate', data);
}

function clearTimersForCustomer(customerId) {
  const key = customerId.toString();
  if (noShowTimers.has(key)) {
    clearTimeout(noShowTimers.get(key));
    noShowTimers.delete(key);
  }
  if (comingTimers.has(key)) {
    clearTimeout(comingTimers.get(key));
    comingTimers.delete(key);
  }
}

async function scheduleComingCheck(customerId, duration = COMING_TIMEOUT_DURATION) {
  if (comingTimers.has(customerId.toString())) {
    clearTimeout(comingTimers.get(customerId.toString()));
  }
  const timer = setTimeout(async () => {
    await handleComingCheck(customerId);
  }, duration);
  comingTimers.set(customerId.toString(), timer);
}

async function handleComingCheck(customerId) {
  try {
    const Queue = require('../models/Queue');
    const Customer = require('../models/Customer');
    const queue = await Queue.findOne();
    if (!queue || !queue.nowServing || queue.nowServing.toString() !== customerId.toString()) return;

    const customer = await Customer.findById(customerId);
    if (!customer) return;

    // If they did not click "I'm Coming" in 10 minutes (status is still 'called')
    if (customer.status === 'called') {
      customer.status = 'waiting';
      await customer.save();

      queue.activeQueue.push(customer._id);
      queue.nowServing = null;
      queue.nowServingCalledAt = null;
      await queue.save();

      clearTimersForCustomer(customerId);

      const newPosition = queue.activeQueue.length;
      emitCustomerUpdate(customer.queueId, { status: 'waiting', movedToBack: true, position: newPosition });
      broadcastQueueState();

      // Push notify the customer they were moved to back
      const { notifyMovedToBack } = require('../utils/notifications');
      notifyMovedToBack(customer, newPosition);

      await callNextCustomer();
    }
  } catch (err) {
    console.error('handleComingCheck error:', err);
  }
}

async function scheduleNoShow(customerId, duration = TIMEOUT_DURATION) {
  if (noShowTimers.has(customerId.toString())) {
    clearTimeout(noShowTimers.get(customerId.toString()));
  }
  const timer = setTimeout(async () => {
    await handleNoShow(customerId);
  }, duration);
  noShowTimers.set(customerId.toString(), timer);
}

async function handleNoShow(customerId) {
  try {
    const Queue = require('../models/Queue');
    const Customer = require('../models/Customer');
    const queue = await Queue.findOne();
    if (!queue || !queue.nowServing || queue.nowServing.toString() !== customerId.toString()) return;

    const customer = await Customer.findById(customerId);
    if (customer) {
      customer.status = 'no-show';
      await customer.save();
    }

    queue.nowServing = null;
    queue.nowServingCalledAt = null;
    await queue.save();

    clearTimersForCustomer(customerId);

    broadcastQueueState();
    if (customer) {
      emitCustomerUpdate(customer.queueId, { status: 'no-show' });
    }
    await callNextCustomer();
  } catch (err) {
    console.error('handleNoShow error:', err);
  }
}

async function callNextCustomer() {
  const Queue = require('../models/Queue');
  const Customer = require('../models/Customer');
  const queue = await Queue.findOne().populate('activeQueue');
  if (!queue) return;
  if (queue.activeQueue.length === 0) {
    queue.nowServing = null;
    queue.nowServingCalledAt = null;
    await queue.save();
    broadcastQueueState();
    return;
  }

  const nextCustomer = queue.activeQueue.shift();
  queue.nowServing = nextCustomer._id;
  queue.nowServingCalledAt = new Date();
  await queue.save();

  const customer = await Customer.findById(nextCustomer._id);
  customer.status = 'called';
  customer.calledAt = queue.nowServingCalledAt;
  await customer.save();

  const { notifyCalled } = require('../utils/notifications');
  notifyCalled(customer);

  emitCustomerUpdate(customer.queueId, {
    status: 'called',
    calledAt: queue.nowServingCalledAt,
    queueId: customer.queueId
  });

  broadcastQueueState();
  scheduleComingCheck(customer._id);
  scheduleNoShow(customer._id);
}

async function checkReadyNotification(position, customerId) {
  // Changed from position === 4 to position === 3
  if (position === 3) {
    const Customer = require('../models/Customer');
    const customer = await Customer.findById(customerId);
    if (customer) {
      const { notifyReady } = require('../utils/notifications');
      notifyReady(customer);
      emitCustomerUpdate(customer.queueId, { ready: true });
    }
  }
}

module.exports = {
  initSocket,
  broadcastQueueState,
  emitCustomerUpdate,
  callNextCustomer,
  checkReadyNotification,
  scheduleNoShow,
  handleNoShow,
  formatQueueForAdmin,  
  getIo: () => io,
  noShowTimers,
  comingTimers,
  scheduleComingCheck,
  handleComingCheck,
  clearTimersForCustomer
};