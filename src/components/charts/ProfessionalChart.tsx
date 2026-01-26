'use client';

/**
 * ProfessionalChart.tsx
 *
 * High-performance Canvas-based trading chart for the Companion Mode.
 * Built on TradingView's lightweight-charts library for hardware-accelerated rendering.
 *
 * Key Features:
 * - Canvas rendering (GPU accelerated)
 * - Optimized for real-time streaming data
 * - Magnet crosshair mode
 * - Auto-scaling with right offset for future price action
 * - Memoized to prevent unnecessary re-renders
 */

import { useEffect, useRef, useState, useCallback, memo, forwardRef, useImperativeHandle } from 'react';
import {
  createChart,
  IChartApi,
  ISeriesApi,
  CandlestickData,
  LineData,
  Time,
  CrosshairMode,
  LineStyle,
  ColorType,
  SeriesMarker,
} from 'lightweight-charts';
import { isValidNumber, isValidPrice } from '@/lib/format-trade-data';

// =============================================================================
// Types
// =============================================================================

export interface ChartCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface ChartLevel {
  price: number;
  label: string;
  color: string;
  lineStyle?: 'solid' | 'dashed' | 'dotted';
}

export interface GammaLevel {
  price: number;
  type: 'call_wall' | 'put_wall' | 'zero_gamma' | 'max_pain';
  label?: string;
}

export interface ChartPatienceCandle {
  time: number;
  type: 'inside_bar' | 'hammer' | 'inverted_hammer' | 'spinning_top' | 'doji';
  direction: 'bullish' | 'bearish';
  quality: 'high' | 'medium' | 'low';
  isCurrent?: boolean;
}

export interface ProfessionalChartProps {
  /** Candle data array */
  data: ChartCandle[];
  /** Symbol being displayed */
  symbol?: string;
  /** Key levels (PDH, PDL, VWAP, etc.) */
  levels?: ChartLevel[];
  /** Gamma levels from options flow */
  gammaLevels?: GammaLevel[];
  /** Patience candles to highlight on the chart */
  patienceCandles?: ChartPatienceCandle[];
  /** Chart height (defaults to 100%) */
  height?: number | string;
  /** Show volume histogram */
  showVolume?: boolean;
  /** Show EMA indicators */
  showIndicators?: boolean;
  /** Callback when crosshair moves */
  onCrosshairMove?: (price: number | null, time: Time | null) => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Imperative handle for ProfessionalChart.
 * Use this to update candles without triggering React re-renders.
 */
export interface ProfessionalChartHandle {
  /**
   * Update the last candle in the series.
   * Use for real-time price updates within the same bucket.
   */
  updateLastCandle: (candle: ChartCandle) => void;

  /**
   * Add a new candle to the series.
   * Use when a new bucket starts.
   */
  addCandle: (candle: ChartCandle) => void;

