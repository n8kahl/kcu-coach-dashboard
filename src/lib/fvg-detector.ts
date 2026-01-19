/**
 * Fair Value Gap (FVG) Detection Service
 *
 * Identifies Fair Value Gaps (imbalances) in price action that may
 * act as magnets for price or provide support/resistance.
 *
 * An FVG occurs when there's a gap between:
 * - Bullish FVG: Previous candle's high and current candle's low
 * - Bearish FVG: Previous candle's low and current candle's high
 */

import { marketDataService } from './market-data';

export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface FairValueGap {
  id: string;
  type: 'bullish' | 'bearish';
  timeframe: string;
  startTime: number;
  endTime: number;
  topPrice: number;
  bottomPrice: number;
  midPrice: number;
  gapSize: number;
  gapSizePercent: number;
  filled: boolean;
  fillPercent: number;
  strength: 'strong' | 'medium' | 'weak';
  formationCandles: {
    candle1: Candle;
    candle2: Candle;
    candle3: Candle;
  };
  context: {
    trendDirection: 'up' | 'down' | 'sideways';
    volumeProfile: 'high' | 'normal' | 'low';
    nearLevel: boolean;
  };
}

export interface FVGAnalysis {
  symbol: string;
  timestamp: string;
  currentPrice: number;
  fvgs: {
    '5m': FairValueGap[];
    '15m': FairValueGap[];
    '1h': FairValueGap[];
    '4h': FairValueGap[];
    'daily': FairValueGap[];
  };
  nearestBullishFVG: FairValueGap | null;
  nearestBearishFVG: FairValueGap | null;
  tradingContext: {
    bullishTargets: number[];
    bearishTargets: number[];
    supportZones: { top: number; bottom: number; strength: string }[];
    resistanceZones: { top: number; bottom: number; strength: string }[];
    summary: string;
  };
}

class FVGDetector {
  /**
   * Detect FVGs in a series of candles
   */
  detectFVGs(
    candles: Candle[],
    timeframe: string,
    currentPrice: number,
    minGapPercent: number = 0.1
  ): FairValueGap[] {
    const fvgs: FairValueGap[] = [];

    if (candles.length < 3) return fvgs;

    // Sort candles by timestamp (oldest first)
    const sortedCandles = [...candles].sort((a, b) => a.timestamp - b.timestamp);

    // Calculate average volume for context
    const avgVolume = sortedCandles.reduce((sum, c) => sum + c.volume, 0) / sortedCandles.length;

    // Calculate average true range for strength assessment
    let atrSum = 0;
    for (let i = 1; i < sortedCandles.length; i++) {
      const tr = Math.max(
        sortedCandles[i].high - sortedCandles[i].low,
        Math.abs(sortedCandles[i].high - sortedCandles[i - 1].close),
        Math.abs(sortedCandles[i].low - sortedCandles[i - 1].close)
      );
      atrSum += tr;
    }
    const atr = atrSum / (sortedCandles.length - 1);

    // Detect FVGs using 3-candle patterns
    for (let i = 2; i < sortedCandles.length; i++) {
      const candle1 = sortedCandles[i - 2]; // First candle
      const candle2 = sortedCandles[i - 1]; // Middle candle (creates the gap)
      const candle3 = sortedCandles[i];     // Third candle

      // Check for Bullish FVG
      // Gap between candle1's high and candle3's low
      if (candle3.low > candle1.high) {
        const gapTop = candle3.low;
        const gapBottom = candle1.high;
        const gapSize = gapTop - gapBottom;
        const gapSizePercent = (gapSize / candle2.close) * 100;

        if (gapSizePercent >= minGapPercent) {
          // Calculate fill percentage
          let fillPercent = 0;
          if (currentPrice <= gapBottom) {
            fillPercent = 100;
          } else if (currentPrice < gapTop) {
            fillPercent = ((gapTop - currentPrice) / gapSize) * 100;
          }

          // Determine strength
          const strength = this.calculateStrength(gapSize, atr, candle2.volume, avgVolume);

          // Determine trend context
          const trendDirection = this.determineTrend(sortedCandles.slice(Math.max(0, i - 10), i));

          // Volume profile
          const volumeProfile = candle2.volume > avgVolume * 1.5 ? 'high' :
                               candle2.volume < avgVolume * 0.5 ? 'low' : 'normal';

          fvgs.push({
            id: `fvg_bullish_${timeframe}_${candle2.timestamp}`,
            type: 'bullish',
            timeframe,
            startTime: candle1.timestamp,
            endTime: candle3.timestamp,
            topPrice: gapTop,
            bottomPrice: gapBottom,
            midPrice: (gapTop + gapBottom) / 2,
            gapSize,
            gapSizePercent,
            filled: fillPercent >= 100,
            fillPercent: Math.min(100, fillPercent),
            strength,
            formationCandles: { candle1, candle2, candle3 },
            context: {
              trendDirection,
              volumeProfile,
              nearLevel: false // Will be updated when we have level data
            }
          });
        }
      }

      // Check for Bearish FVG
      // Gap between candle1's low and candle3's high
      if (candle3.high < candle1.low) {
        const gapTop = candle1.low;
        const gapBottom = candle3.high;
        const gapSize = gapTop - gapBottom;
        const gapSizePercent = (gapSize / candle2.close) * 100;

        if (gapSizePercent >= minGapPercent) {
          // Calculate fill percentage
          let fillPercent = 0;
          if (currentPrice >= gapTop) {
            fillPercent = 100;
          } else if (currentPrice > gapBottom) {
            fillPercent = ((currentPrice - gapBottom) / gapSize) * 100;
          }

          // Determine strength
          const strength = this.calculateStrength(gapSize, atr, candle2.volume, avgVolume);

          // Determine trend context
          const trendDirection = this.determineTrend(sortedCandles.slice(Math.max(0, i - 10), i));

          // Volume profile
          const volumeProfile = candle2.volume > avgVolume * 1.5 ? 'high' :
                               candle2.volume < avgVolume * 0.5 ? 'low' : 'normal';

          fvgs.push({
            id: `fvg_bearish_${timeframe}_${candle2.timestamp}`,
            type: 'bearish',
            timeframe,
            startTime: candle1.timestamp,
            endTime: candle3.timestamp,
            topPrice: gapTop,
            bottomPrice: gapBottom,
            midPrice: (gapTop + gapBottom) / 2,
            gapSize,
            gapSizePercent,
            filled: fillPercent >= 100,
            fillPercent: Math.min(100, fillPercent),
            strength,
            formationCandles: { candle1, candle2, candle3 },
            context: {
              trendDirection,
              volumeProfile,
              nearLevel: false
            }
          });
        }
      }
    }

    // Filter out filled FVGs and sort by relevance (distance to current price)
    return fvgs
      .filter(fvg => !fvg.filled)
      .sort((a, b) => {
        const distA = Math.min(
          Math.abs(currentPrice - a.topPrice),
          Math.abs(currentPrice - a.bottomPrice)
        );
        const distB = Math.min(
          Math.abs(currentPrice - b.topPrice),
          Math.abs(currentPrice - b.bottomPrice)
        );
        return distA - distB;
      })
      .slice(0, 10); // Keep top 10 most relevant
  }

