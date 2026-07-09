require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const connectDB = require('./config/db');
const { initSocket, broadcastQueueState } = require('./socket/handlers');
const authRoutes = require('./routes/auth');
const queueRoutes = require('./routes/queue');
const customerRoutes = require('./routes/customer');
const shopConfig = require('./config/shop');
const path = require('path');

// Load eagerly (not lazily) so the SMS configuration warning, if any,
// prints once at startup instead of silently on the first call.
require('./utils/notifications');

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/queue', queueRoutes);
app.use('/api/customer', customerRoutes);

app.get('/api/config', (req, res) => res.json(shopConfig));

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')));
  app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../client/dist/index.html')));
}

connectDB().then(() => {
  initSocket(server);
  const PORT = process.env.PORT || 5000;
  server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
});

// Recover timers after restart
setTimeout(async () => {
  const Queue = require('./models/Queue');
  const Customer = require('./models/Customer');
  const queue = await Queue.findOne();
  if (queue && queue.nowServing) {
    const customer = await Customer.findById(queue.nowServing);
    if (customer && (customer.status === 'called' || customer.status === 'coming')) {
      const elapsed = Date.now() - new Date(queue.nowServingCalledAt).getTime();
      const remainingNoShow = 15 * 60 * 1000 - elapsed;
      const remainingComing = 10 * 60 * 1000 - elapsed;
      const { handleNoShow, scheduleNoShow, handleComingCheck, scheduleComingCheck } = require('./socket/handlers');
      
      if (customer.status === 'called') {
        if (remainingComing <= 0) {
          await handleComingCheck(customer._id);
          return;
        } else {
          await scheduleComingCheck(customer._id, remainingComing);
        }
      }

      if (remainingNoShow <= 0) {
        await handleNoShow(customer._id);
      } else {
        await scheduleNoShow(customer._id, remainingNoShow);
      }
    }
  }
}, 2000);