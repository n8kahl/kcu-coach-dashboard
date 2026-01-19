'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
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
} from 'lightweight-charts';
import { cn } from '@/lib/utils';
import {
  calculateEMA,
  calculateVWAPBands,
  calculateEMARibbon,
  calculateVolumeProfile,
  aggregateBars,
  Bar,
  Timeframe,
  VolumeProfile,
} from '@/lib/practice/indicators';
import {
  useCandleReplay,
  type AnimatingCandle,
  type OHLCCandle,
  easingFunctions,
} from '@/hooks/useCandleReplay';
import {
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  Eye,
  EyeOff,
  ZoomIn,
  ZoomOut,
  Settings,
  TrendingUp,
  Activity,
  BarChart3,
} from 'lucide-react';

interface KeyLevel {
  type: string;
  price: number;
  strength: number;
  label: string;
}

interface ChartCandle {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

interface PracticeChartProps {
  chartData: {
    candles: ChartCandle[];
    volume_profile?: {
      high_vol_node?: number;
      low_vol_node?: number;
    };
  };
  keyLevels: KeyLevel[];
  decisionPoint?: {
    price: number;
    time: number;
    context: string;
  };
  outcomeData?: {
    result: string;
    exit_price?: number;
    pnl_percent?: number;
    candles_to_target?: number;
  };
  symbol: string;
  timeframe: string;
  showOutcome?: boolean;
  replayMode?: boolean;
  onDecisionPointReached?: () => void;
  className?: string;
  initialCandleCount?: number; // How many candles to show initially in replay mode
}

// KCU Professional trading chart color scheme
// Following Somesh's methodology: EMA9 = Green, EMA21 = Red
const CHART_COLORS = {
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
  // Indicator colors - KCU Methodology
  vwap: '#8b5cf6', // Purple - VWAP
  vwapBand1: 'rgba(139, 92, 246, 0.3)', // +/- 1 SD band
  vwapBand2: 'rgba(139, 92, 246, 0.15)', // +/- 2 SD band
  ema9: '#22c55e', // GREEN - Fast EMA (KCU standard)
  ema21: '#ef4444', // RED - Slow EMA (KCU standard)
  ema50: '#eab308', // Yellow - 50 EMA
  sma200: '#ffffff', // White - 200 SMA
  // EMA Ribbon / Ripster Clouds
  ribbonBullish: 'rgba(34, 197, 94, 0.2)', // Green cloud when EMA8 > EMA21
  ribbonBearish: 'rgba(239, 68, 68, 0.2)', // Red cloud when EMA8 < EMA21
  ribbonNeutral: 'rgba(107, 114, 128, 0.1)',
  // Level colors
  support: '#10b981',
  resistance: '#ef4444',
  // Pre-market levels
  premarketHigh: '#ec4899', // Pink
  premarketLow: '#ec4899', // Pink
  // ORB levels
  orbHigh: '#06b6d4', // Cyan
  orbLow: '#06b6d4', // Cyan
  // Volume Profile
  vpBuy: 'rgba(16, 185, 129, 0.6)',
  vpSell: 'rgba(239, 68, 68, 0.6)',
  vpPOC: '#f59e0b',
  vpVA: 'rgba(96, 165, 250, 0.3)',
  // Special
  crosshair: '#6b7280',
  decisionPoint: '#f59e0b',
};

const LEVEL_COLORS: Record<string, string> = {
  support: CHART_COLORS.support,
  resistance: CHART_COLORS.resistance,
  vwap: CHART_COLORS.vwap,
  ema: CHART_COLORS.ema9,
  ema9: CHART_COLORS.ema9,
  ema21: CHART_COLORS.ema21,
  daily_support: CHART_COLORS.support,
  daily_resistance: CHART_COLORS.resistance,
  demand_zone: CHART_COLORS.support,
  supply_zone: CHART_COLORS.resistance,
  premarket_high: CHART_COLORS.premarketHigh,
  premarket_low: CHART_COLORS.premarketLow,
  pm_high: CHART_COLORS.premarketHigh,
  pm_low: CHART_COLORS.premarketLow,
  pdh: '#fbbf24', // Previous Day High - Amber
  pdl: '#fbbf24', // Previous Day Low - Amber
  previous_day_high: '#fbbf24',
  previous_day_low: '#fbbf24',
  gap_high: '#06b6d4',
  gap_low: '#06b6d4',
  gap_top: '#06b6d4',
  previous_close: '#a855f7', // Purple for gap fill targets
  orb_high: CHART_COLORS.orbHigh,
  orb_low: CHART_COLORS.orbLow,
  opening_range_high: CHART_COLORS.orbHigh,
  opening_range_low: CHART_COLORS.orbLow,
  round_number: '#6b7280',
  weekly_high: '#3b82f6',
  weekly_low: '#3b82f6',
  sma_200: CHART_COLORS.sma200,
  sma200: CHART_COLORS.sma200,
  neckline: '#f97316', // Pattern necklines
  double_bottom: CHART_COLORS.support,
  fib_50: '#a78bfa', // Fibonacci levels
  extension: '#a78bfa',
  max_pain: '#f59e0b', // Options max pain
  call_wall: CHART_COLORS.resistance,
  put_wall: CHART_COLORS.support,
  liquidity: '#ef4444',
  sweep_high: '#ef4444',
  trap_low: CHART_COLORS.support,
  broken_resistance: CHART_COLORS.support, // Broken R becomes S
  breakout_high: CHART_COLORS.resistance,
  spike_high: '#f97316',
  range_high: CHART_COLORS.resistance,
  range_low: CHART_COLORS.support,
  default: CHART_COLORS.text,
};

const TIMEFRAMES: Timeframe[] = ['2m', '5m', '15m', '1H', '4H', 'D', 'W'];

interface IndicatorSettings {
  showVWAP: boolean;
  showVWAPBands: boolean;
  showEMA9: boolean;
  showEMA21: boolean;
  showEMARibbon: boolean; // Ripster Clouds (EMA 8-21 fill)
  showVolumeProfile: boolean;
  showORBLevels: boolean; // Opening Range Breakout levels
  showPremarketLevels: boolean; // Pre-market high/low
}

export function PracticeChart({
  chartData,
  keyLevels,
  decisionPoint,
  outcomeData,
  symbol,
  timeframe: initialTimeframe,
  showOutcome = false,
  replayMode = false,
  onDecisionPointReached,
  className,
  initialCandleCount = 50,
}: PracticeChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const indicatorSeriesRef = useRef<ISeriesApi<'Line' | 'Area'>[]>([]);
  const levelLinesRef = useRef<ISeriesApi<'Line'>[]>([]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentCandleIndex, setCurrentCandleIndex] = useState(
    replayMode ? Math.min(initialCandleCount - 1, chartData.candles.length - 1) : chartData.candles.length - 1
  );
  const [showLevels, setShowLevels] = useState(true);
  const [decisionReached, setDecisionReached] = useState(false);
  const [selectedTimeframe, setSelectedTimeframe] = useState<Timeframe>(initialTimeframe as Timeframe);
  const [showSettings, setShowSettings] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1); // 1x, 2x, 0.5x
  const [indicators, setIndicators] = useState<IndicatorSettings>({
    showVWAP: true,
    showVWAPBands: true,
    showEMA9: true,
    showEMA21: true,
    showEMARibbon: true, // Ripster Clouds - enabled by default for KCU
    showVolumeProfile: false,
    showORBLevels: true, // ORB levels - enabled by default
    showPremarketLevels: true, // Pre-market levels - enabled by default
  });

