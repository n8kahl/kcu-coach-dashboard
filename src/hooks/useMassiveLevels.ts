'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { LevelStyles } from '@/lib/practice/levels';

/**
 * Massive Data Levels Hook
 *
 * Fetches GammaExposure and FVG data from the API and converts them
 * into chart-friendly levels with coaching insights.
 */

// Gamma Exposure types from API
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

// FVG types from API
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

// Massive level for chart display
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

// Coaching insight when price approaches levels
export interface CoachingInsight {
  level: MassiveLevel;
  message: string;
  priority: 'high' | 'medium' | 'low';
  action: 'watch' | 'caution' | 'opportunity';
}

// Level style configurations for Massive data
export const MASSIVE_LEVEL_STYLES: Record<string, LevelStyles> = {
  call_wall: { color: '#ef4444', lineWidth: 3, lineStyle: 'solid' }, // Red - Resistance
  put_wall: { color: '#22c55e', lineWidth: 3, lineStyle: 'solid' }, // Green - Support
  zero_gamma: { color: '#ffffff', lineWidth: 2, lineStyle: 'dashed' }, // White - Volatility Flip
  gamma_flip: { color: '#f59e0b', lineWidth: 2, lineStyle: 'dashed' }, // Amber - Gamma Flip
  max_pain: { color: '#8b5cf6', lineWidth: 2, lineStyle: 'dotted' }, // Purple - Max Pain
  fvg_bullish: { color: '#22c55e', lineWidth: 1, lineStyle: 'dashed' }, // Green - Bullish FVG
  fvg_bearish: { color: '#ef4444', lineWidth: 1, lineStyle: 'dashed' }, // Red - Bearish FVG
  gamma_support: { color: '#14b8a6', lineWidth: 1, lineStyle: 'dotted' }, // Teal - Gamma Support
  gamma_resistance: { color: '#f97316', lineWidth: 1, lineStyle: 'dotted' }, // Orange - Gamma Resistance
};

interface UseMassiveLevelsOptions {
  symbol: string;
  currentPrice?: number;
  refreshInterval?: number; // ms, default 60000 (1 min)
  enableInsights?: boolean;
  proximityThreshold?: number; // Percentage for coaching insights, default 0.5%
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
}

export function useMassiveLevels(options: UseMassiveLevelsOptions): UseMassiveLevelsReturn {
  const {
    symbol,
    currentPrice,
    refreshInterval = 60000,
    enableInsights = true,
    proximityThreshold = 0.5,
  } = options;

  const [gammaData, setGammaData] = useState<GammaExposure | null>(null);
  const [fvgData, setFvgData] = useState<FVGAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch both data sources
  const fetchData = useCallback(async () => {
    if (!symbol) {
      setError('Symbol is required');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Fetch both endpoints in parallel
      const [gammaRes, fvgRes] = await Promise.all([
        fetch(`/api/market/gamma?symbol=${encodeURIComponent(symbol)}`),
        fetch(`/api/market/fvg?symbol=${encodeURIComponent(symbol)}`),
      ]);

      // Handle gamma response
      if (gammaRes.ok) {
        const gammaJson = await gammaRes.json();
        setGammaData(gammaJson);
      } else if (gammaRes.status !== 404) {
        console.warn('Failed to fetch gamma data:', gammaRes.status);
      }

      // Handle FVG response
      if (fvgRes.ok) {
        const fvgJson = await fvgRes.json();
        setFvgData(fvgJson);
      } else if (fvgRes.status !== 404) {
        console.warn('Failed to fetch FVG data:', fvgRes.status);
      }
    } catch (err) {
      console.error('Error fetching Massive data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setIsLoading(false);
    }
  }, [symbol]);

  // Initial fetch and refresh interval
  useEffect(() => {
    fetchData();

    if (refreshInterval > 0) {
      const interval = setInterval(fetchData, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchData, refreshInterval]);

  // Convert Gamma data to chart levels
  const gammaLevels = useMemo((): MassiveLevel[] => {
    if (!gammaData) return [];

    const levels: MassiveLevel[] = [];

    // Call Wall - Solid Red Line (Resistance)
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
        description: 'Strong resistance from call option positioning. Momentum likely to stall.',
      });
    }

    // Put Wall - Solid Green Line (Support)
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
        description: 'Strong support from put option positioning. Expect bounce here.',
      });
    }

    // Zero Gamma - Dashed White Line (Volatility Flip zone)
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
        description: 'Volatility flip zone. Dealers change from dampening to amplifying moves.',
      });
    }

    // Gamma Flip - Where dealer positioning changes
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

    // Max Pain - Where most options expire worthless
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
        description: 'Price gravitates here on expiration. Most options expire worthless.',
      });
    }

    // Additional gamma support/resistance levels
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

  // Convert FVG data to chart levels
  const fvgLevels = useMemo((): MassiveLevel[] => {
    if (!fvgData) return [];

    const levels: MassiveLevel[] = [];

    // Nearest bullish FVG (support)
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
        description: `Bullish imbalance zone $${fvg.bottom.toFixed(2)}-$${fvg.top.toFixed(2)}. Price may bounce here.`,
      });
    }

    // Nearest bearish FVG (resistance)
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
        description: `Bearish imbalance zone $${fvg.bottom.toFixed(2)}-$${fvg.top.toFixed(2)}. Price may reject here.`,
      });
    }

    // Add support zones from FVG trading context
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

    // Add resistance zones from FVG trading context
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

  // Combine all levels
  const levels = useMemo((): MassiveLevel[] => {
    const allLevels = [...gammaLevels, ...fvgLevels];

    // Sort by strength (highest first)
    allLevels.sort((a, b) => b.strength - a.strength);

    // Remove duplicates (levels within 0.2% of each other)
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

  // Generate coaching insights based on current price proximity
  const insights = useMemo((): CoachingInsight[] => {
    if (!enableInsights || !currentPrice || levels.length === 0) {
      return [];
    }

    const insights: CoachingInsight[] = [];

    for (const level of levels) {
      const distance = Math.abs(currentPrice - level.price) / level.price * 100;

      if (distance <= proximityThreshold) {
        // Price is AT the level
        insights.push(generateInsight(level, 'at', distance));
      } else if (distance <= proximityThreshold * 2) {
        // Price is APPROACHING the level
        insights.push(generateInsight(level, 'approaching', distance));
      }
    }

    // Sort by priority
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    insights.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return insights.slice(0, 3); // Return top 3 insights
  }, [enableInsights, currentPrice, levels, proximityThreshold]);

  // Determine current regime
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
  };
}

