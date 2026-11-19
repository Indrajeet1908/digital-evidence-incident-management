import React, { createContext, useContext, useState, useCallback } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = 'info') => {
      const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      setToasts((prev) => [...prev, { id, type, message }]);
      setTimeout(() => {
        removeToast(id);
      }, 4500);
    },
    [removeToast]
  );

  const success = useCallback((msg: string) => showToast(msg, 'success'), [showToast]);
  const error = useCallback((msg: string) => showToast(msg, 'error'), [showToast]);
  const warning = useCallback((msg: string) => showToast(msg, 'warning'), [showToast]);
  const info = useCallback((msg: string) => showToast(msg, 'info'), [showToast]);

  return (
    <ToastContext.Provider value={{ showToast, success, error, warning, info }}>
      {children}
      {/* Toast floating container */}
      <div
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-md w-full pointer-events-none p-2"
        aria-live="polite"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start justify-between gap-3 p-3.5 rounded-xl border shadow-xl text-xs backdrop-blur-md transition-all animate-in fade-in slide-in-from-bottom-2 duration-200 ${
              toast.type === 'success'
                ? 'bg-emerald-50 dark:bg-slate-900/95 border-emerald-300 dark:border-emerald-500/50 text-emerald-900 dark:text-emerald-200 shadow-emerald-500/10 dark:shadow-emerald-950/40'
                : toast.type === 'error'
                ? 'bg-rose-50 dark:bg-slate-900/95 border-rose-300 dark:border-rose-500/50 text-rose-900 dark:text-rose-200 shadow-rose-500/10 dark:shadow-rose-950/40'
                : toast.type === 'warning'
                ? 'bg-amber-50 dark:bg-slate-900/95 border-amber-300 dark:border-amber-500/50 text-amber-900 dark:text-amber-200 shadow-amber-500/10 dark:shadow-amber-950/40'
                : 'bg-indigo-50 dark:bg-slate-900/95 border-indigo-300 dark:border-indigo-500/50 text-indigo-900 dark:text-indigo-200 shadow-indigo-500/10 dark:shadow-indigo-950/40'
            }`}
          >
            <div className="flex items-start gap-2.5">
              <span className="text-sm shrink-0 font-bold">
                {toast.type === 'success' && '✓'}
                {toast.type === 'error' && '✕'}
                {toast.type === 'warning' && '⚠️'}
                {toast.type === 'info' && 'ℹ️'}
              </span>
              <p className="font-medium leading-relaxed">{toast.message}</p>
            </div>
            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              className="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white shrink-0 cursor-pointer p-0.5 rounded focus:outline-none focus:ring-1 focus:ring-slate-500"
              aria-label="Close notification"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
