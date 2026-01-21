'use client';

/**
 * ProfessionalChart.tsx
 *
 * High-performance Canvas-based trading chart for Companion Mode.
 * Built on TradingView's lightweight-charts library for hardware-accelerated rendering.
 *
 * ARCHITECTURE:
 * - Uses forwardRef + useImperativeHandle to expose imperative methods
 * - WebSocket providers can call updateCandle() without causing React re-renders
 * - Massive Levels are drawn as infinite rays extending to the right
 * - ResizeObserver handles responsive sizing
 *
 * Key Features:
 * - Canvas rendering (GPU accelerated)
 * - Imperative updateCandle() for sub-100ms latency updates
 * - Massive Levels with infinite right extension
 * - Magnet crosshair mode
 * - Auto-scaling with right offset for future price action
 */

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  memo,
  forwardRef,
  useImperativeHandle,
} from 'react';
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
  UTCTimestamp,
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

/**
 * MassiveLevel - Support/Resistance rays that extend infinitely to the right.
 * These are key institutional levels from AI analysis.
 */
export interface MassiveLevel {
  id: string;
  price: number;
  label: string;
  type: 'support' | 'resistance' | 'pivot' | 'vwap' | 'gamma';
  strength?: number; // 0-100, for visual weight
  source?: string; // e.g., 'AI', 'Gamma', 'Previous Day'
}

export interface GammaLevel {
  price: number;
  type: 'call_wall' | 'put_wall' | 'zero_gamma' | 'max_pain';
  label?: string;
}

/**
 * Imperative handle exposed via ref.
 * WebSocket providers use these methods for efficient updates without React re-renders.
 */
export interface ProfessionalChartHandle {
  /** Update or create the last candle (for real-time ticks) */
  updateCandle: (candle: ChartCandle) => void;
  /** Add a new completed candle */
  addCandle: (candle: ChartCandle) => void;
  /** Set all candle data (for initial load) */
  setData: (candles: ChartCandle[]) => void;
  /** Add a marker to the chart (entry, exit, alert) */
  addMarker: (marker: SeriesMarker<Time>) => void;
  /** Clear all markers */
  clearMarkers: () => void;
  /** Update massive levels (infinite rays) */
  setMassiveLevels: (levels: MassiveLevel[]) => void;
  /** Get current visible price range */
  getVisiblePriceRange: () => { min: number; max: number } | null;
  /** Scroll to latest candle */
  scrollToRealtime: () => void;
  /** Get the underlying chart API (advanced use) */
  getChartApi: () => IChartApi | null;
  /** Get latency metrics */
  getLatencyMs: () => number;
}

export interface ProfessionalChartProps {
  /** Initial candle data array */
  data?: ChartCandle[];
  /** Symbol being displayed */
  symbol?: string;
  /** Key levels (PDH, PDL, VWAP, etc.) - legacy, prefer massiveLevels */
  levels?: ChartLevel[];
  /** Massive Levels - infinite rays from AI analysis */
  massiveLevels?: MassiveLevel[];
  /** Gamma levels from options flow */
  gammaLevels?: GammaLevel[];
  /** Chart height (defaults to 100%) */
  height?: number | string;
  /** Show volume histogram */
  showVolume?: boolean;
  /** Show EMA indicators */
  showIndicators?: boolean;
  /** Callback when crosshair moves */
  onCrosshairMove?: (price: number | null, time: Time | null) => void;
  /** Callback when price updates (for latency tracking) */
  onPriceUpdate?: (price: number, latencyMs: number) => void;
  /** Additional CSS classes */
  className?: string;
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
  pivot: '#ffeb3b',

  // Gamma
  callWall: '#ef5350',
  putWall: '#26a69a',
  zeroGamma: '#ffeb3b',
  maxPain: '#ab47bc',

  // Massive Levels by type
  massiveSupport: '#26a69a',
  massiveResistance: '#ef5350',
  massivePivot: '#ffd700',
  massiveVwap: '#ab47bc',
  massiveGamma: '#00bcd4',
} as const;

// =============================================================================
// Utility Functions
// =============================================================================

function toChartTime(timestamp: number): Time {
  const timeInSeconds = timestamp > 1e12 ? Math.floor(timestamp / 1000) : timestamp;
  return timeInSeconds as Time;
}

