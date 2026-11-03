import React, { createContext, useContext, useState, useCallback } from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  durationMs?: number;
}

export interface ToastOptions {
  title: string;
  description?: string;
  message?: string;
  variant?: 'default' | 'success' | 'destructive' | 'warning' | 'info';
  type?: ToastType;
  durationMs?: number;
}

export type ToastFunction = (options: ToastOptions) => void;

interface ToastContextType {
  toasts: ToastItem[];
  toast: ToastFunction;
  addToast: (toast: Omit<ToastItem, 'id'>) => void;
  removeToast: (id: string) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((toast: Omit<ToastItem, 'id'>) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const duration = toast.durationMs || 4500;

    setToasts((prev) => [...prev, { ...toast, id }]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [removeToast]);

  const toast = useCallback((options: ToastOptions) => {
    let type: ToastType = 'info';
    if (options.variant === 'destructive') type = 'error';
    else if (options.variant === 'success') type = 'success';
    else if (options.variant === 'warning') type = 'warning';
    else if (options.type) type = options.type;

    addToast({
      title: options.title,
      message: options.description || options.message,
      type,
      durationMs: options.durationMs,
    });
  }, [addToast]);

  const success = useCallback((title: string, message?: string) => {
    addToast({ type: 'success', title, message });
  }, [addToast]);

  const error = useCallback((title: string, message?: string) => {
    addToast({ type: 'error', title, message });
  }, [addToast]);

  const info = useCallback((title: string, message?: string) => {
    addToast({ type: 'info', title, message });
  }, [addToast]);

  const warning = useCallback((title: string, message?: string) => {
    addToast({ type: 'warning', title, message });
  }, [addToast]);

  return (
    <ToastContext.Provider value={{ toasts, toast, addToast, removeToast, success, error, info, warning }}>
      {children}
      {/* Toast container overlay */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-md w-full pointer-events-none px-4 sm:px-0">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-lg border shadow-lg transition-all transform animate-in slide-in-from-bottom-5 duration-200 ${
              t.type === 'success'
                ? 'bg-emerald-50 text-emerald-950 border-emerald-200 dark:bg-emerald-950/80 dark:text-emerald-100 dark:border-emerald-800'
                : t.type === 'error'
                ? 'bg-rose-50 text-rose-950 border-rose-200 dark:bg-rose-950/80 dark:text-rose-100 dark:border-rose-800'
                : t.type === 'warning'
                ? 'bg-amber-50 text-amber-950 border-amber-200 dark:bg-amber-950/80 dark:text-amber-100 dark:border-amber-800'
                : 'bg-blue-50 text-blue-950 border-blue-200 dark:bg-blue-950/80 dark:text-blue-100 dark:border-blue-800'
            }`}
          >
            <div className="flex-1">
              <p className="font-semibold text-sm leading-tight">{t.title}</p>
              {t.message && <p className="text-xs mt-1 opacity-90 leading-normal">{t.message}</p>}
            </div>
            <button
              onClick={() => removeToast(t.id)}
              className="text-xs opacity-60 hover:opacity-100 focus:outline-none p-1"
              aria-label="Dismiss toast"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextType {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}