  const playIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Candle painting animation hook
  const {
    state: candleReplayState,
    animateCandle,
    cancelAnimation,
    isAnimating: isCandleAnimating,
  } = useCandleReplay({
    duration: 500, // Paint candle over 500ms
    easing: easingFunctions.easeOutCubic,
    realisticPath: true,
    onComplete: (candle) => {
      // When animation completes, finalize the candle
      // The chart will already show the final values
    },
    onFrame: (animatingCandle) => {
      // Update chart on each animation frame
      if (!candleSeriesRef.current || !volumeSeriesRef.current) return;

      // Get all completed candles up to (but not including) the animating one
      const completedCandles = currentBars.slice(0, currentCandleIndex);

      // Create the animated candle data for the chart
      const animatedCandleData: CandlestickData = {
        time: (animatingCandle.t / 1000) as Time,
        open: animatingCandle.o,
        high: animatingCandle.currentHigh,
        low: animatingCandle.currentLow,
        close: animatingCandle.currentClose,
      };

      // Combine completed candles with the animating candle
      const allCandles: CandlestickData[] = [
        ...completedCandles.map(c => ({
          time: (c.t / 1000) as Time,
          open: c.o,
          high: c.h,
          low: c.l,
          close: c.c,
        })),
        animatedCandleData,
      ];

      // Update candle series with animation frame
      candleSeriesRef.current.setData(allCandles);

      // Update volume (use proportional volume based on progress)
      const volumeProgress = animatingCandle.progress;
      const animatedVolume = animatingCandle.v * volumeProgress;
      const allVolume = [
        ...completedCandles.map(c => ({
          time: (c.t / 1000) as Time,
          value: c.v,
          color: c.c >= c.o ? CHART_COLORS.volumeUp : CHART_COLORS.volumeDown,
        })),
        {
          time: (animatingCandle.t / 1000) as Time,
          value: animatedVolume,
          color: animatingCandle.currentClose >= animatingCandle.o
            ? CHART_COLORS.volumeUp
            : CHART_COLORS.volumeDown,
        },
      ];
      volumeSeriesRef.current.setData(allVolume);
    },
  });

