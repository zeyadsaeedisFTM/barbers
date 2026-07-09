import { createContext, useContext, useEffect, useState } from 'react';
import io from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext();

export function SocketProvider({ children }) {
  const [socket, setSocket] = useState(null);
  const [serverTimeOffset, setServerTimeOffset] = useState(0);
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    const newSocket = io(import.meta.env.VITE_API_URL || 'http://localhost:5000');
    newSocket.on('connect', () => console.log('Socket connected'));
    newSocket.on('serverTime', ({ serverTime }) => {
      setServerTimeOffset(serverTime - Date.now());
    });
    setSocket(newSocket);
    return () => newSocket.close();
  }, []);

  useEffect(() => {
    if (socket && isAuthenticated) {
      socket.emit('joinAdmin');
    }
  }, [socket, isAuthenticated]);

  return (
    <SocketContext.Provider value={{ socket, serverTimeOffset }}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => useContext(SocketContext);