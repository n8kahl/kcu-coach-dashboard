'use client';

/**
 * KCUChart - Unified Trading Chart Component (HARDENED)
 *
 * CRITICAL FIX: Uses series pool pattern to prevent "Value is null" crashes.
 * All series are pre-created at initialization - NO dynamic add/remove.
 * Unused series are hidden by setting empty data, not removed.
 */

import { useEffect, useRef, useState, useLayoutEffect, memo } from 'react';
import {
  createChart,
  ColorType,
  CrosshairMode,
  LineStyle,
  IChartApi,
  ISeriesApi,
  CandlestickData,
  LineData,
  Time,
  SeriesMarker,
} from 'lightweight-charts';
import { Loader2 } from 'lucide-react';

// =============================================================================
// Types
// =============================================================================

export interface Candle {
  time: number | string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface Level {
  price: number;
  label: string;
  type: 'support' | 'resistance' | 'vwap' | 'ema' | 'pivot' | 'custom';
  color?: string;
  lineStyle?: 'solid' | 'dashed' | 'dotted';
}

export interface GammaLevel {
  price: number;
  type: 'call_wall' | 'put_wall' | 'zero_gamma' | 'max_pain';
  strength?: number;
  label?: string;
}

export interface FVGZone {
  startTime: number | string;
  endTime: number | string;
  high: number;
  low: number;
  direction: 'bullish' | 'bearish';
  filled?: boolean;
}

export interface KCUChartProps {
  mode: 'live' | 'replay';
  data: Candle[];
  levels?: Level[];
  gammaLevels?: GammaLevel[];
  fvgZones?: FVGZone[];
  symbol?: string;
  height?: number;
  showVolume?: boolean;
  showIndicators?: boolean;
  showPatienceCandles?: boolean;
  onCandleClick?: (candle: Candle, index: number) => void;
  onCrosshairMove?: (price: number | null, time: Time | null) => void;
  replayIndex?: number;
  className?: string;
}

// =============================================================================
// Constants
// =============================================================================

const CHART_COLORS = {
  background: '#0d0d0d',
  textColor: '#d1d5db',
  gridColor: 'rgba(255, 255, 255, 0.03)',
  upColor: '#22c55e',
  downColor: '#ef4444',
  wickUpColor: '#22c55e',
  wickDownColor: '#ef4444',
  ema8: '#22c55e',
  ema21: '#ef4444',
  sma200: '#f97316',
  vwap: '#ffffff',
  cloudBullish: 'rgba(34, 197, 94, 0.15)',
  cloudBearish: 'rgba(239, 68, 68, 0.15)',
  callWall: '#ff00ff',
  putWall: '#00ffff',
  zeroGamma: '#ffffff',
  maxPain: '#8b5cf6',
  patienceMarker: '#fbbf24',
  volumeUp: 'rgba(34, 197, 94, 0.5)',
  volumeDown: 'rgba(239, 68, 68, 0.5)',
};

const LEVEL_COLORS: Record<Level['type'], string> = {
  support: '#22c55e',
  resistance: '#ef4444',
  vwap: '#ffffff',
  ema: '#f59e0b',
  pivot: '#8b5cf6',
  custom: '#6b7280',
};

// Pool sizes - pre-allocate this many series
const MAX_LEVEL_SERIES = 20;
const MAX_GAMMA_SERIES = 10;
const MIN_CHART_HEIGHT = 400;

// =============================================================================
// Utility Functions
// =============================================================================

function isValidNumber(val: unknown): val is number {
  return typeof val === 'number' && Number.isFinite(val) && !Number.isNaN(val);
}

function isValidPrice(val: unknown): val is number {
  return isValidNumber(val) && val > 0;
}

function toChartTime(time: number | string | null | undefined): Time | null {
  if (time == null) return null;

  let result: number;
  if (typeof time === 'string') {
    const d = new Date(time);
    if (isNaN(d.getTime())) return null;
    result = Math.floor(d.getTime() / 1000);
  } else if (typeof time === 'number') {
    if (!Number.isFinite(time)) return null;
    result = time >= 1e12 ? Math.floor(time / 1000) : Math.floor(time);
  } else {
    return null;
  }

  if (!Number.isFinite(result) || result <= 0) return null;
  return result as Time;
}

function calculateEMA(data: number[], period: number): (number | null)[] {
  const ema: (number | null)[] = [];
  if (data.length < period) return new Array(data.length).fill(null);

  const multiplier = 2 / (period + 1);
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += data[i] || 0;
    ema.push(null);
  }
  ema[period - 1] = sum / period;

