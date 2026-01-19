'use client';

import { memo, useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import type {
  IChartApi,
  ISeriesApi,
  CandlestickData,
  Time,
} from 'lightweight-charts';
import { cn } from '@/lib/utils';
import type { LTPAnalysisChartContent } from '@/types';
import {
  LineChart,
  X,
  TrendingUp,
  TrendingDown,
  Loader2,
  ExternalLink,
  Target,
  Activity,
  Clock,
  AlertCircle,
} from 'lucide-react';

// ============================================
// Chart Colors (KCU Professional Theme)
// ============================================
const CHART_COLORS = {
  background: '#0a0a0a',
  text: '#9ca3af',
  textStrong: '#f3f4f6',
  grid: '#1f2937',
  upColor: '#10b981',
  downColor: '#ef4444',
  wickUp: '#10b981',
  wickDown: '#ef4444',
  vwap: '#f59e0b',
  ema9: '#10b981',
  ema21: '#ef4444',
  sma200: '#8b5cf6',
  patienceCandle: '#d4a574',
  level: '#60a5fa',
};

// ============================================
// Types
// ============================================
interface ChartDataResponse {
  symbol: string;
  date: string;
  timeframe: string;
  candles: Array<{
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }>;
  keyLevels: Array<{
    type: string;
    price: number;
    label: string;
    strength: number;
  }>;
  patienceCandles: Array<{
    time: number;
    direction: 'bullish' | 'bearish';
    confirmed: boolean;
  }>;
  indicators: {
    vwap: number | null;
    ema9: number | null;
    ema21: number | null;
    sma200: number | null;
  };
  ltpAnalysis: {
    grade: string;
    levelScore: number;
    trendScore: number;
    patienceScore: number;
    recommendation: string;
  } | null;
}

// ============================================
// LTP Analysis Card (Inline Preview)
// ============================================
interface LTPAnalysisCardProps {
  content: LTPAnalysisChartContent;
}

function LTPAnalysisCardComponent({ content }: LTPAnalysisCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const gradeColors: Record<string, string> = {
    'A+': 'text-green-400 bg-green-500/20',
    A: 'text-green-400 bg-green-500/20',
    B: 'text-green-300 bg-green-500/15',
    'B+': 'text-green-300 bg-green-500/15',
    C: 'text-yellow-400 bg-yellow-500/15',
    D: 'text-orange-400 bg-orange-500/15',
    F: 'text-red-400 bg-red-500/15',
    'N/A': 'text-gray-400 bg-gray-500/15',
  };

  const gradeClass = gradeColors[content.ltpAnalysis.grade] || gradeColors['N/A'];

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className={cn(
          'bg-[var(--bg-primary)] border border-[var(--border-primary)]',
          'hover:border-[var(--accent-primary-muted)] cursor-pointer',
          'transition-all duration-200'
        )}
        onClick={() => setIsModalOpen(true)}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-[var(--border-secondary)]">
          <div className="flex items-center gap-2">
            <LineChart className="w-5 h-5 text-[var(--accent-primary)]" />
            <span className="font-bold text-[var(--text-primary)]">{content.symbol}</span>
            <span className="text-xs text-[var(--text-tertiary)] px-1.5 py-0.5 bg-[var(--bg-secondary)]">
              {content.date}
            </span>
          </div>
          <div className={cn('px-2 py-1 text-sm font-bold', gradeClass)}>
            {content.ltpAnalysis.grade}
          </div>
        </div>

        {/* Content */}
        <div className="p-3">
          <p className="text-sm font-medium text-[var(--text-primary)] mb-2">
            {content.title}
          </p>
          <p className="text-xs text-[var(--text-secondary)] line-clamp-2">
            {content.summary}
          </p>

          {/* Quick LTP Scores */}
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-[var(--border-secondary)]">
            <div className="flex items-center gap-1">
              <Target className="w-3 h-3 text-blue-400" />
              <span className="text-xs text-[var(--text-tertiary)]">L:</span>
              <span className="text-xs font-medium text-[var(--text-primary)]">
                {content.ltpAnalysis.levelScore}%
              </span>
            </div>
            <div className="flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-green-400" />
              <span className="text-xs text-[var(--text-tertiary)]">T:</span>
              <span className="text-xs font-medium text-[var(--text-primary)]">
                {content.ltpAnalysis.trendScore}%
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-[var(--accent-primary)]" />
              <span className="text-xs text-[var(--text-tertiary)]">P:</span>
              <span className="text-xs font-medium text-[var(--text-primary)]">
                {content.ltpAnalysis.patienceScore}%
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-3 py-2 bg-[var(--bg-secondary)] border-t border-[var(--border-secondary)]">
          <span className="text-xs text-[var(--text-tertiary)]">
            {content.keyLevels.length} key levels
          </span>
          <span className="flex items-center gap-1 text-xs text-[var(--accent-primary)]">
            View Full Analysis
            <ExternalLink className="w-3 h-3" />
          </span>
        </div>
      </motion.div>

      {/* Modal */}
      <LTPAnalysisModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        content={content}
      />
    </>
  );
}

