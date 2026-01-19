'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { usePageContext } from '@/components/ai';
import { cn } from '@/lib/utils';
import { useCompanionStream, type CompanionEvent } from '@/hooks/useCompanionStream';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { CompanionSessionReport } from '@/components/companion/session-report';
import { kcuCoachingRules, getMarketSession, calculateRMultiple, type CoachingMessage, type ActiveTradeContext } from '@/lib/kcu-coaching-rules';
import type { LTPAnalysis } from '@/lib/market-data';
import {
  Plus,
  X,
  TrendingUp,
  TrendingDown,
  Target,
  Eye,
  Bell,
  Zap,
  Clock,
  BarChart3,
  Layers,
  AlertTriangle,
  RefreshCw,
  Wifi,
  WifiOff,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Activity,
  MessageSquare,
  Play,
  Sparkles,
  Send,
  Upload,
  Camera,
  Radio,
  Crosshair,
  TrendingUp as TrendUp,
  Gauge,
  LineChart,
  Shield,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  BarChart2,
  Timer,
  Scale,
  Flame,
  GraduationCap,
  BookOpen,
  Check,
  XCircle,
  Info,
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

interface CompanionMessage {
  id: string;
  message_type: string;
  content: string;
  metadata?: Record<string, unknown>;
  created_at: string;
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

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function CompanionPage() {
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

  // Chat state
  const [messages, setMessages] = useState<CompanionMessage[]>([]);
  const [userQuestion, setUserQuestion] = useState('');
  const [askingQuestion, setAskingQuestion] = useState(false);

  // Screenshot analysis state
  const [showScreenshotUpload, setShowScreenshotUpload] = useState(false);
  const [screenshotAnalysis, setScreenshotAnalysis] = useState<Record<string, unknown> | null>(null);
  const [analyzingScreenshot, setAnalyzingScreenshot] = useState(false);

  // Trade entry modal
  const [showTradeEntry, setShowTradeEntry] = useState(false);

  const { showToast } = useToast();

  // Get current market session
  const marketSession = useMemo(() => getMarketSession(), []);

  // ============================================================================
  // SSE EVENT HANDLER
  // ============================================================================

  const handleStreamEvent = useCallback((event: CompanionEvent) => {
    if (event.type === 'setup_forming' || event.type === 'setup_ready') {
      setSetups(prev => {
        const existing = prev.findIndex(s => s.symbol === event.data.symbol);
        // Cast to unknown first for safe access to extended properties
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
    } else if (event.type === 'price_update') {
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
    }
  }, []);

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

  const fetchMessages = async () => {
    try {
      const res = await fetch('/api/companion/messages?limit=20');
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
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

      // Update coaching messages
      updateCoachingMessages(symbol);
    } catch (error) {
      console.error('Error fetching analysis:', error);
    } finally {
      setAnalysisLoading(false);
    }
  };

  const updateCoachingMessages = (symbol: string) => {
    const watchlistItem = watchlist.find(w => w.symbol === symbol);
    const currentPrice = watchlistItem?.quote?.last_price || 0;

    const context = {
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
  };

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
    fetchMessages();

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
    } else {
      setLtpAnalysis(null);
      setGammaData(null);
      setFvgData(null);
      setCoachingMessages([]);
    }
  }, [selectedSymbol]);

  useEffect(() => {
    if (selectedSymbol && ltpAnalysis) {
      updateCoachingMessages(selectedSymbol);
    }
  }, [mode, activeTrade, ltpAnalysis, gammaData, fvgData]);

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
      }
    } catch (error) {
      console.error('Error refreshing:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const askQuestion = async () => {
    if (!userQuestion.trim()) return;
    setAskingQuestion(true);
    try {
      const context = {
        currentSetups: setups.slice(0, 5).map(s => ({
          symbol: s.symbol,
          direction: s.direction,
          confluence: s.confluence_score,
          stage: s.setup_stage
        })),
        watchlist: watchlist.map(w => w.symbol),
        selectedSymbol,
        ltpGrade: ltpAnalysis?.grade,
        marketOpen: marketStatus?.isOpen
      };

      const res = await fetch('/api/companion/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: userQuestion, context })
      });

      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [data.message, ...prev]);
        setUserQuestion('');
      }
    } catch (error) {
      console.error('Error asking question:', error);
    } finally {
      setAskingQuestion(false);
    }
  };

  const analyzeScreenshot = async (imageData: string) => {
    setAnalyzingScreenshot(true);
    try {
      const res = await fetch('/api/companion/analyze-screenshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: imageData,
          symbol: selectedSymbol,
          context: `Mode: ${mode}, Market: ${marketSession}`
        })
      });

      if (res.ok) {
        const data = await res.json();
        setScreenshotAnalysis(data.analysis);
        showToast({
          type: 'success',
          title: 'Chart Analyzed',
          message: `${data.analysis.setup.quality} grade setup detected`
        });
      }
    } catch (error) {
      console.error('Error analyzing screenshot:', error);
      showToast({
        type: 'error',
        title: 'Analysis Failed',
        message: 'Could not analyze the screenshot'
      });
    } finally {
      setAnalyzingScreenshot(false);
      setShowScreenshotUpload(false);
    }
  };

  const startTrade = (trade: ActiveTrade) => {
    setActiveTrade(trade);
    setMode('trade');
    setShowTradeEntry(false);
    showToast({
      type: 'success',
      title: 'Trade Logged',
      message: `${trade.direction.toUpperCase()} ${trade.symbol} @ $${trade.entryPrice.toFixed(2)}`
    });
  };

  const closeTrade = () => {
    setActiveTrade(null);
    setMode('scan');
  };

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const readySetups = setups.filter(s => s.setup_stage === 'ready');
  const formingSetups = setups.filter(s => s.setup_stage === 'forming');

  const currentRMultiple = useMemo(() => {
    if (!activeTrade || !selectedSymbol) return 0;
    const watchlistItem = watchlist.find(w => w.symbol === selectedSymbol);
    const currentPrice = watchlistItem?.quote?.last_price || activeTrade.entryPrice;
    return calculateRMultiple(
      activeTrade.entryPrice,
      currentPrice,
      activeTrade.stopLoss,
      activeTrade.direction
    );
  }, [activeTrade, selectedSymbol, watchlist]);

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col overflow-hidden">
      {/* TOP CONTROL BAR */}
      <TopControlBar
        marketStatus={marketStatus}
        streamConnected={streamConnected}
        streamError={streamError}
        mode={mode}
        setMode={setMode}
        onRefresh={refreshAll}
        refreshing={refreshing}
        readyCount={readySetups.length}
        formingCount={formingSetups.length}
        marketSession={marketSession}
        activeTrade={activeTrade}
      />

      {/* MAIN 3-PANEL LAYOUT */}
      <div className="flex-1 grid grid-cols-12 gap-0 overflow-hidden">
        {/* LEFT PANEL - WATCHLIST */}
        <div className="col-span-2 border-r border-[var(--border-primary)] overflow-y-auto">
          <WatchlistPanel
            watchlist={watchlist}
            setups={setups}
            selectedSymbol={selectedSymbol}
            onSelectSymbol={setSelectedSymbol}
            onAddSymbol={addSymbol}
            onRemoveSymbol={removeSymbol}
            newSymbol={newSymbol}
            setNewSymbol={setNewSymbol}
            loading={loading}
          />
        </div>

        {/* CENTER PANEL - ANALYSIS CENTER */}
        <div className="col-span-7 overflow-y-auto bg-[var(--bg-primary)]">
          <AnalysisCenter
            selectedSymbol={selectedSymbol}
            ltpAnalysis={ltpAnalysis}
            gammaData={gammaData}
            fvgData={fvgData}
            loading={analysisLoading}
            watchlistItem={watchlist.find(w => w.symbol === selectedSymbol)}
            setup={setups.find(s => s.symbol === selectedSymbol)}
            mode={mode}
            activeTrade={activeTrade}
            currentRMultiple={currentRMultiple}
            onCloseTrade={closeTrade}
            onShowTradeEntry={() => setShowTradeEntry(true)}
            onShowScreenshotUpload={() => setShowScreenshotUpload(true)}
            screenshotAnalysis={screenshotAnalysis}
            coachingMessages={coachingMessages}
            readySetups={readySetups}
            formingSetups={formingSetups}
          />
        </div>

        {/* RIGHT PANEL - COACH CHAT */}
        <div className="col-span-3 border-l border-[var(--border-primary)] flex flex-col bg-[var(--bg-secondary)]">
          <CoachChatPanel
            messages={messages}
            userQuestion={userQuestion}
            setUserQuestion={setUserQuestion}
            onAskQuestion={askQuestion}
            askingQuestion={askingQuestion}
            coachingMessages={coachingMessages}
            selectedSymbol={selectedSymbol}
            ltpAnalysis={ltpAnalysis}
          />
        </div>
      </div>

      {/* SCREENSHOT UPLOAD MODAL */}
      {showScreenshotUpload && (
        <ScreenshotUploadModal
          onClose={() => setShowScreenshotUpload(false)}
          onAnalyze={analyzeScreenshot}
          analyzing={analyzingScreenshot}
        />
      )}

      {/* TRADE ENTRY MODAL */}
      {showTradeEntry && (
        <TradeEntryModal
          onClose={() => setShowTradeEntry(false)}
          onStartTrade={startTrade}
          selectedSymbol={selectedSymbol}
          ltpAnalysis={ltpAnalysis}
          setup={setups.find(s => s.symbol === selectedSymbol)}
        />
      )}

      {/* SESSION REPORT */}
      <CompanionSessionReport sessionId={sessionId} />
    </div>
  );
}