  for (let i = period; i < data.length; i++) {
    const prev = ema[i - 1];
    if (prev !== null && isValidNumber(data[i])) {
      ema.push((data[i] - prev) * multiplier + prev);
    } else {
      ema.push(null);
    }
  }
  return ema;
}

function calculateSMA(data: number[], period: number): (number | null)[] {
  const sma: (number | null)[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      sma.push(null);
      continue;
    }
    let sum = 0;
    let count = 0;
    for (let j = 0; j < period; j++) {
      if (isValidNumber(data[i - j])) {
        sum += data[i - j];
        count++;
      }
    }
    sma.push(count > 0 ? sum / count : null);
  }
  return sma;
}

function calculateVWAP(candles: Candle[]): (number | null)[] {
  const vwap: (number | null)[] = [];
  let cumulativeTPV = 0;
  let cumulativeVolume = 0;

  for (const candle of candles) {
    if (!isValidPrice(candle.high) || !isValidPrice(candle.low) || !isValidPrice(candle.close)) {
      vwap.push(null);
      continue;
    }
    const typicalPrice = (candle.high + candle.low + candle.close) / 3;
    const volume = isValidNumber(candle.volume) && candle.volume > 0 ? candle.volume : 1;
    cumulativeTPV += typicalPrice * volume;
    cumulativeVolume += volume;
    vwap.push(cumulativeVolume > 0 ? cumulativeTPV / cumulativeVolume : null);
  }
  return vwap;
}

function detectInsideBars(candles: Candle[]): number[] {
  const indices: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const curr = candles[i];
    const prev = candles[i - 1];
    if (curr.high < prev.high && curr.low > prev.low) {
      indices.push(i);
    }
  }
  return indices;
}

/**
 * Safely set data on a series. Filters invalid points and wraps in try-catch.
 */
function safeSetData(
  series: ISeriesApi<'Line'> | ISeriesApi<'Area'> | ISeriesApi<'Histogram'> | null,
  data: LineData[]
): void {
  if (!series) return;

  try {
    const valid = data.filter(
      (d) =>
        d.time !== null &&
        d.time !== undefined &&
        isValidNumber(d.value)
    );
    series.setData(valid);
  } catch (e) {
    // Silently catch to prevent crash
    console.warn('[KCUChart] safeSetData error:', e);
    try {
      series.setData([]);
    } catch {
      // Ignore
    }
  }
}

// =============================================================================
// Main Component
// =============================================================================

