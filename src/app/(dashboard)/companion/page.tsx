'use client';

// Force dynamic rendering to prevent prerender errors with useSearchParams
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useAIContext } from '@/components/ai';
import { cn } from '@/lib/utils';
import { useCompanionStream, type CompanionEvent } from '@/hooks/useCompanionStream';
import { useCompanionData } from '@/hooks/useCompanionData';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import {
  CompanionSessionReport,
  CompanionWatchlist,
  CompanionHUD,
  CompanionCoachBox,
  type WatchlistSymbol,
  type DetectedSetup,
} from '@/components/companion';
import { KCUChart, type Candle, type Level, type GammaLevel, type FVGZone } from '@/components/charts';
import {
  kcuCoachingRules,
  getMarketSession,
  calculateRMultiple,
  type CoachingMessage,
  type CoachingContext,
  type StructureBreakContext,
} from '@/lib/kcu-coaching-rules';
import type { LTPAnalysis } from '@/lib/market-data';

// Type for Polygon API bar data
interface PolygonBar {
  timestamp?: number;
  time?: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}
import {
  calculateLTP2Score,
  createMarketContext,
  calculateEMA,
  type LTP2Score,
  type MarketContext,
} from '@/lib/ltp-gamma-engine';
import { useSomeshVoice, type VoiceTrigger } from '@/hooks/useSomeshVoice';
import {
  Plus,
  X,
  TrendingUp,
  TrendingDown,
  Target,
  Eye,
  Zap,
  Clock,
  AlertTriangle,
  RefreshCw,
  Radio,
  Crosshair,
  Gauge,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  Settings,
  MessageSquare,
  Sparkles,
  Shield,
  Activity,
} from 'lucide-react';

// ============================================================================
// TYPES (Additional types not exported from components)
// ============================================================================

interface MarketQuote {
  last_price: number;
  change_percent: number;
  volume: number;
  vwap: number;
  orb_high: number;
  orb_low: number;
}

