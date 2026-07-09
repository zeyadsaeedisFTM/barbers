import { useEffect, useState } from 'react';
import { joinQueue, getQueueOpenStatus, getMyReservation } from '../utils/api';
import { useNavigate } from 'react-router-dom';
import { useShopConfig } from '../hooks/useShopConfig';
import { useToast } from '../context/ToastContext';
import { useSocket } from '../context/SocketContext';
import InitialsAvatar from './InitialsAvatar';

export default function CustomerJoin() {
  const [form, setForm] = useState({ name: '', phone: '' });
  const [submitting, setSubmitting] = useState(false);
  const [isOpen, setIsOpen] = useState(true);
  const navigate = useNavigate();
  const config = useShopConfig();
  const { showToast } = useToast();
  const { socket } = useSocket();

  // Get or create persistent device ID
  const getDeviceId = () => {
    let id = localStorage.getItem('barber_device_id');
    if (!id) {
      id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36);
      localStorage.setItem('barber_device_id', id);
    }
    return id;
  };

  useEffect(() => {
    // Check if this device already has an active reservation
    const deviceId = getDeviceId();
    getMyReservation(deviceId)
      .then(res => {
        if (res.data.found && res.data.queueId) {
          showToast(`Welcome back, ${res.data.name}! Redirecting to your reservation...`, { type: 'info' });
          navigate(`/status/${res.data.queueId}`);
        }
      })
      .catch(err => console.error("Error checking reservation:", err));

    getQueueOpenStatus()
      .then(res => setIsOpen(!!res.data.isOpen))
      .catch(() => setIsOpen(true));

    if (socket) {
      const handleOpenStatus = (data) => {
        setIsOpen(!!data.isOpen);
      };
      socket.on('queueOpenStatus', handleOpenStatus);
      return () => {
        socket.off('queueOpenStatus', handleOpenStatus);
      };
    }
  }, [socket]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const deviceId = getDeviceId();
      const res = await joinQueue({ ...form, deviceId });
      navigate(`/status/${res.data.queueId}`);
    } catch (err) {
      if (err.response?.status === 409 && err.response?.data?.queueId) {
        showToast("You already have an active reservation today. Redirecting...", { type: 'info' });
        navigate(`/status/${err.response.data.queueId}`);
      } else {
        const message = err.response?.data?.error || "Couldn't join the queue. Please try again.";
        showToast(message, { type: 'error' });
        if (err.response?.status === 403) setIsOpen(false);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-16">
      {/* Hero */}
      <section className="text-center">
        {config.heroImageUrl && (
          <img
            src={config.heroImageUrl}
            alt={config.shopName}
            className="w-full h-48 object-cover rounded-lg mb-8 border border-brass/20"
          />
        )}
        <h1 className="font-heading text-5xl sm:text-6xl text-cream leading-none mb-3">
          {config.shopName}
        </h1>
        {config.tagline && (
          <p className="text-cream-dim text-lg max-w-md mx-auto">{config.tagline}</p>
        )}
      </section>

      {/* Join form */}
      <section className="bg-charcoal-light border border-brass/20 rounded-lg p-6 sm:p-8">
        <h2 className="font-heading text-2xl text-brass mb-1">Get In Line</h2>
        <p className="text-cream-dim text-sm mb-6">Add your name, skip the waiting room.</p>

        {!isOpen && (
          <div className="mb-6 bg-barber-red/10 border border-barber-red/30 rounded-md p-4 text-center">
            <p className="text-barber-red-light font-heading text-xl">We're closed right now</p>
            <p className="text-cream-dim text-sm mt-1">Please check back during business hours to join the queue.</p>
          </div>
        )}

        <fieldset disabled={!isOpen || submitting} className="disabled:opacity-50">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-wide text-cream-dim mb-1">Your Name</label>
              <input
                type="text"
                placeholder="Jane Smith"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full p-3 bg-charcoal border border-cream-dim/30 rounded-md text-cream placeholder-cream-dim/40 focus:outline-none focus:ring-2 focus:ring-brass focus:border-brass transition-colors"
                required
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wide text-cream-dim mb-1">Phone Number</label>
              <input
                type="tel"
                placeholder="(555) 123-4567"
                value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
                className="w-full p-3 bg-charcoal border border-cream-dim/30 rounded-md text-cream placeholder-cream-dim/40 focus:outline-none focus:ring-2 focus:ring-brass focus:border-brass transition-colors"
                required
              />
            </div>
            <button
              type="submit"
              disabled={!isOpen || submitting}
              className="w-full bg-barber-red hover:bg-barber-red-light disabled:opacity-60 text-cream py-3.5 rounded-md font-heading text-xl tracking-wide transition-colors"
            >
              {submitting ? 'Joining…' : 'Get My Spot'}
            </button>
          </form>
        </fieldset>
      </section>

      {/* Meet the barbers */}
      {config.barbers && config.barbers.length > 0 && (
        <section>
          <h2 className="font-heading text-3xl text-brass mb-6 text-center">Meet the Team</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {config.barbers.map((barber) => (
              <div
                key={barber.name}
                className="bg-charcoal-light border border-brass/20 rounded-lg p-5 flex gap-4 items-start"
              >
                {barber.photoUrl ? (
                  <img
                    src={barber.photoUrl}
                    alt={barber.name}
                    className="h-24 w-24 rounded-full object-cover shrink-0 border-2 border-brass/40"
                  />
                ) : (
                  <InitialsAvatar name={barber.name} className="h-24 w-24 border-2 border-brass/40" />
                )}
                <div>
                  <h3 className="font-heading text-xl text-cream leading-tight">{barber.name}</h3>
                  {barber.title && <p className="text-brass text-xs uppercase tracking-wide mb-2">{barber.title}</p>}
                  {barber.bio && <p className="text-cream-dim text-sm leading-snug">{barber.bio}</p>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Gallery */}
      {config.galleryImages && config.galleryImages.length > 0 && (
        <section>
          <h2 className="font-heading text-3xl text-brass mb-6 text-center">The Shop</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {config.galleryImages.map((src) => (
              <img
                key={src}
                src={src}
                alt=""
                className="w-full h-32 object-cover rounded-md border border-brass/20"
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
