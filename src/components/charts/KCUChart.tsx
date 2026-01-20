'use client';

/**
 * KCUChart - Unified Trading Chart Component
 *
 * A lightweight-charts based charting component that serves both
 * Companion Mode (live) and Practice Mode (replay).
 *
 * Features:
 * - Somesh's Indicators: 8 EMA, 21 EMA, 200 SMA, VWAP, Ripster Clouds
 * - Gamma Levels: Call Wall (cyan) and Put Wall (magenta)
 * - FVG Zones: Fair Value Gap visualization
 * - Patience Candle: Inside Bar detection with yellow diamond markers
 *
 * @example
 * ```tsx
 * <KCUChart
 *   mode="live"
 *   data={candles}
 *   levels={keyLevels}
 *   gammaLevels={gammaData}
 *   fvgZones={fvgData}
 *   symbol="TSLA"
 *   onCandleClick={(candle) => console.log(candle)}
 * />
 * ```
 */

import { useEffect, useRef, useCallback, useState, useLayoutEffect } from 'react';
import {
  createChart,
  ColorType,
  CrosshairMode,
  LineStyle,
  IChartApi,
  ISeriesApi,
  CandlestickData,
  LineData,
  AreaData,
  Time,
  SeriesMarker,
  SeriesMarkerShape,
} from 'lightweight-charts';
import { Loader2 } from 'lucide-react';

// =============================================================================
// Types
// =============================================================================

export interface Candle {
  time: number | string; // Unix timestamp or ISO string
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
  strength?: number; // 0-100
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
  /** Chart operating mode */
  mode: 'live' | 'replay';
  /** Candle data array */
  data: Candle[];
  /** Key price levels */
  levels?: Level[];
  /** Gamma exposure levels from options flow */
  gammaLevels?: GammaLevel[];
  /** Fair Value Gap zones */
  fvgZones?: FVGZone[];
  /** Trading symbol */
  symbol?: string;
  /** Chart height in pixels */
  height?: number;
  /** Show volume histogram */
  showVolume?: boolean;
  /** Show Somesh's indicators */
  showIndicators?: boolean;
  /** Show patience candle markers */
  showPatienceCandles?: boolean;
  /** Callback when candle is clicked */
  onCandleClick?: (candle: Candle, index: number) => void;
  /** Callback when crosshair moves */
  onCrosshairMove?: (price: number | null, time: Time | null) => void;
  /** Current replay index for replay mode */
  replayIndex?: number;
  /** Custom CSS class */
  className?: string;
}

// =============================================================================
// Constants - Somesh's Indicator Colors
// =============================================================================

const CHART_COLORS = {
  // Background
  background: '#0d0d0d',
  textColor: '#d1d5db',
  gridColor: 'rgba(255, 255, 255, 0.03)',

  // Candles
  upColor: '#22c55e',
  downColor: '#ef4444',
  wickUpColor: '#22c55e',
  wickDownColor: '#ef4444',

  // Somesh's Indicators
  ema8: '#22c55e',      // GREEN - Fast EMA
  ema21: '#ef4444',     // RED - Slow EMA
  sma200: '#f97316',    // ORANGE - 200 SMA (dotted)
  vwap: '#ffffff',      // WHITE - VWAP

  // Ripster Clouds
  cloudBullish: 'rgba(34, 197, 94, 0.15)',   // Green tint when EMA8 > EMA21
  cloudBearish: 'rgba(239, 68, 68, 0.15)',   // Red tint when EMA8 < EMA21

  // Gamma Levels (Institutional)
  callWall: '#ff00ff',    // MAGENTA - Resistance (MM selling calls)
  putWall: '#00ffff',     // CYAN - Support (MM selling puts)
  zeroGamma: '#ffffff',   // WHITE - Gamma flip point
  maxPain: '#8b5cf6',     // PURPLE - Max pain strike

  // FVG Zones
  fvgBullish: 'rgba(34, 197, 94, 0.2)',
  fvgBearish: 'rgba(239, 68, 68, 0.2)',

  // Patience Candle
  patienceMarker: '#fbbf24', // YELLOW diamond

  // Volume
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

// =============================================================================
// Indicator Calculation Utilities
// =============================================================================

function calculateEMA(data: number[], period: number): number[] {
  const ema: number[] = [];
  const multiplier = 2 / (period + 1);

  if (data.length === 0) return ema;

  // First EMA is SMA
  let sum = 0;
  for (let i = 0; i < Math.min(period, data.length); i++) {
    sum += data[i];
  }
  ema[period - 1] = sum / Math.min(period, data.length);

  // Calculate EMA for remaining values
  for (let i = period; i < data.length; i++) {
    ema[i] = (data[i] - ema[i - 1]) * multiplier + ema[i - 1];
  }

  return ema;
}

function calculateSMA(data: number[], period: number): number[] {
  const sma: number[] = [];

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      sma[i] = NaN;
      continue;
    }

    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += data[i - j];
    }
    sma[i] = sum / period;
  }

  return sma;
}

