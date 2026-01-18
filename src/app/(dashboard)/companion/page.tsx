'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { useCompanionStream, type CompanionEvent } from '@/hooks/useCompanionStream';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { CompanionSessionReport } from '@/components/companion/session-report';
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
} from 'lucide-react';

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

export default function CompanionPage() {
  const [watchlist, setWatchlist] = useState<WatchlistSymbol[]>([]);
  const [setups, setSetups] = useState<DetectedSetup[]>([]);
  const [newSymbol, setNewSymbol] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [marketStatus, setMarketStatus] = useState<MarketStatus | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<CompanionMessage[]>([]);
  const [showMessages, setShowMessages] = useState(false);
  const [userQuestion, setUserQuestion] = useState('');
  const [askingQuestion, setAskingQuestion] = useState(false);
  const sessionStartTime = useRef<Date | null>(null);

  // Handle real-time SSE events
  const handleStreamEvent = useCallback((event: CompanionEvent) => {
    if (event.type === 'setup_forming' || event.type === 'setup_ready') {
      setSetups(prev => {
        const existing = prev.findIndex(s => s.symbol === event.data.symbol);
        const newSetup: DetectedSetup = {
          id: event.data.id,
          symbol: event.data.symbol,
          direction: event.data.direction,
          setup_stage: event.type === 'setup_ready' ? 'ready' : 'forming',
          confluence_score: event.data.confluenceScore,
          level_score: (event.data as any).levelScore || 0,
          trend_score: (event.data as any).trendScore || 0,
          patience_score: (event.data as any).patienceScore || 0,
          mtf_score: (event.data as any).mtfScore || 0,
          primary_level_type: (event.data as any).primaryLevelType || '',
          primary_level_price: (event.data as any).primaryLevelPrice || 0,
          patience_candles: (event.data as any).patienceCandles || 0,
          coach_note: event.data.coachNote,
          suggested_entry: event.data.suggestedEntry || 0,
          suggested_stop: event.data.suggestedStop || 0,
          target_1: event.data.target1 || 0,
          target_2: event.data.target2 || 0,
          target_3: (event.data as any).target3 || 0,
          risk_reward: (event.data as any).riskReward || 0,
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

  // Start/end session tracking
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
        console.error('Error starting companion session:', error);
      }
    };

    startSession();
    fetchMessages();

    // End session on unmount
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
      fetchMessages();
    }, streamConnected ? 60000 : 30000);

    return () => clearInterval(interval);
  }, [streamConnected]);

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
    } catch (error) {
      // Silently fail - market status is optional
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

  const askCompanionQuestion = async () => {
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
        marketOpen: marketStatus?.isOpen
      };

      const res = await fetch('/api/companion/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: userQuestion,
          context
        })
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

  const createPracticeFromSetup = async (setup: DetectedSetup) => {
    try {
      const res = await fetch('/api/companion/practice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          setupId: setup.id,
          symbol: setup.symbol,
          direction: setup.direction,
          confluenceScore: setup.confluence_score,
          levelScore: setup.level_score,
          trendScore: setup.trend_score,
          patienceScore: setup.patience_score,
          primaryLevelType: setup.primary_level_type,
          primaryLevelPrice: setup.primary_level_price,
          suggestedEntry: setup.suggested_entry,
          suggestedStop: setup.suggested_stop,
          target1: setup.target_1,
          target2: setup.target_2,
          coachNote: setup.coach_note
        })
      });

      if (res.ok) {
        const data = await res.json();
        // Navigate to practice with the new scenario
        window.location.href = `/practice?scenario=${data.scenario.id}`;
      }
    } catch (error) {
      console.error('Error creating practice scenario:', error);
    }
  };

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
      fetchWatchlist();
    } catch (error) {
      console.error('Error removing symbol:', error);
    }
  };

  const refreshLevels = async () => {
    setRefreshing(true);
    try {
      await fetch('/api/companion/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshAll: true })
      });
      fetchWatchlist();
      fetchSetups();
    } catch (error) {
      console.error('Error refreshing:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const readySetups = setups.filter(s => s.setup_stage === 'ready');
  const formingSetups = setups.filter(s => s.setup_stage === 'forming');

  return (
    <div className="space-y-4">
      {/* Market Context Header */}
      <MarketContextHeader
        marketStatus={marketStatus}
        streamConnected={streamConnected}
        streamError={streamError}
        onRefresh={refreshLevels}
        refreshing={refreshing}
        readyCount={readySetups.length}
        formingCount={formingSetups.length}
        symbolCount={watchlist.length}
      />

      {/* Main 2-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Left Column - Watchlist */}
        <div className="lg:col-span-1 space-y-4">
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

        {/* Right Column - Setups & Levels */}
        <div className="lg:col-span-3 space-y-4">
          {/* Ready Setups - Priority Display */}
          {readySetups.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 bg-[var(--accent-primary)] rounded-full animate-pulse" />
                <h2 className="text-sm font-semibold text-[var(--accent-primary)] uppercase tracking-wider">
                  Ready to Trade ({readySetups.length})
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {readySetups.map((setup) => (
                  <SetupCard key={setup.id} setup={setup} variant="ready" onPractice={() => createPracticeFromSetup(setup)} />
                ))}
              </div>
            </section>
          )}

          {/* Forming Setups */}
          {formingSetups.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-[var(--text-tertiary)]" />
                <h2 className="text-sm font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
                  Forming ({formingSetups.length})
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {formingSetups.map((setup) => (
                  <SetupCard key={setup.id} setup={setup} variant="forming" onPractice={() => createPracticeFromSetup(setup)} />
                ))}
              </div>
            </section>
          )}

          {/* Empty State */}
          {setups.length === 0 && !loading && (
            <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] p-12 text-center">
              <Target className="w-16 h-16 mx-auto mb-4 text-[var(--text-tertiary)] opacity-50" />
              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">No Active Setups</h3>
              <p className="text-[var(--text-tertiary)] max-w-md mx-auto">
                Add symbols to your watchlist and the LTP detection engine will scan for setups in real-time.
              </p>
            </div>
          )}

          {/* Key Levels Panel */}
          {selectedSymbol && (
            <KeyLevelsPanel
              symbol={selectedSymbol}
              watchlistItem={watchlist.find(w => w.symbol === selectedSymbol)}
              setup={setups.find(s => s.symbol === selectedSymbol)}
              onClose={() => setSelectedSymbol(null)}
            />
          )}
        </div>
      </div>

      {/* AI Companion Chat Panel */}
      <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)]">
        <div
          className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-[var(--bg-tertiary)]"
          onClick={() => setShowMessages(!showMessages)}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[var(--accent-primary)]/10 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-[var(--accent-primary)]" />
            </div>
            <div>
              <span className="font-semibold text-[var(--text-primary)]">AI Companion</span>
              <span className="text-xs text-[var(--text-tertiary)] ml-2">Ask about setups, LTP analysis, or trading guidance</span>
            </div>
            {messages.length > 0 && (
              <span className="px-2 py-0.5 bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] text-xs font-medium">
                {messages.length} messages
              </span>
            )}
          </div>
          {showMessages ? <ChevronUp className="w-4 h-4 text-[var(--text-tertiary)]" /> : <ChevronDown className="w-4 h-4 text-[var(--text-tertiary)]" />}
        </div>

        {showMessages && (
          <div className="border-t border-[var(--border-primary)]">
            {/* Question Input */}
            <div className="p-4 bg-[var(--bg-tertiary)]">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Ask about a setup, LTP analysis, or trading question..."
                  value={userQuestion}
                  onChange={(e) => setUserQuestion(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && askCompanionQuestion()}
                  disabled={askingQuestion}
                  className="flex-1 px-4 py-2 text-sm bg-[var(--bg-primary)] border border-[var(--border-primary)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:border-[var(--accent-primary)] focus:outline-none disabled:opacity-50"
                />
                <Button
                  variant="primary"
                  size="sm"
                  onClick={askCompanionQuestion}
                  disabled={askingQuestion || !userQuestion.trim()}
                  icon={askingQuestion ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                >
                  {askingQuestion ? 'Thinking...' : 'Ask'}
                </Button>
              </div>
            </div>

            {/* Messages List */}
            <div className="max-h-80 overflow-y-auto">
              {messages.length > 0 ? (
                <div className="divide-y divide-[var(--border-primary)]">
                  {messages.map((msg) => (
                    <CompanionMessageCard key={msg.id} message={msg} />
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center">
                  <MessageSquare className="w-10 h-10 mx-auto mb-2 text-[var(--text-tertiary)] opacity-30" />
                  <p className="text-sm text-[var(--text-tertiary)]">No messages yet</p>
                  <p className="text-xs text-[var(--text-tertiary)] opacity-70 mt-1">
                    Ask about your setups or get LTP guidance
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Session Report */}
      <CompanionSessionReport />
    </div>
  );
}

// ============================================================================
// MARKET CONTEXT HEADER
// ============================================================================
function MarketContextHeader({
  marketStatus,
  streamConnected,
  streamError,
  onRefresh,
  refreshing,
  readyCount,
  formingCount,
  symbolCount,
}: {
  marketStatus: MarketStatus | null;
  streamConnected: boolean;
  streamError: string | null;
  onRefresh: () => void;
  refreshing: boolean;
  readyCount: number;
  formingCount: number;
  symbolCount: number;
}) {
  return (
    <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Left: Market Indices */}
        <div className="flex items-center gap-6">
          {marketStatus ? (
            <>
              <MarketTicker symbol="SPY" price={marketStatus.spy.price} change={marketStatus.spy.change} />
              <MarketTicker symbol="QQQ" price={marketStatus.qqq.price} change={marketStatus.qqq.change} />
              <div className="h-8 w-px bg-[var(--border-primary)]" />
              <div className="flex items-center gap-2">
                <div className={cn(
                  'w-2 h-2 rounded-full',
                  marketStatus.isOpen ? 'bg-[var(--success)]' : 'bg-[var(--error)]'
                )} />
                <span className="text-sm text-[var(--text-secondary)]">
                  {marketStatus.isOpen ? `Closes in ${marketStatus.timeToClose}` : 'Market Closed'}
                </span>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2 text-[var(--text-tertiary)]">
              <Activity className="w-4 h-4 animate-pulse" />
              <span className="text-sm">Loading market data...</span>
            </div>
          )}
        </div>

        {/* Center: Setup Summary */}
        <div className="flex items-center gap-4">
          <SetupSummaryBadge count={readyCount} label="Ready" variant="gold" />
          <SetupSummaryBadge count={formingCount} label="Forming" variant="neutral" />
          <SetupSummaryBadge count={symbolCount} label="Watching" variant="info" />
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            disabled={refreshing}
            icon={<RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />}
          >
            Refresh
          </Button>
          <div
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 text-xs font-medium uppercase tracking-wide',
              streamConnected
                ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] border border-[var(--accent-primary)]/30'
                : 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] border border-[var(--border-primary)]'
            )}
            title={streamError || (streamConnected ? 'Real-time updates active' : 'Connecting...')}
          >
            {streamConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            {streamConnected ? 'LIVE' : 'OFFLINE'}
          </div>
        </div>
      </div>
    </div>
  );
}

function MarketTicker({ symbol, price, change }: { symbol: string; price: number; change: number }) {
  const isPositive = change >= 0;
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium text-[var(--text-secondary)]">{symbol}</span>
      <span className="text-sm font-mono text-[var(--text-primary)]">${price.toFixed(2)}</span>
      <span className={cn(
        'text-xs font-mono px-1.5 py-0.5',
        isPositive ? 'bg-[var(--success)]/10 text-[var(--success)]' : 'bg-[var(--error)]/10 text-[var(--error)]'
      )}>
        {isPositive ? '+' : ''}{change.toFixed(2)}%
      </span>
    </div>
  );
}

function SetupSummaryBadge({ count, label, variant }: { count: number; label: string; variant: 'gold' | 'neutral' | 'info' }) {
  const colors = {
    gold: count > 0 ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] border-[var(--accent-primary)]/30' : 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] border-[var(--border-primary)]',
    neutral: 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border-[var(--border-primary)]',
    info: 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border-[var(--border-primary)]',
  };

  return (
    <div className={cn('flex items-center gap-2 px-3 py-1.5 border text-sm', colors[variant])}>
      <span className="font-bold font-mono">{count}</span>
      <span className="text-xs uppercase tracking-wide opacity-70">{label}</span>
    </div>
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
    <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)]">
      {/* Header */}
      <div className="p-4 border-b border-[var(--border-primary)]">
        <div className="flex items-center gap-2 mb-3">
          <Eye className="w-4 h-4 text-[var(--accent-primary)]" />
          <h2 className="text-sm font-semibold text-[var(--text-primary)] uppercase tracking-wider">Watchlist</h2>
        </div>

        {/* Add Symbol Input */}
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Add symbol..."
            value={newSymbol}
            onChange={(e) => setNewSymbol(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && onAddSymbol()}
            className="flex-1 px-3 py-2 text-sm bg-[var(--bg-primary)] border border-[var(--border-primary)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:border-[var(--accent-primary)] focus:outline-none"
          />
          <button
            onClick={onAddSymbol}
            className="px-3 py-2 bg-[var(--accent-primary)] text-[var(--bg-primary)] hover:bg-[var(--accent-primary)]/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Symbols List */}
      <div className="max-h-[calc(100vh-320px)] overflow-y-auto">
        {/* Coach Watchlist */}
        {sharedSymbols.length > 0 && (
          <div className="p-2">
            <div className="flex items-center gap-1 px-2 py-1 text-xs font-semibold text-[var(--accent-primary)] uppercase tracking-wider">
              <AlertTriangle className="w-3 h-3" />
              Coach Picks
            </div>
            <div className="space-y-1">
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
          </div>
        )}

        {/* Personal Watchlist */}
        <div className="p-2">
          {sharedSymbols.length > 0 && personalSymbols.length > 0 && (
            <div className="px-2 py-1 text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
              Personal
            </div>
          )}
          <div className="space-y-1">
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
        </div>

        {/* Empty State */}
        {watchlist.length === 0 && !loading && (
          <div className="p-8 text-center">
            <Eye className="w-10 h-10 mx-auto mb-2 text-[var(--text-tertiary)] opacity-30" />
            <p className="text-sm text-[var(--text-tertiary)]">No symbols yet</p>
            <p className="text-xs text-[var(--text-tertiary)] opacity-70">Add symbols to start scanning</p>
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
        'group p-3 cursor-pointer transition-all',
        isSelected
          ? 'bg-[var(--accent-primary)]/10 border-l-2 border-l-[var(--accent-primary)]'
          : 'hover:bg-[var(--bg-tertiary)] border-l-2 border-l-transparent',
        isReady && !isSelected && 'border-l-[var(--accent-primary)]/50'
      )}
    >
      {/* Top Row: Symbol + Price */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="font-bold text-[var(--text-primary)]">{item.symbol}</span>
          {isShared && (
            <span className="px-1.5 py-0.5 text-[9px] font-bold bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] uppercase">
              Coach
            </span>
          )}
        </div>
        {!isShared && (
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-[var(--bg-elevated)] transition-opacity"
          >
            <X className="w-3 h-3 text-[var(--text-tertiary)]" />
          </button>
        )}
      </div>

      {/* Middle Row: Price + Change */}
      {item.quote && (
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-mono text-[var(--text-secondary)]">
            ${item.quote.last_price?.toFixed(2)}
          </span>
          <span className={cn(
            'text-xs font-mono px-1.5 py-0.5',
            isPositive ? 'bg-[var(--success)]/10 text-[var(--success)]' : 'bg-[var(--error)]/10 text-[var(--error)]'
          )}>
            {isPositive ? '+' : ''}{changePercent.toFixed(2)}%
          </span>
        </div>
      )}

      {/* Bottom Row: Score Bar */}
      {hasSetup && (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <ScoreBarMini scores={[setup.level_score, setup.trend_score, setup.patience_score, setup.mtf_score]} />
            <span className={cn(
              'text-xs font-bold font-mono ml-2',
              isReady ? 'text-[var(--accent-primary)]' : 'text-[var(--text-secondary)]'
            )}>
              {setup.confluence_score}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function ScoreBarMini({ scores }: { scores: number[] }) {
  const getColor = (score: number) => {
    if (score >= 70) return 'var(--success)';
    if (score >= 50) return 'var(--warning)';
    return 'var(--error)';
  };

  return (
    <div className="flex gap-0.5 flex-1">
      {scores.map((score, i) => (
        <div
          key={i}
          className="h-1.5 flex-1 bg-[var(--bg-tertiary)] overflow-hidden"
          title={['Level', 'Trend', 'Patience', 'MTF'][i]}
        >
          <div
            className="h-full transition-all"
            style={{ width: `${score}%`, backgroundColor: getColor(score) }}
          />
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// COMPANION MESSAGE CARD
// ============================================================================
function CompanionMessageCard({ message }: { message: CompanionMessage }) {
  const getMessageIcon = (type: string) => {
    switch (type) {
      case 'setup_alert': return <Target className="w-4 h-4" />;
      case 'coaching': return <Sparkles className="w-4 h-4" />;
      case 'market_context': return <BarChart3 className="w-4 h-4" />;
      case 'answer': return <MessageSquare className="w-4 h-4" />;
      default: return <MessageSquare className="w-4 h-4" />;
    }
  };

  const getMessageStyle = (type: string) => {
    switch (type) {
      case 'setup_alert': return 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]';
      case 'coaching': return 'bg-[var(--success)]/10 text-[var(--success)]';
      case 'market_context': return 'bg-[var(--warning)]/10 text-[var(--warning)]';
      default: return 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]';
    }
  };

  return (
    <div className="p-4 hover:bg-[var(--bg-tertiary)]/50 transition-colors">
      <div className="flex items-start gap-3">
        <div className={cn('p-2 rounded', getMessageStyle(message.message_type))}>
          {getMessageIcon(message.message_type)}
        </div>
        <div className="flex-1 min-w-0">
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
      </div>
    </div>
  );
}

// ============================================================================
// SETUP CARD
// ============================================================================
function SetupCard({ setup, variant, onPractice }: { setup: DetectedSetup; variant: 'ready' | 'forming'; onPractice?: () => void }) {
  const { showToast } = useToast();
  const isReady = variant === 'ready';
  const isBullish = setup.direction === 'bullish';

  return (
    <div className={cn(
      'bg-[var(--bg-secondary)] border overflow-hidden transition-all hover:border-[var(--accent-primary)]/50',
      isReady ? 'border-[var(--accent-primary)]/30' : 'border-[var(--border-primary)]'
    )}>
      {/* Header */}
      <div className={cn(
        'px-4 py-3 flex items-center justify-between',
        isReady ? 'bg-[var(--accent-primary)]/5' : ''
      )}>
        <div className="flex items-center gap-3">
          {/* Direction Icon */}
          <div className={cn(
            'w-10 h-10 flex items-center justify-center',
            isBullish ? 'bg-[var(--success)]/10' : 'bg-[var(--error)]/10'
          )}>
            {isBullish ? (
              <TrendingUp className={cn('w-5 h-5', 'text-[var(--success)]')} />
            ) : (
              <TrendingDown className={cn('w-5 h-5', 'text-[var(--error)]')} />
            )}
          </div>

          {/* Symbol + Direction */}
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-[var(--text-primary)]">{setup.symbol}</span>
              <span className={cn(
                'px-2 py-0.5 text-[10px] font-bold uppercase',
                isBullish ? 'bg-[var(--success)]/10 text-[var(--success)]' : 'bg-[var(--error)]/10 text-[var(--error)]'
              )}>
                {isBullish ? 'Long' : 'Short'}
              </span>
            </div>
            <div className="text-xs text-[var(--text-tertiary)]">
              {setup.primary_level_type?.toUpperCase()} @ ${setup.primary_level_price?.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Confluence Score */}
        <div className="text-right">
          <div className={cn(
            'text-3xl font-bold font-mono',
            setup.confluence_score >= 75 ? 'text-[var(--accent-primary)]' :
            setup.confluence_score >= 60 ? 'text-[var(--success)]' :
            'text-[var(--warning)]'
          )}>
            {setup.confluence_score}
          </div>
          <div className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">Confluence</div>
        </div>
      </div>

      {/* Score Bars */}
      <div className="px-4 py-3 border-t border-[var(--border-primary)]">
        <div className="grid grid-cols-4 gap-3">
          <ScoreBarVertical label="L" score={setup.level_score} />
          <ScoreBarVertical label="T" score={setup.trend_score} />
          <ScoreBarVertical label="P" score={setup.patience_score} />
          <ScoreBarVertical label="M" score={setup.mtf_score || 0} />
        </div>
      </div>

      {/* Coach Note */}
      {setup.coach_note && (
        <div className="px-4 py-3 bg-[var(--bg-tertiary)] border-t border-[var(--border-primary)]">
          <p className="text-xs text-[var(--text-secondary)]">
            <span className="text-[var(--accent-primary)] font-semibold">Coach: </span>
            {setup.coach_note}
          </p>
        </div>
      )}

      {/* Trade Params - Only for Ready */}
      {isReady && setup.suggested_entry > 0 && (
        <div className="px-4 py-3 border-t border-[var(--border-primary)] bg-[var(--bg-primary)]">
          <div className="grid grid-cols-5 gap-2 text-center">
            <TradeParam label="Entry" value={`$${setup.suggested_entry.toFixed(2)}`} />
            <TradeParam label="Stop" value={`$${setup.suggested_stop.toFixed(2)}`} color="error" />
            <TradeParam label="T1" value={`$${setup.target_1.toFixed(2)}`} color="success" />
            <TradeParam label="T2" value={`$${setup.target_2.toFixed(2)}`} color="success" />
            <TradeParam label="R:R" value={`${setup.risk_reward?.toFixed(1)}:1`} color="accent" />
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="px-4 py-3 border-t border-[var(--border-primary)] flex gap-2">
        <button
          onClick={() => {
            if ('Notification' in window && Notification.permission === 'default') {
              Notification.requestPermission();
            }
            showToast({
              type: 'success',
              title: `Alert Set: ${setup.symbol}`,
              message: isReady
                ? `You'll be notified when price breaks $${setup.suggested_entry?.toFixed(2)}`
                : `You'll be notified when setup becomes ready`,
            });
          }}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium transition-colors',
            isReady
              ? 'bg-[var(--accent-primary)] text-[var(--bg-primary)] hover:bg-[var(--accent-primary)]/90'
              : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]'
          )}
        >
          <Bell className="w-4 h-4" />
          {isReady ? 'Alert Entry' : 'Watch'}
        </button>
        {onPractice && (
          <button
            onClick={onPractice}
            className="px-3 py-2 bg-[var(--success)]/10 text-[var(--success)] hover:bg-[var(--success)]/20 transition-colors flex items-center gap-1"
            title="Practice this setup"
          >
            <Play className="w-4 h-4" />
            <span className="text-xs font-medium">Practice</span>
          </button>
        )}
        <button
          onClick={() => {
            const tvSymbol = setup.symbol.includes(':') ? setup.symbol : `NASDAQ:${setup.symbol}`;
            window.open(`https://www.tradingview.com/chart/?symbol=${tvSymbol}`, '_blank');
          }}
          className="px-3 py-2 bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] transition-colors"
          title="Open Chart"
        >
          <ExternalLink className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function ScoreBarVertical({ label, score }: { label: string; score: number }) {
  const getColor = () => {
    if (score >= 70) return 'var(--success)';
    if (score >= 50) return 'var(--warning)';
    return 'var(--error)';
  };

  return (
    <div className="text-center">
      <div className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase mb-1">{label}</div>
      <div className="h-2 bg-[var(--bg-tertiary)] overflow-hidden mb-1">
        <div
          className="h-full transition-all"
          style={{ width: `${score}%`, backgroundColor: getColor() }}
        />
      </div>
      <div className="text-xs font-mono text-[var(--text-secondary)]">{score}</div>
    </div>
  );
}

function TradeParam({ label, value, color }: { label: string; value: string; color?: 'success' | 'error' | 'accent' }) {
  const colorClass = color === 'success' ? 'text-[var(--success)]' :
                     color === 'error' ? 'text-[var(--error)]' :
                     color === 'accent' ? 'text-[var(--accent-primary)]' :
                     'text-[var(--text-primary)]';
  return (
    <div>
      <div className="text-[9px] text-[var(--text-tertiary)] uppercase">{label}</div>
      <div className={cn('text-xs font-mono font-medium', colorClass)}>{value}</div>
    </div>
  );
}

// ============================================================================
// KEY LEVELS PANEL
// ============================================================================
function KeyLevelsPanel({
  symbol,
  watchlistItem,
  setup,
  onClose,
}: {
  symbol: string;
  watchlistItem?: WatchlistSymbol;
  setup?: DetectedSetup;
  onClose: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const levels = watchlistItem?.levels || [];
  const quote = watchlistItem?.quote;
  const currentPrice = quote?.last_price || 0;

  // Organize levels
  const vwap = levels.find(l => l.level_type === 'vwap')?.price;
  const ema21 = levels.find(l => l.level_type === 'ema_21')?.price;
  const pmHigh = levels.find(l => ['pmh', 'premarket_high'].includes(l.level_type))?.price;
  const pmLow = levels.find(l => ['pml', 'premarket_low'].includes(l.level_type))?.price;

  const isAboveVWAP = vwap && currentPrice > vwap;
  const isAboveEMA21 = ema21 && currentPrice > ema21;
  const pmStatus = pmHigh && pmLow ? (
    currentPrice > pmHigh ? 'above' : currentPrice < pmLow ? 'below' : 'inside'
  ) : null;

  // Detect confluence zones
  const confluenceZones = detectConfluenceZones(levels, currentPrice);

  // Group levels by category
  const dailyLevels = levels.filter(l => ['pdh', 'pdl', 'pdc', 'open_price'].includes(l.level_type));
  const intradayLevels = levels.filter(l => ['orb_high', 'orb_low', 'vwap', 'hod', 'lod'].includes(l.level_type));
  const maLevels = levels.filter(l => ['ema_9', 'ema_21', 'sma_50', 'sma_200'].includes(l.level_type));

  return (
    <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)]">
      {/* Header */}
      <div
        className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-[var(--bg-tertiary)]"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <Layers className="w-5 h-5 text-[var(--accent-primary)]" />
          <div>
            <span className="font-semibold text-[var(--text-primary)]">{symbol}</span>
            <span className="text-[var(--text-tertiary)] ml-2">Key Levels</span>
          </div>
          {quote && (
            <span className="font-mono text-sm text-[var(--text-secondary)]">
              ${currentPrice.toFixed(2)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="p-1 hover:bg-[var(--bg-elevated)]"
          >
            <X className="w-4 h-4 text-[var(--text-tertiary)]" />
          </button>
          {expanded ? <ChevronUp className="w-4 h-4 text-[var(--text-tertiary)]" /> : <ChevronDown className="w-4 h-4 text-[var(--text-tertiary)]" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-[var(--border-primary)]">
          {/* Trend Status Row */}
          <div className="grid grid-cols-4 gap-px bg-[var(--border-primary)]">
            <TrendStatusBadge label="VWAP" status={isAboveVWAP ? 'above' : 'below'} />
            <TrendStatusBadge label="21 EMA" status={isAboveEMA21 ? 'above' : 'below'} />
            <TrendStatusBadge label="Premarket" status={pmStatus || 'neutral'} />
            <TrendStatusBadge
              label="Bias"
              status={isAboveVWAP && isAboveEMA21 ? 'bullish' : !isAboveVWAP && !isAboveEMA21 ? 'bearish' : 'neutral'}
            />
          </div>

          {/* Confluence Zones */}
          {confluenceZones.length > 0 && (
            <div className="p-4 border-t border-[var(--border-primary)] bg-[var(--accent-primary)]/5">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-4 h-4 text-[var(--accent-primary)]" />
                <span className="text-xs font-semibold text-[var(--accent-primary)] uppercase tracking-wider">
                  Confluence Zones
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {confluenceZones.map((zone, idx) => (
                  <div key={idx} className="px-3 py-1.5 bg-[var(--bg-primary)] border border-[var(--accent-primary)]/30">
                    <div className="font-mono font-semibold text-[var(--accent-primary)]">${zone.price.toFixed(2)}</div>
                    <div className="text-[10px] text-[var(--text-tertiary)]">{zone.levels.join(' + ')}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Levels Grid */}
          <div className="grid grid-cols-3 gap-px bg-[var(--border-primary)]">
            <LevelGroup title="Daily" levels={dailyLevels} currentPrice={currentPrice} />
            <LevelGroup title="Intraday" levels={intradayLevels} currentPrice={currentPrice} />
            <LevelGroup title="Moving Avg" levels={maLevels} currentPrice={currentPrice} />
          </div>
        </div>
      )}
    </div>
  );
}

function TrendStatusBadge({ label, status }: { label: string; status: string }) {
  const getStyle = () => {
    switch (status) {
      case 'above':
      case 'bullish':
        return 'bg-[var(--success)]/10 text-[var(--success)]';
      case 'below':
      case 'bearish':
        return 'bg-[var(--error)]/10 text-[var(--error)]';
      default:
        return 'bg-[var(--warning)]/10 text-[var(--warning)]';
    }
  };

  const getText = () => {
    switch (status) {
      case 'above': return 'ABOVE';
      case 'below': return 'BELOW';
      case 'bullish': return 'BULLISH';
      case 'bearish': return 'BEARISH';
      case 'inside': return 'INSIDE';
      default: return 'NEUTRAL';
    }
  };

  return (
    <div className={cn('p-3 text-center bg-[var(--bg-secondary)]', getStyle())}>
      <div className="text-[10px] uppercase tracking-wider opacity-70">{label}</div>
      <div className="text-sm font-semibold">{getText()}</div>
    </div>
  );
}

function LevelGroup({ title, levels, currentPrice }: { title: string; levels: KeyLevel[]; currentPrice: number }) {
  return (
    <div className="bg-[var(--bg-secondary)] p-3">
      <div className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-2">{title}</div>
      <div className="space-y-1">
        {levels.map((level) => {
          const distance = currentPrice > 0 ? ((level.price - currentPrice) / currentPrice * 100) : 0;
          const isNear = Math.abs(distance) < 0.5;
          return (
            <div key={level.id} className={cn(
              'flex items-center justify-between py-1 px-2 text-xs',
              isNear && 'bg-[var(--accent-primary)]/10'
            )}>
              <span className="text-[var(--text-secondary)]">{getLevelLabel(level.level_type)}</span>
              <div className="text-right">
                <span className={cn('font-mono', isNear ? 'text-[var(--accent-primary)]' : 'text-[var(--text-primary)]')}>
                  ${level.price.toFixed(2)}
                </span>
                <span className={cn(
                  'ml-2 font-mono text-[10px]',
                  distance > 0 ? 'text-[var(--success)]' : 'text-[var(--error)]'
                )}>
                  {distance > 0 ? '+' : ''}{distance.toFixed(1)}%
                </span>
              </div>
            </div>
          );
        })}
        {levels.length === 0 && (
          <div className="text-[10px] text-[var(--text-tertiary)] italic">No data</div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// UTILITIES
// ============================================================================
function detectConfluenceZones(levels: KeyLevel[], currentPrice: number) {
  if (levels.length < 2 || currentPrice === 0) return [];

  const zones: { price: number; levels: string[] }[] = [];
  const threshold = currentPrice * 0.003;
  const sorted = [...levels].sort((a, b) => a.price - b.price);

  for (let i = 0; i < sorted.length; i++) {
    const cluster: KeyLevel[] = [sorted[i]];
    for (let j = i + 1; j < sorted.length; j++) {
      if (Math.abs(sorted[j].price - sorted[i].price) <= threshold) {
        cluster.push(sorted[j]);
      }
    }
    if (cluster.length >= 2) {
      const avgPrice = cluster.reduce((sum, l) => sum + l.price, 0) / cluster.length;
      const levelNames = cluster.map(l => getLevelLabel(l.level_type));
      const existing = zones.find(z => Math.abs(z.price - avgPrice) < threshold);
      if (!existing) {
        zones.push({ price: avgPrice, levels: levelNames });
      }
    }
  }
  return zones;
}

function getLevelLabel(levelType: string): string {
  const labelMap: Record<string, string> = {
    pdh: 'PDH', pdl: 'PDL', pdc: 'PDC', open_price: 'Open',
    orb_high: 'ORB-H', orb_low: 'ORB-L', vwap: 'VWAP', hod: 'HOD', lod: 'LOD',
    premarket_high: 'PM-H', premarket_low: 'PM-L', pmh: 'PM-H', pml: 'PM-L',
    ema_9: '9EMA', ema_21: '21EMA', sma_50: '50SMA', sma_200: '200SMA',
  };
  return labelMap[levelType] || levelType.toUpperCase();
}
