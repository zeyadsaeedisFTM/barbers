import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getCustomerStatus, subscribePush, confirmComing, cancelReservation, rejoinQueue } from '../utils/api';
import { useSocket } from '../context/SocketContext';
import { useTimer } from '../hooks/useTimer';
import { useToast } from '../context/ToastContext';
import { useShopConfig } from '../hooks/useShopConfig';

function playChime() {
  try {
    const audio = new Audio('/sounds/notification.mp3');
    audio.play().catch(() => {});
  } catch {
    /* audio not supported in this environment — safe to ignore */
  }
}

function notifyBrowser(title, body) {
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    try {
      new Notification(title, { body });
    } catch {
      /* some browsers restrict Notification outside a service worker — ignore */
    }
  }
}

/**
 * Convert a URL-safe base64 VAPID key to a Uint8Array for
 * PushManager.subscribe's applicationServerKey option.
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export default function CustomerStatus() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { socket, serverTimeOffset } = useSocket();
  const { showToast } = useToast();
  const config = useShopConfig();
  const [status, setStatus] = useState(null);
  const [position, setPosition] = useState(null);
  const [calledAt, setCalledAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const timer = useTimer(calledAt, 15);
  const readyNotifiedRef = useRef(false);
  const pushSubscribedRef = useRef(false);

  useEffect(() => {
    getCustomerStatus(id)
      .then(res => {
        setStatus(res.data.status);
        setPosition(res.data.position);
        setCalledAt(res.data.calledAt);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    if (socket) {
      socket.emit('joinCustomer', id);

      const handleUpdate = (data) => {
        if (data.status) setStatus(data.status);
        if (data.calledAt) setCalledAt(data.calledAt);
        if (data.position !== undefined) setPosition(data.position);

        if (data.status === 'called') {
          playChime();
          showToast("It's your turn! You have 15 minutes to arrive.", { type: 'success', duration: 15000 });
          notifyBrowser("It's your turn!", 'You have 15 minutes to arrive.');
        } else if (data.ready && !readyNotifiedRef.current) {
          readyNotifiedRef.current = true;
          playChime();
          showToast('Almost up! Only a couple people ahead of you.', { type: 'info' });
          notifyBrowser('Get Ready!', 'Only a couple people ahead of you.');
        } else if (data.status === 'no-show') {
          showToast('You missed your turn — ask the front desk if you can rejoin.', { type: 'error' });
        } else if (data.status === 'served') {
          showToast('Thanks for visiting — see you next time!', { type: 'success' });
        } else if (data.status === 'removed') {
          showToast('You have been removed from the queue.', { type: 'error' });
        } else if (data.status === 'coming') {
          showToast('Your confirmation has been received. Drive safely!', { type: 'success' });
        } else if (data.status === 'cancelled') {
          showToast('Your reservation has been cancelled.', { type: 'error' });
        }
      };

      const handleOpenStatus = (data) => {
        if (data.isOpen) {
          showToast('The barber has started working!', { type: 'success' });
        } else {
          showToast('The barber has ended the day. Your slot is saved.', { type: 'info' });
        }
      };

      socket.on('customerUpdate', handleUpdate);
      socket.on('queueOpenStatus', handleOpenStatus);
      return () => {
        socket.off('customerUpdate', handleUpdate);
        socket.off('queueOpenStatus', handleOpenStatus);
      };
    }
  }, [id, socket]);

  const handleConfirmComing = async () => {
    setSubmitting(true);
    try {
      const res = await confirmComing(id);
      setStatus(res.data.status);
      showToast('Confirmation received! Drive safely.', { type: 'success' });
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to confirm. Please try again.', { type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!window.confirm('Are you sure you want to cancel your reservation?')) return;
    setSubmitting(true);
    try {
      await cancelReservation(id);
      setStatus('cancelled');
      showToast('Reservation cancelled.', { type: 'success' });
      navigate('/');
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to cancel.', { type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRejoin = async () => {
    setSubmitting(true);
    try {
      const res = await rejoinQueue(id);
      showToast('You joined at the end of the queue!', { type: 'success' });
      navigate(`/status/${res.data.queueId}`);
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to rejoin.', { type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  // Request Notification permission + register service worker + subscribe to push
  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    if (
      !pushSubscribedRef.current &&
      config.vapidPublicKey &&
      'serviceWorker' in navigator &&
      'PushManager' in window
    ) {
      pushSubscribedRef.current = true;
      (async () => {
        try {
          const registration = await navigator.serviceWorker.register('/sw.js');
          console.log('[SW] Service worker registered');

          const ready = await navigator.serviceWorker.ready;

          let subscription = await ready.pushManager.getSubscription();
          if (!subscription) {
            subscription = await ready.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlBase64ToUint8Array(config.vapidPublicKey),
            });
            console.log('[WebPush] Browser subscribed to push');
          }

          await subscribePush({ queueId: id, subscription: subscription.toJSON() });
          console.log('[WebPush] Subscription sent to server');
        } catch (err) {
          console.warn('[WebPush] Could not subscribe:', err.message || err);
        }
      })();
    }
  }, [config.vapidPublicKey, id]);

  if (loading) return <div className="text-center mt-20 text-cream-dim">Loading…</div>;
  if (!status) return <div className="text-center mt-20 text-cream-dim">Not found. Check your queue ID.</div>;

  return (
    <div className="max-w-md mx-auto mt-6">
      <div className="ticket-edge bg-charcoal-light border-2 border-brass/40 rounded-lg shadow-ticket p-8 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-brass mb-1">Your Status</p>

        {status === 'called' ? (
          <div>
            <p className="font-heading text-4xl text-brass mb-2 animate-gentle-pulse">It's your turn!</p>
            {timer !== null && timer > 0 && (
              <div className="font-heading text-5xl text-cream mt-4 tracking-wider">{formatTime(timer)}</div>
            )}
            <p className="text-sm text-cream-dim mt-3">You have 15 minutes to arrive.</p>
            {timer !== null && timer > 300 && (
              <button
                onClick={handleConfirmComing}
                disabled={submitting}
                className="mt-6 w-full bg-brass hover:bg-brass-light disabled:opacity-60 text-charcoal py-3 rounded-md font-heading text-lg tracking-wide transition-colors"
              >
                {submitting ? 'Confirming...' : "I'm Coming!"}
              </button>
            )}
            <button
              onClick={handleCancel}
              disabled={submitting}
              className="mt-4 w-full bg-barber-red/20 hover:bg-barber-red/30 border border-barber-red/40 text-cream-dim py-2.5 rounded-md font-heading text-md transition-colors"
            >
              Cancel Reservation
            </button>
          </div>
        ) : status === 'coming' ? (
          <div>
            <p className="font-heading text-4xl text-brass mb-2 animate-gentle-pulse">On your way!</p>
            {timer !== null && timer > 0 && (
              <div className="font-heading text-5xl text-cream mt-4 tracking-wider">{formatTime(timer)}</div>
            )}
            <p className="text-sm text-cream-dim mt-3">We know you're coming. You have until the timer ends to arrive.</p>
            <button
              onClick={handleCancel}
              disabled={submitting}
              className="mt-6 w-full bg-barber-red/20 hover:bg-barber-red/30 border border-barber-red/40 text-cream-dim py-2.5 rounded-md font-heading text-md transition-colors"
            >
              Cancel Reservation
            </button>
          </div>
        ) : status === 'arrived' ? (
          <div>
            <p className="font-heading text-4xl text-brass mb-2">You're checked in!</p>
            <p className="text-sm text-cream-dim mt-3">The barber knows you're here — sit tight, you're up now.</p>
          </div>
        ) : status === 'served' ? (
          <div>
            <p className="font-heading text-3xl text-cream">Service Complete</p>
            <p className="text-cream-dim mt-1">Thank you for visiting!</p>
          </div>
        ) : status === 'no-show' ? (
          <div>
            <p className="font-heading text-3xl text-barber-red-light">Missed Your Turn</p>
            <p className="text-cream-dim mt-1">You didn't arrive in time.</p>
          </div>
        ) : status === 'removed' ? (
          <div>
            <p className="font-heading text-3xl text-barber-red-light">Removed from Queue</p>
            <p className="text-cream-dim mt-1">You have been removed from the queue or the shop has closed.</p>
          </div>
        ) : status === 'cancelled' ? (
          <div>
            <p className="font-heading text-3xl text-barber-red-light">Reservation Cancelled</p>
            <p className="text-cream-dim mt-2 mb-6">You cancelled this reservation.</p>
            <button
              onClick={handleRejoin}
              disabled={submitting}
              className="w-full bg-brass hover:bg-brass-light text-charcoal py-3 rounded-md font-heading text-lg tracking-wide transition-colors"
            >
              {submitting ? 'Rejoining...' : 'Get Back In Line'}
            </button>
          </div>
        ) : (
          <div>
            <div className="my-3 border-t border-dashed border-brass/30" />
            <p className="text-xs uppercase tracking-wide text-cream-dim mb-1">Position in line</p>
            <p className="font-heading text-7xl text-cream leading-none">{position}</p>
            {position === 3 && (
              <div className="mt-4 p-3 bg-brass/15 border border-brass/40 rounded-md text-brass text-sm font-medium">
                Get ready! Only 2 people ahead of you.
              </div>
            )}
            <p className="text-cream-dim text-sm mt-4">Estimated wait: ~{Math.max(0, (position - 1) * 20)} minutes</p>
            <button
              onClick={handleCancel}
              disabled={submitting}
              className="mt-6 w-full bg-barber-red/20 hover:bg-barber-red/30 border border-barber-red/40 text-cream-dim py-2.5 rounded-md font-heading text-md transition-colors"
            >
              Cancel Reservation
            </button>
          </div>
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