// ============================================================================
// TOP CONTROL BAR
// ============================================================================

function TopControlBar({
  marketStatus,
  streamConnected,
  streamError,
  mode,
  setMode,
  onRefresh,
  refreshing,
  readyCount,
  formingCount,
  marketSession,
  activeTrade,
}: {
  marketStatus: MarketStatus | null;
  streamConnected: boolean;
  streamError: string | null;
  mode: CoachingMode;
  setMode: (mode: CoachingMode) => void;
  onRefresh: () => void;
  refreshing: boolean;
  readyCount: number;
  formingCount: number;
  marketSession: string;
  activeTrade: ActiveTrade | null;
}) {
  return (
    <div className="bg-[var(--bg-secondary)] border-b border-[var(--border-primary)] px-4 py-2">
      <div className="flex items-center justify-between">
        {/* LEFT: Market Indices */}
        <div className="flex items-center gap-4">
          {marketStatus ? (
            <>
              <MarketTicker symbol="SPY" price={marketStatus.spy.price} change={marketStatus.spy.change} />
              <MarketTicker symbol="QQQ" price={marketStatus.qqq.price} change={marketStatus.qqq.change} />
              {marketStatus.vix && (
                <MarketTicker symbol="VIX" price={marketStatus.vix.price} change={marketStatus.vix.change} isVix />
              )}
              <div className="h-6 w-px bg-[var(--border-primary)]" />
              <SessionBadge session={marketSession} isOpen={marketStatus.isOpen} timeToClose={marketStatus.timeToClose} />
            </>
          ) : (
            <div className="flex items-center gap-2 text-[var(--text-tertiary)]">
              <Activity className="w-4 h-4 animate-pulse" />
              <span className="text-xs">Loading market data...</span>
            </div>
          )}
        </div>

        {/* CENTER: Mode Selector */}
        <div className="flex items-center gap-1 bg-[var(--bg-tertiary)] p-1 rounded">
          <ModeButton mode="scan" currentMode={mode} onClick={() => setMode('scan')} icon={<Eye className="w-4 h-4" />} />
          <ModeButton mode="focus" currentMode={mode} onClick={() => setMode('focus')} icon={<Crosshair className="w-4 h-4" />} />
          <ModeButton mode="trade" currentMode={mode} onClick={() => setMode('trade')} icon={<Target className="w-4 h-4" />} disabled={!activeTrade} />
        </div>

        {/* RIGHT: Status & Actions */}
        <div className="flex items-center gap-3">
          {/* Setup Counts */}
          <div className="flex items-center gap-2">
            {readyCount > 0 && (
              <span className="flex items-center gap-1 px-2 py-1 bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] text-xs font-bold rounded">
                <Zap className="w-3 h-3" />
                {readyCount} Ready
              </span>
            )}
            {formingCount > 0 && (
              <span className="flex items-center gap-1 px-2 py-1 bg-[var(--bg-tertiary)] text-[var(--text-secondary)] text-xs rounded">
                <Clock className="w-3 h-3" />
                {formingCount} Forming
              </span>
            )}
          </div>

          {/* Refresh */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            disabled={refreshing}
            className="h-8 w-8 p-0"
          >
            <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
          </Button>

          {/* Live Indicator */}
          <div
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider rounded',
              streamConnected
                ? 'bg-[var(--success)]/10 text-[var(--success)] border border-[var(--success)]/30'
                : 'bg-[var(--error)]/10 text-[var(--error)] border border-[var(--error)]/30'
            )}
            title={streamError || (streamConnected ? 'Real-time updates active' : 'Connecting...')}
          >
            <Radio className={cn('w-3 h-3', streamConnected && 'animate-pulse')} />
            {streamConnected ? 'LIVE' : 'OFFLINE'}
          </div>
        </div>
      </div>
    </div>
  );
}

function MarketTicker({ symbol, price, change, isVix = false }: { symbol: string; price: number; change: number; isVix?: boolean }) {
  const isPositive = change >= 0;
  const vixColor = isVix && price > 20 ? 'text-[var(--error)]' : isVix && price < 15 ? 'text-[var(--success)]' : '';

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-[var(--text-tertiary)]">{symbol}</span>
      <span className={cn('text-sm font-mono font-semibold', vixColor || 'text-[var(--text-primary)]')}>
        {isVix ? price.toFixed(2) : `$${price.toFixed(2)}`}
      </span>
      <span className={cn(
        'text-xs font-mono px-1 py-0.5 rounded',
        isVix ? (isPositive ? 'bg-[var(--error)]/10 text-[var(--error)]' : 'bg-[var(--success)]/10 text-[var(--success)]')
             : (isPositive ? 'bg-[var(--success)]/10 text-[var(--success)]' : 'bg-[var(--error)]/10 text-[var(--error)]')
      )}>
        {isPositive ? '+' : ''}{change.toFixed(2)}%
      </span>
    </div>
  );
}

function SessionBadge({ session, isOpen, timeToClose }: { session: string; isOpen: boolean; timeToClose: string }) {
  const sessionLabels: Record<string, string> = {
    premarket: 'Pre-Market',
    open: 'Market Open',
    power_hour: 'Power Hour',
    close: 'Closing',
    after_hours: 'After Hours',
    closed: 'Market Closed'
  };

  return (
    <div className="flex items-center gap-2">
      <div className={cn('w-2 h-2 rounded-full', isOpen ? 'bg-[var(--success)] animate-pulse' : 'bg-[var(--text-tertiary)]')} />
      <span className="text-xs text-[var(--text-secondary)]">
        {sessionLabels[session] || session}
        {isOpen && timeToClose && ` (${timeToClose})`}
      </span>
    </div>
  );
}

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
        'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-all',
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

