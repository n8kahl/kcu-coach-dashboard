/**
 * KCU Color System - Single Source of Truth
 *
 * Authoritative color palette based on Somesh's KCU trading methodology.
 * All chart components should import colors from this file.
 *
 * Color Philosophy:
 * - Green = Bullish/Support/Fast EMA (EMA 9)
 * - Red = Bearish/Resistance/Slow EMA (EMA 21)
 * - Purple = VWAP
 * - Gold = Previous Day Levels (PDH/PDL)
 * - Cyan = Opening Range (ORB)
 * - Pink = Pre-Market Levels (PMH/PML)
 * - Amber = Key gamma levels (Zero Gamma)
 */

import { LineStyle } from 'lightweight-charts';

// =============================================================================
// Master Color Palette
// =============================================================================

export const KCU_COLORS = {
  // Background & Grid
  background: '#0a0a0f',
  backgroundAlt: '#0b0e11',
  grid: '#1a1a2e',
  gridLines: '#1e222d',
  border: '#2a2e39',

  // Text
  text: '#e5e5e5',
  textStrong: '#f3f4f6',
  textMuted: '#787b86',

  // Crosshair
  crosshair: '#4a4a6a',

  // Candles (KCU Standard - Green/Red)
  candleUp: '#10b981',
  candleDown: '#ef4444',
  wickUp: '#10b981',
  wickDown: '#ef4444',

  // Volume
  volumeUp: 'rgba(16, 185, 129, 0.5)',
  volumeDown: 'rgba(239, 68, 68, 0.5)',

  // EMAs - KCU Methodology
  // Fast EMA = Green, Slow EMA = Red
  ema8: '#22c55e',   // Ripster EMA 8 - Green
  ema9: '#22c55e',   // Fast EMA 9 - Green
  ema21: '#ef4444',  // Slow EMA 21 - Red
  ema50: '#eab308',  // EMA 50 - Yellow

  // Special Moving Averages
  sma200: '#ffffff', // 200 SMA - White (major level)

  // VWAP - Purple
  vwap: '#8b5cf6',
  vwapBand1: 'rgba(139, 92, 246, 0.25)',
  vwapBand2: 'rgba(139, 92, 246, 0.12)',

  // Previous Day Levels - Gold
  pdh: '#fbbf24',
  pdl: '#fbbf24',

  // Opening Range Breakout - Cyan
  orbHigh: '#06b6d4',
  orbLow: '#06b6d4',

  // Pre-Market Levels - Pink
  pmh: '#ec4899',
  pml: '#ec4899',

  // Support & Resistance
  support: '#10b981',
  resistance: '#ef4444',

  // Swing Levels from MTF (4H/1H)
  swingHigh4h: '#f97316',  // Orange - strong resistance
  swingLow4h: '#14b8a6',   // Teal - strong support
  swingHigh1h: '#fb923c',  // Light orange - resistance
  swingLow1h: '#5eead4',   // Light teal - support

  // Gamma Levels
  callWall: '#ef4444',   // Red - resistance
  putWall: '#10b981',    // Green - support
  zeroGamma: '#f59e0b',  // Amber - key level
  maxPain: '#a855f7',    // Purple - magnet

  // Ripster Clouds (EMA 8/21 fill)
  ribbonBullish: 'rgba(34, 197, 94, 0.25)',
  ribbonBearish: 'rgba(239, 68, 68, 0.25)',
  ribbonNeutral: 'rgba(107, 114, 128, 0.1)',

  // Round Numbers & Other Levels
  roundNumber: '#6b7280',
  hourlyLevel: '#3b82f6',
  weeklyLevel: '#3b82f6',
  previousClose: '#a855f7',
  gapLevel: '#06b6d4',

  // Trade Markers
  entry: '#3b82f6',
  stop: '#ef4444',
  target: '#10b981',
  decisionPoint: '#f59e0b',

  // FVG Zones
  bullishFvg: 'rgba(16, 185, 129, 0.15)',
  bearishFvg: 'rgba(239, 68, 68, 0.15)',
} as const;

// =============================================================================
// Level Type to Color Mapping
// =============================================================================

