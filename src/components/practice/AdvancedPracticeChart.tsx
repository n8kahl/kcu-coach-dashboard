'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  createChart,
  IChartApi,
  ISeriesApi,
  CandlestickData,
  LineData,
  Time,
  CrosshairMode,
  MouseEventParams,
  LineStyle,
} from 'lightweight-charts';
import { cn } from '@/lib/utils';
import {
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  Eye,
  EyeOff,
  Target,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronRight,
} from 'lucide-react';

// Types
interface ChartCandle {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

interface KeyLevel {
  type: string;
  price: number;
  strength: number;
  label: string;
}

interface UserPlacement {
  entry: number | null;
  stopLoss: number | null;
  target1: number | null;
  target2: number | null;
}

interface AdvancedPracticeChartProps {
  chartData: {
    candles: ChartCandle[];
  };
  keyLevels: KeyLevel[];
  decisionPoint?: {
    price: number;
    time: number;
    context: string;
  };
  outcomeCandles?: ChartCandle[];
  symbol: string;
  timeframe: string;
  showOutcome?: boolean;
  replayMode?: boolean;
  enableInteraction?: boolean;
  onDecisionPointReached?: () => void;
  onPlacementChange?: (placement: UserPlacement) => void;
  className?: string;
}

// KCU Color scheme matching Somesh's methodology
const COLORS = {
  background: '#0a0a0a',
  backgroundSecondary: '#111111',
  text: '#a3a3a3',
  textStrong: '#fafafa',
  grid: '#1a1a1a',
  border: '#262626',

  // Candles
  upColor: '#22c55e',
  downColor: '#ef4444',
  volumeUp: 'rgba(34, 197, 94, 0.4)',
  volumeDown: 'rgba(239, 68, 68, 0.4)',

  // KCU Indicators (per Somesh's methodology)
  ema9: '#3B82F6',        // Blue - Fast EMA
  ema21: '#F97316',       // Orange - Slow EMA
  vwap: '#A855F7',        // Purple - VWAP
  vwapBand: 'rgba(168, 85, 247, 0.1)',
  sma200: '#FFFFFF',      // White - Daily SMA 200

  // Ripster Cloud
  cloudBullish: 'rgba(34, 197, 94, 0.15)',
  cloudBearish: 'rgba(239, 68, 68, 0.15)',

  // Key Levels (per Somesh's drawings)
  pdh: '#FFD700',         // Gold - Previous Day High
  pdl: '#FFD700',         // Gold - Previous Day Low
  orbHigh: '#22c55e',     // Green - ORB High
  orbLow: '#ef4444',      // Red - ORB Low
  premarket: '#EC4899',   // Pink - Premarket levels
  hourly: '#06B6D4',      // Cyan - Hourly levels
  roundNumber: '#6B7280', // Gray - Round numbers

  // User placements
  entry: '#22c55e',
  stopLoss: '#ef4444',
  target: '#3B82F6',

  // Decision point
  decisionPoint: '#F59E0B',
  crosshair: '#525252',
};

// Level type to color mapping
const LEVEL_COLOR_MAP: Record<string, string> = {
  pdh: COLORS.pdh,
  pdl: COLORS.pdl,
  orb_high: COLORS.orbHigh,
  orb_low: COLORS.orbLow,
  premarket_high: COLORS.premarket,
  premarket_low: COLORS.premarket,
  hourly: COLORS.hourly,
  hourly_high: COLORS.hourly,
  hourly_low: COLORS.hourly,
  round_number: COLORS.roundNumber,
  vwap: COLORS.vwap,
  ema: COLORS.ema9,
  support: COLORS.upColor,
  resistance: COLORS.downColor,
};

// Calculate EMA
function calculateEMA(prices: number[], period: number): number[] {
  if (prices.length === 0) return [];
  const ema: number[] = [];
  const multiplier = 2 / (period + 1);
  let sum = 0;

  for (let i = 0; i < period && i < prices.length; i++) {
    sum += prices[i];
    ema.push(sum / (i + 1));
  }

  for (let i = period; i < prices.length; i++) {
    const value = (prices[i] - ema[i - 1]) * multiplier + ema[i - 1];
    ema.push(value);
  }

  return ema;
}

// Calculate VWAP with bands
function calculateVWAP(candles: ChartCandle[]): { vwap: number[]; upper1: number[]; lower1: number[]; upper2: number[]; lower2: number[] } {
  if (candles.length === 0) {
    return { vwap: [], upper1: [], lower1: [], upper2: [], lower2: [] };
  }

  const vwapValues: number[] = [];
  const upper1: number[] = [];
  const lower1: number[] = [];
  const upper2: number[] = [];
  const lower2: number[] = [];

  let cumulativeTPV = 0;
  let cumulativeVolume = 0;
  let lastDate: string | null = null;
  const deviations: number[] = [];

  candles.forEach((candle, i) => {
    const barDate = new Date(candle.t).toISOString().split('T')[0];

    // Reset at new day
    if (lastDate !== null && barDate !== lastDate) {
      cumulativeTPV = 0;
      cumulativeVolume = 0;
      deviations.length = 0;
    }
    lastDate = barDate;

    const typicalPrice = (candle.h + candle.l + candle.c) / 3;
    cumulativeTPV += typicalPrice * candle.v;
    cumulativeVolume += candle.v;

    const vwap = cumulativeVolume > 0 ? cumulativeTPV / cumulativeVolume : typicalPrice;
    vwapValues.push(vwap);

    // Calculate standard deviation
    deviations.push(Math.pow(typicalPrice - vwap, 2));
    const variance = deviations.reduce((a, b) => a + b, 0) / deviations.length;
    const stdDev = Math.sqrt(variance);

    upper1.push(vwap + stdDev);
    lower1.push(vwap - stdDev);
    upper2.push(vwap + 2 * stdDev);
    lower2.push(vwap - 2 * stdDev);
  });

  return { vwap: vwapValues, upper1, lower1, upper2, lower2 };
}

// Minimum candles to display
const MIN_VISIBLE_CANDLES = 100;
const DEFAULT_CANDLES = 150;

export function AdvancedPracticeChart({
  chartData,
  keyLevels,
  decisionPoint,
  outcomeCandles,
  symbol,
  timeframe,
  showOutcome = false,
  replayMode = false,
  enableInteraction = false,
  onDecisionPointReached,
  onPlacementChange,
  className,
}: AdvancedPracticeChartProps) {
  // Refs
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const ema9SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const ema21SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const vwapSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const levelSeriesRef = useRef<ISeriesApi<'Line'>[]>([]);

  // State
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [currentCandleIndex, setCurrentCandleIndex] = useState(
    replayMode ? Math.min(20, chartData.candles.length - 1) : chartData.candles.length - 1
  );
  const [showIndicators, setShowIndicators] = useState(true);
  const [showLevels, setShowLevels] = useState(true);
  const [decisionReached, setDecisionReached] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hoveredPrice, setHoveredPrice] = useState<number | null>(null);
  const [interactionMode, setInteractionMode] = useState<'entry' | 'stop' | 'target1' | 'target2' | null>(null);
  const [userPlacements, setUserPlacements] = useState<UserPlacement>({
    entry: null,
    stopLoss: null,
    target1: null,
    target2: null,
  });

