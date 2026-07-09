import { createContext, useCallback, useContext, useRef, useState } from 'react';

const ToastContext = createContext();

let idCounter = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    if (timers.current[id]) {
      clearTimeout(timers.current[id]);
      delete timers.current[id];
    }
  }, []);

  const showToast = useCallback((message, { type = 'info', duration = 6000 } = {}) => {
    const id = ++idCounter;
    setToasts((prev) => [...prev, { id, message, type }]);
    timers.current[id] = setTimeout(() => dismissToast(id), duration);
    return id;
  }, [dismissToast]);

  return (
    <ToastContext.Provider value={{ showToast, dismissToast }}>
      {children}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-3 w-[min(360px,calc(100vw-2rem))]">
        {toasts.map((t) => (
          <div
            key={t.id}
            onClick={() => dismissToast(t.id)}
            className={`animate-toast-in cursor-pointer rounded-md border-l-4 bg-charcoal-light px-4 py-3 shadow-lg
              ${t.type === 'success' ? 'border-brass' : ''}
              ${t.type === 'error' ? 'border-barber-red' : ''}
              ${t.type === 'info' ? 'border-cream-dim' : ''}
            `}
          >
            <p className="text-sm text-cream leading-snug">{t.message}</p>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
