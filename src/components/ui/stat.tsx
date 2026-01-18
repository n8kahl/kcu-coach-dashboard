'use client';

import { forwardRef } from 'react';
import { cn, getPnLColor } from '@/lib/utils';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export interface StatProps {
  label: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon?: React.ReactNode;
  variant?: 'default' | 'large' | 'compact';
  valueColor?: 'default' | 'profit' | 'loss' | 'gold';
  className?: string;
}

const Stat = forwardRef<HTMLDivElement, StatProps>(
  (
    {
      className,
      label,
      value,
      change,
      changeLabel,
      icon,
      variant = 'default',
      valueColor = 'default',
    },
    ref
  ) => {
    const valueColors = {
      default: 'text-[var(--text-primary)]',
      profit: 'text-[var(--profit)]',
      loss: 'text-[var(--loss)]',
      gold: 'text-[var(--accent-primary)]',
    };

    const valueSizes = {
      default: 'text-2xl',
      large: 'text-4xl',
      compact: 'text-xl',
    };

    const TrendIcon = change === undefined ? null : change > 0 ? TrendingUp : change < 0 ? TrendingDown : Minus;

    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn('flex flex-col gap-1', className)}
      >
        <div className="flex items-center gap-2">
          {icon && (
            <span className="text-[var(--text-tertiary)]">{icon}</span>
          )}
          <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
            {label}
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className={cn(
              'font-bold tabular-nums',
              valueSizes[variant],
              valueColors[valueColor]
            )}
          >
            {value}
          </motion.span>
          {change !== undefined && (
            <span
              className={cn(
                'flex items-center gap-0.5 text-xs font-medium',
                getPnLColor(change)
              )}
            >
              {TrendIcon && <TrendIcon className="w-3 h-3" />}
              {change > 0 ? '+' : ''}{change.toFixed(2)}%
              {changeLabel && (
                <span className="text-[var(--text-tertiary)] ml-1">{changeLabel}</span>
              )}
            </span>
          )}
        </div>
      </motion.div>
    );
  }
);

Stat.displayName = 'Stat';

export interface StatGridProps extends React.HTMLAttributes<HTMLDivElement> {
  columns?: 2 | 3 | 4 | 5 | 6;
}

const StatGrid = forwardRef<HTMLDivElement, StatGridProps>(
  ({ className, columns = 4, children, ...props }, ref) => {
    const gridCols = {
      2: 'grid-cols-2',
      3: 'grid-cols-3',
      4: 'grid-cols-2 md:grid-cols-4',
      5: 'grid-cols-2 md:grid-cols-5',
      6: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-6',
    };

    return (
      <div
        ref={ref}
        className={cn('grid gap-4', gridCols[columns], className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);

StatGrid.displayName = 'StatGrid';

export { Stat, StatGrid };