  // Get bars for current timeframe
  const getBarsForTimeframe = useCallback((): ChartCandle[] => {
    if (selectedTimeframe === initialTimeframe) {
      return chartData.candles;
    }
    // Aggregate bars to the selected timeframe
    const bars = chartData.candles.map(c => ({
      t: c.t,
      o: c.o,
      h: c.h,
      l: c.l,
      c: c.c,
      v: c.v,
    })) as Bar[];
    const aggregated = aggregateBars(bars, selectedTimeframe);
    return aggregated;
  }, [chartData.candles, selectedTimeframe, initialTimeframe]);

  const currentBars = getBarsForTimeframe();

  // Convert candle data to lightweight-charts format
  const formatCandles = useCallback((candles: ChartCandle[], endIndex: number): CandlestickData[] => {
    return candles.slice(0, endIndex + 1).map(candle => ({
      time: (candle.t / 1000) as Time,
      open: candle.o,
      high: candle.h,
      low: candle.l,
      close: candle.c,
    }));
  }, []);

  // Format volume data
  const formatVolume = useCallback((candles: ChartCandle[], endIndex: number) => {
    return candles.slice(0, endIndex + 1).map(candle => ({
      time: (candle.t / 1000) as Time,
      value: candle.v,
      color: candle.c >= candle.o ? CHART_COLORS.volumeUp : CHART_COLORS.volumeDown,
    }));
  }, []);

