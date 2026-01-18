'use client';

import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface PageShellProps {
  children: React.ReactNode;
  className?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export function PageShell({
  children,
  className,
  maxWidth = 'full',
  padding = 'md',
}: PageShellProps) {
  const maxWidths = {
    sm: 'max-w-2xl',
    md: 'max-w-4xl',
    lg: 'max-w-6xl',
    xl: 'max-w-7xl',
    full: 'max-w-full',
  };

  const paddings = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className={cn(
        'min-h-screen',
        maxWidths[maxWidth],
        paddings[padding],
        'mx-auto',
        className
      )}
    >
      {children}
    </motion.main>
  );
}

interface PageSectionProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  description?: string;
  action?: React.ReactNode;
}

export function PageSection({
  children,
  className,
  title,
  description,
  action,
}: PageSectionProps) {
  return (
    <section className={cn('mb-8', className)}>
      {(title || action) && (
        <div className="flex items-center justify-between mb-4">
          <div>
            {title && (
              <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-primary)]">
                {title}
              </h2>
            )}
            {description && (
              <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{description}</p>
            )}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

interface GridProps {
  children: React.ReactNode;
  className?: string;
  cols?: 1 | 2 | 3 | 4 | 5 | 6;
  gap?: 'sm' | 'md' | 'lg';
}

export function Grid({ children, className, cols = 3, gap = 'md' }: GridProps) {
  const colsMap = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
    5: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-5',
    6: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-6',
  };

  const gaps = {
    sm: 'gap-3',
    md: 'gap-4',
    lg: 'gap-6',
  };

  return (
    <div className={cn('grid', colsMap[cols], gaps[gap], className)}>
      {children}
    </div>
  );
}

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icon && (
        <div className="w-16 h-16 mb-4 flex items-center justify-center text-[var(--text-tertiary)]">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-[var(--text-tertiary)] max-w-md mb-4">{description}</p>
      )}
      {action}
    </div>
  );
}

// Re-export the unified feedback components for backward compatibility
// These enhanced versions provide better accessibility, animations, and variants
export {
  LoadingState,
  ErrorState,
  SuccessState,
  Skeleton,
  SkeletonCard,
  SkeletonTable,
  SkeletonStats,
  // Premium skeleton presets for trading dashboard
  SkeletonChart,
  SkeletonTradeRow,
  SkeletonLeaderboard,
  SkeletonAchievement,
  SkeletonLessonCard,
  SkeletonWatchlist,
  SkeletonDashboard,
} from '@/components/ui/feedback';