function calculateVWAP(candles: Candle[]): number[] {
  const vwap: number[] = [];
  let cumulativeTPV = 0;
  let cumulativeVolume = 0;

  for (let i = 0; i < candles.length; i++) {
    const candle = candles[i];
    const typicalPrice = (candle.high + candle.low + candle.close) / 3;
    const volume = candle.volume || 1;

    cumulativeTPV += typicalPrice * volume;
    cumulativeVolume += volume;

    vwap[i] = cumulativeVolume > 0 ? cumulativeTPV / cumulativeVolume : typicalPrice;
  }

  return vwap;
}

/**
 * Detect Inside Bar (Patience Candle) pattern
 * An Inside Bar has: High < Previous High AND Low > Previous Low
 */
function detectInsideBars(candles: Candle[]): number[] {
  const insideBarIndices: number[] = [];

  for (let i = 1; i < candles.length; i++) {
    const current = candles[i];
    const previous = candles[i - 1];

    if (current.high < previous.high && current.low > previous.low) {
      insideBarIndices.push(i);
    }
  }

  return insideBarIndices;
}

/**
 * Convert timestamp to lightweight-charts Time format
 * Returns null for invalid inputs to prevent "Value is null" errors
 */
function toChartTime(time: number | string | null | undefined): Time | null {
  if (time == null) return null;

  let result: number;

  if (typeof time === 'string') {
    const date = new Date(time);
    if (isNaN(date.getTime())) return null;
    result = Math.floor(date.getTime() / 1000);
  } else {
    if (!isFinite(time)) return null;
    // If already in seconds, use directly; if in ms, convert
    result = time > 1e12 ? Math.floor(time / 1000) : time;
  }

  // Final validation - must be a finite positive number
  if (!isFinite(result) || result <= 0) return null;

  return result as Time;
}

// =============================================================================
// Main Component
// =============================================================================

// Minimum height fallback when container has 0 height
const MIN_CHART_HEIGHT = 400;
// Enable visual debugging (set to true to show red border)
const DEBUG_CHART = false;

