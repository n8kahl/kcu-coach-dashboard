/**
 * Practice Mode - Technical Indicator Calculations
 *
 * Provides EMA, VWAP, EMA Ribbon, and other indicators
 * used in the multi-timeframe practice charts.
 */

export interface Bar {
  t: number; // timestamp in ms
  o: number; // open
  h: number; // high
  l: number; // low
  c: number; // close
  v: number; // volume
}

export interface RibbonState {
  color: 'bullish' | 'bearish' | 'neutral';
  strength: number; // 0-100 based on EMA separation
  topEMA: number;
  bottomEMA: number;
  expanding: boolean;
  contracting: boolean;
}

export interface RibbonData {
  emas: number[][]; // Array of EMA arrays for each period
  states: RibbonState[];
  periods: number[];
}

export interface CalculatedIndicators {
  ema9: number[];
  ema21: number[];
  sma200?: number[];
  vwap?: number[];
  emaRibbon?: RibbonData;
}

export interface TimeframeIndicators {
  daily: {
    ema9: number[];
    ema21: number[];
    sma200: number[];
  };
  hourly: {
    ema9: number[];
    ema21: number[];
    vwap: number[];
  };
  fifteenMin: {
    ema9: number[];
    ema21: number[];
    vwap: number[];
    emaRibbon: RibbonData;
  };
  fiveMin: {
    ema9: number[];
    ema21: number[];
    vwap: number[];
    emaRibbon: RibbonData;
  };
  twoMin: {
    ema9: number[];
    ema21: number[];
    vwap: number[];
  };
}

/**
 * Calculate Exponential Moving Average
 */
export function calculateEMA(prices: number[], period: number): number[] {
  if (prices.length === 0) return [];

  const ema: number[] = [];
  const multiplier = 2 / (period + 1);

  // Start with SMA for first value
  let sum = 0;
  for (let i = 0; i < period && i < prices.length; i++) {
    sum += prices[i];
    ema.push(sum / (i + 1)); // Running average until we have enough data
  }

  // Calculate EMA for remaining values
  for (let i = period; i < prices.length; i++) {
    const value = (prices[i] - ema[i - 1]) * multiplier + ema[i - 1];
    ema.push(value);
  }

  return ema;
}

/**
 * Calculate Simple Moving Average
 */
export function calculateSMA(prices: number[], period: number): number[] {
  if (prices.length === 0) return [];

  const sma: number[] = [];

  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      // Not enough data yet, use running average
      let sum = 0;
      for (let j = 0; j <= i; j++) {
        sum += prices[j];
      }
      sma.push(sum / (i + 1));
    } else {
      // Full period available
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) {
        sum += prices[j];
      }
      sma.push(sum / period);
    }
  }

  return sma;
}

/**
 * Calculate VWAP (Volume Weighted Average Price)
 * Resets at market open each day
 */
export function calculateVWAP(bars: Bar[]): number[] {
  if (bars.length === 0) return [];

  const vwap: number[] = [];
  let cumulativeTPV = 0;
  let cumulativeVolume = 0;
  let lastDate: string | null = null;

  for (const bar of bars) {
    const barDate = new Date(bar.t).toISOString().split('T')[0];

    // Reset VWAP at new trading day
    if (lastDate !== null && barDate !== lastDate) {
      cumulativeTPV = 0;
      cumulativeVolume = 0;
    }
    lastDate = barDate;

    const typicalPrice = (bar.h + bar.l + bar.c) / 3;
    cumulativeTPV += typicalPrice * bar.v;
    cumulativeVolume += bar.v;

    vwap.push(cumulativeVolume > 0 ? cumulativeTPV / cumulativeVolume : typicalPrice);
  }

  return vwap;
}

/**
 * EMA Ribbon Configuration (approximates Ripster Clouds)
 */
const EMA_RIBBON_PERIODS = [8, 10, 12, 14, 16, 18, 20, 21];

/**
 * Calculate EMA Ribbon for cloud approximation
 */