  /**
   * Calculate FVG strength based on size, ATR, and volume
   */
  private calculateStrength(
    gapSize: number,
    atr: number,
    gapVolume: number,
    avgVolume: number
  ): 'strong' | 'medium' | 'weak' {
    const sizeScore = gapSize / atr;
    const volumeScore = gapVolume / avgVolume;

    const totalScore = sizeScore * 0.6 + volumeScore * 0.4;

    if (totalScore > 1.5) return 'strong';
    if (totalScore > 0.8) return 'medium';
    return 'weak';
  }

  /**
   * Determine trend direction from recent candles
   */
  private determineTrend(candles: Candle[]): 'up' | 'down' | 'sideways' {
    if (candles.length < 3) return 'sideways';

    const first = candles[0];
    const last = candles[candles.length - 1];

    const priceChange = (last.close - first.close) / first.close;

    if (priceChange > 0.01) return 'up';
    if (priceChange < -0.01) return 'down';
    return 'sideways';
  }

  /**
   * Get comprehensive FVG analysis for a symbol across multiple timeframes
   */
  async getFullAnalysis(symbol: string): Promise<FVGAnalysis> {
    const quote = await marketDataService.getQuote(symbol);
    const currentPrice = quote?.price || 0;

    // Fetch candle data for each timeframe
    const timeframes = [
      { key: '5m' as const, multiplier: 5, span: 'minute', bars: 100 },
      { key: '15m' as const, multiplier: 15, span: 'minute', bars: 100 },
      { key: '1h' as const, multiplier: 1, span: 'hour', bars: 100 },
      { key: '4h' as const, multiplier: 4, span: 'hour', bars: 50 },
      { key: 'daily' as const, multiplier: 1, span: 'day', bars: 30 }
    ];

    const fvgsByTimeframe: FVGAnalysis['fvgs'] = {
      '5m': [],
      '15m': [],
      '1h': [],
      '4h': [],
      'daily': []
    };

    // Calculate dates for data fetch
    const now = Date.now();

    for (const tf of timeframes) {
      try {
        // Calculate start date based on bars needed
        let startDate: Date;
        if (tf.span === 'minute') {
          startDate = new Date(now - tf.bars * tf.multiplier * 60 * 1000);
        } else if (tf.span === 'hour') {
          startDate = new Date(now - tf.bars * tf.multiplier * 60 * 60 * 1000);
        } else {
          startDate = new Date(now - tf.bars * 24 * 60 * 60 * 1000);
        }

        const aggregates = await marketDataService.getHistoricalBars(
          symbol,
          startDate.toISOString().split('T')[0],
          new Date().toISOString().split('T')[0],
          tf.span as 'minute' | 'hour' | 'day',
          tf.multiplier
        );

        if (aggregates && aggregates.length > 0) {
          const candles: Candle[] = aggregates.map(bar => ({
            timestamp: bar.t,
            open: bar.o,
            high: bar.h,
            low: bar.l,
            close: bar.c,
            volume: bar.v
          }));

          const minGapPercent = tf.span === 'minute' ? 0.05 : 0.1;
          fvgsByTimeframe[tf.key] = this.detectFVGs(candles, tf.key, currentPrice, minGapPercent);
        }
      } catch (error) {
        console.error(`[FVG] Error fetching ${tf.key} data for ${symbol}:`, error);
      }
    }

    // Find nearest FVGs
    let nearestBullishFVG: FairValueGap | null = null;
    let nearestBearishFVG: FairValueGap | null = null;
    let nearestBullishDistance = Infinity;
    let nearestBearishDistance = Infinity;

    const allFVGs = Object.values(fvgsByTimeframe).flat();

    for (const fvg of allFVGs) {
      if (fvg.type === 'bullish' && fvg.topPrice < currentPrice) {
        const distance = currentPrice - fvg.topPrice;
        if (distance < nearestBullishDistance) {
          nearestBullishDistance = distance;
          nearestBullishFVG = fvg;
        }
      } else if (fvg.type === 'bearish' && fvg.bottomPrice > currentPrice) {
        const distance = fvg.bottomPrice - currentPrice;
        if (distance < nearestBearishDistance) {
          nearestBearishDistance = distance;
          nearestBearishFVG = fvg;
        }
      }
    }

    // Build trading context
    const bullishTargets = allFVGs
      .filter(f => f.type === 'bearish' && f.bottomPrice > currentPrice)
      .sort((a, b) => a.bottomPrice - b.bottomPrice)
      .slice(0, 3)
      .map(f => f.midPrice);

    const bearishTargets = allFVGs
      .filter(f => f.type === 'bullish' && f.topPrice < currentPrice)
      .sort((a, b) => b.topPrice - a.topPrice)
      .slice(0, 3)
      .map(f => f.midPrice);

    const supportZones = allFVGs
      .filter(f => f.type === 'bullish' && f.topPrice < currentPrice)
      .map(f => ({
        top: f.topPrice,
        bottom: f.bottomPrice,
        strength: f.strength
      }))
      .slice(0, 3);

    const resistanceZones = allFVGs
      .filter(f => f.type === 'bearish' && f.bottomPrice > currentPrice)
      .map(f => ({
        top: f.topPrice,
        bottom: f.bottomPrice,
        strength: f.strength
      }))
      .slice(0, 3);

    // Generate summary
    let summary = '';
    const totalFVGs = allFVGs.length;
    const bullishCount = allFVGs.filter(f => f.type === 'bullish').length;
    const bearishCount = allFVGs.filter(f => f.type === 'bearish').length;

    if (totalFVGs === 0) {
      summary = `No significant Fair Value Gaps detected near current price for ${symbol}.`;
    } else {
      summary = `Found ${totalFVGs} unfilled FVGs (${bullishCount} bullish, ${bearishCount} bearish). `;

      if (nearestBullishFVG) {
        const distPct = ((currentPrice - nearestBullishFVG.topPrice) / currentPrice * 100).toFixed(2);
        summary += `Nearest bullish FVG at $${nearestBullishFVG.midPrice.toFixed(2)} (${distPct}% below). `;
      }

      if (nearestBearishFVG) {
        const distPct = ((nearestBearishFVG.bottomPrice - currentPrice) / currentPrice * 100).toFixed(2);
        summary += `Nearest bearish FVG at $${nearestBearishFVG.midPrice.toFixed(2)} (${distPct}% above).`;
      }
    }

    return {
      symbol,
      timestamp: new Date().toISOString(),
      currentPrice,
      fvgs: fvgsByTimeframe,
      nearestBullishFVG,
      nearestBearishFVG,
      tradingContext: {
        bullishTargets,
        bearishTargets,
        supportZones,
        resistanceZones,
        summary
      }
    };
  }
}

export const fvgDetector = new FVGDetector();