export function KCUChart({
  mode,
  data,
  levels = [],
  gammaLevels = [],
  fvgZones = [],
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
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const ema8SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const ema21SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const sma200SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const vwapSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const cloudSeriesRef = useRef<ISeriesApi<'Area'> | null>(null);
  const levelSeriesRef = useRef<Map<string, ISeriesApi<'Line'>>>(new Map());

  const [isInitialized, setIsInitialized] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Gamma level refs for cleanup
  const gammaSeriesRef = useRef<Map<string, ISeriesApi<'Line'>>>(new Map());
  // FVG area series refs
  const fvgSeriesRef = useRef<Map<string, ISeriesApi<'Area'>>>(new Map());

  // Pulsing overlay state - tracks which levels price is near
  const [proximityAlerts, setProximityAlerts] = useState<{
    type: 'call_wall' | 'put_wall' | 'zero_gamma';
    price: number;
    yCoordinate: number;
  }[]>([]);

  // =========================================================================
  // Dimension Detection with ResizeObserver
  // =========================================================================

  useLayoutEffect(() => {
    if (!containerRef.current) return;

    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const newWidth = rect.width || containerRef.current.clientWidth;
        const newHeight = height || rect.height || containerRef.current.clientHeight || MIN_CHART_HEIGHT;

        // Only update if dimensions actually changed
        setDimensions(prev => {
          if (prev.width !== newWidth || prev.height !== newHeight) {
            return { width: newWidth, height: Math.max(newHeight, MIN_CHART_HEIGHT) };
          }
          return prev;
        });
      }
    };

    // Initial measurement
    updateDimensions();

    // Use ResizeObserver for responsive updates
    const resizeObserver = new ResizeObserver((entries) => {
      // Use requestAnimationFrame to avoid resize loop issues
      window.requestAnimationFrame(() => {
        if (entries[0]) {
          updateDimensions();
        }
      });
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [height]);

  // Update chart dimensions when they change
  useEffect(() => {
    if (chartRef.current && dimensions.width > 0 && dimensions.height > 0) {
      chartRef.current.applyOptions({
        width: dimensions.width,
        height: dimensions.height,
      });
    }
  }, [dimensions]);

  // =========================================================================
  // Chart Initialization
  // =========================================================================

  useEffect(() => {
    if (!containerRef.current) return;
    // Wait for valid dimensions before creating chart
    if (dimensions.width <= 0 || dimensions.height <= 0) return;

    // Create chart with measured dimensions
    const chartHeight = dimensions.height;
    const chartWidth = dimensions.width;

    const chart = createChart(containerRef.current, {
      width: chartWidth,
      height: chartHeight,
      layout: {
        background: { type: ColorType.Solid, color: CHART_COLORS.background },
        textColor: CHART_COLORS.textColor,
      },
      grid: {
        vertLines: { color: CHART_COLORS.gridColor },
        horzLines: { color: CHART_COLORS.gridColor },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: 'rgba(255, 255, 255, 0.3)',
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: '#1e293b',
        },
        horzLine: {
          color: 'rgba(255, 255, 255, 0.3)',
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: '#1e293b',
        },
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
        scaleMargins: {
          top: 0.1,
          bottom: showVolume ? 0.2 : 0.1,
        },
      },
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    chartRef.current = chart;

    // Create candlestick series
    const candleSeries = chart.addCandlestickSeries({
      upColor: CHART_COLORS.upColor,
      downColor: CHART_COLORS.downColor,
      wickUpColor: CHART_COLORS.wickUpColor,
      wickDownColor: CHART_COLORS.wickDownColor,
      borderVisible: false,
    });
    candleSeriesRef.current = candleSeries;

    // Create volume series if enabled
    if (showVolume) {
      const volumeSeries = chart.addHistogramSeries({
        priceFormat: { type: 'volume' },
        priceScaleId: 'volume',
      });
      volumeSeries.priceScale().applyOptions({
        scaleMargins: { top: 0.85, bottom: 0 },
      });
      volumeSeriesRef.current = volumeSeries;
    }

    // Create indicator series if enabled
    if (showIndicators) {
      // EMA 8 (Green)
      const ema8Series = chart.addLineSeries({
        color: CHART_COLORS.ema8,
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      ema8SeriesRef.current = ema8Series;

      // EMA 21 (Red)
      const ema21Series = chart.addLineSeries({
        color: CHART_COLORS.ema21,
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      ema21SeriesRef.current = ema21Series;

      // SMA 200 (Orange, Dotted)
      const sma200Series = chart.addLineSeries({
        color: CHART_COLORS.sma200,
        lineWidth: 1,
        lineStyle: LineStyle.Dotted,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      sma200SeriesRef.current = sma200Series;

      // VWAP (White)
      const vwapSeries = chart.addLineSeries({
        color: CHART_COLORS.vwap,
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      vwapSeriesRef.current = vwapSeries;

      // Ripster Cloud (Area between EMA8 and EMA21)
      const cloudSeries = chart.addAreaSeries({
        lineColor: 'transparent',
        topColor: CHART_COLORS.cloudBullish,
        bottomColor: 'transparent',
        priceLineVisible: false,
        lastValueVisible: false,
      });
      cloudSeriesRef.current = cloudSeries;
    }

    // Crosshair move handler
    if (onCrosshairMove) {
      chart.subscribeCrosshairMove((param) => {
        if (!param.point || !param.time) {
          onCrosshairMove(null, null);
          return;
        }
        const price = candleSeries.coordinateToPrice(param.point.y);
        onCrosshairMove(price, param.time);
      });
    }

    // Click handler
    if (onCandleClick) {
      chart.subscribeClick((param) => {
        if (!param.time) return;
        const clickedCandle = data.find(
          (c) => toChartTime(c.time) === param.time
        );
        if (clickedCandle) {
          const index = data.indexOf(clickedCandle);
          onCandleClick(clickedCandle, index);
        }
      });
    }

    // Note: ResizeObserver handles resize events, no need for window listener

    setIsInitialized(true);

    return () => {
      chart.remove();
      chartRef.current = null;
      setIsInitialized(false);
    };
  }, [dimensions.width, dimensions.height, showVolume, showIndicators]);

  // =========================================================================
  // Data Updates
  // =========================================================================

  useEffect(() => {
    if (!isInitialized || !candleSeriesRef.current) return;

    // Determine visible data based on mode and replay index
    const rawData = mode === 'replay' && replayIndex !== undefined
      ? data.slice(0, replayIndex + 1)
      : data;

    // Filter out candles with invalid OHLC values to prevent chart errors
    const visibleData = rawData.filter((c) =>
      c.open != null && !isNaN(c.open) &&
      c.high != null && !isNaN(c.high) &&
      c.low != null && !isNaN(c.low) &&
      c.close != null && !isNaN(c.close) &&
      c.time != null
    );

    if (visibleData.length === 0) return;

    // Convert to chart format, filtering out any candles with invalid times
    const candleData: CandlestickData[] = visibleData
      .map((c) => {
        const time = toChartTime(c.time);
        if (time === null) return null;
        return {
          time,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        };
      })
      .filter((c): c is CandlestickData => c !== null);

    // Update candle series
    candleSeriesRef.current.setData(candleData);

    // Update volume series
    if (volumeSeriesRef.current && showVolume) {
      const volumeData = visibleData
        .map((c) => {
          const time = toChartTime(c.time);
          if (time === null) return null;
          return {
            time,
            value: c.volume || 0,
            color: c.close >= c.open ? CHART_COLORS.volumeUp : CHART_COLORS.volumeDown,
          };
        })
        .filter((v): v is NonNullable<typeof v> => v !== null);
      volumeSeriesRef.current.setData(volumeData);
    }

    // Update indicators
    if (showIndicators && visibleData.length > 0) {
      const closePrices = visibleData.map((c) => c.close);

      // EMA 8
      if (ema8SeriesRef.current) {
        const ema8Values = calculateEMA(closePrices, 8);
        const ema8Data: LineData[] = visibleData
          .map((c, i) => {
            const time = toChartTime(c.time);
            if (time === null) return null;
            return { time, value: ema8Values[i] };
          })
          .filter((d): d is LineData => d !== null && d.value != null && !isNaN(d.value));
        ema8SeriesRef.current.setData(ema8Data);
      }

      // EMA 21
      if (ema21SeriesRef.current) {
        const ema21Values = calculateEMA(closePrices, 21);
        const ema21Data: LineData[] = visibleData
          .map((c, i) => {
            const time = toChartTime(c.time);
            if (time === null) return null;
            return { time, value: ema21Values[i] };
          })
          .filter((d): d is LineData => d !== null && d.value != null && !isNaN(d.value));
        ema21SeriesRef.current.setData(ema21Data);
      }

      // SMA 200
      if (sma200SeriesRef.current) {
        const sma200Values = calculateSMA(closePrices, 200);
        const sma200Data: LineData[] = visibleData
          .map((c, i) => {
            const time = toChartTime(c.time);
            if (time === null) return null;
            return { time, value: sma200Values[i] };
          })
          .filter((d): d is LineData => d !== null && d.value != null && !isNaN(d.value));
        sma200SeriesRef.current.setData(sma200Data);
      }

      // VWAP
      if (vwapSeriesRef.current) {
        const vwapValues = calculateVWAP(visibleData);
        const vwapData: LineData[] = visibleData
          .map((c, i) => {
            const time = toChartTime(c.time);
            if (time === null) return null;
            return { time, value: vwapValues[i] };
          })
          .filter((d): d is LineData => d !== null && d.value != null && !isNaN(d.value));
        vwapSeriesRef.current.setData(vwapData);
      }

      // Ripster Cloud (fill between EMA8 and EMA21)
      if (cloudSeriesRef.current) {
        const ema8Values = calculateEMA(closePrices, 8);
        const ema21Values = calculateEMA(closePrices, 21);

        const cloudData: AreaData[] = visibleData
          .map((c, i) => {
            const time = toChartTime(c.time);
            if (time === null) return null;
            const ema8 = ema8Values[i];
            const ema21 = ema21Values[i];
            if (ema8 == null || ema21 == null || isNaN(ema8) || isNaN(ema21)) {
              return null;
            }
            return {
              time,
              value: Math.max(ema8, ema21),
              // Note: Area series doesn't support per-point colors directly
              // We use the higher EMA as the top line
            };
          })
          .filter((d): d is AreaData => d !== null);

        // Update cloud color based on trend
        const lastEma8 = ema8Values[ema8Values.length - 1];
        const lastEma21 = ema21Values[ema21Values.length - 1];
        const isBullish = lastEma8 > lastEma21;

        cloudSeriesRef.current.applyOptions({
          topColor: isBullish ? CHART_COLORS.cloudBullish : CHART_COLORS.cloudBearish,
          lineColor: isBullish ? CHART_COLORS.ema8 : CHART_COLORS.ema21,
        });
        cloudSeriesRef.current.setData(cloudData);
      }
    }

    // Patience Candle Markers (Inside Bars)
    if (showPatienceCandles && candleSeriesRef.current) {
      const insideBarIndices = detectInsideBars(visibleData);
      const markers: SeriesMarker<Time>[] = [];
      for (const i of insideBarIndices) {
        const time = toChartTime(visibleData[i].time);
        if (time === null) continue;
        markers.push({
          time,
          position: 'aboveBar',
          color: CHART_COLORS.patienceMarker,
          shape: 'arrowDown' as SeriesMarkerShape, // Diamond-like appearance
          text: '◆', // Diamond symbol
          size: 1,
        });
      }
      candleSeriesRef.current.setMarkers(markers);
    }

    // Fit content
    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  }, [data, mode, replayIndex, isInitialized, showVolume, showIndicators, showPatienceCandles]);

  // =========================================================================
  // Level Lines (Support/Resistance/Custom)
  // =========================================================================

  useEffect(() => {
    if (!isInitialized || !chartRef.current) return;

    // Clear existing level lines
    levelSeriesRef.current.forEach((series) => {
      chartRef.current?.removeSeries(series);
    });
    levelSeriesRef.current.clear();

    // Add new level lines (filter out invalid entries first)
    const validLevels = levels.filter(l => l.price != null && !isNaN(l.price) && l.price > 0);

    // Calculate current price range to filter out far-away levels
    let nearbyLevels = validLevels;
    if (data.length > 0) {
      const prices = data
        .flatMap(c => [c.high, c.low])
        .filter((p): p is number => p != null && !isNaN(p));
      if (prices.length > 0) {
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        const priceRange = maxPrice - minPrice;
        const midPrice = (maxPrice + minPrice) / 2;
        if (!isNaN(midPrice)) {
          const maxDistance = Math.max(priceRange * 2, midPrice * 0.15);
          nearbyLevels = validLevels.filter(l => Math.abs(l.price - midPrice) <= maxDistance);
        }
      }
    }

    nearbyLevels.forEach((level, index) => {
      const series = chartRef.current!.addLineSeries({
        color: level.color || LEVEL_COLORS[level.type],
        lineWidth: 1,
        lineStyle: level.lineStyle === 'dotted' ? LineStyle.Dotted :
                   level.lineStyle === 'dashed' ? LineStyle.Dashed :
                   LineStyle.Solid,
        priceLineVisible: true,
        lastValueVisible: true,
        title: level.label,
      });

      // Create a horizontal line across the visible range
      if (data.length > 0) {
        const startTime = toChartTime(data[0].time);
        const endTime = toChartTime(data[data.length - 1].time);

        // Only set data if both times are valid
        if (startTime !== null && endTime !== null) {
          const lineData: LineData[] = [
            { time: startTime, value: level.price },
            { time: endTime, value: level.price },
          ];
          series.setData(lineData);
        }
      }

      levelSeriesRef.current.set(`level-${index}`, series);
    });
  }, [levels, data, isInitialized]);

  // =========================================================================
  // Gamma Levels - Institutional Walls
  // =========================================================================

  useEffect(() => {
    if (!isInitialized || !chartRef.current) return;

    // Clear existing gamma level lines
    gammaSeriesRef.current.forEach((series) => {
      try {
        chartRef.current?.removeSeries(series);
      } catch {
        // Series may already be removed
      }
    });
    gammaSeriesRef.current.clear();

    // Filter out gamma levels with invalid prices
    const validGammaLevels = gammaLevels.filter(g => g.price != null && !isNaN(g.price) && g.price > 0);
    if (validGammaLevels.length === 0 || data.length === 0) return;

    // Calculate current price range from candle data (filter out null/NaN values)
    const prices = data
      .flatMap(c => [c.high, c.low])
      .filter((p): p is number => p != null && !isNaN(p));
    if (prices.length === 0) return;

    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice;
    const midPrice = (maxPrice + minPrice) / 2;

    // Guard against NaN calculations
    if (isNaN(minPrice) || isNaN(maxPrice) || isNaN(midPrice)) return;

    // Filter gamma levels to only show those within 15% of the current price range
    // This prevents far-away levels from distorting the chart scale
    const maxDistance = Math.max(priceRange * 2, midPrice * 0.15);
    const nearbyGammaLevels = validGammaLevels.filter(g =>
      Math.abs(g.price - midPrice) <= maxDistance
    );

    // Add gamma level lines with proper institutional styling
    // Use nearbyGammaLevels to avoid distorting the chart scale
    nearbyGammaLevels.forEach((gamma, index) => {
      // Determine color and line style based on type
      let color: string;
      let lineWidth: number;
      let lineStyle: LineStyle;
      let title: string;

      switch (gamma.type) {
        case 'call_wall':
          color = CHART_COLORS.callWall; // Magenta
          lineWidth = 3;
          lineStyle = LineStyle.Solid;
          title = gamma.label || '📈 CALL WALL';
          break;
        case 'put_wall':
          color = CHART_COLORS.putWall; // Cyan
          lineWidth = 3;
          lineStyle = LineStyle.Solid;
          title = gamma.label || '📉 PUT WALL';
          break;
        case 'zero_gamma':
          color = CHART_COLORS.zeroGamma; // White
          lineWidth = 2;
          lineStyle = LineStyle.Dashed;
          title = gamma.label || '⚡ ZERO GAMMA';
          break;
        case 'max_pain':
          color = CHART_COLORS.maxPain; // Purple
          lineWidth = 2;
          lineStyle = LineStyle.Dotted;
          title = gamma.label || '💀 MAX PAIN';
          break;
        default:
          color = '#6b7280';
          lineWidth = 1;
          lineStyle = LineStyle.Dotted;
          title = gamma.label || 'LEVEL';
      }

      const series = chartRef.current!.addLineSeries({
        color,
        lineWidth: lineWidth as 1 | 2 | 3 | 4,
        lineStyle,
        priceLineVisible: true,
        lastValueVisible: true,
        title,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 6,
      });

      // Create horizontal line across the full visible range
      const startTime = toChartTime(data[0].time);
      const endTime = toChartTime(data[data.length - 1].time);

      // Only set data if both times are valid
      if (startTime !== null && endTime !== null) {
        const lineData: LineData[] = [
          { time: startTime, value: gamma.price },
          { time: endTime, value: gamma.price },
        ];
        series.setData(lineData);
      }

      gammaSeriesRef.current.set(`gamma-${gamma.type}-${index}`, series);
    });

    // Cleanup function
    return () => {
      gammaSeriesRef.current.forEach((series) => {
        try {
          chartRef.current?.removeSeries(series);
        } catch {
          // Ignore cleanup errors
        }
      });
      gammaSeriesRef.current.clear();
    };
  }, [gammaLevels, data, isInitialized]);

  // =========================================================================
  // Proximity Alert Detection - Check if price is within 1% of gamma walls
  // =========================================================================

  useEffect(() => {
    if (!isInitialized || !chartRef.current || !candleSeriesRef.current) return;
    if (data.length === 0 || gammaLevels.length === 0) {
      setProximityAlerts([]);
      return;
    }

    // Get current price (last close)
    const currentPrice = data[data.length - 1].close;
    const alerts: typeof proximityAlerts = [];

    // Check each gamma level for proximity
    gammaLevels.forEach((gamma) => {
      if (gamma.type === 'max_pain') return; // Don't pulse for max pain

      const distance = Math.abs(currentPrice - gamma.price) / gamma.price;
      const proximityThreshold = 0.01; // 1%

      if (distance <= proximityThreshold) {
        // Convert price to Y coordinate for the overlay
        const priceScale = chartRef.current!.priceScale('right');
        // Use candlestick series to get coordinate
        const yCoordinate = candleSeriesRef.current!.priceToCoordinate(gamma.price);

        if (yCoordinate !== null) {
          alerts.push({
            type: gamma.type as 'call_wall' | 'put_wall' | 'zero_gamma',
            price: gamma.price,
            yCoordinate,
          });
        }
      }
    });

    setProximityAlerts(alerts);
  }, [data, gammaLevels, isInitialized, dimensions]);

  // =========================================================================
  // FVG Zones - Fair Value Gap Boxes
  // =========================================================================

  useEffect(() => {
    if (!isInitialized || !chartRef.current) return;

    // Clear existing FVG series
    fvgSeriesRef.current.forEach((series) => {
      try {
        chartRef.current?.removeSeries(series);
      } catch {
        // Series may already be removed
      }
    });
    fvgSeriesRef.current.clear();

    // Filter out FVG zones with invalid high/low values
    const validFvgZones = fvgZones.filter(z =>
      z.high != null && !isNaN(z.high) && z.high > 0 &&
      z.low != null && !isNaN(z.low) && z.low > 0
    );
    if (validFvgZones.length === 0 || data.length === 0) return;

    // Calculate current price range to filter out far-away FVG zones
    const prices = data
      .flatMap(c => [c.high, c.low])
      .filter((p): p is number => p != null && !isNaN(p));
    if (prices.length === 0) return;

    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice;
    const midPrice = (maxPrice + minPrice) / 2;

    // Guard against NaN calculations
    if (isNaN(midPrice)) return;

    const maxDistance = Math.max(priceRange * 2, midPrice * 0.15);

    // Filter FVG zones to only show those within range
    const nearbyFvgZones = validFvgZones.filter(z => {
      const zoneMid = (z.high + z.low) / 2;
      return Math.abs(zoneMid - midPrice) <= maxDistance;
    });
    if (nearbyFvgZones.length === 0) return;

    // Get the last timestamp for extending boxes to the right
    const lastTime = toChartTime(data[data.length - 1].time);
    if (lastTime === null) return; // Can't render FVG zones without valid time range

    // Render each FVG as a filled area (box)
    nearbyFvgZones.forEach((zone, index) => {
      const isBullish = zone.direction === 'bullish';
      const fillColor = isBullish
        ? 'rgba(34, 197, 94, 0.25)'  // Green with more opacity
        : 'rgba(239, 68, 68, 0.25)'; // Red with more opacity
      const lineColor = isBullish
        ? 'rgba(34, 197, 94, 0.6)'
        : 'rgba(239, 68, 68, 0.6)';

      // Create area series for the FVG box
      // We'll use two line series (top and bottom) + visual indicator
      const startTime = toChartTime(zone.startTime);
      // Extend to right edge if not filled
      const endTime = zone.filled ? toChartTime(zone.endTime) : lastTime;

      // Skip this zone if time values are invalid
      if (startTime === null || endTime === null) return;

      // Top boundary line
      const topSeries = chartRef.current!.addLineSeries({
        color: lineColor,
        lineWidth: 1,
        lineStyle: LineStyle.Solid,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });

      // Bottom boundary line
      const bottomSeries = chartRef.current!.addLineSeries({
        color: lineColor,
        lineWidth: 1,
        lineStyle: LineStyle.Solid,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });

      // Area fill between boundaries
      // We use an area series from the top price down
      const areaSeries = chartRef.current!.addAreaSeries({
        topColor: fillColor,
        bottomColor: fillColor,
        lineColor: 'transparent',
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });

      // Create data points for each series
      // For proper box rendering, we need multiple points
      const numPoints = 10;
      const timeStep = ((endTime as number) - (startTime as number)) / numPoints;

      const topData: LineData[] = [];
      const bottomData: LineData[] = [];
      const areaData: AreaData[] = [];

      for (let i = 0; i <= numPoints; i++) {
        const time = ((startTime as number) + timeStep * i) as Time;
        topData.push({ time, value: zone.high });
        bottomData.push({ time, value: zone.low });
        areaData.push({ time, value: zone.high });
      }

      topSeries.setData(topData);
      bottomSeries.setData(bottomData);

      // Set area data
      areaSeries.setData(areaData);

      // Store refs for cleanup
      fvgSeriesRef.current.set(`fvg-top-${index}`, topSeries as unknown as ISeriesApi<'Area'>);
      fvgSeriesRef.current.set(`fvg-bottom-${index}`, bottomSeries as unknown as ISeriesApi<'Area'>);
      fvgSeriesRef.current.set(`fvg-area-${index}`, areaSeries);
    });

    // Cleanup function
    return () => {
      fvgSeriesRef.current.forEach((series) => {
        try {
          chartRef.current?.removeSeries(series);
        } catch {
          // Ignore cleanup errors
        }
      });
      fvgSeriesRef.current.clear();
    };
  }, [fvgZones, data, isInitialized]);

  // =========================================================================
  // Render
  // =========================================================================

  // Determine if we should show loading state
  const safeData = data || [];
  const isDataEmpty = safeData.length === 0;
  const showLoadingState = isDataEmpty || !isInitialized || dimensions.width <= 0;

  return (
    <div
      className={`relative ${className}`}
      style={{
        minHeight: MIN_CHART_HEIGHT,
        // Debug border - set DEBUG_CHART to true to see chart bounds
        ...(DEBUG_CHART ? { border: '1px solid red' } : {}),
      }}
    >
      {/* Chart Container */}
      <div
        ref={containerRef}
        className="w-full h-full"
        style={{
          minHeight: MIN_CHART_HEIGHT,
          height: height || '100%',
          position: 'relative',
          zIndex: 1,
        }}
      />

      {/* Loading / No Data State Overlay */}
      {showLoadingState && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center bg-[#0d0d0d]/90 z-10"
          style={{ minHeight: MIN_CHART_HEIGHT }}
        >
          <Loader2 className="w-8 h-8 text-[var(--accent-primary)] animate-spin mb-3" />
          <p className="text-sm text-[var(--text-secondary)] font-mono">
            {isDataEmpty ? 'Waiting for Market Data...' : 'Initializing Chart...'}
          </p>
          {symbol && (
            <p className="text-xs text-[var(--text-tertiary)] mt-1">{symbol}</p>
          )}
          {DEBUG_CHART && (
            <p className="text-xs text-red-500 mt-2">
              Debug: {dimensions.width}x{dimensions.height} | Data: {safeData.length}
            </p>
          )}
        </div>
      )}

      {/* Pulsing Gamma Level Proximity Alerts */}
      {proximityAlerts.map((alert, index) => {
        const color = alert.type === 'call_wall'
          ? CHART_COLORS.callWall
          : alert.type === 'put_wall'
          ? CHART_COLORS.putWall
          : CHART_COLORS.zeroGamma;

        const label = alert.type === 'call_wall'
          ? '📈 CALL WALL'
          : alert.type === 'put_wall'
          ? '📉 PUT WALL'
          : '⚡ ZERO γ';

        return (
          <div
            key={`proximity-${alert.type}-${index}`}
            className="absolute left-0 right-12 pointer-events-none z-20"
            style={{
              top: alert.yCoordinate - 2,
              height: 4,
            }}
          >
            {/* Glowing bar */}
            <div
              className="w-full h-full animate-pulse"
              style={{
                background: `linear-gradient(90deg, transparent, ${color}40, ${color}80, ${color}40, transparent)`,
                boxShadow: `0 0 20px ${color}, 0 0 40px ${color}60, 0 0 60px ${color}30`,
              }}
            />
            {/* Label badge */}
            <div
              className="absolute right-0 top-1/2 -translate-y-1/2 px-2 py-0.5 text-[10px] font-bold font-mono animate-pulse rounded"
              style={{
                backgroundColor: `${color}30`,
                color: color,
                border: `1px solid ${color}60`,
                boxShadow: `0 0 10px ${color}40`,
              }}
            >
              {label} ${alert.price.toFixed(2)}
            </div>
          </div>
        );
      })}

      {/* Symbol Badge */}
      {symbol && (
        <div className="absolute top-3 left-3 px-2 py-1 bg-[#1e293b]/80 border border-terminal-border text-kcu-gold font-mono text-sm">
          {symbol}
        </div>
      )}

      {/* Mode Indicator */}
      <div className={`absolute top-3 right-3 px-2 py-1 text-xs font-mono uppercase ${
        mode === 'live'
          ? 'bg-green-500/20 text-green-400 border border-green-500/50'
          : 'bg-blue-500/20 text-blue-400 border border-blue-500/50'
      }`}>
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
            <span className="w-3 h-0.5 bg-[#f97316]" style={{ borderTop: '2px dotted #f97316' }}></span>
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

      {/* Gamma/Institutional Levels Legend */}
      {gammaLevels.length > 0 && (
        <div className="absolute bottom-3 right-3 flex flex-col gap-1 text-[10px] font-mono bg-[#0d0d0d]/80 px-2 py-1.5 rounded border border-[var(--border-primary)]">
          <span className="text-[var(--text-tertiary)] uppercase tracking-wider mb-0.5">Institutional</span>
          {gammaLevels.some(g => g.type === 'call_wall') && (
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-0.5" style={{ backgroundColor: CHART_COLORS.callWall }}></span>
              <span style={{ color: CHART_COLORS.callWall }}>Call Wall</span>
            </span>
          )}
          {gammaLevels.some(g => g.type === 'put_wall') && (
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-0.5" style={{ backgroundColor: CHART_COLORS.putWall }}></span>
              <span style={{ color: CHART_COLORS.putWall }}>Put Wall</span>
            </span>
          )}
          {gammaLevels.some(g => g.type === 'zero_gamma') && (
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-0.5 border-t border-dashed" style={{ borderColor: CHART_COLORS.zeroGamma }}></span>
              <span style={{ color: CHART_COLORS.zeroGamma }}>Zero γ</span>
            </span>
          )}
          {gammaLevels.some(g => g.type === 'max_pain') && (
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-0.5 border-t border-dotted" style={{ borderColor: CHART_COLORS.maxPain }}></span>
              <span style={{ color: CHART_COLORS.maxPain }}>Max Pain</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default KCUChart;
