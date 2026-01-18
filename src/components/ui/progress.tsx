'use client';

import { forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

export interface ProgressBarProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number;
  max?: number;
  variant?: 'default' | 'gold' | 'success' | 'error';
  size?: 'sm' | 'md' | 'lg';
  showValue?: boolean;
  animated?: boolean;
}

const ProgressBar = forwardRef<HTMLDivElement, ProgressBarProps>(
  (
    {
      className,
      value,
      max = 100,
      variant = 'default',
      size = 'md',
      showValue = false,
      animated = true,
      ...props
    },
    ref
  ) => {
    const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

    const variants = {
      default: 'from-[var(--accent-primary-muted)] to-[var(--accent-primary)]',
      gold: 'from-[var(--accent-primary-muted)] to-[var(--accent-primary)]',
      success: 'from-[var(--success-muted)] to-[var(--success)]',
      error: 'from-[var(--error-muted)] to-[var(--error)]',
    };

    const sizes = {
      sm: 'h-1',
      md: 'h-2',
      lg: 'h-3',
    };

    return (
      <div className={cn('w-full', className)} {...props}>
        {showValue && (
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs text-[var(--text-tertiary)]">Progress</span>
            <span className="text-xs font-semibold text-[var(--text-primary)]">
              {percentage.toFixed(0)}%
            </span>
          </div>
        )}
        <div
          ref={ref}
          className={cn(
            'w-full bg-[var(--bg-elevated)] overflow-hidden',
            sizes[size]
          )}
        >
          <motion.div
            initial={animated ? { width: 0 } : { width: `${percentage}%` }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className={cn(
              'h-full bg-gradient-to-r',
              variants[variant]
            )}
          />
        </div>
      </div>
    );
  }
);

ProgressBar.displayName = 'ProgressBar';

export interface CircularProgressProps extends React.SVGAttributes<SVGSVGElement> {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  showValue?: boolean;
  variant?: 'default' | 'gold' | 'success' | 'error';
}

const CircularProgress = forwardRef<SVGSVGElement, CircularProgressProps>(
  (
    {
      className,
      value,
      max = 100,
      size = 80,
      strokeWidth = 8,
      showValue = true,
      variant = 'gold',
      ...props
    },
    ref
  ) => {
    const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (percentage / 100) * circumference;

    const colors = {
      default: 'var(--text-secondary)',
      gold: 'var(--accent-primary)',
      success: 'var(--success)',
      error: 'var(--error)',
    };

    return (
      <div className={cn('relative inline-flex', className)}>
        <svg
          ref={ref}
          width={size}
          height={size}
          className="transform -rotate-90"
          {...props}
        >
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--bg-elevated)"
            strokeWidth={strokeWidth}
          />
          {/* Progress circle */}
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={colors[variant]}
            strokeWidth={strokeWidth}
            strokeLinecap="square"
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            style={{
              strokeDasharray: circumference,
            }}
          />
        </svg>
        {showValue && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-sm font-bold text-[var(--text-primary)]">
              {percentage.toFixed(0)}%
            </span>
          </div>
        )}
      </div>
    );
  }
);

CircularProgress.displayName = 'CircularProgress';

export { ProgressBar, CircularProgress };
