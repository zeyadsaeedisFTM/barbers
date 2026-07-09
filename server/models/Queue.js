const mongoose = require('mongoose');

const queueSchema = new mongoose.Schema({
  barberId: { type: mongoose.Schema.Types.ObjectId, ref: 'Barber', required: true },
  activeQueue: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Customer' }],
  nowServing: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null },
  nowServingCalledAt: { type: Date, default: null },
  isOpen: { type: Boolean, default: false },
  dayStartedAt: { type: Date, default: null },
  dayEndedAt: { type: Date, default: null }
});

module.exports = mongoose.model('Queue', queueSchema);