const LEVEL_COLOR_MAP: Record<string, string> = {
  // Previous Day
  pdh: KCU_COLORS.pdh,
  pdl: KCU_COLORS.pdl,
  previous_day_high: KCU_COLORS.pdh,
  previous_day_low: KCU_COLORS.pdl,

  // VWAP
  vwap: KCU_COLORS.vwap,

  // ORB
  orb_high: KCU_COLORS.orbHigh,
  orb_low: KCU_COLORS.orbLow,
  opening_range_high: KCU_COLORS.orbHigh,
  opening_range_low: KCU_COLORS.orbLow,

  // Pre-Market
  pmh: KCU_COLORS.pmh,
  pml: KCU_COLORS.pml,
  pm_high: KCU_COLORS.pmh,
  pm_low: KCU_COLORS.pml,
  premarket_high: KCU_COLORS.pmh,
  premarket_low: KCU_COLORS.pml,

  // EMAs
  ema_9: KCU_COLORS.ema9,
  ema_21: KCU_COLORS.ema21,
  ema_8: KCU_COLORS.ema8,
  ema9: KCU_COLORS.ema9,
  ema21: KCU_COLORS.ema21,
  ema8: KCU_COLORS.ema8,
  ema: KCU_COLORS.ema9,

  // SMA
  sma_200: KCU_COLORS.sma200,
  sma200: KCU_COLORS.sma200,

  // Support/Resistance
  support: KCU_COLORS.support,
  resistance: KCU_COLORS.resistance,
  daily_support: KCU_COLORS.support,
  daily_resistance: KCU_COLORS.resistance,
  demand_zone: KCU_COLORS.support,
  supply_zone: KCU_COLORS.resistance,

  // Swing Levels from MTF Charts
  swing_high_4h: KCU_COLORS.swingHigh4h,
  swing_low_4h: KCU_COLORS.swingLow4h,
  swing_high_1h: KCU_COLORS.swingHigh1h,
  swing_low_1h: KCU_COLORS.swingLow1h,

  // Gamma
  call_wall: KCU_COLORS.callWall,
  put_wall: KCU_COLORS.putWall,
  zero_gamma: KCU_COLORS.zeroGamma,
  max_pain: KCU_COLORS.maxPain,
  gamma_flip: KCU_COLORS.zeroGamma,
  max_gamma: KCU_COLORS.maxPain,

  // Other
  round_number: KCU_COLORS.roundNumber,
  hourly_level: KCU_COLORS.hourlyLevel,
  weekly_high: KCU_COLORS.weeklyLevel,
  weekly_low: KCU_COLORS.weeklyLevel,
  previous_close: KCU_COLORS.previousClose,
  gap_high: KCU_COLORS.gapLevel,
  gap_low: KCU_COLORS.gapLevel,
  gap_top: KCU_COLORS.gapLevel,

  // Pattern Levels
  neckline: '#f97316',
  double_bottom: KCU_COLORS.support,
  fib_50: '#a78bfa',
  extension: '#a78bfa',
  liquidity: KCU_COLORS.resistance,
  sweep_high: KCU_COLORS.resistance,
  trap_low: KCU_COLORS.support,
  broken_resistance: KCU_COLORS.support,
  breakout_high: KCU_COLORS.resistance,
  spike_high: '#f97316',
  range_high: KCU_COLORS.resistance,
  range_low: KCU_COLORS.support,

  // Trade Levels
  entry: KCU_COLORS.entry,
  stop: KCU_COLORS.stop,
  target: KCU_COLORS.target,
};

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Get the color for a specific level type.
 * @param levelType - The type of level (e.g., 'pdh', 'vwap', 'call_wall')
 * @returns The hex color string
 */
export function getLevelColor(levelType: string): string {
  const normalizedType = levelType.toLowerCase().replace(/-/g, '_');
  return LEVEL_COLOR_MAP[normalizedType] || KCU_COLORS.textMuted;
}

/**
 * Get the full style configuration for a level type.
 * @param levelType - The type of level
 * @param strength - Optional strength value (0-100) for determining line width
 * @returns Style object with color, lineWidth, and lineStyle
 */
