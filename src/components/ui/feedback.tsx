'use client';

import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Loader2,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Info,
} from 'lucide-react';
import { Button } from './button';

/* =============================================================================
 * LOADING STATE COMPONENT
 * Production-ready loading indicator with multiple variants and accessibility
 * ============================================================================= */

export type LoadingVariant = 'spinner' | 'dots' | 'pulse' | 'skeleton';
export type LoadingSize = 'sm' | 'md' | 'lg' | 'xl';

interface LoadingStateProps {
  /** Loading indicator variant */
  variant?: LoadingVariant;
  /** Size of the loading indicator */
  size?: LoadingSize;
  /** Text to display below the loader */
  text?: string;
  /** Additional CSS classes */
  className?: string;
  /** Whether to show in full page mode (centered with min-height) */
  fullPage?: boolean;
  /** Custom aria-label for screen readers */
  'aria-label'?: string;
}

const sizeMap = {
  sm: { icon: 'w-4 h-4', text: 'text-xs', container: 'py-4' },
  md: { icon: 'w-6 h-6', text: 'text-sm', container: 'py-8' },
  lg: { icon: 'w-10 h-10', text: 'text-base', container: 'py-12' },
  xl: { icon: 'w-16 h-16', text: 'text-lg', container: 'py-16' },
};

/**
 * LoadingState - Unified loading indicator component
 *
 * @example
 * // Basic spinner
 * <LoadingState />
 *
 * @example
 * // Full page with custom text
 * <LoadingState fullPage text="Loading your dashboard..." size="lg" />
 *
 * @example
 * // Inline dots loader
 * <LoadingState variant="dots" size="sm" />
 */
export function LoadingState({
  variant = 'spinner',
  size = 'md',
  text,
  className,
  fullPage = false,
  'aria-label': ariaLabel,
}: LoadingStateProps) {
  const sizes = sizeMap[size];
  const label = ariaLabel || text || 'Loading content';

  const renderLoader = () => {
    switch (variant) {
      case 'dots':
        return (
          <div className="flex items-center gap-1.5" role="presentation">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className={cn(
                  'bg-[var(--accent-primary)]',
                  size === 'sm' ? 'w-1.5 h-1.5' : size === 'md' ? 'w-2 h-2' : 'w-3 h-3'
                )}
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.5, 1, 0.5],
                }}
                transition={{
                  duration: 0.8,
                  repeat: Infinity,
                  delay: i * 0.15,
                  ease: 'easeInOut',
                }}
              />
            ))}
          </div>
        );

      case 'pulse':
        return (
          <motion.div
            className={cn(
              'bg-[var(--accent-primary-glow)] border border-[var(--accent-primary)]',
              sizes.icon
            )}
            animate={{
              scale: [1, 1.1, 1],
              opacity: [0.5, 1, 0.5],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            role="presentation"
          />
        );

      case 'skeleton':
        return (
          <div className="w-full space-y-3" role="presentation">
            <div className="h-4 bg-[var(--bg-elevated)] skeleton w-3/4" />
            <div className="h-4 bg-[var(--bg-elevated)] skeleton w-full" />
            <div className="h-4 bg-[var(--bg-elevated)] skeleton w-2/3" />
          </div>
        );

      case 'spinner':
      default:
        return (
          <div className="relative" role="presentation">
            {/* Outer ring */}
            <div
              className={cn(
                'border-2 border-[var(--border-secondary)] opacity-30',
                sizes.icon
              )}
            />
            {/* Spinning accent */}
            <Loader2
              className={cn(
                'absolute inset-0 text-[var(--accent-primary)] animate-spin',
                sizes.icon
              )}
            />
          </div>
        );
    }
  };

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label}
      className={cn(
        'flex flex-col items-center justify-center',
        sizes.container,
        fullPage && 'min-h-[50vh]',
        className
      )}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2 }}
      >
        {renderLoader()}
      </motion.div>
      {text && (
        <motion.p
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.1 }}
          className={cn('text-[var(--text-tertiary)] mt-4', sizes.text)}
        >
          {text}
        </motion.p>
      )}
      {/* Screen reader announcement */}
      <span className="sr-only">{label}</span>
    </div>
  );
}

