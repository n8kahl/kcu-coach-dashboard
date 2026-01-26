'use client';

/**
 * Companion Mode - Professional Trading Cockpit
 *
 * A fixed-height, non-scrolling dashboard layout optimized for day traders.
 * 75% Chart / 25% HUD split prevents the coach overlay from blocking price action.
 *
 * Key Features:
 * - Canvas-based ProfessionalChart (hardware accelerated)
 * - Fixed cockpit layout (no scrolling)
 * - Candle countdown timer
 * - Safe number formatting (no NaN/undefined display)
 * - Memoized components for performance
 */

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useAIContext } from '@/components/ai';
import { cn } from '@/lib/utils';
import { useCompanionStream, type CompanionEvent } from '@/hooks/useCompanionStream';
import { useCompanionData } from '@/hooks/useCompanionData';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import {
  CompanionWatchlist,
  CompanionHUD,
  CompanionCoachBox,
  ConfluencePanel,
} from '@/components/companion';
import { ProfessionalChart, type ChartCandle, type ChartLevel, type ProfessionalGammaLevel, type ProfessionalChartHandle } from '@/components/charts';
import { toEpochSeconds, getBucketStart, TIMEFRAME_SECONDS } from '@/lib/charts/time';
import {
  kcuCoachingRules,
  getMarketSession,
  calculateRMultiple,
  type CoachingMessage,
  type CoachingContext,
} from '@/lib/kcu-coaching-rules';
import type { LTPAnalysis } from '@/lib/market-data';
import {
  calculateLTP2Score,
  createMarketContext,
  calculateEMA,
  type LTP2Score,
  type ScoreHysteresisState,
} from '@/lib/ltp-gamma-engine';
import { useSomeshVoice } from '@/hooks/useSomeshVoice';
import {
  formatDollarPrice,
  formatPercent,
  formatCountdown,
  getSecondsUntilCandleClose,
  isValidNumber,
  isValidPrice,
} from '@/lib/format-trade-data';
import { getLevelColor, getRoundNumberLevels } from '@/lib/kcu-colors';
import {
  Eye,
  Zap,
  RefreshCw,
  Radio,
  Crosshair,
  Gauge,
  Volume2,
  VolumeX,
  Target,
  Clock,
} from 'lucide-react';

// =============================================================================
// Types
// =============================================================================

