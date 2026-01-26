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
 * - Key levels rendered as horizontal line series (PDH, PDL, VWAP levels, ORB, etc.)
 * - Magnet crosshair mode
 * - Auto-scaling with right offset for future price action
 */

import { useEffect, useRef, useState, memo, forwardRef, useImperativeHandle } from 'react';
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
import { KCU_COLORS, getLevelColor, getLevelStyle } from '@/lib/kcu-colors';

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
  lineWidth?: number;
  strength?: number;
  axisLabelVisible?: boolean;
  type?: string;
}

export interface GammaLevel {
  price: number;
  type: 'call_wall' | 'put_wall' | 'zero_gamma' | 'max_pain' | 'gamma_flip';
  label?: string;
  strength?: number;
  color?: string;
}

export interface ChartPatienceCandle {
  time: number;
  type: 'inside_bar' | 'hammer' | 'inverted_hammer' | 'spinning_top' | 'doji';
  direction: 'bullish' | 'bearish';
  quality: 'high' | 'medium' | 'low';
  isCurrent?: boolean;
}

export interface ProfessionalChartProps {
  data: ChartCandle[];
  symbol?: string;
  levels?: ChartLevel[];
  gammaLevels?: GammaLevel[];
  patienceCandles?: ChartPatienceCandle[];
  height?: number | string;
  showVolume?: boolean;
  showIndicators?: boolean;
  onCrosshairMove?: (price: number | null, time: Time | null) => void;
  className?: string;
}

export interface ProfessionalChartHandle {
  updateLastCandle: (candle: ChartCandle) => void;
  addCandle: (candle: ChartCandle) => void;
  getLastCandleTime: () => number | null;
}

// =============================================================================
// Color Palette - KCU Professional Trading
// =============================================================================

const COLORS = {
  background: KCU_COLORS.backgroundAlt,
  gridLines: KCU_COLORS.gridLines,
  candleUp: KCU_COLORS.candleUp,
  candleDown: KCU_COLORS.candleDown,
  wickUp: KCU_COLORS.wickUp,
  wickDown: KCU_COLORS.wickDown,
  volumeUp: KCU_COLORS.volumeUp,
  volumeDown: KCU_COLORS.volumeDown,
  ema8: KCU_COLORS.ema8,
  ema21: KCU_COLORS.ema21,
  vwap: KCU_COLORS.vwap,
  crosshair: KCU_COLORS.crosshair,
  text: KCU_COLORS.text,
  textMuted: KCU_COLORS.textMuted,
} as const;

// =============================================================================
// Constants for horizontal level lines
// =============================================================================

// Far timestamps ensure levels extend across all visible chart area during pan/zoom
const FAR_PAST_SECONDS = Math.floor(Date.now() / 1000) - 10 * 365 * 24 * 60 * 60;
const FAR_FUTURE_SECONDS = Math.floor(Date.now() / 1000) + 10 * 365 * 24 * 60 * 60;

// Maximum number of level series to pre-allocate
const MAX_LEVEL_SERIES = 20;

// =============================================================================
// Utility Functions
// =============================================================================

function toChartTime(timestamp: number): Time {
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

    if (lastTradingDate !== null && etDate !== lastTradingDate) {
      cumulativeTPV = 0;
      cumulativeVolume = 0;
      lastValidVwap = null;
    }
    lastTradingDate = etDate;

    const volume = isValidNumber(candle.volume) && candle.volume > 0 ? candle.volume : 0;

    if (volume > 0) {
      const typicalPrice = (candle.high + candle.low + candle.close) / 3;
      cumulativeTPV += typicalPrice * volume;
      cumulativeVolume += volume;
      lastValidVwap = cumulativeTPV / cumulativeVolume;
      vwap.push(lastValidVwap);
    } else {
      vwap.push(lastValidVwap);
    }
  }
  return vwap;
}

