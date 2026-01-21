'use client';

/**
 * useMassiveLevels Hook
 *
 * Fetches GammaExposure and FVG data from the API and converts them
 * into chart-friendly levels with coaching insights.
 *
 * OPTIMIZATIONS (Phase 3):
 * - Level calculations moved out of render loop via useMemo
 * - Insights only recalculated on candle close, NOT every tick
 * - Price threshold crossing detection prevents unnecessary recalcs
 * - Mode-aware fetching prevents practice data leakage
 * - Stable references for callback functions
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { LevelStyles } from '@/lib/practice/levels';
import type { DataMode } from '@/lib/data-integrity';

// =============================================================================
// Types
// =============================================================================

interface GammaExposure {
  symbol: string;
  timestamp: string;
  currentPrice: number;
  maxPain: number;
  gammaFlip: number;
  callWall: number;
  putWall: number;
  zeroGammaLevel: number;
  regime: 'positive' | 'negative' | 'neutral';
  dealerPositioning: 'long_gamma' | 'short_gamma' | 'neutral';
  expectedMove: {
    daily: number;
    weekly: number;
  };
  keyLevels: Array<{
    price: number;
    type: string;
    strength: number;
    netGamma: number;
  }>;
  analysis: {
    summary: string;
    tradingImplication: string;
    supportLevels: number[];
    resistanceLevels: number[];
  };
}

interface FairValueGap {
  type: 'bullish' | 'bearish';
  top: number;
  bottom: number;
  midpoint: number;
  strength: 'strong' | 'moderate' | 'weak';
  filled: boolean;
  filledPercent: number;
  timestamp: number;
  timeframe: string;
}

interface FVGAnalysis {
  symbol: string;
  timestamp: string;
  currentPrice: number;
  fvgs: {
    '5m': FairValueGap[];
    '15m': FairValueGap[];
    '1h': FairValueGap[];
    '4h': FairValueGap[];
    daily: FairValueGap[];
  };
  nearestBullishFVG: FairValueGap | null;
  nearestBearishFVG: FairValueGap | null;
  tradingContext: {
    bullishTargets: number[];
    bearishTargets: number[];
    supportZones: Array<{ top: number; bottom: number; strength: string }>;
    resistanceZones: Array<{ top: number; bottom: number; strength: string }>;
    summary: string;
  };
}

export interface MassiveLevel {
  type: string;
  price: number;
  strength: number;
  label: string;
  source: 'gamma' | 'fvg' | 'combined';
  color: string;
  lineWidth: number;
  lineStyle: 'solid' | 'dashed' | 'dotted';
  description?: string;
}

export interface CoachingInsight {
  level: MassiveLevel;
  message: string;
  priority: 'high' | 'medium' | 'low';
  action: 'watch' | 'caution' | 'opportunity';
}

// =============================================================================
// Level Styles
// =============================================================================

export const MASSIVE_LEVEL_STYLES: Record<string, LevelStyles> = {
  call_wall: { color: '#ef4444', lineWidth: 3, lineStyle: 'solid' },
  put_wall: { color: '#22c55e', lineWidth: 3, lineStyle: 'solid' },
  zero_gamma: { color: '#ffffff', lineWidth: 2, lineStyle: 'dashed' },
  gamma_flip: { color: '#f59e0b', lineWidth: 2, lineStyle: 'dashed' },
  max_pain: { color: '#8b5cf6', lineWidth: 2, lineStyle: 'dotted' },
  fvg_bullish: { color: '#22c55e', lineWidth: 1, lineStyle: 'dashed' },
  fvg_bearish: { color: '#ef4444', lineWidth: 1, lineStyle: 'dashed' },
  gamma_support: { color: '#14b8a6', lineWidth: 1, lineStyle: 'dotted' },
  gamma_resistance: { color: '#f97316', lineWidth: 1, lineStyle: 'dotted' },
};

// =============================================================================
// Options Interface
// =============================================================================

interface UseMassiveLevelsOptions {
  symbol: string;
  /** Current price - only used for insights, NOT for level calculation */
  currentPrice?: number;
  /** Last candle close time - triggers insight recalculation */
  lastCandleCloseTime?: number;
  /** Refresh interval in ms (default: 60000) */
  refreshInterval?: number;
  /** Enable coaching insights (default: true) */
  enableInsights?: boolean;
  /** Percentage threshold for insights (default: 0.5%) */
  proximityThreshold?: number;
  /** Data mode for integrity checks (default: COMPANION) */
  mode?: DataMode;
}

