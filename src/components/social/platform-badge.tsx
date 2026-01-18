'use client';

import { cn } from '@/lib/utils';
import { Instagram, Youtube } from 'lucide-react';
import type { SocialPlatform } from '@/types/social';

// TikTok icon component (not in lucide)
export const TikTokIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z" />
  </svg>
);

interface PlatformBadgeProps {
  platform: SocialPlatform;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

const platformConfig: Record<SocialPlatform, {
  label: string;
  icon: React.FC<{ className?: string }>;
  bgClass: string;
  textClass: string;
}> = {
  instagram: {
    label: 'Instagram',
    icon: Instagram,
    bgClass: 'bg-gradient-to-r from-[#833AB4] via-[#FD1D1D] to-[#F77737]',
    textClass: 'text-white',
  },
  tiktok: {
    label: 'TikTok',
    icon: TikTokIcon,
    bgClass: 'bg-[#000000]',
    textClass: 'text-white',
  },
  youtube: {
    label: 'YouTube',
    icon: Youtube,
    bgClass: 'bg-[#FF0000]',
    textClass: 'text-white',
  },
};

const sizeClasses = {
  sm: {
    container: 'px-2 py-0.5 text-[10px]',
    icon: 'w-3 h-3',
  },
  md: {
    container: 'px-2.5 py-1 text-xs',
    icon: 'w-3.5 h-3.5',
  },
  lg: {
    container: 'px-3 py-1.5 text-sm',
    icon: 'w-4 h-4',
  },
};

export function PlatformBadge({
  platform,
  size = 'md',
  showLabel = true,
  className,
}: PlatformBadgeProps) {
  const config = platformConfig[platform];
  const sizes = sizeClasses[size];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-semibold uppercase tracking-wide',
        config.bgClass,
        config.textClass,
        sizes.container,
        className
      )}
    >
      <Icon className={sizes.icon} />
      {showLabel && config.label}
    </span>
  );
}

interface PlatformIconButtonProps {
  platform: SocialPlatform;
  size?: 'sm' | 'md' | 'lg';
  connected?: boolean;
  onClick?: () => void;
  className?: string;
}

const iconButtonSizes = {
  sm: 'p-1.5',
  md: 'p-2',
  lg: 'p-2.5',
};

export function PlatformIconButton({
  platform,
  size = 'md',
  connected = false,
  onClick,
  className,
}: PlatformIconButtonProps) {
  const config = platformConfig[platform];
  const Icon = config.icon;

  return (
    <button
      onClick={onClick}
      className={cn(
        'relative transition-all duration-150',
        iconButtonSizes[size],
        config.bgClass,
        config.textClass,
        'hover:opacity-90',
        className
      )}
    >
      <Icon className={sizeClasses[size].icon} />
      {connected && (
        <span className="absolute -top-1 -right-1 w-3 h-3 bg-[var(--success)] border-2 border-[var(--bg-primary)]" />
      )}
    </button>
  );
}
