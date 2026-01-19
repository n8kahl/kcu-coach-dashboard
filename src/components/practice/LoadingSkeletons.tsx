'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

// Base skeleton component
export function Skeleton({ className }: { className?: string }) {
  return (
    <motion.div
      className={cn('bg-[var(--bg-tertiary)] rounded', className)}
      animate={{
        opacity: [0.5, 1, 0.5],
      }}
      transition={{
        duration: 1.5,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
  );
}

// Chart skeleton
export function ChartSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg overflow-hidden', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border-primary)] bg-[var(--bg-secondary)]">
        <div className="flex items-center gap-4">
          <Skeleton className="w-16 h-5" />
          <Skeleton className="w-12 h-4" />
          <Skeleton className="w-20 h-4" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="w-8 h-8 rounded" />
          <Skeleton className="w-8 h-8 rounded" />
        </div>
      </div>

      {/* Chart area */}
      <div className="relative flex">
        <div className="flex-1 h-[450px] p-4">
          {/* Y-axis labels */}
          <div className="absolute right-20 top-4 space-y-8">
            {[1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} className="w-12 h-3" />
            ))}
          </div>

          {/* Candle bars simulation */}
          <div className="flex items-end justify-between h-full gap-1 px-8">
            {Array.from({ length: 40 }).map((_, i) => (
              <motion.div
                key={i}
                className="w-2 bg-[var(--bg-tertiary)] rounded-sm"
                style={{ height: `${30 + Math.random() * 60}%` }}
                animate={{ opacity: [0.3, 0.6, 0.3] }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: 'easeInOut',
                  delay: i * 0.02,
                }}
              />
            ))}
          </div>

          {/* X-axis labels */}
          <div className="absolute bottom-4 left-8 right-20 flex justify-between">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <Skeleton key={i} className="w-10 h-3" />
            ))}
          </div>
        </div>

        {/* Key levels panel */}
        <div className="w-36 border-l border-[var(--border-primary)] bg-[var(--bg-secondary)] p-2">
          <Skeleton className="w-16 h-3 mb-3" />
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Skeleton className="w-2 h-2 rounded-full" />
                  <Skeleton className="w-10 h-3" />
                </div>
                <Skeleton className="w-12 h-3" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="px-4 py-2 border-t border-[var(--border-primary)] bg-[var(--bg-secondary)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="w-8 h-8 rounded" />
            <Skeleton className="w-8 h-8 rounded" />
            <Skeleton className="w-8 h-8 rounded" />
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4].map(i => (
                <Skeleton key={i} className="w-8 h-6 rounded" />
              ))}
            </div>
            <Skeleton className="w-24 h-4" />
          </div>
        </div>
      </div>
    </div>
  );
}

// Daily challenge skeleton
export function DailyChallengeSkeleton() {
  return (
    <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Skeleton className="w-5 h-5 rounded" />
          <Skeleton className="w-32 h-5" />
        </div>
        <Skeleton className="w-20 h-4" />
      </div>

      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="p-3 bg-[var(--bg-primary)] rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <Skeleton className="w-24 h-4" />
              <Skeleton className="w-16 h-4" />
            </div>
            <Skeleton className="w-full h-2 rounded-full" />
            <Skeleton className="w-3/4 h-3 mt-2" />
          </div>
        ))}
      </div>
    </div>
  );
}