/* =============================================================================
 * ERROR STATE COMPONENT
 * Production-ready error display with retry functionality and variants
 * ============================================================================= */

export type ErrorSeverity = 'error' | 'warning' | 'info';

interface ErrorStateProps {
  /** Error title/heading */
  title?: string;
  /** Error message or description */
  message: string;
  /** Severity level affects icon and styling */
  severity?: ErrorSeverity;
  /** Retry callback - if provided, shows retry button */
  onRetry?: () => void;
  /** Custom retry button text */
  retryText?: string;
  /** Whether retry is currently in progress */
  isRetrying?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Whether to show in compact mode (inline) */
  compact?: boolean;
  /** Custom action component */
  action?: React.ReactNode;
}

const severityConfig = {
  error: {
    icon: XCircle,
    iconColor: 'text-[var(--error)]',
    bgColor: 'bg-[var(--error)]/10',
    borderColor: 'border-[var(--error)]/30',
  },
  warning: {
    icon: AlertTriangle,
    iconColor: 'text-[var(--warning)]',
    bgColor: 'bg-[var(--warning)]/10',
    borderColor: 'border-[var(--warning)]/30',
  },
  info: {
    icon: Info,
    iconColor: 'text-[var(--info)]',
    bgColor: 'bg-[var(--info)]/10',
    borderColor: 'border-[var(--info)]/30',
  },
};

/**
 * ErrorState - Unified error display component
 *
 * @example
 * // Basic error
 * <ErrorState message="Failed to load data" onRetry={refetch} />
 *
 * @example
 * // Warning with custom title
 * <ErrorState
 *   severity="warning"
 *   title="Connection Issue"
 *   message="Unable to connect to server. Your changes may not be saved."
 * />
 *
 * @example
 * // Compact inline error
 * <ErrorState message="Invalid input" compact />
 */
export function ErrorState({
  title,
  message,
  severity = 'error',
  onRetry,
  retryText = 'Try Again',
  isRetrying = false,
  className,
  compact = false,
  action,
}: ErrorStateProps) {
  const config = severityConfig[severity];
  const Icon = config.icon;

  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 10 }}
        role="alert"
        aria-live="assertive"
        className={cn(
          'flex items-center gap-2 p-2 text-sm border',
          config.bgColor,
          config.borderColor,
          className
        )}
      >
        <Icon className={cn('w-4 h-4 flex-shrink-0', config.iconColor)} aria-hidden="true" />
        <span className="text-[var(--text-primary)]">{message}</span>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      role="alert"
      aria-live="assertive"
      className={cn(
        'flex flex-col items-center justify-center py-12 text-center',
        className
      )}
    >
      <motion.div
        initial={{ scale: 0.8 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
        className={cn(
          'w-16 h-16 flex items-center justify-center mb-4 border',
          config.bgColor,
          config.borderColor
        )}
      >
        <Icon className={cn('w-8 h-8', config.iconColor)} aria-hidden="true" />
      </motion.div>

      {title && (
        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
          {title}
        </h3>
      )}

      <p className="text-sm text-[var(--text-secondary)] max-w-md mb-6">
        {message}
      </p>

      {(onRetry || action) && (
        <div className="flex items-center gap-3">
          {onRetry && (
            <Button
              variant="secondary"
              onClick={onRetry}
              disabled={isRetrying}
              loading={isRetrying}
              icon={<RefreshCw className="w-4 h-4" />}
            >
              {retryText}
            </Button>
          )}
          {action}
        </div>
      )}
    </motion.div>
  );
}

/* =============================================================================
 * SUCCESS STATE COMPONENT
 * For completion confirmations
 * ============================================================================= */

interface SuccessStateProps {
  /** Success title/heading */
  title?: string;
  /** Success message */
  message: string;
  /** Additional CSS classes */
  className?: string;
  /** Custom action component */
  action?: React.ReactNode;
}

/**
 * SuccessState - Display success/completion state
 *
 * @example
 * <SuccessState
 *   title="Trade Recorded!"
 *   message="Your trade has been saved to your journal."
 *   action={<Button onClick={onClose}>Close</Button>}
 * />
 */
