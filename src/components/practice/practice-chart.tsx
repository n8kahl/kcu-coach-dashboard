'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, IChartApi, ISeriesApi, CandlestickData, LineData, Time } from 'lightweight-charts';
import { cn } from '@/lib/utils';
import { Play, Pause, SkipForward, RotateCcw, Eye, EyeOff, ZoomIn, ZoomOut } from 'lucide-react';

interface KeyLevel {
  type: string;
  price: number;
  strength: number;
  label: string;
}

interface ChartCandle {
  t: number; // timestamp in ms
  o: number; // open
  h: number; // high
  l: number; // low
  c: number; // close
  v: number; // volume
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
}

// Color scheme matching the app theme
const CHART_COLORS = {
  background: '#0a0a0a',
  text: '#a3a3a3',
  textStrong: '#fafafa',
  grid: '#262626',
  border: '#404040',
  upColor: '#22c55e',
  downColor: '#ef4444',
  wickUp: '#22c55e',
  wickDown: '#ef4444',
  volumeUp: 'rgba(34, 197, 94, 0.3)',
  volumeDown: 'rgba(239, 68, 68, 0.3)',
  crosshair: '#737373',
  // Level colors
  support: '#22c55e',
  resistance: '#ef4444',
  vwap: '#f59e0b',
  ema: '#3b82f6',
  target: '#22c55e',
  stop: '#ef4444',
  decisionPoint: '#f59e0b',
};

const LEVEL_COLORS: Record<string, string> = {
  support: CHART_COLORS.support,
  resistance: CHART_COLORS.resistance,
  vwap: CHART_COLORS.vwap,
  ema: CHART_COLORS.ema,
  daily_support: CHART_COLORS.support,
  daily_resistance: CHART_COLORS.resistance,
  demand_zone: CHART_COLORS.support,
  supply_zone: CHART_COLORS.resistance,
  premarket_high: CHART_COLORS.resistance,
  premarket_low: CHART_COLORS.support,
  gap_top: CHART_COLORS.resistance,
  gap_fill: CHART_COLORS.support,
  orb_high: CHART_COLORS.resistance,
  orb_low: CHART_COLORS.support,
  max_pain: CHART_COLORS.vwap,
  round_number: '#9333ea',
  breakout: CHART_COLORS.support,
  neckline: CHART_COLORS.vwap,
  double_bottom: CHART_COLORS.support,
  swing_low: CHART_COLORS.support,
  broken_resistance: CHART_COLORS.support,
  previous_close: CHART_COLORS.ema,
  gap_low: CHART_COLORS.support,
  fib_50: CHART_COLORS.vwap,
  spike_high: CHART_COLORS.resistance,
  range_high: CHART_COLORS.resistance,
  range_low: CHART_COLORS.support,
  call_wall: CHART_COLORS.resistance,
  put_wall: CHART_COLORS.support,
  liquidity: '#ec4899',
  sweep_high: '#ec4899',
  trap_low: CHART_COLORS.support,
  divergence: '#8b5cf6',
  open: CHART_COLORS.ema,
  extension: '#9333ea',
  default: CHART_COLORS.text,
};