export function getLevelStyle(
  levelType: string,
  strength?: number
): {
  color: string;
  lineWidth: 1 | 2 | 3 | 4;
  lineStyle: LineStyle;
} {
  const color = getLevelColor(levelType);
  const normalizedType = levelType.toLowerCase().replace(/-/g, '_');

  // High importance levels get thicker lines
  const highImportanceLevels = [
    'vwap', 'pdh', 'pdl', 'call_wall', 'put_wall', 'zero_gamma',
    'sma_200', 'sma200', 'max_pain'
  ];

  // Determine line width based on strength or level importance
  let lineWidth: 1 | 2 | 3 | 4 = 1;
  if (strength !== undefined) {
    lineWidth = strength >= 80 ? 2 : 1;
  } else if (highImportanceLevels.includes(normalizedType)) {
    lineWidth = 2;
  }

  // Determine line style based on level type
  let lineStyle = LineStyle.Solid;

  // Dashed for ORB, PMH/PML, gamma levels, and swing levels
  const dashedLevels = [
    'orb_high', 'orb_low', 'opening_range_high', 'opening_range_low',
    'pmh', 'pml', 'pm_high', 'pm_low', 'premarket_high', 'premarket_low',
    'call_wall', 'put_wall', 'zero_gamma', 'gamma_flip',
    'swing_high_4h', 'swing_low_4h', 'swing_high_1h', 'swing_low_1h'
  ];

  // Dotted for round numbers and hourly levels
  const dottedLevels = ['round_number', 'hourly_level'];

  if (dashedLevels.includes(normalizedType)) {
    lineStyle = LineStyle.Dashed;
  } else if (dottedLevels.includes(normalizedType)) {
    lineStyle = LineStyle.Dotted;
  } else if (strength !== undefined && strength < 70) {
    lineStyle = LineStyle.Dashed;
  }

  return { color, lineWidth, lineStyle };
}

/**
 * Get round number levels near a given price.
 * @param price - Current price
 * @param range - Percentage range to look within (default 5%)
 * @returns Array of round number prices
 */
export function getRoundNumberLevels(price: number, range = 5): number[] {
  if (!price || price <= 0) return [];

  const roundNumbers: number[] = [];
  const rangeDecimal = range / 100;

  // Determine step size based on price magnitude
  let step: number;
  if (price >= 500) {
    step = 50;
  } else if (price >= 100) {
    step = 10;
  } else if (price >= 50) {
    step = 5;
  } else if (price >= 10) {
    step = 2.5;
  } else {
    step = 1;
  }

  // Calculate price range
  const lowerBound = price * (1 - rangeDecimal);
  const upperBound = price * (1 + rangeDecimal);

  // Find round numbers in range
  const startLevel = Math.floor(lowerBound / step) * step;
  for (let level = startLevel; level <= upperBound; level += step) {
    if (level > lowerBound && level !== price) {
      roundNumbers.push(Math.round(level * 100) / 100);
    }
  }

  return roundNumbers;
}

// =============================================================================
// Legacy Compatibility - For gradual migration
// =============================================================================

/**
 * Legacy COLORS object for backward compatibility.
 * New code should use KCU_COLORS directly.
 * @deprecated Use KCU_COLORS instead
 */
export const COLORS = {
  background: KCU_COLORS.backgroundAlt,
  gridLines: KCU_COLORS.gridLines,
  candleUp: KCU_COLORS.candleUp,
  candleDown: KCU_COLORS.candleDown,
  wickUp: KCU_COLORS.wickUp,
  wickDown: KCU_COLORS.wickDown,
  volumeUp: KCU_COLORS.volumeUp,
  volumeDown: KCU_COLORS.volumeDown,
  ema8: KCU_COLORS.ema8,
  ema21: KCU_COLORS.ema21,
  vwap: KCU_COLORS.vwap,
  crosshair: KCU_COLORS.crosshair,
  text: KCU_COLORS.text,
  textMuted: KCU_COLORS.textMuted,
  support: KCU_COLORS.support,
  resistance: KCU_COLORS.resistance,
  callWall: KCU_COLORS.callWall,
  putWall: KCU_COLORS.putWall,
  zeroGamma: KCU_COLORS.zeroGamma,
  maxPain: KCU_COLORS.maxPain,
} as const;

export default KCU_COLORS;
