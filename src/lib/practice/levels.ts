/**
 * Practice Mode - Key Level Calculations
 *
 * Calculates PDH, PDL, ORB, VWAP bands, round numbers,
 * and other key levels for practice scenarios.
 */

import { Bar, calculateVWAP } from './indicators';

export interface KeyLevel {
  price: number;
  label: string;
  type: string;
  strength: number; // 0-100
  timeframe: 'daily' | 'intraday' | 'weekly';
}

export interface LevelStyles {
  color: string;
  lineWidth: number;
  lineStyle: 'solid' | 'dashed' | 'dotted';
}

// Level style configurations matching TradingView conventions
export const LEVEL_STYLES: Record<string, LevelStyles> = {
  pdh: { color: '#FFD700', lineWidth: 2, lineStyle: 'solid' }, // Gold
  pdl: { color: '#FFD700', lineWidth: 2, lineStyle: 'solid' }, // Gold
  orb_high: { color: '#22c55e', lineWidth: 2, lineStyle: 'dashed' }, // Green
  orb_low: { color: '#ef4444', lineWidth: 2, lineStyle: 'dashed' }, // Red
  vwap: { color: '#9333ea', lineWidth: 2, lineStyle: 'solid' }, // Purple
  vwap_upper: { color: '#9333ea', lineWidth: 1, lineStyle: 'dotted' },
  vwap_lower: { color: '#9333ea', lineWidth: 1, lineStyle: 'dotted' },
  weekly_high: { color: '#3b82f6', lineWidth: 1, lineStyle: 'dotted' }, // Blue
  weekly_low: { color: '#3b82f6', lineWidth: 1, lineStyle: 'dotted' },
  monthly_high: { color: '#8b5cf6', lineWidth: 1, lineStyle: 'dotted' }, // Violet
  monthly_low: { color: '#8b5cf6', lineWidth: 1, lineStyle: 'dotted' },
  sma_200: { color: '#ffffff', lineWidth: 1, lineStyle: 'solid' }, // White
  ema_9: { color: '#3b82f6', lineWidth: 1, lineStyle: 'solid' }, // Blue
  ema_21: { color: '#f97316', lineWidth: 1, lineStyle: 'solid' }, // Orange
  premarket_high: { color: '#ec4899', lineWidth: 1, lineStyle: 'dashed' }, // Pink
  premarket_low: { color: '#ec4899', lineWidth: 1, lineStyle: 'dashed' },
  round_number: { color: '#6b7280', lineWidth: 1, lineStyle: 'dotted' }, // Gray
  support: { color: '#22c55e', lineWidth: 2, lineStyle: 'solid' },
  resistance: { color: '#ef4444', lineWidth: 2, lineStyle: 'solid' },
  gap_high: { color: '#06b6d4', lineWidth: 1, lineStyle: 'dashed' }, // Cyan
  gap_low: { color: '#06b6d4', lineWidth: 1, lineStyle: 'dashed' },
};

/**
 * Calculate Previous Day High/Low
 */
export function calculatePDHPDL(dailyBars: Bar[]): KeyLevel[] {
  if (dailyBars.length < 2) return [];

  const yesterday = dailyBars[dailyBars.length - 2];

  return [
    {
      price: yesterday.h,
      label: 'PDH',
      type: 'pdh',
      strength: 85,
      timeframe: 'daily',
    },
    {
      price: yesterday.l,
      label: 'PDL',
      type: 'pdl',
      strength: 85,
      timeframe: 'daily',
    },
  ];
}

/**
 * Calculate Opening Range Breakout levels (first 15 minutes)
 */
export function calculateORB(intradayBars: Bar[], orbMinutes: number = 15): KeyLevel[] {
  if (intradayBars.length === 0) return [];

  // Find bars within the ORB period
  const firstBarTime = intradayBars[0].t;
  const orbEndTime = firstBarTime + orbMinutes * 60 * 1000;

  const orbBars = intradayBars.filter((b) => b.t <= orbEndTime);

  if (orbBars.length === 0) return [];

  const orbHigh = Math.max(...orbBars.map((b) => b.h));
  const orbLow = Math.min(...orbBars.map((b) => b.l));

  return [
    {
      price: orbHigh,
      label: 'ORB High',
      type: 'orb_high',
      strength: 80,
      timeframe: 'intraday',
    },
    {
      price: orbLow,
      label: 'ORB Low',
      type: 'orb_low',
      strength: 80,
      timeframe: 'intraday',
    },
  ];
}

/**
 * Calculate Weekly High/Low
 */