interface MarketStatus {
  spy: { price: number; change: number };
  qqq: { price: number; change: number };
  vix?: { price: number; change: number };
  isOpen: boolean;
  timeToClose: string;
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

interface ChartCandle extends Candle {
  timestamp: number;
}

// ============================================================================
// MAIN COMPONENT - CHART-FIRST TERMINAL
// ============================================================================

export default function CompanionTerminal() {
  // URL & AI Context Management
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { updatePageContext, setSelectedSymbol: setAISelectedSymbol } = useAIContext();

  // Get symbol from URL query params
  const urlSymbol = searchParams.get('symbol')?.toUpperCase() || null;

  // Data layer via custom hook
  const {
    watchlist,
    setups,
    readySetups,
    marketStatus,
    isLoading: loading,
    isRefreshing: refreshing,
    refresh: refreshData,
    refetchWatchlist,
  } = useCompanionData({
    pollInterval: 30000,
    autoPolling: true,
  });

  // Session state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const sessionStartTime = useRef<Date | null>(null);

  // Selected symbol is driven by URL
  const selectedSymbol = urlSymbol;

  // Function to update selected symbol via URL
  const setSelectedSymbol = useCallback((symbol: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (symbol) {
      params.set('symbol', symbol);
    } else {
      params.delete('symbol');
    }
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }, [searchParams, router, pathname]);

  // Mode and coaching state
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
  const [chartLevels, setChartLevels] = useState<Level[]>([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartError, setChartError] = useState<string | null>(null);

  // Timeframe state (2-min vs 5-min per KCU rules)
  type ChartTimeframe = '2min' | '5min';
  const [chartTimeframe, setChartTimeframe] = useState<ChartTimeframe>('5min');

  // KCU Rule: Use 2-min during first 60 minutes after market open, 5-min otherwise
  const getRecommendedTimeframe = useCallback((): ChartTimeframe => {
    const now = new Date();
    const etTime = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(now);

    const [hours, minutes] = etTime.split(':').map(Number);
    const minutesSinceOpen = (hours - 9) * 60 + (minutes - 30);

    // First 60 minutes after market open (9:30-10:30 AM ET): use 2-min for faster entries
    if (minutesSinceOpen >= 0 && minutesSinceOpen < 60) {
      return '2min';
    }
    // Rest of day: use 5-min for more stability
    return '5min';
  }, []);

  // Set recommended timeframe on mount and when market session changes
  useEffect(() => {
    const recommended = getRecommendedTimeframe();
    setChartTimeframe(recommended);
  }, [getRecommendedTimeframe]);

  // UI state
  const [coachBoxExpanded, setCoachBoxExpanded] = useState(true);
  // NOTE: Watchlist expanded state is now managed internally by CompanionWatchlist component
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [lastAlertType, setLastAlertType] = useState<'patience' | 'entry' | 'warning' | null>(null);

  // LTP 2.0 state
  const [ltp2Score, setLtp2Score] = useState<LTP2Score | null>(null);
  const [flashEffect, setFlashEffect] = useState<'sniper' | 'warning' | 'gamma' | null>(null);
  const prevGammaStateRef = useRef<{ nearCallWall: boolean; nearPutWall: boolean; crossedZeroGamma: boolean }>({
    nearCallWall: false,
    nearPutWall: false,
    crossedZeroGamma: false,
  });
  const prevVwapStateRef = useRef<boolean | null>(null);

  const { showToast } = useToast();

  // Somesh Voice Integration
  const someshVoice = useSomeshVoice({
    enabled: soundEnabled,
    volume: 0.8,
    rate: 1.0,
    cooldownMs: 30000,
  });

  // Get current market session
  const marketSession = useMemo(() => getMarketSession(), []);

  // Current quote (needed for LTP 2.0 effects)
  const currentQuote = useMemo(() => {
    if (!selectedSymbol) return null;
    return watchlist.find(w => w.symbol === selectedSymbol)?.quote || null;
  }, [selectedSymbol, watchlist]);

  // Calculate VWAP from chart data as fallback when API doesn't provide it
  const chartCalculatedVwap = useMemo(() => {
    if (chartData.length === 0) return 0;

    let cumulativeTPV = 0;
    let cumulativeVolume = 0;

    for (const candle of chartData) {
      const typicalPrice = (candle.high + candle.low + candle.close) / 3;
      const volume = candle.volume || 1;
      cumulativeTPV += typicalPrice * volume;
      cumulativeVolume += volume;
    }

    return cumulativeVolume > 0 ? cumulativeTPV / cumulativeVolume : 0;
  }, [chartData]);

  // Use chart VWAP as fallback when API doesn't provide
  const effectiveVwap = currentQuote?.vwap || chartCalculatedVwap;

  // Use chart's last close as fallback when quote unavailable
  const effectivePrice = currentQuote?.last_price || chartData[chartData.length - 1]?.close || 0;

  // ============================================================================
  // SSE EVENT HANDLER - LIVE UPDATES
  // ============================================================================

  const handleStreamEvent = useCallback((event: CompanionEvent) => {
    if (event.type === 'setup_forming' || event.type === 'setup_ready') {
      // Trigger a refresh to get the latest setups from the backend
      // The hook will update the setups state
      refreshData();

      // Flash for setup alerts
      if (event.type === 'setup_ready') {
        setLastAlertType('entry');
        setTimeout(() => setLastAlertType(null), 2000);
      }
    } else if (event.type === 'price_update') {
      // Price updates are handled by the hook's polling
      // Here we only update the chart for the selected symbol

      // If this is the selected symbol, add to chart data
      if (event.data.symbol === selectedSymbol) {
        // Validate price data before updating chart
        const price = event.data.price;
        if (price == null || !isFinite(price)) return;

        const now = Math.floor(Date.now() / 1000);
        const newCandle: ChartCandle = {
          time: now,
          timestamp: now,
          open: price,
          high: price,
          low: price,
          close: price,
          volume: event.data.volume || 0,
        };

        setChartData(prev => {
          // Update last candle or add new one (for live updates)
          if (prev.length > 0) {
            const lastCandle = prev[prev.length - 1];
            // If within same minute, update the candle
            if (now - (lastCandle.time as number) < 60) {
              const updated = [...prev];
              updated[updated.length - 1] = {
                ...lastCandle,
                high: Math.max(lastCandle.high, event.data.price),
                low: Math.min(lastCandle.low, event.data.price),
                close: event.data.price,
                volume: (lastCandle.volume || 0) + event.data.volume,
              };
              return updated;
            }
          }
          return [...prev, newCandle];
        });
      }
    }
  }, [selectedSymbol, refreshData]);

  const { connected: streamConnected, error: streamError } = useCompanionStream({
    onEvent: handleStreamEvent,
  });

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  // NOTE: fetchWatchlist, fetchSetups, and fetchMarketStatus are now handled by useCompanionData hook

  const fetchChartData = async (symbol: string, timeframe: ChartTimeframe = chartTimeframe) => {
    setChartLoading(true);
    setChartError(null);
    const multiplier = timeframe === '2min' ? 2 : 5;
    try {
      const res = await fetch(`/api/market/bars?symbol=${symbol}&timespan=minute&multiplier=${multiplier}&limit=500`);
      if (res.ok) {
        const data = await res.json();
        if (data.bars && data.bars.length > 0) {
          // Convert timestamps and filter out invalid bars
          const validBars = data.bars
            .filter((c: PolygonBar) =>
              c.open != null && isFinite(c.open) &&
              c.high != null && isFinite(c.high) &&
              c.low != null && isFinite(c.low) &&
              c.close != null && isFinite(c.close) &&
              (c.timestamp != null || c.time != null)
            )
            .map((c: PolygonBar) => {
              const ts = c.timestamp || c.time || 0;
              // Convert ms to seconds if needed (lightweight-charts expects seconds)
              const timeInSeconds = ts > 1e12 ? Math.floor(ts / 1000) : ts;
              return {
                time: timeInSeconds,
                timestamp: timeInSeconds,
                open: c.open,
                high: c.high,
                low: c.low,
                close: c.close,
                volume: c.volume || 0,
              };
            });
          setChartData(validBars);
          setChartError(null);
        } else {
          setChartData([]);
          setChartError('No market data available for this symbol');
        }
      } else {
        const errorData = await res.json().catch(() => ({}));
        const errorMsg = errorData.error || `Failed to fetch data (${res.status})`;
        setChartError(errorMsg);
        console.error('Chart API error:', errorMsg);
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
    // Clear stale data before fetching new data
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

        // Build chart levels from LTP analysis response (syncs with AI scoring engine)
        const levels: Level[] = [];

        // Add key levels with proper styling - validate price > 0 to avoid invalid levels
        if (data.levels?.pdh != null && isFinite(data.levels.pdh) && data.levels.pdh > 0) {
          levels.push({ price: data.levels.pdh, label: 'PDH', type: 'resistance', color: '#ef4444' });
        }
        if (data.levels?.pdl != null && isFinite(data.levels.pdl) && data.levels.pdl > 0) {
          levels.push({ price: data.levels.pdl, label: 'PDL', type: 'support', color: '#22c55e' });
        }
        if (data.levels?.vwap != null && isFinite(data.levels.vwap) && data.levels.vwap > 0) {
          levels.push({ price: data.levels.vwap, label: 'VWAP', type: 'vwap', color: '#f59e0b' });
        }
        if (data.levels?.orbHigh != null && isFinite(data.levels.orbHigh) && data.levels.orbHigh > 0) {
          levels.push({ price: data.levels.orbHigh, label: 'ORB High', type: 'resistance', color: '#8b5cf6', lineStyle: 'dashed' });
        }
        if (data.levels?.orbLow != null && isFinite(data.levels.orbLow) && data.levels.orbLow > 0) {
          levels.push({ price: data.levels.orbLow, label: 'ORB Low', type: 'support', color: '#8b5cf6', lineStyle: 'dashed' });
        }
        if (data.levels?.sma200 != null && isFinite(data.levels.sma200) && data.levels.sma200 > 0) {
          levels.push({ price: data.levels.sma200, label: 'SMA 200', type: 'custom', color: '#f97316', lineStyle: 'dotted' });
        }
        // Premarket High/Low (PMH/PML)
        if (data.levels?.pmh != null && isFinite(data.levels.pmh) && data.levels.pmh > 0) {
          levels.push({ price: data.levels.pmh, label: 'PMH', type: 'resistance', color: '#ec4899', lineStyle: 'dashed' });
        }
        if (data.levels?.pml != null && isFinite(data.levels.pml) && data.levels.pml > 0) {
          levels.push({ price: data.levels.pml, label: 'PML', type: 'support', color: '#ec4899', lineStyle: 'dashed' });
        }

        setChartLevels(levels);
      } else {
        console.warn(`[Companion] LTP analysis unavailable for ${symbol}: ${ltpRes.status}`);
        setChartLevels([]); // Clear levels if LTP data unavailable
      }
      if (gammaRes.ok) {
        const data = await gammaRes.json();
        setGammaData(data);
      } else {
        // Gamma data may not be available for all symbols (requires options chain)
        console.warn(`[Companion] Gamma data unavailable for ${symbol}: ${gammaRes.status}`);
      }
      if (fvgRes.ok) {
        const data = await fvgRes.json();
        setFvgData(data);
      } else {
        console.warn(`[Companion] FVG data unavailable for ${symbol}: ${fvgRes.status}`);
      }

      // Update coaching messages
      updateCoachingMessages(symbol);
    } catch (error) {
      console.error('Error fetching analysis:', error);
      showToast({
        type: 'error',
        title: 'Analysis Failed',
        message: 'Failed to load LTP analysis data. Please try again.',
      });
    } finally {
      setAnalysisLoading(false);
    }
  };

  const updateCoachingMessages = useCallback((symbol: string) => {
    const watchlistItem = watchlist.find(w => w.symbol === symbol);
    const currentPrice = watchlistItem?.quote?.last_price || 0;

    const context: CoachingContext = {
      symbol,
      currentPrice,
      ltpAnalysis,
      gammaData: gammaData ? {
        regime: gammaData.regime,
        maxPain: gammaData.maxPain,
        callWall: gammaData.callWall,
        putWall: gammaData.putWall,
        gammaFlip: gammaData.gammaFlip,
        dealerPositioning: gammaData.dealerPositioning,
      } : null,
      fvgData: fvgData ? {
        nearestBullish: fvgData.nearestBullishFVG ? {
          price: fvgData.nearestBullishFVG.midPrice,
          distance: Math.abs(currentPrice - fvgData.nearestBullishFVG.midPrice) / currentPrice * 100
        } : null,
        nearestBearish: fvgData.nearestBearishFVG ? {
          price: fvgData.nearestBearishFVG.midPrice,
          distance: Math.abs(currentPrice - fvgData.nearestBearishFVG.midPrice) / currentPrice * 100
        } : null,
        supportZones: [],
        resistanceZones: [],
      } : null,
      activeTrade: activeTrade ? {
        ...activeTrade,
        currentRMultiple: calculateRMultiple(
          activeTrade.entryPrice,
          currentPrice,
          activeTrade.stopLoss,
          activeTrade.direction
        )
      } : null,
      mode,
      marketSession,
    };

    const messages = kcuCoachingRules.getCoachingMessages(context);
    setCoachingMessages(messages);

    // Check for alert types and flash
    const hasPatience = messages.some(m => m.title.includes('Patience') || m.title.includes('⏳'));
    const hasEntry = messages.some(m => m.title.includes('GO TIME') || m.title.includes('🚀') || m.title.includes('SNIPER'));
    const hasWarning = messages.some(m => m.type === 'warning' && m.priority === 'high');

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
  }, [watchlist, ltpAnalysis, gammaData, fvgData, activeTrade, mode, marketSession]);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  useEffect(() => {
    const startSession = async () => {
      try {
        const res = await fetch('/api/companion/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
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
          body: JSON.stringify({ sessionId, action: 'end' })
        }).catch(() => {});
      }
    };
  }, []);

  // NOTE: Data fetching and polling is now handled by useCompanionData hook

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSymbol, chartTimeframe]);

  useEffect(() => {
    if (selectedSymbol && ltpAnalysis) {
      updateCoachingMessages(selectedSymbol);
    }
  }, [selectedSymbol, ltpAnalysis, updateCoachingMessages]);

  // AI Context Sync - Keep AI aware of current analysis (debounced to prevent thrashing)
  useEffect(() => {
    // Sync selected symbol to global AI context immediately
    setAISelectedSymbol(selectedSymbol || undefined);

    // Debounce the page context update to prevent re-render storms from price ticks
    const timeoutId = setTimeout(() => {
      // Update page context with relevant data
      const pageData: Record<string, unknown> = {
        watchlistSymbols: watchlist.map(w => w.symbol),
        focusedSymbol: selectedSymbol,
      };

      // Add analysis data when available
      if (selectedSymbol && (ltpAnalysis || ltp2Score)) {
        pageData.ltpGrade = ltp2Score?.grade || ltpAnalysis?.grade || null;
        pageData.trendScore = ltp2Score?.breakdown?.cloudScore || ltpAnalysis?.trend?.trendScore || 0;
        pageData.currentPrice = effectivePrice;
        pageData.gammaRegime = gammaData?.regime || null;
        pageData.vwap = effectiveVwap;
      }

      updatePageContext('companion', pageData);
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [
    selectedSymbol,
    ltpAnalysis,
    ltp2Score,
    gammaData,
    currentQuote,
    effectivePrice,
    effectiveVwap,
    watchlist,
    setAISelectedSymbol,
    updatePageContext,
  ]);

  // LTP 2.0 Score Calculation Effect
  useEffect(() => {
    if (!selectedSymbol || !gammaData || chartData.length < 21) {
      setLtp2Score(null);
      return;
    }

    const currentPrice = currentQuote?.last_price || chartData[chartData.length - 1]?.close || 0;
    if (currentPrice === 0) return;

    // Calculate EMAs from chart data
    const closePrices = chartData.map(c => c.close);
    const ema8 = calculateEMA(closePrices, 8);
    const ema21 = calculateEMA(closePrices, 21);
    const vwap = effectiveVwap || currentPrice;

    // Check for patience candle (inside bar)
    const hasPatienceCandle = chartData.length >= 2 &&
      chartData[chartData.length - 1].high < chartData[chartData.length - 2].high &&
      chartData[chartData.length - 1].low > chartData[chartData.length - 2].low;

    const patienceDirection = hasPatienceCandle
      ? (chartData[chartData.length - 1].close > chartData[chartData.length - 1].open ? 'bullish' : 'bearish')
      : undefined;

    // Create market context
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

    // Calculate LTP 2.0 score
    const newScore = calculateLTP2Score(marketContext);
    setLtp2Score(newScore);

    // Trigger voice alerts based on score
    someshVoice.checkScore(newScore);

    // Check for flash effects
    if (newScore.grade === 'Sniper') {
      setFlashEffect('sniper');
      setTimeout(() => setFlashEffect(null), 2000);
    } else if (newScore.grade === 'Dumb Shit' && newScore.score < 30) {
      setFlashEffect('warning');
      setTimeout(() => setFlashEffect(null), 1500);
    }
  }, [selectedSymbol, gammaData, chartData, currentQuote, effectiveVwap, someshVoice]);

  // Gamma Proximity & VWAP Cross Voice Triggers
  useEffect(() => {
    if (!selectedSymbol || !gammaData || !currentQuote?.last_price) return;

    const currentPrice = currentQuote.last_price;
    const vwap = currentQuote.vwap || currentPrice;

    // Check Call Wall proximity (within 1%)
    const nearCallWall = currentPrice > gammaData.callWall * 0.99;
    const wasNearCallWall = prevGammaStateRef.current.nearCallWall;

    // Check Put Wall proximity (within 1%)
    const nearPutWall = currentPrice < gammaData.putWall * 1.01;
    const wasNearPutWall = prevGammaStateRef.current.nearPutWall;

    // Check Zero Gamma cross
    const crossedZeroGamma = Math.abs(currentPrice - gammaData.gammaFlip) / currentPrice < 0.005; // Within 0.5%
    const wasCrossedZeroGamma = prevGammaStateRef.current.crossedZeroGamma;

    // Trigger voice alerts
    someshVoice.onCallWallProximity(nearCallWall, wasNearCallWall);
    someshVoice.onPutWallProximity(nearPutWall, wasNearPutWall);
    someshVoice.onZeroGammaCross(crossedZeroGamma, wasCrossedZeroGamma);

    // Check VWAP cross
    const aboveVwap = currentPrice > vwap;
    if (prevVwapStateRef.current !== null) {
      someshVoice.onVWAPCross(aboveVwap, prevVwapStateRef.current);
    }

    // Flash effect for gamma events
    if (crossedZeroGamma && !wasCrossedZeroGamma) {
      setFlashEffect('gamma');
      setTimeout(() => setFlashEffect(null), 1500);
    }

    // Update prev state
    prevGammaStateRef.current = { nearCallWall, nearPutWall, crossedZeroGamma };
    prevVwapStateRef.current = aboveVwap;
  }, [selectedSymbol, gammaData, currentQuote, someshVoice]);

  // ============================================================================
  // ACTIONS
  // ============================================================================

  const addSymbol = useCallback(async (symbol: string) => {
    if (!symbol.trim()) return;
    try {
      const res = await fetch('/api/companion/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: symbol.trim().toUpperCase() })
      });
      if (res.ok) {
        refetchWatchlist();
      }
    } catch (error) {
      console.error('Error adding symbol:', error);
    }
  }, [refetchWatchlist]);

  const removeSymbol = useCallback(async (symbol: string) => {
    try {
      await fetch(`/api/companion/watchlist?symbol=${symbol}`, { method: 'DELETE' });
      if (selectedSymbol === symbol) {
        setSelectedSymbol(null);
      }
      refetchWatchlist();
    } catch (error) {
      console.error('Error removing symbol:', error);
    }
  }, [selectedSymbol, setSelectedSymbol, refetchWatchlist]);

  const refreshAll = useCallback(async () => {
    try {
      // Trigger cache refresh on backend
      await fetch('/api/companion/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshAll: true })
      });

      // Refresh data via hook
      await refreshData();

      // Refresh symbol-specific data if selected
      if (selectedSymbol) {
        await fetchLTPAnalysis(selectedSymbol);
        await fetchChartData(selectedSymbol, chartTimeframe);
      }
    } catch (error) {
      console.error('Error refreshing:', error);
    }
  }, [refreshData, selectedSymbol, chartTimeframe]);

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  // NOTE: readySetups and formingSetups are now returned from useCompanionData hook

  // Convert gamma data to chart gamma levels
  const chartGammaLevels: GammaLevel[] = useMemo(() => {
    if (!gammaData) return [];
    return [
      { price: gammaData.callWall, type: 'call_wall' as const, label: 'Call Wall' },
      { price: gammaData.putWall, type: 'put_wall' as const, label: 'Put Wall' },
      { price: gammaData.maxPain, type: 'max_pain' as const, label: 'Max Pain' },
      { price: gammaData.gammaFlip, type: 'zero_gamma' as const, label: 'Gamma Flip' },
    ].filter(l => l.price != null && !isNaN(l.price) && l.price > 0);
  }, [gammaData]);

  // Convert FVG data to chart zones
  const chartFvgZones: FVGZone[] = useMemo(() => {
    if (!fvgData) return [];
    const zones: FVGZone[] = [];
    const now = Math.floor(Date.now() / 1000);

    if (fvgData.nearestBullishFVG &&
        fvgData.nearestBullishFVG.topPrice != null && !isNaN(fvgData.nearestBullishFVG.topPrice) &&
        fvgData.nearestBullishFVG.bottomPrice != null && !isNaN(fvgData.nearestBullishFVG.bottomPrice)) {
      zones.push({
        startTime: now - 86400,
        endTime: now,
        high: fvgData.nearestBullishFVG.topPrice,
        low: fvgData.nearestBullishFVG.bottomPrice,
        direction: 'bullish',
      });
    }
    if (fvgData.nearestBearishFVG &&
        fvgData.nearestBearishFVG.topPrice != null && !isNaN(fvgData.nearestBearishFVG.topPrice) &&
        fvgData.nearestBearishFVG.bottomPrice != null && !isNaN(fvgData.nearestBearishFVG.bottomPrice)) {
      zones.push({
        startTime: now - 86400,
        endTime: now,
        high: fvgData.nearestBearishFVG.topPrice,
        low: fvgData.nearestBearishFVG.bottomPrice,
        direction: 'bearish',
      });
    }
    return zones;
  }, [fvgData]);

  // ============================================================================
  // RENDER - CHART-FIRST TERMINAL
  // ============================================================================

  // Mobile overlay states
  const [mobileWatchlistOpen, setMobileWatchlistOpen] = useState(false);
  const [mobileCoachOpen, setMobileCoachOpen] = useState(false);

  return (
    <div className="h-[calc(100dvh-4rem)] flex flex-col overflow-hidden bg-[#0d0d0d]">
      {/* MINIMAL TOP BAR */}
      <div className="flex items-center justify-between px-2 sm:px-4 py-2 bg-[var(--bg-secondary)] border-b border-[var(--border-primary)]">
        {/* LEFT: Market Status (hidden on mobile) */}
        <div className="hidden sm:flex items-center gap-4">
          {marketStatus?.spy && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-[var(--text-tertiary)]">SPY</span>
              <span className="font-mono font-semibold text-[var(--text-primary)]">${marketStatus.spy.price.toFixed(2)}</span>
              <span className={cn(
                'font-mono',
                marketStatus.spy.change >= 0 ? 'text-[var(--success)]' : 'text-[var(--error)]'
              )}>
                {marketStatus.spy.change >= 0 ? '+' : ''}{marketStatus.spy.change.toFixed(2)}%
              </span>
            </div>
          )}
          {marketStatus?.qqq && (
            <div className="hidden md:flex items-center gap-2 text-xs">
              <span className="text-[var(--text-tertiary)]">QQQ</span>
              <span className="font-mono font-semibold text-[var(--text-primary)]">${marketStatus.qqq.price.toFixed(2)}</span>
              <span className={cn(
                'font-mono',
                marketStatus.qqq.change >= 0 ? 'text-[var(--success)]' : 'text-[var(--error)]'
              )}>
                {marketStatus.qqq.change >= 0 ? '+' : ''}{marketStatus.qqq.change.toFixed(2)}%
              </span>
            </div>
          )}
        </div>

        {/* CENTER: Mode + Selected Symbol */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-[var(--bg-tertiary)] p-0.5 rounded">
            <ModeButton mode="scan" currentMode={mode} onClick={() => setMode('scan')} icon={<Eye className="w-3.5 h-3.5" />} />
            <ModeButton mode="focus" currentMode={mode} onClick={() => setMode('focus')} icon={<Crosshair className="w-3.5 h-3.5" />} />
            <ModeButton mode="trade" currentMode={mode} onClick={() => setMode('trade')} icon={<Target className="w-3.5 h-3.5" />} disabled={!activeTrade} />
          </div>

          {selectedSymbol && (
            <div className="flex items-center gap-2 px-3 py-1 bg-[var(--bg-tertiary)] rounded">
              <span className="font-bold text-[var(--text-primary)]">{selectedSymbol}</span>
              {currentQuote ? (
                <>
                  <span className="font-mono text-sm text-[var(--text-primary)]">${currentQuote.last_price.toFixed(2)}</span>
                  <span className={cn(
                    'text-xs font-mono',
                    currentQuote.change_percent >= 0 ? 'text-[var(--success)]' : 'text-[var(--error)]'
                  )}>
                    {currentQuote.change_percent >= 0 ? '+' : ''}{currentQuote.change_percent.toFixed(2)}%
                  </span>
                </>
              ) : (
                <span className="text-xs text-[var(--text-tertiary)] animate-pulse">Loading...</span>
              )}
            </div>
          )}

          {/* Timeframe Selector - KCU Rules: 2-min first hour, 5-min rest of day */}
          <div className="flex items-center gap-1 bg-[var(--bg-tertiary)] p-0.5 rounded">
            <button
              onClick={() => setChartTimeframe('2min')}
              className={cn(
                'px-2 py-1 text-xs font-semibold rounded transition-colors',
                chartTimeframe === '2min'
                  ? 'bg-[var(--accent-primary)] text-[#0d0d0d]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              )}
              title="2-minute chart - Recommended during first hour after market open"
            >
              2m
            </button>
            <button
              onClick={() => setChartTimeframe('5min')}
              className={cn(
                'px-2 py-1 text-xs font-semibold rounded transition-colors',
                chartTimeframe === '5min'
                  ? 'bg-[var(--accent-primary)] text-[#0d0d0d]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              )}
              title="5-minute chart - Recommended after first hour"
            >
              5m
            </button>
            {getRecommendedTimeframe() === chartTimeframe && (
              <span className="text-[9px] text-[var(--accent-primary)] ml-1" title="KCU-recommended timeframe for current session">
                ★
              </span>
            )}
          </div>
        </div>

        {/* RIGHT: Actions + Status */}
        <div className="flex items-center gap-3">
          {readySetups.length > 0 && (
            <span className="flex items-center gap-1 px-2 py-1 bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] text-xs font-bold rounded animate-pulse">
              <Zap className="w-3 h-3" />
              {readySetups.length} Ready
            </span>
          )}

          <Button variant="ghost" size="sm" onClick={refreshAll} disabled={refreshing} className="h-7 w-7 p-0">
            <RefreshCw className={cn('w-3.5 h-3.5', refreshing && 'animate-spin')} />
          </Button>

          <Button variant="ghost" size="sm" onClick={() => setSoundEnabled(!soundEnabled)} className="h-7 w-7 p-0">
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          </Button>

          <div className={cn(
            'flex items-center gap-1.5 px-2 py-1 text-xs font-semibold uppercase tracking-wider rounded',
            streamConnected
              ? 'bg-[var(--success)]/10 text-[var(--success)]'
              : 'bg-[var(--error)]/10 text-[var(--error)]'
          )}>
            <Radio className={cn('w-3 h-3', streamConnected && 'animate-pulse')} />
            {streamConnected ? 'LIVE' : 'OFFLINE'}
          </div>
        </div>
      </div>

      {/* MAIN CONTENT - SIDEBAR + CHART */}
      <div className="flex-1 flex overflow-hidden min-h-[400px]">
        {/* LEFT SIDEBAR - Desktop Only */}
        <div className="hidden lg:flex flex-col w-80 min-w-80 border-r border-[var(--border-primary)] bg-[var(--bg-secondary)] overflow-hidden">
          {/* LTP2 SCORE PANEL - Always show score breakdown */}
          <div className="p-3 border-b border-[var(--border-primary)] shrink-0">
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
              <div className="text-center py-4">
                <Gauge className="w-6 h-6 mx-auto mb-2 text-[var(--text-tertiary)]" />
                <p className="text-xs text-[var(--text-tertiary)]">Select a symbol for LTP analysis</p>
              </div>
            )}
          </div>

          {/* WATCHLIST PANEL - Scrollable */}
          <div className="flex-1 p-3 border-b border-[var(--border-primary)] min-h-0 overflow-y-auto">
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

          {/* COACH BOX - Bottom of sidebar */}
          <div className="p-3 max-h-48 overflow-y-auto shrink-0">
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

        {/* CHART AREA - Takes remaining width */}
        <div className="flex-1 relative overflow-hidden min-w-0 bg-[#0d0d0d]">
          {/* FLASH EFFECTS - Scoped to chart area only */}
          {flashEffect && (
            <div className={cn(
              'absolute inset-0 z-10 pointer-events-none transition-opacity duration-300',
              flashEffect === 'sniper' && 'animate-pulse bg-[var(--success)]/20',
              flashEffect === 'warning' && 'animate-pulse bg-[var(--error)]/20',
              flashEffect === 'gamma' && 'animate-pulse bg-[#00ffff]/15',
            )} />
          )}

          {selectedSymbol ? (
            <>
              {/* Show chart when we have data */}
              {chartData.length > 0 && !chartLoading && (
                <KCUChart
                  mode="live"
                  data={chartData}
                  levels={chartLevels}
                  gammaLevels={chartGammaLevels}
                  fvgZones={chartFvgZones}
                  symbol={selectedSymbol}
                  showVolume={true}
                  showIndicators={true}
                  showPatienceCandles={true}
                  className="w-full h-full"
                />
              )}

              {/* Loading state */}
              {chartLoading && (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-center">
                    <RefreshCw className="w-8 h-8 mx-auto mb-3 text-[var(--accent-primary)] animate-spin" />
                    <p className="text-[var(--text-secondary)] mb-1">Loading chart for {selectedSymbol}...</p>
                    <p className="text-xs text-[var(--text-tertiary)]">Fetching market data</p>
                  </div>
                </div>
              )}

              {/* Error state */}
              {chartError && !chartLoading && chartData.length === 0 && (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-center max-w-md px-4">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-lg bg-[var(--error)]/10 flex items-center justify-center">
                      <AlertTriangle className="w-8 h-8 text-[var(--error)]" />
                    </div>
                    <p className="text-[var(--text-primary)] font-semibold mb-2">{selectedSymbol}</p>
                    <p className="text-[var(--text-secondary)] mb-3">{chartError}</p>
                    <button
                      onClick={() => fetchChartData(selectedSymbol, chartTimeframe)}
                      className="px-4 py-2 bg-[var(--accent-primary)] text-[#0d0d0d] text-sm font-semibold hover:bg-[var(--accent-primary-hover)] transition-colors"
                    >
                      Retry
                    </button>
                  </div>
                </div>
              )}

              {/* No data but no error (edge case) */}
              {!chartLoading && !chartError && chartData.length === 0 && (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-center">
                    <RefreshCw className="w-8 h-8 mx-auto mb-3 text-[var(--accent-primary)] animate-spin" />
                    <p className="text-[var(--text-secondary)] mb-1">Initializing chart for {selectedSymbol}...</p>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-lg bg-[var(--bg-tertiary)] flex items-center justify-center">
                  <Crosshair className="w-8 h-8 text-[var(--text-tertiary)]" />
                </div>
                <p className="text-[var(--text-secondary)] mb-1">Select a symbol to view chart</p>
                <p className="text-xs text-[var(--text-tertiary)]">Use the sidebar on the left</p>
              </div>
            </div>
          )}
        </div>

        {/* MOBILE TOGGLE BUTTONS - Fixed Bottom Bar */}
        <div className="lg:hidden absolute bottom-4 left-4 right-4 z-20 flex justify-between items-center">
          {/* Left: Watchlist Toggle */}
          <button
            onClick={() => setMobileWatchlistOpen(true)}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg',
              'bg-[#0d0d0d]/90 backdrop-blur border border-[var(--border-primary)]',
              'text-xs font-medium text-[var(--text-primary)]',
              'hover:bg-[var(--bg-tertiary)] transition-colors'
            )}
          >
            <Eye className="w-4 h-4 text-[var(--accent-primary)]" />
            Watchlist
            {readySetups.length > 0 && (
              <span className="w-5 h-5 rounded-full bg-[var(--accent-primary)] text-white text-[10px] font-bold flex items-center justify-center">
                {readySetups.length}
              </span>
            )}
          </button>

          {/* Center: HUD (Mobile Compact) */}
          {selectedSymbol && (ltp2Score || ltpAnalysis) && (
            <div className="pointer-events-auto">
              <CompanionHUD
                ltp2Score={ltp2Score}
                ltpAnalysis={ltpAnalysis}
                gammaRegime={gammaData?.regime || null}
                currentPrice={effectivePrice}
                vwap={effectiveVwap}
                isSpeaking={someshVoice.isSpeaking}
              />
            </div>
          )}

          {/* Right: Coach Toggle (offset left to avoid AICommandCenter) */}
          <button
            onClick={() => setMobileCoachOpen(true)}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg mr-14',
              'bg-[#0d0d0d]/90 backdrop-blur border transition-all duration-300',
              lastAlertType === 'entry'
                ? 'border-[var(--success)] shadow-[0_0_10px_rgba(34,197,94,0.3)]'
                : lastAlertType === 'patience'
                ? 'border-[var(--warning)] shadow-[0_0_10px_rgba(251,191,36,0.3)]'
                : lastAlertType === 'warning'
                ? 'border-[var(--error)] shadow-[0_0_10px_rgba(239,68,68,0.3)]'
                : 'border-[var(--border-primary)]',
              'text-xs font-medium text-[var(--text-primary)]',
              'hover:bg-[var(--bg-tertiary)]',
              lastAlertType && 'animate-pulse'
            )}
          >
            <Sparkles
              className={cn(
                'w-4 h-4',
                lastAlertType === 'entry'
                  ? 'text-[var(--success)]'
                  : lastAlertType === 'patience'
                  ? 'text-[var(--warning)]'
                  : lastAlertType === 'warning'
                  ? 'text-[var(--error)]'
                  : 'text-[var(--accent-primary)]'
              )}
            />
            Coach
          </button>
        </div>

        {/* MOBILE WATCHLIST OVERLAY (Drawer from Left) */}
        {mobileWatchlistOpen && (
          <div className="lg:hidden fixed inset-0 z-50 flex">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setMobileWatchlistOpen(false)}
            />
            {/* Drawer */}
            <div className="relative w-80 max-w-[85vw] h-full bg-[#0d0d0d] border-r border-[var(--border-primary)] animate-in slide-in-from-left duration-300">
              <CompanionWatchlist
                watchlist={watchlist}
                setups={setups}
                selectedSymbol={selectedSymbol}
                onSelectSymbol={(symbol) => {
                  setSelectedSymbol(symbol);
                  setMobileWatchlistOpen(false);
                }}
                onAddSymbol={addSymbol}
                onRemoveSymbol={removeSymbol}
                loading={loading}
                isOverlay={true}
                onClose={() => setMobileWatchlistOpen(false)}
              />
            </div>
          </div>
        )}

        {/* MOBILE COACH OVERLAY (Drawer from Right) */}
        {mobileCoachOpen && (
          <div className="lg:hidden fixed inset-0 z-50 flex justify-end">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setMobileCoachOpen(false)}
            />
            {/* Drawer */}
            <div className="relative w-96 max-w-[90vw] h-full bg-[#0d0d0d] border-l border-[var(--border-primary)] animate-in slide-in-from-right duration-300">
              <CompanionCoachBox
                messages={coachingMessages}
                expanded={true}
                onToggle={() => setMobileCoachOpen(false)}
                alertType={lastAlertType}
                selectedSymbol={selectedSymbol}
                mode={mode}
                isOverlay={true}
                onClose={() => setMobileCoachOpen(false)}
              />
            </div>
          </div>
        )}
      </div>

      {/* SESSION REPORT */}
      <CompanionSessionReport sessionId={sessionId} />
    </div>
  );
}

// ============================================================================
// MODE BUTTON
// ============================================================================

function ModeButton({ mode, currentMode, onClick, icon, disabled = false }: {
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
        'flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded transition-all',
        isActive
          ? 'bg-[var(--accent-primary)] text-white'
          : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      {icon}
      {labels[mode]}
    </button>
  );
}
