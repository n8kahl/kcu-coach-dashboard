'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { CheckCircle, XCircle, AlertTriangle, Info, X, Loader2 } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info' | 'loading';

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  persistent?: boolean; // For loading toasts that shouldn't auto-dismiss
}

interface ToastContextType {
  showToast: (toast: Omit<Toast, 'id'>) => string;
  dismissToast: (id: string) => void;
  updateToast: (id: string, updates: Partial<Omit<Toast, 'id'>>) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

const toastConfig: Record<ToastType, {
  icon: React.FC<{ className?: string }>;
  bgColor: string;
  iconColor: string;
  borderColor: string;
}> = {
  success: {
    icon: CheckCircle,
    bgColor: 'bg-[var(--bg-card)]',
    iconColor: 'text-[var(--profit)]',
    borderColor: 'border-l-[var(--profit)]',
  },
  error: {
    icon: XCircle,
    bgColor: 'bg-[var(--bg-card)]',
    iconColor: 'text-[var(--error)]',
    borderColor: 'border-l-[var(--error)]',
  },
  warning: {
    icon: AlertTriangle,
    bgColor: 'bg-[var(--bg-card)]',
    iconColor: 'text-[var(--accent-primary)]',
    borderColor: 'border-l-[var(--accent-primary)]',
  },
  info: {
    icon: Info,
    bgColor: 'bg-[var(--bg-card)]',
    iconColor: 'text-[var(--accent-secondary)]',
    borderColor: 'border-l-[var(--accent-secondary)]',
  },
  loading: {
    icon: ({ className }) => <Loader2 className={cn(className, 'animate-spin')} />,
    bgColor: 'bg-[var(--bg-card)]',
    iconColor: 'text-[var(--accent-primary)]',
    borderColor: 'border-l-[var(--accent-primary)]',
  },
};

interface ToastProviderProps {
  children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substring(7);
    const newToast: Toast = { ...toast, id };

    setToasts((prev) => [...prev, newToast]);

    // Auto dismiss after duration (default 5 seconds) unless persistent
    if (!toast.persistent && toast.type !== 'loading') {
      const duration = toast.duration ?? 5000;
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }

    return id;
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const updateToast = useCallback((id: string, updates: Partial<Omit<Toast, 'id'>>) => {
    setToasts((prev) =>
      prev.map((t) => {
        if (t.id === id) {
          const updated = { ...t, ...updates };
          // If updating from loading to something else, set up auto-dismiss
          if (t.type === 'loading' && updates.type && updates.type !== 'loading') {
            const duration = updates.duration ?? 5000;
            setTimeout(() => {
              setToasts((prev) => prev.filter((toast) => toast.id !== id));
            }, duration);
          }
          return updated;
        }
        return t;
      })
    );
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, dismissToast, updateToast }}>
      {children}

      {/* Toast container */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-md pointer-events-none">
        <AnimatePresence mode="popLayout">
          {toasts.map((toast) => {
            const config = toastConfig[toast.type];
            const Icon = config.icon;

            return (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, x: 100, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 100, scale: 0.9 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                className={cn(
                  'flex items-start gap-3 p-4 pointer-events-auto',
                  'border border-[var(--border-primary)] border-l-4 rounded-lg',
                  config.bgColor,
                  config.borderColor,
                  'shadow-xl backdrop-blur-sm'
                )}
              >
                <Icon className={cn('w-5 h-5 flex-shrink-0 mt-0.5', config.iconColor)} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    {toast.title}
                  </p>
                  {toast.message && (
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5 whitespace-pre-wrap">
                      {toast.message}
                    </p>
                  )}
                </div>
                {toast.type !== 'loading' && (
                  <button
                    onClick={() => dismissToast(toast.id)}
                    className="p-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