  const playIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Memoized calculations
  const visibleCandles = useMemo(() => {
    return chartData.candles.slice(0, currentCandleIndex + 1);
  }, [chartData.candles, currentCandleIndex]);

  const closes = useMemo(() => visibleCandles.map(c => c.c), [visibleCandles]);
  const timestamps = useMemo(() => visibleCandles.map(c => c.t), [visibleCandles]);

  const ema9Data = useMemo(() => calculateEMA(closes, 9), [closes]);
  const ema21Data = useMemo(() => calculateEMA(closes, 21), [closes]);
  const vwapData = useMemo(() => calculateVWAP(visibleCandles), [visibleCandles]);

  // Risk/Reward calculation
  const riskReward = useMemo(() => {
    if (!userPlacements.entry || !userPlacements.stopLoss || !userPlacements.target1) {
      return null;
    }
    const risk = Math.abs(userPlacements.entry - userPlacements.stopLoss);
    const reward = Math.abs(userPlacements.target1 - userPlacements.entry);
    return reward / risk;
  }, [userPlacements]);

  // Format candle data
  const formatCandles = useCallback((candles: ChartCandle[]): CandlestickData[] => {
    return candles.map(candle => ({
      time: (candle.t / 1000) as Time,
      open: candle.o,
      high: candle.h,
      low: candle.l,
      close: candle.c,
    }));
  }, []);