// Leaderboard skeleton
export function LeaderboardSkeleton() {
  return (
    <div className="bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--border-primary)] bg-[var(--bg-secondary)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="w-5 h-5 rounded" />
            <Skeleton className="w-24 h-5" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="w-28 h-8 rounded-lg" />
            <Skeleton className="w-8 h-8 rounded-lg" />
          </div>
        </div>
      </div>

      <div className="p-4 space-y-2">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="flex items-center gap-4 p-3 bg-[var(--bg-secondary)] rounded-lg">
            <Skeleton className="w-8 h-8 rounded-full" />
            <div className="flex items-center gap-3 flex-1">
              <Skeleton className="w-10 h-10 rounded-full" />
              <div className="space-y-1">
                <Skeleton className="w-24 h-4" />
                <Skeleton className="w-32 h-3" />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Skeleton className="w-8 h-4" />
              <Skeleton className="w-12 h-4" />
              <Skeleton className="w-16 h-5" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Context panel skeleton
export function ContextPanelSkeleton() {
  return (
    <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="w-4 h-4 rounded" />
          <Skeleton className="w-28 h-5" />
        </div>
        <Skeleton className="w-4 h-4" />
      </div>

      <div className="px-4 pb-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-[var(--bg-primary)] rounded-lg">
            <Skeleton className="w-16 h-3 mb-2" />
            <Skeleton className="w-12 h-5 mb-1" />
            <Skeleton className="w-10 h-3" />
          </div>
          <div className="p-3 bg-[var(--bg-primary)] rounded-lg">
            <Skeleton className="w-12 h-3 mb-2" />
            <Skeleton className="w-10 h-5 mb-1" />
            <Skeleton className="w-16 h-3" />
          </div>
        </div>

        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="space-y-1">
              <div className="flex items-center justify-between">
                <Skeleton className="w-16 h-3" />
                <Skeleton className="w-8 h-4" />
              </div>
              <Skeleton className="w-full h-1.5 rounded-full" />
              <Skeleton className="w-3/4 h-2" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Scenario card skeleton
export function ScenarioCardSkeleton() {
  return (
    <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="space-y-1">
          <Skeleton className="w-32 h-5" />
          <Skeleton className="w-48 h-3" />
        </div>
        <Skeleton className="w-16 h-6 rounded-full" />
      </div>

      <div className="flex items-center gap-4 mb-3">
        <Skeleton className="w-12 h-4" />
        <Skeleton className="w-16 h-4" />
        <Skeleton className="w-14 h-4" />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="w-6 h-6 rounded" />
          <Skeleton className="w-6 h-6 rounded" />
          <Skeleton className="w-6 h-6 rounded" />
        </div>
        <Skeleton className="w-24 h-8 rounded-lg" />
      </div>
    </div>
  );
}

// Achievement skeleton
export function AchievementSkeleton() {
  return (
    <div className="flex items-center gap-2 p-2 bg-[var(--bg-secondary)] rounded-lg">
      <Skeleton className="w-8 h-8 rounded-full" />
      <div className="flex-1 min-w-0 space-y-1">
        <Skeleton className="w-20 h-4" />
        <Skeleton className="w-16 h-3" />
      </div>
    </div>
  );
}

// XP progress skeleton
export function XPProgressSkeleton() {
  return (
    <div className="bg-[var(--bg-secondary)] rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Skeleton className="w-8 h-8 rounded-full" />
          <div className="space-y-1">
            <Skeleton className="w-16 h-4" />
            <Skeleton className="w-24 h-3" />
          </div>
        </div>
        <Skeleton className="w-12 h-5" />
      </div>
      <Skeleton className="w-full h-2 rounded-full" />
    </div>
  );
}

// Full practice page skeleton
export function PracticePageSkeleton() {
  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Skeleton className="w-32 h-8" />
          <Skeleton className="w-48 h-4" />
        </div>
        <div className="flex items-center gap-3">
          <XPProgressSkeleton />
        </div>
      </div>

      {/* Main content */}
      <div className="grid grid-cols-12 gap-6">
        {/* Left column - Chart */}
        <div className="col-span-8 space-y-4">
          <ChartSkeleton />

          {/* Interaction tools */}
          <div className="flex items-center gap-4 p-4 bg-[var(--bg-secondary)] rounded-lg">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="w-24 h-10 rounded-lg" />
            ))}
          </div>
        </div>

        {/* Right column - Panels */}
        <div className="col-span-4 space-y-4">
          <ContextPanelSkeleton />
          <DailyChallengeSkeleton />
        </div>
      </div>

      {/* Bottom section */}
      <div className="grid grid-cols-2 gap-6">
        <LeaderboardSkeleton />
        <div className="space-y-3">
          <Skeleton className="w-24 h-5" />
          <div className="grid grid-cols-2 gap-2">
            {[1, 2, 3, 4].map(i => (
              <AchievementSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Skeleton;