interface PolygonBar {
  timestamp?: number;
  time?: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface GammaExposure {
  symbol: string;
  currentPrice: number;
  maxPain: number;
  gammaFlip: number;
  callWall: number;
  putWall: number;
  regime: 'positive' | 'negative' | 'neutral';
  dealerPositioning: string;
  expectedMove: { daily: number; weekly: number };
  analysis: { summary: string; tradingImplication: string };
}

interface FVGData {
  symbol: string;
  currentPrice: number;
  nearestBullishFVG: { topPrice: number; bottomPrice: number; midPrice: number } | null;
  nearestBearishFVG: { topPrice: number; bottomPrice: number; midPrice: number } | null;
  tradingContext: {
    bullishTargets: number[];
    bearishTargets: number[];
    summary: string;
  };
}

type CoachingMode = 'scan' | 'focus' | 'trade';
type ChartTimeframe = '2min' | '5min';

interface ActiveTrade {
  symbol: string;
  direction: 'long' | 'short';
  entryPrice: number;
  stopLoss: number;
  target1: number;
  target2?: number;
  target3?: number;
  positionSize: number;
  enteredAt: string;
}

// =============================================================================
// Candle Countdown Component (Memoized)
// =============================================================================

const CandleCountdown = memo(function CandleCountdown({
  timeframeMinutes,
}: {
  timeframeMinutes: number;
}) {
  const [countdown, setCountdown] = useState('--:--');

  useEffect(() => {
    const updateCountdown = () => {
      const seconds = getSecondsUntilCandleClose(timeframeMinutes);
      setCountdown(formatCountdown(seconds));
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [timeframeMinutes]);

  return (
    <div className="flex items-center gap-1.5 px-2 py-1 bg-[#1e222d] border border-[#2a2e39] text-xs font-mono">
      <Clock className="w-3 h-3 text-[#787b86]" />
      <span className="text-[#d1d4dc] tabular-nums">{countdown}</span>
    </div>
  );
});

// =============================================================================
// Mode Button Component
// =============================================================================

function ModeButton({
  mode,
  currentMode,
  onClick,
  icon,
  disabled = false,
}: {
  mode: CoachingMode;
  currentMode: CoachingMode;
  onClick: () => void;
  icon: React.ReactNode;
  disabled?: boolean;
}) {
  const isActive = mode === currentMode;
  const labels = { scan: 'Scan', focus: 'Focus', trade: 'Trade' };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex items-center gap-1 px-2 py-1 text-[10px] font-medium transition-all',
        isActive
          ? 'bg-[#26a69a] text-white'
          : 'text-[#787b86] hover:bg-[#1e222d] hover:text-[#d1d4dc]',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      {icon}
      {labels[mode]}
    </button>
  );
}

// =============================================================================
// Main Companion Terminal Component
// =============================================================================

export default function CompanionTerminal() {
  // URL & AI Context
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { updatePageContext, setSelectedSymbol: setAISelectedSymbol } = useAIContext();

  const urlSymbol = searchParams.get('symbol')?.toUpperCase() || null;
  const selectedSymbol = urlSymbol;

  const setSelectedSymbol = useCallback(
    (symbol: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (symbol) {
        params.set('symbol', symbol);
      } else {
        params.delete('symbol');
      }
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [searchParams, router, pathname]
  );

  // Data layer
  const {
    watchlist,
    setups,
    readySetups,
    marketStatus,
    isLoading: loading,
    isRefreshing: refreshing,
    refresh: refreshData,
    refetchWatchlist,
    handlePriceUpdate,
  } = useCompanionData({
    pollInterval: 30000,
    autoPolling: true,
  });

  // Session state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const sessionStartTime = useRef<Date | null>(null);

  // Mode and coaching
  const [mode, setMode] = useState<CoachingMode>('scan');
  const [activeTrade, setActiveTrade] = useState<ActiveTrade | null>(null);
  const [coachingMessages, setCoachingMessages] = useState<CoachingMessage[]>([]);

  // Analysis data
  const [ltpAnalysis, setLtpAnalysis] = useState<LTPAnalysis | null>(null);
  const [gammaData, setGammaData] = useState<GammaExposure | null>(null);
  const [fvgData, setFvgData] = useState<FVGData | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);

  // Chart data
  const [chartData, setChartData] = useState<ChartCandle[]>([]);
  const [chartLevels, setChartLevels] = useState<ChartLevel[]>([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartError, setChartError] = useState<string | null>(null);
  const [chartTimeframe, setChartTimeframe] = useState<ChartTimeframe>('5min');

  // Chart ref for imperative updates (no React re-render on tick)
  const chartRef = useRef<ProfessionalChartHandle>(null);

  // Debug state for real-time tick validation (env-controlled)
  const showDebugOverlay = process.env.NEXT_PUBLIC_CHART_DEBUG === 'true';
  const [debugInfo, setDebugInfo] = useState<{
    lastTickTs: number | null;
    currentBucketStart: number | null;
    lastCandleTime: number | null;
  }>({ lastTickTs: null, currentBucketStart: null, lastCandleTime: null });

  // Track current candle state for imperative updates
  const currentCandleRef = useRef<ChartCandle | null>(null);

  // UI state
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [lastAlertType, setLastAlertType] = useState<'patience' | 'entry' | 'warning' | null>(null);

  // LTP 2.0 state
  const [ltp2Score, setLtp2Score] = useState<LTP2Score | null>(null);

  // Score hysteresis
  const scoreHistoryRef = useRef<ScoreHysteresisState>({
    previousGrade: null,
    previousScores: [],
    candlesAtGrade: 0,
  });

  const prevGammaStateRef = useRef<{
    nearCallWall: boolean;
    nearPutWall: boolean;
    crossedZeroGamma: boolean;
  }>({
    nearCallWall: false,
    nearPutWall: false,
    crossedZeroGamma: false,
  });
  const prevVwapStateRef = useRef<boolean | null>(null);

  const { showToast } = useToast();

  // Voice
  const someshVoice = useSomeshVoice({
    enabled: soundEnabled,
    volume: 0.8,
    rate: 1.0,
    cooldownMs: 30000,
  });

  const marketSession = useMemo(() => getMarketSession(), []);

  // Current quote
  const currentQuote = useMemo(() => {
    if (!selectedSymbol) return null;
    return watchlist.find((w) => w.symbol === selectedSymbol)?.quote || null;
  }, [selectedSymbol, watchlist]);

  // Chart-calculated VWAP fallback
  const chartCalculatedVwap = useMemo(() => {
    if (chartData.length === 0) return 0;

    const todayET = new Date().toLocaleDateString('en-US', { timeZone: 'America/New_York' });

    const todayBars = chartData.filter((candle) => {
      const candleDate = new Date(Number(candle.time) * 1000);
      const candleDateET = candleDate.toLocaleDateString('en-US', { timeZone: 'America/New_York' });
      return candleDateET === todayET;
    });

    let barsToUse = todayBars;
    if (todayBars.length === 0 && chartData.length > 0) {
      const lastCandle = chartData[chartData.length - 1];
      const lastCandleDate = new Date(Number(lastCandle.time) * 1000);
      const lastDayET = lastCandleDate.toLocaleDateString('en-US', { timeZone: 'America/New_York' });

      barsToUse = chartData.filter((candle) => {
        const candleDate = new Date(Number(candle.time) * 1000);
        const candleDateET = candleDate.toLocaleDateString('en-US', { timeZone: 'America/New_York' });
        return candleDateET === lastDayET;
      });
    }

    if (barsToUse.length === 0) return 0;

    let cumulativeTPV = 0;
    let cumulativeVolume = 0;

    for (const candle of barsToUse) {
      const typicalPrice = (candle.high + candle.low + candle.close) / 3;
      const volume = candle.volume || 1;
      cumulativeTPV += typicalPrice * volume;
      cumulativeVolume += volume;
    }

    return cumulativeVolume > 0 ? cumulativeTPV / cumulativeVolume : 0;
  }, [chartData]);

  const effectiveVwap = currentQuote?.vwap || chartCalculatedVwap;
  const effectivePrice = currentQuote?.last_price || chartData[chartData.length - 1]?.close || 0;

  // Timeframe minutes for countdown
  const timeframeMinutes = chartTimeframe === '2min' ? 2 : 5;

  // ==========================================================================
  // SSE Event Handler - Imperative Chart Updates
  // ==========================================================================

  const handleStreamEvent = useCallback(
    (event: CompanionEvent) => {
      if (event.type === 'setup_forming' || event.type === 'setup_ready') {
        refreshData();
        if (event.type === 'setup_ready') {
          setLastAlertType('entry');
          setTimeout(() => setLastAlertType(null), 2000);
        }
      } else if (event.type === 'price_update') {
        // Update watchlist prices (React state - this is fine, it's not per-tick)
        handlePriceUpdate(event.data);

        // Only update chart for selected symbol
        if (event.data.symbol !== selectedSymbol) return;

        const price = event.data.price;
        if (!isValidPrice(price)) return;

        // Get timeframe in seconds for proper bucketing
        const timeframeKey = chartTimeframe === '2min' ? '2m' : '5m';
        const timeframeSeconds = TIMEFRAME_SECONDS[timeframeKey];

        // Normalize timestamp and compute bucket
        const nowMs = Date.now();
        const nowSeconds = toEpochSeconds(nowMs);
        const bucketStart = getBucketStart(nowSeconds, timeframeSeconds);

        // Get last candle time from chart ref or current candle ref
        const lastCandleTime = chartRef.current?.getLastCandleTime() ?? currentCandleRef.current?.time ?? null;

        // Update debug info (only if enabled)
        if (showDebugOverlay) {
          setDebugInfo({
            lastTickTs: nowSeconds,
            currentBucketStart: bucketStart,
            lastCandleTime,
          });
        }

        // Determine if this tick belongs to current bucket or starts a new one
        const isSameBucket = lastCandleTime !== null && getBucketStart(lastCandleTime, timeframeSeconds) === bucketStart;

        if (isSameBucket && currentCandleRef.current) {
          // Update existing candle (same bucket)
          const candle = currentCandleRef.current;
          candle.high = Math.max(candle.high, price);
          candle.low = Math.min(candle.low, price);
          candle.close = price;
          candle.volume = (candle.volume || 0) + (event.data.volume || 0);

          // Imperative update - NO setChartData, NO React re-render
          chartRef.current?.updateLastCandle(candle);
        } else {
          // New bucket - create new candle
          const newCandle: ChartCandle = {
            time: bucketStart,
            open: price,
            high: price,
            low: price,
            close: price,
            volume: event.data.volume || 0,
          };
          currentCandleRef.current = newCandle;

          // Imperative add - NO setChartData, NO React re-render
          chartRef.current?.addCandle(newCandle);
        }
      }
    },
    [selectedSymbol, chartTimeframe, refreshData, handlePriceUpdate, showDebugOverlay]
  );

  const { connected: streamConnected, connectionStatus } = useCompanionStream({
    onEvent: handleStreamEvent,
  });

  // ==========================================================================
  // Data Fetching
  // ==========================================================================

  const fetchChartData = async (symbol: string, timeframe: ChartTimeframe = chartTimeframe) => {
    setChartLoading(true);
    setChartError(null);
    const multiplier = timeframe === '2min' ? 2 : 5;

    try {
      const res = await fetch(
        `/api/market/bars?symbol=${symbol}&timespan=minute&multiplier=${multiplier}&limit=1200`
      );
      if (res.ok) {
        const data = await res.json();
        if (data.bars && data.bars.length > 0) {
          const validBars = data.bars
            .filter(
              (c: PolygonBar) =>
                isValidPrice(c.open) &&
                isValidPrice(c.high) &&
                isValidPrice(c.low) &&
                isValidPrice(c.close) &&
                (c.timestamp != null || c.time != null)
            )
            .map((c: PolygonBar) => {
              const ts = c.timestamp || c.time || 0;
              const timeInSeconds = ts > 1e12 ? Math.floor(ts / 1000) : ts;
              return {
                time: timeInSeconds,
                open: c.open,
                high: c.high,
                low: c.low,
                close: c.close,
                volume: c.volume || 0,
              };
            });
          setChartData(validBars);
          setChartError(null);
          // Initialize current candle ref with last candle for imperative updates
          if (validBars.length > 0) {
            currentCandleRef.current = { ...validBars[validBars.length - 1] };
          }
        } else {
          setChartData([]);
          setChartError('No market data available');
          currentCandleRef.current = null;
        }
      } else {
        const errorData = await res.json().catch(() => ({}));
        setChartError(errorData.error || `Failed to fetch data (${res.status})`);
      }
    } catch (error) {
      console.error('Error fetching chart data:', error);
      setChartError('Failed to connect to market data service');
    } finally {
      setChartLoading(false);
    }
  };

  const fetchLTPAnalysis = async (symbol: string) => {
    setAnalysisLoading(true);
    setLtpAnalysis(null);
    setGammaData(null);
    setFvgData(null);

    try {
      const [ltpRes, gammaRes, fvgRes] = await Promise.all([
        fetch(`/api/market/ltp?symbol=${symbol}`),
        fetch(`/api/market/gamma?symbol=${symbol}`),
        fetch(`/api/market/fvg?symbol=${symbol}`),
      ]);

      if (ltpRes.ok) {
        const data = await ltpRes.json();
        setLtpAnalysis(data);

        const levels: ChartLevel[] = [];

        // Previous Day Levels - Gold (#fbbf24)
        if (isValidPrice(data.levels?.pdh)) {
          levels.push({
            price: data.levels.pdh,
            label: 'PDH',
            color: getLevelColor('pdh'),
            type: 'pdh',
          });
        }
        if (isValidPrice(data.levels?.pdl)) {
          levels.push({
            price: data.levels.pdl,
            label: 'PDL',
            color: getLevelColor('pdl'),
            type: 'pdl',
          });
        }

        // VWAP - Purple (#8b5cf6)
        if (isValidPrice(data.levels?.vwap)) {
          levels.push({
            price: data.levels.vwap,
            label: 'VWAP',
            color: getLevelColor('vwap'),
            type: 'vwap',
          });
        }

        // ORB Levels - Cyan (#06b6d4)
        if (isValidPrice(data.levels?.orbHigh)) {
          levels.push({
            price: data.levels.orbHigh,
            label: 'ORB High',
            color: getLevelColor('orb_high'),
            lineStyle: 'dashed',
            type: 'orb_high',
          });
        }
        if (isValidPrice(data.levels?.orbLow)) {
          levels.push({
            price: data.levels.orbLow,
            label: 'ORB Low',
            color: getLevelColor('orb_low'),
            lineStyle: 'dashed',
            type: 'orb_low',
          });
        }

        // Pre-Market Levels - Pink (#ec4899)
        if (isValidPrice(data.levels?.pmh)) {
          levels.push({
            price: data.levels.pmh,
            label: 'PMH',
            color: getLevelColor('pmh'),
            lineStyle: 'dashed',
            type: 'pmh',
          });
        }
        if (isValidPrice(data.levels?.pml)) {
          levels.push({
            price: data.levels.pml,
            label: 'PML',
            color: getLevelColor('pml'),
            lineStyle: 'dashed',
            type: 'pml',
          });
        }

        // SMA 200 - White (#ffffff)
        if (isValidPrice(data.levels?.sma200)) {
          levels.push({
            price: data.levels.sma200,
            label: 'SMA 200',
            color: getLevelColor('sma_200'),
            type: 'sma_200',
          });
        }

        // Add round number levels near current price
        const currentPrice = data.currentPrice || data.levels?.vwap;
        if (isValidPrice(currentPrice)) {
          const roundNumbers = getRoundNumberLevels(currentPrice, 5);
          roundNumbers.forEach((price) => {
            levels.push({
              price,
              label: `$${price}`,
              color: getLevelColor('round_number'),
              lineStyle: 'dotted',
              type: 'round_number',
            });
          });
        }

        // Add levels from the nearest array (includes swing levels, support/resistance)
        if (Array.isArray(data.levels?.nearest)) {
          for (const level of data.levels.nearest) {
            if (!isValidPrice(level.price)) continue;
            // Skip types we already added explicitly above
            const alreadyAdded = ['pdh', 'pdl', 'vwap', 'orb_high', 'orb_low', 'pmh', 'pml', 'sma200', 'ema9', 'ema21'];
            if (alreadyAdded.includes(level.type)) continue;

            // Format label based on type
            let label = level.type?.replace(/_/g, ' ').toUpperCase() || 'LEVEL';
            if (level.type === 'swing_high_4h') label = 'H4 SH';
            else if (level.type === 'swing_low_4h') label = 'H4 SL';
            else if (level.type === 'swing_high_1h') label = 'H1 SH';
            else if (level.type === 'swing_low_1h') label = 'H1 SL';
            else if (level.type === 'support') label = 'S/R';
            else if (level.type === 'resistance') label = 'S/R';

            levels.push({
              price: level.price,
              label,
              color: getLevelColor(level.type || 'support'),
              lineStyle: 'dashed',
              type: level.type,
              strength: level.strength,
            });
          }
        }

        console.log('[Companion] Setting chart levels:', levels.length, levels.map(l => ({ label: l.label, price: l.price })));
        setChartLevels(levels);
      } else {
        // LTP API failed - try to get basic levels from quote as fallback
        try {
          const quoteRes = await fetch(`/api/market/quote?symbol=${symbol}`);
          if (quoteRes.ok) {
            const quoteData = await quoteRes.json();
            const quote = quoteData.quote;
            const fallbackLevels: ChartLevel[] = [];

            if (isValidPrice(quote?.prevHigh)) {
              fallbackLevels.push({
                price: quote.prevHigh,
                label: 'PDH',
                color: getLevelColor('pdh'),
                type: 'pdh',
              });
            }
            if (isValidPrice(quote?.prevLow)) {
              fallbackLevels.push({
                price: quote.prevLow,
                label: 'PDL',
                color: getLevelColor('pdl'),
                type: 'pdl',
              });
            }
            if (isValidPrice(quote?.vwap)) {
              fallbackLevels.push({
                price: quote.vwap,
                label: 'VWAP',
                color: getLevelColor('vwap'),
                type: 'vwap',
              });
            }

            setChartLevels(fallbackLevels);
          } else {
            setChartLevels([]);
          }
        } catch {
          setChartLevels([]);
        }
      }

      if (gammaRes.ok) {
        const data = await gammaRes.json();
        setGammaData(data);
      }

      if (fvgRes.ok) {
        const data = await fvgRes.json();
        setFvgData(data);
      }

      updateCoachingMessages(symbol);
    } catch (error) {
      console.error('Error fetching analysis:', error);
      showToast({
        type: 'error',
        title: 'Analysis Failed',
        message: 'Failed to load analysis data.',
      });
    } finally {
      setAnalysisLoading(false);
    }
  };

  const updateCoachingMessages = useCallback(
    (symbol: string) => {
      const watchlistItem = watchlist.find((w) => w.symbol === symbol);
      const currentPrice = watchlistItem?.quote?.last_price || 0;

      const context: CoachingContext = {
        symbol,
        currentPrice,
        ltpAnalysis,
        gammaData: gammaData
          ? {
              regime: gammaData.regime,
              maxPain: gammaData.maxPain,
              callWall: gammaData.callWall,
              putWall: gammaData.putWall,
              gammaFlip: gammaData.gammaFlip,
              dealerPositioning: gammaData.dealerPositioning,
            }
          : null,
        fvgData: fvgData
          ? {
              nearestBullish: fvgData.nearestBullishFVG
                ? {
                    price: fvgData.nearestBullishFVG.midPrice,
                    distance:
                      (Math.abs(currentPrice - fvgData.nearestBullishFVG.midPrice) / currentPrice) * 100,
                  }
                : null,
              nearestBearish: fvgData.nearestBearishFVG
                ? {
                    price: fvgData.nearestBearishFVG.midPrice,
                    distance:
                      (Math.abs(currentPrice - fvgData.nearestBearishFVG.midPrice) / currentPrice) * 100,
                  }
                : null,
              supportZones: [],
              resistanceZones: [],
            }
          : null,
        activeTrade: activeTrade
          ? {
              ...activeTrade,
              currentRMultiple: calculateRMultiple(
                activeTrade.entryPrice,
                currentPrice,
                activeTrade.stopLoss,
                activeTrade.direction
              ),
            }
          : null,
        mode,
        marketSession,
      };

      const messages = kcuCoachingRules.getCoachingMessages(context);
      setCoachingMessages(messages);

      const hasPatience = messages.some((m) => m.title.includes('Patience') || m.title.includes('⏳'));
      const hasEntry = messages.some(
        (m) => m.title.includes('GO TIME') || m.title.includes('🚀') || m.title.includes('SNIPER')
      );
      const hasWarning = messages.some((m) => m.type === 'warning' && m.priority === 'high');

      if (hasEntry) {
        setLastAlertType('entry');
        setTimeout(() => setLastAlertType(null), 3000);
      } else if (hasPatience) {
        setLastAlertType('patience');
        setTimeout(() => setLastAlertType(null), 2000);
      } else if (hasWarning) {
        setLastAlertType('warning');
        setTimeout(() => setLastAlertType(null), 2000);
      }
    },
    [watchlist, ltpAnalysis, gammaData, fvgData, activeTrade, mode, marketSession]
  );

  // ==========================================================================
  // Effects
  // ==========================================================================

  useEffect(() => {
    const startSession = async () => {
      try {
        const res = await fetch('/api/companion/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        if (res.ok) {
          const data = await res.json();
          setSessionId(data.sessionId);
          sessionStartTime.current = new Date();
        }
      } catch (error) {
        console.error('Error starting session:', error);
      }
    };

    startSession();

    return () => {
      if (sessionId) {
        fetch('/api/companion/session', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, action: 'end' }),
        }).catch(() => {});
      }
    };
  }, []);