  /**
   * Get the timestamp of the last candle in the series.
   * Returns null if no candles exist.
   */
  getLastCandleTime: () => number | null;
}

// =============================================================================
// Color Palette - Professional HFT Terminal
// =============================================================================

const COLORS = {
  // Background
  background: '#0b0e11',

  // Grid
  gridLines: '#1e222d',

  // Candles (TradingView professional colors)
  candleUp: '#26a69a',
  candleDown: '#ef5350',
  wickUp: '#26a69a',
  wickDown: '#ef5350',

  // Volume
  volumeUp: 'rgba(38, 166, 154, 0.4)',
  volumeDown: 'rgba(239, 83, 80, 0.4)',

  // Indicators
  ema8: '#26a69a',
  ema21: '#ef5350',
  vwap: '#ab47bc',

  // Crosshair
  crosshair: '#758696',

  // Text
  text: '#d1d4dc',
  textMuted: '#787b86',

  // Levels
  support: '#26a69a',
  resistance: '#ef5350',

  // Gamma
  callWall: '#ef5350',
  putWall: '#26a69a',
  zeroGamma: '#ffeb3b',
  maxPain: '#ab47bc',
} as const;

// =============================================================================
// Constants
// =============================================================================

/**
 * Far-future timestamp for horizontal level lines (10 years from now).
 * This ensures level lines extend into the empty "right offset" space
 * on the chart, not just to the last candle. Without this, levels appear
 * to stop abruptly at the last candle edge.
 */
const FAR_FUTURE_SECONDS = Math.floor(Date.now() / 1000) + 10 * 365 * 24 * 60 * 60;

// =============================================================================
// Utility Functions
// =============================================================================

function toChartTime(timestamp: number): Time {
  // Ensure timestamp is in seconds for lightweight-charts
  const timeInSeconds = timestamp > 1e12 ? Math.floor(timestamp / 1000) : timestamp;
  return timeInSeconds as Time;
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

/**
 * Calculate Volume Weighted Average Price (VWAP).
 *
 * IMPORTANT: Bars with zero volume are SKIPPED, not treated as volume=1.
 * Using volume=1 as a fallback would distort VWAP by giving equal weight to
 * bars regardless of actual trading activity. This is especially problematic
 * for pre/post market data where volume may be missing.
 *
 * For bars with zero/missing volume, we carry forward the previous VWAP value
 * to maintain visual continuity without distorting the calculation.
 */
function calculateVWAP(candles: ChartCandle[]): (number | null)[] {
  const vwap: (number | null)[] = [];
  let cumulativeTPV = 0;
  let cumulativeVolume = 0;
  let lastTradingDate: string | null = null;
  let lastValidVwap: number | null = null;

  for (const candle of candles) {
    if (!isValidPrice(candle.high) || !isValidPrice(candle.low) || !isValidPrice(candle.close)) {
      vwap.push(null);
      continue;
    }

    const candleDate = new Date(candle.time * 1000);
    const etDate = candleDate.toLocaleDateString('en-US', { timeZone: 'America/New_York' });

    // Reset at new trading day
    if (lastTradingDate !== null && etDate !== lastTradingDate) {
      cumulativeTPV = 0;
      cumulativeVolume = 0;
      lastValidVwap = null;
    }
    lastTradingDate = etDate;

    // Get volume, treating invalid/zero as zero (not 1!)
    const volume = isValidNumber(candle.volume) && candle.volume > 0 ? candle.volume : 0;

    if (volume > 0) {
      // Valid volume - include in VWAP calculation
      const typicalPrice = (candle.high + candle.low + candle.close) / 3;
      cumulativeTPV += typicalPrice * volume;
      cumulativeVolume += volume;
      lastValidVwap = cumulativeTPV / cumulativeVolume;
      vwap.push(lastValidVwap);
    } else {
      // Zero volume - carry forward last valid VWAP (or null if none yet)
      // This maintains visual continuity without distorting the calculation
      vwap.push(lastValidVwap);
    }
  }
  return vwap;
}

// Series pool size
const MAX_LEVEL_SERIES = 15;
const MAX_GAMMA_SERIES = 5;

// =============================================================================
// Main Component (Memoized for Performance)
// =============================================================================

export const ProfessionalChart = memo(forwardRef<ProfessionalChartHandle, ProfessionalChartProps>(
  function ProfessionalChart(
    {
      data,
      symbol,
      levels = [],
      gammaLevels = [],
      patienceCandles = [],
      height = '100%',
      showVolume = true,
      showIndicators = true,
      onCrosshairMove,
      className = '',
    },
    ref
  ) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const mountedRef = useRef(true);

  // Track last candle time for imperative updates
  const lastCandleTimeRef = useRef<number | null>(null);

  // Series refs
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const ema8SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const ema21SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const vwapSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

  // Pre-allocated series pools
  const levelSeriesPool = useRef<ISeriesApi<'Line'>[]>([]);
  const gammaSeriesPool = useRef<ISeriesApi<'Line'>[]>([]);

  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [isInitialized, setIsInitialized] = useState(false);

  // ==========================================================================
  // Imperative Handle for Real-Time Updates
  // ==========================================================================
  useImperativeHandle(ref, () => ({
    updateLastCandle: (candle: ChartCandle) => {
      if (!candleSeriesRef.current || !mountedRef.current) return;
      if (!isValidPrice(candle.open) || !isValidPrice(candle.close)) return;

      try {
        candleSeriesRef.current.update({
          time: toChartTime(candle.time),
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
        });

        // Update volume if present
        if (volumeSeriesRef.current && isValidNumber(candle.volume)) {
          volumeSeriesRef.current.update({
            time: toChartTime(candle.time),
            value: candle.volume,
            color: candle.close >= candle.open ? COLORS.volumeUp : COLORS.volumeDown,
          });
        }

        lastCandleTimeRef.current = candle.time;
      } catch (e) {
        // Silently handle update errors (e.g., if chart is being destroyed)
      }
    },

    addCandle: (candle: ChartCandle) => {
      if (!candleSeriesRef.current || !mountedRef.current) return;
      if (!isValidPrice(candle.open) || !isValidPrice(candle.close)) return;

      try {
        // Use update() which adds a new bar if time is newer than last bar
        candleSeriesRef.current.update({
          time: toChartTime(candle.time),
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
        });

        // Add volume bar
        if (volumeSeriesRef.current && isValidNumber(candle.volume)) {
          volumeSeriesRef.current.update({
            time: toChartTime(candle.time),
            value: candle.volume,
            color: candle.close >= candle.open ? COLORS.volumeUp : COLORS.volumeDown,
          });
        }

        lastCandleTimeRef.current = candle.time;
      } catch (e) {
        // Silently handle update errors
      }
    },

    getLastCandleTime: () => {
      return lastCandleTimeRef.current;
    },
  }), [isInitialized]);

  // Track mount state
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Resize observer
  useEffect(() => {
    if (!containerRef.current) return;

    const updateDimensions = () => {
      if (containerRef.current && mountedRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({
          width: rect.width || containerRef.current.clientWidth,
          height: rect.height || containerRef.current.clientHeight || 400,
        });
      }
    };

    updateDimensions();
    const observer = new ResizeObserver(() => {
      requestAnimationFrame(updateDimensions);
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // ==========================================================================
  // Chart Initialization
  // ==========================================================================
  useEffect(() => {
    if (!containerRef.current || dimensions.width <= 0 || dimensions.height <= 0) return;

    const chart = createChart(containerRef.current, {
      width: dimensions.width,
      height: dimensions.height,
      layout: {
        background: { type: ColorType.Solid, color: COLORS.background },
        textColor: COLORS.text,
        fontFamily: "'JetBrains Mono', 'SF Mono', monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: COLORS.gridLines, style: LineStyle.Dotted },
        horzLines: { color: COLORS.gridLines, style: LineStyle.Dotted },
      },
      crosshair: {
        mode: CrosshairMode.Magnet,
        vertLine: {
          color: COLORS.crosshair,
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: '#2a2e39',
        },
        horzLine: {
          color: COLORS.crosshair,
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: '#2a2e39',
        },
      },
      rightPriceScale: {
        borderColor: COLORS.gridLines,
        scaleMargins: { top: 0.05, bottom: showVolume ? 0.18 : 0.05 },
        autoScale: true,
      },
      timeScale: {
        borderColor: COLORS.gridLines,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 12, // 12 bars of empty space for future price visualization
        barSpacing: 8,
        minBarSpacing: 4,
        tickMarkFormatter: (time: number) => {
          const date = new Date(time * 1000);
          return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
            timeZone: 'America/New_York',
          });
        },
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: true,
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
    });

    chartRef.current = chart;

    // Create candlestick series
    candleSeriesRef.current = chart.addCandlestickSeries({
      upColor: COLORS.candleUp,
      downColor: COLORS.candleDown,
      wickUpColor: COLORS.wickUp,
      wickDownColor: COLORS.wickDown,
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
        color: COLORS.ema8,
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });

      ema21SeriesRef.current = chart.addLineSeries({
        color: COLORS.ema21,
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });

      vwapSeriesRef.current = chart.addLineSeries({
        color: COLORS.vwap,
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
    }

    // Pre-create level series pool
    const levelPool: ISeriesApi<'Line'>[] = [];
    for (let i = 0; i < MAX_LEVEL_SERIES; i++) {
      const series = chart.addLineSeries({
        color: '#6b7280',
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      series.setData([]);
      levelPool.push(series);
    }
    levelSeriesPool.current = levelPool;

    // Pre-create gamma series pool
    const gammaPool: ISeriesApi<'Line'>[] = [];
    for (let i = 0; i < MAX_GAMMA_SERIES; i++) {
      const series = chart.addLineSeries({
        color: '#6b7280',
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      series.setData([]);
      gammaPool.push(series);
    }
    gammaSeriesPool.current = gammaPool;

    // Crosshair move handler
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

    setIsInitialized(true);

    // Cleanup
    return () => {
      try {
        levelSeriesPool.current.forEach((s) => { try { s.setData([]); } catch {} });
        gammaSeriesPool.current.forEach((s) => { try { s.setData([]); } catch {} });
        candleSeriesRef.current?.setData([]);
        volumeSeriesRef.current?.setData([]);
        ema8SeriesRef.current?.setData([]);
        ema21SeriesRef.current?.setData([]);
        vwapSeriesRef.current?.setData([]);
      } catch {}

      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      ema8SeriesRef.current = null;
      ema21SeriesRef.current = null;
      vwapSeriesRef.current = null;
      levelSeriesPool.current = [];
      gammaSeriesPool.current = [];

      setIsInitialized(false);
      try { chart.remove(); } catch {}
      chartRef.current = null;
    };
  }, [dimensions.width, dimensions.height, showVolume, showIndicators]);

  // ==========================================================================
  // Update Chart Data
  // ==========================================================================
  useEffect(() => {
    if (!mountedRef.current || !isInitialized || !candleSeriesRef.current) return;

    // Filter valid candles
    const validData = data.filter(
      (c) =>
        isValidPrice(c.open) &&
        isValidPrice(c.high) &&
        isValidPrice(c.low) &&
        isValidPrice(c.close) &&
        isValidNumber(c.time) &&
        c.time > 0
    );

    if (validData.length === 0) {
      try {
        candleSeriesRef.current?.setData([]);
        volumeSeriesRef.current?.setData([]);
        ema8SeriesRef.current?.setData([]);
        ema21SeriesRef.current?.setData([]);
        vwapSeriesRef.current?.setData([]);
      } catch {}
      return;
    }

    // Candle data
    const candleData: CandlestickData[] = validData.map((c) => ({
      time: toChartTime(c.time),
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    try {
      candleSeriesRef.current.setData(candleData);
    } catch (e) {
      console.warn('[ProfessionalChart] Candle setData error:', e);
    }

    // Add patience candle markers
    if (patienceCandles.length > 0 && candleSeriesRef.current) {
      const markers: SeriesMarker<Time>[] = patienceCandles
        .filter((pc) => isValidNumber(pc.time) && pc.time > 0)
        .map((pc) => {
          const isBullish = pc.direction === 'bullish';
          const isCurrent = pc.isCurrent;

          // Different colors based on quality and current status
          let color = '#fbbf24'; // yellow default
          if (pc.quality === 'high') {
            color = isCurrent ? '#22c55e' : '#4ade80'; // green for high quality
          } else if (pc.quality === 'medium') {
            color = isCurrent ? '#eab308' : '#fbbf24'; // yellow for medium
          } else {
            color = '#9ca3af'; // gray for low
          }

          // Marker shape and position based on direction
          return {
            time: toChartTime(pc.time),
            position: isBullish ? 'belowBar' : 'aboveBar',
            color,
            shape: isCurrent ? 'circle' : 'square',
            size: isCurrent ? 2 : 1,
            text: isCurrent ? '⏳ PATIENCE' : pc.type.replace('_', ' ').toUpperCase(),
          } as SeriesMarker<Time>;
        })
        // Sort markers by time ascending (required by lightweight-charts)
        .sort((a, b) => (a.time as number) - (b.time as number));

      try {
        candleSeriesRef.current.setMarkers(markers);
      } catch (e) {
        console.warn('[ProfessionalChart] Markers setData error:', e);
      }
    } else if (candleSeriesRef.current) {
      // Clear markers if no patience candles
      try {
        candleSeriesRef.current.setMarkers([]);
      } catch {}
    }

    // Volume data
    if (showVolume && volumeSeriesRef.current) {
      const volData = validData.map((c) => ({
        time: toChartTime(c.time),
        value: isValidNumber(c.volume) ? c.volume : 0,
        color: c.close >= c.open ? COLORS.volumeUp : COLORS.volumeDown,
      }));
      try {
        volumeSeriesRef.current.setData(volData);
      } catch {}
    }

    // Indicators
    if (showIndicators && validData.length >= 21) {
      const closes = validData.map((c) => c.close);

      // EMA 8
      const ema8 = calculateEMA(closes, 8);
      const ema8Data = validData
        .map((c, i) => ({ time: toChartTime(c.time), value: ema8[i] }))
        .filter((d): d is LineData => d.value !== null && isValidNumber(d.value));
      try { ema8SeriesRef.current?.setData(ema8Data); } catch {}

      // EMA 21
      const ema21 = calculateEMA(closes, 21);
      const ema21Data = validData
        .map((c, i) => ({ time: toChartTime(c.time), value: ema21[i] }))
        .filter((d): d is LineData => d.value !== null && isValidNumber(d.value));
      try { ema21SeriesRef.current?.setData(ema21Data); } catch {}

      // VWAP
      const vwap = calculateVWAP(validData);
      const vwapData = validData
        .map((c, i) => ({ time: toChartTime(c.time), value: vwap[i] }))
        .filter((d): d is LineData => d.value !== null && isValidNumber(d.value));
      try { vwapSeriesRef.current?.setData(vwapData); } catch {}
    }

    // Set visible range and update last candle time ref
    if (chartRef.current && validData.length > 0) {
      // Track last candle time for imperative updates
      lastCandleTimeRef.current = validData[validData.length - 1].time;

      try {
        const visibleBars = Math.min(200, validData.length);
        chartRef.current.timeScale().setVisibleLogicalRange({
          from: validData.length - visibleBars,
          to: validData.length - 1,
        });
      } catch {}
    }
  }, [data, isInitialized, showVolume, showIndicators, patienceCandles]);

  // ==========================================================================
  // Update Level Lines
  // ==========================================================================
  useEffect(() => {
    if (!mountedRef.current || !isInitialized || data.length === 0) return;

    const pool = levelSeriesPool.current;
    if (pool.length === 0) return;

    const startTime = toChartTime(data[0].time);
    // Use far-future time so lines extend into the right offset (empty space)
    // This prevents levels from stopping abruptly at the last candle edge
    const endTime = FAR_FUTURE_SECONDS as Time;

    const validLevels = levels.filter((l) => isValidPrice(l.price)).slice(0, MAX_LEVEL_SERIES);

    pool.forEach((series, i) => {
      const level = validLevels[i];
      if (!level) {
        try { series.setData([]); } catch {}
        return;
      }

      try {
        series.applyOptions({
          color: level.color || COLORS.text,
          lineStyle:
            level.lineStyle === 'dotted'
              ? LineStyle.Dotted
              : level.lineStyle === 'dashed'
              ? LineStyle.Dashed
              : LineStyle.Solid,
          title: level.label,
        });

        series.setData([
          { time: startTime, value: level.price },
          { time: endTime, value: level.price },
        ]);
      } catch {}
    });
  }, [levels, data, isInitialized]);

  // ==========================================================================
  // Update Gamma Levels
  // ==========================================================================
  useEffect(() => {
    if (!mountedRef.current || !isInitialized || data.length === 0) return;

    const pool = gammaSeriesPool.current;
    if (pool.length === 0) return;

    const startTime = toChartTime(data[0].time);
    // Use far-future time so gamma lines extend into the right offset (empty space)
    // This prevents gamma levels from stopping abruptly at the last candle edge
    const endTime = FAR_FUTURE_SECONDS as Time;

    const validGamma = gammaLevels.filter((g) => isValidPrice(g.price)).slice(0, MAX_GAMMA_SERIES);

    pool.forEach((series, i) => {
      const gamma = validGamma[i];
      if (!gamma) {
        try { series.setData([]); } catch {}
        return;
      }

      let color: string = COLORS.textMuted;
      if (gamma.type === 'call_wall') color = COLORS.callWall;
      else if (gamma.type === 'put_wall') color = COLORS.putWall;
      else if (gamma.type === 'zero_gamma') color = COLORS.zeroGamma;
      else if (gamma.type === 'max_pain') color = COLORS.maxPain;

      try {
        series.applyOptions({
          color,
          lineWidth: 2,
          lineStyle: LineStyle.Dashed,
          title: gamma.label || gamma.type.replace('_', ' ').toUpperCase(),
        });

        series.setData([
          { time: startTime, value: gamma.price },
          { time: endTime, value: gamma.price },
        ]);
      } catch {}
    });
  }, [gammaLevels, data, isInitialized]);

  // ==========================================================================
  // Update dimensions
  // ==========================================================================
  useEffect(() => {
    if (chartRef.current && dimensions.width > 0 && dimensions.height > 0) {
      chartRef.current.applyOptions({
        width: dimensions.width,
        height: dimensions.height,
      });
    }
  }, [dimensions]);

  // ==========================================================================
  // Render
  // ==========================================================================
  return (
    <div
      ref={containerRef}
      className={`w-full h-full relative ${className}`}
      style={{
        height: typeof height === 'number' ? `${height}px` : height,
        minHeight: 300,
        backgroundColor: COLORS.background,
      }}
    >
      {/* Loading state */}
      {(!isInitialized || data.length === 0) && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0b0e11]">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-[#26a69a] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-[#787b86] font-mono">
              {data.length === 0 ? 'Waiting for data...' : 'Initializing chart...'}
            </p>
            {symbol && <p className="text-xs text-[#787b86] mt-1">{symbol}</p>}
          </div>
        </div>
      )}

      {/* Symbol badge */}
      {symbol && isInitialized && (
        <div className="absolute top-3 left-3 z-10 px-3 py-1.5 bg-[#1e222d] border border-[#2a2e39] text-[#d1d4dc] font-mono text-sm font-semibold">
          {symbol}
        </div>
      )}

      {/* Legend */}
      {showIndicators && isInitialized && (
        <div className="absolute bottom-3 left-3 z-10 flex items-center gap-4 text-[10px] font-mono bg-[#0b0e11]/80 px-2 py-1">
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5" style={{ backgroundColor: COLORS.ema8 }} />
            <span style={{ color: COLORS.ema8 }}>EMA8</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5" style={{ backgroundColor: COLORS.ema21 }} />
            <span style={{ color: COLORS.ema21 }}>EMA21</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5" style={{ backgroundColor: COLORS.vwap }} />
            <span style={{ color: COLORS.vwap }}>VWAP</span>
          </span>
        </div>
      )}
    </div>
  );
}));

export default ProfessionalChart;