// =============================================================================
// Main Component
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
    const lastCandleTimeRef = useRef<number | null>(null);

    // Series refs
    const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
    const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
    const ema8SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const ema21SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const vwapSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

    // Level series pool - using line series for horizontal levels
    const levelSeriesPool = useRef<ISeriesApi<'Line'>[]>([]);

    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
    const [isInitialized, setIsInitialized] = useState(false);

    // ==========================================================================
    // Imperative Handle
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

          if (volumeSeriesRef.current && isValidNumber(candle.volume)) {
            volumeSeriesRef.current.update({
              time: toChartTime(candle.time),
              value: candle.volume,
              color: candle.close >= candle.open ? COLORS.volumeUp : COLORS.volumeDown,
            });
          }

          lastCandleTimeRef.current = candle.time;
        } catch {
          // Silently handle errors
        }
      },

      addCandle: (candle: ChartCandle) => {
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

          if (volumeSeriesRef.current && isValidNumber(candle.volume)) {
            volumeSeriesRef.current.update({
              time: toChartTime(candle.time),
              value: candle.volume,
              color: candle.close >= candle.open ? COLORS.volumeUp : COLORS.volumeDown,
            });
          }

          lastCandleTimeRef.current = candle.time;
        } catch {
          // Silently handle errors
        }
      },

      getLastCandleTime: () => lastCandleTimeRef.current,
    }), []);

    // ==========================================================================
    // Resize Observer
    // ==========================================================================
    useEffect(() => {
      if (!containerRef.current) return;

      const updateDimensions = () => {
        if (containerRef.current && mountedRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            setDimensions({ width: Math.floor(rect.width), height: Math.floor(rect.height) });
          }
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
    // Mount/Unmount Tracking
    // ==========================================================================
    useEffect(() => {
      mountedRef.current = true;
      return () => {
        mountedRef.current = false;
      };
    }, []);

    // ==========================================================================
    // Chart Initialization
    // ==========================================================================
    useEffect(() => {
      if (!containerRef.current || dimensions.width <= 0 || dimensions.height <= 0) return;

      // Create chart
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
          scaleMargins: { top: 0.1, bottom: showVolume ? 0.25 : 0.1 },
          autoScale: true,
        },
        timeScale: {
          borderColor: COLORS.gridLines,
          timeVisible: true,
          secondsVisible: false,
          rightOffset: 5,
          barSpacing: 10,
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
      const pool: ISeriesApi<'Line'>[] = [];
      for (let i = 0; i < MAX_LEVEL_SERIES; i++) {
        const series = chart.addLineSeries({
          color: '#6b7280',
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: true,
          crosshairMarkerVisible: false,
          lineStyle: LineStyle.Solid,
        });
        series.setData([]);
        pool.push(series);
      }
      levelSeriesPool.current = pool;

      // Crosshair handler
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

        setIsInitialized(false);
        try { chart.remove(); } catch {}
        chartRef.current = null;
      };
    }, [dimensions.width, dimensions.height, showVolume, showIndicators, onCrosshairMove]);

    // ==========================================================================
    // Update Chart Data
    // ==========================================================================
    useEffect(() => {
      if (!mountedRef.current || !isInitialized || !candleSeriesRef.current) return;

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

      // Set candle data
      const candleData: CandlestickData[] = validData.map((c) => ({
        time: toChartTime(c.time),
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }));

      try {
        candleSeriesRef.current.setData(candleData);
      } catch {}

      // Add patience candle markers
      if (patienceCandles.length > 0 && candleSeriesRef.current) {
        const markers: SeriesMarker<Time>[] = patienceCandles
          .filter((pc) => isValidNumber(pc.time) && pc.time > 0)
          .map((pc) => {
            const isBullish = pc.direction === 'bullish';
            const isCurrent = pc.isCurrent;

            let color = '#fbbf24';
            if (pc.quality === 'high') {
              color = isCurrent ? '#22c55e' : '#4ade80';
            } else if (pc.quality === 'medium') {
              color = isCurrent ? '#eab308' : '#fbbf24';
            } else {
              color = '#9ca3af';
            }

            return {
              time: toChartTime(pc.time),
              position: isBullish ? 'belowBar' : 'aboveBar',
              color,
              shape: isCurrent ? 'circle' : 'square',
              size: isCurrent ? 2 : 1,
              text: isCurrent ? 'PATIENCE' : pc.type.replace('_', ' ').toUpperCase(),
            } as SeriesMarker<Time>;
          })
          .sort((a, b) => (a.time as number) - (b.time as number));

        try {
          candleSeriesRef.current.setMarkers(markers);
        } catch {}
      } else if (candleSeriesRef.current) {
        try {
          candleSeriesRef.current.setMarkers([]);
        } catch {}
      }

      // Set volume data
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

      // Set indicator data
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

      // Set visible range
      if (chartRef.current && validData.length > 0) {
        lastCandleTimeRef.current = validData[validData.length - 1].time;

        try {
          const visibleBars = Math.min(150, validData.length);
          chartRef.current.timeScale().setVisibleLogicalRange({
            from: validData.length - visibleBars,
            to: validData.length - 1,
          });
        } catch {}
      }
    }, [data, isInitialized, showVolume, showIndicators, patienceCandles]);

    // ==========================================================================
    // Update Level Lines - Using horizontal line series
    // ==========================================================================
    useEffect(() => {
      if (!mountedRef.current || !isInitialized) return;

      const pool = levelSeriesPool.current;
      if (pool.length === 0) return;

      const startTime = FAR_PAST_SECONDS as Time;
      const endTime = FAR_FUTURE_SECONDS as Time;

      // Combine key levels and gamma levels
      const allLevels: Array<{
        price: number;
        label: string;
        color: string;
        lineWidth: number;
        lineStyle: LineStyle;
      }> = [];

      // Add key levels
      levels.filter((l) => isValidPrice(l.price)).forEach((level) => {
        const style = level.type
          ? getLevelStyle(level.type, level.strength)
          : {
              color: level.color,
              lineWidth: level.lineWidth || 1,
              lineStyle:
                level.lineStyle === 'dotted'
                  ? LineStyle.Dotted
                  : level.lineStyle === 'dashed'
                  ? LineStyle.Dashed
                  : LineStyle.Solid,
            };

        allLevels.push({
          price: level.price,
          label: level.label,
          color: level.color || style.color,
          lineWidth: style.lineWidth,
          lineStyle: style.lineStyle,
        });
      });

      // Add gamma levels
      gammaLevels.filter((g) => isValidPrice(g.price)).forEach((gamma) => {
        const color = gamma.color || getLevelColor(gamma.type);

        allLevels.push({
          price: gamma.price,
          label: gamma.label || gamma.type.replace('_', ' ').toUpperCase(),
          color,
          lineWidth: 2,
          lineStyle: LineStyle.Dashed,
        });
      });

      // Update pool series
      pool.forEach((series, i) => {
        const level = allLevels[i];
        if (!level) {
          try { series.setData([]); } catch {}
          return;
        }

        try {
          series.applyOptions({
            color: level.color,
            lineWidth: level.lineWidth as 1 | 2 | 3 | 4,
            lineStyle: level.lineStyle,
            title: level.label,
          });

          series.setData([
            { time: startTime, value: level.price },
            { time: endTime, value: level.price },
          ]);
        } catch {}
      });
    }, [levels, gammaLevels, isInitialized]);

    // ==========================================================================
    // Update dimensions when chart exists
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
        className={`w-full h-full ${className}`}
        style={{
          height: typeof height === 'number' ? `${height}px` : height,
          minHeight: 400,
          backgroundColor: COLORS.background,
        }}
      >
        {/* Loading state */}
        {(!isInitialized || data.length === 0) && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ backgroundColor: COLORS.background }}
          >
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-[#10b981] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm font-mono" style={{ color: COLORS.textMuted }}>
                {data.length === 0 ? 'Waiting for data...' : 'Initializing chart...'}
              </p>
              {symbol && <p className="text-xs mt-1" style={{ color: COLORS.textMuted }}>{symbol}</p>}
            </div>
          </div>
        )}

        {/* Symbol badge */}
        {symbol && isInitialized && data.length > 0 && (
          <div className="absolute top-3 left-3 z-10 px-3 py-1.5 bg-[#1e222d]/90 border border-[#2a2e39] text-[#d1d4dc] font-mono text-sm font-semibold rounded">
            {symbol}
          </div>
        )}

        {/* Legend */}
        {showIndicators && isInitialized && data.length > 0 && (
          <div className="absolute top-3 right-16 z-10 flex items-center gap-3 text-[10px] font-mono bg-[#0b0e11]/90 px-2 py-1 rounded border border-[#2a2e39]">
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
));

export default ProfessionalChart;
