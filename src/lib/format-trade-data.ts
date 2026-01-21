/**
 * format-trade-data.ts
 *
 * Safe number formatting utilities for trading data.
 * Prevents NaN, undefined, and null from displaying in the UI.
 * Critical for maintaining trader trust in data fidelity.
 */

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Check if a value is a valid, finite number
 */
export function isValidNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && !Number.isNaN(value);
}

/**
 * Check if a value is a valid positive price (> 0)
 */
export function isValidPrice(value: unknown): value is number {
  return isValidNumber(value) && value > 0;
}

// =============================================================================
// Formatting Functions
// =============================================================================

/**
 * Format a price value with safe fallback
 * @param value - The price value to format
 * @param decimals - Number of decimal places (default: 2)
 * @param fallback - Fallback string for invalid values (default: "--")
 */
export function formatPrice(
  value: number | null | undefined,
  decimals: number = 2,
  fallback: string = '--'
): string {
  if (!isValidNumber(value) || value <= 0) {
    return fallback;
  }
  return value.toFixed(decimals);
}

/**
 * Format a price with dollar sign
 */
export function formatDollarPrice(
  value: number | null | undefined,
  decimals: number = 2,
  fallback: string = '--'
): string {
  const formatted = formatPrice(value, decimals, fallback);
  return formatted === fallback ? fallback : `$${formatted}`;
}

/**
 * Format a percentage value with safe fallback
 * @param value - The percentage value (e.g., 5.25 for 5.25%)
 * @param decimals - Number of decimal places (default: 2)
 * @param fallback - Fallback string for invalid values (default: "--")
 * @param showSign - Whether to show +/- sign (default: true)
 */
export function formatPercent(
  value: number | null | undefined,
  decimals: number = 2,
  fallback: string = '--',
  showSign: boolean = true
): string {
  if (!isValidNumber(value)) {
    return fallback;
  }
  const sign = showSign && value > 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals)}%`;
}

/**
 * Format a score value (0-100 scale) with safe fallback
 */
export function formatScore(
  value: number | null | undefined,
  fallback: string = '--'
): string {
  if (!isValidNumber(value)) {
    return fallback;
  }
  // Clamp to 0-100 range
  const clamped = Math.max(0, Math.min(100, value));
  return Math.round(clamped).toString();
}

/**
 * Format volume with abbreviations (K, M, B)
 */
export function formatVolume(
  value: number | null | undefined,
  fallback: string = '--'
): string {
  if (!isValidNumber(value) || value < 0) {
    return fallback;
  }

  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(2)}B`;
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return Math.round(value).toString();
}

/**
 * Format a timestamp to time string (HH:MM:SS)
 */
export function formatTime(
  timestamp: number | null | undefined,
  fallback: string = '--:--'
): string {
  if (!isValidNumber(timestamp) || timestamp <= 0) {
    return fallback;
  }

  const date = new Date(timestamp * 1000);
  if (isNaN(date.getTime())) {
    return fallback;
  }

  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'America/New_York',
  });
}

/**
 * Format countdown timer (MM:SS format)
 * @param seconds - Remaining seconds
 */
export function formatCountdown(
  seconds: number | null | undefined,
  fallback: string = '--:--'
): string {
  if (!isValidNumber(seconds) || seconds < 0) {
    return fallback;
  }

  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// =============================================================================
// Candle Countdown Utilities
// =============================================================================

/**
 * Calculate seconds until next candle close
 * @param timeframeMinutes - Candle timeframe in minutes (e.g., 5 for 5-min candles)
 * @param currentTime - Current timestamp in milliseconds (defaults to Date.now())
 */
export function getSecondsUntilCandleClose(
  timeframeMinutes: number,
  currentTime: number = Date.now()
): number {
  const timeframeMs = timeframeMinutes * 60 * 1000;
  const elapsed = currentTime % timeframeMs;
  const remaining = timeframeMs - elapsed;
  return Math.floor(remaining / 1000);
}

/**
 * Get formatted candle countdown string
 */
export function getCandleCountdown(timeframeMinutes: number): string {
  const seconds = getSecondsUntilCandleClose(timeframeMinutes);
  return formatCountdown(seconds);
}

// =============================================================================
// LTP Score Formatting
// =============================================================================

export type LTPGrade = 'Sniper' | 'Prime' | 'Decent' | 'Sketchy' | 'Dumb Shit' | '--';

/**
 * Get LTP grade from score
 */
export function getLTPGrade(score: number | null | undefined): LTPGrade {
  if (!isValidNumber(score)) return '--';

  if (score >= 85) return 'Sniper';
  if (score >= 70) return 'Prime';
  if (score >= 50) return 'Decent';
  if (score >= 30) return 'Sketchy';
  return 'Dumb Shit';
}

/**
 * Get color class for LTP grade
 */
export function getLTPGradeColor(grade: LTPGrade): string {
  switch (grade) {
    case 'Sniper':
      return 'text-[var(--success)]';
    case 'Prime':
      return 'text-[#22c55e]';
    case 'Decent':
      return 'text-[var(--warning)]';
    case 'Sketchy':
      return 'text-[#f97316]';
    case 'Dumb Shit':
      return 'text-[var(--error)]';
    default:
      return 'text-[var(--text-tertiary)]';
  }
}

/**
 * Get background color class for LTP grade
 */
export function getLTPGradeBgColor(grade: LTPGrade): string {
  switch (grade) {
    case 'Sniper':
      return 'bg-[var(--success)]/20';
    case 'Prime':
      return 'bg-[#22c55e]/15';
    case 'Decent':
      return 'bg-[var(--warning)]/15';
    case 'Sketchy':
      return 'bg-[#f97316]/15';
    case 'Dumb Shit':
      return 'bg-[var(--error)]/20';
    default:
      return 'bg-[var(--bg-tertiary)]';
  }
}

// =============================================================================
// Price Change Formatting
// =============================================================================

/**
 * Format price change with color indication
 */
export function formatPriceChange(
  value: number | null | undefined,
  decimals: number = 2
): { text: string; isPositive: boolean; isNeutral: boolean } {
  if (!isValidNumber(value)) {
    return { text: '--', isPositive: false, isNeutral: true };
  }

  const isPositive = value > 0;
  const isNeutral = value === 0;
  const sign = isPositive ? '+' : '';

  return {
    text: `${sign}${value.toFixed(decimals)}%`,
    isPositive,
    isNeutral,
  };
}

// =============================================================================
// Safe Data Extraction
// =============================================================================

/**
 * Safely extract a numeric value from an object
 */
export function safeGetNumber(
  obj: Record<string, unknown> | null | undefined,
  key: string,
  defaultValue: number = 0
): number {
  if (!obj || typeof obj !== 'object') return defaultValue;
  const value = obj[key];
  return isValidNumber(value) ? value : defaultValue;
}

/**
 * Safely extract a price value (must be positive)
 */
export function safeGetPrice(
  obj: Record<string, unknown> | null | undefined,
  key: string,
  defaultValue: number = 0
): number {
  if (!obj || typeof obj !== 'object') return defaultValue;
  const value = obj[key];
  return isValidPrice(value) ? value : defaultValue;
}
