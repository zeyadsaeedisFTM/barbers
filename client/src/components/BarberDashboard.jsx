import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useToast } from '../context/ToastContext';
import { useTimer } from '../hooks/useTimer';
import { useShopConfig } from '../hooks/useShopConfig';
import {
  getQueue,
  addWalkIn,
  removeCustomer,
  barberNext,
  barberArrived,
  barberNoShow,
  startWorkingDay,
  endWorkingDay,
} from '../utils/api';

const EMPTY_STATE = {
  nowServing: null,
  activeQueue: [],
  completeQueue: [],
  nowServingCalledAt: null,
  isOpen: false,
  dayStartedAt: null,
  dayEndedAt: null,
};

const STATUS_STYLES = {
  waiting: { label: 'Waiting', className: 'bg-cream-dim/10 text-cream-dim border-cream-dim/20' },
  called: { label: 'Called', className: 'bg-brass/15 text-brass border-brass/40' },
  coming: { label: 'Coming', className: 'bg-brass/35 text-brass-light border-brass/50' },
  arrived: { label: 'Arrived', className: 'bg-brass text-charcoal border-brass' },
  served: { label: 'Served', className: 'bg-cream-dim/10 text-cream-dim border-cream-dim/20' },
  'no-show': { label: 'Skipped', className: 'bg-barber-red/15 text-barber-red-light border-barber-red/40' },
  removed: { label: 'Removed', className: 'bg-barber-red/15 text-barber-red-light border-barber-red/40' },
};

function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.waiting;
  return (
    <span className={`text-[11px] font-semibold uppercase tracking-wide px-2 py-1 rounded-full border whitespace-nowrap ${s.className}`}>
      {s.label}
    </span>
  );
}