export function calculateWeeklyLevels(dailyBars: Bar[]): KeyLevel[] {
  if (dailyBars.length < 5) return [];

  const weekBars = dailyBars.slice(-5);
  const weekHigh = Math.max(...weekBars.map((b) => b.h));
  const weekLow = Math.min(...weekBars.map((b) => b.l));

  return [
    {
      price: weekHigh,
      label: 'Week High',
      type: 'weekly_high',
      strength: 75,
      timeframe: 'weekly',
    },
    {
      price: weekLow,
      label: 'Week Low',
      type: 'weekly_low',
      strength: 75,
      timeframe: 'weekly',
    },
  ];
}

/**
 * Calculate VWAP and standard deviation bands
 */
export function calculateVWAPBands(
  intradayBars: Bar[]
): { vwap: number; upperBand: number; lowerBand: number; levels: KeyLevel[] } {
  const vwapValues = calculateVWAP(intradayBars);

  if (vwapValues.length === 0) {
    return { vwap: 0, upperBand: 0, lowerBand: 0, levels: [] };
  }

  const currentVWAP = vwapValues[vwapValues.length - 1];

  // Calculate standard deviation of price from VWAP
  const closes = intradayBars.map((b) => b.c);
  const deviations = closes.map((c, i) => Math.pow(c - (vwapValues[i] || c), 2));
  const variance = deviations.reduce((a, b) => a + b, 0) / deviations.length;
  const stdDev = Math.sqrt(variance);

  const upperBand = currentVWAP + stdDev;
  const lowerBand = currentVWAP - stdDev;

  const levels: KeyLevel[] = [
    {
      price: currentVWAP,
      label: 'VWAP',
      type: 'vwap',
      strength: 90,
      timeframe: 'intraday',
    },
    {
      price: upperBand,
      label: 'VWAP +1σ',
      type: 'vwap_upper',
      strength: 60,
      timeframe: 'intraday',
    },
    {
      price: lowerBand,
      label: 'VWAP -1σ',
      type: 'vwap_lower',
      strength: 60,
      timeframe: 'intraday',
    },
  ];

  return { vwap: currentVWAP, upperBand, lowerBand, levels };
}

/**
 * Find nearest round numbers (psychological levels)
 */
export function calculateRoundNumbers(currentPrice: number, count: number = 2): KeyLevel[] {
  const levels: KeyLevel[] = [];

  // Determine round number interval based on price
  let interval: number;
  if (currentPrice > 500) interval = 50;
  else if (currentPrice > 100) interval = 10;
  else if (currentPrice > 50) interval = 5;
  else if (currentPrice > 10) interval = 1;
  else interval = 0.5;

  // Find nearest round numbers above and below
  const nearest = Math.round(currentPrice / interval) * interval;

  for (let i = -count; i <= count; i++) {
    if (i === 0) continue;
    const price = nearest + i * interval;
    if (price > 0) {
      levels.push({
        price,
        label: `$${price}`,
        type: 'round_number',
        strength: 50,
        timeframe: 'daily',
      });
    }
  }

  return levels;
}

/**
 * Calculate gap levels from overnight session
 */
export function calculateGapLevels(
  yesterdayClose: number,
  todayOpen: number,
  todayPremarketHigh: number,
  todayPremarketLow: number
): KeyLevel[] {
  const levels: KeyLevel[] = [];

  // Gap up
  if (todayOpen > yesterdayClose) {
    levels.push({
      price: yesterdayClose,
      label: 'Gap Fill (PDC)',
      type: 'gap_low',
      strength: 85,
      timeframe: 'intraday',
    });
    levels.push({
      price: todayOpen,
      label: 'Gap High',
      type: 'gap_high',
      strength: 70,
      timeframe: 'intraday',
    });
  }

  // Gap down
  if (todayOpen < yesterdayClose) {
    levels.push({
      price: yesterdayClose,
      label: 'Gap Fill (PDC)',
      type: 'gap_high',
      strength: 85,
      timeframe: 'intraday',
    });
    levels.push({
      price: todayOpen,
      label: 'Gap Low',
      type: 'gap_low',
      strength: 70,
      timeframe: 'intraday',
    });
  }

  // Premarket levels
  if (todayPremarketHigh > 0 && todayPremarketLow > 0) {
    levels.push({
      price: todayPremarketHigh,
      label: 'PM High',
      type: 'premarket_high',
      strength: 75,
      timeframe: 'intraday',
    });
    levels.push({
      price: todayPremarketLow,
      label: 'PM Low',
      type: 'premarket_low',
      strength: 75,
      timeframe: 'intraday',
    });
  }

  return levels;
}

/**
 * Calculate SMA 200 level from daily bars
 */
export function calculateSMA200Level(dailyBars: Bar[]): KeyLevel | null {
  if (dailyBars.length < 200) return null;

  const sum = dailyBars.slice(-200).reduce((a, b) => a + b.c, 0);
  const sma200 = sum / 200;

  return {
    price: sma200,
    label: 'SMA 200',
    type: 'sma_200',
    strength: 95, // Very significant level
    timeframe: 'daily',
  };
}

