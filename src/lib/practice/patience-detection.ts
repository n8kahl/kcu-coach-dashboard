/**
 * Practice Mode - Patience Candle Detection
 *
 * Detects patience candles (doji, spinning top, small body candles)
 * near key levels that indicate potential support/resistance holding.
 */

import { Bar } from './indicators';

export interface KeyLevel {
  price: number;
  label: string;
  type: string;
  strength?: number;
}

export interface PatienceCandle {
  barIndex: number;
  timestamp: number;
  type: 'doji' | 'spinning_top' | 'small_body' | 'hammer' | 'inverted_hammer';
  nearLevel: string;
  levelPrice: number;
  confidence: number; // 0-100
  description: string;
}

export interface PatienceDetectionConfig {
  maxBodyPercent: number; // Max body size as % of range (default 0.35)
  proximityPercent: number; // How close to level (default 0.3%)
  minWickRatio: number; // Min wick to body ratio for hammer patterns (default 2)
  lookbackBars: number; // How many recent bars to check (default 10)
}

const DEFAULT_CONFIG: PatienceDetectionConfig = {
  maxBodyPercent: 0.35, // 35% body of total range
  proximityPercent: 0.3, // Within 0.3% of a level
  minWickRatio: 2, // Wick must be 2x body for hammer
  lookbackBars: 10,
};

/**
 * Classify a candle's pattern type
 */
function classifyCandle(bar: Bar): {
  type: 'doji' | 'spinning_top' | 'small_body' | 'hammer' | 'inverted_hammer' | 'regular';
  bodyPercent: number;
  upperWick: number;
  lowerWick: number;
} {
  const bodySize = Math.abs(bar.c - bar.o);
  const totalRange = bar.h - bar.l;
  const bodyPercent = totalRange > 0 ? bodySize / totalRange : 0;

  const upperWick = bar.h - Math.max(bar.o, bar.c);
  const lowerWick = Math.min(bar.o, bar.c) - bar.l;

  // Doji: Very small body (< 10% of range)
  if (bodyPercent < 0.1 && totalRange > 0) {
    return { type: 'doji', bodyPercent, upperWick, lowerWick };
  }

  // Small body patterns
  if (bodyPercent < 0.35) {
    // Hammer: Small body at top, long lower wick
    if (lowerWick > bodySize * 2 && upperWick < bodySize * 0.5) {
      return { type: 'hammer', bodyPercent, upperWick, lowerWick };
    }

    // Inverted Hammer: Small body at bottom, long upper wick
    if (upperWick > bodySize * 2 && lowerWick < bodySize * 0.5) {
      return { type: 'inverted_hammer', bodyPercent, upperWick, lowerWick };
    }

    // Spinning Top: Small body with wicks on both sides
    if (upperWick > bodySize * 0.5 && lowerWick > bodySize * 0.5) {
      return { type: 'spinning_top', bodyPercent, upperWick, lowerWick };
    }

    // Generic small body
    return { type: 'small_body', bodyPercent, upperWick, lowerWick };
  }

  return { type: 'regular', bodyPercent, upperWick, lowerWick };
}

/**
 * Check if a bar is near a key level
 */
function isNearLevel(
  bar: Bar,
  level: KeyLevel,
  proximityPercent: number
): { near: boolean; distance: number } {
  const midPrice = (bar.h + bar.l) / 2;
  const distance = Math.abs(midPrice - level.price) / level.price * 100;

  // Also check if the bar range intersects the level
  const rangeIntersects = bar.l <= level.price && bar.h >= level.price;

  return {
    near: distance <= proximityPercent || rangeIntersects,
    distance,
  };
}

/**
 * Detect patience candles in a set of bars near key levels
 */