export function PracticeChart({
  chartData,
  keyLevels,
  decisionPoint,
  outcomeData,
  symbol,
  timeframe,
  showOutcome = false,
  replayMode = false,
  onDecisionPointReached,
  className,
}: PracticeChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const levelLinesRef = useRef<ISeriesApi<'Line'>[]>([]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentCandleIndex, setCurrentCandleIndex] = useState(
    replayMode ? Math.min(4, chartData.candles.length - 1) : chartData.candles.length - 1
  );
  const [showLevels, setShowLevels] = useState(true);
  const [decisionReached, setDecisionReached] = useState(false);
  const playIntervalRef = useRef<NodeJS.Timeout | null>(null);

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
      },
      grid: {
        vertLines: { color: CHART_COLORS.grid },
        horzLines: { color: CHART_COLORS.grid },
      },
      crosshair: {
        mode: 1,
        vertLine: {
          color: CHART_COLORS.crosshair,
          width: 1,
          style: 2,
        },
        horzLine: {
          color: CHART_COLORS.crosshair,
          width: 1,
          style: 2,
        },
      },
      rightPriceScale: {
        borderColor: CHART_COLORS.border,
        scaleMargins: {
          top: 0.1,
          bottom: 0.2,
        },
      },
      timeScale: {
        borderColor: CHART_COLORS.border,
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
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
    const initialCandles = formatCandles(chartData.candles, currentCandleIndex);
    const initialVolume = formatVolume(chartData.candles, currentCandleIndex);
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

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      levelLinesRef.current = [];
    };
  }, []);

  // Update chart data when candle index changes
  useEffect(() => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current) return;

    const candles = formatCandles(chartData.candles, currentCandleIndex);
    const volume = formatVolume(chartData.candles, currentCandleIndex);

    candleSeriesRef.current.setData(candles);
    volumeSeriesRef.current.setData(volume);

    // Check if we've reached the decision point
    if (decisionPoint && !decisionReached) {
      const currentCandle = chartData.candles[currentCandleIndex];
      if (currentCandle && currentCandle.t >= decisionPoint.time) {
        setDecisionReached(true);
        setIsPlaying(false);
        onDecisionPointReached?.();
      }
    }
  }, [currentCandleIndex, chartData.candles, formatCandles, formatVolume, decisionPoint, decisionReached, onDecisionPointReached]);

  // Add key level lines
  useEffect(() => {
    if (!chartRef.current || !showLevels) {
      // Remove existing lines
      levelLinesRef.current.forEach(line => {
        try {
          chartRef.current?.removeSeries(line);
        } catch {
          // Series may already be removed
        }
      });
      levelLinesRef.current = [];
      return;
    }

    // Remove existing lines
    levelLinesRef.current.forEach(line => {
      try {
        chartRef.current?.removeSeries(line);
      } catch {
        // Series may already be removed
      }
    });
    levelLinesRef.current = [];

    // Add new lines for each level
    const visibleCandles = chartData.candles.slice(0, currentCandleIndex + 1);
    if (visibleCandles.length === 0) return;

    const startTime = visibleCandles[0].t / 1000;
    const endTime = visibleCandles[visibleCandles.length - 1].t / 1000;

    keyLevels.forEach(level => {
      const color = LEVEL_COLORS[level.type] || LEVEL_COLORS.default;

      const lineSeries = chartRef.current!.addLineSeries({
        color,
        lineWidth: level.strength >= 80 ? 2 : 1,
        lineStyle: level.strength >= 70 ? 0 : 2, // Solid for strong, dashed for weak
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

    // Add decision point marker if exists
    if (decisionPoint && showOutcome) {
      const markerSeries = chartRef.current.addLineSeries({
        color: CHART_COLORS.decisionPoint,
        lineWidth: 2,
        lineStyle: 1,
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
  }, [keyLevels, showLevels, chartData.candles, currentCandleIndex, decisionPoint, showOutcome]);

  // Replay controls
  const handlePlay = useCallback(() => {
    if (currentCandleIndex >= chartData.candles.length - 1) {
      setCurrentCandleIndex(Math.min(4, chartData.candles.length - 1));
      setDecisionReached(false);
    }
    setIsPlaying(true);
  }, [currentCandleIndex, chartData.candles.length]);

  const handlePause = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const handleStepForward = useCallback(() => {
    if (currentCandleIndex < chartData.candles.length - 1) {
      setCurrentCandleIndex(prev => prev + 1);
    }
  }, [currentCandleIndex, chartData.candles.length]);

  const handleReset = useCallback(() => {
    setIsPlaying(false);
    setCurrentCandleIndex(Math.min(4, chartData.candles.length - 1));
    setDecisionReached(false);
  }, [chartData.candles.length]);

  const handleShowAll = useCallback(() => {
    setIsPlaying(false);
    setCurrentCandleIndex(chartData.candles.length - 1);
  }, [chartData.candles.length]);

  // Auto-play effect
  useEffect(() => {
    if (isPlaying) {
      playIntervalRef.current = setInterval(() => {
        setCurrentCandleIndex(prev => {
          if (prev >= chartData.candles.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 800); // 800ms per candle
    } else {
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
  }, [isPlaying, chartData.candles.length]);

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

  return (
    <div className={cn('relative bg-[var(--bg-primary)] border border-[var(--border-primary)]', className)}>
      {/* Chart Header */}
      <div className="absolute top-2 left-2 z-10 flex items-center gap-2">
        <span className="px-2 py-1 bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm font-bold">
          {symbol}
        </span>
        <span className="px-2 py-1 bg-[var(--bg-tertiary)] text-[var(--text-secondary)] text-xs">
          {timeframe}
        </span>
        {decisionReached && !showOutcome && (
          <span className="px-2 py-1 bg-[var(--accent-primary)] text-[var(--bg-primary)] text-xs font-semibold animate-pulse">
            DECISION POINT
          </span>
        )}
      </div>

      {/* Chart Container */}
      <div ref={chartContainerRef} className="w-full h-[400px]" />

      {/* Key Levels Legend */}
      {showLevels && keyLevels.length > 0 && (
        <div className="absolute top-2 right-2 z-10 bg-[var(--bg-secondary)]/90 border border-[var(--border-primary)] p-2 max-w-[200px]">
          <div className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider mb-1">Key Levels</div>
          <div className="space-y-1">
            {keyLevels.slice(0, 5).map((level, idx) => (
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
      <div className="absolute bottom-2 left-2 right-2 z-10 flex items-center justify-between">
        {/* Replay Controls */}
        {replayMode && (
          <div className="flex items-center gap-1 bg-[var(--bg-secondary)]/90 border border-[var(--border-primary)] p-1">
            <button
              onClick={handleReset}
              className="p-1.5 hover:bg-[var(--bg-tertiary)] transition-colors"
              title="Reset"
            >
              <RotateCcw className="w-4 h-4 text-[var(--text-secondary)]" />
            </button>
            {isPlaying ? (
              <button
                onClick={handlePause}
                className="p-1.5 hover:bg-[var(--bg-tertiary)] transition-colors"
                title="Pause"
              >
                <Pause className="w-4 h-4 text-[var(--text-secondary)]" />
              </button>
            ) : (
              <button
                onClick={handlePlay}
                className="p-1.5 hover:bg-[var(--bg-tertiary)] transition-colors"
                title="Play"
              >
                <Play className="w-4 h-4 text-[var(--text-secondary)]" />
              </button>
            )}
            <button
              onClick={handleStepForward}
              disabled={currentCandleIndex >= chartData.candles.length - 1}
              className="p-1.5 hover:bg-[var(--bg-tertiary)] transition-colors disabled:opacity-50"
              title="Next Candle"
            >
              <SkipForward className="w-4 h-4 text-[var(--text-secondary)]" />
            </button>
            {showOutcome && (
              <button
                onClick={handleShowAll}
                className="p-1.5 hover:bg-[var(--bg-tertiary)] transition-colors"
                title="Show Outcome"
              >
                <Eye className="w-4 h-4 text-[var(--text-secondary)]" />
              </button>
            )}
            <div className="px-2 text-xs text-[var(--text-tertiary)]">
              {currentCandleIndex + 1} / {chartData.candles.length}
            </div>
          </div>
        )}

        {/* View Controls */}
        <div className="flex items-center gap-1 bg-[var(--bg-secondary)]/90 border border-[var(--border-primary)] p-1 ml-auto">
          <button
            onClick={() => setShowLevels(!showLevels)}
            className={cn(
              'p-1.5 transition-colors',
              showLevels ? 'bg-[var(--accent-primary)]/20 text-[var(--accent-primary)]' : 'hover:bg-[var(--bg-tertiary)]'
            )}
            title={showLevels ? 'Hide Levels' : 'Show Levels'}
          >
            {showLevels ? (
              <Eye className="w-4 h-4" />
            ) : (
              <EyeOff className="w-4 h-4 text-[var(--text-secondary)]" />
            )}
          </button>
          <button
            onClick={handleZoomIn}
            className="p-1.5 hover:bg-[var(--bg-tertiary)] transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4 text-[var(--text-secondary)]" />
          </button>
          <button
            onClick={handleZoomOut}
            className="p-1.5 hover:bg-[var(--bg-tertiary)] transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4 text-[var(--text-secondary)]" />
          </button>
        </div>
      </div>

      {/* Outcome Overlay */}
      {showOutcome && outcomeData && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-20">
          <div className={cn(
            'px-6 py-4 text-center',
            outcomeData.result === 'win' ? 'bg-[var(--success)]/20 border-2 border-[var(--success)]' :
            outcomeData.result === 'avoided_loss' || outcomeData.result === 'correct_wait' ? 'bg-[var(--accent-primary)]/20 border-2 border-[var(--accent-primary)]' :
            'bg-[var(--error)]/20 border-2 border-[var(--error)]'
          )}>
            <div className={cn(
              'text-2xl font-bold mb-1',
              outcomeData.result === 'win' ? 'text-[var(--success)]' :
              outcomeData.result === 'avoided_loss' || outcomeData.result === 'correct_wait' ? 'text-[var(--accent-primary)]' :
              'text-[var(--error)]'
            )}>
              {outcomeData.result === 'win' ? 'WIN' :
               outcomeData.result === 'avoided_loss' ? 'LOSS AVOIDED' :
               outcomeData.result === 'correct_wait' ? 'CORRECT WAIT' :
               'LOSS'}
            </div>
            {outcomeData.pnl_percent !== undefined && (
              <div className="text-lg text-[var(--text-primary)]">
                {outcomeData.pnl_percent > 0 ? '+' : ''}{outcomeData.pnl_percent.toFixed(2)}%
              </div>
            )}
            {outcomeData.exit_price !== undefined && (
              <div className="text-sm text-[var(--text-secondary)]">
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