/**
 * Calculate all key levels for a practice scenario
 */
export function calculateAllLevels(data: {
  dailyBars: Bar[];
  intradayBars: Bar[];
  currentPrice: number;
  premarket?: { high: number; low: number };
}): KeyLevel[] {
  const levels: KeyLevel[] = [];

  // PDH/PDL
  levels.push(...calculatePDHPDL(data.dailyBars));

  // ORB
  levels.push(...calculateORB(data.intradayBars));

  // Weekly levels
  levels.push(...calculateWeeklyLevels(data.dailyBars));

  // VWAP and bands
  const vwapData = calculateVWAPBands(data.intradayBars);
  levels.push(...vwapData.levels);

  // Round numbers
  levels.push(...calculateRoundNumbers(data.currentPrice));

  // SMA 200
  const sma200 = calculateSMA200Level(data.dailyBars);
  if (sma200) levels.push(sma200);

  // Gap levels (if we have the data)
  if (data.dailyBars.length >= 2 && data.intradayBars.length > 0) {
    const yesterdayClose = data.dailyBars[data.dailyBars.length - 2].c;
    const todayOpen = data.intradayBars[0].o;
    const pmHigh = data.premarket?.high || 0;
    const pmLow = data.premarket?.low || 0;
    levels.push(...calculateGapLevels(yesterdayClose, todayOpen, pmHigh, pmLow));
  }

  // Sort by distance from current price
  levels.sort((a, b) => {
    const distA = Math.abs(a.price - data.currentPrice);
    const distB = Math.abs(b.price - data.currentPrice);
    return distA - distB;
  });

  // Remove duplicates (levels within 0.1% of each other)
  const uniqueLevels: KeyLevel[] = [];
  for (const level of levels) {
    const isDuplicate = uniqueLevels.some(
      (existing) => Math.abs(existing.price - level.price) / level.price < 0.001
    );
    if (!isDuplicate) {
      uniqueLevels.push(level);
    }
  }

  return uniqueLevels;
}

/**
 * Get the most relevant levels for display (closest to price, highest strength)
 */
export function getTopLevels(levels: KeyLevel[], currentPrice: number, count: number = 6): KeyLevel[] {
  // Score each level based on distance and strength
  const scored = levels.map((level) => {
    const distance = Math.abs(level.price - currentPrice) / currentPrice;
    const distanceScore = Math.max(0, 100 - distance * 1000); // Closer is better
    const totalScore = distanceScore * 0.6 + level.strength * 0.4;
    return { level, score: totalScore };
  });

  // Sort by score and take top N
  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, count).map((s) => s.level);
}

/**
 * Determine if price is at a key level
 */
export function isAtKeyLevel(
  currentPrice: number,
  levels: KeyLevel[],
  threshold: number = 0.3
): { atLevel: boolean; level: KeyLevel | null; distance: number } {
  for (const level of levels) {
    const distance = Math.abs(currentPrice - level.price) / level.price * 100;
    if (distance <= threshold) {
      return { atLevel: true, level, distance };
    }
  }
  return { atLevel: false, level: null, distance: Infinity };
}

/**
 * Calculate level score for LTP analysis
 */
export function calculateLevelScore(
  currentPrice: number,
  levels: KeyLevel[]
): { score: number; reason: string; nearestLevel: KeyLevel | null } {
  const { atLevel, level, distance } = isAtKeyLevel(currentPrice, levels);

  if (atLevel && level) {
    // At a strong level
    const baseScore = level.strength;
    const proximityBonus = Math.max(0, 15 - distance * 10);
    const score = Math.min(100, baseScore + proximityBonus);

    return {
      score,
      reason: `Price at ${level.label} (${level.type}) - within ${distance.toFixed(2)}% of level`,
      nearestLevel: level,
    };
  }

  // Find closest level
  const closestLevel = levels.reduce(
    (closest, l) => {
      const d = Math.abs(currentPrice - l.price) / l.price * 100;
      return d < closest.distance ? { level: l, distance: d } : closest;
    },
    { level: levels[0], distance: Infinity }
  );

  if (closestLevel.distance < 1) {
    return {
      score: 60,
      reason: `Price approaching ${closestLevel.level.label} - ${closestLevel.distance.toFixed(2)}% away`,
      nearestLevel: closestLevel.level,
    };
  }

  if (closestLevel.distance < 2) {
    return {
      score: 45,
      reason: `Nearest level is ${closestLevel.level.label} at ${closestLevel.distance.toFixed(1)}% away`,
      nearestLevel: closestLevel.level,
    };
  }

  return {
    score: 30,
    reason: 'Price not at a significant level - consider waiting for better entry',
    nearestLevel: closestLevel.level,
  };
}
