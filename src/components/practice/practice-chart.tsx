'use client';

/**
 * PracticeChart - Controlled Chart Component
 *
 * A purely controlled chart component that renders what it is given.
 * All game state (replayIndex, isPlaying, playbackSpeed) is managed by
 * the parent via usePracticeEngine hook.
 *
 * This component is responsible only for:
 * - Rendering candlestick data
 * - Displaying indicators (VWAP, EMAs, Ripster Clouds)
 * - Showing key levels and gamma levels
 * - Animating the current candle formation (via useCandleReplay)
 *
 * Performance Optimization:
 * - Indicator series are created ONCE during initialization
 * - Data updates use setData() without recreating series
 * - Horizontal levels use createPriceLine() attached to candle series
 * - Decision point marker uses chart markers, not line series
 */

import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import {
  createChart,
  IChartApi,
  ISeriesApi,
  CandlestickData,
  LineData,
  Time,
  CrosshairMode,
  LineStyle,
  AreaData,
  IPriceLine,
  SeriesMarker,
} from 'lightweight-charts';
import { cn } from '@/lib/utils';
import {
  calculateEMA,
  calculateVWAPBands,
  calculateEMARibbon,
  Bar,
  Timeframe,
} from '@/lib/practice/indicators';
import {
  useCandleReplay,
  type AnimatingCandle,
  easingFunctions,
} from '@/hooks/useCandleReplay';
import {
  Eye,
  EyeOff,
  ZoomIn,
  ZoomOut,
  Settings,
  TrendingUp,
  Activity,
  BarChart3,
} from 'lucide-react';
import type { Candle, KeyLevel, GammaLevel } from '@/hooks/usePracticeEngine';

// =============================================================================
// Types
// =============================================================================

export interface PracticeChartProps {
  // Core data - controlled by parent
  visibleCandles: Candle[];
  currentIndex?: number;
  animatingCandle?: AnimatingCandle | null;

  // Levels
  levels: KeyLevel[];
  gammaLevels?: GammaLevel[];
  tradeLevels?: KeyLevel[];

  // Metadata
  symbol: string;
  timeframe?: string;

  // Display options
  showOutcome?: boolean;
  isReplayMode?: boolean;
  decisionReached?: boolean;
  decisionPointIndex?: number;

  // Outcome data for overlay
  outcomeData?: {
    result: string;
    exit_price?: number;
    pnl_percent?: number;
    candles_to_target?: number;
  };

  // Event handlers
  onCandleClick?: (index: number, price: number) => void;

  // Styling
  className?: string;
  height?: number;
}

// =============================================================================
// KCU Professional Trading Chart Color Scheme
// Following Somesh's methodology: EMA9 = Green, EMA21 = Red
// =============================================================================

const CHART_COLORS = {
  // Background
  background: '#0a0a0a',
  backgroundAlt: '#111111',
  text: '#9ca3af',
  textStrong: '#f3f4f6',
  grid: '#1f2937',
  border: '#374151',

  // Candle colors
  upColor: '#10b981',
  downColor: '#ef4444',
  wickUp: '#10b981',
  wickDown: '#ef4444',

  // Volume colors
  volumeUp: 'rgba(16, 185, 129, 0.35)',
  volumeDown: 'rgba(239, 68, 68, 0.35)',

  // Indicator colors - KCU Methodology (CORRECTED)
  ema9: '#22c55e',   // GREEN - Fast EMA (EMA 9)
  ema21: '#ef4444',  // RED - Slow EMA (EMA 21)
  ema8: '#22c55e',   // GREEN - For Ripster Clouds (EMA 8)
  vwap: '#8b5cf6',   // PURPLE - VWAP
  vwapBand1: 'rgba(139, 92, 246, 0.25)', // +/- 1 SD band
  vwapBand2: 'rgba(139, 92, 246, 0.12)', // +/- 2 SD band
  ema50: '#eab308',  // Yellow - 50 EMA
  sma200: '#ffffff', // White - 200 SMA

  // Ripster Clouds - Fill between EMA 8 and EMA 21
  ribbonBullish: 'rgba(34, 197, 94, 0.25)',  // Green cloud when EMA8 > EMA21
  ribbonBearish: 'rgba(239, 68, 68, 0.25)',  // Red cloud when EMA8 < EMA21
  ribbonNeutral: 'rgba(107, 114, 128, 0.1)',

  // Level colors
  support: '#10b981',
  resistance: '#ef4444',

  // Pre-market levels
  premarketHigh: '#ec4899',
  premarketLow: '#ec4899',

  // ORB levels
  orbHigh: '#06b6d4',
  orbLow: '#06b6d4',

  // Gamma levels
  callWall: '#ef4444',
  putWall: '#10b981',
  zeroGamma: '#f59e0b',
  maxGamma: '#a855f7',

  // Special
  crosshair: '#6b7280',
  decisionPoint: '#f59e0b',
  entry: '#3b82f6',
  stop: '#ef4444',
  target: '#10b981',
} as const;

