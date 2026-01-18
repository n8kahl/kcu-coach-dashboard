'use client';

import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string;
  alt?: string;
  fallback?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  status?: 'online' | 'offline' | 'away' | 'dnd';
  bordered?: boolean;
}

const Avatar = forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, src, alt, fallback, size = 'md', status, bordered = false, ...props }, ref) => {
    const sizes = {
      sm: 'w-8 h-8 text-xs',
      md: 'w-10 h-10 text-sm',
      lg: 'w-12 h-12 text-base',
      xl: 'w-16 h-16 text-lg',
    };

    const statusColors = {
      online: 'bg-[var(--success)]',
      offline: 'bg-[var(--text-tertiary)]',
      away: 'bg-[var(--warning)]',
      dnd: 'bg-[var(--error)]',
    };

    const statusSizes = {
      sm: 'w-2 h-2',
      md: 'w-2.5 h-2.5',
      lg: 'w-3 h-3',
      xl: 'w-4 h-4',
    };

    const initials = fallback
      ? fallback.slice(0, 2).toUpperCase()
      : alt
      ? alt.split(' ').map(word => word[0]).join('').slice(0, 2).toUpperCase()
      : '??';

    return (
      <div
        ref={ref}
        className={cn(
          'relative inline-flex items-center justify-center',
          'bg-[var(--bg-elevated)]',
          'font-semibold text-[var(--text-secondary)]',
          bordered && 'ring-2 ring-[var(--accent-primary)]',
          sizes[size],
          className
        )}
        {...props}
      >
        {src ? (
          <img
            src={src}
            alt={alt || 'Avatar'}
            className="w-full h-full object-cover"
          />
        ) : (
          <span>{initials}</span>
        )}
        {status && (
          <span
            className={cn(
              'absolute bottom-0 right-0 border-2 border-[var(--bg-card)]',
              statusColors[status],
              statusSizes[size]
            )}
          />
        )}
      </div>
    );
  }
);

Avatar.displayName = 'Avatar';

export interface AvatarGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  max?: number;
  size?: 'sm' | 'md' | 'lg';
}

const AvatarGroup = forwardRef<HTMLDivElement, AvatarGroupProps>(
  ({ className, max = 5, size = 'md', children, ...props }, ref) => {
    const childArray = Array.isArray(children) ? children : [children];
    const visibleAvatars = childArray.slice(0, max);
    const remainingCount = childArray.length - max;

    const overlapSizes = {
      sm: '-space-x-2',
      md: '-space-x-3',
      lg: '-space-x-4',
    };

    return (
      <div
        ref={ref}
        className={cn('flex items-center', overlapSizes[size], className)}
        {...props}
      >
        {visibleAvatars}
        {remainingCount > 0 && (
          <div
            className={cn(
              'relative inline-flex items-center justify-center',
              'bg-[var(--bg-elevated)] border border-[var(--border-secondary)]',
              'text-xs font-semibold text-[var(--text-secondary)]',
              size === 'sm' && 'w-8 h-8',
              size === 'md' && 'w-10 h-10',
              size === 'lg' && 'w-12 h-12'
            )}
          >
            +{remainingCount}
          </div>
        )}
      </div>
    );
  }
);

AvatarGroup.displayName = 'AvatarGroup';

export { Avatar, AvatarGroup };