  useEffect(() => {
    if (selectedSymbol) {
      fetchLTPAnalysis(selectedSymbol);
      fetchChartData(selectedSymbol, chartTimeframe);
    } else {
      setLtpAnalysis(null);
      setGammaData(null);
      setFvgData(null);
      setCoachingMessages([]);
      setChartData([]);
      setChartLevels([]);
      setChartError(null);
      setChartLoading(false);
    }
  }, [selectedSymbol, chartTimeframe]);

  useEffect(() => {
    if (selectedSymbol && ltpAnalysis) {
      updateCoachingMessages(selectedSymbol);
    }
  }, [selectedSymbol, ltpAnalysis, updateCoachingMessages]);

  // AI Context Sync
  useEffect(() => {
    setAISelectedSymbol(selectedSymbol || undefined);

    const timeoutId = setTimeout(() => {
      const pageData: Record<string, unknown> = {
        watchlistSymbols: watchlist.map((w) => w.symbol),
        focusedSymbol: selectedSymbol,
      };

      if (selectedSymbol && (ltpAnalysis || ltp2Score)) {
        pageData.ltpGrade = ltp2Score?.grade || ltpAnalysis?.grade || null;
        pageData.currentPrice = effectivePrice;
        pageData.gammaRegime = gammaData?.regime || null;
        pageData.vwap = effectiveVwap;
      }

      updatePageContext('companion', pageData);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [selectedSymbol, ltpAnalysis, ltp2Score, gammaData, effectivePrice, effectiveVwap, watchlist]);

  // Reset score history on symbol change
  const prevSymbolRef = useRef<string | null>(null);
  useEffect(() => {
    if (selectedSymbol !== prevSymbolRef.current) {
      scoreHistoryRef.current = {
        previousGrade: null,
        previousScores: [],
        candlesAtGrade: 0,
      };
      prevSymbolRef.current = selectedSymbol;
    }
  }, [selectedSymbol]);

  // LTP 2.0 Score Calculation
  useEffect(() => {
    if (!selectedSymbol || !gammaData || chartData.length < 21) {
      setLtp2Score(null);
      return;
    }

    const currentPrice = currentQuote?.last_price || chartData[chartData.length - 1]?.close || 0;
    if (!isValidPrice(currentPrice)) return;

    const closePrices = chartData.map((c) => c.close);
    const ema8 = calculateEMA(closePrices, 8);
    const ema21 = calculateEMA(closePrices, 21);
    const vwap = effectiveVwap || currentPrice;

    const hasPatienceCandle =
      chartData.length >= 2 &&
      chartData[chartData.length - 1].high < chartData[chartData.length - 2].high &&
      chartData[chartData.length - 1].low > chartData[chartData.length - 2].low;

    const patienceDirection = hasPatienceCandle
      ? chartData[chartData.length - 1].close > chartData[chartData.length - 1].open
        ? 'bullish'
        : 'bearish'
      : undefined;

    const marketContext = createMarketContext(
      {
        close: currentPrice,
        high: chartData[chartData.length - 1]?.high || currentPrice,
        low: chartData[chartData.length - 1]?.low || currentPrice,
        open: chartData[chartData.length - 1]?.open || currentPrice,
        previousClose: chartData[chartData.length - 2]?.close,
        previousHigh: chartData[chartData.length - 2]?.high,
        previousLow: chartData[chartData.length - 2]?.low,
      },
      { ema8, ema21 },
      vwap,
      {
        callWall: gammaData.callWall,
        putWall: gammaData.putWall,
        zeroGamma: gammaData.gammaFlip,
        gammaExposure: gammaData.regime === 'positive' ? 1 : gammaData.regime === 'negative' ? -1 : 0,
      },
      hasPatienceCandle ? { detected: true, direction: patienceDirection! } : undefined
    );

    const currentHistory = scoreHistoryRef.current;
    const newScore = calculateLTP2Score(marketContext, currentHistory);
    setLtp2Score(newScore);

    scoreHistoryRef.current = {
      previousGrade: newScore.grade,
      previousScores: [...currentHistory.previousScores.slice(-9), newScore.score],
      candlesAtGrade: newScore.grade === currentHistory.previousGrade ? currentHistory.candlesAtGrade + 1 : 1,
    };

    const isStableGrade = newScore.stability?.candlesAtGrade ? newScore.stability.candlesAtGrade >= 2 : true;
    if (isStableGrade) {
      someshVoice.checkScore(newScore);
    }
  }, [selectedSymbol, gammaData, chartData, currentQuote, effectiveVwap, someshVoice]);

  // ==========================================================================
  // Actions
  // ==========================================================================

  const addSymbol = useCallback(
    async (symbol: string) => {
      if (!symbol.trim()) return;
      try {
        const res = await fetch('/api/companion/watchlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbol: symbol.trim().toUpperCase() }),
        });
        if (res.ok) {
          refetchWatchlist();
        }
      } catch (error) {
        console.error('Error adding symbol:', error);
      }
    },
    [refetchWatchlist]
  );

  const removeSymbol = useCallback(
    async (symbol: string) => {
      try {
        await fetch(`/api/companion/watchlist?symbol=${symbol}`, { method: 'DELETE' });
        if (selectedSymbol === symbol) {
          setSelectedSymbol(null);
        }
        refetchWatchlist();
      } catch (error) {
        console.error('Error removing symbol:', error);
      }
    },
    [selectedSymbol, setSelectedSymbol, refetchWatchlist]
  );

  const refreshAll = useCallback(async () => {
    try {
      await fetch('/api/companion/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshAll: true }),
      });
      await refreshData();
      if (selectedSymbol) {
        await fetchLTPAnalysis(selectedSymbol);
        await fetchChartData(selectedSymbol, chartTimeframe);
      }
    } catch (error) {
      console.error('Error refreshing:', error);
    }
  }, [refreshData, selectedSymbol, chartTimeframe]);

  // ==========================================================================
  // Computed Values
  // ==========================================================================

  const chartGammaLevels: ProfessionalGammaLevel[] = useMemo(() => {
    if (!gammaData) return [];
    return [
      { price: gammaData.callWall, type: 'call_wall' as const, label: 'Call Wall' },
      { price: gammaData.putWall, type: 'put_wall' as const, label: 'Put Wall' },
      { price: gammaData.maxPain, type: 'max_pain' as const, label: 'Max Pain' },
      { price: gammaData.gammaFlip, type: 'zero_gamma' as const, label: 'Gamma Flip' },
    ].filter((l) => isValidPrice(l.price));
  }, [gammaData]);

  // ==========================================================================
  // Render
  // ==========================================================================

  return (
    <div className="h-screen w-full flex flex-col overflow-hidden bg-[#0b0e11]">
      {/* TOP BAR - Minimal */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#131722] border-b border-[#2a2e39]">
        {/* LEFT: Market Status */}
        <div className="hidden sm:flex items-center gap-4">
          {marketStatus?.spy && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-[#787b86]">SPY</span>
              <span className="font-mono font-semibold text-[#d1d4dc]">
                {formatDollarPrice(marketStatus.spy.price)}
              </span>
              <span
                className={cn(
                  'font-mono',
                  isValidNumber(marketStatus.spy.change) && marketStatus.spy.change >= 0
                    ? 'text-[#26a69a]'
                    : 'text-[#ef5350]'
                )}
              >
                {formatPercent(marketStatus.spy.change)}
              </span>
            </div>
          )}
        </div>

        {/* CENTER: Mode + Symbol + Countdown */}
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-[#1e222d] p-0.5">
            <ModeButton mode="scan" currentMode={mode} onClick={() => setMode('scan')} icon={<Eye className="w-3.5 h-3.5" />} />
            <ModeButton mode="focus" currentMode={mode} onClick={() => setMode('focus')} icon={<Crosshair className="w-3.5 h-3.5" />} />
            <ModeButton mode="trade" currentMode={mode} onClick={() => setMode('trade')} icon={<Target className="w-3.5 h-3.5" />} disabled={!activeTrade} />
          </div>

          {selectedSymbol && (
            <div className="flex items-center gap-2 px-3 py-1 bg-[#1e222d] border border-[#2a2e39]">
              <span className="font-bold text-[#d1d4dc]">{selectedSymbol}</span>
              <span className="font-mono text-sm text-[#d1d4dc]">
                {formatDollarPrice(currentQuote?.last_price)}
              </span>
              <span
                className={cn(
                  'text-xs font-mono',
                  isValidNumber(currentQuote?.change_percent) && currentQuote!.change_percent >= 0
                    ? 'text-[#26a69a]'
                    : 'text-[#ef5350]'
                )}
              >
                {formatPercent(currentQuote?.change_percent)}
              </span>
            </div>
          )}

          {/* Candle Countdown */}
          {selectedSymbol && <CandleCountdown timeframeMinutes={timeframeMinutes} />}

          {/* Timeframe Selector */}
          <div className="flex items-center bg-[#1e222d] p-0.5">
            <button
              onClick={() => setChartTimeframe('2min')}
              className={cn(
                'px-2 py-1 text-xs font-semibold transition-colors',
                chartTimeframe === '2min' ? 'bg-[#26a69a] text-white' : 'text-[#787b86] hover:text-[#d1d4dc]'
              )}
            >
              2m
            </button>
            <button
              onClick={() => setChartTimeframe('5min')}
              className={cn(
                'px-2 py-1 text-xs font-semibold transition-colors',
                chartTimeframe === '5min' ? 'bg-[#26a69a] text-white' : 'text-[#787b86] hover:text-[#d1d4dc]'
              )}
            >
              5m
            </button>
          </div>
        </div>

        {/* RIGHT: Actions */}
        <div className="flex items-center gap-2">
          {readySetups.length > 0 && (
            <span className="flex items-center gap-1 px-2 py-1 bg-[#26a69a]/20 text-[#26a69a] text-xs font-bold animate-pulse">
              <Zap className="w-3 h-3" />
              {readySetups.length} Ready
            </span>
          )}

          <Button variant="ghost" size="sm" onClick={refreshAll} disabled={refreshing} className="h-7 w-7 p-0 text-[#787b86] hover:text-[#d1d4dc]">
            <RefreshCw className={cn('w-3.5 h-3.5', refreshing && 'animate-spin')} />
          </Button>

          <Button variant="ghost" size="sm" onClick={() => setSoundEnabled(!soundEnabled)} className="h-7 w-7 p-0 text-[#787b86] hover:text-[#d1d4dc]">
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          </Button>

          <div
            className={cn(
              'flex items-center gap-1.5 px-2 py-1 text-xs font-semibold uppercase tracking-wider',
              connectionStatus === 'live' && 'bg-[#26a69a]/10 text-[#26a69a]',
              connectionStatus === 'degraded' && 'bg-[#f59e0b]/10 text-[#f59e0b]',
              connectionStatus === 'offline' && 'bg-[#ef5350]/10 text-[#ef5350]'
            )}
            title={
              connectionStatus === 'live'
                ? 'Full realtime via Redis pub/sub'
                : connectionStatus === 'degraded'
                  ? 'Single-server mode, polling recommended'
                  : 'Disconnected'
            }
          >
            <Radio className={cn('w-3 h-3', connectionStatus === 'live' && 'animate-pulse')} />
            {connectionStatus === 'live' ? 'LIVE' : connectionStatus === 'degraded' ? 'POLLING' : 'OFFLINE'}
          </div>
        </div>
      </div>

      {/* MAIN CONTENT - Chart + Confluence Panel + HUD */}
      <div className="flex-1 flex min-h-0">
        {/* LEFT: Chart Area */}
        <div className="flex-1 h-full flex min-w-0">
          {/* Chart Container */}
          <div className="flex-1 h-full relative min-w-0">
            {selectedSymbol ? (
              <>
                {!chartLoading && chartData.length > 0 && (
                  <ProfessionalChart
                    ref={chartRef}
                    data={chartData}
                    symbol={selectedSymbol}
                    levels={chartLevels}
                    gammaLevels={chartGammaLevels}
                    showVolume={true}
                    showIndicators={true}
                    height="100%"
                  />
                )}

              {/* Debug overlay for validating tick bucketing (env-controlled) */}
              {showDebugOverlay && selectedSymbol && debugInfo.lastTickTs && (
                <div className="absolute top-12 left-3 z-20 bg-black/80 border border-yellow-500/50 p-2 text-[10px] font-mono text-yellow-400">
                  <div className="font-semibold text-yellow-300 mb-1">CHART DEBUG</div>
                  <div>Last Tick: {new Date(debugInfo.lastTickTs * 1000).toLocaleTimeString()}</div>
                  <div>Bucket Start: {debugInfo.currentBucketStart ? new Date(debugInfo.currentBucketStart * 1000).toLocaleTimeString() : 'N/A'}</div>
                  <div>Last Candle: {debugInfo.lastCandleTime ? new Date(debugInfo.lastCandleTime * 1000).toLocaleTimeString() : 'N/A'}</div>
                  <div className="mt-1 text-[9px] text-yellow-500">
                    Timeframe: {chartTimeframe} ({TIMEFRAME_SECONDS[chartTimeframe === '2min' ? '2m' : '5m']}s)
                  </div>
                </div>
              )}

              {chartLoading && (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-8 h-8 border-2 border-[#26a69a] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-[#787b86] text-sm font-mono">Loading {selectedSymbol}...</p>
                  </div>
                </div>
              )}

              {chartError && !chartLoading && chartData.length === 0 && (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-[#d1d4dc] font-semibold mb-2">{selectedSymbol}</p>
                    <p className="text-[#787b86] mb-3">{chartError}</p>
                    <button
                      onClick={() => fetchChartData(selectedSymbol, chartTimeframe)}
                      className="px-4 py-2 bg-[#26a69a] text-white text-sm font-semibold hover:bg-[#26a69a]/80"
                    >
                      Retry
                    </button>
                  </div>
                </div>
              )}
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-center">
                  <Crosshair className="w-12 h-12 mx-auto mb-4 text-[#787b86]" />
                  <p className="text-[#787b86]">Select a symbol from the watchlist</p>
                </div>
              </div>
            )}
          </div>

          {/* Confluence Panel - Between Chart and HUD */}
          {selectedSymbol && (ltp2Score || ltpAnalysis) && (
            <ConfluencePanel
              ltp2Score={ltp2Score}
              ltpAnalysis={ltpAnalysis}
              currentPrice={effectivePrice}
              vwap={effectiveVwap}
            />
          )}
        </div>

        {/* RIGHT: HUD Sidebar (fixed width) */}
        <div className="w-[280px] h-full flex flex-col border-l border-[#2a2e39] bg-[#131722] overflow-hidden shrink-0">
          {/* LTP Score Panel */}
          <div className="p-3 border-b border-[#2a2e39] shrink-0">
            {selectedSymbol && (ltp2Score || ltpAnalysis) ? (
              <CompanionHUD
                ltp2Score={ltp2Score}
                ltpAnalysis={ltpAnalysis}
                gammaRegime={gammaData?.regime || null}
                currentPrice={effectivePrice}
                vwap={effectiveVwap}
                isSpeaking={someshVoice.isSpeaking}
                showScoreBreakdown={true}
                callWall={gammaData?.callWall}
                putWall={gammaData?.putWall}
              />
            ) : (
              <div className="text-center py-6">
                <Gauge className="w-8 h-8 mx-auto mb-2 text-[#787b86]" />
                <p className="text-xs text-[#787b86]">Select a symbol for LTP analysis</p>
              </div>
            )}
          </div>

          {/* Watchlist Panel */}
          <div className="flex-1 p-3 border-b border-[#2a2e39] min-h-0 overflow-y-auto">
            <CompanionWatchlist
              watchlist={watchlist}
              setups={setups}
              selectedSymbol={selectedSymbol}
              onSelectSymbol={setSelectedSymbol}
              onAddSymbol={addSymbol}
              onRemoveSymbol={removeSymbol}
              loading={loading}
            />
          </div>

          {/* Coach Box */}
          <div className="p-3 flex-1 min-h-0 overflow-y-auto">
            <CompanionCoachBox
              messages={coachingMessages}
              expanded={true}
              onToggle={() => {}}
              alertType={lastAlertType}
              selectedSymbol={selectedSymbol}
              mode={mode}
              sidebarMode={true}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
