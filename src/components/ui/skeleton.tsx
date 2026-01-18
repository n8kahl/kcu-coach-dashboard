'use client';

import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
}

const Skeleton = forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, variant = 'rectangular', width, height, style, ...props }, ref) => {
    const variantStyles = {
      text: 'h-4',
      circular: 'rounded-full',
      rectangular: '',
    };

    return (
      <div
        ref={ref}
        className={cn(
          'skeleton',
          variantStyles[variant],
          className
        )}
        style={{
          width: width,
          height: height,
          ...style,
        }}
        {...props}
      />
    );
  }
);

Skeleton.displayName = 'Skeleton';

// Preset skeleton components
const SkeletonText = ({ lines = 3, className }: { lines?: number; className?: string }) => (
  <div className={cn('space-y-2', className)}>
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton
        key={i}
        variant="text"
        width={i === lines - 1 ? '60%' : '100%'}
      />
    ))}
  </div>
);

const SkeletonCard = ({ className }: { className?: string }) => (
  <div className={cn('card', className)}>
    <div className="flex items-center gap-3 mb-4">
      <Skeleton variant="circular" width={40} height={40} />
      <div className="flex-1">
        <Skeleton width="40%" height={16} className="mb-2" />
        <Skeleton width="60%" height={12} />
      </div>
    </div>
    <SkeletonText lines={3} />
  </div>
);

const SkeletonTable = ({ rows = 5, columns = 4, className }: { rows?: number; columns?: number; className?: string }) => (
  <div className={cn('w-full', className)}>
    <div className="flex gap-4 border-b border-[var(--border-primary)] pb-3 mb-3">
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton key={i} width={`${100 / columns}%`} height={12} />
      ))}
    </div>
    {Array.from({ length: rows }).map((_, rowIndex) => (
      <div
        key={rowIndex}
        className="flex gap-4 py-3 border-b border-[var(--border-primary)]"
      >
        {Array.from({ length: columns }).map((_, colIndex) => (
          <Skeleton key={colIndex} width={`${100 / columns}%`} height={16} />
        ))}
      </div>
    ))}
  </div>
);

const SkeletonStat = ({ className }: { className?: string }) => (
  <div className={cn('', className)}>
    <Skeleton width={80} height={12} className="mb-2" />
    <Skeleton width={120} height={32} />
  </div>
);

export { Skeleton, SkeletonText, SkeletonCard, SkeletonTable, SkeletonStat };