export function SuccessState({
  title,
  message,
  className,
  action,
}: SuccessStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      role="status"
      aria-live="polite"
      className={cn(
        'flex flex-col items-center justify-center py-12 text-center',
        className
      )}
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{
          type: 'spring',
          stiffness: 200,
          damping: 10,
          delay: 0.1
        }}
        className="w-16 h-16 flex items-center justify-center mb-4 bg-[var(--success)]/10 border border-[var(--success)]/30"
      >
        <CheckCircle className="w-8 h-8 text-[var(--success)]" aria-hidden="true" />
      </motion.div>

      {title && (
        <motion.h3
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-lg font-semibold text-[var(--text-primary)] mb-2"
        >
          {title}
        </motion.h3>
      )}

      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="text-sm text-[var(--text-secondary)] max-w-md mb-6"
      >
        {message}
      </motion.p>

      {action && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          {action}
        </motion.div>
      )}
    </motion.div>
  );
}

/* =============================================================================
 * INLINE LOADING INDICATOR
 * For buttons and small inline loading states
 * ============================================================================= */

interface InlineLoaderProps {
  /** Size of the loader */
  size?: 'xs' | 'sm' | 'md';
  /** Color variant */
  color?: 'default' | 'gold' | 'white';
  /** Additional CSS classes */
  className?: string;
}

const inlineSizeMap = {
  xs: 'w-3 h-3',
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
};

const inlineColorMap = {
  default: 'text-current',
  gold: 'text-[var(--accent-primary)]',
  white: 'text-white',
};

/**
 * InlineLoader - Small loading spinner for inline use
 *
 * @example
 * <Button disabled>
 *   <InlineLoader size="sm" /> Saving...
 * </Button>
 */
export function InlineLoader({
  size = 'sm',
  color = 'default',
  className
}: InlineLoaderProps) {
  return (
    <Loader2
      className={cn(
        'animate-spin',
        inlineSizeMap[size],
        inlineColorMap[color],
        className
      )}
      aria-hidden="true"
    />
  );
}

/* =============================================================================
 * SKELETON COMPONENTS
 * For content placeholder loading states
 * ============================================================================= */

interface SkeletonProps {
  /** Additional CSS classes */
  className?: string;
  /** Skeleton variant */
  variant?: 'text' | 'circular' | 'rectangular';
  /** Width (CSS value) */
  width?: string | number;
  /** Height (CSS value) */
  height?: string | number;
  /** Number of lines for text variant */
  lines?: number;
}

/**
 * Skeleton - Loading placeholder component
 *
 * @example
 * // Text skeleton with 3 lines
 * <Skeleton variant="text" lines={3} />
 *
 * @example
 * // Avatar skeleton
 * <Skeleton variant="circular" width={40} height={40} />
 *
 * @example
 * // Card skeleton
 * <Skeleton variant="rectangular" height={200} />
 */
export function Skeleton({
  className,
  variant = 'rectangular',
  width,
  height,
  lines = 1,
}: SkeletonProps) {
  const baseClass = 'skeleton bg-[var(--bg-elevated)]';

  const style: React.CSSProperties = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
  };

  if (variant === 'text') {
    return (
      <div className={cn('space-y-2', className)} role="presentation" aria-hidden="true">
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={cn(baseClass, 'h-4')}
            style={{
              width: i === lines - 1 ? '75%' : '100%',
              ...style
            }}
          />
        ))}
      </div>
    );
  }

  if (variant === 'circular') {
    return (
      <div
        className={cn(baseClass, 'rounded-full', className)}
        style={{
          width: width || height || 40,
          height: height || width || 40,
          ...style
        }}
        role="presentation"
        aria-hidden="true"
      />
    );
  }

  return (
    <div
      className={cn(baseClass, className)}
      style={style}
      role="presentation"
      aria-hidden="true"
    />
  );
}

/* =============================================================================
 * SKELETON PRESETS
 * Common skeleton patterns for quick use
 * ============================================================================= */

/**
 * SkeletonCard - Preset skeleton for card loading
 */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'p-4 border border-[var(--border-primary)] bg-[var(--bg-card)]',
        className
      )}
      role="presentation"
      aria-hidden="true"
    >
      <div className="flex items-center gap-3 mb-4">
        <Skeleton variant="circular" width={40} height={40} />
        <div className="flex-1 space-y-2">
          <Skeleton height={14} width="60%" />
          <Skeleton height={12} width="40%" />
        </div>
      </div>
      <Skeleton variant="text" lines={3} />
      <div className="flex gap-2 mt-4">
        <Skeleton height={32} width={80} />
        <Skeleton height={32} width={80} />
      </div>
    </div>
  );
}

