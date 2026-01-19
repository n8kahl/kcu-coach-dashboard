'use client';

// Force dynamic rendering to prevent prerender errors with useSearchParams
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { usePageContext } from '@/components/ai';
import { cn } from '@/lib/utils';
import { useCompanionStream, type CompanionEvent } from '@/hooks/useCompanionStream';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { CompanionSessionReport } from '@/components/companion/session-report';
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
// TYPES
// ============================================================================

interface WatchlistSymbol {
  id: string;
  symbol: string;
  added_at: string;
  levels: KeyLevel[];
  quote: MarketQuote | null;
  is_shared: boolean;
}

interface KeyLevel {
  id: string;
  level_type: string;
  timeframe: string;
  price: number;
  strength: number;
  notes: string;
}

interface MarketQuote {
  last_price: number;
  change_percent: number;
  volume: number;
  vwap: number;
  orb_high: number;
  orb_low: number;
}

interface DetectedSetup {
  id: string;
  symbol: string;
  direction: string;
  setup_stage: string;
  confluence_score: number;
  level_score: number;
  trend_score: number;
  patience_score: number;
  mtf_score: number;
  primary_level_type: string;
  primary_level_price: number;
  patience_candles: number;
  coach_note: string;
  suggested_entry: number;
  suggested_stop: number;
  target_1: number;
  target_2: number;
  target_3: number;
  risk_reward: number;
  detected_at: string;
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
  usePageContext();

  // Core state
  const [watchlist, setWatchlist] = useState<WatchlistSymbol[]>([]);
  const [setups, setSetups] = useState<DetectedSetup[]>([]);
  const [newSymbol, setNewSymbol] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [marketStatus, setMarketStatus] = useState<MarketStatus | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const sessionStartTime = useRef<Date | null>(null);

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

  // UI state
  const [coachBoxExpanded, setCoachBoxExpanded] = useState(true);
  const [watchlistExpanded, setWatchlistExpanded] = useState(true);
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

  // ============================================================================
  // SSE EVENT HANDLER - LIVE UPDATES
  // ============================================================================