/**
 * Generate a coaching insight based on level type and proximity
 */
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
          ? 'Approaching Call Wall. Momentum might die here. Watch for rejects.'
          : 'At Call Wall. Strong resistance from dealer hedging. Consider taking profits on longs.',
        priority: 'high',
        action: 'caution',
      };

    case 'put_wall':
      return {
        level,
        message: isApproaching
          ? 'Approaching Put Wall. Strong support likely. Watch for bounce setups.'
          : 'At Put Wall. Dealer hedging provides support. Consider long entries here.',
        priority: 'high',
        action: 'opportunity',
      };

    case 'zero_gamma':
      return {
        level,
        message: isApproaching
          ? 'Entering Volatility Zone. Stops might get hunted. Widen your stops.'
          : 'In Zero Gamma territory. Expect amplified moves. Dealers no longer dampening volatility.',
        priority: 'high',
        action: 'caution',
      };

    case 'gamma_flip':
      return {
        level,
        message: `${prefix} Gamma Flip level. Dealer positioning changes here. Volatility regime may shift.`,
        priority: 'medium',
        action: 'watch',
      };

    case 'max_pain':
      return {
        level,
        message: `${prefix} Max Pain ($${level.price.toFixed(2)}). Price gravitates here into expiration.`,
        priority: 'low',
        action: 'watch',
      };

    case 'fvg_bullish':
      return {
        level,
        message: isApproaching
          ? 'Approaching bullish imbalance zone. Buyers stepped in hard here before.'
          : 'At bullish FVG. This gap may act as support. Look for long setups.',
        priority: 'medium',
        action: 'opportunity',
      };

    case 'fvg_bearish':
      return {
        level,
        message: isApproaching
          ? 'Approaching bearish imbalance zone. Sellers dominated here before.'
          : 'At bearish FVG. This gap may act as resistance. Be cautious with longs.',
        priority: 'medium',
        action: 'caution',
      };

    default:
      return {
        level,
        message: `${prefix} ${level.label} at $${level.price.toFixed(2)} (${distance.toFixed(2)}% away)`,
        priority: 'low',
        action: 'watch',
      };
  }
}

/**
 * Helper hook to get only the key Massive levels (Call Wall, Put Wall, Zero Gamma)
 */
export function useKeyMassiveLevels(symbol: string, currentPrice?: number) {
  const { levels, isLoading, error, regime, insights } = useMassiveLevels({
    symbol,
    currentPrice,
    enableInsights: true,
  });

  // Filter to only the most important levels
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
  };
}

// Chart level format for KCUChart integration
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
