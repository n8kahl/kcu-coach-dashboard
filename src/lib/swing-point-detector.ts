/**
 * Swing Point Detector
 *
 * Detects swing highs and lows across multiple timeframes with touchpoint counting.
 * Used to identify key support/resistance levels where price has reacted multiple times.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface SwingPoint {
  price: number;
  type: 'high' | 'low';
  timestamp: number;
  touchCount: number;
  timeframe: '1H' | '4H' | 'D';
  strength: number;
}

export interface SwingPointConfig {
  /** Number of bars on each side to confirm swing (default: 5) */
  lookback: number;
  /** Price tolerance % for clustering nearby swings (default: 0.3) */
  tolerance: number;
  /** Minimum touches to qualify as a level (default: 2) */
  minTouches: number;
}

export interface Bar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

// ============================================================================
// DEFAULT CONFIG
// ============================================================================

const DEFAULT_CONFIG: SwingPointConfig = {
  lookback: 5,
  tolerance: 0.3,
  minTouches: 2,
};

// Timeframe-specific configs
export const TIMEFRAME_CONFIGS: Record<string, SwingPointConfig> = {
  '1H': { lookback: 5, tolerance: 0.3, minTouches: 2 },
  '4H': { lookback: 3, tolerance: 0.5, minTouches: 2 },
  'D': { lookback: 3, tolerance: 0.8, minTouches: 2 },
};

// ============================================================================
// MAIN DETECTION FUNCTION
// ============================================================================

/**
 * Detect swing highs and lows with touchpoint counting
 *
 * @param bars - Array of OHLC bars (must be sorted by time ascending)
 * @param timeframe - Timeframe identifier ('1H', '4H', 'D')
 * @param config - Detection configuration
 * @returns Array of clustered swing points with touch counts
 */
export function detectSwingPoints(
  bars: Bar[],
  timeframe: '1H' | '4H' | 'D' = '1H',
  config: SwingPointConfig = TIMEFRAME_CONFIGS[timeframe] || DEFAULT_CONFIG
): SwingPoint[] {
  if (bars.length < config.lookback * 2 + 1) {
    return []; // Not enough data
  }

  const rawSwings: SwingPoint[] = [];

  // Detect local maxima (swing highs) and minima (swing lows)
  for (let i = config.lookback; i < bars.length - config.lookback; i++) {
    const current = bars[i];
    const leftBars = bars.slice(i - config.lookback, i);
    const rightBars = bars.slice(i + 1, i + config.lookback + 1);
    const surroundingBars = [...leftBars, ...rightBars];

    // Check for swing high: current high is higher than all surrounding highs
    const isSwingHigh = surroundingBars.every(bar => bar.high <= current.high);

    // Check for swing low: current low is lower than all surrounding lows
    const isSwingLow = surroundingBars.every(bar => bar.low >= current.low);

    if (isSwingHigh) {
      rawSwings.push({
        price: current.high,
        type: 'high',
        timestamp: current.time,
        touchCount: 1,
        timeframe,
        strength: 60, // Base strength, increased by clustering
      });
    }

    if (isSwingLow) {
      rawSwings.push({
        price: current.low,
        type: 'low',
        timestamp: current.time,
        touchCount: 1,
        timeframe,
        strength: 60,
      });
    }
  }

  // Cluster nearby swings and count touches
  return clusterSwingPoints(rawSwings, config.tolerance, config.minTouches);
}

// ============================================================================
// CLUSTERING FUNCTION
// ============================================================================

/**
 * Group swing points within price tolerance and count touches
 *
 * @param swings - Raw swing points
 * @param tolerancePct - Price tolerance percentage for clustering
 * @param minTouches - Minimum touches required
 * @returns Clustered swing points
 */
function clusterSwingPoints(
  swings: SwingPoint[],
  tolerancePct: number,
  minTouches: number
): SwingPoint[] {
  const clustered: SwingPoint[] = [];
  const used = new Set<number>();

  // Sort by price to make clustering more efficient
  const sortedSwings = [...swings].sort((a, b) => a.price - b.price);

  sortedSwings.forEach((swing, i) => {
    if (used.has(i)) return;

    // Find all swings of same type within tolerance
    const cluster: { swing: SwingPoint; index: number }[] = [];

    sortedSwings.forEach((s, j) => {
      if (used.has(j) || s.type !== swing.type) return;

      const priceDiff = Math.abs(s.price - swing.price) / swing.price * 100;
      if (priceDiff <= tolerancePct) {
        cluster.push({ swing: s, index: j });
      }
    });

    if (cluster.length >= minTouches) {
      // Calculate average price of cluster
      const avgPrice = cluster.reduce((sum, c) => sum + c.swing.price, 0) / cluster.length;

      // Get most recent timestamp
      const mostRecent = Math.max(...cluster.map(c => c.swing.timestamp));

      // Calculate strength based on touch count
      // Base: 60, +10 per touch, max 100
      const strength = Math.min(100, 60 + (cluster.length * 10));

      clustered.push({
        price: Number(avgPrice.toFixed(2)),
        type: swing.type,
        timestamp: mostRecent,
        touchCount: cluster.length,
        timeframe: swing.timeframe,
        strength,
      });

      // Mark all cluster members as used
      cluster.forEach(c => used.add(c.index));
    }
  });

  // Sort by strength (strongest first) then by recency
  return clustered.sort((a, b) => {
    if (b.strength !== a.strength) return b.strength - a.strength;
    return b.timestamp - a.timestamp;
  });
}

