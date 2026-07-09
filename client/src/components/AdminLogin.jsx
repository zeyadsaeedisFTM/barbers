import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginBarber } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import BarberPoleIcon from './BarberPoleIcon';

export default function AdminLogin() {
  const [username, setUsername] = useState('barber');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await loginBarber({ username, password });
      login(res.data.token);
      navigate('/admin/dashboard');
    } catch (err) {
      setError('Invalid credentials');
    }
  };

  return (
    <div className="max-w-sm mx-auto mt-10 text-center">
      <BarberPoleIcon className="h-14 w-14 mx-auto mb-4" />
      <h2 className="font-heading text-3xl text-cream mb-6">Barber Login</h2>
      <div className="bg-charcoal-light border border-brass/20 rounded-lg p-6 text-left">
        {error && <p className="text-barber-red-light mb-3 text-sm">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-wide text-cream-dim mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full p-2.5 bg-charcoal border border-cream-dim/30 rounded-md text-cream focus:outline-none focus:ring-2 focus:ring-brass"
              required
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wide text-cream-dim mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full p-2.5 bg-charcoal border border-cream-dim/30 rounded-md text-cream focus:outline-none focus:ring-2 focus:ring-brass"
              required
            />
          </div>
          <button type="submit" className="w-full bg-barber-red hover:bg-barber-red-light text-cream py-2.5 rounded-md font-semibold transition-colors">
            Login
          </button>
        </form>
      </div>
    </div>
  );
}
