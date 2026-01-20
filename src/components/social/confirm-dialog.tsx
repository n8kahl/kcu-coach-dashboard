'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Portal } from '@/components/ui/portal';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'default';
  isLoading?: boolean;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  isLoading = false,
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  const variantConfig = {
    danger: {
      iconBg: 'bg-[rgba(239,68,68,0.15)]',
      iconColor: 'text-[var(--error)]',
      confirmVariant: 'danger' as const,
    },
    warning: {
      iconBg: 'bg-[var(--accent-primary-glow)]',
      iconColor: 'text-[var(--accent-primary)]',
      confirmVariant: 'primary' as const,
    },
    default: {
      iconBg: 'bg-[var(--bg-elevated)]',
      iconColor: 'text-[var(--text-secondary)]',
      confirmVariant: 'primary' as const,
    },
  };

  const config = variantConfig[variant];

  return (
    <Portal>
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />

            {/* Dialog */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="relative z-10 w-full max-w-md mx-4"
            >
              <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] p-6 relative">
                {/* Close button */}
                <button
                  onClick={onClose}
                  className="absolute top-4 right-4 p-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                >
                <X className="w-5 h-5" />
              </button>

              {/* Icon */}
              <div className={cn('w-12 h-12 flex items-center justify-center mb-4', config.iconBg)}>
                <AlertTriangle className={cn('w-6 h-6', config.iconColor)} />
              </div>

              {/* Content */}
              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
                {title}
              </h3>
              <p className="text-sm text-[var(--text-secondary)] mb-6">
                {message}
              </p>

              {/* Actions */}
              <div className="flex items-center gap-3">
                <Button
                  variant="secondary"
                  onClick={onClose}
                  disabled={isLoading}
                  className="flex-1"
                >
                  {cancelLabel}
                </Button>
                <Button
                  variant={config.confirmVariant}
                  onClick={onConfirm}
                  loading={isLoading}
                  className="flex-1"
                >
                  {confirmLabel}
                </Button>
              </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </Portal>
  );
}