// ============================================================================
// HELPER: Count additional touches after initial swing
// ============================================================================

/**
 * Count how many times price has touched a level after the swing was formed
 * This provides additional confluence beyond the initial swing detection
 *
 * @param bars - Full bar data
 * @param level - Price level to check
 * @param type - 'high' (resistance) or 'low' (support)
 * @param tolerancePct - Price tolerance for what counts as a "touch"
 * @param startIndex - Start checking from this bar index
 */
export function countTouchesAtLevel(
  bars: Bar[],
  level: number,
  type: 'high' | 'low',
  tolerancePct: number = 0.2,
  startIndex: number = 0
): number {
  let touches = 0;
  const tolerance = level * (tolerancePct / 100);

  for (let i = startIndex; i < bars.length; i++) {
    const bar = bars[i];

    if (type === 'high') {
      // For resistance, check if high got close but didn't break significantly
      if (bar.high >= level - tolerance && bar.high <= level + tolerance) {
        touches++;
      }
    } else {
      // For support, check if low got close but didn't break significantly
      if (bar.low >= level - tolerance && bar.low <= level + tolerance) {
        touches++;
      }
    }
  }

  return touches;
}

// ============================================================================
// HELPER: Filter levels near current price
// ============================================================================

/**
 * Filter swing levels to only those within a certain distance of current price
 *
 * @param swings - Array of swing points
 * @param currentPrice - Current price
 * @param maxDistancePct - Maximum distance percentage (default: 5%)
 * @returns Filtered swings near current price
 */
export function filterNearbyLevels(
  swings: SwingPoint[],
  currentPrice: number,
  maxDistancePct: number = 5
): SwingPoint[] {
  return swings.filter(swing => {
    const distance = Math.abs(swing.price - currentPrice) / currentPrice * 100;
    return distance <= maxDistancePct;
  });
}

// ============================================================================
// HELPER: Merge levels from multiple timeframes
// ============================================================================

/**
 * Merge swing levels from multiple timeframes, boosting strength for confluence
 *
 * @param levels4H - 4-hour swing levels
 * @param levels1H - 1-hour swing levels
 * @param tolerancePct - Price tolerance for considering same level
 * @returns Merged levels with confluence boost
 */
export function mergeMTFLevels(
  levels4H: SwingPoint[],
  levels1H: SwingPoint[],
  tolerancePct: number = 0.3
): SwingPoint[] {
  const merged: SwingPoint[] = [];
  const used1H = new Set<number>();

  // Start with 4H levels (higher timeframe = higher priority)
  levels4H.forEach(level4H => {
    // Check if any 1H level is at the same price
    const matching1H = levels1H.findIndex((l1H, idx) => {
      if (used1H.has(idx) || l1H.type !== level4H.type) return false;
      const priceDiff = Math.abs(l1H.price - level4H.price) / level4H.price * 100;
      return priceDiff <= tolerancePct;
    });

    if (matching1H !== -1) {
      // Confluence! Boost the level
      used1H.add(matching1H);
      const l1H = levels1H[matching1H];

      merged.push({
        ...level4H,
        // Average the prices
        price: Number(((level4H.price + l1H.price) / 2).toFixed(2)),
        // Sum touch counts
        touchCount: level4H.touchCount + l1H.touchCount,
        // Boost strength for confluence (max 100)
        strength: Math.min(100, level4H.strength + 15),
        // Keep 4H timeframe designation since it's stronger
        timeframe: '4H',
      });
    } else {
      // No confluence, add as-is
      merged.push(level4H);
    }
  });

  // Add remaining 1H levels that weren't merged
  levels1H.forEach((level, idx) => {
    if (!used1H.has(idx)) {
      merged.push(level);
    }
  });

  // Sort by strength, then by touch count
  return merged.sort((a, b) => {
    if (b.strength !== a.strength) return b.strength - a.strength;
    return b.touchCount - a.touchCount;
  });
}

export default detectSwingPoints;
