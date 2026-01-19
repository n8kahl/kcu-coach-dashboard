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
  MouseEventParams,
} from 'lightweight-charts';
import { cn } from '@/lib/utils';
import { calculateEMARibbon, RibbonData, Bar } from '@/lib/practice/indicators';
import { detectPatienceCandles, PatienceCandle, KeyLevel } from '@/lib/practice/patience-detection';
import { LEVEL_STYLES } from '@/lib/practice/levels';
import { Eye, EyeOff, Maximize2, Minimize2 } from 'lucide-react';

interface ChartPane {
  id: string;
  timeframe: string;
  label: string;
  bars: Bar[];
  height: number;
  showVolume?: boolean;
  showRibbon?: boolean;
  showPatienceMarkers?: boolean;
}

interface ChartGridProps {
  symbol: string;
  dailyBars: Bar[];
  hourlyBars: Bar[];
  fifteenMinBars: Bar[];
  fiveMinBars: Bar[];
  twoMinBars: Bar[];
  keyLevels: KeyLevel[];
  decisionPoint?: { time: number; price: number };
  showOutcome?: boolean;
  onTimeframeHover?: (time: number | null) => void;
  className?: string;
}

// Chart colors
const COLORS = {
  background: '#0a0a0a',
  text: '#a3a3a3',
  textStrong: '#fafafa',
  grid: '#1f1f1f',
  border: '#262626',
  upColor: '#22c55e',
  downColor: '#ef4444',
  volumeUp: 'rgba(34, 197, 94, 0.3)',
  volumeDown: 'rgba(239, 68, 68, 0.3)',
  crosshair: '#525252',
  ema9: '#3b82f6',
  ema21: '#f97316',
  vwap: '#9333ea',
  ribbonBullish: 'rgba(34, 197, 94, 0.15)',
  ribbonBearish: 'rgba(239, 68, 68, 0.15)',
  ribbonNeutral: 'rgba(107, 114, 128, 0.1)',
  patienceMarker: '#f59e0b',
};

