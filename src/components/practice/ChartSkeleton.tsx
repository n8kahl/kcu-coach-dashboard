'use client';

import { cn } from '@/lib/utils';

interface ChartSkeletonProps {
  className?: string;
  showIndicators?: boolean;
}

export function ChartSkeleton({ className, showIndicators = true }: ChartSkeletonProps) {
  return (
    <div className={cn('relative bg-[var(--bg-primary)] rounded-lg overflow-hidden', className)}>
      {/* Chart Area */}
      <div className="w-full h-full p-4">
        {/* Top toolbar skeleton */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="h-6 w-16 bg-[var(--bg-tertiary)] rounded animate-pulse" />
            <div className="h-6 w-20 bg-[var(--bg-tertiary)] rounded animate-pulse" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-6 w-24 bg-[var(--bg-tertiary)] rounded animate-pulse" />
            <div className="h-6 w-6 bg-[var(--bg-tertiary)] rounded animate-pulse" />
          </div>
        </div>

        {/* Chart grid lines */}
        <div className="relative h-[calc(100%-80px)] flex flex-col justify-between">
          {/* Horizontal grid lines with price labels */}
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-center w-full">
              <div className="flex-1 border-t border-[var(--border-primary)] border-dashed" />
              <div className="h-4 w-12 ml-2 bg-[var(--bg-tertiary)] rounded animate-pulse" />
            </div>
          ))}

          {/* Candlestick skeleton */}
          <div className="absolute inset-0 flex items-end justify-between px-4 pb-4">
            {[...Array(40)].map((_, i) => {
              const height = 20 + Math.random() * 60;
              const isUp = Math.random() > 0.5;
              return (
                <div key={i} className="flex flex-col items-center" style={{ height: `${height}%` }}>
                  {/* Wick */}
                  <div
                    className={cn(
                      'w-px h-1/4 animate-pulse',
                      isUp ? 'bg-[var(--profit)]/30' : 'bg-[var(--loss)]/30'
                    )}
                  />
                  {/* Body */}
                  <div
                    className={cn(
                      'w-2 flex-1 rounded-sm animate-pulse',
                      isUp ? 'bg-[var(--profit)]/30' : 'bg-[var(--loss)]/30'
                    )}
                    style={{ animationDelay: `${i * 50}ms` }}
                  />
                  {/* Wick */}
                  <div
                    className={cn(
                      'w-px h-1/4 animate-pulse',
                      isUp ? 'bg-[var(--profit)]/30' : 'bg-[var(--loss)]/30'
                    )}
                  />
                </div>
              );
            })}
          </div>

          {/* Indicator lines skeleton */}
          {showIndicators && (
            <div className="absolute inset-0 overflow-hidden">
              {/* EMA 9 line */}
              <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
                <path
                  d={generateWavyPath(0, 40, 100)}
                  fill="none"
                  stroke="rgba(34, 197, 94, 0.3)"
                  strokeWidth="2"
                  className="animate-pulse"
                />
                {/* EMA 21 line */}
                <path
                  d={generateWavyPath(10, 50, 100)}
                  fill="none"
                  stroke="rgba(239, 68, 68, 0.3)"
                  strokeWidth="2"
                  className="animate-pulse"
                  style={{ animationDelay: '100ms' }}
                />
                {/* VWAP line */}
                <path
                  d={generateWavyPath(20, 45, 100)}
                  fill="none"
                  stroke="rgba(139, 92, 246, 0.3)"
                  strokeWidth="2"
                  className="animate-pulse"
                  style={{ animationDelay: '200ms' }}
                />
              </svg>
            </div>
          )}
        </div>

        {/* Volume bars skeleton */}
        <div className="h-16 flex items-end justify-between px-4 pt-2 border-t border-[var(--border-primary)]">
          {[...Array(40)].map((_, i) => {
            const height = 10 + Math.random() * 90;
            const isUp = Math.random() > 0.5;
            return (
              <div
                key={i}
                className={cn(
                  'w-2 rounded-t animate-pulse',
                  isUp ? 'bg-[var(--profit)]/20' : 'bg-[var(--loss)]/20'
                )}
                style={{
                  height: `${height}%`,
                  animationDelay: `${i * 30}ms`,
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Loading overlay */}
      <div className="absolute inset-0 flex items-center justify-center bg-[var(--bg-primary)]/50">
        <div className="flex flex-col items-center">
          <div className="relative">
            <div className="w-12 h-12 border-4 border-[var(--border-primary)] border-t-[var(--accent-primary)] rounded-full animate-spin" />
          </div>
          <p className="mt-4 text-sm text-[var(--text-tertiary)]">Loading chart data...</p>
        </div>
      </div>
    </div>
  );
}

// Generate a wavy SVG path for indicator lines
function generateWavyPath(yOffset: number, amplitude: number, points: number): string {
  let path = `M 0 ${50 + yOffset}`;

  for (let i = 1; i <= points; i++) {
    const x = (i / points) * 100;
    const y = 50 + yOffset + Math.sin(i * 0.3) * (amplitude / 4) + Math.random() * 5;
    path += ` L ${x} ${y}`;
  }

  return path;
}

export default ChartSkeleton;
