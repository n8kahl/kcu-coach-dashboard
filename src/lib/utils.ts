import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPercent(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(date));
}

export function formatTime(date: string | Date): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(date));
}

export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(date));
}

export function getRelativeTime(date: string | Date): string {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(date);
}

export function calculatePnL(
  entryPrice: number,
  exitPrice: number,
  quantity: number,
  direction: 'long' | 'short'
): { pnl: number; pnlPercent: number } {
  const priceDiff = direction === 'long'
    ? exitPrice - entryPrice
    : entryPrice - exitPrice;

  const pnl = priceDiff * quantity;
  const pnlPercent = (priceDiff / entryPrice) * 100;

  return { pnl, pnlPercent };
}

export function getSetupTypeColor(setupType: string): string {
  const colors: Record<string, string> = {
    'LTP': 'text-primary-400',
    'ORB': 'text-accent-400',
    'VWAP': 'text-blue-400',
    'EMA': 'text-green-400',
    'King': 'text-yellow-400',
    'Queen': 'text-pink-400',
    'default': 'text-gray-400',
  };
  return colors[setupType] || colors.default;
}

export function getEmotionColor(emotion: string): string {
  const colors: Record<string, string> = {
    'confident': 'bg-green-500/20 text-green-400',
    'anxious': 'bg-yellow-500/20 text-yellow-400',
    'fearful': 'bg-red-500/20 text-red-400',
    'greedy': 'bg-orange-500/20 text-orange-400',
    'patient': 'bg-blue-500/20 text-blue-400',
    'fomo': 'bg-purple-500/20 text-purple-400',
    'revenge': 'bg-red-600/20 text-red-500',
    'neutral': 'bg-gray-500/20 text-gray-400',
    'default': 'bg-gray-500/20 text-gray-400',
  };
  return colors[emotion.toLowerCase()] || colors.default;
}

export function getConfluenceColor(score: number): string {
  if (score >= 80) return 'text-green-400';
  if (score >= 65) return 'text-yellow-400';
  if (score >= 50) return 'text-orange-400';
  return 'text-red-400';
}

export function getConfluenceBgColor(score: number): string {
  if (score >= 80) return 'bg-green-500/20';
  if (score >= 65) return 'bg-yellow-500/20';
  if (score >= 50) return 'bg-orange-500/20';
  return 'bg-red-500/20';
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}
