'use client';

import { cn } from '@/lib/utils';
import {
  GraduationCap,
  Users,
  TrendingUp,
  Megaphone,
  Flame,
  Sparkles
} from 'lucide-react';
import type { ContentCategory } from '@/types/social';

interface CategoryBadgeProps {
  category: ContentCategory;
  size?: 'sm' | 'md';
  className?: string;
}

const categoryConfig: Record<ContentCategory, {
  label: string;
  icon: React.FC<{ className?: string }>;
  colorClass: string;
}> = {
  educational: {
    label: 'Educational',
    icon: GraduationCap,
    colorClass: 'bg-[rgba(59,130,246,0.15)] text-[var(--info)] border-[rgba(59,130,246,0.3)]',
  },
  community: {
    label: 'Community',
    icon: Users,
    colorClass: 'bg-[rgba(34,197,94,0.15)] text-[var(--success)] border-[var(--success-muted)]',
  },
  market_commentary: {
    label: 'Market',
    icon: TrendingUp,
    colorClass: 'bg-[var(--accent-primary-glow)] text-[var(--accent-primary)] border-[var(--accent-primary-muted)]',
  },
  promotional: {
    label: 'Promo',
    icon: Megaphone,
    colorClass: 'bg-[rgba(139,92,246,0.15)] text-[#8B5CF6] border-[rgba(139,92,246,0.3)]',
  },
  motivation: {
    label: 'Motivation',
    icon: Flame,
    colorClass: 'bg-[rgba(249,115,22,0.15)] text-[#F97316] border-[rgba(249,115,22,0.3)]',
  },
  entertainment: {
    label: 'Entertainment',
    icon: Sparkles,
    colorClass: 'bg-[rgba(236,72,153,0.15)] text-[#EC4899] border-[rgba(236,72,153,0.3)]',
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
};

export function CategoryBadge({
  category,
  size = 'md',
  className,
}: CategoryBadgeProps) {
  const config = categoryConfig[category];
  if (!config) return null;

  const sizes = sizeClasses[size];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-semibold uppercase tracking-wide border',
        config.colorClass,
        sizes.container,
        className
      )}
    >
      <Icon className={sizes.icon} />
      {config.label}
    </span>
  );
}
