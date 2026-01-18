'use client';

import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'gold' | 'success' | 'error' | 'warning' | 'info';
  size?: 'sm' | 'md' | 'lg';
  dot?: boolean;
  pulse?: boolean;
}

const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', size = 'md', dot = false, pulse = false, children, ...props }, ref) => {
    const variants = {
      default: 'bg-[rgba(107,114,128,0.15)] text-[var(--text-secondary)] border-[var(--border-secondary)]',
      gold: 'bg-[var(--accent-primary-glow)] text-[var(--accent-primary)] border-[var(--accent-primary-muted)]',
      success: 'bg-[rgba(34,197,94,0.15)] text-[var(--success)] border-[var(--success-muted)]',
      error: 'bg-[rgba(239,68,68,0.15)] text-[var(--error)] border-[var(--error-muted)]',
      warning: 'bg-[rgba(245,158,11,0.15)] text-[var(--warning)] border-[var(--warning-muted)]',
      info: 'bg-[rgba(59,130,246,0.15)] text-[var(--info)] border-[rgba(59,130,246,0.3)]',
    };

    const sizes = {
      sm: 'px-2 py-0.5 text-[10px]',
      md: 'px-3 py-1 text-xs',
      lg: 'px-4 py-1.5 text-sm',
    };

    const dotColors: Record<string, string> = {
      default: 'bg-[var(--text-secondary)]',
      gold: 'bg-[var(--accent-primary)]',
      success: 'bg-[var(--success)]',
      error: 'bg-[var(--error)]',
      warning: 'bg-[var(--warning)]',
      info: 'bg-[var(--info)]',
    };

    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center gap-1.5',
          'font-semibold uppercase tracking-wide',
          'border',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {dot && (
          <span
            className={cn(
              'w-1.5 h-1.5',
              dotColors[variant],
              pulse && 'animate-pulse'
            )}
          />
        )}
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';

export { Badge };
