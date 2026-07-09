const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Barber = require('../models/Barber');
const Queue = require('../models/Queue');
const router = express.Router();

async function seedBarber() {
  const count = await Barber.countDocuments();
  if (count === 0) {
    const password = process.env.BARBER_PASSWORD || 'admin123';
    const hash = await bcrypt.hash(password, 10);
    const barber = new Barber({ username: 'barber', passwordHash: hash });
    await barber.save();
    const queue = new Queue({ barberId: barber._id });
    await queue.save();
    console.log('Default barber created: barber /', password);
  }
}
seedBarber();

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const barber = await Barber.findOne({ username });
  if (!barber) return res.status(401).json({ error: 'Invalid credentials' });
  const valid = await bcrypt.compare(password, barber.passwordHash);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ id: barber._id, username: barber.username }, process.env.JWT_SECRET, { expiresIn: '24h' });
  res.json({ token });
});

module.exports = router;