  // Format volume data
  const formatVolume = useCallback((candles: ChartCandle[]) => {
    return candles.map(candle => ({
      time: (candle.t / 1000) as Time,
      value: candle.v,
      color: candle.c >= candle.o ? COLORS.volumeUp : COLORS.volumeDown,
    }));
  }, []);

  // Format indicator line data
  const formatLineData = useCallback((values: number[], timestamps: number[]): LineData[] => {
    return values
      .map((value, i) => ({
        time: (timestamps[i] / 1000) as Time,
        value,
      }))
      .filter(d => d.value != null && isFinite(d.value) && d.value > 0);
  }, []);

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    setIsLoading(true);

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: COLORS.background },
        textColor: COLORS.text,
      },
      grid: {
        vertLines: { color: COLORS.grid, style: LineStyle.Dotted },
        horzLines: { color: COLORS.grid, style: LineStyle.Dotted },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: COLORS.crosshair, width: 1, style: LineStyle.Dashed },
        horzLine: { color: COLORS.crosshair, width: 1, style: LineStyle.Dashed, labelBackgroundColor: COLORS.backgroundSecondary },
      },
      rightPriceScale: {
        borderColor: COLORS.border,
        scaleMargins: { top: 0.05, bottom: 0.2 },
      },
      timeScale: {
        borderColor: COLORS.border,
        timeVisible: true,
        secondsVisible: false,
        barSpacing: 8,
        minBarSpacing: 4,
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
      handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
    });

    // Add candlestick series
    const candleSeries = chart.addCandlestickSeries({
      upColor: COLORS.upColor,
      downColor: COLORS.downColor,
      wickUpColor: COLORS.upColor,
      wickDownColor: COLORS.downColor,
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

    // Add EMA 9 (Blue - Fast)
    const ema9Series = chart.addLineSeries({
      color: COLORS.ema9,
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
      title: 'EMA 9',
    });

    // Add EMA 21 (Orange - Slow)
    const ema21Series = chart.addLineSeries({
      color: COLORS.ema21,
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
      title: 'EMA 21',
    });

    // Add VWAP (Purple)
    const vwapSeries = chart.addLineSeries({
      color: COLORS.vwap,
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
      title: 'VWAP',
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;
    ema9SeriesRef.current = ema9Series;
    ema21SeriesRef.current = ema21Series;
    vwapSeriesRef.current = vwapSeries;

    // Crosshair move handler for interaction
    chart.subscribeCrosshairMove((param: MouseEventParams) => {
      if (param.point && param.seriesData) {
        const price = candleSeries.coordinateToPrice(param.point.y);
        if (price !== null) {
          setHoveredPrice(price);
        }
      }
    });

    // Click handler for placing levels
    if (enableInteraction) {
      chart.subscribeClick((param: MouseEventParams) => {
        if (param.point && interactionMode) {
          const price = candleSeries.coordinateToPrice(param.point.y);
          if (price !== null) {
            const roundedPrice = Math.round(price * 100) / 100;
            setUserPlacements(prev => {
              const newPlacements = { ...prev };
              switch (interactionMode) {
                case 'entry':
                  newPlacements.entry = roundedPrice;
                  break;
                case 'stop':
                  newPlacements.stopLoss = roundedPrice;
                  break;
                case 'target1':
                  newPlacements.target1 = roundedPrice;
                  break;
                case 'target2':
                  newPlacements.target2 = roundedPrice;
                  break;
              }
              onPlacementChange?.(newPlacements);
              return newPlacements;
            });
            setInteractionMode(null);
          }
        }
      });
    }

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    });
    resizeObserver.observe(chartContainerRef.current);

    setIsLoading(false);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      ema9SeriesRef.current = null;
      ema21SeriesRef.current = null;
      vwapSeriesRef.current = null;
      levelSeriesRef.current = [];
    };
  }, [enableInteraction, interactionMode, onPlacementChange]);

  // Update chart data
  useEffect(() => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current) return;

    const candleData = formatCandles(visibleCandles);
    const volumeData = formatVolume(visibleCandles);

    candleSeriesRef.current.setData(candleData);
    volumeSeriesRef.current.setData(volumeData);

    // Update indicators
    if (showIndicators) {
      if (ema9SeriesRef.current) {
        ema9SeriesRef.current.setData(formatLineData(ema9Data, timestamps));
      }
      if (ema21SeriesRef.current) {
        ema21SeriesRef.current.setData(formatLineData(ema21Data, timestamps));
      }
      if (vwapSeriesRef.current) {
        vwapSeriesRef.current.setData(formatLineData(vwapData.vwap, timestamps));
      }
    }

    // Check decision point
    if (decisionPoint && !decisionReached) {
      const currentCandle = chartData.candles[currentCandleIndex];
      if (currentCandle && currentCandle.t >= decisionPoint.time) {
        setDecisionReached(true);
        setIsPlaying(false);
        onDecisionPointReached?.();
      }
    }
  }, [visibleCandles, ema9Data, ema21Data, vwapData, timestamps, showIndicators, formatCandles, formatVolume, formatLineData, decisionPoint, decisionReached, currentCandleIndex, chartData.candles, onDecisionPointReached]);

  // Update key levels
  useEffect(() => {
    if (!chartRef.current) return;

    // Clear existing level lines
    levelSeriesRef.current.forEach(series => {
      try {
        chartRef.current?.removeSeries(series);
      } catch {
        // Already removed
      }
    });
    levelSeriesRef.current = [];

    if (!showLevels || visibleCandles.length === 0) return;

    const startTime = visibleCandles[0].t / 1000;
    const endTime = visibleCandles[visibleCandles.length - 1].t / 1000;

    keyLevels.forEach(level => {
      // Skip levels with invalid prices
      if (level.price == null || !isFinite(level.price) || level.price <= 0) return;

      const color = LEVEL_COLOR_MAP[level.type] || COLORS.text;
      const lineStyle = level.strength >= 70 ? LineStyle.Solid : LineStyle.Dashed;

      const lineSeries = chartRef.current!.addLineSeries({
        color,
        lineWidth: level.strength >= 80 ? 2 : 1,
        lineStyle,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });

      // Handle duplicate timestamps (single candle case)
      const lineData = startTime === endTime
        ? [{ time: startTime as Time, value: level.price }]
        : [
            { time: startTime as Time, value: level.price },
            { time: endTime as Time, value: level.price },
          ];
      lineSeries.setData(lineData);

      levelSeriesRef.current.push(lineSeries);
    });

    // Add user placement lines
    if (enableInteraction) {
      const addPlacementLine = (price: number | null, color: string, label: string) => {
        if (price === null || !isFinite(price) || price <= 0) return;
        const lineSeries = chartRef.current!.addLineSeries({
          color,
          lineWidth: 2,
          lineStyle: LineStyle.Dashed,
          priceLineVisible: true,
          lastValueVisible: true,
          crosshairMarkerVisible: false,
          title: label,
        });
        // Handle duplicate timestamps (single candle case)
        const lineData = startTime === endTime
          ? [{ time: startTime as Time, value: price }]
          : [
              { time: startTime as Time, value: price },
              { time: endTime as Time, value: price },
            ];
        lineSeries.setData(lineData);
        levelSeriesRef.current.push(lineSeries);
      };

      addPlacementLine(userPlacements.entry, COLORS.entry, 'ENTRY');
      addPlacementLine(userPlacements.stopLoss, COLORS.stopLoss, 'STOP');
      addPlacementLine(userPlacements.target1, COLORS.target, 'T1');
      addPlacementLine(userPlacements.target2, COLORS.target, 'T2');
    }
  }, [showLevels, keyLevels, visibleCandles, enableInteraction, userPlacements]);

  // Fit content initially
  useEffect(() => {
    if (chartRef.current && visibleCandles.length > 0) {
      chartRef.current.timeScale().fitContent();
    }
  }, [visibleCandles.length > 0]);

  // Playback controls
  const togglePlayback = useCallback(() => {
    if (isPlaying) {
      setIsPlaying(false);
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
      }
    } else {
      setIsPlaying(true);
      playIntervalRef.current = setInterval(() => {
        setCurrentCandleIndex(prev => {
          const next = prev + 1;
          if (next >= chartData.candles.length) {
            setIsPlaying(false);
            if (playIntervalRef.current) {
              clearInterval(playIntervalRef.current);
            }
            return prev;
          }
          return next;
        });
      }, 500 / playbackSpeed);
    }
  }, [isPlaying, chartData.candles.length, playbackSpeed]);

  const stepForward = useCallback(() => {
    setCurrentCandleIndex(prev => Math.min(prev + 1, chartData.candles.length - 1));
  }, [chartData.candles.length]);

  const reset = useCallback(() => {
    setCurrentCandleIndex(replayMode ? Math.min(20, chartData.candles.length - 1) : 0);
    setDecisionReached(false);
    setIsPlaying(false);
  }, [replayMode, chartData.candles.length]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
      }
    };
  }, []);

  // Current price info
  const currentCandle = visibleCandles[visibleCandles.length - 1];
  const priceChange = currentCandle && visibleCandles.length > 1
    ? ((currentCandle.c - visibleCandles[visibleCandles.length - 2].c) / visibleCandles[visibleCandles.length - 2].c) * 100
    : 0;

  return (
    <div className={cn('relative bg-[var(--bg-primary)] border border-[var(--border-primary)] overflow-hidden', className)}>
      {/* Loading overlay */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-[var(--bg-primary)]"
          >
            <div className="animate-pulse text-[var(--text-tertiary)]">Loading chart...</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chart Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border-primary)] bg-[var(--bg-secondary)]">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[var(--text-primary)]">{symbol}</span>
            <span className="text-sm text-[var(--text-tertiary)]">{timeframe}</span>
          </div>
          {currentCandle && (
            <div className="flex items-center gap-3 text-sm">
              <span className="text-[var(--text-primary)] font-mono">${currentCandle.c.toFixed(2)}</span>
              <span className={cn(
                'font-mono',
                priceChange >= 0 ? 'text-[var(--profit)]' : 'text-[var(--loss)]'
              )}>
                {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Indicator toggles */}
          <button
            onClick={() => setShowIndicators(!showIndicators)}
            className={cn(
              'p-1.5 rounded transition-colors text-sm',
              showIndicators
                ? 'bg-[var(--accent-primary)]/20 text-[var(--accent-primary)]'
                : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
            )}
            title="Toggle Indicators"
          >
            <TrendingUp className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowLevels(!showLevels)}
            className={cn(
              'p-1.5 rounded transition-colors',
              showLevels
                ? 'bg-[var(--accent-primary)]/20 text-[var(--accent-primary)]'
                : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
            )}
            title="Toggle Levels"
          >
            {showLevels ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main Chart Area */}
      <div className="relative flex">
        {/* Chart */}
        <div
          ref={chartContainerRef}
          className={cn(
            'flex-1 h-[450px]',
            interactionMode && 'cursor-crosshair'
          )}
        />

        {/* Key Levels Panel */}
        {showLevels && keyLevels.length > 0 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="w-36 border-l border-[var(--border-primary)] bg-[var(--bg-secondary)] overflow-y-auto"
          >
            <div className="p-2">
              <div className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] mb-2">
                Key Levels
              </div>
              <div className="space-y-1">
                {keyLevels.slice(0, 8).map((level, idx) => {
                  const color = LEVEL_COLOR_MAP[level.type] || COLORS.text;
                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-xs py-1 px-1 rounded hover:bg-[var(--bg-tertiary)] transition-colors"
                    >
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                        <span className="text-[var(--text-secondary)] truncate max-w-[50px]">{level.label}</span>
                      </div>
                      <span className="font-mono text-[var(--text-primary)]">${level.price.toFixed(2)}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Indicators Legend */}
            {showIndicators && (
              <div className="p-2 border-t border-[var(--border-primary)]">
                <div className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] mb-2">
                  Indicators
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-0.5" style={{ backgroundColor: COLORS.ema9 }} />
                    <span className="text-[var(--text-secondary)]">EMA 9</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-0.5" style={{ backgroundColor: COLORS.ema21 }} />
                    <span className="text-[var(--text-secondary)]">EMA 21</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-0.5" style={{ backgroundColor: COLORS.vwap }} />
                    <span className="text-[var(--text-secondary)]">VWAP</span>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* Interaction Tools */}
      {enableInteraction && (
        <div className="px-4 py-2 border-t border-[var(--border-primary)] bg-[var(--bg-secondary)]">
          <div className="flex items-center gap-4">
            <span className="text-xs text-[var(--text-tertiary)]">Click to place:</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setInteractionMode(interactionMode === 'entry' ? null : 'entry')}
                className={cn(
                  'px-2 py-1 text-xs rounded border transition-all',
                  interactionMode === 'entry'
                    ? 'bg-[var(--profit)]/20 border-[var(--profit)] text-[var(--profit)]'
                    : 'border-[var(--border-primary)] text-[var(--text-secondary)] hover:border-[var(--profit)]'
                )}
              >
                Entry {userPlacements.entry && `$${userPlacements.entry.toFixed(2)}`}
              </button>
              <button
                onClick={() => setInteractionMode(interactionMode === 'stop' ? null : 'stop')}
                className={cn(
                  'px-2 py-1 text-xs rounded border transition-all',
                  interactionMode === 'stop'
                    ? 'bg-[var(--loss)]/20 border-[var(--loss)] text-[var(--loss)]'
                    : 'border-[var(--border-primary)] text-[var(--text-secondary)] hover:border-[var(--loss)]'
                )}
              >
                Stop {userPlacements.stopLoss && `$${userPlacements.stopLoss.toFixed(2)}`}
              </button>
              <button
                onClick={() => setInteractionMode(interactionMode === 'target1' ? null : 'target1')}
                className={cn(
                  'px-2 py-1 text-xs rounded border transition-all',
                  interactionMode === 'target1'
                    ? 'bg-[var(--accent-primary)]/20 border-[var(--accent-primary)] text-[var(--accent-primary)]'
                    : 'border-[var(--border-primary)] text-[var(--text-secondary)] hover:border-[var(--accent-primary)]'
                )}
              >
                Target {userPlacements.target1 && `$${userPlacements.target1.toFixed(2)}`}
              </button>
            </div>

            {riskReward && (
              <div className="flex items-center gap-2 ml-auto">
                <span className="text-xs text-[var(--text-tertiary)]">R:R</span>
                <span className={cn(
                  'text-sm font-mono font-bold',
                  riskReward >= 2 ? 'text-[var(--profit)]' : riskReward >= 1 ? 'text-[var(--warning)]' : 'text-[var(--loss)]'
                )}>
                  1:{riskReward.toFixed(1)}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Playback Controls (Replay Mode) */}
      {replayMode && (
        <div className="px-4 py-2 border-t border-[var(--border-primary)] bg-[var(--bg-secondary)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={togglePlayback}
                className="p-2 rounded bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary)]/80 transition-colors"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>
              <button
                onClick={stepForward}
                disabled={currentCandleIndex >= chartData.candles.length - 1}
                className="p-2 rounded bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-white disabled:opacity-50 transition-colors"
              >
                <SkipForward className="w-4 h-4" />
              </button>
              <button
                onClick={reset}
                className="p-2 rounded bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-white transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--text-tertiary)]">Speed:</span>
                {[1, 2, 5, 10].map(speed => (
                  <button
                    key={speed}
                    onClick={() => setPlaybackSpeed(speed)}
                    className={cn(
                      'px-2 py-0.5 text-xs rounded transition-colors',
                      playbackSpeed === speed
                        ? 'bg-[var(--accent-primary)] text-white'
                        : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-white'
                    )}
                  >
                    {speed}x
                  </button>
                ))}
              </div>

              <div className="text-xs text-[var(--text-tertiary)]">
                Candle {currentCandleIndex + 1} / {chartData.candles.length}
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-2 h-1 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-[var(--accent-primary)]"
              initial={{ width: 0 }}
              animate={{ width: `${((currentCandleIndex + 1) / chartData.candles.length) * 100}%` }}
              transition={{ duration: 0.1 }}
            />
          </div>
        </div>
      )}

      {/* Decision Point Indicator */}
      {decisionPoint && decisionReached && !showOutcome && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute bottom-20 left-1/2 -translate-x-1/2 px-4 py-2 bg-[var(--warning)]/20 border border-[var(--warning)] text-[var(--warning)] rounded-lg text-sm font-medium"
        >
          Decision Point Reached - Make Your Trade Decision
        </motion.div>
      )}
    </div>
  );
}

export default AdvancedPracticeChart;