function getFarFutureTime(): Time {
  // 10 years from now - effectively infinite for trading purposes
  return (Math.floor(Date.now() / 1000) + 315360000) as Time;
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

function calculateVWAP(candles: ChartCandle[]): (number | null)[] {
  const vwap: (number | null)[] = [];
  let cumulativeTPV = 0;
  let cumulativeVolume = 0;
  let lastTradingDate: string | null = null;

  for (const candle of candles) {
    if (!isValidPrice(candle.high) || !isValidPrice(candle.low) || !isValidPrice(candle.close)) {
      vwap.push(null);
      continue;
    }

    const candleDate = new Date(candle.time * 1000);
    const etDate = candleDate.toLocaleDateString('en-US', { timeZone: 'America/New_York' });

    if (lastTradingDate !== null && etDate !== lastTradingDate) {
      cumulativeTPV = 0;
      cumulativeVolume = 0;
    }
    lastTradingDate = etDate;

    const typicalPrice = (candle.high + candle.low + candle.close) / 3;
    const volume = isValidNumber(candle.volume) && candle.volume > 0 ? candle.volume : 1;
    cumulativeTPV += typicalPrice * volume;
    cumulativeVolume += volume;
    vwap.push(cumulativeVolume > 0 ? cumulativeTPV / cumulativeVolume : null);
  }
  return vwap;
}

function getMassiveLevelColor(type: MassiveLevel['type']): string {
  switch (type) {
    case 'support': return COLORS.massiveSupport;
    case 'resistance': return COLORS.massiveResistance;
    case 'pivot': return COLORS.massivePivot;
    case 'vwap': return COLORS.massiveVwap;
    case 'gamma': return COLORS.massiveGamma;
    default: return COLORS.text;
  }
}

// Series pool sizes
const MAX_LEVEL_SERIES = 15;
const MAX_GAMMA_SERIES = 5;
const MAX_MASSIVE_LEVEL_SERIES = 20;

// =============================================================================
// Main Component
// =============================================================================

function ProfessionalChartInner(
  {
    data: initialData = [],
    symbol,
    levels = [],
    massiveLevels = [],
    gammaLevels = [],
    height = '100%',
    showVolume = true,
    showIndicators = true,
    onCrosshairMove,
    onPriceUpdate,
    className = '',
  }: ProfessionalChartProps,
  ref: React.ForwardedRef<ProfessionalChartHandle>
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const mountedRef = useRef(true);

  // Series refs
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const ema8SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const ema21SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const vwapSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

  // Pre-allocated series pools
  const levelSeriesPool = useRef<ISeriesApi<'Line'>[]>([]);
  const gammaSeriesPool = useRef<ISeriesApi<'Line'>[]>([]);
  const massiveLevelSeriesPool = useRef<ISeriesApi<'Line'>[]>([]);

  // Data cache for efficient updates
  const candleDataCache = useRef<ChartCandle[]>([]);
  const markersCache = useRef<SeriesMarker<Time>[]>([]);
  const lastUpdateTimestamp = useRef<number>(0);


  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [isInitialized, setIsInitialized] = useState(false);

  // Track mount state
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ==========================================================================
  // Resize Observer
  // ==========================================================================
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
        rightOffset: 12,
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

    // Pre-create legacy level series pool
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

    // Pre-create MASSIVE LEVEL series pool (infinite rays)
    const massivePool: ISeriesApi<'Line'>[] = [];
    for (let i = 0; i < MAX_MASSIVE_LEVEL_SERIES; i++) {
      const series = chart.addLineSeries({
        color: '#6b7280',
        lineWidth: 2,
        priceLineVisible: true, // Show price on right axis
        lastValueVisible: true,
        crosshairMarkerVisible: true,
        lineStyle: LineStyle.Solid,
      });
      series.setData([]);
      massivePool.push(series);
    }
    massiveLevelSeriesPool.current = massivePool;

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
        massiveLevelSeriesPool.current.forEach((s) => { try { s.setData([]); } catch {} });
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
      massiveLevelSeriesPool.current = [];

      setIsInitialized(false);
      try { chart.remove(); } catch {}
      chartRef.current = null;
    };
  }, [dimensions.width, dimensions.height, showVolume, showIndicators]);

  // ==========================================================================
  // Update Dimensions on Resize
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
  // Internal setData function - can be called directly or via ref
  // ==========================================================================
  const setDataInternal = useCallback((candles: ChartCandle[]) => {
    if (!candleSeriesRef.current) return;

    const validData = candles.filter(
      (c) =>
        isValidPrice(c.open) &&
        isValidPrice(c.high) &&
        isValidPrice(c.low) &&
        isValidPrice(c.close) &&
        isValidNumber(c.time) &&
        c.time > 0
    );

    // Update cache
    candleDataCache.current = validData;

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

      const ema8 = calculateEMA(closes, 8);
      const ema8Data = validData
        .map((c, i) => ({ time: toChartTime(c.time), value: ema8[i] }))
        .filter((d): d is LineData => d.value !== null && isValidNumber(d.value));
      try { ema8SeriesRef.current?.setData(ema8Data); } catch {}

      const ema21 = calculateEMA(closes, 21);
      const ema21Data = validData
        .map((c, i) => ({ time: toChartTime(c.time), value: ema21[i] }))
        .filter((d): d is LineData => d.value !== null && isValidNumber(d.value));
      try { ema21SeriesRef.current?.setData(ema21Data); } catch {}

      const vwap = calculateVWAP(validData);
      const vwapData = validData
        .map((c, i) => ({ time: toChartTime(c.time), value: vwap[i] }))
        .filter((d): d is LineData => d.value !== null && isValidNumber(d.value));
      try { vwapSeriesRef.current?.setData(vwapData); } catch {}
    }

    // Set visible range
    if (chartRef.current && validData.length > 0) {
      try {
        const visibleBars = Math.min(200, validData.length);
        chartRef.current.timeScale().setVisibleLogicalRange({
          from: validData.length - visibleBars,
          to: validData.length - 1,
        });
      } catch {}
    }
  }, [showVolume, showIndicators]);

  // ==========================================================================
  // Imperative Handle - Exposed to WebSocket Provider
  // ==========================================================================
  useImperativeHandle(
    ref,
    () => ({
      /**
       * Update or create the last candle efficiently.
       * Called on every tick from WebSocket - MUST be fast.
       */
      updateCandle: (candle: ChartCandle) => {
        if (!candleSeriesRef.current || !isValidPrice(candle.close)) return;

        const startTime = performance.now();
        const time = toChartTime(candle.time);

        try {
          // Update candlestick
          candleSeriesRef.current.update({
            time,
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
          });

          // Update volume
          if (volumeSeriesRef.current && isValidNumber(candle.volume)) {
            volumeSeriesRef.current.update({
              time,
              value: candle.volume,
              color: candle.close >= candle.open ? COLORS.volumeUp : COLORS.volumeDown,
            });
          }

          // Track latency
          const latencyMs = performance.now() - startTime;
          lastUpdateTimestamp.current = Date.now();

          // Notify listener
          if (onPriceUpdate) {
            onPriceUpdate(candle.close, latencyMs);
          }
        } catch (e) {
          // Silent fail for real-time updates
        }
      },

      /**
       * Add a new completed candle to the chart.
       */
      addCandle: (candle: ChartCandle) => {
        if (!candleSeriesRef.current || !isValidPrice(candle.close)) return;

        const time = toChartTime(candle.time);

        try {
          candleSeriesRef.current.update({
            time,
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
          });

          if (volumeSeriesRef.current && isValidNumber(candle.volume)) {
            volumeSeriesRef.current.update({
              time,
              value: candle.volume,
              color: candle.close >= candle.open ? COLORS.volumeUp : COLORS.volumeDown,
            });
          }

          // Update cache
          candleDataCache.current.push(candle);

          // Update indicators (only for new candles)
          if (showIndicators && candleDataCache.current.length >= 21) {
            const closes = candleDataCache.current.map((c) => c.close);
            const len = candleDataCache.current.length;

            // Just update the latest point for EMAs
            const ema8 = calculateEMA(closes, 8);
            const ema21 = calculateEMA(closes, 21);
            const vwap = calculateVWAP(candleDataCache.current);

            if (ema8[len - 1] !== null) {
              ema8SeriesRef.current?.update({ time, value: ema8[len - 1]! });
            }
            if (ema21[len - 1] !== null) {
              ema21SeriesRef.current?.update({ time, value: ema21[len - 1]! });
            }
            if (vwap[len - 1] !== null) {
              vwapSeriesRef.current?.update({ time, value: vwap[len - 1]! });
            }
          }
        } catch (e) {
          console.warn('[ProfessionalChart] addCandle error:', e);
        }
      },

      /**
       * Set all candle data (for initial load or symbol change).
       */
      setData: setDataInternal,

      /**
       * Add a marker (entry, exit, alert point).
       */
      addMarker: (marker: SeriesMarker<Time>) => {
        if (!candleSeriesRef.current) return;
        markersCache.current.push(marker);
        try {
          candleSeriesRef.current.setMarkers(markersCache.current);
        } catch {}
      },

      /**
       * Clear all markers.
       */
      clearMarkers: () => {
        markersCache.current = [];
        try {
          candleSeriesRef.current?.setMarkers([]);
        } catch {}
      },

      /**
       * Set Massive Levels - infinite rays extending to the right.
       * These are AI-detected support/resistance levels.
       */
      setMassiveLevels: (newLevels: MassiveLevel[]) => {
        const pool = massiveLevelSeriesPool.current;
        if (pool.length === 0 || candleDataCache.current.length === 0) return;

        const startTime = candleDataCache.current.length > 0
          ? toChartTime(candleDataCache.current[0].time)
          : toChartTime(Date.now() / 1000);
        const farFuture = getFarFutureTime();

        const validLevels = newLevels
          .filter((l) => isValidPrice(l.price))
          .slice(0, MAX_MASSIVE_LEVEL_SERIES);

        pool.forEach((series, i) => {
          const level = validLevels[i];
          if (!level) {
            try { series.setData([]); } catch {}
            return;
          }

          const color = getMassiveLevelColor(level.type);
          const lineWidth = (level.strength ? Math.max(1, Math.min(4, Math.floor(level.strength / 25))) : 2) as 1 | 2 | 3 | 4;

          try {
            series.applyOptions({
              color,
              lineWidth,
              lineStyle: level.type === 'vwap' ? LineStyle.Dashed : LineStyle.Solid,
              title: level.label,
              priceLineVisible: true,
              lastValueVisible: true,
            });

            // Draw from first candle to infinite future (effectively infinite ray)
            series.setData([
              { time: startTime, value: level.price },
              { time: farFuture, value: level.price },
            ]);
          } catch {}
        });
      },

      /**
       * Get visible price range.
       * Note: lightweight-charts doesn't expose this directly, so we return null
       * and let consumers calculate from visible data if needed.
       */
      getVisiblePriceRange: () => {
        // lightweight-charts IPriceScaleApi doesn't have getVisiblePriceRange
        // Return null - consumers can calculate from visible candle data if needed
        return null;
      },

      /**
       * Scroll to show latest candle.
       */
      scrollToRealtime: () => {
        try {
          chartRef.current?.timeScale().scrollToRealTime();
        } catch {}
      },

      /**
       * Get underlying chart API for advanced use.
       */
      getChartApi: () => chartRef.current,

      /**
       * Get time since last update (for latency tracking).
       */
      getLatencyMs: () => {
        if (lastUpdateTimestamp.current === 0) return 0;
        return Date.now() - lastUpdateTimestamp.current;
      },
    }),
    [showVolume, showIndicators, onPriceUpdate]
  );

  // ==========================================================================
  // Initial Data Load
  // ==========================================================================
  useEffect(() => {
    if (!mountedRef.current || !isInitialized || initialData.length === 0) return;

    // Call internal setData directly - works regardless of whether ref is passed
    setDataInternal(initialData);
  }, [initialData, isInitialized, setDataInternal]);

  // ==========================================================================
  // Update Legacy Levels
  // ==========================================================================
  useEffect(() => {
    if (!mountedRef.current || !isInitialized || candleDataCache.current.length === 0) return;

    const pool = levelSeriesPool.current;
    if (pool.length === 0) return;

    const data = candleDataCache.current;
    const startTime = toChartTime(data[0].time);
    const endTime = toChartTime(data[data.length - 1].time);

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
  }, [levels, isInitialized]);

  // ==========================================================================
  // Update Gamma Levels
  // ==========================================================================
  useEffect(() => {
    if (!mountedRef.current || !isInitialized || candleDataCache.current.length === 0) return;

    const pool = gammaSeriesPool.current;
    if (pool.length === 0) return;

    const data = candleDataCache.current;
    const startTime = toChartTime(data[0].time);
    const endTime = toChartTime(data[data.length - 1].time);

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
  }, [gammaLevels, isInitialized]);

  // ==========================================================================
  // Update Massive Levels from props
  // ==========================================================================
  useEffect(() => {
    if (!mountedRef.current || !isInitialized || massiveLevels.length === 0) return;

    const handle = ref as React.RefObject<ProfessionalChartHandle>;
    if (handle?.current?.setMassiveLevels) {
      handle.current.setMassiveLevels(massiveLevels);
    }
  }, [massiveLevels, isInitialized, ref]);

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
      {(!isInitialized || (initialData.length === 0 && candleDataCache.current.length === 0)) && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0b0e11]">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-[#26a69a] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-[#787b86] font-mono">
              {initialData.length === 0 ? 'Waiting for data...' : 'Initializing chart...'}
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
}

// Wrap with forwardRef and memo
export const ProfessionalChart = memo(forwardRef(ProfessionalChartInner));

export default ProfessionalChart;