const LEVEL_COLORS: Record<string, string> = {
  support: CHART_COLORS.support,
  resistance: CHART_COLORS.resistance,
  vwap: CHART_COLORS.vwap,
  ema: CHART_COLORS.ema9,
  ema9: CHART_COLORS.ema9,
  ema21: CHART_COLORS.ema21,
  ema8: CHART_COLORS.ema8,
  daily_support: CHART_COLORS.support,
  daily_resistance: CHART_COLORS.resistance,
  demand_zone: CHART_COLORS.support,
  supply_zone: CHART_COLORS.resistance,
  premarket_high: CHART_COLORS.premarketHigh,
  premarket_low: CHART_COLORS.premarketLow,
  pm_high: CHART_COLORS.premarketHigh,
  pm_low: CHART_COLORS.premarketLow,
  pdh: '#fbbf24',
  pdl: '#fbbf24',
  previous_day_high: '#fbbf24',
  previous_day_low: '#fbbf24',
  gap_high: '#06b6d4',
  gap_low: '#06b6d4',
  gap_top: '#06b6d4',
  previous_close: '#a855f7',
  orb_high: CHART_COLORS.orbHigh,
  orb_low: CHART_COLORS.orbLow,
  opening_range_high: CHART_COLORS.orbHigh,
  opening_range_low: CHART_COLORS.orbLow,
  round_number: '#6b7280',
  weekly_high: '#3b82f6',
  weekly_low: '#3b82f6',
  sma_200: CHART_COLORS.sma200,
  sma200: CHART_COLORS.sma200,
  neckline: '#f97316',
  double_bottom: CHART_COLORS.support,
  fib_50: '#a78bfa',
  extension: '#a78bfa',
  max_pain: '#f59e0b',
  call_wall: CHART_COLORS.callWall,
  put_wall: CHART_COLORS.putWall,
  zero_gamma: CHART_COLORS.zeroGamma,
  max_gamma: CHART_COLORS.maxGamma,
  liquidity: '#ef4444',
  sweep_high: '#ef4444',
  trap_low: CHART_COLORS.support,
  broken_resistance: CHART_COLORS.support,
  breakout_high: CHART_COLORS.resistance,
  spike_high: '#f97316',
  range_high: CHART_COLORS.resistance,
  range_low: CHART_COLORS.support,
  // Trade levels
  entry: CHART_COLORS.entry,
  stop: CHART_COLORS.stop,
  target: CHART_COLORS.target,
  default: CHART_COLORS.text,
};

// =============================================================================
// Indicator Settings Interface
// =============================================================================

interface IndicatorSettings {
  showVWAP: boolean;
  showVWAPBands: boolean;
  showEMA9: boolean;
  showEMA21: boolean;
  showEMARibbon: boolean;
  showVolume: boolean;
}

const DEFAULT_INDICATORS: IndicatorSettings = {
  showVWAP: true,
  showVWAPBands: true,
  showEMA9: true,
  showEMA21: true,
  showEMARibbon: true,
  showVolume: true,
};

// =============================================================================
// Main Component
// =============================================================================