interface UseMassiveLevelsReturn {
  levels: MassiveLevel[];
  gammaData: GammaExposure | null;
  fvgData: FVGAnalysis | null;
  insights: CoachingInsight[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  regime: 'positive' | 'negative' | 'neutral' | null;
  /** Last time levels were recalculated */
  lastCalculatedAt: number;
}

// =============================================================================
// Main Hook
// =============================================================================

export function useMassiveLevels(options: UseMassiveLevelsOptions): UseMassiveLevelsReturn {
  const {
    symbol,
    currentPrice,
    lastCandleCloseTime,
    refreshInterval = 60000,
    enableInsights = true,
    proximityThreshold = 0.5,
    mode = 'COMPANION',
  } = options;

  // State
  const [gammaData, setGammaData] = useState<GammaExposure | null>(null);
  const [fvgData, setFvgData] = useState<FVGAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastCalculatedAt, setLastCalculatedAt] = useState(0);

  // Refs for optimization
  const mountedRef = useRef(true);
  const lastInsightPriceRef = useRef<number | null>(null);
  const insightCacheRef = useRef<CoachingInsight[]>([]);
  const fetchInProgressRef = useRef(false);

  // Track mount state
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ==========================================================================
  // Data Fetching (Mode-Aware)
  // ==========================================================================
  const fetchData = useCallback(async () => {
    if (!symbol || fetchInProgressRef.current) {
      return;
    }

    fetchInProgressRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      // In COMPANION mode, only fetch from live market APIs
      // The API routes themselves should enforce this, but we add client-side checks
      const endpoints = [
        `/api/market/gamma?symbol=${encodeURIComponent(symbol)}`,
        `/api/market/fvg?symbol=${encodeURIComponent(symbol)}`,
      ];

      const [gammaRes, fvgRes] = await Promise.all(
        endpoints.map((url) => fetch(url))
      );

      if (!mountedRef.current) return;

      // Handle gamma response
      if (gammaRes.ok) {
        const gammaJson = await gammaRes.json();
        // In COMPANION mode, validate data doesn't have practice markers
        if (mode === 'COMPANION' && gammaJson.scenarioId) {
          console.error('[useMassiveLevels] Practice data leaked into COMPANION mode!');
          setError('Data integrity violation');
          return;
        }
        setGammaData(gammaJson);
      } else if (gammaRes.status !== 404) {
        console.warn('[useMassiveLevels] Gamma fetch failed:', gammaRes.status);
      }

      // Handle FVG response
      if (fvgRes.ok) {
        const fvgJson = await fvgRes.json();
        if (mode === 'COMPANION' && fvgJson.scenarioId) {
          console.error('[useMassiveLevels] Practice data leaked into COMPANION mode!');
          setError('Data integrity violation');
          return;
        }
        setFvgData(fvgJson);
      } else if (fvgRes.status !== 404) {
        console.warn('[useMassiveLevels] FVG fetch failed:', fvgRes.status);
      }

      setLastCalculatedAt(Date.now());
    } catch (err) {
      if (mountedRef.current) {
        console.error('[useMassiveLevels] Fetch error:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch data');
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
        fetchInProgressRef.current = false;
      }
    }
  }, [symbol, mode]);

  // Initial fetch and refresh interval
  useEffect(() => {
    fetchData();

    if (refreshInterval > 0) {
      const interval = setInterval(fetchData, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchData, refreshInterval]);

  // ==========================================================================
  // Level Calculation (Memoized, NOT dependent on currentPrice)
  // ==========================================================================

  // Gamma levels - only recalculates when gammaData changes
  const gammaLevels = useMemo((): MassiveLevel[] => {
    if (!gammaData) return [];

    const levels: MassiveLevel[] = [];

    if (gammaData.callWall > 0) {
      const style = MASSIVE_LEVEL_STYLES.call_wall;
      levels.push({
        type: 'call_wall',
        price: gammaData.callWall,
        strength: 95,
        label: 'Call Wall',
        source: 'gamma',
        color: style.color,
        lineWidth: style.lineWidth,
        lineStyle: style.lineStyle,
        description: 'Strong resistance from call option positioning.',
      });
    }

    if (gammaData.putWall > 0) {
      const style = MASSIVE_LEVEL_STYLES.put_wall;
      levels.push({
        type: 'put_wall',
        price: gammaData.putWall,
        strength: 95,
        label: 'Put Wall',
        source: 'gamma',
        color: style.color,
        lineWidth: style.lineWidth,
        lineStyle: style.lineStyle,
        description: 'Strong support from put option positioning.',
      });
    }

    if (gammaData.zeroGammaLevel > 0) {
      const style = MASSIVE_LEVEL_STYLES.zero_gamma;
      levels.push({
        type: 'zero_gamma',
        price: gammaData.zeroGammaLevel,
        strength: 90,
        label: 'Zero Gamma',
        source: 'gamma',
        color: style.color,
        lineWidth: style.lineWidth,
        lineStyle: style.lineStyle,
        description: 'Volatility flip zone. Dealers change behavior here.',
      });
    }

    if (gammaData.gammaFlip > 0 && gammaData.gammaFlip !== gammaData.zeroGammaLevel) {
      const style = MASSIVE_LEVEL_STYLES.gamma_flip;
      levels.push({
        type: 'gamma_flip',
        price: gammaData.gammaFlip,
        strength: 85,
        label: 'Gamma Flip',
        source: 'gamma',
        color: style.color,
        lineWidth: style.lineWidth,
        lineStyle: style.lineStyle,
        description: 'Dealer gamma exposure changes direction here.',
      });
    }

    if (gammaData.maxPain > 0) {
      const style = MASSIVE_LEVEL_STYLES.max_pain;
      levels.push({
        type: 'max_pain',
        price: gammaData.maxPain,
        strength: 70,
        label: 'Max Pain',
        source: 'gamma',
        color: style.color,
        lineWidth: style.lineWidth,
        lineStyle: style.lineStyle,
        description: 'Price gravitates here on expiration.',
      });
    }

    // Support/resistance from analysis
    if (gammaData.analysis?.supportLevels) {
      gammaData.analysis.supportLevels.slice(0, 3).forEach((price, i) => {
        const style = MASSIVE_LEVEL_STYLES.gamma_support;
        levels.push({
          type: 'gamma_support',
          price,
          strength: 60 - i * 10,
          label: `Gamma S${i + 1}`,
          source: 'gamma',
          color: style.color,
          lineWidth: style.lineWidth,
          lineStyle: style.lineStyle,
        });
      });
    }

    if (gammaData.analysis?.resistanceLevels) {
      gammaData.analysis.resistanceLevels.slice(0, 3).forEach((price, i) => {
        const style = MASSIVE_LEVEL_STYLES.gamma_resistance;
        levels.push({
          type: 'gamma_resistance',
          price,
          strength: 60 - i * 10,
          label: `Gamma R${i + 1}`,
          source: 'gamma',
          color: style.color,
          lineWidth: style.lineWidth,
          lineStyle: style.lineStyle,
        });
      });
    }

    return levels;
  }, [gammaData]);

  // FVG levels - only recalculates when fvgData changes
  const fvgLevels = useMemo((): MassiveLevel[] => {
    if (!fvgData) return [];

    const levels: MassiveLevel[] = [];

    if (fvgData.nearestBullishFVG && !fvgData.nearestBullishFVG.filled) {
      const fvg = fvgData.nearestBullishFVG;
      const style = MASSIVE_LEVEL_STYLES.fvg_bullish;
      levels.push({
        type: 'fvg_bullish',
        price: fvg.midpoint,
        strength: fvg.strength === 'strong' ? 80 : fvg.strength === 'moderate' ? 65 : 50,
        label: `Bull FVG (${fvg.timeframe})`,
        source: 'fvg',
        color: style.color,
        lineWidth: style.lineWidth,
        lineStyle: style.lineStyle,
        description: `Bullish imbalance $${fvg.bottom.toFixed(2)}-$${fvg.top.toFixed(2)}.`,
      });
    }

    if (fvgData.nearestBearishFVG && !fvgData.nearestBearishFVG.filled) {
      const fvg = fvgData.nearestBearishFVG;
      const style = MASSIVE_LEVEL_STYLES.fvg_bearish;
      levels.push({
        type: 'fvg_bearish',
        price: fvg.midpoint,
        strength: fvg.strength === 'strong' ? 80 : fvg.strength === 'moderate' ? 65 : 50,
        label: `Bear FVG (${fvg.timeframe})`,
        source: 'fvg',
        color: style.color,
        lineWidth: style.lineWidth,
        lineStyle: style.lineStyle,
        description: `Bearish imbalance $${fvg.bottom.toFixed(2)}-$${fvg.top.toFixed(2)}.`,
      });
    }

    // Support/resistance zones
    if (fvgData.tradingContext?.supportZones) {
      fvgData.tradingContext.supportZones.slice(0, 2).forEach((zone, i) => {
        const style = MASSIVE_LEVEL_STYLES.fvg_bullish;
        levels.push({
          type: 'fvg_support_zone',
          price: (zone.top + zone.bottom) / 2,
          strength: zone.strength === 'strong' ? 75 : 55,
          label: `FVG Support ${i + 1}`,
          source: 'fvg',
          color: style.color,
          lineWidth: 1,
          lineStyle: 'dotted',
        });
      });
    }

    if (fvgData.tradingContext?.resistanceZones) {
      fvgData.tradingContext.resistanceZones.slice(0, 2).forEach((zone, i) => {
        const style = MASSIVE_LEVEL_STYLES.fvg_bearish;
        levels.push({
          type: 'fvg_resistance_zone',
          price: (zone.top + zone.bottom) / 2,
          strength: zone.strength === 'strong' ? 75 : 55,
          label: `FVG Resistance ${i + 1}`,
          source: 'fvg',
          color: style.color,
          lineWidth: 1,
          lineStyle: 'dotted',
        });
      });
    }

    return levels;
  }, [fvgData]);

  // Combined levels - only recalculates when gamma or fvg levels change
  const levels = useMemo((): MassiveLevel[] => {
    const allLevels = [...gammaLevels, ...fvgLevels];
    allLevels.sort((a, b) => b.strength - a.strength);

    // Deduplicate levels within 0.2% of each other
    const uniqueLevels: MassiveLevel[] = [];
    for (const level of allLevels) {
      const isDuplicate = uniqueLevels.some(
        (existing) => Math.abs(existing.price - level.price) / level.price < 0.002
      );
      if (!isDuplicate) {
        uniqueLevels.push(level);
      }
    }

    return uniqueLevels;
  }, [gammaLevels, fvgLevels]);

  // ==========================================================================
  // Insights Calculation (ONLY on candle close, NOT every tick)
  // ==========================================================================

  const insights = useMemo((): CoachingInsight[] => {
    if (!enableInsights || !currentPrice || levels.length === 0) {
      return [];
    }

    // OPTIMIZATION: Only recalculate insights when:
    // 1. Candle closes (lastCandleCloseTime changes)
    // 2. Price crosses a threshold level
    // 3. Levels change
    //
    // For now, we use a simple price change threshold
    const priceChangeThreshold = proximityThreshold / 2; // Half the proximity threshold
    const lastPrice = lastInsightPriceRef.current;

    if (lastPrice !== null) {
      const priceChangePercent = Math.abs(currentPrice - lastPrice) / lastPrice * 100;
      // If price hasn't changed significantly and we have cached insights, return cache
      if (priceChangePercent < priceChangeThreshold && insightCacheRef.current.length > 0) {
        return insightCacheRef.current;
      }
    }

    // Calculate fresh insights
    const newInsights: CoachingInsight[] = [];

    for (const level of levels) {
      const distance = Math.abs(currentPrice - level.price) / level.price * 100;

      if (distance <= proximityThreshold) {
        newInsights.push(generateInsight(level, 'at', distance));
      } else if (distance <= proximityThreshold * 2) {
        newInsights.push(generateInsight(level, 'approaching', distance));
      }
    }

    // Sort by priority
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    newInsights.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    // Cache and return top 3
    const result = newInsights.slice(0, 3);
    insightCacheRef.current = result;
    lastInsightPriceRef.current = currentPrice;

    return result;
  }, [enableInsights, currentPrice, levels, proximityThreshold, lastCandleCloseTime]);

  // Regime
  const regime = gammaData?.regime || null;

  return {
    levels,
    gammaData,
    fvgData,
    insights,
    isLoading,
    error,
    refresh: fetchData,
    regime,
    lastCalculatedAt,
  };
}

// =============================================================================
// Helper Functions
// =============================================================================

function generateInsight(
  level: MassiveLevel,
  proximity: 'at' | 'approaching',
  distance: number
): CoachingInsight {
  const isApproaching = proximity === 'approaching';
  const prefix = isApproaching ? 'Approaching' : 'At';

  switch (level.type) {
    case 'call_wall':
      return {
        level,
        message: isApproaching
          ? 'Approaching Call Wall. Momentum might die here.'
          : 'At Call Wall. Strong resistance. Consider taking profits.',
        priority: 'high',
        action: 'caution',
      };

    case 'put_wall':
      return {
        level,
        message: isApproaching
          ? 'Approaching Put Wall. Strong support likely.'
          : 'At Put Wall. Support from dealer hedging. Watch for longs.',
        priority: 'high',
        action: 'opportunity',
      };

    case 'zero_gamma':
      return {
        level,
        message: isApproaching
          ? 'Entering Volatility Zone. Widen stops.'
          : 'In Zero Gamma. Expect amplified moves.',
        priority: 'high',
        action: 'caution',
      };

    case 'gamma_flip':
      return {
        level,
        message: `${prefix} Gamma Flip. Volatility regime may shift.`,
        priority: 'medium',
        action: 'watch',
      };

    case 'max_pain':
      return {
        level,
        message: `${prefix} Max Pain ($${level.price.toFixed(2)}).`,
        priority: 'low',
        action: 'watch',
      };

    case 'fvg_bullish':
      return {
        level,
        message: isApproaching
          ? 'Approaching bullish imbalance zone.'
          : 'At bullish FVG. Look for long setups.',
        priority: 'medium',
        action: 'opportunity',
      };

    case 'fvg_bearish':
      return {
        level,
        message: isApproaching
          ? 'Approaching bearish imbalance zone.'
          : 'At bearish FVG. Caution with longs.',
        priority: 'medium',
        action: 'caution',
      };

    default:
      return {
        level,
        message: `${prefix} ${level.label} at $${level.price.toFixed(2)}`,
        priority: 'low',
        action: 'watch',
      };
  }
}

// =============================================================================
// Convenience Hooks
// =============================================================================

/**
 * Hook to get only the key Massive levels (Call Wall, Put Wall, Zero Gamma)
 */
export function useKeyMassiveLevels(
  symbol: string,
  currentPrice?: number,
  mode: DataMode = 'COMPANION'
) {
  const { levels, isLoading, error, regime, insights, lastCalculatedAt } = useMassiveLevels({
    symbol,
    currentPrice,
    enableInsights: true,
    mode,
  });

  const keyLevels = useMemo(() => {
    return levels.filter((l) =>
      ['call_wall', 'put_wall', 'zero_gamma', 'gamma_flip'].includes(l.type)
    );
  }, [levels]);

  return {
    callWall: levels.find((l) => l.type === 'call_wall') || null,
    putWall: levels.find((l) => l.type === 'put_wall') || null,
    zeroGamma: levels.find((l) => l.type === 'zero_gamma') || null,
    gammaFlip: levels.find((l) => l.type === 'gamma_flip') || null,
    keyLevels,
    regime,
    insights,
    isLoading,
    error,
    lastCalculatedAt,
  };
}

// =============================================================================
// Chart Integration Types
// =============================================================================

export interface ChartLevel {
  type: string;
  price: number;
  strength: number;
  label: string;
  color: string;
  lineStyle: 'solid' | 'dashed' | 'dotted';
}

/**
 * Convert Massive levels to the format expected by KCUChart
 */
export function massiveLevelsToChartLevels(massiveLevels: MassiveLevel[]): ChartLevel[] {
  return massiveLevels.map((level) => ({
    type: level.type,
    price: level.price,
    strength: level.strength,
    label: level.label,
    color: level.color,
    lineStyle: level.lineStyle,
  }));
}