  const handleStreamEvent = useCallback((event: CompanionEvent) => {
    if (event.type === 'setup_forming' || event.type === 'setup_ready') {
      setSetups(prev => {
        const existing = prev.findIndex(s => s.symbol === event.data.symbol);
        const eventData = event.data as unknown as Record<string, unknown>;
        const newSetup: DetectedSetup = {
          id: event.data.id,
          symbol: event.data.symbol,
          direction: event.data.direction,
          setup_stage: event.type === 'setup_ready' ? 'ready' : 'forming',
          confluence_score: event.data.confluenceScore,
          level_score: (eventData.levelScore as number) || 0,
          trend_score: (eventData.trendScore as number) || 0,
          patience_score: (eventData.patienceScore as number) || 0,
          mtf_score: (eventData.mtfScore as number) || 0,
          primary_level_type: (eventData.primaryLevelType as string) || '',
          primary_level_price: (eventData.primaryLevelPrice as number) || 0,
          patience_candles: (eventData.patienceCandles as number) || 0,
          coach_note: event.data.coachNote,
          suggested_entry: event.data.suggestedEntry || 0,
          suggested_stop: event.data.suggestedStop || 0,
          target_1: event.data.target1 || 0,
          target_2: event.data.target2 || 0,
          target_3: (eventData.target3 as number) || 0,
          risk_reward: (eventData.riskReward as number) || 0,
          detected_at: new Date().toISOString(),
        };

        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = newSetup;
          return updated;
        }
        return [newSetup, ...prev];
      });

      // Flash for setup alerts
      if (event.type === 'setup_ready') {
        setLastAlertType('entry');
        setTimeout(() => setLastAlertType(null), 2000);
      }
    } else if (event.type === 'price_update') {
      // Update watchlist quotes
      setWatchlist(prev => prev.map(item => {
        if (item.symbol === event.data.symbol) {
          return {
            ...item,
            quote: {
              ...item.quote!,
              last_price: event.data.price,
              change_percent: event.data.changePercent,
              volume: event.data.volume,
            }
          };
        }
        return item;
      }));

      // If this is the selected symbol, add to chart data
      if (event.data.symbol === selectedSymbol) {
        const now = Math.floor(Date.now() / 1000);
        const newCandle: ChartCandle = {
          time: now,
          timestamp: now,
          open: event.data.price,
          high: event.data.price,
          low: event.data.price,
          close: event.data.price,
          volume: event.data.volume,
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
  }, [selectedSymbol]);

  const { connected: streamConnected, error: streamError } = useCompanionStream({
    onEvent: handleStreamEvent,
  });

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  const fetchWatchlist = async () => {
    try {
      const res = await fetch('/api/companion/watchlist');
      const data = await res.json();
      setWatchlist(data.symbols || []);
    } catch (error) {
      console.error('Error fetching watchlist:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSetups = async () => {
    try {
      const res = await fetch('/api/companion/setups?minConfluence=50');
      const data = await res.json();
      setSetups(data.setups || []);
    } catch (error) {
      console.error('Error fetching setups:', error);
    }
  };

  const fetchMarketStatus = async () => {
    try {
      const res = await fetch('/api/market/status');
      if (res.ok) {
        const data = await res.json();
        setMarketStatus(data);
      }
    } catch {
      // Silently fail
    }
  };

  const fetchChartData = async (symbol: string) => {
    setChartLoading(true);
    setChartError(null);
    try {
      const res = await fetch(`/api/market/bars?symbol=${symbol}&timespan=minute&multiplier=5&limit=200`);
      if (res.ok) {
        const data = await res.json();
        if (data.bars && data.bars.length > 0) {
          // Convert timestamps - API returns ms, chart needs seconds
          setChartData(data.bars.map((c: any) => {
            const ts = c.timestamp || c.time;
            // Convert ms to seconds if needed (lightweight-charts expects seconds)
            const timeInSeconds = ts > 1e12 ? Math.floor(ts / 1000) : ts;
            return {
              time: timeInSeconds,
              timestamp: timeInSeconds,
              open: c.open,
              high: c.high,
              low: c.low,
              close: c.close,
              volume: c.volume,
            };
          }));
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
    try {
      const [ltpRes, gammaRes, fvgRes] = await Promise.all([
        fetch(`/api/market/ltp?symbol=${symbol}`),
        fetch(`/api/market/gamma?symbol=${symbol}`),
        fetch(`/api/market/fvg?symbol=${symbol}`),
      ]);

      if (ltpRes.ok) {
        const data = await ltpRes.json();
        setLtpAnalysis(data);
      }
      if (gammaRes.ok) {
        const data = await gammaRes.json();
        setGammaData(data);
      }
      if (fvgRes.ok) {
        const data = await fvgRes.json();
        setFvgData(data);
      }

      // Build chart levels from watchlist item
      const watchlistItem = watchlist.find(w => w.symbol === symbol);
      if (watchlistItem?.levels) {
        setChartLevels(watchlistItem.levels.map(l => ({
          price: l.price,
          label: l.level_type,
          type: l.level_type.includes('support') ? 'support' :
                l.level_type.includes('resistance') ? 'resistance' :
                l.level_type.includes('vwap') ? 'vwap' : 'custom',
        })));
      }

      // Update coaching messages
      updateCoachingMessages(symbol);
    } catch (error) {
      console.error('Error fetching analysis:', error);
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

  useEffect(() => {
    fetchWatchlist();
    fetchSetups();
    fetchMarketStatus();

    const interval = setInterval(() => {
      fetchSetups();
      fetchMarketStatus();
    }, streamConnected ? 60000 : 30000);

    return () => clearInterval(interval);
  }, [streamConnected]);

  useEffect(() => {
    if (selectedSymbol) {
      fetchLTPAnalysis(selectedSymbol);
      fetchChartData(selectedSymbol);
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
  }, [selectedSymbol]);

  useEffect(() => {
    if (selectedSymbol && ltpAnalysis) {
      updateCoachingMessages(selectedSymbol);
    }
  }, [selectedSymbol, ltpAnalysis, updateCoachingMessages]);

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
    const vwap = currentQuote?.vwap || currentPrice;

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
  }, [selectedSymbol, gammaData, chartData, currentQuote, someshVoice]);

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

  const addSymbol = async () => {
    if (!newSymbol.trim()) return;
    try {
      const res = await fetch('/api/companion/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: newSymbol.trim() })
      });
      if (res.ok) {
        setNewSymbol('');
        fetchWatchlist();
      }
    } catch (error) {
      console.error('Error adding symbol:', error);
    }
  };

  const removeSymbol = async (symbol: string) => {
    try {
      await fetch(`/api/companion/watchlist?symbol=${symbol}`, { method: 'DELETE' });
      if (selectedSymbol === symbol) {
        setSelectedSymbol(null);
      }
      fetchWatchlist();
    } catch (error) {
      console.error('Error removing symbol:', error);
    }
  };

  const refreshAll = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        fetch('/api/companion/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshAll: true })
        }),
        fetchWatchlist(),
        fetchSetups(),
        fetchMarketStatus(),
      ]);
      if (selectedSymbol) {
        await fetchLTPAnalysis(selectedSymbol);
        await fetchChartData(selectedSymbol);
      }
    } catch (error) {
      console.error('Error refreshing:', error);
    } finally {
      setRefreshing(false);
    }
  };

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const readySetups = setups.filter(s => s.setup_stage === 'ready');
  const formingSetups = setups.filter(s => s.setup_stage === 'forming');

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

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col overflow-hidden bg-[#0d0d0d]">
      {/* MINIMAL TOP BAR */}
      <div className="flex items-center justify-between px-4 py-2 bg-[var(--bg-secondary)] border-b border-[var(--border-primary)]">
        {/* LEFT: Market Status */}
        <div className="flex items-center gap-4">
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
            <div className="flex items-center gap-2 text-xs">
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

          {selectedSymbol && currentQuote && (
            <div className="flex items-center gap-2 px-3 py-1 bg-[var(--bg-tertiary)] rounded">
              <span className="font-bold text-[var(--text-primary)]">{selectedSymbol}</span>
              <span className="font-mono text-sm text-[var(--text-primary)]">${currentQuote.last_price.toFixed(2)}</span>
              <span className={cn(
                'text-xs font-mono',
                currentQuote.change_percent >= 0 ? 'text-[var(--success)]' : 'text-[var(--error)]'
              )}>
                {currentQuote.change_percent >= 0 ? '+' : ''}{currentQuote.change_percent.toFixed(2)}%
              </span>
            </div>
          )}
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

      {/* MAIN CONTENT - CHART + OVERLAYS */}
      <div className="flex-1 relative overflow-hidden min-h-[400px]">
        {/* FLASH EFFECTS */}
        {flashEffect && (
          <div className={cn(
            'absolute inset-0 z-50 pointer-events-none transition-opacity duration-300',
            flashEffect === 'sniper' && 'animate-pulse bg-[var(--success)]/20',
            flashEffect === 'warning' && 'animate-pulse bg-[var(--error)]/20',
            flashEffect === 'gamma' && 'animate-pulse bg-[#00ffff]/15',
          )} />
        )}

        {/* CHART AREA (Full Screen) */}
        <div className="absolute inset-0 z-0">
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
                <div className="w-full h-full flex items-center justify-center bg-[#0d0d0d]">
                  <div className="text-center">
                    <RefreshCw className="w-8 h-8 mx-auto mb-3 text-[var(--accent-primary)] animate-spin" />
                    <p className="text-[var(--text-secondary)] mb-1">Loading chart for {selectedSymbol}...</p>
                    <p className="text-xs text-[var(--text-tertiary)]">Fetching market data</p>
                  </div>
                </div>
              )}

              {/* Error state */}
              {chartError && !chartLoading && chartData.length === 0 && (
                <div className="w-full h-full flex items-center justify-center bg-[#0d0d0d]">
                  <div className="text-center max-w-md px-4">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-lg bg-[var(--error)]/10 flex items-center justify-center">
                      <AlertTriangle className="w-8 h-8 text-[var(--error)]" />
                    </div>
                    <p className="text-[var(--text-primary)] font-semibold mb-2">{selectedSymbol}</p>
                    <p className="text-[var(--text-secondary)] mb-3">{chartError}</p>
                    <button
                      onClick={() => fetchChartData(selectedSymbol)}
                      className="px-4 py-2 bg-[var(--accent-primary)] text-[#0d0d0d] text-sm font-semibold hover:bg-[var(--accent-primary-hover)] transition-colors"
                    >
                      Retry
                    </button>
                  </div>
                </div>
              )}

              {/* No data but no error (edge case) */}
              {!chartLoading && !chartError && chartData.length === 0 && (
                <div className="w-full h-full flex items-center justify-center bg-[#0d0d0d]">
                  <div className="text-center">
                    <RefreshCw className="w-8 h-8 mx-auto mb-3 text-[var(--accent-primary)] animate-spin" />
                    <p className="text-[var(--text-secondary)] mb-1">Initializing chart for {selectedSymbol}...</p>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-[#0d0d0d]">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-lg bg-[var(--bg-tertiary)] flex items-center justify-center">
                  <Crosshair className="w-8 h-8 text-[var(--text-tertiary)]" />
                </div>
                <p className="text-[var(--text-secondary)] mb-1">Select a symbol to view chart</p>
                <p className="text-xs text-[var(--text-tertiary)]">Use the watchlist on the left</p>
              </div>
            </div>
          )}
        </div>

        {/* LEFT PANEL CONTAINER - Unified container for overlays to prevent overlap */}
        <div className="absolute top-4 left-4 z-10 flex flex-col gap-3 max-h-[calc(100%-2rem)] pointer-events-none">
          {/* LTP 2.0 SCORE HUD */}
          {selectedSymbol && (ltp2Score || ltpAnalysis) && (
            <div className="pointer-events-auto">
              <LTP2ScoreHUD
                ltp2Score={ltp2Score}
                ltpAnalysis={ltpAnalysis}
                gammaRegime={gammaData?.regime || null}
                currentPrice={currentQuote?.last_price || 0}
                vwap={currentQuote?.vwap || 0}
                isSpeaking={someshVoice.isSpeaking}
              />
            </div>
          )}

          {/* WATCHLIST PANEL */}
          <div className={cn(
            'pointer-events-auto transition-all duration-300',
            watchlistExpanded ? 'w-52' : 'w-12'
          )}>
            <WatchlistOverlay
              watchlist={watchlist}
              setups={setups}
              selectedSymbol={selectedSymbol}
              onSelectSymbol={setSelectedSymbol}
              onAddSymbol={addSymbol}
              onRemoveSymbol={removeSymbol}
              newSymbol={newSymbol}
              setNewSymbol={setNewSymbol}
              loading={loading}
              expanded={watchlistExpanded}
              onToggle={() => setWatchlistExpanded(!watchlistExpanded)}
            />
          </div>
        </div>

        {/* COACH BOX (Bottom Right Floating Terminal) */}
        <div className={cn(
          'absolute bottom-16 right-4 z-10 transition-all duration-300',
          coachBoxExpanded ? 'w-80 max-h-[50vh]' : 'w-12'
        )}>
          <CoachBox
            messages={coachingMessages}
            expanded={coachBoxExpanded}
            onToggle={() => setCoachBoxExpanded(!coachBoxExpanded)}
            alertType={lastAlertType}
            selectedSymbol={selectedSymbol}
            mode={mode}
          />
        </div>
      </div>

      {/* SESSION REPORT */}
      <CompanionSessionReport sessionId={sessionId} />
    </div>
  );
}

// ============================================================================
// LTP 2.0 SCORE HUD OVERLAY - Compact Design
// ============================================================================

function LTP2ScoreHUD({
  ltp2Score,
  ltpAnalysis,
  gammaRegime,
  currentPrice,
  vwap,
  isSpeaking,
}: {
  ltp2Score: LTP2Score | null;
  ltpAnalysis: LTPAnalysis | null;
  gammaRegime: 'positive' | 'negative' | 'neutral' | null;
  currentPrice: number;
  vwap: number;
  isSpeaking: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  // LTP 2.0 grade colors and badges
  const ltp2GradeStyles: Record<string, { bg: string; text: string; border: string; emoji: string; label: string }> = {
    'Sniper': { bg: 'bg-[var(--success)]/20', text: 'text-[var(--success)]', border: 'border-[var(--success)]/50', emoji: '🎯', label: 'SNIPER' },
    'Decent': { bg: 'bg-[var(--warning)]/15', text: 'text-[var(--warning)]', border: 'border-[var(--warning)]/30', emoji: '📊', label: 'DECENT' },
    'Dumb Shit': { bg: 'bg-[var(--error)]/20', text: 'text-[var(--error)]', border: 'border-[var(--error)]/50', emoji: '💩', label: 'DUMB' },
  };

  const gammaColors: Record<string, string> = {
    'positive': 'text-[var(--success)]',
    'negative': 'text-[var(--error)]',
    'neutral': 'text-[var(--text-secondary)]',
  };

  const aboveVwap = currentPrice > vwap;
  const gradeStyle = ltp2Score ? ltp2GradeStyles[ltp2Score.grade] : null;

  return (
    <div className={cn(
      'bg-[#0d0d0d]/95 backdrop-blur border rounded-lg overflow-hidden transition-all duration-300',
      gradeStyle ? gradeStyle.border : 'border-[var(--border-primary)]',
      expanded ? 'w-52' : 'w-auto'
    )}>
      {/* Compact Header - Always Visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          'w-full flex items-center gap-2 px-3 py-2 hover:bg-[var(--bg-tertiary)]/50 transition-colors',
          gradeStyle ? gradeStyle.bg : ''
        )}
      >
        {/* Grade Badge */}
        {ltp2Score && gradeStyle ? (
          <span className={cn(
            'text-xs font-black px-1.5 py-0.5 rounded border',
            gradeStyle.bg, gradeStyle.text, gradeStyle.border
          )}>
            {gradeStyle.emoji} {gradeStyle.label}
          </span>
        ) : ltpAnalysis ? (
          <span className="text-sm font-black text-[var(--accent-primary)]">
            {ltpAnalysis.grade}
          </span>
        ) : null}

        {/* Score */}
        {ltp2Score && (
          <span className={cn(
            'text-lg font-black tabular-nums',
            ltp2Score.score >= 75 ? 'text-[var(--success)]' :
            ltp2Score.score >= 50 ? 'text-[var(--warning)]' :
            'text-[var(--error)]'
          )}>
            {ltp2Score.score}
          </span>
        )}

        {/* Quick Indicators */}
        <div className="flex items-center gap-1.5 ml-auto">
          <span className={cn('text-[10px] font-bold', aboveVwap ? 'text-[var(--success)]' : 'text-[var(--error)]')}>
            {aboveVwap ? '▲' : '▼'}
          </span>
          {gammaRegime && (
            <span className={cn('text-[10px] font-bold', gammaColors[gammaRegime])}>
              {gammaRegime === 'positive' ? '+γ' : gammaRegime === 'negative' ? '-γ' : '~γ'}
            </span>
          )}
          {isSpeaking && <Volume2 className="w-3 h-3 text-[var(--accent-primary)] animate-pulse" />}
          <ChevronDown className={cn('w-3 h-3 text-[var(--text-tertiary)] transition-transform', expanded && 'rotate-180')} />
        </div>
      </button>

      {/* Expanded Details */}
      {expanded && ltp2Score && (
        <div className="px-3 pb-3 border-t border-[var(--border-primary)]">
          {/* Score Breakdown - Compact Bars */}
          <div className="space-y-1 py-2">
            <ScoreBar label="Cloud" value={ltp2Score.breakdown.cloudScore} max={25} color="var(--accent-primary)" />
            <ScoreBar label="VWAP" value={ltp2Score.breakdown.vwapScore} max={20} color="var(--success)" />
            <ScoreBar label="Gamma" value={ltp2Score.breakdown.gammaWallScore + ltp2Score.breakdown.gammaRegimeScore} max={35} color="#00ffff" />
            <ScoreBar label="Patience" value={ltp2Score.breakdown.patienceScore} max={10} color="var(--warning)" />
            {ltp2Score.breakdown.resistancePenalty < 0 && (
              <ScoreBar label="Penalty" value={Math.abs(ltp2Score.breakdown.resistancePenalty)} max={20} color="var(--error)" />
            )}
          </div>

          {/* Recommendation */}
          <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed">
            {ltp2Score.recommendation}
          </p>

          {/* Warning */}
          {ltp2Score.warnings.length > 0 && (
            <div className="flex items-start gap-1 text-[9px] text-[var(--warning)] bg-[var(--warning)]/10 rounded px-2 py-1 mt-2">
              <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
              <span>{ltp2Score.warnings[0]}</span>
            </div>
          )}
        </div>
      )}

      {/* Expanded Legacy LTP (fallback) */}
      {expanded && !ltp2Score && ltpAnalysis && (
        <div className="px-3 pb-3 space-y-1">
          <ScoreBar label="Level" value={ltpAnalysis.levels.levelScore} color="var(--accent-primary)" />
          <ScoreBar label="Trend" value={ltpAnalysis.trend.trendScore} color="var(--success)" />
          <ScoreBar label="Patience" value={ltpAnalysis.patience.patienceScore} color="var(--warning)" />
        </div>
      )}
    </div>
  );
}

function ScoreBar({ label, value, max = 100, color }: { label: string; value: number; max?: number; color: string }) {
  const percentage = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="w-12 text-[10px] font-bold text-[var(--text-tertiary)] truncate">{label}</span>
      <div className="flex-1 h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.min(percentage, 100)}%`, backgroundColor: color }}
        />
      </div>
      <span className="w-8 text-[10px] font-mono text-right text-[var(--text-secondary)]">{value}</span>
    </div>
  );
}

// ============================================================================
// WATCHLIST OVERLAY
// ============================================================================

function WatchlistOverlay({
  watchlist,
  setups,
  selectedSymbol,
  onSelectSymbol,
  onAddSymbol,
  onRemoveSymbol,
  newSymbol,
  setNewSymbol,
  loading,
  expanded,
  onToggle,
}: {
  watchlist: WatchlistSymbol[];
  setups: DetectedSetup[];
  selectedSymbol: string | null;
  onSelectSymbol: (symbol: string | null) => void;
  onAddSymbol: () => void;
  onRemoveSymbol: (symbol: string) => void;
  newSymbol: string;
  setNewSymbol: (v: string) => void;
  loading: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  if (!expanded) {
    return (
      <button
        onClick={onToggle}
        className="w-10 h-10 rounded-lg bg-[#0d0d0d]/90 backdrop-blur border border-[var(--border-primary)] flex items-center justify-center hover:bg-[var(--bg-tertiary)] transition-colors"
      >
        <Eye className="w-4 h-4 text-[var(--accent-primary)]" />
      </button>
    );
  }

  return (
    <div className="bg-[#0d0d0d]/90 backdrop-blur border border-[var(--border-primary)] rounded-lg overflow-hidden max-h-[60vh]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-primary)]">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-[var(--accent-primary)]" />
          <span className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">Watch</span>
        </div>
        <button onClick={onToggle} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">
          <ChevronDown className="w-4 h-4" />
        </button>
      </div>

      {/* Add Symbol */}
      <div className="p-2 border-b border-[var(--border-primary)]">
        <div className="flex gap-1">
          <input
            type="text"
            placeholder="Symbol..."
            value={newSymbol}
            onChange={(e) => setNewSymbol(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && onAddSymbol()}
            className="flex-1 px-2 py-1 text-xs bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:border-[var(--accent-primary)] focus:outline-none rounded"
          />
          <button
            onClick={onAddSymbol}
            className="px-2 py-1 bg-[var(--accent-primary)] text-white rounded hover:bg-[var(--accent-primary)]/90"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Symbol List */}
      <div className="overflow-y-auto max-h-[40vh]">
        {watchlist.map((item) => {
          const setup = setups.find(s => s.symbol === item.symbol);
          const isSelected = selectedSymbol === item.symbol;
          const isReady = setup?.setup_stage === 'ready';

          return (
            <button
              key={item.id}
              onClick={() => onSelectSymbol(isSelected ? null : item.symbol)}
              className={cn(
                'w-full px-3 py-2 flex items-center justify-between text-left transition-colors',
                isSelected
                  ? 'bg-[var(--accent-primary)]/20 border-l-2 border-l-[var(--accent-primary)]'
                  : 'hover:bg-[var(--bg-tertiary)]'
              )}
            >
              <div className="flex items-center gap-2">
                {isReady && <Zap className="w-3 h-3 text-[var(--accent-primary)]" />}
                <span className={cn(
                  'text-xs font-semibold',
                  isSelected ? 'text-[var(--accent-primary)]' : 'text-[var(--text-primary)]'
                )}>
                  {item.symbol}
                </span>
              </div>

              {item.quote && (
                <span className={cn(
                  'text-[10px] font-mono',
                  item.quote.change_percent >= 0 ? 'text-[var(--success)]' : 'text-[var(--error)]'
                )}>
                  {item.quote.change_percent >= 0 ? '+' : ''}{item.quote.change_percent.toFixed(1)}%
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// COACH BOX - FLOATING TERMINAL
// ============================================================================

function CoachBox({
  messages,
  expanded,
  onToggle,
  alertType,
  selectedSymbol,
  mode,
}: {
  messages: CoachingMessage[];
  expanded: boolean;
  onToggle: () => void;
  alertType: 'patience' | 'entry' | 'warning' | null;
  selectedSymbol: string | null;
  mode: CoachingMode;
}) {
  const borderColor = alertType === 'entry'
    ? 'border-[var(--success)]'
    : alertType === 'patience'
    ? 'border-[var(--warning)]'
    : alertType === 'warning'
    ? 'border-[var(--error)]'
    : 'border-[var(--border-primary)]';

  const glowEffect = alertType === 'entry'
    ? 'shadow-[0_0_20px_rgba(34,197,94,0.3)]'
    : alertType === 'patience'
    ? 'shadow-[0_0_20px_rgba(251,191,36,0.3)]'
    : alertType === 'warning'
    ? 'shadow-[0_0_20px_rgba(239,68,68,0.3)]'
    : '';

  if (!expanded) {
    return (
      <button
        onClick={onToggle}
        className={cn(
          'w-10 h-10 rounded-lg bg-[#0d0d0d]/90 backdrop-blur border flex items-center justify-center transition-all duration-300',
          borderColor,
          glowEffect,
          alertType && 'animate-pulse'
        )}
      >
        <MessageSquare className={cn(
          'w-4 h-4',
          alertType === 'entry' ? 'text-[var(--success)]' :
          alertType === 'patience' ? 'text-[var(--warning)]' :
          alertType === 'warning' ? 'text-[var(--error)]' :
          'text-[var(--accent-primary)]'
        )} />
      </button>
    );
  }

  const primaryMessage = messages[0];

  return (
    <div className={cn(
      'bg-[#0d0d0d]/95 backdrop-blur border rounded-lg overflow-hidden transition-all duration-300',
      borderColor,
      glowEffect
    )}>
      {/* Header */}
      <div className={cn(
        'flex items-center justify-between px-3 py-2 border-b',
        alertType === 'entry' ? 'border-[var(--success)] bg-[var(--success)]/10' :
        alertType === 'patience' ? 'border-[var(--warning)] bg-[var(--warning)]/10' :
        alertType === 'warning' ? 'border-[var(--error)] bg-[var(--error)]/10' :
        'border-[var(--border-primary)]'
      )}>
        <div className="flex items-center gap-2">
          <Sparkles className={cn(
            'w-4 h-4',
            alertType === 'entry' ? 'text-[var(--success)]' :
            alertType === 'patience' ? 'text-[var(--warning)]' :
            alertType === 'warning' ? 'text-[var(--error)]' :
            'text-[var(--accent-primary)]'
          )} />
          <span className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
            Digital Somesh
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[var(--text-tertiary)] uppercase">{mode}</span>
          <button onClick={onToggle} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">
            <Minimize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="p-3 max-h-64 overflow-y-auto space-y-3">
        {messages.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-xs text-[var(--text-tertiary)]">
              {selectedSymbol
                ? 'Analyzing setup...'
                : 'Select a symbol to get coaching'}
            </p>
          </div>
        ) : (
          messages.slice(0, 4).map((msg, i) => (
            <CoachMessage key={i} message={msg} isPrimary={i === 0} />
          ))
        )}
      </div>
    </div>
  );
}

function CoachMessage({ message, isPrimary }: { message: CoachingMessage; isPrimary: boolean }) {
  const typeStyles: Record<string, string> = {
    opportunity: 'border-l-[var(--success)]',
    warning: 'border-l-[var(--error)]',
    guidance: 'border-l-[var(--accent-primary)]',
    education: 'border-l-[var(--info)]',
    trade_management: 'border-l-[var(--warning)]',
  };

  return (
    <div className={cn(
      'border-l-2 pl-3 py-1',
      typeStyles[message.type] || 'border-l-[var(--border-primary)]',
      isPrimary && 'bg-[var(--bg-tertiary)]/50 -mx-3 px-3 rounded-r'
    )}>
      <div className="flex items-start gap-2">
        <span className={cn(
          'text-xs font-bold',
          isPrimary ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'
        )}>
          {message.title}
        </span>
      </div>
      <p className={cn(
        'text-[11px] leading-relaxed mt-1',
        isPrimary ? 'text-[var(--text-secondary)]' : 'text-[var(--text-tertiary)]'
      )}>
        {message.message}
      </p>
      {message.action && isPrimary && (
        <div className="mt-2 flex items-center gap-1 text-[10px] text-[var(--accent-primary)]">
          <Target className="w-3 h-3" />
          <span>{message.action}</span>
        </div>
      )}
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