export const LTPAnalysisCard = memo(LTPAnalysisCardComponent);

// ============================================
// LTP Analysis Modal (Full Chart View)
// ============================================
interface LTPAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  content: LTPAnalysisChartContent;
}

function LTPAnalysisModalComponent({ isOpen, onClose, content }: LTPAnalysisModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chartData, setChartData] = useState<ChartDataResponse | null>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const [mounted, setMounted] = useState(false);

  // Handle mount for portal
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Fetch chart data when modal opens
  useEffect(() => {
    if (!isOpen) return;

    async function fetchChartData() {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          symbol: content.symbol,
          date: content.date,
          timeframe: content.timeframe,
        });

        const response = await fetch(`/api/market-data/chart?${params}`);

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.message || data.error || 'Failed to fetch chart data');
        }

        const data: ChartDataResponse = await response.json();
        setChartData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load chart data');
      } finally {
        setLoading(false);
      }
    }

    fetchChartData();
  }, [isOpen, content.symbol, content.date, content.timeframe]);

  // Create chart when data is loaded
  useEffect(() => {
    if (!chartData || !chartContainerRef.current || loading) return;

    let cancelled = false;

    async function initChart() {
      if (!chartContainerRef.current || cancelled || !chartData) return;

      // Dynamically import lightweight-charts to avoid SSR issues
      const { createChart, LineStyle, CrosshairMode } = await import('lightweight-charts');

      if (cancelled || !chartData) return;

      // Clean up previous chart
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }

      // Create chart
      const chart = createChart(chartContainerRef.current, {
        layout: {
          background: { color: CHART_COLORS.background },
          textColor: CHART_COLORS.text,
        },
        grid: {
          vertLines: { color: CHART_COLORS.grid, style: LineStyle.Dotted },
          horzLines: { color: CHART_COLORS.grid, style: LineStyle.Dotted },
        },
        crosshair: {
          mode: CrosshairMode.Normal,
        },
        rightPriceScale: {
          borderColor: CHART_COLORS.grid,
        },
        timeScale: {
          borderColor: CHART_COLORS.grid,
          timeVisible: true,
          secondsVisible: false,
        },
        width: chartContainerRef.current.clientWidth,
        height: chartContainerRef.current.clientHeight,
      });

      chartRef.current = chart;

      // Add candlestick series
      const candleSeries = chart.addCandlestickSeries({
        upColor: CHART_COLORS.upColor,
        downColor: CHART_COLORS.downColor,
        wickUpColor: CHART_COLORS.wickUp,
        wickDownColor: CHART_COLORS.wickDown,
        borderVisible: false,
      });

      candleSeriesRef.current = candleSeries;

      // Set candle data
      const candleData: CandlestickData[] = chartData.candles.map((c) => ({
        time: c.time as Time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }));

      candleSeries.setData(candleData);

      // Add key level lines
      chartData.keyLevels.forEach((level) => {
        candleSeries.createPriceLine({
          price: level.price,
          color: CHART_COLORS.level,
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: level.label,
        });
      });

      // Add indicator lines if available
      if (chartData.indicators.vwap) {
        candleSeries.createPriceLine({
          price: chartData.indicators.vwap,
          color: CHART_COLORS.vwap,
          lineWidth: 2,
          lineStyle: LineStyle.Solid,
          axisLabelVisible: true,
          title: 'VWAP',
        });
      }

      if (chartData.indicators.ema9) {
        candleSeries.createPriceLine({
          price: chartData.indicators.ema9,
          color: CHART_COLORS.ema9,
          lineWidth: 1,
          lineStyle: LineStyle.Solid,
          axisLabelVisible: true,
          title: 'EMA9',
        });
      }

      if (chartData.indicators.ema21) {
        candleSeries.createPriceLine({
          price: chartData.indicators.ema21,
          color: CHART_COLORS.ema21,
          lineWidth: 1,
          lineStyle: LineStyle.Solid,
          axisLabelVisible: true,
          title: 'EMA21',
        });
      }

      // Mark patience candles with markers
      if (chartData.patienceCandles.length > 0) {
        const markers = chartData.patienceCandles.map((pc) => ({
          time: pc.time as Time,
          position: pc.direction === 'bullish' ? 'belowBar' as const : 'aboveBar' as const,
          color: CHART_COLORS.patienceCandle,
          shape: pc.direction === 'bullish' ? 'arrowUp' as const : 'arrowDown' as const,
          text: pc.confirmed ? 'PC' : 'PC?',
        }));

        candleSeries.setMarkers(markers);
      }

      // Fit content
      chart.timeScale().fitContent();
    }

    initChart();

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelled = true;
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [chartData, loading]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Use portal to render modal at document body level
  if (!mounted) return null;

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className={cn(
              'bg-[#0a0a0a] border border-[var(--border-primary)]',
              'w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col',
              'shadow-2xl'
            )}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-primary)] bg-[var(--bg-secondary)]">
              <div className="flex items-center gap-3">
                <LineChart className="w-5 h-5 text-[var(--accent-primary)]" />
                <h2 className="font-bold text-[var(--text-primary)]">
                  {content.symbol} Analysis
                </h2>
                <span className="text-sm text-[var(--text-tertiary)]">
                  {content.date}
                </span>
                <span className="text-xs px-2 py-0.5 bg-[var(--bg-primary)] text-[var(--text-secondary)]">
                  {content.timeframe}
                </span>
              </div>
              <button
                onClick={onClose}
                className="p-1 hover:bg-[var(--bg-primary)] transition-colors"
              >
                <X className="w-5 h-5 text-[var(--text-secondary)]" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 flex overflow-hidden">
              {/* Chart Area */}
              <div className="flex-1 relative">
                {loading ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="w-8 h-8 text-[var(--accent-primary)] animate-spin" />
                      <span className="text-sm text-[var(--text-secondary)]">
                        Loading chart data...
                      </span>
                    </div>
                  </div>
                ) : error ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-3 text-center px-4">
                      <AlertCircle className="w-8 h-8 text-red-400" />
                      <span className="text-sm text-[var(--text-secondary)]">{error}</span>
                      <button
                        onClick={onClose}
                        className="text-xs text-[var(--accent-primary)] hover:underline"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    ref={chartContainerRef}
                    className="absolute inset-0"
                  />
                )}
              </div>

              {/* LTP Score Sidebar */}
              <div className="w-64 border-l border-[var(--border-primary)] bg-[var(--bg-primary)] overflow-y-auto">
                {/* Grade */}
                <div className="p-4 border-b border-[var(--border-secondary)] text-center">
                  <p className="text-xs text-[var(--text-tertiary)] mb-1">LTP Grade</p>
                  <div
                    className={cn(
                      'text-4xl font-bold',
                      getGradeColor(content.ltpAnalysis.grade)
                    )}
                  >
                    {content.ltpAnalysis.grade}
                  </div>
                </div>

                {/* Score Breakdown */}
                <div className="p-4 space-y-4">
                  <ScoreBar
                    label="Level"
                    score={content.ltpAnalysis.levelScore}
                    icon={<Target className="w-4 h-4" />}
                  />
                  <ScoreBar
                    label="Trend"
                    score={content.ltpAnalysis.trendScore}
                    icon={<TrendingUp className="w-4 h-4" />}
                  />
                  <ScoreBar
                    label="Patience"
                    score={content.ltpAnalysis.patienceScore}
                    icon={<Clock className="w-4 h-4" />}
                  />
                </div>

                {/* Recommendation */}
                {content.ltpAnalysis.recommendation && (
                  <div className="p-4 border-t border-[var(--border-secondary)]">
                    <p className="text-xs text-[var(--text-tertiary)] mb-2">Recommendation</p>
                    <p className="text-sm text-[var(--text-secondary)]">
                      {content.ltpAnalysis.recommendation}
                    </p>
                  </div>
                )}

                {/* Key Levels */}
                {content.keyLevels.length > 0 && (
                  <div className="p-4 border-t border-[var(--border-secondary)]">
                    <p className="text-xs text-[var(--text-tertiary)] mb-3">Key Levels</p>
                    <div className="space-y-2">
                      {content.keyLevels.map((level, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between text-sm"
                        >
                          <span className="text-[var(--text-secondary)]">{level.label}</span>
                          <span className="font-mono text-[var(--text-primary)]">
                            ${level.price.toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Summary */}
                {content.summary && (
                  <div className="p-4 border-t border-[var(--border-secondary)]">
                    <p className="text-xs text-[var(--text-tertiary)] mb-2">Analysis</p>
                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                      {content.summary}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-4 py-2 border-t border-[var(--border-primary)] bg-[var(--bg-secondary)] flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
                <Activity className="w-3 h-3" />
                <span>
                  {chartData?.patienceCandles.length || 0} patience candles detected
                </span>
              </div>
              <a
                href={`https://www.tradingview.com/chart/?symbol=${content.symbol}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-[var(--accent-primary)] hover:underline"
              >
                Open in TradingView
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
}

export const LTPAnalysisModal = memo(LTPAnalysisModalComponent);

// ============================================
// Helper Components
// ============================================

function ScoreBar({
  label,
  score,
  icon,
}: {
  label: string;
  score: number;
  icon: React.ReactNode;
}) {
  const getScoreColor = (s: number) => {
    if (s >= 80) return 'bg-green-500';
    if (s >= 60) return 'bg-yellow-500';
    if (s >= 40) return 'bg-orange-500';
    return 'bg-red-500';
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2 text-[var(--text-secondary)]">
          {icon}
          <span className="text-sm">{label}</span>
        </div>
        <span className="text-sm font-mono text-[var(--text-primary)]">{score}%</span>
      </div>
      <div className="h-2 bg-[var(--bg-secondary)] overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className={cn('h-full', getScoreColor(score))}
        />
      </div>
    </div>
  );
}

function getGradeColor(grade: string): string {
  const colors: Record<string, string> = {
    'A+': 'text-green-400',
    A: 'text-green-400',
    'B+': 'text-green-300',
    B: 'text-green-300',
    C: 'text-yellow-400',
    D: 'text-orange-400',
    F: 'text-red-400',
  };
  return colors[grade] || 'text-gray-400';
}