export default function BarberDashboard() {
  const { isAuthenticated, logout } = useAuth();
  const { socket } = useSocket();
  const { showToast } = useToast();
  const config = useShopConfig();
  const navigate = useNavigate();
  const [queueState, setQueueState] = useState(EMPTY_STATE);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '' });
  const [busy, setBusy] = useState(false);

  // Only counts down while the called customer hasn't arrived yet — as soon
  // as nowServingCalledAt is cleared (on arrival, or once someone new is
  // called), this naturally goes blank.
  const timer = useTimer(
    (queueState.nowServing?.status === 'called' || queueState.nowServing?.status === 'coming') ? queueState.nowServingCalledAt : null,
    15
  );

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/admin/login');
      return;
    }
    getQueue().then(res => setQueueState(res.data)).catch(() => logout());

    if (socket) {
      socket.on('queueState', (data) => setQueueState(data));
      return () => socket.off('queueState');
    }
  }, [isAuthenticated, socket, navigate, logout]);

  const withBusyGuard = (fn) => async (...args) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn(...args);
    } catch (err) {
      showToast(err.response?.data?.error || 'Something went wrong. Please try again.', { type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const handleNext = withBusyGuard(async () => {
    await barberNext();
    playSound();
  });

  const handleArrived = withBusyGuard(async () => {
    await barberArrived();
  });

  const handleSkip = withBusyGuard(async () => {
    await barberNoShow();
    playSound();
  });

  const handleAddWalkIn = withBusyGuard(async (e) => {
    e.preventDefault();
    if (!newCustomer.name || !newCustomer.phone) return;
    await addWalkIn(newCustomer);
    setNewCustomer({ name: '', phone: '' });
    playSound();
  });

  const handleRemove = withBusyGuard(async (id) => {
    await removeCustomer(id);
  });

  const handleStartDay = withBusyGuard(async () => {
    await startWorkingDay();
    playSound();
  });

  const handleEndDay = withBusyGuard(async () => {
    if (!window.confirm('End the working day? The current queue will be cleared and customers will no longer be able to join until you start again.')) {
      return;
    }
    await endWorkingDay();
  });

  const playSound = () => {
    try {
      const audio = new Audio('/sounds/notification.mp3');
      audio.play().catch(() => {});
    } catch {}
  };

  if (!isAuthenticated) return null;

  const { isOpen, dayStartedAt } = queueState;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="font-heading text-3xl text-cream">Barber Dashboard</h2>
        <div className="flex items-center gap-4 text-sm">
          <Link to="/admin/log" className="text-brass hover:text-brass-light hover:underline">Log</Link>
          <button onClick={logout} className="text-barber-red-light hover:underline">Logout</button>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs bg-charcoal-light border border-brass/20 rounded-md px-3 py-2 w-fit">
        <span className={`h-2 w-2 rounded-full ${config.smsEnabled ? 'bg-brass' : 'bg-barber-red-light'}`} />
        <span className="text-cream-dim">
          {config.smsEnabled ? 'SMS notifications: connected' : 'SMS notifications: not configured (add Twilio keys in server/.env)'}
        </span>
      </div>

      {/* Working day controls */}
      <div className={`rounded-lg p-6 border ${isOpen ? 'bg-charcoal-light border-brass/20' : 'bg-charcoal-light border-barber-red/30'}`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${isOpen ? 'bg-brass animate-gentle-pulse' : 'bg-barber-red-light'}`} />
              <p className="font-heading text-xl text-cream">
                {isOpen ? 'Working day in progress' : 'Working day not started'}
              </p>
            </div>
            <p className="text-cream-dim text-sm mt-1">
              {isOpen && dayStartedAt
                ? `Started at ${new Date(dayStartedAt).toLocaleTimeString()}. Customers can join the queue.`
                : 'Customers cannot join the queue until you start your working day.'}
            </p>
          </div>
          {isOpen ? (
            <button
              onClick={handleEndDay}
              disabled={busy}
              className="bg-barber-red hover:bg-barber-red-light disabled:opacity-60 text-cream px-6 py-3 rounded-md font-heading text-lg tracking-wide transition-colors"
            >
              End Working Day
            </button>
          ) : (
            <button
              onClick={handleStartDay}
              disabled={busy}
              className="bg-brass hover:bg-brass-light disabled:opacity-60 text-charcoal px-6 py-3 rounded-md font-heading text-lg tracking-wide transition-colors"
            >
              Start Working Day
            </button>
          )}
        </div>
      </div>

      {/* Current customer */}
      <div className="bg-charcoal-light border border-brass/20 rounded-lg p-6">
        <h3 className="font-heading text-xl text-brass mb-4">Current Customer</h3>
        {queueState.nowServing ? (
          <div>
            <div className="flex items-center gap-3 mb-1">
              <p className="font-heading text-4xl text-cream">{queueState.nowServing.name}</p>
              <StatusBadge status={queueState.nowServing.status} />
            </div>
            <p className="text-sm text-cream-dim mb-4">{queueState.nowServing.phone}</p>

            {queueState.nowServing.status === 'arrived' ? (
              <div className="bg-charcoal rounded-md border border-brass/20 p-4">
                <p className="font-heading text-2xl text-brass">Customer has arrived</p>
                <p className="text-cream-dim text-sm mt-1">Ready for service — click below once you're done.</p>
              </div>
            ) : timer !== null && timer > 0 ? (
              <div className="bg-charcoal rounded-md border border-brass/20 p-4">
                <p className="font-heading text-3xl text-barber-red-light animate-gentle-pulse">{formatTime(timer)} remaining</p>
                <div className="flex gap-3 mt-4">
                  <button onClick={handleArrived} disabled={busy} className="flex-1 bg-brass hover:bg-brass-light disabled:opacity-60 text-charcoal py-3 rounded-md font-semibold transition-colors">Client Arrived</button>
                  <button onClick={handleSkip} disabled={busy} className="flex-1 bg-barber-red hover:bg-barber-red-light disabled:opacity-60 text-cream py-3 rounded-md font-semibold transition-colors">Skip Customer</button>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-brass animate-gentle-pulse font-medium mb-4">Waiting for arrival…</p>
                <div className="flex gap-3">
                  <button onClick={handleArrived} disabled={busy} className="flex-1 bg-brass hover:bg-brass-light disabled:opacity-60 text-charcoal py-3 rounded-md font-semibold transition-colors">Client Arrived</button>
                  <button onClick={handleSkip} disabled={busy} className="flex-1 bg-barber-red hover:bg-barber-red-light disabled:opacity-60 text-cream py-3 rounded-md font-semibold transition-colors">Skip Customer</button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-cream-dim py-4">You are not serving anyone right now.</p>
        )}

        <button
          onClick={handleNext}
          disabled={busy || !isOpen}
          className="mt-6 w-full bg-barber-red hover:bg-barber-red-light disabled:opacity-40 disabled:cursor-not-allowed text-cream py-4 rounded-md font-heading text-2xl tracking-wide transition-colors"
        >
          {queueState.nowServing ? 'Get Next Customer' : 'Start Queue'}
        </button>
        {!isOpen && (
          <p className="text-cream-dim text-xs text-center mt-2">Start your working day to begin serving customers.</p>
        )}
      </div>

      {/* Waiting queue */}
      <div className="bg-charcoal-light border border-brass/20 rounded-lg p-5">
        <h3 className="font-heading text-xl text-brass mb-3">Waiting Customers ({queueState.activeQueue.length})</h3>
        {queueState.activeQueue.length === 0 ? (
          <p className="text-cream-dim">No customers waiting</p>
        ) : (
          <ul className="space-y-2">
            {queueState.activeQueue.map((c, idx) => (
              <li key={c._id} className="flex justify-between items-center bg-charcoal border border-cream-dim/10 p-3 rounded-md">
                <div className="flex items-center gap-2">
                  <span className="font-heading text-brass mr-2">{idx + 2}</span>
                  <span className="text-cream">{c.name}</span>
                  <span className="text-cream-dim"> — {c.phone}</span>
                  <StatusBadge status={c.status} />
                </div>
                <button onClick={() => handleRemove(c._id)} disabled={busy} className="text-barber-red-light hover:text-barber-red text-sm font-medium disabled:opacity-60">Remove</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Complete queue overview */}
      <div className="bg-charcoal-light border border-brass/20 rounded-lg p-5">
        <h3 className="font-heading text-xl text-brass mb-3">Complete Queue ({queueState.completeQueue.length})</h3>
        {queueState.completeQueue.length === 0 ? (
          <p className="text-cream-dim">The queue is empty right now.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-cream-dim border-b border-cream-dim/10">
                  <th className="py-2 pr-4 font-medium">#</th>
                  <th className="py-2 pr-4 font-medium">Name</th>
                  <th className="py-2 pr-4 font-medium">Phone</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {queueState.completeQueue.map((c) => (
                  <tr key={c._id} className="border-b border-cream-dim/5 last:border-0">
                    <td className="py-2 pr-4 text-brass font-heading">{c.position}</td>
                    <td className="py-2 pr-4 text-cream">{c.name}</td>
                    <td className="py-2 pr-4 text-cream-dim">{c.phone}</td>
                    <td className="py-2 pr-4"><StatusBadge status={c.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add walk-in */}
      <div className={`bg-charcoal-light border border-brass/20 rounded-lg p-5 ${!isOpen ? 'opacity-60' : ''}`}>
        <h3 className="font-heading text-xl text-brass mb-3">Add Walk-in Customer</h3>
        <form onSubmit={handleAddWalkIn} className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            placeholder="Name"
            value={newCustomer.name}
            onChange={e => setNewCustomer({ ...newCustomer, name: e.target.value })}
            disabled={!isOpen || busy}
            className="flex-1 p-2.5 bg-charcoal border border-cream-dim/30 rounded-md text-cream placeholder-cream-dim/40 focus:outline-none focus:ring-2 focus:ring-brass disabled:cursor-not-allowed"
          />
          <input
            type="tel"
            placeholder="Phone"
            value={newCustomer.phone}
            onChange={e => setNewCustomer({ ...newCustomer, phone: e.target.value })}
            disabled={!isOpen || busy}
            className="flex-1 p-2.5 bg-charcoal border border-cream-dim/30 rounded-md text-cream placeholder-cream-dim/40 focus:outline-none focus:ring-2 focus:ring-brass disabled:cursor-not-allowed"
          />
          <button type="submit" disabled={!isOpen || busy} className="bg-brass hover:bg-brass-light disabled:opacity-60 disabled:cursor-not-allowed text-charcoal font-semibold px-5 rounded-md py-2.5 transition-colors">Add</button>
        </form>
        {!isOpen && (
          <p className="text-cream-dim text-xs mt-2">Start your working day to add walk-ins.</p>
        )}
      </div>
    </div>
  );
}

function formatTime(seconds) {
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}
