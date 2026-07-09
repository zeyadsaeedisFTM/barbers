const mongoose = require('mongoose');

const barberSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true }
});

module.exports = mongoose.model('Barber', barberSchema);