export const KCUChart = memo(function KCUChart({
  mode,
  data,
  levels = [],
  gammaLevels = [],
  symbol,
  height,
  showVolume = true,
  showIndicators = true,
  showPatienceCandles = true,
  onCandleClick,
  onCrosshairMove,
  replayIndex,
  className = '',
}: KCUChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const mountedRef = useRef(true);

  // Main series refs
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const ema8SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const ema21SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const sma200SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const vwapSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const cloudSeriesRef = useRef<ISeriesApi<'Area'> | null>(null);

  // PRE-ALLOCATED SERIES POOLS - these are created once and reused
  const levelSeriesPool = useRef<ISeriesApi<'Line'>[]>([]);
  const gammaSeriesPool = useRef<ISeriesApi<'Line'>[]>([]);

  const [dimensions, setDimensions] = useState({ width: 0, height: 400 });
  const [isInitialized, setIsInitialized] = useState(false);

  // Track component mount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Resize observer
  useLayoutEffect(() => {
    if (!containerRef.current) return;

    const updateDimensions = () => {
      if (containerRef.current && mountedRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const w = rect.width || containerRef.current.clientWidth;
        const h = height || rect.height || containerRef.current.clientHeight || MIN_CHART_HEIGHT;
        setDimensions((prev) => {
          if (prev.width !== w || prev.height !== h) {
            return { width: w, height: Math.max(h, MIN_CHART_HEIGHT) };
          }
          return prev;
        });
      }
    };

    updateDimensions();
    const observer = new ResizeObserver(() => {
      requestAnimationFrame(updateDimensions);
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [height]);

  // Update chart size when dimensions change
  useEffect(() => {
    if (chartRef.current && dimensions.width > 0 && dimensions.height > 0) {
      chartRef.current.applyOptions({
        width: dimensions.width,
        height: dimensions.height,
      });
    }
  }, [dimensions]);

  // ==========================================================================
  // Chart Initialization - CREATE ALL SERIES ONCE
  // ==========================================================================
  useEffect(() => {
    if (!containerRef.current || dimensions.width <= 0 || dimensions.height <= 0) return;

    const chart = createChart(containerRef.current, {
      width: dimensions.width,
      height: dimensions.height,
      layout: {
        background: { type: ColorType.Solid, color: CHART_COLORS.background },
        textColor: CHART_COLORS.textColor,
      },
      grid: {
        vertLines: { color: CHART_COLORS.gridColor },
        horzLines: { color: CHART_COLORS.gridColor },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
        scaleMargins: { top: 0.1, bottom: showVolume ? 0.2 : 0.1 },
      },
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    chartRef.current = chart;

    // Create candlestick series
    candleSeriesRef.current = chart.addCandlestickSeries({
      upColor: CHART_COLORS.upColor,
      downColor: CHART_COLORS.downColor,
      wickUpColor: CHART_COLORS.wickUpColor,
      wickDownColor: CHART_COLORS.wickDownColor,
      borderVisible: false,
    });

    // Create volume series
    if (showVolume) {
      volumeSeriesRef.current = chart.addHistogramSeries({
        priceFormat: { type: 'volume' },
        priceScaleId: 'volume',
      });
      volumeSeriesRef.current.priceScale().applyOptions({
        scaleMargins: { top: 0.85, bottom: 0 },
      });
    }

    // Create indicator series
    if (showIndicators) {
      ema8SeriesRef.current = chart.addLineSeries({
        color: CHART_COLORS.ema8,
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      ema21SeriesRef.current = chart.addLineSeries({
        color: CHART_COLORS.ema21,
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      sma200SeriesRef.current = chart.addLineSeries({
        color: CHART_COLORS.sma200,
        lineWidth: 1,
        lineStyle: LineStyle.Dotted,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      vwapSeriesRef.current = chart.addLineSeries({
        color: CHART_COLORS.vwap,
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      cloudSeriesRef.current = chart.addAreaSeries({
        lineColor: 'transparent',
        topColor: CHART_COLORS.cloudBullish,
        bottomColor: 'transparent',
        priceLineVisible: false,
        lastValueVisible: false,
      });
    }

    // PRE-CREATE LEVEL SERIES POOL (hidden with empty data)
    const levelPool: ISeriesApi<'Line'>[] = [];
    for (let i = 0; i < MAX_LEVEL_SERIES; i++) {
      const series = chart.addLineSeries({
        color: '#6b7280',
        lineWidth: 1,
        lineStyle: LineStyle.Solid,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      series.setData([]); // Start hidden
      levelPool.push(series);
    }
    levelSeriesPool.current = levelPool;

    // PRE-CREATE GAMMA SERIES POOL (hidden with empty data)
    const gammaPool: ISeriesApi<'Line'>[] = [];
    for (let i = 0; i < MAX_GAMMA_SERIES; i++) {
      const series = chart.addLineSeries({
        color: '#6b7280',
        lineWidth: 2,
        lineStyle: LineStyle.Solid,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      series.setData([]); // Start hidden
      gammaPool.push(series);
    }
    gammaSeriesPool.current = gammaPool;

    // Event handlers
    if (onCrosshairMove) {
      chart.subscribeCrosshairMove((param) => {
        if (!param.point || !param.time || !candleSeriesRef.current) {
          onCrosshairMove(null, null);
          return;
        }
        const price = candleSeriesRef.current.coordinateToPrice(param.point.y);
        onCrosshairMove(price, param.time);
      });
    }

    if (onCandleClick) {
      chart.subscribeClick((param) => {
        if (!param.time) return;
        const clickedCandle = data.find((c) => toChartTime(c.time) === param.time);
        if (clickedCandle) {
          onCandleClick(clickedCandle, data.indexOf(clickedCandle));
        }
      });
    }

    setIsInitialized(true);

    // Cleanup
    return () => {
      // Clear all series data first
      try {
        levelSeriesPool.current.forEach((s) => {
          try { s.setData([]); } catch { /* ignore */ }
        });
        gammaSeriesPool.current.forEach((s) => {
          try { s.setData([]); } catch { /* ignore */ }
        });
        candleSeriesRef.current?.setData([]);
        volumeSeriesRef.current?.setData([]);
        ema8SeriesRef.current?.setData([]);
        ema21SeriesRef.current?.setData([]);
        sma200SeriesRef.current?.setData([]);
        vwapSeriesRef.current?.setData([]);
        cloudSeriesRef.current?.setData([]);
      } catch { /* ignore */ }

      // Clear refs
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      ema8SeriesRef.current = null;
      ema21SeriesRef.current = null;
      sma200SeriesRef.current = null;
      vwapSeriesRef.current = null;
      cloudSeriesRef.current = null;
      levelSeriesPool.current = [];
      gammaSeriesPool.current = [];

      setIsInitialized(false);

      try {
        chart.remove();
      } catch { /* ignore */ }
      chartRef.current = null;
    };
  }, [dimensions.width, dimensions.height, showVolume, showIndicators]);

  // ==========================================================================
  // Data Updates - Candles, Volume, Indicators
  // ==========================================================================
  useEffect(() => {
    if (!mountedRef.current || !isInitialized || !candleSeriesRef.current) return;

    // Filter valid candles
    const rawData = mode === 'replay' && replayIndex !== undefined
      ? data.slice(0, replayIndex + 1)
      : data;

    const validData = rawData.filter(
      (c) =>
        isValidPrice(c.open) &&
        isValidPrice(c.high) &&
        isValidPrice(c.low) &&
        isValidPrice(c.close) &&
        toChartTime(c.time) !== null
    );

    if (validData.length === 0) {
      try {
        candleSeriesRef.current?.setData([]);
        volumeSeriesRef.current?.setData([]);
        ema8SeriesRef.current?.setData([]);
        ema21SeriesRef.current?.setData([]);
        sma200SeriesRef.current?.setData([]);
        vwapSeriesRef.current?.setData([]);
        cloudSeriesRef.current?.setData([]);
      } catch { /* ignore */ }
      return;
    }

    // Candle data
    const candleData: CandlestickData[] = validData.map((c) => ({
      time: toChartTime(c.time)!,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    try {
      candleSeriesRef.current.setData(candleData);
    } catch (e) {
      console.warn('[KCUChart] Candle setData error:', e);
    }

    // Volume
    if (showVolume && volumeSeriesRef.current) {
      const volData = validData.map((c) => ({
        time: toChartTime(c.time)!,
        value: isValidNumber(c.volume) ? c.volume : 0,
        color: c.close >= c.open ? CHART_COLORS.volumeUp : CHART_COLORS.volumeDown,
      }));
      safeSetData(volumeSeriesRef.current, volData);
    }

    // Indicators
    if (showIndicators) {
      const closes = validData.map((c) => c.close);

      // EMA 8
      const ema8 = calculateEMA(closes, 8);
      const ema8Data = validData
        .map((c, i) => ({ time: toChartTime(c.time)!, value: ema8[i] ?? undefined }))
        .filter((d): d is LineData => d.value !== undefined && d.value !== null);
      safeSetData(ema8SeriesRef.current, ema8Data);

      // EMA 21
      const ema21 = calculateEMA(closes, 21);
      const ema21Data = validData
        .map((c, i) => ({ time: toChartTime(c.time)!, value: ema21[i] ?? undefined }))
        .filter((d): d is LineData => d.value !== undefined && d.value !== null);
      safeSetData(ema21SeriesRef.current, ema21Data);

      // SMA 200
      const sma200 = calculateSMA(closes, 200);
      const sma200Data = validData
        .map((c, i) => ({ time: toChartTime(c.time)!, value: sma200[i] ?? undefined }))
        .filter((d): d is LineData => d.value !== undefined && d.value !== null);
      safeSetData(sma200SeriesRef.current, sma200Data);

      // VWAP
      const vwap = calculateVWAP(validData);
      const vwapData = validData
        .map((c, i) => ({ time: toChartTime(c.time)!, value: vwap[i] ?? undefined }))
        .filter((d): d is LineData => d.value !== undefined && d.value !== null);
      safeSetData(vwapSeriesRef.current, vwapData);

      // Cloud
      const cloudData = validData
        .map((c, i) => {
          const e8 = ema8[i];
          const e21 = ema21[i];
          if (e8 === null || e21 === null) return null;
          return { time: toChartTime(c.time)!, value: Math.max(e8, e21) };
        })
        .filter((d): d is LineData => d !== null);

      if (cloudSeriesRef.current) {
        const lastE8 = ema8[ema8.length - 1];
        const lastE21 = ema21[ema21.length - 1];
        const isBullish = lastE8 !== null && lastE21 !== null && lastE8 > lastE21;
        try {
          cloudSeriesRef.current.applyOptions({
            topColor: isBullish ? CHART_COLORS.cloudBullish : CHART_COLORS.cloudBearish,
          });
        } catch { /* ignore */ }
        safeSetData(cloudSeriesRef.current, cloudData);
      }
    }

    // Patience candle markers
    if (showPatienceCandles && candleSeriesRef.current) {
      const indices = detectInsideBars(validData);
      const markers = indices
        .map((i) => {
          const t = toChartTime(validData[i].time);
          if (!t) return null;
          return {
            time: t,
            position: 'aboveBar' as const,
            color: CHART_COLORS.patienceMarker,
            shape: 'arrowDown' as const,
            text: '◆',
            size: 1,
          };
        })
        .filter((m) => m !== null) as SeriesMarker<Time>[];
      try {
        candleSeriesRef.current.setMarkers(markers);
      } catch { /* ignore */ }
    }

    // Fit content
    if (chartRef.current) {
      try {
        chartRef.current.timeScale().fitContent();
      } catch { /* ignore */ }
    }
  }, [data, mode, replayIndex, isInitialized, showVolume, showIndicators, showPatienceCandles]);

  // ==========================================================================
  // Level Lines - REUSE POOL, DON'T CREATE/REMOVE
  // ==========================================================================
  useEffect(() => {
    if (!mountedRef.current || !isInitialized || data.length === 0) return;

    const pool = levelSeriesPool.current;
    if (pool.length === 0) return;

    const startTime = toChartTime(data[0].time);
    const endTime = toChartTime(data[data.length - 1].time);
    if (!startTime || !endTime) return;

    // Filter valid levels
    const validLevels = levels.filter((l) => isValidPrice(l.price)).slice(0, MAX_LEVEL_SERIES);

    // Update each pool series
    pool.forEach((series, i) => {
      const level = validLevels[i];

      if (!level) {
        // No level for this slot - hide it
        try {
          series.setData([]);
        } catch { /* ignore */ }
        return;
      }

      // Update series options
      try {
        series.applyOptions({
          color: level.color || LEVEL_COLORS[level.type] || '#6b7280',
          lineStyle:
            level.lineStyle === 'dotted'
              ? LineStyle.Dotted
              : level.lineStyle === 'dashed'
              ? LineStyle.Dashed
              : LineStyle.Solid,
          title: level.label,
        });
      } catch { /* ignore */ }

      // Set level line data
      const lineData: LineData[] = [
        { time: startTime, value: level.price },
      ];
      if (startTime !== endTime) {
        lineData.push({ time: endTime, value: level.price });
      }

      safeSetData(series, lineData);
    });
  }, [levels, data, isInitialized]);

  // ==========================================================================
  // Gamma Levels - REUSE POOL, DON'T CREATE/REMOVE
  // ==========================================================================
  useEffect(() => {
    if (!mountedRef.current || !isInitialized || data.length === 0) return;

    const pool = gammaSeriesPool.current;
    if (pool.length === 0) return;

    const startTime = toChartTime(data[0].time);
    const endTime = toChartTime(data[data.length - 1].time);
    if (!startTime || !endTime) return;

    // Filter valid gamma levels
    const validGamma = gammaLevels.filter((g) => isValidPrice(g.price)).slice(0, MAX_GAMMA_SERIES);

    // Update each pool series
    pool.forEach((series, i) => {
      const gamma = validGamma[i];

      if (!gamma) {
        // No gamma for this slot - hide it
        try {
          series.setData([]);
        } catch { /* ignore */ }
        return;
      }

      // Determine color based on type
      let color = '#6b7280';
      let lineWidth = 2;
      if (gamma.type === 'call_wall') {
        color = CHART_COLORS.callWall;
        lineWidth = 3;
      } else if (gamma.type === 'put_wall') {
        color = CHART_COLORS.putWall;
        lineWidth = 3;
      } else if (gamma.type === 'zero_gamma') {
        color = CHART_COLORS.zeroGamma;
      } else if (gamma.type === 'max_pain') {
        color = CHART_COLORS.maxPain;
      }

      // Update series options
      try {
        series.applyOptions({
          color,
          lineWidth: lineWidth as 1 | 2 | 3 | 4,
          title: gamma.label || gamma.type.replace('_', ' ').toUpperCase(),
        });
      } catch { /* ignore */ }

      // Set gamma line data
      const lineData: LineData[] = [
        { time: startTime, value: gamma.price },
      ];
      if (startTime !== endTime) {
        lineData.push({ time: endTime, value: gamma.price });
      }

      safeSetData(series, lineData);
    });
  }, [gammaLevels, data, isInitialized]);

  // ==========================================================================
  // Render
  // ==========================================================================
  const isLoading = !isInitialized || data.length === 0 || dimensions.width <= 0;

  return (
    <div className={`relative ${className}`} style={{ minHeight: MIN_CHART_HEIGHT }}>
      <div
        ref={containerRef}
        className="w-full h-full"
        style={{ minHeight: MIN_CHART_HEIGHT, height: height || '100%' }}
      />

      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0d0d0d]/90 z-10">
          <Loader2 className="w-8 h-8 text-[var(--accent-primary)] animate-spin mb-3" />
          <p className="text-sm text-[var(--text-secondary)] font-mono">
            {data.length === 0 ? 'Waiting for Market Data...' : 'Initializing Chart...'}
          </p>
          {symbol && <p className="text-xs text-[var(--text-tertiary)] mt-1">{symbol}</p>}
        </div>
      )}

      {/* Symbol Badge */}
      {symbol && (
        <div className="absolute top-3 left-3 px-2 py-1 bg-[#1e293b]/80 border border-[var(--border-primary)] text-[var(--accent-gold)] font-mono text-sm">
          {symbol}
        </div>
      )}

      {/* Mode Indicator */}
      <div
        className={`absolute top-3 right-3 px-2 py-1 text-xs font-mono uppercase ${
          mode === 'live'
            ? 'bg-green-500/20 text-green-400 border border-green-500/50'
            : 'bg-blue-500/20 text-blue-400 border border-blue-500/50'
        }`}
      >
        {mode === 'live' ? '● LIVE' : '▶ REPLAY'}
      </div>

      {/* Legend */}
      {showIndicators && (
        <div className="absolute bottom-3 left-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-mono max-w-[70%]">
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-[#22c55e]"></span>
            <span className="text-[#22c55e]">EMA 8</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-[#ef4444]"></span>
            <span className="text-[#ef4444]">EMA 21</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-[#f97316]"></span>
            <span className="text-[#f97316]">SMA 200</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-white"></span>
            <span className="text-white">VWAP</span>
          </span>
          {showPatienceCandles && (
            <span className="flex items-center gap-1">
              <span className="text-[#fbbf24]">◆</span>
              <span className="text-[#fbbf24]">Patience</span>
            </span>
          )}
        </div>
      )}

      {/* Gamma Legend */}
      {gammaLevels.length > 0 && (
        <div className="absolute bottom-3 right-3 flex flex-col gap-1 text-[10px] font-mono bg-[#0d0d0d]/80 px-2 py-1.5 rounded border border-[var(--border-primary)]">
          <span className="text-[var(--text-tertiary)] uppercase tracking-wider mb-0.5">
            Institutional
          </span>
          {gammaLevels.some((g) => g.type === 'call_wall') && (
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-0.5" style={{ backgroundColor: CHART_COLORS.callWall }}></span>
              <span style={{ color: CHART_COLORS.callWall }}>Call Wall</span>
            </span>
          )}
          {gammaLevels.some((g) => g.type === 'put_wall') && (
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-0.5" style={{ backgroundColor: CHART_COLORS.putWall }}></span>
              <span style={{ color: CHART_COLORS.putWall }}>Put Wall</span>
            </span>
          )}
          {gammaLevels.some((g) => g.type === 'zero_gamma') && (
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-0.5" style={{ backgroundColor: CHART_COLORS.zeroGamma }}></span>
              <span style={{ color: CHART_COLORS.zeroGamma }}>Zero γ</span>
            </span>
          )}
          {gammaLevels.some((g) => g.type === 'max_pain') && (
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-0.5" style={{ backgroundColor: CHART_COLORS.maxPain }}></span>
              <span style={{ color: CHART_COLORS.maxPain }}>Max Pain</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
});

export default KCUChart;