export function ChartGrid({
  symbol,
  dailyBars,
  hourlyBars,
  fifteenMinBars,
  fiveMinBars,
  twoMinBars,
  keyLevels,
  decisionPoint,
  showOutcome = false,
  onTimeframeHover,
  className,
}: ChartGridProps) {
  const [showLevels, setShowLevels] = useState(true);
  const [expandedPane, setExpandedPane] = useState<string | null>(null);
  const [hoveredTime, setHoveredTime] = useState<number | null>(null);

  const chartsRef = useRef<Map<string, { chart: IChartApi; candleSeries: ISeriesApi<'Candlestick'> }>>(
    new Map()
  );
  const containerRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());

  // Define chart panes configuration
  const panes: ChartPane[] = [
    {
      id: 'daily',
      timeframe: 'D',
      label: 'Daily (Structure)',
      bars: dailyBars,
      height: 180,
      showVolume: false,
      showRibbon: false,
    },
    {
      id: 'hourly',
      timeframe: '1H',
      label: '60-min (Context)',
      bars: hourlyBars,
      height: 180,
      showVolume: false,
      showRibbon: false,
    },
    {
      id: 'fifteen',
      timeframe: '15m',
      label: '15-min (Setup)',
      bars: fifteenMinBars,
      height: 180,
      showVolume: false,
      showRibbon: true,
    },
    {
      id: 'five',
      timeframe: '5m',
      label: '5-min (Confirmation)',
      bars: fiveMinBars,
      height: 240,
      showVolume: true,
      showRibbon: true,
      showPatienceMarkers: true,
    },
    {
      id: 'two',
      timeframe: '2m',
      label: '2-min (Entry)',
      bars: twoMinBars,
      height: 240,
      showVolume: true,
      showRibbon: false,
      showPatienceMarkers: true,
    },
  ];

  // Format bars for lightweight-charts
  const formatBars = useCallback((bars: Bar[]): CandlestickData[] => {
    return bars.map((bar) => ({
      time: (bar.t / 1000) as Time,
      open: bar.o,
      high: bar.h,
      low: bar.l,
      close: bar.c,
    }));
  }, []);

  // Initialize a single chart
  const initializeChart = useCallback(
    (pane: ChartPane, container: HTMLDivElement) => {
      // Clean up existing chart
      const existing = chartsRef.current.get(pane.id);
      if (existing) {
        existing.chart.remove();
      }

      const chart = createChart(container, {
        layout: {
          background: { color: COLORS.background },
          textColor: COLORS.text,
        },
        grid: {
          vertLines: { color: COLORS.grid },
          horzLines: { color: COLORS.grid },
        },
        crosshair: {
          mode: CrosshairMode.Normal,
          vertLine: { color: COLORS.crosshair, width: 1, style: 2 },
          horzLine: { color: COLORS.crosshair, width: 1, style: 2 },
        },
        rightPriceScale: {
          borderColor: COLORS.border,
          scaleMargins: { top: 0.1, bottom: pane.showVolume ? 0.25 : 0.1 },
        },
        timeScale: {
          borderColor: COLORS.border,
          timeVisible: true,
          secondsVisible: false,
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

      if (pane.bars.length > 0) {
        candleSeries.setData(formatBars(pane.bars));
      }

      // Add volume if enabled
      if (pane.showVolume && pane.bars.length > 0) {
        const volumeSeries = chart.addHistogramSeries({
          priceFormat: { type: 'volume' },
          priceScaleId: 'volume',
        });
        chart.priceScale('volume').applyOptions({
          scaleMargins: { top: 0.85, bottom: 0 },
        });
        volumeSeries.setData(
          pane.bars.map((bar) => ({
            time: (bar.t / 1000) as Time,
            value: bar.v,
            color: bar.c >= bar.o ? COLORS.volumeUp : COLORS.volumeDown,
          }))
        );
      }

      // Add EMA lines
      if (pane.bars.length > 0) {
        const closes = pane.bars.map((b) => b.c);
        const timestamps = pane.bars.map((b) => b.t);

        // EMA 9
        const ema9Series = chart.addLineSeries({
          color: COLORS.ema9,
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        const ema9 = calculateEMALocal(closes, 9);
        ema9Series.setData(
          ema9.map((v, i) => ({ time: (timestamps[i] / 1000) as Time, value: v })).filter((d) => d.value > 0)
        );

        // EMA 21
        const ema21Series = chart.addLineSeries({
          color: COLORS.ema21,
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        const ema21 = calculateEMALocal(closes, 21);
        ema21Series.setData(
          ema21.map((v, i) => ({ time: (timestamps[i] / 1000) as Time, value: v })).filter((d) => d.value > 0)
        );
      }

      // Add EMA Ribbon if enabled
      if (pane.showRibbon && pane.bars.length > 0) {
        addEMARibbon(chart, pane.bars);
      }

      // Add key levels
      if (showLevels && keyLevels.length > 0 && pane.bars.length > 0) {
        addKeyLevels(chart, pane.bars, keyLevels);
      }

      // Add patience markers if enabled
      if (pane.showPatienceMarkers && pane.bars.length > 0) {
        const patienceCandles = detectPatienceCandles(pane.bars, keyLevels);
        addPatienceMarkers(candleSeries, patienceCandles, pane.bars);
      }

      // Crosshair sync
      chart.subscribeCrosshairMove((param: MouseEventParams) => {
        if (param.time) {
          const timeNum = typeof param.time === 'number' ? param.time * 1000 : 0;
          setHoveredTime(timeNum);
          onTimeframeHover?.(timeNum);
        } else {
          setHoveredTime(null);
          onTimeframeHover?.(null);
        }
      });

      // Fit content
      chart.timeScale().fitContent();

      // Handle resize
      const resizeObserver = new ResizeObserver(() => {
        chart.applyOptions({
          width: container.clientWidth,
          height: expandedPane === pane.id ? 500 : pane.height,
        });
      });
      resizeObserver.observe(container);

      chartsRef.current.set(pane.id, { chart, candleSeries });

      return () => {
        resizeObserver.disconnect();
        chart.remove();
        chartsRef.current.delete(pane.id);
      };
    },
    [formatBars, showLevels, keyLevels, expandedPane, onTimeframeHover]
  );

  // Calculate EMA locally
  function calculateEMALocal(prices: number[], period: number): number[] {
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

  // Add EMA Ribbon area
  function addEMARibbon(chart: IChartApi, bars: Bar[]) {
    const closes = bars.map((b) => b.c);
    const timestamps = bars.map((b) => b.t);
    const ribbon = calculateEMARibbon(closes);

    // Create area between top and bottom EMA
    const areaSeries = chart.addAreaSeries({
      topColor: 'rgba(34, 197, 94, 0.1)',
      bottomColor: 'rgba(34, 197, 94, 0.02)',
      lineColor: 'transparent',
      priceLineVisible: false,
      lastValueVisible: false,
    });

    // Use the ribbon states to color the area
    const areaData = ribbon.states.map((state, i) => ({
      time: (timestamps[i] / 1000) as Time,
      value: state.topEMA,
    }));

    if (areaData.length > 0) {
      areaSeries.setData(areaData);
    }
  }

  // Add key levels to chart
  function addKeyLevels(chart: IChartApi, bars: Bar[], levels: KeyLevel[]) {
    const startTime = bars[0].t / 1000;
    const endTime = bars[bars.length - 1].t / 1000;

    // Only show top 5 levels to avoid clutter
    const topLevels = levels.slice(0, 5);

    for (const level of topLevels) {
      const style = LEVEL_STYLES[level.type] || LEVEL_STYLES.support;
      const lineSeries = chart.addLineSeries({
        color: style.color,
        lineWidth: style.lineWidth as 1 | 2 | 3 | 4,
        lineStyle: style.lineStyle === 'dashed' ? 1 : style.lineStyle === 'dotted' ? 2 : 0,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });

      lineSeries.setData([
        { time: startTime as Time, value: level.price },
        { time: endTime as Time, value: level.price },
      ]);
    }
  }

  // Add patience candle markers
  function addPatienceMarkers(
    candleSeries: ISeriesApi<'Candlestick'>,
    patienceCandles: PatienceCandle[],
    bars: Bar[]
  ) {
    const markers = patienceCandles.slice(0, 5).map((p) => {
      const bar = bars[p.barIndex];
      const isBullish = bar && bar.c >= bar.o;

      return {
        time: (p.timestamp / 1000) as Time,
        position: isBullish ? ('belowBar' as const) : ('aboveBar' as const),
        color: p.confidence >= 80 ? '#22c55e' : p.confidence >= 60 ? '#f59e0b' : '#6b7280',
        shape: 'circle' as const,
        text: '⏸',
      };
    });

    if (markers.length > 0) {
      candleSeries.setMarkers(markers);
    }
  }

  // Initialize charts on mount
  useEffect(() => {
    panes.forEach((pane) => {
      const container = containerRefs.current.get(pane.id);
      if (container) {
        initializeChart(pane, container);
      }
    });

    return () => {
      chartsRef.current.forEach(({ chart }) => chart.remove());
      chartsRef.current.clear();
    };
  }, [dailyBars, hourlyBars, fifteenMinBars, fiveMinBars, twoMinBars, showLevels, expandedPane]);

  // Get panes to display based on expanded state
  const displayPanes = expandedPane ? panes.filter((p) => p.id === expandedPane) : panes;

  return (
    <div className={cn('bg-[var(--bg-primary)] border border-[var(--border-primary)]', className)}>
      {/* Controls */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-primary)]">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-[var(--text-primary)]">{symbol}</span>
          <span className="text-xs text-[var(--text-tertiary)]">Multi-Timeframe Analysis</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowLevels(!showLevels)}
            className={cn(
              'p-1.5 rounded transition-colors',
              showLevels
                ? 'bg-[var(--accent-primary)]/20 text-[var(--accent-primary)]'
                : 'hover:bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]'
            )}
            title={showLevels ? 'Hide Levels' : 'Show Levels'}
          >
            {showLevels ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>
          {expandedPane && (
            <button
              onClick={() => setExpandedPane(null)}
              className="p-1.5 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]"
              title="Collapse"
            >
              <Minimize2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Chart Grid */}
      <div
        className={cn(
          'grid gap-1 p-1',
          expandedPane ? 'grid-cols-1' : 'grid-cols-3 grid-rows-2'
        )}
      >
        {displayPanes.map((pane, idx) => (
          <div
            key={pane.id}
            className={cn(
              'relative bg-[var(--bg-secondary)] border border-[var(--border-primary)]',
              !expandedPane && idx >= 3 && 'col-span-1',
              !expandedPane && idx < 3 && 'col-span-1',
              expandedPane && 'min-h-[500px]'
            )}
            style={{ height: expandedPane ? 500 : pane.height }}
          >
            {/* Pane Header */}
            <div className="absolute top-1 left-1 z-10 flex items-center gap-2">
              <span className="px-2 py-0.5 bg-[var(--bg-primary)]/90 text-[var(--text-primary)] text-xs font-semibold">
                {pane.timeframe}
              </span>
              <span className="text-[10px] text-[var(--text-tertiary)]">{pane.label}</span>
            </div>

            {/* Expand button */}
            {!expandedPane && (
              <button
                onClick={() => setExpandedPane(pane.id)}
                className="absolute top-1 right-1 z-10 p-1 bg-[var(--bg-primary)]/80 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]"
                title="Expand"
              >
                <Maximize2 className="w-3 h-3" />
              </button>
            )}

            {/* Chart Container */}
            <div
              ref={(el) => {
                containerRefs.current.set(pane.id, el);
              }}
              className="w-full h-full"
            />

            {/* No data message */}
            {pane.bars.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center bg-[var(--bg-primary)]/80">
                <span className="text-sm text-[var(--text-tertiary)]">No data available</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Key Levels Legend */}
      {showLevels && keyLevels.length > 0 && !expandedPane && (
        <div className="px-3 py-2 border-t border-[var(--border-primary)]">
          <div className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
            Key Levels
          </div>
          <div className="flex flex-wrap gap-3">
            {keyLevels.slice(0, 6).map((level, idx) => {
              const style = LEVEL_STYLES[level.type] || LEVEL_STYLES.support;
              return (
                <div key={idx} className="flex items-center gap-1.5 text-xs">
                  <div className="w-4 h-0.5" style={{ backgroundColor: style.color }} />
                  <span className="text-[var(--text-secondary)]">{level.label}</span>
                  <span className="text-[var(--text-primary)] font-mono">${level.price.toFixed(2)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default ChartGrid;