  // Initialize chart
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
        scaleMargins: {
          top: 0.1,
          bottom: 0.2,
        },
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
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: 'volume',
    });

    chart.priceScale('volume').applyOptions({
      scaleMargins: {
        top: 0.85,
        bottom: 0,
      },
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    // Set initial data
    const initialCandles = formatCandles(currentBars, currentCandleIndex);
    const initialVolume = formatVolume(currentBars, currentCandleIndex);
    candleSeries.setData(initialCandles);
    volumeSeries.setData(initialVolume);

    // Fit content
    chart.timeScale().fitContent();

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(chartContainerRef.current);
    handleResize();

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      indicatorSeriesRef.current = [];
      levelLinesRef.current = [];
    };
  }, []);

  // Update chart data when candle index or timeframe changes
  useEffect(() => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current || !chartRef.current) return;

    const candles = formatCandles(currentBars, currentCandleIndex);
    const volume = formatVolume(currentBars, currentCandleIndex);

    candleSeriesRef.current.setData(candles);
    volumeSeriesRef.current.setData(volume);

    // Check if we've reached the decision point
    if (decisionPoint && !decisionReached) {
      const currentCandle = currentBars[currentCandleIndex];
      if (currentCandle && currentCandle.t >= decisionPoint.time) {
        setDecisionReached(true);
        setIsPlaying(false);
        onDecisionPointReached?.();
      }
    }
  }, [currentCandleIndex, currentBars, formatCandles, formatVolume, decisionPoint, decisionReached, onDecisionPointReached]);

  // Add/update indicators
  useEffect(() => {
    if (!chartRef.current) return;

    // Remove existing indicator series
    indicatorSeriesRef.current.forEach(series => {
      try {
        chartRef.current?.removeSeries(series);
      } catch {
        // Series may already be removed
      }
    });
    indicatorSeriesRef.current = [];

    const visibleBars = currentBars.slice(0, currentCandleIndex + 1);
    if (visibleBars.length === 0) return;

    const bars = visibleBars as Bar[];
    const closes = bars.map(b => b.c);
    const timestamps = bars.map(b => b.t);

    // VWAP and bands
    if (indicators.showVWAP || indicators.showVWAPBands) {
      const vwapBands = calculateVWAPBands(bars);

      // VWAP line
      if (indicators.showVWAP) {
        const vwapSeries = chartRef.current.addLineSeries({
          color: CHART_COLORS.vwap,
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: true,
          title: 'VWAP',
        });
        vwapSeries.setData(
          vwapBands.vwap.map((v, i) => ({
            time: (timestamps[i] / 1000) as Time,
            value: v,
          }))
        );
        indicatorSeriesRef.current.push(vwapSeries);
      }

      // VWAP bands
      if (indicators.showVWAPBands) {
        // Upper band 1
        const upper1Series = chartRef.current.addLineSeries({
          color: CHART_COLORS.vwap,
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        upper1Series.setData(
          vwapBands.upperBand1.map((v, i) => ({
            time: (timestamps[i] / 1000) as Time,
            value: v,
          }))
        );
        indicatorSeriesRef.current.push(upper1Series);

        // Lower band 1
        const lower1Series = chartRef.current.addLineSeries({
          color: CHART_COLORS.vwap,
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        lower1Series.setData(
          vwapBands.lowerBand1.map((v, i) => ({
            time: (timestamps[i] / 1000) as Time,
            value: v,
          }))
        );
        indicatorSeriesRef.current.push(lower1Series);

        // Upper band 2
        const upper2Series = chartRef.current.addLineSeries({
          color: CHART_COLORS.vwap,
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        upper2Series.setData(
          vwapBands.upperBand2.map((v, i) => ({
            time: (timestamps[i] / 1000) as Time,
            value: v,
          }))
        );
        indicatorSeriesRef.current.push(upper2Series);

        // Lower band 2
        const lower2Series = chartRef.current.addLineSeries({
          color: CHART_COLORS.vwap,
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        lower2Series.setData(
          vwapBands.lowerBand2.map((v, i) => ({
            time: (timestamps[i] / 1000) as Time,
            value: v,
          }))
        );
        indicatorSeriesRef.current.push(lower2Series);
      }
    }

    // EMA 9
    if (indicators.showEMA9) {
      const ema9 = calculateEMA(closes, 9);
      const ema9Series = chartRef.current.addLineSeries({
        color: CHART_COLORS.ema9,
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        title: 'EMA9',
      });
      ema9Series.setData(
        ema9.map((v, i) => ({
          time: (timestamps[i] / 1000) as Time,
          value: v,
        })).filter(d => d.value > 0)
      );
      indicatorSeriesRef.current.push(ema9Series);
    }

    // EMA 21
    if (indicators.showEMA21) {
      const ema21 = calculateEMA(closes, 21);
      const ema21Series = chartRef.current.addLineSeries({
        color: CHART_COLORS.ema21,
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        title: 'EMA21',
      });
      ema21Series.setData(
        ema21.map((v, i) => ({
          time: (timestamps[i] / 1000) as Time,
          value: v,
        })).filter(d => d.value > 0)
      );
      indicatorSeriesRef.current.push(ema21Series);
    }

    // EMA Ribbon
    if (indicators.showEMARibbon) {
      const ribbon = calculateEMARibbon(closes);

      // Create area series for ribbon
      const ribbonSeries = chartRef.current.addAreaSeries({
        topColor: CHART_COLORS.ribbonBullish,
        bottomColor: 'transparent',
        lineColor: 'transparent',
        priceLineVisible: false,
        lastValueVisible: false,
      });

      const areaData: AreaData[] = ribbon.states.map((state, i) => ({
        time: (timestamps[i] / 1000) as Time,
        value: state.topEMA,
      }));

      if (areaData.length > 0) {
        ribbonSeries.setData(areaData);
        indicatorSeriesRef.current.push(ribbonSeries);
      }
    }
  }, [currentCandleIndex, currentBars, indicators]);

  // Add key level lines
  useEffect(() => {
    if (!chartRef.current) return;

    // Remove existing level lines
    levelLinesRef.current.forEach(line => {
      try {
        chartRef.current?.removeSeries(line);
      } catch {
        // Series may already be removed
      }
    });
    levelLinesRef.current = [];

    if (!showLevels) return;

    const visibleBars = currentBars.slice(0, currentCandleIndex + 1);
    if (visibleBars.length === 0) return;

    const startTime = visibleBars[0].t / 1000;
    const endTime = visibleBars[visibleBars.length - 1].t / 1000;

    // Add key levels
    keyLevels.forEach(level => {
      const color = LEVEL_COLORS[level.type] || LEVEL_COLORS.default;

      const lineSeries = chartRef.current!.addLineSeries({
        color,
        lineWidth: level.strength >= 80 ? 2 : 1,
        lineStyle: level.strength >= 70 ? LineStyle.Solid : LineStyle.Dashed,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });

      const lineData: LineData[] = [
        { time: startTime as Time, value: level.price },
        { time: endTime as Time, value: level.price },
      ];

      lineSeries.setData(lineData);
      levelLinesRef.current.push(lineSeries);
    });

    // Add decision point marker if exists and showing outcome
    if (decisionPoint && showOutcome) {
      const markerSeries = chartRef.current.addLineSeries({
        color: CHART_COLORS.decisionPoint,
        lineWidth: 2,
        lineStyle: LineStyle.Dashed,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });

      markerSeries.setData([
        { time: (decisionPoint.time / 1000) as Time, value: decisionPoint.price * 0.99 },
        { time: (decisionPoint.time / 1000) as Time, value: decisionPoint.price * 1.01 },
      ]);

      levelLinesRef.current.push(markerSeries);
    }
  }, [keyLevels, showLevels, currentBars, currentCandleIndex, decisionPoint, showOutcome]);

  // Replay controls
  const handlePlay = useCallback(() => {
    if (currentCandleIndex >= currentBars.length - 1) {
      setCurrentCandleIndex(Math.min(initialCandleCount - 1, currentBars.length - 1));
      setDecisionReached(false);
    }
    setIsPlaying(true);
  }, [currentCandleIndex, currentBars.length, initialCandleCount]);

  const handlePause = useCallback(() => {
    setIsPlaying(false);
    cancelAnimation(); // Cancel any ongoing candle animation
  }, [cancelAnimation]);

  const handleStepForward = useCallback(() => {
    // Don't allow stepping while animation is in progress
    if (isCandleAnimating) return;

    if (currentCandleIndex < currentBars.length - 1) {
      const nextIndex = currentCandleIndex + 1;
      const nextCandle = currentBars[nextIndex] as OHLCCandle;

      // Start the candle painting animation
      animateCandle(nextCandle);

      // Update the index (the candle will animate into place)
      setCurrentCandleIndex(nextIndex);
    }
  }, [currentCandleIndex, currentBars, isCandleAnimating, animateCandle]);

  const handleReset = useCallback(() => {
    setIsPlaying(false);
    cancelAnimation(); // Cancel any ongoing candle animation
    setCurrentCandleIndex(Math.min(initialCandleCount - 1, currentBars.length - 1));
    setDecisionReached(false);
  }, [currentBars.length, initialCandleCount, cancelAnimation]);

  const handleShowAll = useCallback(() => {
    setIsPlaying(false);
    cancelAnimation(); // Cancel any ongoing candle animation
    setCurrentCandleIndex(currentBars.length - 1);
  }, [currentBars.length, cancelAnimation]);

  // Auto-play effect with candle painting
  useEffect(() => {
    if (isPlaying && !isCandleAnimating) {
      // Calculate interval based on playback speed
      // At 1x speed, candle animation (500ms) + pause (300ms) = 800ms per candle
      const animationDuration = 500 / playbackSpeed;
      const pauseBetweenCandles = 300 / playbackSpeed;
      const totalInterval = animationDuration + pauseBetweenCandles;

      playIntervalRef.current = setInterval(() => {
        setCurrentCandleIndex(prev => {
          if (prev >= currentBars.length - 1) {
            setIsPlaying(false);
            return prev;
          }

          const nextIndex = prev + 1;
          const nextCandle = currentBars[nextIndex] as OHLCCandle;

          // Trigger candle painting animation
          if (nextCandle) {
            animateCandle(nextCandle);
          }

          return nextIndex;
        });
      }, totalInterval);
    } else if (!isPlaying) {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
        playIntervalRef.current = null;
      }
    }

    return () => {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
      }
    };
  }, [isPlaying, currentBars, playbackSpeed, isCandleAnimating, animateCandle]);

  // Zoom controls
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

  // Handle timeframe change
  const handleTimeframeChange = useCallback((tf: Timeframe) => {
    setSelectedTimeframe(tf);
    // Reset to appropriate candle index for new timeframe
    const newBars = tf === initialTimeframe
      ? chartData.candles
      : aggregateBars(chartData.candles.map(c => ({ t: c.t, o: c.o, h: c.h, l: c.l, c: c.c, v: c.v })) as Bar[], tf);

    if (replayMode) {
      setCurrentCandleIndex(Math.min(initialCandleCount - 1, newBars.length - 1));
      setDecisionReached(false);
    } else {
      setCurrentCandleIndex(newBars.length - 1);
    }
  }, [chartData.candles, initialTimeframe, replayMode, initialCandleCount]);

  // Toggle indicator
  const toggleIndicator = useCallback((key: keyof IndicatorSettings) => {
    setIndicators(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  return (
    <div className={cn('relative bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg overflow-hidden', className)}>
      {/* Chart Header */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-3 py-2 bg-gradient-to-b from-[var(--bg-primary)] to-transparent">
        <div className="flex items-center gap-3">
          <span className="px-3 py-1 bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm font-bold rounded">
            {symbol}
          </span>

          {/* Timeframe Selector */}
          <div className="flex items-center bg-[var(--bg-secondary)] rounded overflow-hidden">
            {TIMEFRAMES.map(tf => (
              <button
                key={tf}
                onClick={() => handleTimeframeChange(tf)}
                className={cn(
                  'px-2 py-1 text-xs font-medium transition-colors',
                  selectedTimeframe === tf
                    ? 'bg-[var(--accent-primary)] text-white'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
                )}
              >
                {tf}
              </button>
            ))}
          </div>

          {decisionReached && !showOutcome && (
            <span className="px-3 py-1 bg-[var(--accent-primary)] text-[var(--bg-primary)] text-xs font-bold rounded animate-pulse">
              DECISION POINT
            </span>
          )}
        </div>

        {/* Indicator toggles */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => toggleIndicator('showVWAP')}
            className={cn(
              'p-1.5 rounded transition-colors',
              indicators.showVWAP
                ? 'bg-purple-500/20 text-purple-400'
                : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-tertiary)]'
            )}
            title="VWAP"
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
            title="EMA Ribbon"
          >
            <TrendingUp className="w-4 h-4" />
          </button>
          <button
            onClick={() => toggleIndicator('showVolumeProfile')}
            className={cn(
              'p-1.5 rounded transition-colors',
              indicators.showVolumeProfile
                ? 'bg-blue-500/20 text-blue-400'
                : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-tertiary)]'
            )}
            title="Volume Profile"
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
        <div className="absolute top-12 right-3 z-20 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg p-3 min-w-[200px] shadow-xl">
          <div className="text-xs font-medium text-[var(--text-tertiary)] uppercase mb-2">Indicators</div>
          <div className="space-y-2">
            {[
              { key: 'showVWAP', label: 'VWAP' },
              { key: 'showVWAPBands', label: 'VWAP Bands (±1σ, ±2σ)' },
              { key: 'showEMA9', label: 'EMA 9' },
              { key: 'showEMA21', label: 'EMA 21' },
              { key: 'showEMARibbon', label: 'EMA Ribbon' },
              { key: 'showVolumeProfile', label: 'Volume Profile' },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={indicators[key as keyof IndicatorSettings]}
                  onChange={() => toggleIndicator(key as keyof IndicatorSettings)}
                  className="w-4 h-4 rounded border-[var(--border-primary)] bg-[var(--bg-tertiary)] checked:bg-[var(--accent-primary)]"
                />
                <span className="text-sm text-[var(--text-secondary)]">{label}</span>
              </label>
            ))}
          </div>

          {replayMode && (
            <>
              <div className="border-t border-[var(--border-primary)] my-3" />
              <div className="text-xs font-medium text-[var(--text-tertiary)] uppercase mb-2">Playback Speed</div>
              <div className="flex items-center gap-2">
                {[0.5, 1, 2, 4].map(speed => (
                  <button
                    key={speed}
                    onClick={() => setPlaybackSpeed(speed)}
                    className={cn(
                      'px-2 py-1 text-xs rounded transition-colors',
                      playbackSpeed === speed
                        ? 'bg-[var(--accent-primary)] text-white'
                        : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-primary)]'
                    )}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Chart Container */}
      <div ref={chartContainerRef} className="w-full h-[450px]" />

      {/* Key Levels Legend */}
      {showLevels && keyLevels.length > 0 && (
        <div className="absolute top-14 right-3 z-10 bg-[var(--bg-secondary)]/95 border border-[var(--border-primary)] rounded p-2 max-w-[200px]">
          <div className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider mb-1">Key Levels</div>
          <div className="space-y-1">
            {keyLevels.slice(0, 6).map((level, idx) => (
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

      {/* Controls Bar */}
      <div className="absolute bottom-3 left-3 right-3 z-10 flex items-center justify-between">
        {/* Replay Controls */}
        {replayMode && (
          <div className="flex items-center gap-1 bg-[var(--bg-secondary)]/95 border border-[var(--border-primary)] rounded-lg p-1">
            <button
              onClick={handleReset}
              className="p-2 hover:bg-[var(--bg-tertiary)] rounded transition-colors"
              title="Reset"
            >
              <RotateCcw className="w-4 h-4 text-[var(--text-secondary)]" />
            </button>
            {isPlaying ? (
              <button
                onClick={handlePause}
                className="p-2 hover:bg-[var(--bg-tertiary)] rounded transition-colors"
                title="Pause"
              >
                <Pause className="w-4 h-4 text-[var(--text-secondary)]" />
              </button>
            ) : (
              <button
                onClick={handlePlay}
                className="p-2 bg-[var(--accent-primary)]/20 hover:bg-[var(--accent-primary)]/30 rounded transition-colors"
                title="Play"
              >
                <Play className="w-4 h-4 text-[var(--accent-primary)]" />
              </button>
            )}
            <button
              onClick={handleStepForward}
              disabled={currentCandleIndex >= currentBars.length - 1}
              className="p-2 hover:bg-[var(--bg-tertiary)] rounded transition-colors disabled:opacity-50"
              title="Next Candle"
            >
              <SkipForward className="w-4 h-4 text-[var(--text-secondary)]" />
            </button>
            {showOutcome && (
              <button
                onClick={handleShowAll}
                className="p-2 hover:bg-[var(--bg-tertiary)] rounded transition-colors"
                title="Show Outcome"
              >
                <Eye className="w-4 h-4 text-[var(--text-secondary)]" />
              </button>
            )}
            <div className="px-3 text-xs text-[var(--text-tertiary)] border-l border-[var(--border-primary)]">
              {currentCandleIndex + 1} / {currentBars.length}
            </div>
            <div className="px-2 text-xs text-[var(--text-tertiary)]">
              {playbackSpeed}x
            </div>
          </div>
        )}

        {/* View Controls */}
        <div className="flex items-center gap-1 bg-[var(--bg-secondary)]/95 border border-[var(--border-primary)] rounded-lg p-1 ml-auto">
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
            {showLevels ? (
              <Eye className="w-4 h-4" />
            ) : (
              <EyeOff className="w-4 h-4" />
            )}
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
      </div>

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
