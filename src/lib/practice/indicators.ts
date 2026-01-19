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

/**
 * VWAP Bands calculation with standard deviation
 */
export interface VWAPBands {
  vwap: number[];
  upperBand1: number[]; // +1 std dev
  lowerBand1: number[]; // -1 std dev
  upperBand2: number[]; // +2 std dev
  lowerBand2: number[]; // -2 std dev
}

/**
 * Calculate VWAP with standard deviation bands
 * Bands show 1 and 2 standard deviations from VWAP
 */
export function calculateVWAPBands(bars: Bar[]): VWAPBands {
  if (bars.length === 0) {
    return { vwap: [], upperBand1: [], lowerBand1: [], upperBand2: [], lowerBand2: [] };
  }

  const vwap: number[] = [];
  const upperBand1: number[] = [];
  const lowerBand1: number[] = [];
  const upperBand2: number[] = [];
  const lowerBand2: number[] = [];

  let cumulativeTPV = 0;
  let cumulativeVolume = 0;
  let cumulativeTPVSquared = 0;
  let lastDate: string | null = null;

  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i];
    const barDate = new Date(bar.t).toISOString().split('T')[0];

    // Reset at new trading day
    if (lastDate !== null && barDate !== lastDate) {
      cumulativeTPV = 0;
      cumulativeVolume = 0;
      cumulativeTPVSquared = 0;
    }
    lastDate = barDate;

    const typicalPrice = (bar.h + bar.l + bar.c) / 3;
    cumulativeTPV += typicalPrice * bar.v;
    cumulativeVolume += bar.v;
    cumulativeTPVSquared += typicalPrice * typicalPrice * bar.v;

    const currentVWAP = cumulativeVolume > 0 ? cumulativeTPV / cumulativeVolume : typicalPrice;
    vwap.push(currentVWAP);

    // Calculate standard deviation
    // Variance = E[X^2] - E[X]^2
    if (cumulativeVolume > 0) {
      const variance = (cumulativeTPVSquared / cumulativeVolume) - (currentVWAP * currentVWAP);
      const stdDev = Math.sqrt(Math.max(0, variance));

      upperBand1.push(currentVWAP + stdDev);
      lowerBand1.push(currentVWAP - stdDev);
      upperBand2.push(currentVWAP + 2 * stdDev);
      lowerBand2.push(currentVWAP - 2 * stdDev);
    } else {
      upperBand1.push(currentVWAP);
      lowerBand1.push(currentVWAP);
      upperBand2.push(currentVWAP);
      lowerBand2.push(currentVWAP);
    }
  }

  return { vwap, upperBand1, lowerBand1, upperBand2, lowerBand2 };
}

/**
 * Volume Profile calculation
 * Groups volume by price levels to show areas of high/low activity
 */
export interface VolumeProfileLevel {
  price: number;
  volume: number;
  buyVolume: number;
  sellVolume: number;
  isPointOfControl: boolean;
  isValueAreaHigh: boolean;
  isValueAreaLow: boolean;
}

export interface VolumeProfile {
  levels: VolumeProfileLevel[];
  pointOfControl: number; // Price with highest volume
  valueAreaHigh: number; // Upper boundary of 70% volume
  valueAreaLow: number; // Lower boundary of 70% volume
}

/**
 * Calculate Volume Profile (Price Volume Distribution)
 * @param bars - Price bars to analyze
 * @param numberOfLevels - How many price levels to divide the range into
 */