// ============================================================================
// WATCHLIST PANEL
// ============================================================================

function WatchlistPanel({
  watchlist,
  setups,
  selectedSymbol,
  onSelectSymbol,
  onAddSymbol,
  onRemoveSymbol,
  newSymbol,
  setNewSymbol,
  loading,
}: {
  watchlist: WatchlistSymbol[];
  setups: DetectedSetup[];
  selectedSymbol: string | null;
  onSelectSymbol: (symbol: string | null) => void;
  onAddSymbol: () => void;
  onRemoveSymbol: (symbol: string) => void;
  newSymbol: string;
  setNewSymbol: (symbol: string) => void;
  loading: boolean;
}) {
  const sharedSymbols = watchlist.filter(s => s.is_shared);
  const personalSymbols = watchlist.filter(s => !s.is_shared);

  return (
    <div className="h-full flex flex-col bg-[var(--bg-secondary)]">
      {/* Header */}
      <div className="p-3 border-b border-[var(--border-primary)]">
        <div className="flex items-center gap-2 mb-2">
          <Eye className="w-4 h-4 text-[var(--accent-primary)]" />
          <h2 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">Watchlist</h2>
        </div>

        {/* Add Symbol */}
        <div className="flex gap-1">
          <input
            type="text"
            placeholder="Add symbol..."
            value={newSymbol}
            onChange={(e) => setNewSymbol(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && onAddSymbol()}
            className="flex-1 px-2 py-1.5 text-xs bg-[var(--bg-primary)] border border-[var(--border-primary)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:border-[var(--accent-primary)] focus:outline-none"
          />
          <button
            onClick={onAddSymbol}
            className="px-2 py-1.5 bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary)]/90 transition-colors"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Symbol List */}
      <div className="flex-1 overflow-y-auto">
        {/* Coach Picks */}
        {sharedSymbols.length > 0 && (
          <div className="p-2">
            <div className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-[var(--accent-primary)] uppercase tracking-wider">
              <Sparkles className="w-3 h-3" />
              Coach Picks
            </div>
            {sharedSymbols.map((item) => (
              <WatchlistItem
                key={item.id}
                item={item}
                setup={setups.find(s => s.symbol === item.symbol)}
                isSelected={selectedSymbol === item.symbol}
                onSelect={() => onSelectSymbol(selectedSymbol === item.symbol ? null : item.symbol)}
                onRemove={() => {}}
                isShared
              />
            ))}
          </div>
        )}

        {/* Personal Watchlist */}
        <div className="p-2">
          {sharedSymbols.length > 0 && personalSymbols.length > 0 && (
            <div className="px-2 py-1 text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">
              Personal
            </div>
          )}
          {personalSymbols.map((item) => (
            <WatchlistItem
              key={item.id}
              item={item}
              setup={setups.find(s => s.symbol === item.symbol)}
              isSelected={selectedSymbol === item.symbol}
              onSelect={() => onSelectSymbol(selectedSymbol === item.symbol ? null : item.symbol)}
              onRemove={() => onRemoveSymbol(item.symbol)}
            />
          ))}
        </div>

        {/* Empty State */}
        {watchlist.length === 0 && !loading && (
          <div className="p-6 text-center">
            <Eye className="w-8 h-8 mx-auto mb-2 text-[var(--text-tertiary)] opacity-30" />
            <p className="text-xs text-[var(--text-tertiary)]">No symbols yet</p>
          </div>
        )}
      </div>
    </div>
  );
}

function WatchlistItem({
  item,
  setup,
  isSelected,
  onSelect,
  onRemove,
  isShared = false,
}: {
  item: WatchlistSymbol;
  setup?: DetectedSetup;
  isSelected: boolean;
  onSelect: () => void;
  onRemove: () => void;
  isShared?: boolean;
}) {
  const hasSetup = !!setup;
  const isReady = setup?.setup_stage === 'ready';
  const changePercent = item.quote?.change_percent ?? 0;
  const isPositive = changePercent >= 0;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect()}
      className={cn(
        'group p-2 cursor-pointer transition-all mb-1 rounded',
        isSelected
          ? 'bg-[var(--accent-primary)]/10 border-l-2 border-l-[var(--accent-primary)]'
          : 'hover:bg-[var(--bg-tertiary)] border-l-2 border-l-transparent',
        isReady && !isSelected && 'border-l-[var(--accent-primary)]/50'
      )}
    >
      {/* Symbol Row */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <span className="font-bold text-sm text-[var(--text-primary)]">{item.symbol}</span>
          {isShared && (
            <Sparkles className="w-3 h-3 text-[var(--accent-primary)]" />
          )}
          {isReady && (
            <Zap className="w-3 h-3 text-[var(--accent-primary)]" />
          )}
        </div>
        {!isShared && (
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-[var(--bg-elevated)] rounded transition-opacity"
          >
            <X className="w-3 h-3 text-[var(--text-tertiary)]" />
          </button>
        )}
      </div>

      {/* Price Row */}
      {item.quote && (
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-[var(--text-secondary)]">
            ${item.quote.last_price?.toFixed(2)}
          </span>
          <span className={cn(
            'text-[10px] font-mono px-1 py-0.5 rounded',
            isPositive ? 'bg-[var(--success)]/10 text-[var(--success)]' : 'bg-[var(--error)]/10 text-[var(--error)]'
          )}>
            {isPositive ? '+' : ''}{changePercent.toFixed(2)}%
          </span>
        </div>
      )}

      {/* Score Bar */}
      {hasSetup && (
        <div className="mt-1.5 flex items-center gap-2">
          <LTPMiniBar level={setup.level_score} trend={setup.trend_score} patience={setup.patience_score} />
          <span className={cn(
            'text-[10px] font-bold font-mono',
            isReady ? 'text-[var(--accent-primary)]' : 'text-[var(--text-tertiary)]'
          )}>
            {setup.confluence_score}%
          </span>
        </div>
      )}
    </div>
  );
}