export function detectPatienceCandles(
  bars: Bar[],
  keyLevels: KeyLevel[],
  config: Partial<PatienceDetectionConfig> = {}
): PatienceCandle[] {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const patience: PatienceCandle[] = [];

  if (bars.length === 0 || keyLevels.length === 0) {
    return patience;
  }

  // Look at recent bars
  const recentBars = bars.slice(-cfg.lookbackBars);
  const startIndex = Math.max(0, bars.length - cfg.lookbackBars);

  for (let i = 0; i < recentBars.length; i++) {
    const bar = recentBars[i];
    const barIndex = startIndex + i;

    // Classify the candle
    const classification = classifyCandle(bar);

    // Skip regular candles
    if (classification.type === 'regular') {
      continue;
    }

    // Check against each level
    for (const level of keyLevels) {
      const { near, distance } = isNearLevel(bar, level, cfg.proximityPercent);

      if (near) {
        // Calculate confidence based on distance and pattern quality
        const distanceScore = Math.max(0, 100 - distance * 100);
        const patternScore =
          classification.type === 'doji'
            ? 95
            : classification.type === 'hammer' || classification.type === 'inverted_hammer'
              ? 90
              : classification.type === 'spinning_top'
                ? 85
                : 70;

        const confidence = Math.round((distanceScore * 0.4 + patternScore * 0.6));

        // Generate description
        let description = '';
        switch (classification.type) {
          case 'doji':
            description = `Doji at ${level.label} shows indecision - buyers and sellers balanced`;
            break;
          case 'hammer':
            description = `Hammer at ${level.label} suggests buyers stepping in - bullish reversal signal`;
            break;
          case 'inverted_hammer':
            description = `Inverted hammer at ${level.label} shows buying pressure - watch for confirmation`;
            break;
          case 'spinning_top':
            description = `Spinning top at ${level.label} indicates uncertainty - wait for next candle`;
            break;
          case 'small_body':
            description = `Small body candle at ${level.label} shows decreasing momentum`;
            break;
        }

        patience.push({
          barIndex,
          timestamp: bar.t,
          type: classification.type as PatienceCandle['type'],
          nearLevel: level.label,
          levelPrice: level.price,
          confidence,
          description,
        });

        // Only report one level per candle (the closest one)
        break;
      }
    }
  }

  // Sort by confidence descending
  return patience.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Check if there are patience candles confirming a potential trade
 */
export function hasPatienceConfirmation(
  bars: Bar[],
  keyLevels: KeyLevel[],
  minConfidence: number = 70
): { confirmed: boolean; candles: PatienceCandle[]; summary: string } {
  const patienceCandles = detectPatienceCandles(bars, keyLevels);
  const highConfidenceCandles = patienceCandles.filter((p) => p.confidence >= minConfidence);

  if (highConfidenceCandles.length === 0) {
    return {
      confirmed: false,
      candles: [],
      summary: 'No patience candle confirmation at key levels yet. Wait for indecision or reversal patterns.',
    };
  }

  const bestCandle = highConfidenceCandles[0];
  const summary = `${bestCandle.type.replace('_', ' ')} pattern detected at ${bestCandle.nearLevel} with ${bestCandle.confidence}% confidence. ${bestCandle.description}`;

  return {
    confirmed: true,
    candles: highConfidenceCandles,
    summary,
  };
}

/**
 * Get patience score for LTP analysis (0-100)
 */
export function calculatePatienceScore(
  bars: Bar[],
  keyLevels: KeyLevel[]
): { score: number; reason: string; candles: PatienceCandle[] } {
  const patienceCandles = detectPatienceCandles(bars, keyLevels);

  if (patienceCandles.length === 0) {
    return {
      score: 30,
      reason: 'No patience candles detected at key levels - setup not yet confirmed',
      candles: [],
    };
  }

  // Calculate score based on number and quality of patience candles
  const avgConfidence =
    patienceCandles.reduce((sum, p) => sum + p.confidence, 0) / patienceCandles.length;

  // Bonus for multiple patience candles (shows repeated tests)
  const multipleTestBonus = Math.min(20, (patienceCandles.length - 1) * 10);

  // Bonus for recent candles (last 3 bars)
  const recentBonus = patienceCandles.some((p) => p.barIndex >= bars.length - 3) ? 10 : 0;

  const score = Math.min(100, Math.round(avgConfidence + multipleTestBonus + recentBonus));

  // Generate reason
  let reason = '';
  if (score >= 85) {
    reason = `Strong patience confirmation - ${patienceCandles.length} candle(s) at key levels showing the level is being respected`;
  } else if (score >= 70) {
    reason = `Good patience signals - ${patienceCandles[0].type.replace('_', ' ')} at ${patienceCandles[0].nearLevel} suggests level may hold`;
  } else if (score >= 50) {
    reason = `Moderate patience - some indecision candles present but could use more confirmation`;
  } else {
    reason = `Weak patience signals - candles show some hesitation but pattern not clear`;
  }

  return { score, reason, candles: patienceCandles };
}

/**
 * Get visual markers for patience candles (for chart rendering)
 */
export function getPatienceMarkers(
  patienceCandles: PatienceCandle[],
  bars: Bar[]
): {
  time: number;
  position: 'aboveBar' | 'belowBar';
  color: string;
  shape: 'circle' | 'square' | 'arrowUp' | 'arrowDown';
  text: string;
}[] {
  return patienceCandles.map((p) => {
    const bar = bars[p.barIndex];
    const isBullish = bar && bar.c >= bar.o;

    return {
      time: p.timestamp / 1000,
      position: isBullish ? 'belowBar' : 'aboveBar',
      color: p.confidence >= 80 ? '#22c55e' : p.confidence >= 60 ? '#f59e0b' : '#6b7280',
      shape:
        p.type === 'hammer'
          ? 'arrowUp'
          : p.type === 'inverted_hammer'
            ? 'arrowDown'
            : 'circle',
      text: p.type === 'doji' ? '⏸' : p.type === 'hammer' ? '🔨' : '◎',
    };
  });
}