export function PracticeChart({
  visibleCandles,
  currentIndex,
  animatingCandle: externalAnimatingCandle,
  levels,
  gammaLevels = [],
  tradeLevels = [],
  symbol,
  timeframe = '5m',
  showOutcome = false,
  isReplayMode = false,
  decisionReached = false,
  decisionPointIndex,
  outcomeData,
  onCandleClick,
  className,
  height = 450,
}: PracticeChartProps) {
  // Chart refs
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);

  // Persistent indicator series refs - created once, updated via setData()
  const vwapSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const vwapUpper1Ref = useRef<ISeriesApi<'Line'> | null>(null);
  const vwapLower1Ref = useRef<ISeriesApi<'Line'> | null>(null);
  const vwapUpper2Ref = useRef<ISeriesApi<'Line'> | null>(null);
  const vwapLower2Ref = useRef<ISeriesApi<'Line'> | null>(null);
  const ema9SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const ema21SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const ribbonBullishRef = useRef<ISeriesApi<'Area'> | null>(null);
  const ribbonBearishRef = useRef<ISeriesApi<'Area'> | null>(null);

  // Price lines for horizontal levels (attached to candle series)
  const priceLinesRef = useRef<IPriceLine[]>([]);

  // Track initialization state
  const isInitializedRef = useRef(false);

  // Local UI state (not game state)
  const [showLevels, setShowLevels] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [indicators, setIndicators] = useState<IndicatorSettings>(DEFAULT_INDICATORS);

  // Candle animation hook - ONLY for animating the formation of current candle
  const {
    animateCandle,
    cancelAnimation,
    getIntermediateCandle,
    isAnimating,
  } = useCandleReplay({
    duration: 400,
    easing: easingFunctions.easeOutCubic,
    realisticPath: true,
  });

  // Use external animating candle if provided, otherwise use local
  const animatingCandle = externalAnimatingCandle || getIntermediateCandle();

  // =============================================================================
  // Format Data Helpers
  // =============================================================================

  const formatCandlesForChart = useCallback((candles: Candle[]): CandlestickData[] => {
    return candles.map((candle) => ({
      time: (candle.time / 1000) as Time,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
    }));
  }, []);

  const formatVolumeForChart = useCallback((candles: Candle[]) => {
    return candles.map((candle) => ({
      time: (candle.time / 1000) as Time,
      value: candle.volume,
      color: candle.close >= candle.open ? CHART_COLORS.volumeUp : CHART_COLORS.volumeDown,
    }));
  }, []);

  // =============================================================================
  // Initialize Chart - Create all series ONCE
  // =============================================================================

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: CHART_COLORS.background },
        textColor: CHART_COLORS.text,
        fontFamily: "'JetBrains Mono', 'SF Mono', 'Monaco', monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: CHART_COLORS.grid, style: LineStyle.Dotted },
        horzLines: { color: CHART_COLORS.grid, style: LineStyle.Dotted },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: CHART_COLORS.crosshair,
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: CHART_COLORS.backgroundAlt,
        },
        horzLine: {
          color: CHART_COLORS.crosshair,
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: CHART_COLORS.backgroundAlt,
        },
      },
      rightPriceScale: {
        borderColor: CHART_COLORS.border,
        scaleMargins: { top: 0.1, bottom: 0.2 },
        mode: 0,
        autoScale: true,
      },
      timeScale: {
        borderColor: CHART_COLORS.border,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 5,
        barSpacing: 8,
        minBarSpacing: 4,
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

    // Add candlestick series
    const candleSeries = chart.addCandlestickSeries({
      upColor: CHART_COLORS.upColor,
      downColor: CHART_COLORS.downColor,
      wickUpColor: CHART_COLORS.wickUp,
      wickDownColor: CHART_COLORS.wickDown,
      borderVisible: false,
    });

    // Add volume series
    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });

    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.85, bottom: 0 },
    });

    // =========================================================================
    // Create indicator series ONCE - they persist for chart lifetime
    // =========================================================================

    // Ripster Clouds (area series for ribbon) - add first so they render behind
    ribbonBullishRef.current = chart.addAreaSeries({
      topColor: CHART_COLORS.ribbonBullish,
      bottomColor: 'transparent',
      lineColor: 'transparent',
      priceLineVisible: false,
      lastValueVisible: false,
    });
    ribbonBearishRef.current = chart.addAreaSeries({
      topColor: CHART_COLORS.ribbonBearish,
      bottomColor: 'transparent',
      lineColor: 'transparent',
      priceLineVisible: false,
      lastValueVisible: false,
    });

    // VWAP bands (dotted/dashed lines)
    vwapUpper2Ref.current = chart.addLineSeries({
      color: CHART_COLORS.vwap,
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    vwapLower2Ref.current = chart.addLineSeries({
      color: CHART_COLORS.vwap,
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    vwapUpper1Ref.current = chart.addLineSeries({
      color: CHART_COLORS.vwap,
      lineWidth: 1,
      lineStyle: LineStyle.Dotted,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    vwapLower1Ref.current = chart.addLineSeries({
      color: CHART_COLORS.vwap,
      lineWidth: 1,
      lineStyle: LineStyle.Dotted,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    // VWAP main line
    vwapSeriesRef.current = chart.addLineSeries({
      color: CHART_COLORS.vwap,
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
      title: 'VWAP',
    });

    // EMA lines
    ema9SeriesRef.current = chart.addLineSeries({
      color: CHART_COLORS.ema9,
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      title: 'EMA9',
    });
    ema21SeriesRef.current = chart.addLineSeries({
      color: CHART_COLORS.ema21,
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      title: 'EMA21',
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;
    isInitializedRef.current = true;

    // Handle resize with requestAnimationFrame to prevent "ResizeObserver loop limit exceeded" errors
    let rafId: number | null = null;
    const handleResize = () => {
      // Cancel any pending RAF to debounce rapid resize events
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      rafId = requestAnimationFrame(() => {
        if (chartContainerRef.current && chart) {
          chart.applyOptions({
            width: chartContainerRef.current.clientWidth,
            height: chartContainerRef.current.clientHeight,
          });
        }
        rafId = null;
      });
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(chartContainerRef.current);
    handleResize();

    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      resizeObserver.disconnect();
      // Clear all price lines before removing chart
      priceLinesRef.current = [];
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      vwapSeriesRef.current = null;
      vwapUpper1Ref.current = null;
      vwapLower1Ref.current = null;
      vwapUpper2Ref.current = null;
      vwapLower2Ref.current = null;
      ema9SeriesRef.current = null;
      ema21SeriesRef.current = null;
      ribbonBullishRef.current = null;
      ribbonBearishRef.current = null;
      isInitializedRef.current = false;
    };
  }, []);

  // =============================================================================
  // Update Chart Data - Controlled by Parent
  // =============================================================================

  useEffect(() => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current || !chartRef.current) return;
    if (visibleCandles.length === 0) return;

    // Build candle data, potentially with animated last candle
    let candleData: CandlestickData[];
    let volumeData: ReturnType<typeof formatVolumeForChart>;

    if (animatingCandle && isAnimating) {
      // Show completed candles + animating candle
      const completedCandles = visibleCandles.slice(0, -1);
      candleData = [
        ...formatCandlesForChart(completedCandles),
        {
          time: (animatingCandle.t / 1000) as Time,
          open: animatingCandle.o,
          high: animatingCandle.currentHigh,
          low: animatingCandle.currentLow,
          close: animatingCandle.currentClose,
        },
      ];
      volumeData = [
        ...formatVolumeForChart(completedCandles),
        {
          time: (animatingCandle.t / 1000) as Time,
          value: animatingCandle.v * animatingCandle.progress,
          color: animatingCandle.currentClose >= animatingCandle.o
            ? CHART_COLORS.volumeUp
            : CHART_COLORS.volumeDown,
        },
      ];
    } else {
      candleData = formatCandlesForChart(visibleCandles);
      volumeData = formatVolumeForChart(visibleCandles);
    }

    candleSeriesRef.current.setData(candleData);

    if (indicators.showVolume) {
      volumeSeriesRef.current.setData(volumeData);
    }
  }, [visibleCandles, animatingCandle, isAnimating, indicators.showVolume, formatCandlesForChart, formatVolumeForChart]);

  // =============================================================================
  // Update Indicators - Use setData() on existing series (no recreation)
  // =============================================================================

  useEffect(() => {
    if (!isInitializedRef.current) return;
    if (visibleCandles.length < 21) {
      // Clear all indicator data when not enough candles
      vwapSeriesRef.current?.setData([]);
      vwapUpper1Ref.current?.setData([]);
      vwapLower1Ref.current?.setData([]);
      vwapUpper2Ref.current?.setData([]);
      vwapLower2Ref.current?.setData([]);
      ema9SeriesRef.current?.setData([]);
      ema21SeriesRef.current?.setData([]);
      ribbonBullishRef.current?.setData([]);
      ribbonBearishRef.current?.setData([]);
      return;
    }

    const bars: Bar[] = visibleCandles.map((c) => ({
      t: c.time,
      o: c.open,
      h: c.high,
      l: c.low,
      c: c.close,
      v: c.volume,
    }));
    const closes = bars.map((b) => b.c);
    const timestamps = bars.map((b) => b.t);

    // VWAP and bands - update existing series via setData()
    if (indicators.showVWAP || indicators.showVWAPBands) {
      const vwapBands = calculateVWAPBands(bars);

      // VWAP main line
      if (indicators.showVWAP && vwapSeriesRef.current) {
        vwapSeriesRef.current.setData(
          vwapBands.vwap
            .map((v, i) => ({
              time: (timestamps[i] / 1000) as Time,
              value: v,
            }))
            .filter((d) => d.value != null && isFinite(d.value))
        );
      } else {
        vwapSeriesRef.current?.setData([]);
      }

      // VWAP bands
      if (indicators.showVWAPBands) {
        vwapUpper1Ref.current?.setData(
          vwapBands.upperBand1
            .map((v, i) => ({ time: (timestamps[i] / 1000) as Time, value: v }))
            .filter((d) => d.value != null && isFinite(d.value))
        );
        vwapLower1Ref.current?.setData(
          vwapBands.lowerBand1
            .map((v, i) => ({ time: (timestamps[i] / 1000) as Time, value: v }))
            .filter((d) => d.value != null && isFinite(d.value))
        );
        vwapUpper2Ref.current?.setData(
          vwapBands.upperBand2
            .map((v, i) => ({ time: (timestamps[i] / 1000) as Time, value: v }))
            .filter((d) => d.value != null && isFinite(d.value))
        );
        vwapLower2Ref.current?.setData(
          vwapBands.lowerBand2
            .map((v, i) => ({ time: (timestamps[i] / 1000) as Time, value: v }))
            .filter((d) => d.value != null && isFinite(d.value))
        );
      } else {
        vwapUpper1Ref.current?.setData([]);
        vwapLower1Ref.current?.setData([]);
        vwapUpper2Ref.current?.setData([]);
        vwapLower2Ref.current?.setData([]);
      }
    } else {
      // Hide VWAP entirely
      vwapSeriesRef.current?.setData([]);
      vwapUpper1Ref.current?.setData([]);
      vwapLower1Ref.current?.setData([]);
      vwapUpper2Ref.current?.setData([]);
      vwapLower2Ref.current?.setData([]);
    }

    // EMA 9 - GREEN (KCU Standard)
    if (indicators.showEMA9 && ema9SeriesRef.current) {
      const ema9Values = calculateEMA(closes, 9);
      ema9SeriesRef.current.setData(
        ema9Values
          .map((v, i) => ({ time: (timestamps[i] / 1000) as Time, value: v }))
          .filter((d) => d.value > 0)
      );
    } else {
      ema9SeriesRef.current?.setData([]);
    }

    // EMA 21 - RED (KCU Standard)
    if (indicators.showEMA21 && ema21SeriesRef.current) {
      const ema21Values = calculateEMA(closes, 21);
      ema21SeriesRef.current.setData(
        ema21Values
          .map((v, i) => ({ time: (timestamps[i] / 1000) as Time, value: v }))
          .filter((d) => d.value > 0)
      );
    } else {
      ema21SeriesRef.current?.setData([]);
    }

    // Ripster Clouds - EMA 8/21 Fill Area
    if (indicators.showEMARibbon && ribbonBullishRef.current && ribbonBearishRef.current) {
      const ribbon = calculateEMARibbon(closes);

      // Build bullish and bearish area data
      const bullishData: AreaData[] = [];
      const bearishData: AreaData[] = [];

      ribbon.states.forEach((state, i) => {
        const time = (timestamps[i] / 1000) as Time;
        if (state.color === 'bullish') {
          bullishData.push({ time, value: state.topEMA });
        } else {
          bearishData.push({ time, value: state.topEMA });
        }
      });

      ribbonBullishRef.current.setData(bullishData);
      ribbonBearishRef.current.setData(bearishData);
    } else {
      ribbonBullishRef.current?.setData([]);
      ribbonBearishRef.current?.setData([]);
    }
  }, [visibleCandles, indicators]);

  // =============================================================================
  // Update Key Levels using createPriceLine() - No series churn
  // Price lines are horizontal lines attached to a series, showing exact price
  // =============================================================================

  useEffect(() => {
    if (!candleSeriesRef.current) return;
    const candleSeries = candleSeriesRef.current;

    // Remove existing price lines
    priceLinesRef.current.forEach((priceLine) => {
      try {
        candleSeries.removePriceLine(priceLine);
      } catch {
        // Price line may already be removed
      }
    });
    priceLinesRef.current = [];

    if (!showLevels) return;

    // Combine all levels
    const allLevels: Array<KeyLevel & { isGamma?: boolean; isTrade?: boolean }> = [
      ...levels,
      ...gammaLevels.map((g) => ({
        type: g.type,
        price: g.price,
        label: g.type.replace('_', ' ').toUpperCase(),
        strength: g.strength,
        isGamma: true,
      })),
      ...tradeLevels.map((t) => ({
        ...t,
        isTrade: true,
      })),
    ];

    // Add each level as a price line attached to candle series
    allLevels.forEach((level) => {
      const color = LEVEL_COLORS[level.type] || LEVEL_COLORS.default;
      const strength = level.strength || 50;

      const priceLine = candleSeries.createPriceLine({
        price: level.price,
        color,
        lineWidth: strength >= 80 ? 2 : level.isTrade ? 2 : 1,
        lineStyle: level.isTrade ? LineStyle.Solid : strength >= 70 ? LineStyle.Solid : LineStyle.Dashed,
        axisLabelVisible: true,
        title: `${level.label} $${level.price.toFixed(2)}`,
      });

      priceLinesRef.current.push(priceLine);
    });
  }, [levels, gammaLevels, tradeLevels, showLevels]);

  // =============================================================================
  // Decision Point Marker - Uses chart markers, not line series
  // =============================================================================

  useEffect(() => {
    if (!candleSeriesRef.current) return;
    const candleSeries = candleSeriesRef.current;

    // Only show decision point marker in replay mode when decision is reached
    if (!isReplayMode || !decisionReached || decisionPointIndex === undefined || visibleCandles.length === 0) {
      // Clear markers
      candleSeries.setMarkers([]);
      return;
    }

    const decisionCandle = visibleCandles[Math.min(decisionPointIndex, visibleCandles.length - 1)];
    if (!decisionCandle) {
      candleSeries.setMarkers([]);
      return;
    }

    // Create a marker at the decision point
    const markers: SeriesMarker<Time>[] = [
      {
        time: (decisionCandle.time / 1000) as Time,
        position: 'aboveBar',
        color: CHART_COLORS.decisionPoint,
        shape: 'arrowDown',
        text: 'DECISION',
      },
    ];

    candleSeries.setMarkers(markers);
  }, [isReplayMode, decisionReached, decisionPointIndex, visibleCandles]);

  // =============================================================================
  // Zoom Controls
  // =============================================================================

  const handleZoomIn = useCallback(() => {
    if (chartRef.current) {
      const timeScale = chartRef.current.timeScale();
      const visibleRange = timeScale.getVisibleLogicalRange();
      if (visibleRange) {
        const newFrom = visibleRange.from + (visibleRange.to - visibleRange.from) * 0.1;
        const newTo = visibleRange.to - (visibleRange.to - visibleRange.from) * 0.1;
        timeScale.setVisibleLogicalRange({ from: newFrom, to: newTo });
      }
    }
  }, []);

  const handleZoomOut = useCallback(() => {
    if (chartRef.current) {
      const timeScale = chartRef.current.timeScale();
      const visibleRange = timeScale.getVisibleLogicalRange();
      if (visibleRange) {
        const newFrom = visibleRange.from - (visibleRange.to - visibleRange.from) * 0.1;
        const newTo = visibleRange.to + (visibleRange.to - visibleRange.from) * 0.1;
        timeScale.setVisibleLogicalRange({ from: newFrom, to: newTo });
      }
    }
  }, []);

  // =============================================================================
  // Toggle Indicator
  // =============================================================================

  const toggleIndicator = useCallback((key: keyof IndicatorSettings) => {
    setIndicators((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // =============================================================================
  // Render
  // =============================================================================

  return (
    <div className={cn('relative bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg overflow-hidden', className)}>
      {/* Chart Header */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-3 py-2 bg-gradient-to-b from-[var(--bg-primary)] to-transparent">
        <div className="flex items-center gap-3">
          <span className="px-3 py-1 bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm font-bold rounded">
            {symbol}
          </span>
          <span className="px-2 py-1 bg-[var(--bg-tertiary)] text-[var(--text-secondary)] text-xs rounded">
            {timeframe}
          </span>
          {isReplayMode && decisionReached && !showOutcome && (
            <span className="px-3 py-1 bg-[var(--accent-primary)] text-[var(--bg-primary)] text-xs font-bold rounded animate-pulse">
              DECISION POINT
            </span>
          )}
        </div>

        {/* Indicator Quick Toggles */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => toggleIndicator('showVWAP')}
            className={cn(
              'p-1.5 rounded transition-colors',
              indicators.showVWAP
                ? 'bg-purple-500/20 text-purple-400'
                : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-tertiary)]'
            )}
            title="VWAP (Purple)"
          >
            <Activity className="w-4 h-4" />
          </button>
          <button
            onClick={() => toggleIndicator('showEMARibbon')}
            className={cn(
              'p-1.5 rounded transition-colors',
              indicators.showEMARibbon
                ? 'bg-green-500/20 text-green-400'
                : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-tertiary)]'
            )}
            title="Ripster Clouds (EMA 8/21)"
          >
            <TrendingUp className="w-4 h-4" />
          </button>
          <button
            onClick={() => toggleIndicator('showVolume')}
            className={cn(
              'p-1.5 rounded transition-colors',
              indicators.showVolume
                ? 'bg-blue-500/20 text-blue-400'
                : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-tertiary)]'
            )}
            title="Volume"
          >
            <BarChart3 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={cn(
              'p-1.5 rounded transition-colors',
              showSettings
                ? 'bg-[var(--accent-primary)]/20 text-[var(--accent-primary)]'
                : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-tertiary)]'
            )}
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Settings Dropdown */}
      {showSettings && (
        <div className="absolute top-12 right-3 z-20 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg p-3 min-w-[220px] shadow-xl">
          <div className="text-xs font-medium text-[var(--text-tertiary)] uppercase mb-2">Indicators</div>
          <div className="space-y-2">
            {[
              { key: 'showVWAP', label: 'VWAP (Purple)', color: 'text-purple-400' },
              { key: 'showVWAPBands', label: 'VWAP Bands (±1σ, ±2σ)', color: 'text-purple-300' },
              { key: 'showEMA9', label: 'EMA 9 (Green)', color: 'text-green-400' },
              { key: 'showEMA21', label: 'EMA 21 (Red)', color: 'text-red-400' },
              { key: 'showEMARibbon', label: 'Ripster Clouds', color: 'text-green-400' },
              { key: 'showVolume', label: 'Volume', color: 'text-blue-400' },
            ].map(({ key, label, color }) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={indicators[key as keyof IndicatorSettings]}
                  onChange={() => toggleIndicator(key as keyof IndicatorSettings)}
                  className="w-4 h-4 rounded border-[var(--border-primary)] bg-[var(--bg-tertiary)] checked:bg-[var(--accent-primary)]"
                />
                <span className={cn('text-sm', color)}>{label}</span>
              </label>
            ))}
          </div>

          {/* Color Legend */}
          <div className="border-t border-[var(--border-primary)] mt-3 pt-3">
            <div className="text-xs font-medium text-[var(--text-tertiary)] uppercase mb-2">KCU Color Legend</div>
            <div className="space-y-1 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-0.5 bg-green-500" />
                <span className="text-green-400">EMA 9 - Fast</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-0.5 bg-red-500" />
                <span className="text-red-400">EMA 21 - Slow</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-0.5 bg-purple-500" />
                <span className="text-purple-400">VWAP</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chart Container */}
      <div ref={chartContainerRef} className="w-full" style={{ height: `${height}px` }} />

      {/* Key Levels Legend */}
      {showLevels && levels.length > 0 && (
        <div className="absolute top-14 right-3 z-10 bg-[var(--bg-secondary)]/95 border border-[var(--border-primary)] rounded p-2 max-w-[200px]">
          <div className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider mb-1">Key Levels</div>
          <div className="space-y-1">
            {levels.slice(0, 6).map((level, idx) => (
              <div key={idx} className="flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1">
                  <div
                    className="w-3 h-0.5"
                    style={{ backgroundColor: LEVEL_COLORS[level.type] || LEVEL_COLORS.default }}
                  />
                  <span className="text-[var(--text-secondary)] truncate">{level.label}</span>
                </div>
                <span className="text-[var(--text-primary)] font-mono">${level.price.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* View Controls */}
      <div className="absolute bottom-3 right-3 z-10 flex items-center gap-1 bg-[var(--bg-secondary)]/95 border border-[var(--border-primary)] rounded-lg p-1">
        <button
          onClick={() => setShowLevels(!showLevels)}
          className={cn(
            'p-2 rounded transition-colors',
            showLevels
              ? 'bg-[var(--accent-primary)]/20 text-[var(--accent-primary)]'
              : 'hover:bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]'
          )}
          title={showLevels ? 'Hide Levels' : 'Show Levels'}
        >
          {showLevels ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
        </button>
        <button
          onClick={handleZoomIn}
          className="p-2 hover:bg-[var(--bg-tertiary)] rounded transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4 text-[var(--text-secondary)]" />
        </button>
        <button
          onClick={handleZoomOut}
          className="p-2 hover:bg-[var(--bg-tertiary)] rounded transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4 text-[var(--text-secondary)]" />
        </button>
      </div>

      {/* Candle Counter (for replay mode) */}
      {isReplayMode && (
        <div className="absolute bottom-3 left-3 z-10 px-3 py-1 bg-[var(--bg-secondary)]/95 border border-[var(--border-primary)] rounded text-xs text-[var(--text-tertiary)] font-mono">
          {currentIndex !== undefined ? currentIndex + 1 : visibleCandles.length} / {visibleCandles.length}
        </div>
      )}

      {/* Outcome Overlay */}
      {showOutcome && outcomeData && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-20">
          <div
            className={cn(
              'px-8 py-6 rounded-xl text-center',
              outcomeData.result === 'win'
                ? 'bg-green-500/20 border-2 border-green-500'
                : outcomeData.result === 'avoided_loss' || outcomeData.result === 'correct_wait'
                  ? 'bg-amber-500/20 border-2 border-amber-500'
                  : 'bg-red-500/20 border-2 border-red-500'
            )}
          >
            <div
              className={cn(
                'text-3xl font-bold mb-2',
                outcomeData.result === 'win'
                  ? 'text-green-400'
                  : outcomeData.result === 'avoided_loss' || outcomeData.result === 'correct_wait'
                    ? 'text-amber-400'
                    : 'text-red-400'
              )}
            >
              {outcomeData.result === 'win'
                ? 'WIN'
                : outcomeData.result === 'avoided_loss'
                  ? 'LOSS AVOIDED'
                  : outcomeData.result === 'correct_wait'
                    ? 'CORRECT WAIT'
                    : 'LOSS'}
            </div>
            {outcomeData.pnl_percent !== undefined && (
              <div className="text-xl text-white font-semibold">
                {outcomeData.pnl_percent > 0 ? '+' : ''}
                {outcomeData.pnl_percent.toFixed(2)}%
              </div>
            )}
            {outcomeData.exit_price !== undefined && (
              <div className="text-sm text-gray-300 mt-1">
                Exit: ${outcomeData.exit_price.toFixed(2)}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default PracticeChart;
