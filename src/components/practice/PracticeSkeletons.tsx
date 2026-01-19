'use client';

import { cn } from '@/lib/utils';
import { Skeleton, SkeletonText } from '@/components/ui/skeleton';

/**
 * Loading skeleton for the main practice scenario chart area
 */
export function ScenarioChartSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Skeleton width={250} height={20} className="mb-2" />
          <Skeleton width={400} height={14} />
        </div>
        <Skeleton width={80} height={32} />
      </div>

      {/* Chart Area */}
      <div className="bg-[var(--bg-tertiary)] p-4 rounded">
        <div className="relative aspect-[16/9] bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded overflow-hidden">
          {/* Chart skeleton lines */}
          <div className="absolute inset-4">
            {/* Y-axis labels */}
            <div className="absolute left-0 top-0 bottom-0 w-12 flex flex-col justify-between py-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} width={40} height={12} />
              ))}
            </div>

            {/* Chart area with candle-like skeletons */}
            <div className="ml-14 h-full flex items-end gap-1 pb-6">
              {[...Array(30)].map((_, i) => (
                <div key={i} className="flex-1 flex flex-col items-center">
                  <Skeleton
                    width="80%"
                    height={`${20 + Math.random() * 60}%`}
                    className="rounded-sm"
                  />
                </div>
              ))}
            </div>

            {/* X-axis labels */}
            <div className="absolute bottom-0 left-14 right-0 flex justify-between">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} width={40} height={10} />
              ))}
            </div>
          </div>

          {/* Animated shimmer overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-pulse" />
        </div>
      </div>

      {/* Key Levels */}
      <div className="flex gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <Skeleton variant="circular" width={8} height={8} />
            <Skeleton width={80} height={14} />
            <Skeleton width={50} height={14} />
          </div>
        ))}
      </div>

      {/* Decision Buttons */}
      <div className="grid grid-cols-3 gap-4 pt-4">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="flex flex-col items-center py-6 border border-[var(--border-primary)] rounded"
          >
            <Skeleton variant="circular" width={32} height={32} className="mb-2" />
            <Skeleton width={60} height={18} />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Loading skeleton for the scenario list
 */
export function ScenarioListSkeleton({
  count = 8,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={cn('divide-y divide-[var(--border-primary)]', className)}>
      {[...Array(count)].map((_, i) => (
        <div key={i} className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Skeleton variant="circular" width={16} height={16} />
                <Skeleton width={50} height={14} />
                <Skeleton width={70} height={18} className="rounded-full" />
              </div>
              <Skeleton width="80%" height={14} className="mt-2" />
              <Skeleton width={120} height={12} className="mt-2" />
            </div>
            <Skeleton width={30} height={14} />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Loading skeleton for stats row
 */
export function StatsRowSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('grid grid-cols-6 gap-4', className)}>
      {[...Array(6)].map((_, i) => (
        <div key={i} className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Skeleton variant="circular" width={16} height={16} />
            <Skeleton width={60} height={12} />
          </div>
          <Skeleton width={80} height={28} />
        </div>
      ))}
    </div>
  );
}

/**
 * Loading skeleton for practice mode selector
 */
export function PracticeModesSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('flex gap-3 overflow-x-auto pb-2', className)}>
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 px-4 py-3 min-w-[200px] border border-[var(--border-primary)] rounded"
        >
          <Skeleton variant="circular" width={20} height={20} />
          <div className="flex-1">
            <Skeleton width={80} height={14} className="mb-1" />
            <Skeleton width={120} height={10} />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Loading skeleton for the full practice page
 */
export function PracticePageSkeleton() {
  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <StatsRowSkeleton />

      {/* Mode Selector */}
      <PracticeModesSkeleton />

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Scenario List */}
        <div className="lg:col-span-1">
          <div className="card">
            <div className="p-4 border-b border-[var(--border-primary)]">
              <Skeleton width={100} height={18} />
            </div>
            <ScenarioListSkeleton count={6} />
          </div>
        </div>

        {/* Scenario Detail */}
        <div className="lg:col-span-3">
          <div className="card p-6">
            <ScenarioChartSkeleton />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Inline loading indicator for buttons/actions
 */
export function InlineLoadingSkeleton({ text = 'Loading...' }: { text?: string }) {
  return (
    <div className="flex items-center gap-2 text-[var(--text-tertiary)]">
      <div className="w-4 h-4 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin" />
      <span className="text-sm">{text}</span>
    </div>
  );
}