export function calculateVolumeProfile(bars: Bar[], numberOfLevels: number = 24): VolumeProfile {
  if (bars.length === 0) {
    return {
      levels: [],
      pointOfControl: 0,
      valueAreaHigh: 0,
      valueAreaLow: 0,
    };
  }

  // Find price range
  const highs = bars.map(b => b.h);
  const lows = bars.map(b => b.l);
  const maxPrice = Math.max(...highs);
  const minPrice = Math.min(...lows);
  const range = maxPrice - minPrice;
  const levelSize = range / numberOfLevels;

  // Initialize levels
  const levels: VolumeProfileLevel[] = [];
  for (let i = 0; i < numberOfLevels; i++) {
    levels.push({
      price: minPrice + (i + 0.5) * levelSize, // Middle of level
      volume: 0,
      buyVolume: 0,
      sellVolume: 0,
      isPointOfControl: false,
      isValueAreaHigh: false,
      isValueAreaLow: false,
    });
  }

  // Distribute volume to levels
  for (const bar of bars) {
    const typicalPrice = (bar.h + bar.l + bar.c) / 3;
    const levelIndex = Math.min(
      numberOfLevels - 1,
      Math.floor((typicalPrice - minPrice) / levelSize)
    );

    if (levelIndex >= 0 && levelIndex < numberOfLevels) {
      levels[levelIndex].volume += bar.v;
      // Estimate buy/sell based on close vs open
      if (bar.c >= bar.o) {
        levels[levelIndex].buyVolume += bar.v;
      } else {
        levels[levelIndex].sellVolume += bar.v;
      }
    }
  }

  // Find Point of Control (highest volume level)
  let maxVolume = 0;
  let pocIndex = 0;
  for (let i = 0; i < levels.length; i++) {
    if (levels[i].volume > maxVolume) {
      maxVolume = levels[i].volume;
      pocIndex = i;
    }
  }
  levels[pocIndex].isPointOfControl = true;

  // Calculate Value Area (70% of volume)
  const totalVolume = levels.reduce((sum, l) => sum + l.volume, 0);
  const targetVolume = totalVolume * 0.7;

  // Expand from POC until we capture 70% of volume
  let capturedVolume = levels[pocIndex].volume;
  let lowIndex = pocIndex;
  let highIndex = pocIndex;

  while (capturedVolume < targetVolume && (lowIndex > 0 || highIndex < levels.length - 1)) {
    const canGoLow = lowIndex > 0;
    const canGoHigh = highIndex < levels.length - 1;

    if (canGoLow && canGoHigh) {
      // Add the larger of the two adjacent levels
      if (levels[lowIndex - 1].volume >= levels[highIndex + 1].volume) {
        lowIndex--;
        capturedVolume += levels[lowIndex].volume;
      } else {
        highIndex++;
        capturedVolume += levels[highIndex].volume;
      }
    } else if (canGoLow) {
      lowIndex--;
      capturedVolume += levels[lowIndex].volume;
    } else if (canGoHigh) {
      highIndex++;
      capturedVolume += levels[highIndex].volume;
    }
  }

  levels[lowIndex].isValueAreaLow = true;
  levels[highIndex].isValueAreaHigh = true;

  return {
    levels,
    pointOfControl: levels[pocIndex].price,
    valueAreaHigh: levels[highIndex].price,
    valueAreaLow: levels[lowIndex].price,
  };
}

/**
 * Timeframe type for the chart
 */
export type Timeframe = '1m' | '2m' | '5m' | '15m' | '30m' | '1H' | '4H' | 'D' | 'W';

/**
 * Get multiplier for converting between timeframes
 */
export function getTimeframeMinutes(tf: Timeframe): number {
  const map: Record<Timeframe, number> = {
    '1m': 1,
    '2m': 2,
    '5m': 5,
    '15m': 15,
    '30m': 30,
    '1H': 60,
    '4H': 240,
    'D': 1440,
    'W': 10080,
  };
  return map[tf];
}

/**
 * Aggregate bars to a higher timeframe
 */
export function aggregateBars(bars: Bar[], targetTimeframe: Timeframe): Bar[] {
  if (bars.length === 0) return [];

  const targetMinutes = getTimeframeMinutes(targetTimeframe);
  const targetMs = targetMinutes * 60 * 1000;

  const aggregated: Bar[] = [];
  let currentBar: Bar | null = null;
  let currentPeriodStart = 0;

  for (const bar of bars) {
    const periodStart = Math.floor(bar.t / targetMs) * targetMs;

    if (currentBar === null || periodStart > currentPeriodStart) {
      // Start new bar
      if (currentBar) {
        aggregated.push(currentBar);
      }
      currentBar = { ...bar, t: periodStart };
      currentPeriodStart = periodStart;
    } else {
      // Update current bar
      currentBar.h = Math.max(currentBar.h, bar.h);
      currentBar.l = Math.min(currentBar.l, bar.l);
      currentBar.c = bar.c;
      currentBar.v += bar.v;
    }
  }

  if (currentBar) {
    aggregated.push(currentBar);
  }

  return aggregated;
}
