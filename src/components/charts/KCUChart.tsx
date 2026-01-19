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

import { useEffect, useRef, useCallback, useState } from 'react';
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

  // Gamma Levels
  callWall: '#00ffff',    // CYAN
  putWall: '#ff00ff',     // MAGENTA
  zeroGamma: '#fbbf24',   // AMBER
  maxPain: '#8b5cf6',     // PURPLE

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
 */
function toChartTime(time: number | string): Time {
  if (typeof time === 'string') {
    return Math.floor(new Date(time).getTime() / 1000) as Time;
  }
  // If already in seconds, use directly; if in ms, convert
  return (time > 1e12 ? Math.floor(time / 1000) : time) as Time;
}

// =============================================================================
// Main Component
// =============================================================================

export function KCUChart({
  mode,
  data,
  levels = [],
  gammaLevels = [],
  fvgZones = [],
  symbol,
  height = 500,
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

  // =========================================================================
  // Chart Initialization
  // =========================================================================

  useEffect(() => {
    if (!containerRef.current) return;

    // Create chart
    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height,
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

    // Resize handler
    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    setIsInitialized(true);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
      setIsInitialized(false);
    };
  }, [height, showVolume, showIndicators]);

  // =========================================================================
  // Data Updates
  // =========================================================================

  useEffect(() => {
    if (!isInitialized || !candleSeriesRef.current) return;

    // Determine visible data based on mode and replay index
    const visibleData = mode === 'replay' && replayIndex !== undefined
      ? data.slice(0, replayIndex + 1)
      : data;

    if (visibleData.length === 0) return;

    // Convert to chart format
    const candleData: CandlestickData[] = visibleData.map((c) => ({
      time: toChartTime(c.time),
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    // Update candle series
    candleSeriesRef.current.setData(candleData);

    // Update volume series
    if (volumeSeriesRef.current && showVolume) {
      const volumeData = visibleData.map((c) => ({
        time: toChartTime(c.time),
        value: c.volume || 0,
        color: c.close >= c.open ? CHART_COLORS.volumeUp : CHART_COLORS.volumeDown,
      }));
      volumeSeriesRef.current.setData(volumeData);
    }

    // Update indicators
    if (showIndicators && visibleData.length > 0) {
      const closePrices = visibleData.map((c) => c.close);

      // EMA 8
      if (ema8SeriesRef.current) {
        const ema8Values = calculateEMA(closePrices, 8);
        const ema8Data: LineData[] = visibleData
          .map((c, i) => ({
            time: toChartTime(c.time),
            value: ema8Values[i],
          }))
          .filter((d) => !isNaN(d.value) && d.value !== undefined);
        ema8SeriesRef.current.setData(ema8Data);
      }

      // EMA 21
      if (ema21SeriesRef.current) {
        const ema21Values = calculateEMA(closePrices, 21);
        const ema21Data: LineData[] = visibleData
          .map((c, i) => ({
            time: toChartTime(c.time),
            value: ema21Values[i],
          }))
          .filter((d) => !isNaN(d.value) && d.value !== undefined);
        ema21SeriesRef.current.setData(ema21Data);
      }

      // SMA 200
      if (sma200SeriesRef.current) {
        const sma200Values = calculateSMA(closePrices, 200);
        const sma200Data: LineData[] = visibleData
          .map((c, i) => ({
            time: toChartTime(c.time),
            value: sma200Values[i],
          }))
          .filter((d) => !isNaN(d.value) && d.value !== undefined);
        sma200SeriesRef.current.setData(sma200Data);
      }

      // VWAP
      if (vwapSeriesRef.current) {
        const vwapValues = calculateVWAP(visibleData);
        const vwapData: LineData[] = visibleData.map((c, i) => ({
          time: toChartTime(c.time),
          value: vwapValues[i],
        }));
        vwapSeriesRef.current.setData(vwapData);
      }

      // Ripster Cloud (fill between EMA8 and EMA21)
      if (cloudSeriesRef.current) {
        const ema8Values = calculateEMA(closePrices, 8);
        const ema21Values = calculateEMA(closePrices, 21);

        const cloudData: AreaData[] = visibleData
          .map((c, i) => {
            const ema8 = ema8Values[i];
            const ema21 = ema21Values[i];
            if (isNaN(ema8) || isNaN(ema21) || ema8 === undefined || ema21 === undefined) {
              return null;
            }
            return {
              time: toChartTime(c.time),
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
      const markers: SeriesMarker<Time>[] = insideBarIndices.map((i) => ({
        time: toChartTime(visibleData[i].time),
        position: 'aboveBar',
        color: CHART_COLORS.patienceMarker,
        shape: 'arrowDown' as SeriesMarkerShape, // Diamond-like appearance
        text: '◆', // Diamond symbol
        size: 1,
      }));
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

    // Add new level lines
    levels.forEach((level, index) => {
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
        const lineData: LineData[] = [
          { time: toChartTime(data[0].time), value: level.price },
          { time: toChartTime(data[data.length - 1].time), value: level.price },
        ];
        series.setData(lineData);
      }

      levelSeriesRef.current.set(`level-${index}`, series);
    });
  }, [levels, data, isInitialized]);

  // =========================================================================
  // Gamma Levels
  // =========================================================================

  useEffect(() => {
    if (!isInitialized || !chartRef.current || gammaLevels.length === 0) return;

    // Add gamma level lines
    gammaLevels.forEach((gamma, index) => {
      const color = gamma.type === 'call_wall' ? CHART_COLORS.callWall :
                    gamma.type === 'put_wall' ? CHART_COLORS.putWall :
                    gamma.type === 'zero_gamma' ? CHART_COLORS.zeroGamma :
                    CHART_COLORS.maxPain;

      const series = chartRef.current!.addLineSeries({
        color,
        lineWidth: 2,
        lineStyle: LineStyle.Dashed,
        priceLineVisible: true,
        lastValueVisible: true,
        title: gamma.label || gamma.type.replace('_', ' ').toUpperCase(),
      });

      if (data.length > 0) {
        const lineData: LineData[] = [
          { time: toChartTime(data[0].time), value: gamma.price },
          { time: toChartTime(data[data.length - 1].time), value: gamma.price },
        ];
        series.setData(lineData);
      }

      levelSeriesRef.current.set(`gamma-${index}`, series);
    });
  }, [gammaLevels, data, isInitialized]);

  // =========================================================================
  // FVG Zones (rendered as price range highlights)
  // =========================================================================

  useEffect(() => {
    if (!isInitialized || !chartRef.current || fvgZones.length === 0) return;

    // FVG zones are rendered using area series between high and low
    fvgZones.forEach((zone, index) => {
      const color = zone.direction === 'bullish'
        ? CHART_COLORS.fvgBullish
        : CHART_COLORS.fvgBearish;

      // Upper boundary
      const upperSeries = chartRef.current!.addLineSeries({
        color: zone.direction === 'bullish' ? CHART_COLORS.upColor : CHART_COLORS.downColor,
        lineWidth: 1,
        lineStyle: LineStyle.Dotted,
        priceLineVisible: false,
        lastValueVisible: false,
      });

      // Lower boundary
      const lowerSeries = chartRef.current!.addLineSeries({
        color: zone.direction === 'bullish' ? CHART_COLORS.upColor : CHART_COLORS.downColor,
        lineWidth: 1,
        lineStyle: LineStyle.Dotted,
        priceLineVisible: false,
        lastValueVisible: false,
      });

      const startTime = toChartTime(zone.startTime);
      const endTime = toChartTime(zone.endTime);

      upperSeries.setData([
        { time: startTime, value: zone.high },
        { time: endTime, value: zone.high },
      ]);

      lowerSeries.setData([
        { time: startTime, value: zone.low },
        { time: endTime, value: zone.low },
      ]);

      levelSeriesRef.current.set(`fvg-upper-${index}`, upperSeries);
      levelSeriesRef.current.set(`fvg-lower-${index}`, lowerSeries);
    });
  }, [fvgZones, isInitialized]);

  // =========================================================================
  // Render
  // =========================================================================

  return (
    <div className={`relative ${className}`}>
      {/* Chart Container */}
      <div
        ref={containerRef}
        className="w-full"
        style={{ height }}
      />

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
        <div className="absolute bottom-3 left-3 flex gap-4 text-xs font-mono">
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
    </div>
  );
}

export default KCUChart;
