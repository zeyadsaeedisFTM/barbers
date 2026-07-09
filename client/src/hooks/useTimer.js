import { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';

export function useTimer(calledAt, durationMinutes = 15) {
  const { serverTimeOffset } = useSocket();
  const [remainingSeconds, setRemainingSeconds] = useState(null);

  useEffect(() => {
    if (!calledAt) {
      setRemainingSeconds(null);
      return;
    }
    const endTime = new Date(calledAt).getTime() + durationMinutes * 60 * 1000;

    const update = () => {
      const now = Date.now() + serverTimeOffset;
      const left = Math.max(0, Math.floor((endTime - now) / 1000));
      setRemainingSeconds(left);
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [calledAt, durationMinutes, serverTimeOffset]);

  return remainingSeconds;
}