/**
 * SkeletonTable - Preset skeleton for table loading
 */
export function SkeletonTable({
  rows = 5,
  columns = 4,
  className
}: {
  rows?: number;
  columns?: number;
  className?: string;
}) {
  return (
    <div
      className={cn('space-y-3', className)}
      role="presentation"
      aria-hidden="true"
    >
      {/* Header */}
      <div className="flex gap-4 pb-3 border-b border-[var(--border-primary)]">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} height={12} className="flex-1" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          className="flex gap-4 py-2"
        >
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton
              key={colIndex}
              height={16}
              className="flex-1"
              width={colIndex === 0 ? '80%' : '100%'}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * SkeletonStats - Preset skeleton for stat cards
 */
export function SkeletonStats({
  count = 4,
  className
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div
      className={cn('grid grid-cols-2 md:grid-cols-4 gap-4', className)}
      role="presentation"
      aria-hidden="true"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="p-4 border border-[var(--border-primary)] bg-[var(--bg-card)]"
        >
          <Skeleton height={12} width="50%" className="mb-2" />
          <Skeleton height={28} width="70%" />
        </div>
      ))}
    </div>
  );
}

/* =============================================================================
 * PREMIUM SKELETON PRESETS
 * Trading-specific skeleton patterns
 * ============================================================================= */

/**
 * SkeletonChart - Skeleton for chart/graph loading
 */
