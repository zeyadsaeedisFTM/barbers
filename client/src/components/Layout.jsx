import { Link } from 'react-router-dom';
import { useEffect } from 'react';
import { useShopConfig } from '../hooks/useShopConfig';
import BarberPoleIcon from './BarberPoleIcon';

const SOCIAL_LABELS = { instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok' };

export default function Layout({ children }) {
  const config = useShopConfig();
  const socialEntries = Object.entries(config.socialLinks || {}).filter(([, url]) => url);
  const hoursEntries = Object.entries(config.hours || {});

  // Keep the browser tab title in sync with the configured shop name
  useEffect(() => {
    if (config.shopName) {
      document.title = `${config.shopName} — Queue`;
    }
  }, [config.shopName]);

  return (
    <div className="min-h-screen bg-charcoal text-cream flex flex-col">
      <header className="border-b border-brass/20 bg-charcoal-light">
        <div className="container mx-auto max-w-4xl px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            {config.logoUrl ? (
              <img src={config.logoUrl} alt={config.shopName} className="h-10 w-10 rounded-lg object-cover" />
            ) : (
              <BarberPoleIcon className="h-10 w-10 transition-transform group-hover:rotate-3" />
            )}
            <span className="font-heading text-2xl text-cream tracking-wide">{config.shopName}</span>
          </Link>
          <nav className="flex gap-6 text-sm font-medium">
            <Link to="/" className="text-cream-dim hover:text-brass transition-colors">Join Queue</Link>
            <Link to="/admin/login" className="text-cream-dim hover:text-brass transition-colors">Barber Login</Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 container mx-auto max-w-2xl px-4 py-8 w-full">
        {children}
      </main>

      <footer className="border-t border-brass/20 bg-charcoal-light mt-12">
        <div className="container mx-auto max-w-4xl px-4 py-8 grid grid-cols-1 sm:grid-cols-3 gap-8 text-sm">
          <div>
            <h3 className="font-heading text-lg text-brass mb-2">Visit Us</h3>
            {config.address && <p className="text-cream-dim">{config.address}</p>}
            {config.phone && <p className="text-cream-dim mt-1">{config.phone}</p>}
          </div>

          {hoursEntries.length > 0 && (
            <div>
              <h3 className="font-heading text-lg text-brass mb-2">Hours</h3>
              <ul className="text-cream-dim space-y-0.5">
                {hoursEntries.map(([day, hours]) => (
                  <li key={day} className="flex justify-between gap-4">
                    <span>{day}</span>
                    <span>{hours}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {socialEntries.length > 0 && (
            <div>
              <h3 className="font-heading text-lg text-brass mb-2">Follow</h3>
              <ul className="text-cream-dim space-y-0.5">
                {socialEntries.map(([key, url]) => (
                  <li key={key}>
                    <a href={url} target="_blank" rel="noreferrer" className="hover:text-brass transition-colors">
                      {SOCIAL_LABELS[key] || key}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}
