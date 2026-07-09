const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true },
  queueId: { type: String, required: true, unique: true },
  deviceId: { type: String, default: null },
  status: { type: String, enum: ['waiting', 'called', 'coming', 'arrived', 'served', 'no-show', 'removed', 'cancelled'], default: 'waiting' },
  joinedAt: { type: Date, default: Date.now },
  calledAt: { type: Date, default: null },
  pushSubscription: { type: Object, default: null },
  rejoinedAs: { type: String, default: null }
});

module.exports = mongoose.model('Customer', customerSchema);