export function SkeletonChart({
  className,
  height = 300,
}: {
  className?: string;
  height?: number;
}) {
  return (
    <div
      className={cn(
        'p-4 border border-[var(--border-primary)] bg-[var(--bg-card)]',
        className
      )}
      role="presentation"
      aria-hidden="true"
    >
      {/* Chart header */}
      <div className="flex justify-between items-center mb-4">
        <div className="space-y-2">
          <Skeleton height={16} width={120} />
          <Skeleton height={12} width={80} />
        </div>
        <div className="flex gap-2">
          <Skeleton height={28} width={60} />
          <Skeleton height={28} width={60} />
          <Skeleton height={28} width={60} />
        </div>
      </div>
      {/* Chart area */}
      <div
        className="relative bg-[var(--bg-elevated)] overflow-hidden"
        style={{ height }}
      >
        {/* Fake chart bars */}
        <div className="absolute bottom-0 left-0 right-0 flex items-end justify-around gap-1 p-4">
          {[40, 65, 45, 80, 55, 70, 90, 60, 75, 50, 85, 45].map((h, i) => (
            <div
              key={i}
              className="skeleton flex-1 max-w-8"
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
        {/* Y-axis lines */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
          {[0, 1, 2, 3, 4].map((_, i) => (
            <div
              key={i}
              className="border-t border-[var(--border-secondary)] opacity-30"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * SkeletonTradeRow - Skeleton for trade journal rows
 */
export function SkeletonTradeRow({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex items-center gap-4 p-4 border border-[var(--border-primary)] bg-[var(--bg-card)]',
        className
      )}
      role="presentation"
      aria-hidden="true"
    >
      {/* Symbol & direction */}
      <div className="flex items-center gap-3 min-w-[140px]">
        <Skeleton variant="circular" width={36} height={36} />
        <div className="space-y-1">
          <Skeleton height={14} width={60} />
          <Skeleton height={10} width={40} />
        </div>
      </div>
      {/* Entry/Exit */}
      <div className="flex-1 flex gap-8">
        <div className="space-y-1">
          <Skeleton height={10} width={40} />
          <Skeleton height={14} width={60} />
        </div>
        <div className="space-y-1">
          <Skeleton height={10} width={40} />
          <Skeleton height={14} width={60} />
        </div>
      </div>
      {/* P&L */}
      <div className="text-right space-y-1 min-w-[80px]">
        <Skeleton height={16} width={70} className="ml-auto" />
        <Skeleton height={10} width={50} className="ml-auto" />
      </div>
      {/* Actions */}
      <div className="flex gap-2">
        <Skeleton height={32} width={32} />
        <Skeleton height={32} width={32} />
      </div>
    </div>
  );
}

/**
 * SkeletonLeaderboard - Skeleton for leaderboard entries
 */
export function SkeletonLeaderboard({
  count = 5,
  className
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'p-4 border border-[var(--border-primary)] bg-[var(--bg-card)]',
        className
      )}
      role="presentation"
      aria-hidden="true"
    >
      <div className="flex items-center justify-between mb-4">
        <Skeleton height={18} width={120} />
        <Skeleton height={12} width={80} />
      </div>
      <div className="space-y-3">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton height={14} width={20} />
            <Skeleton variant="circular" width={32} height={32} />
            <div className="flex-1 space-y-1">
              <Skeleton height={12} width="60%" />
              <Skeleton height={10} width="40%" />
            </div>
            <Skeleton height={14} width={50} />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * SkeletonAchievement - Skeleton for achievement cards
 */
export function SkeletonAchievement({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'p-4 border border-[var(--border-primary)] bg-[var(--bg-card)]',
        className
      )}
      role="presentation"
      aria-hidden="true"
    >
      <div className="flex items-start gap-4">
        <Skeleton
          variant="rectangular"
          width={64}
          height={64}
          className="flex-shrink-0"
        />
        <div className="flex-1 space-y-2">
          <Skeleton height={16} width="70%" />
          <Skeleton height={12} width="90%" />
          <div className="flex items-center gap-2 mt-3">
            <Skeleton height={8} className="flex-1" />
            <Skeleton height={12} width={40} />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * SkeletonLessonCard - Skeleton for learning module cards
 */
export function SkeletonLessonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'p-4 border border-[var(--border-primary)] bg-[var(--bg-card)]',
        className
      )}
      role="presentation"
      aria-hidden="true"
    >
      {/* Thumbnail */}
      <Skeleton height={160} className="mb-4" />
      {/* Title & description */}
      <div className="space-y-2 mb-4">
        <Skeleton height={18} width="80%" />
        <Skeleton height={12} width="100%" />
        <Skeleton height={12} width="60%" />
      </div>
      {/* Progress */}
      <div className="flex items-center gap-2 mb-3">
        <Skeleton height={6} className="flex-1" />
        <Skeleton height={12} width={35} />
      </div>
      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-[var(--border-primary)]">
        <div className="flex items-center gap-2">
          <Skeleton variant="circular" width={20} height={20} />
          <Skeleton height={12} width={60} />
        </div>
        <Skeleton height={28} width={80} />
      </div>
    </div>
  );
}

/**
 * SkeletonWatchlist - Skeleton for watchlist/market data
 */
export function SkeletonWatchlist({
  count = 4,
  className
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'p-4 border border-[var(--border-primary)] bg-[var(--bg-card)]',
        className
      )}
      role="presentation"
      aria-hidden="true"
    >
      <div className="flex items-center justify-between mb-4">
        <Skeleton height={16} width={100} />
        <Skeleton height={28} width={28} />
      </div>
      <div className="space-y-2">
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between p-3 bg-[var(--bg-elevated)]"
          >
            <div className="flex items-center gap-3">
              <Skeleton variant="circular" width={28} height={28} />
              <div className="space-y-1">
                <Skeleton height={14} width={50} />
                <Skeleton height={10} width={70} />
              </div>
            </div>
            <div className="text-right space-y-1">
              <Skeleton height={14} width={60} />
              <Skeleton height={10} width={40} className="ml-auto" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * SkeletonDashboard - Full dashboard skeleton for initial load
 */
export function SkeletonDashboard({ className }: { className?: string }) {
  return (
    <div
      className={cn('space-y-6', className)}
      role="presentation"
      aria-hidden="true"
    >
      {/* Stats row */}
      <SkeletonStats count={4} />

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column - 2/3 width */}
        <div className="lg:col-span-2 space-y-6">
          <SkeletonChart height={250} />
          <div className="space-y-3">
            <SkeletonTradeRow />
            <SkeletonTradeRow />
            <SkeletonTradeRow />
          </div>
        </div>

        {/* Right column - 1/3 width */}
        <div className="space-y-6">
          <SkeletonLeaderboard count={5} />
          <SkeletonAchievement />
        </div>
      </div>
    </div>
  );
}
