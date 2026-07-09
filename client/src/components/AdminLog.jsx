import { useEffect, useState } from 'react';
import { getAdminLog } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';

export default function AdminLog() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [log, setLog] = useState({ served: [], noShows: [] });
  const { socket } = useSocket();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/admin/login');
      return;
    }
    const fetchLog = () => getAdminLog().then(res => setLog(res.data)).catch(() => {});
    fetchLog();

    if (socket) {
      socket.on('queueState', fetchLog);
      return () => {
        socket.off('queueState', fetchLog);
      };
    }
  }, [isAuthenticated, socket, navigate]);

  return (
    <div>
      <h2 className="font-heading text-3xl text-cream mb-6">Service Log</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-charcoal-light border border-brass/20 rounded-lg p-4">
          <h3 className="font-heading text-xl text-brass mb-2">Served ({log.served.length})</h3>
          {log.served.length === 0 && <p className="text-cream-dim text-sm">Nothing yet today.</p>}
          {log.served.map(c => (
            <div key={c._id} className="text-sm border-b border-cream-dim/10 py-2 flex justify-between">
              <span className="text-cream font-medium">{c.name}</span>
              <span className="text-cream-dim">{new Date(c.calledAt).toLocaleTimeString()}</span>
            </div>
          ))}
        </div>
        <div className="bg-charcoal-light border border-brass/20 rounded-lg p-4">
          <h3 className="font-heading text-xl text-barber-red-light mb-2">No-Shows ({log.noShows.length})</h3>
          {log.noShows.length === 0 && <p className="text-cream-dim text-sm">None yet today.</p>}
          {log.noShows.map(c => (
            <div key={c._id} className="text-sm border-b border-cream-dim/10 py-2 flex justify-between">
              <span className="text-cream font-medium">{c.name}</span>
              <span className="text-cream-dim">{new Date(c.calledAt).toLocaleTimeString()}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