export function calculateEMARibbon(prices: number[]): RibbonData {
  if (prices.length === 0) {
    return { emas: [], states: [], periods: EMA_RIBBON_PERIODS };
  }

  const emas = EMA_RIBBON_PERIODS.map((p) => calculateEMA(prices, p));

  // For each bar, determine ribbon state
  const states: RibbonState[] = [];

  for (let i = 0; i < prices.length; i++) {
    const values = emas.map((ema) => ema[i] || 0);
    const validValues = values.filter((v) => v > 0);

    if (validValues.length < 2) {
      states.push({
        color: 'neutral',
        strength: 0,
        topEMA: values[0] || prices[i],
        bottomEMA: values[values.length - 1] || prices[i],
        expanding: false,
        contracting: false,
      });
      continue;
    }

    // Check if bullish stacking (shorter EMAs above longer)
    let bullishCount = 0;
    let bearishCount = 0;

    for (let j = 0; j < validValues.length - 1; j++) {
      if (validValues[j] > validValues[j + 1]) bullishCount++;
      else if (validValues[j] < validValues[j + 1]) bearishCount++;
    }

    const totalComparisons = validValues.length - 1;

    let color: 'bullish' | 'bearish' | 'neutral';
    if (bullishCount >= totalComparisons * 0.7) color = 'bullish';
    else if (bearishCount >= totalComparisons * 0.7) color = 'bearish';
    else color = 'neutral';

    // Calculate strength based on EMA separation
    const maxEMA = Math.max(...validValues);
    const minEMA = Math.min(...validValues);
    const separation = ((maxEMA - minEMA) / prices[i]) * 100;
    const strength = Math.min(100, separation * 25);

    // Determine expanding/contracting
    let expanding = false;
    let contracting = false;

    if (i > 0 && states[i - 1]) {
      const prevSeparation =
        ((states[i - 1].topEMA - states[i - 1].bottomEMA) / prices[i - 1]) * 100;
      const currentSeparation = separation;

      expanding = currentSeparation > prevSeparation * 1.05;
      contracting = currentSeparation < prevSeparation * 0.95;
    }

    states.push({
      color,
      strength,
      topEMA: maxEMA,
      bottomEMA: minEMA,
      expanding,
      contracting,
    });
  }

  return { emas, states, periods: EMA_RIBBON_PERIODS };
}

/**
 * Calculate all indicators for a set of bars
 */
export function calculateIndicators(bars: Bar[]): CalculatedIndicators {
  const closes = bars.map((b) => b.c);

  return {
    ema9: calculateEMA(closes, 9),
    ema21: calculateEMA(closes, 21),
    vwap: calculateVWAP(bars),
    emaRibbon: calculateEMARibbon(closes),
  };
}

/**
 * Calculate all indicators for multiple timeframes
 */
export function calculateAllTimeframeIndicators(data: {
  daily: Bar[];
  hourly: Bar[];
  fifteenMin: Bar[];
  fiveMin: Bar[];
  twoMin: Bar[];
}): TimeframeIndicators {
  const dailyCloses = data.daily.map((b) => b.c);
  const hourlyCloses = data.hourly.map((b) => b.c);
  const fifteenCloses = data.fifteenMin.map((b) => b.c);
  const fiveCloses = data.fiveMin.map((b) => b.c);
  const twoCloses = data.twoMin.map((b) => b.c);

  return {
    daily: {
      ema9: calculateEMA(dailyCloses, 9),
      ema21: calculateEMA(dailyCloses, 21),
      sma200: calculateSMA(dailyCloses, 200),
    },
    hourly: {
      ema9: calculateEMA(hourlyCloses, 9),
      ema21: calculateEMA(hourlyCloses, 21),
      vwap: calculateVWAP(data.hourly),
    },
    fifteenMin: {
      ema9: calculateEMA(fifteenCloses, 9),
      ema21: calculateEMA(fifteenCloses, 21),
      vwap: calculateVWAP(data.fifteenMin),
      emaRibbon: calculateEMARibbon(fifteenCloses),
    },
    fiveMin: {
      ema9: calculateEMA(fiveCloses, 9),
      ema21: calculateEMA(fiveCloses, 21),
      vwap: calculateVWAP(data.fiveMin),
      emaRibbon: calculateEMARibbon(fiveCloses),
    },
    twoMin: {
      ema9: calculateEMA(twoCloses, 9),
      ema21: calculateEMA(twoCloses, 21),
      vwap: calculateVWAP(data.twoMin),
    },
  };
}

/**
 * Get ribbon area data for chart rendering
 */
export function getRibbonAreaData(
  ribbon: RibbonData,
  timestamps: number[]
): { time: number; top: number; bottom: number; color: string }[] {
  return ribbon.states.map((state, i) => ({
    time: timestamps[i] / 1000,
    top: state.topEMA,
    bottom: state.bottomEMA,
    color:
      state.color === 'bullish'
        ? 'rgba(34, 197, 94, 0.2)'
        : state.color === 'bearish'
          ? 'rgba(239, 68, 68, 0.2)'
          : 'rgba(156, 163, 175, 0.1)',
  }));
}

/**
 * Format EMA line data for chart
 */
export function formatEMAForChart(
  ema: number[],
  timestamps: number[],
  color: string
): { time: number; value: number }[] {
  return ema
    .map((value, i) => ({
      time: timestamps[i] / 1000,
      value,
    }))
    .filter((d) => d.value > 0);
}