function LTPMiniBar({ level, trend, patience }: { level: number; trend: number; patience: number }) {
  const getColor = (score: number) => {
    if (score >= 70) return 'var(--success)';
    if (score >= 50) return 'var(--warning)';
    return 'var(--error)';
  };

  return (
    <div className="flex gap-0.5 flex-1">
      {[level, trend, patience].map((score, i) => (
        <div key={i} className="h-1 flex-1 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
          <div className="h-full transition-all" style={{ width: `${score}%`, backgroundColor: getColor(score) }} />
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// ANALYSIS CENTER
// ============================================================================

function AnalysisCenter({
  selectedSymbol,
  ltpAnalysis,
  gammaData,
  fvgData,
  loading,
  watchlistItem,
  setup,
  mode,
  activeTrade,
  currentRMultiple,
  onCloseTrade,
  onShowTradeEntry,
  onShowScreenshotUpload,
  screenshotAnalysis,
  coachingMessages,
  readySetups,
  formingSetups,
}: {
  selectedSymbol: string | null;
  ltpAnalysis: LTPAnalysis | null;
  gammaData: GammaExposure | null;
  fvgData: FVGData | null;
  loading: boolean;
  watchlistItem?: WatchlistSymbol;
  setup?: DetectedSetup;
  mode: CoachingMode;
  activeTrade: ActiveTrade | null;
  currentRMultiple: number;
  onCloseTrade: () => void;
  onShowTradeEntry: () => void;
  onShowScreenshotUpload: () => void;
  screenshotAnalysis: Record<string, unknown> | null;
  coachingMessages: CoachingMessage[];
  readySetups: DetectedSetup[];
  formingSetups: DetectedSetup[];
}) {
  if (!selectedSymbol) {
    return (
      <div className="h-full flex flex-col">
        {/* No Symbol Selected - Show Setups Overview */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Ready Setups */}
          {readySetups.length > 0 && (
            <section className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="w-4 h-4 text-[var(--accent-primary)]" />
                <h2 className="text-sm font-bold text-[var(--accent-primary)] uppercase tracking-wider">
                  Ready to Trade ({readySetups.length})
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {readySetups.map((s) => (
                  <SetupCard key={s.id} setup={s} variant="ready" />
                ))}
              </div>
            </section>
          )}

          {/* Forming Setups */}
          {formingSetups.length > 0 && (
            <section className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-[var(--text-tertiary)]" />
                <h2 className="text-sm font-bold text-[var(--text-tertiary)] uppercase tracking-wider">
                  Forming ({formingSetups.length})
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {formingSetups.map((s) => (
                  <SetupCard key={s.id} setup={s} variant="forming" />
                ))}
              </div>
            </section>
          )}

          {/* Empty State */}
          {readySetups.length === 0 && formingSetups.length === 0 && (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <Target className="w-16 h-16 mx-auto mb-4 text-[var(--text-tertiary)] opacity-30" />
                <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">Select a Symbol</h3>
                <p className="text-sm text-[var(--text-tertiary)] max-w-md">
                  Choose a symbol from your watchlist to view real-time LTP analysis, gamma exposure, and coaching guidance.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Symbol Header */}
      <div className="px-4 py-3 bg-[var(--bg-secondary)] border-b border-[var(--border-primary)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-[var(--text-primary)]">{selectedSymbol}</h2>
            {watchlistItem?.quote && (
              <>
                <span className="text-lg font-mono text-[var(--text-primary)]">
                  ${watchlistItem.quote.last_price?.toFixed(2)}
                </span>
                <span className={cn(
                  'text-sm font-mono px-2 py-0.5 rounded',
                  (watchlistItem.quote.change_percent || 0) >= 0
                    ? 'bg-[var(--success)]/10 text-[var(--success)]'
                    : 'bg-[var(--error)]/10 text-[var(--error)]'
                )}>
                  {(watchlistItem.quote.change_percent || 0) >= 0 ? '+' : ''}
                  {(watchlistItem.quote.change_percent || 0).toFixed(2)}%
                </span>
              </>
            )}
            {ltpAnalysis && <GradeBadge grade={ltpAnalysis.grade} />}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onShowScreenshotUpload}>
              <Camera className="w-4 h-4 mr-1" />
              Analyze Chart
            </Button>
            {mode !== 'trade' && (
              <Button variant="primary" size="sm" onClick={onShowTradeEntry}>
                <Play className="w-4 h-4 mr-1" />
                Log Trade
              </Button>
            )}
            <button
              onClick={() => {
                const tvSymbol = selectedSymbol.includes(':') ? selectedSymbol : `NASDAQ:${selectedSymbol}`;
                window.open(`https://www.tradingview.com/chart/?symbol=${tvSymbol}`, '_blank');
              }}
              className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded"
              title="Open in TradingView"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Active Trade Panel */}
      {activeTrade && mode === 'trade' && (
        <ActiveTradePanel
          trade={activeTrade}
          currentRMultiple={currentRMultiple}
          onClose={onCloseTrade}
          currentPrice={watchlistItem?.quote?.last_price || activeTrade.entryPrice}
        />
      )}

      {/* Analysis Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="w-8 h-8 text-[var(--accent-primary)] animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* LTP Analysis */}
            {ltpAnalysis && <LTPAnalysisPanel analysis={ltpAnalysis} />}

            {/* Multi-Timeframe Grid */}
            {ltpAnalysis?.trend.mtf && <MTFAnalysisPanel mtf={ltpAnalysis.trend.mtf} />}

            {/* Key Levels */}
            {ltpAnalysis && <KeyLevelsPanel analysis={ltpAnalysis} currentPrice={watchlistItem?.quote?.last_price || 0} />}

            {/* Gamma Exposure */}
            {gammaData && <GammaExposurePanel data={gammaData} />}

            {/* Fair Value Gaps */}
            {fvgData && <FVGPanel data={fvgData} currentPrice={watchlistItem?.quote?.last_price || 0} />}

            {/* Screenshot Analysis Results */}
            {screenshotAnalysis && <ScreenshotAnalysisPanel analysis={screenshotAnalysis} />}
          </div>
        )}
      </div>
    </div>
  );
}

function GradeBadge({ grade }: { grade: string }) {
  const gradeColors: Record<string, string> = {
    'A+': 'bg-[var(--accent-primary)] text-white',
    'A': 'bg-[var(--success)] text-white',
    'B': 'bg-[var(--success)]/70 text-white',
    'C': 'bg-[var(--warning)] text-black',
    'D': 'bg-[var(--error)]/70 text-white',
    'F': 'bg-[var(--error)] text-white',
  };

  return (
    <span className={cn(
      'px-2 py-0.5 text-sm font-bold rounded',
      gradeColors[grade] || 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'
    )}>
      {grade}
    </span>
  );
}

// ============================================================================
// LTP ANALYSIS PANEL
// ============================================================================

function LTPAnalysisPanel({ analysis }: { analysis: LTPAnalysis }) {
  return (
    <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded">
      <div className="px-4 py-3 border-b border-[var(--border-primary)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gauge className="w-5 h-5 text-[var(--accent-primary)]" />
            <h3 className="font-semibold text-[var(--text-primary)]">LTP Analysis</h3>
          </div>
          <div className="flex items-center gap-3">
            <GradeBadge grade={analysis.grade} />
            <span className="text-2xl font-bold font-mono text-[var(--accent-primary)]">
              {analysis.confluenceScore}%
            </span>
          </div>
        </div>
      </div>

      <div className="p-4">
        {/* Score Bars */}
        <div className="grid grid-cols-3 gap-6 mb-4">
          <ScoreBar label="Level" score={analysis.levels.levelScore} icon={<Layers className="w-4 h-4" />} />
          <ScoreBar label="Trend" score={analysis.trend.trendScore} icon={<TrendUp className="w-4 h-4" />} />
          <ScoreBar label="Patience" score={analysis.patience.patienceScore} icon={<Timer className="w-4 h-4" />} />
        </div>

        {/* Recommendation */}
        <div className="p-3 bg-[var(--bg-tertiary)] rounded">
          <div className="flex items-center gap-2 mb-1">
            <span className={cn(
              'px-2 py-0.5 text-xs font-bold uppercase rounded',
              analysis.setupQuality === 'Strong' ? 'bg-[var(--success)]/20 text-[var(--success)]' :
              analysis.setupQuality === 'Moderate' ? 'bg-[var(--warning)]/20 text-[var(--warning)]' :
              'bg-[var(--error)]/20 text-[var(--error)]'
            )}>
              {analysis.setupQuality}
            </span>
          </div>
          <p className="text-sm text-[var(--text-secondary)]">{analysis.recommendation}</p>
        </div>
      </div>
    </div>
  );
}

function ScoreBar({ label, score, icon }: { label: string; score: number; icon: React.ReactNode }) {
  const getColor = () => {
    if (score >= 70) return 'var(--success)';
    if (score >= 50) return 'var(--warning)';
    return 'var(--error)';
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-[var(--text-secondary)]">
          {icon}
          <span className="text-xs font-semibold uppercase">{label}</span>
        </div>
        <span className="text-sm font-bold font-mono" style={{ color: getColor() }}>{score}</span>
      </div>
      <div className="h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${score}%`, backgroundColor: getColor() }}
        />
      </div>
    </div>
  );
}

// ============================================================================
// MTF ANALYSIS PANEL
// ============================================================================

function MTFAnalysisPanel({ mtf }: { mtf: LTPAnalysis['trend']['mtf'] }) {
  const timeframes = mtf.timeframes || [];

  return (
    <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded">
      <div className="px-4 py-3 border-b border-[var(--border-primary)]">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-5 h-5 text-[var(--accent-primary)]" />
          <h3 className="font-semibold text-[var(--text-primary)]">Multi-Timeframe Analysis</h3>
        </div>
      </div>

      <div className="p-4">
        <div className="grid grid-cols-7 gap-2">
          {['2m', '5m', '15m', '1h', '4h', 'D', 'W'].map((tf) => {
            const tfData = timeframes.find(t => t.timeframe === tf);
            const trend = tfData?.trend || 'neutral';
            const alignment = tfData?.emaAlignment || 'mixed';

            return (
              <div key={tf} className="text-center">
                <div className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase mb-1">{tf}</div>
                <div className={cn(
                  'w-full aspect-square rounded flex items-center justify-center',
                  trend === 'bullish' ? 'bg-[var(--success)]/20' :
                  trend === 'bearish' ? 'bg-[var(--error)]/20' :
                  'bg-[var(--bg-tertiary)]'
                )}>
                  {trend === 'bullish' ? (
                    <ArrowUpRight className="w-5 h-5 text-[var(--success)]" />
                  ) : trend === 'bearish' ? (
                    <ArrowDownRight className="w-5 h-5 text-[var(--error)]" />
                  ) : (
                    <Minus className="w-5 h-5 text-[var(--text-tertiary)]" />
                  )}
                </div>
                <div className={cn(
                  'text-[10px] mt-1',
                  alignment === 'bullish' ? 'text-[var(--success)]' :
                  alignment === 'bearish' ? 'text-[var(--error)]' :
                  'text-[var(--text-tertiary)]'
                )}>
                  {alignment === 'bullish' ? 'EMA+' : alignment === 'bearish' ? 'EMA-' : 'Mixed'}
                </div>
              </div>
            );
          })}
        </div>

        {/* Overall Assessment */}
        <div className="mt-4 pt-4 border-t border-[var(--border-primary)]">
          <div className="flex items-center justify-between text-sm">
            <span className="text-[var(--text-tertiary)]">Timeframe Alignment</span>
            <span className={cn(
              'font-semibold',
              mtf.overallBias === 'bullish' ? 'text-[var(--success)]' :
              mtf.overallBias === 'bearish' ? 'text-[var(--error)]' :
              'text-[var(--warning)]'
            )}>
              {mtf.overallBias === 'bullish' ? 'Bullish Aligned' :
               mtf.overallBias === 'bearish' ? 'Bearish Aligned' :
               'Mixed/Conflicting'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// KEY LEVELS PANEL
// ============================================================================

function KeyLevelsPanel({ analysis, currentPrice }: { analysis: LTPAnalysis; currentPrice: number }) {
  const levels = analysis.levels;

  const levelItems = [
    { label: 'PDH', value: levels.pdh, type: 'resistance' },
    { label: 'PDL', value: levels.pdl, type: 'support' },
    { label: 'VWAP', value: levels.vwap, type: 'anchor' },
    { label: 'ORB-H', value: levels.orbHigh, type: 'resistance' },
    { label: 'ORB-L', value: levels.orbLow, type: 'support' },
    { label: '9 EMA', value: levels.ema9, type: 'ma' },
    { label: '21 EMA', value: levels.ema21, type: 'ma' },
    { label: '200 SMA', value: levels.sma200, type: 'major' },
  ].filter(l => l.value !== null);

  return (
    <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded">
      <div className="px-4 py-3 border-b border-[var(--border-primary)]">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-[var(--accent-primary)]" />
          <h3 className="font-semibold text-[var(--text-primary)]">Key Levels</h3>
          <span className={cn(
            'px-2 py-0.5 text-xs font-semibold rounded',
            levels.pricePosition === 'above_vwap' ? 'bg-[var(--success)]/20 text-[var(--success)]' :
            levels.pricePosition === 'below_vwap' ? 'bg-[var(--error)]/20 text-[var(--error)]' :
            'bg-[var(--warning)]/20 text-[var(--warning)]'
          )}>
            {levels.pricePosition === 'above_vwap' ? 'Above VWAP' :
             levels.pricePosition === 'below_vwap' ? 'Below VWAP' : 'At VWAP'}
          </span>
        </div>
      </div>

      <div className="p-4">
        <div className="grid grid-cols-4 gap-3">
          {levelItems.map(({ label, value, type }) => {
            const distance = currentPrice > 0 ? ((value! - currentPrice) / currentPrice * 100) : 0;
            const isNear = Math.abs(distance) < 0.5;

            return (
              <div
                key={label}
                className={cn(
                  'p-2 rounded border',
                  isNear ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/5' : 'border-[var(--border-primary)]',
                  type === 'resistance' && 'border-l-2 border-l-[var(--error)]',
                  type === 'support' && 'border-l-2 border-l-[var(--success)]'
                )}
              >
                <div className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase">{label}</div>
                <div className={cn('text-sm font-mono font-semibold', isNear ? 'text-[var(--accent-primary)]' : 'text-[var(--text-primary)]')}>
                  ${value!.toFixed(2)}
                </div>
                <div className={cn(
                  'text-[10px] font-mono',
                  distance > 0 ? 'text-[var(--success)]' : 'text-[var(--error)]'
                )}>
                  {distance > 0 ? '+' : ''}{distance.toFixed(2)}%
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// GAMMA EXPOSURE PANEL
// ============================================================================

function GammaExposurePanel({ data }: { data: GammaExposure }) {
  return (
    <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded">
      <div className="px-4 py-3 border-b border-[var(--border-primary)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Scale className="w-5 h-5 text-[var(--accent-primary)]" />
            <h3 className="font-semibold text-[var(--text-primary)]">Gamma Exposure</h3>
          </div>
          <span className={cn(
            'px-2 py-0.5 text-xs font-bold uppercase rounded',
            data.regime === 'positive' ? 'bg-[var(--success)]/20 text-[var(--success)]' :
            data.regime === 'negative' ? 'bg-[var(--error)]/20 text-[var(--error)]' :
            'bg-[var(--warning)]/20 text-[var(--warning)]'
          )}>
            {data.regime} Gamma
          </span>
        </div>
      </div>

      <div className="p-4">
        <div className="grid grid-cols-4 gap-4 mb-4">
          <GammaLevel label="Max Pain" value={data.maxPain} />
          <GammaLevel label="Gamma Flip" value={data.gammaFlip} />
          <GammaLevel label="Call Wall" value={data.callWall} type="resistance" />
          <GammaLevel label="Put Wall" value={data.putWall} type="support" />
        </div>

        {/* Expected Move */}
        <div className="grid grid-cols-2 gap-4 mb-4 p-3 bg-[var(--bg-tertiary)] rounded">
          <div>
            <div className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase mb-1">Daily Expected Move</div>
            <div className="text-lg font-mono font-bold text-[var(--text-primary)]">
              ${data.expectedMove.daily.toFixed(2)}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase mb-1">Weekly Expected Move</div>
            <div className="text-lg font-mono font-bold text-[var(--text-primary)]">
              ${data.expectedMove.weekly.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Analysis */}
        <div className="text-sm text-[var(--text-secondary)]">
          <p className="mb-2">{data.analysis.summary}</p>
          <p className="text-[var(--accent-primary)]">{data.analysis.tradingImplication}</p>
        </div>
      </div>
    </div>
  );
}

function GammaLevel({ label, value, type }: { label: string; value: number; type?: 'support' | 'resistance' }) {
  return (
    <div className={cn(
      'p-2 rounded border border-[var(--border-primary)]',
      type === 'resistance' && 'border-l-2 border-l-[var(--error)]',
      type === 'support' && 'border-l-2 border-l-[var(--success)]'
    )}>
      <div className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase">{label}</div>
      <div className="text-sm font-mono font-semibold text-[var(--text-primary)]">${value.toFixed(2)}</div>
    </div>
  );
}

// ============================================================================
// FVG PANEL
// ============================================================================

function FVGPanel({ data, currentPrice }: { data: FVGData; currentPrice: number }) {
  return (
    <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded">
      <div className="px-4 py-3 border-b border-[var(--border-primary)]">
        <div className="flex items-center gap-2">
          <Flame className="w-5 h-5 text-[var(--accent-primary)]" />
          <h3 className="font-semibold text-[var(--text-primary)]">Fair Value Gaps</h3>
        </div>
      </div>

      <div className="p-4">
        <div className="grid grid-cols-2 gap-4 mb-4">
          {/* Nearest Bullish FVG */}
          <div className={cn(
            'p-3 rounded border',
            data.nearestBullishFVG ? 'border-[var(--success)]/30 bg-[var(--success)]/5' : 'border-[var(--border-primary)]'
          )}>
            <div className="flex items-center gap-2 mb-2">
              <ArrowUpRight className="w-4 h-4 text-[var(--success)]" />
              <span className="text-xs font-semibold text-[var(--text-tertiary)] uppercase">Bullish FVG</span>
            </div>
            {data.nearestBullishFVG ? (
              <div>
                <div className="text-lg font-mono font-bold text-[var(--success)]">
                  ${data.nearestBullishFVG.midPrice.toFixed(2)}
                </div>
                <div className="text-[10px] text-[var(--text-tertiary)]">
                  ${data.nearestBullishFVG.bottomPrice.toFixed(2)} - ${data.nearestBullishFVG.topPrice.toFixed(2)}
                </div>
              </div>
            ) : (
              <div className="text-sm text-[var(--text-tertiary)]">None nearby</div>
            )}
          </div>

          {/* Nearest Bearish FVG */}
          <div className={cn(
            'p-3 rounded border',
            data.nearestBearishFVG ? 'border-[var(--error)]/30 bg-[var(--error)]/5' : 'border-[var(--border-primary)]'
          )}>
            <div className="flex items-center gap-2 mb-2">
              <ArrowDownRight className="w-4 h-4 text-[var(--error)]" />
              <span className="text-xs font-semibold text-[var(--text-tertiary)] uppercase">Bearish FVG</span>
            </div>
            {data.nearestBearishFVG ? (
              <div>
                <div className="text-lg font-mono font-bold text-[var(--error)]">
                  ${data.nearestBearishFVG.midPrice.toFixed(2)}
                </div>
                <div className="text-[10px] text-[var(--text-tertiary)]">
                  ${data.nearestBearishFVG.bottomPrice.toFixed(2)} - ${data.nearestBearishFVG.topPrice.toFixed(2)}
                </div>
              </div>
            ) : (
              <div className="text-sm text-[var(--text-tertiary)]">None nearby</div>
            )}
          </div>
        </div>

        {/* Trading Context */}
        <div className="p-3 bg-[var(--bg-tertiary)] rounded text-sm text-[var(--text-secondary)]">
          {data.tradingContext.summary}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SCREENSHOT ANALYSIS PANEL
// ============================================================================

function ScreenshotAnalysisPanel({ analysis }: { analysis: Record<string, unknown> }) {
  const setup = analysis.setup as { quality?: string; direction?: string } | undefined;
  const recommendation = analysis.recommendation as { action?: string; reasoning?: string } | undefined;
  const coaching = analysis.coaching as { message?: string; warnings?: string[]; tips?: string[] } | undefined;

  return (
    <div className="bg-[var(--bg-secondary)] border border-[var(--accent-primary)]/30 rounded">
      <div className="px-4 py-3 border-b border-[var(--border-primary)] bg-[var(--accent-primary)]/5">
        <div className="flex items-center gap-2">
          <Camera className="w-5 h-5 text-[var(--accent-primary)]" />
          <h3 className="font-semibold text-[var(--text-primary)]">Chart Analysis</h3>
          {setup?.quality && <GradeBadge grade={setup.quality} />}
        </div>
      </div>

      <div className="p-4">
        {recommendation && (
          <div className={cn(
            'p-3 rounded mb-4',
            recommendation.action === 'ENTER' ? 'bg-[var(--success)]/10' :
            recommendation.action === 'AVOID' ? 'bg-[var(--error)]/10' :
            'bg-[var(--warning)]/10'
          )}>
            <div className="flex items-center gap-2 mb-2">
              {recommendation.action === 'ENTER' && <Check className="w-5 h-5 text-[var(--success)]" />}
              {recommendation.action === 'AVOID' && <XCircle className="w-5 h-5 text-[var(--error)]" />}
              {recommendation.action === 'WAIT' && <Clock className="w-5 h-5 text-[var(--warning)]" />}
              <span className="font-bold">{recommendation.action}</span>
            </div>
            <p className="text-sm text-[var(--text-secondary)]">{recommendation.reasoning}</p>
          </div>
        )}

        {coaching?.message && (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <GraduationCap className="w-4 h-4 text-[var(--accent-primary)]" />
              <span className="text-xs font-semibold text-[var(--text-tertiary)] uppercase">Coach Says</span>
            </div>
            <p className="text-sm text-[var(--text-primary)]">{coaching.message}</p>
          </div>
        )}

        {coaching?.warnings && coaching.warnings.length > 0 && (
          <div className="space-y-2">
            {coaching.warnings.map((warning, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-[var(--error)]">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{warning}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// ACTIVE TRADE PANEL
// ============================================================================

function ActiveTradePanel({
  trade,
  currentRMultiple,
  onClose,
  currentPrice,
}: {
  trade: ActiveTrade;
  currentRMultiple: number;
  onClose: () => void;
  currentPrice: number;
}) {
  const pnl = trade.direction === 'long'
    ? currentPrice - trade.entryPrice
    : trade.entryPrice - currentPrice;
  const pnlPercent = (pnl / trade.entryPrice) * 100;
  const isProfit = pnl >= 0;

  return (
    <div className={cn(
      'px-4 py-3 border-b',
      isProfit ? 'bg-[var(--success)]/5 border-[var(--success)]/30' : 'bg-[var(--error)]/5 border-[var(--error)]/30'
    )}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          {/* Direction & Entry */}
          <div className="flex items-center gap-2">
            {trade.direction === 'long' ? (
              <TrendingUp className="w-5 h-5 text-[var(--success)]" />
            ) : (
              <TrendingDown className="w-5 h-5 text-[var(--error)]" />
            )}
            <div>
              <div className="text-sm font-semibold text-[var(--text-primary)]">
                {trade.direction.toUpperCase()} @ ${trade.entryPrice.toFixed(2)}
              </div>
              <div className="text-xs text-[var(--text-tertiary)]">
                Stop: ${trade.stopLoss.toFixed(2)} | T1: ${trade.target1.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Current Price */}
          <div>
            <div className="text-xs text-[var(--text-tertiary)]">Current</div>
            <div className="text-lg font-mono font-bold text-[var(--text-primary)]">${currentPrice.toFixed(2)}</div>
          </div>

          {/* P&L */}
          <div>
            <div className="text-xs text-[var(--text-tertiary)]">P&L</div>
            <div className={cn(
              'text-lg font-mono font-bold',
              isProfit ? 'text-[var(--success)]' : 'text-[var(--error)]'
            )}>
              {isProfit ? '+' : ''}{pnlPercent.toFixed(2)}%
            </div>
          </div>

          {/* R-Multiple */}
          <div>
            <div className="text-xs text-[var(--text-tertiary)]">R-Multiple</div>
            <div className={cn(
              'text-2xl font-bold font-mono',
              currentRMultiple >= 2 ? 'text-[var(--accent-primary)]' :
              currentRMultiple >= 1 ? 'text-[var(--success)]' :
              currentRMultiple >= 0 ? 'text-[var(--warning)]' :
              'text-[var(--error)]'
            )}>
              {currentRMultiple >= 0 ? '+' : ''}{currentRMultiple.toFixed(2)}R
            </div>
          </div>
        </div>

        <Button variant="ghost" size="sm" onClick={onClose}>
          Close Trade
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// COACH CHAT PANEL
// ============================================================================

function CoachChatPanel({
  messages,
  userQuestion,
  setUserQuestion,
  onAskQuestion,
  askingQuestion,
  coachingMessages,
  selectedSymbol,
  ltpAnalysis,
}: {
  messages: CompanionMessage[];
  userQuestion: string;
  setUserQuestion: (q: string) => void;
  onAskQuestion: () => void;
  askingQuestion: boolean;
  coachingMessages: CoachingMessage[];
  selectedSymbol: string | null;
  ltpAnalysis: LTPAnalysis | null;
}) {
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--border-primary)]">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-[var(--accent-primary)]" />
          <h3 className="font-semibold text-[var(--text-primary)]">AI Coach</h3>
        </div>
      </div>

      {/* Coaching Messages */}
      {coachingMessages.length > 0 && (
        <div className="px-4 py-3 border-b border-[var(--border-primary)] bg-[var(--accent-primary)]/5 max-h-48 overflow-y-auto">
          <div className="space-y-2">
            {coachingMessages.slice(0, 3).map((msg, i) => (
              <CoachingMessageCard key={i} message={msg} />
            ))}
          </div>
        </div>
      )}

      {/* Grade Explanation */}
      {selectedSymbol && ltpAnalysis && (
        <div className="px-4 py-3 border-b border-[var(--border-primary)]">
          <div className="flex items-center gap-2 mb-2">
            <GraduationCap className="w-4 h-4 text-[var(--accent-primary)]" />
            <span className="text-xs font-semibold text-[var(--text-tertiary)] uppercase">Grade Explanation</span>
          </div>
          <p className="text-sm text-[var(--text-secondary)]">
            {kcuCoachingRules.getGradeExplanation(ltpAnalysis.grade, ltpAnalysis)}
          </p>
        </div>
      )}

      {/* Question Input */}
      <div className="px-4 py-3 border-b border-[var(--border-primary)]">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Ask about setups, LTP, or trading..."
            value={userQuestion}
            onChange={(e) => setUserQuestion(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onAskQuestion()}
            disabled={askingQuestion}
            className="flex-1 px-3 py-2 text-sm bg-[var(--bg-primary)] border border-[var(--border-primary)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:border-[var(--accent-primary)] focus:outline-none rounded disabled:opacity-50"
          />
          <Button
            variant="primary"
            size="sm"
            onClick={onAskQuestion}
            disabled={askingQuestion || !userQuestion.trim()}
          >
            {askingQuestion ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Messages List */}
      <div className="flex-1 overflow-y-auto">
        {messages.length > 0 ? (
          <div className="divide-y divide-[var(--border-primary)]">
            {messages.map((msg) => (
              <ChatMessageCard key={msg.id} message={msg} />
            ))}
          </div>
        ) : (
          <div className="p-8 text-center">
            <MessageSquare className="w-10 h-10 mx-auto mb-2 text-[var(--text-tertiary)] opacity-30" />
            <p className="text-sm text-[var(--text-tertiary)]">No messages yet</p>
            <p className="text-xs text-[var(--text-tertiary)] opacity-70 mt-1">
              Ask about setups, LTP analysis, or trading guidance
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function CoachingMessageCard({ message }: { message: CoachingMessage }) {
  const icons = {
    guidance: <Info className="w-4 h-4" />,
    warning: <AlertTriangle className="w-4 h-4" />,
    opportunity: <Zap className="w-4 h-4" />,
    education: <BookOpen className="w-4 h-4" />,
    trade_management: <Target className="w-4 h-4" />,
  };

  const colors = {
    guidance: 'text-[var(--text-secondary)]',
    warning: 'text-[var(--error)]',
    opportunity: 'text-[var(--accent-primary)]',
    education: 'text-[var(--success)]',
    trade_management: 'text-[var(--warning)]',
  };

  return (
    <div className="p-2 rounded bg-[var(--bg-secondary)]">
      <div className={cn('flex items-center gap-2 mb-1', colors[message.type])}>
        {icons[message.type]}
        <span className="text-xs font-semibold">{message.title}</span>
      </div>
      <p className="text-xs text-[var(--text-secondary)]">{message.message}</p>
      {message.action && (
        <p className="text-xs text-[var(--accent-primary)] mt-1 font-medium">{message.action}</p>
      )}
    </div>
  );
}

function ChatMessageCard({ message }: { message: CompanionMessage }) {
  return (
    <div className="p-4 hover:bg-[var(--bg-tertiary)]/50 transition-colors">
      <p className="text-sm text-[var(--text-primary)] whitespace-pre-wrap">{message.content}</p>
      <div className="flex items-center gap-2 mt-2">
        <span className="text-xs text-[var(--text-tertiary)]">
          {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
        <span className="text-xs text-[var(--text-tertiary)] capitalize">
          {message.message_type.replace('_', ' ')}
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// SETUP CARD
// ============================================================================

function SetupCard({ setup, variant }: { setup: DetectedSetup; variant: 'ready' | 'forming' }) {
  const isReady = variant === 'ready';
  const isBullish = setup.direction === 'bullish';

  return (
    <div className={cn(
      'bg-[var(--bg-secondary)] border rounded overflow-hidden transition-all hover:border-[var(--accent-primary)]/50',
      isReady ? 'border-[var(--accent-primary)]/30' : 'border-[var(--border-primary)]'
    )}>
      {/* Header */}
      <div className={cn('px-3 py-2 flex items-center justify-between', isReady && 'bg-[var(--accent-primary)]/5')}>
        <div className="flex items-center gap-2">
          {isBullish ? (
            <TrendingUp className="w-4 h-4 text-[var(--success)]" />
          ) : (
            <TrendingDown className="w-4 h-4 text-[var(--error)]" />
          )}
          <span className="font-bold text-[var(--text-primary)]">{setup.symbol}</span>
          <span className={cn(
            'px-1.5 py-0.5 text-[9px] font-bold uppercase rounded',
            isBullish ? 'bg-[var(--success)]/10 text-[var(--success)]' : 'bg-[var(--error)]/10 text-[var(--error)]'
          )}>
            {isBullish ? 'Long' : 'Short'}
          </span>
        </div>
        <span className={cn(
          'text-lg font-bold font-mono',
          setup.confluence_score >= 75 ? 'text-[var(--accent-primary)]' :
          setup.confluence_score >= 60 ? 'text-[var(--success)]' :
          'text-[var(--warning)]'
        )}>
          {setup.confluence_score}%
        </span>
      </div>

      {/* Scores */}
      <div className="px-3 py-2 border-t border-[var(--border-primary)]">
        <div className="flex gap-2">
          <LTPMiniBar level={setup.level_score} trend={setup.trend_score} patience={setup.patience_score} />
        </div>
      </div>

      {/* Coach Note */}
      {setup.coach_note && (
        <div className="px-3 py-2 bg-[var(--bg-tertiary)] border-t border-[var(--border-primary)]">
          <p className="text-xs text-[var(--text-secondary)]">
            <span className="text-[var(--accent-primary)] font-semibold">Coach: </span>
            {setup.coach_note}
          </p>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MODALS
// ============================================================================

function ScreenshotUploadModal({
  onClose,
  onAnalyze,
  analyzing,
}: {
  onClose: () => void;
  onAnalyze: (imageData: string) => void;
  analyzing: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      onAnalyze(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items);
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) handleFile(file);
        break;
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg w-full max-w-lg p-6"
        onClick={e => e.stopPropagation()}
        onPaste={handlePaste}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Analyze Chart Screenshot</h2>
          <button onClick={onClose} className="p-1 hover:bg-[var(--bg-tertiary)] rounded">
            <X className="w-5 h-5 text-[var(--text-tertiary)]" />
          </button>
        </div>

        <div
          className={cn(
            'border-2 border-dashed rounded-lg p-8 text-center transition-colors',
            dragActive ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/5' : 'border-[var(--border-primary)]',
            analyzing && 'opacity-50 pointer-events-none'
          )}
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
        >
          {analyzing ? (
            <div className="flex flex-col items-center">
              <RefreshCw className="w-12 h-12 text-[var(--accent-primary)] animate-spin mb-4" />
              <p className="text-sm text-[var(--text-secondary)]">Analyzing chart with AI...</p>
            </div>
          ) : (
            <>
              <Upload className="w-12 h-12 mx-auto mb-4 text-[var(--text-tertiary)]" />
              <p className="text-sm text-[var(--text-primary)] mb-2">
                Drop your chart screenshot here or paste from clipboard
              </p>
              <p className="text-xs text-[var(--text-tertiary)] mb-4">
                Supports PNG, JPG, and other image formats
              </p>
              <Button
                variant="primary"
                onClick={() => fileInputRef.current?.click()}
              >
                Choose File
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
            </>
          )}
        </div>

        <p className="text-xs text-[var(--text-tertiary)] mt-4">
          The AI will analyze your chart using KCU methodology and provide LTP coaching.
        </p>
      </div>
    </div>
  );
}

function TradeEntryModal({
  onClose,
  onStartTrade,
  selectedSymbol,
  ltpAnalysis,
  setup,
}: {
  onClose: () => void;
  onStartTrade: (trade: ActiveTrade) => void;
  selectedSymbol: string | null;
  ltpAnalysis: LTPAnalysis | null;
  setup?: DetectedSetup;
}) {
  const [symbol, setSymbol] = useState(selectedSymbol || '');
  const [direction, setDirection] = useState<'long' | 'short'>(
    setup?.direction === 'bearish' ? 'short' : 'long'
  );
  const [entryPrice, setEntryPrice] = useState(setup?.suggested_entry?.toString() || '');
  const [stopLoss, setStopLoss] = useState(setup?.suggested_stop?.toString() || '');
  const [target1, setTarget1] = useState(setup?.target_1?.toString() || '');
  const [target2, setTarget2] = useState(setup?.target_2?.toString() || '');
  const [positionSize, setPositionSize] = useState('100');

  const handleSubmit = () => {
    if (!symbol || !entryPrice || !stopLoss || !target1) return;

    onStartTrade({
      symbol: symbol.toUpperCase(),
      direction,
      entryPrice: parseFloat(entryPrice),
      stopLoss: parseFloat(stopLoss),
      target1: parseFloat(target1),
      target2: target2 ? parseFloat(target2) : undefined,
      positionSize: parseInt(positionSize),
      enteredAt: new Date().toISOString(),
    });
  };

  const riskReward = entryPrice && stopLoss && target1
    ? Math.abs(parseFloat(target1) - parseFloat(entryPrice)) / Math.abs(parseFloat(entryPrice) - parseFloat(stopLoss))
    : 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg w-full max-w-md p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Log Trade Entry</h2>
          <button onClick={onClose} className="p-1 hover:bg-[var(--bg-tertiary)] rounded">
            <X className="w-5 h-5 text-[var(--text-tertiary)]" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Symbol */}
          <div>
            <label className="block text-xs font-semibold text-[var(--text-tertiary)] uppercase mb-1">Symbol</label>
            <input
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-primary)] text-[var(--text-primary)] rounded focus:border-[var(--accent-primary)] focus:outline-none"
              placeholder="AAPL"
            />
          </div>

          {/* Direction */}
          <div>
            <label className="block text-xs font-semibold text-[var(--text-tertiary)] uppercase mb-1">Direction</label>
            <div className="flex gap-2">
              <button
                onClick={() => setDirection('long')}
                className={cn(
                  'flex-1 py-2 rounded font-semibold transition-colors',
                  direction === 'long'
                    ? 'bg-[var(--success)] text-white'
                    : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'
                )}
              >
                LONG
              </button>
              <button
                onClick={() => setDirection('short')}
                className={cn(
                  'flex-1 py-2 rounded font-semibold transition-colors',
                  direction === 'short'
                    ? 'bg-[var(--error)] text-white'
                    : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'
                )}
              >
                SHORT
              </button>
            </div>
          </div>

          {/* Prices */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[var(--text-tertiary)] uppercase mb-1">Entry Price</label>
              <input
                type="number"
                step="0.01"
                value={entryPrice}
                onChange={(e) => setEntryPrice(e.target.value)}
                className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-primary)] text-[var(--text-primary)] rounded focus:border-[var(--accent-primary)] focus:outline-none font-mono"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--text-tertiary)] uppercase mb-1">Stop Loss</label>
              <input
                type="number"
                step="0.01"
                value={stopLoss}
                onChange={(e) => setStopLoss(e.target.value)}
                className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--error)]/30 text-[var(--text-primary)] rounded focus:border-[var(--error)] focus:outline-none font-mono"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--text-tertiary)] uppercase mb-1">Target 1</label>
              <input
                type="number"
                step="0.01"
                value={target1}
                onChange={(e) => setTarget1(e.target.value)}
                className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--success)]/30 text-[var(--text-primary)] rounded focus:border-[var(--success)] focus:outline-none font-mono"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--text-tertiary)] uppercase mb-1">Target 2 (Optional)</label>
              <input
                type="number"
                step="0.01"
                value={target2}
                onChange={(e) => setTarget2(e.target.value)}
                className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-primary)] text-[var(--text-primary)] rounded focus:border-[var(--accent-primary)] focus:outline-none font-mono"
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Position Size */}
          <div>
            <label className="block text-xs font-semibold text-[var(--text-tertiary)] uppercase mb-1">Position Size (Shares)</label>
            <input
              type="number"
              value={positionSize}
              onChange={(e) => setPositionSize(e.target.value)}
              className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-primary)] text-[var(--text-primary)] rounded focus:border-[var(--accent-primary)] focus:outline-none font-mono"
              placeholder="100"
            />
          </div>

          {/* R:R Preview */}
          {riskReward > 0 && (
            <div className="p-3 bg-[var(--bg-tertiary)] rounded">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--text-tertiary)]">Risk/Reward Ratio</span>
                <span className={cn(
                  'text-lg font-bold font-mono',
                  riskReward >= 2 ? 'text-[var(--success)]' :
                  riskReward >= 1 ? 'text-[var(--warning)]' :
                  'text-[var(--error)]'
                )}>
                  {riskReward.toFixed(2)}:1
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <Button variant="ghost" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={!symbol || !entryPrice || !stopLoss || !target1}
            className="flex-1"
          >
            Start Trade
          </Button>
        </div>
      </div>
    </div>
  );
}
