'use client';

import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useCompanionStream, type CompanionEvent } from '@/hooks/useCompanionStream';
import { Button } from '@/components/ui/button';
import {
  Plus,
  X,
  TrendingUp,
  TrendingDown,
  Target,
  Activity,
  Eye,
  Bell,
  ChevronRight,
  Zap,
  Clock,
  BarChart3,
  Layers,
  AlertTriangle,
  RefreshCw,
  Wifi,
  WifiOff
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

export default function CompanionPage() {
  const [watchlist, setWatchlist] = useState<WatchlistSymbol[]>([]);
  const [setups, setSetups] = useState<DetectedSetup[]>([]);
  const [newSymbol, setNewSymbol] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshStatus, setRefreshStatus] = useState<string | null>(null);

  // Handle real-time SSE events
  const handleStreamEvent = useCallback((event: CompanionEvent) => {
    if (event.type === 'setup_forming' || event.type === 'setup_ready') {
      // Update setups with real-time data
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
      // Update watchlist prices in real-time
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

  // Connect to SSE stream for real-time updates
  const { connected: streamConnected, error: streamError } = useCompanionStream({
    onEvent: handleStreamEvent,
  });

  useEffect(() => {
    fetchWatchlist();
    fetchSetups();

    // Fallback: Poll for updates every 60 seconds if SSE is connected, 30 seconds if not
    const interval = setInterval(() => {
      fetchSetups();
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
      await fetch(`/api/companion/watchlist?symbol=${symbol}`, {
        method: 'DELETE'
      });
      fetchWatchlist();
    } catch (error) {
      console.error('Error removing symbol:', error);
    }
  };

  const refreshLevels = async () => {
    setRefreshing(true);
    setRefreshStatus('Refreshing market data...');
    try {
      const res = await fetch('/api/companion/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshAll: true })
      });
      const data = await res.json();

      if (res.ok) {
        setRefreshStatus(`Refreshed ${data.refreshed}/${data.total} symbols (${data.totalLevels} levels)`);
        // Refresh watchlist to get updated levels
        fetchWatchlist();
        fetchSetups();
      } else {
        setRefreshStatus(data.detail || data.error || 'Refresh failed');
      }
    } catch (error) {
      console.error('Error refreshing levels:', error);
      setRefreshStatus('Error refreshing levels');
    } finally {
      setRefreshing(false);
      // Clear status after 5 seconds
      setTimeout(() => setRefreshStatus(null), 5000);
    }
  };

  const readySetups = setups.filter(s => s.setup_stage === 'ready');
  const formingSetups = setups.filter(s => s.setup_stage === 'forming');
  const sharedSymbols = watchlist.filter(s => s.is_shared);
  const personalSymbols = watchlist.filter(s => !s.is_shared);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] uppercase tracking-wide">
            Companion Mode
          </h1>
          <p className="text-[var(--text-secondary)]">
            Real-time LTP setup detection powered by Kay Capitals methodology
          </p>
          {refreshStatus && (
            <p className="text-sm text-[var(--accent-primary)] mt-1">{refreshStatus}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={refreshLevels}
            disabled={refreshing || watchlist.length === 0}
            className="btn btn-secondary flex items-center gap-2"
            title="Refresh key levels for all watchlist symbols"
          >
            <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
            {refreshing ? 'Refreshing...' : 'Refresh Levels'}
          </button>
          <div className={cn(
            'badge flex items-center gap-2',
            streamConnected ? 'badge-gold' : 'badge-neutral'
          )} title={streamError || (streamConnected ? 'Real-time updates active' : 'Connecting...')}>
            {streamConnected ? (
              <>
                <Wifi className="w-3 h-3" />
                <span className="pulse-dot">LIVE</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3" />
                <span>OFFLINE</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Ready Setups Alert Banner */}
      {readySetups.length > 0 && (
        <div className="card card-hover border-l-4 border-[var(--accent-primary)] p-4" style={{ animation: 'pulse-dot 2s ease-in-out infinite' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[var(--accent-primary)] flex items-center justify-center">
                <Target className="w-5 h-5 text-[var(--bg-primary)]" />
              </div>
              <div>
                <p className="font-semibold text-[var(--text-primary)] uppercase tracking-wide">
                  {readySetups.length} Setup{readySetups.length > 1 ? 's' : ''} Ready!
                </p>
                <p className="text-sm text-[var(--text-secondary)]">
                  {readySetups.map(s => s.symbol).join(', ')} - All LTP criteria met
                </p>
              </div>
            </div>
            <Button
              variant="primary"
              onClick={() => {
                // Scroll to the first ready setup in the watchlist
                const firstReadySetup = document.querySelector('[aria-label*="confluence score"]');
                firstReadySetup?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                // Or select the first ready setup
                if (readySetups.length > 0) {
                  setSelectedSymbol(readySetups[0].symbol);
                }
              }}
              icon={<ChevronRight className="w-4 h-4" />}
              iconPosition="right"
            >
              View Setups
            </Button>
          </div>
        </div>
      )}

      {/* Main Grid - now with md: breakpoint for tablets */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Watchlist Panel */}
        <div className="card p-6 lg:col-span-1">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2 mb-4 uppercase tracking-wide">
            <Eye className="w-5 h-5 text-[var(--accent-primary)]" />
            Watchlist
          </h2>

          {/* Add Symbol Input */}
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              placeholder="Add symbol (e.g., NVDA)"
              value={newSymbol}
              onChange={(e) => setNewSymbol(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && addSymbol()}
              className="input flex-1"
            />
            <button className="btn btn-primary px-3" onClick={addSymbol}>
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Shared Watchlist (Admin) */}
          {sharedSymbols.length > 0 && (
            <div className="mb-4">
              <h3 className="text-xs font-semibold text-[var(--accent-primary)] mb-2 uppercase tracking-wider flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Coach Watchlist
              </h3>
              <div className="space-y-2">
                {sharedSymbols.map((item) => (
                  <WatchlistItem
                    key={item.id}
                    item={item}
                    isSelected={selectedSymbol === item.symbol}
                    onSelect={() => setSelectedSymbol(item.symbol)}
                    onRemove={() => {}} // Can't remove shared
                    setup={setups.find(s => s.symbol === item.symbol)}
                    isShared
                  />
                ))}
              </div>
            </div>
          )}

          {/* Personal Symbols */}
          <div className="space-y-2">
            {personalSymbols.length > 0 && sharedSymbols.length > 0 && (
              <h3 className="text-xs font-semibold text-[var(--text-tertiary)] mb-2 uppercase tracking-wider">
                Personal
              </h3>
            )}
            {personalSymbols.map((item) => (
              <WatchlistItem
                key={item.id}
                item={item}
                isSelected={selectedSymbol === item.symbol}
                onSelect={() => setSelectedSymbol(item.symbol)}
                onRemove={() => removeSymbol(item.symbol)}
                setup={setups.find(s => s.symbol === item.symbol)}
              />
            ))}

            {watchlist.length === 0 && !loading && (
              <div className="text-center py-8 text-[var(--text-tertiary)]">
                <Eye className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No symbols in watchlist</p>
                <p className="text-sm">Add symbols to start detecting setups</p>
              </div>
            )}
          </div>
        </div>

        {/* Setups Panel */}
        <div className="card p-6 lg:col-span-2">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2 mb-4 uppercase tracking-wide">
            <Zap className="w-5 h-5 text-[var(--accent-primary)]" />
            LTP Setups
          </h2>

          {/* Ready Setups */}
          {readySetups.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-[var(--accent-primary)] mb-3 flex items-center gap-2 uppercase tracking-wider">
                <Target className="w-4 h-4" />
                READY - Entry Window Open
              </h3>
              <div className="space-y-3">
                {readySetups.map((setup) => (
                  <SetupCard key={setup.id} setup={setup} variant="ready" />
                ))}
              </div>
            </div>
          )}

          {/* Forming Setups */}
          {formingSetups.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-[var(--text-tertiary)] mb-3 flex items-center gap-2 uppercase tracking-wider">
                <Clock className="w-4 h-4" />
                FORMING - Watching
              </h3>
              <div className="space-y-3">
                {formingSetups.map((setup) => (
                  <SetupCard key={setup.id} setup={setup} variant="forming" />
                ))}
              </div>
            </div>
          )}

          {setups.length === 0 && (
            <div className="text-center py-12 text-[var(--text-tertiary)]">
              <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No active setups detected</p>
              <p className="text-sm">Add symbols to your watchlist to start detecting LTP setups</p>
            </div>
          )}
        </div>
      </div>

      {/* Key Levels Panel (when symbol selected) */}
      {selectedSymbol && (
        <KeyLevelsPanel
          symbol={selectedSymbol}
          levels={watchlist.find(w => w.symbol === selectedSymbol)?.levels || []}
          quote={watchlist.find(w => w.symbol === selectedSymbol)?.quote}
          onClose={() => setSelectedSymbol(null)}
        />
      )}
    </div>
  );
}

// Watchlist Item Component
function WatchlistItem({
  item,
  isSelected,
  onSelect,
  onRemove,
  setup,
  isShared = false
}: {
  item: WatchlistSymbol;
  isSelected: boolean;
  onSelect: () => void;
  onRemove: () => void;
  setup?: DetectedSetup;
  isShared?: boolean;
}) {
  const hasSetup = !!setup;
  const isReady = setup?.setup_stage === 'ready';

  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        'p-3 border cursor-pointer transition-all',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-primary)]',
        isSelected
          ? 'border-[var(--accent-primary)] bg-[var(--accent-primary-glow)]'
          : 'border-[var(--border-primary)] hover:border-[var(--border-secondary)]',
        isReady && 'ring-1 ring-[var(--accent-primary)]',
        isShared && 'border-l-2 border-l-[var(--accent-primary)]'
      )}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      aria-selected={isSelected}
      aria-label={`${item.symbol}${hasSetup ? `, confluence score ${setup.confluence_score}%` : ''}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="font-bold text-[var(--text-primary)]">{item.symbol}</div>
          {item.quote && (
            <span className={`text-sm ${item.quote.change_percent >= 0 ? 'text-[var(--success)]' : 'text-[var(--error)]'}`}>
              {item.quote.change_percent >= 0 ? '+' : ''}{item.quote.change_percent?.toFixed(2)}%
            </span>
          )}
          {isShared && (
            <span className="badge badge-gold text-[10px]">COACH</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasSetup && (
            <span className={cn(
              'badge',
              isReady ? 'badge-gold' : 'badge-neutral'
            )}>
              {setup.confluence_score}%
            </span>
          )}
          {!isShared && (
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              className="p-1 hover:bg-[var(--bg-elevated)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
              aria-label={`Remove ${item.symbol} from watchlist`}
            >
              <X className="w-4 h-4 text-[var(--text-tertiary)]" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {item.quote && (
        <div className="mt-2 text-sm text-[var(--text-secondary)] font-mono">
          ${item.quote.last_price?.toFixed(2)}
        </div>
      )}

      {hasSetup && (
        <div className="mt-2 flex gap-3 text-xs font-mono">
          <span className={cn(
            setup.level_score >= 70 ? 'text-[var(--success)]' : setup.level_score >= 50 ? 'text-[var(--warning)]' : 'text-[var(--error)]'
          )}>
            L:{setup.level_score}
          </span>
          <span className={cn(
            setup.trend_score >= 70 ? 'text-[var(--success)]' : setup.trend_score >= 50 ? 'text-[var(--warning)]' : 'text-[var(--error)]'
          )}>
            T:{setup.trend_score}
          </span>
          <span className={cn(
            setup.patience_score >= 70 ? 'text-[var(--success)]' : setup.patience_score >= 50 ? 'text-[var(--warning)]' : 'text-[var(--error)]'
          )}>
            P:{setup.patience_score}
          </span>
        </div>
      )}
    </div>
  );
}

// Setup Card Component
function SetupCard({ setup, variant }: { setup: DetectedSetup; variant: 'ready' | 'forming' }) {
  const isReady = variant === 'ready';

  return (
    <div
      className={cn(
        'card p-4',
        isReady
          ? 'border-[var(--accent-primary)] bg-[var(--accent-primary-glow)]'
          : 'border-[var(--border-primary)]'
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={cn(
            'w-10 h-10 flex items-center justify-center',
            isReady ? 'bg-[var(--accent-primary)] text-[var(--bg-primary)]' : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)]'
          )}>
            {setup.direction === 'bullish' ? (
              <TrendingUp className="w-5 h-5" />
            ) : (
              <TrendingDown className="w-5 h-5" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg text-[var(--text-primary)]">{setup.symbol}</span>
              <span className={cn(
                'badge',
                setup.direction === 'bullish' ? 'badge-success' : 'badge-error'
              )}>
                {setup.direction.toUpperCase()}
              </span>
            </div>
            <div className="text-sm text-[var(--text-secondary)]">
              {setup.primary_level_type?.toUpperCase()} @ ${setup.primary_level_price?.toFixed(2)}
            </div>
          </div>
        </div>

        <div className="text-right">
          <div className={cn('text-2xl font-bold font-mono', isReady ? 'text-[var(--accent-primary)]' : 'text-[var(--text-primary)]')}>
            {setup.confluence_score}
          </div>
          <div className="text-xs text-[var(--text-tertiary)] uppercase tracking-wide">Confluence</div>
        </div>
      </div>

      {/* LTP Scores */}
      <div className="grid grid-cols-4 gap-2 mb-3">
        <ScoreBar label="Level" score={setup.level_score} />
        <ScoreBar label="Trend" score={setup.trend_score} />
        <ScoreBar label="Patience" score={setup.patience_score} />
        <ScoreBar label="MTF" score={setup.mtf_score || 0} />
      </div>

      {/* Coach Note */}
      {setup.coach_note && (
        <div className="p-3 bg-[var(--bg-secondary)] border border-[var(--border-primary)] text-sm text-[var(--text-secondary)] mb-3">
          <span className="text-[var(--accent-primary)]">KCU Coach:</span> {setup.coach_note}
        </div>
      )}

      {/* Trade Params (for ready setups) */}
      {isReady && setup.suggested_entry && (
        <div className="grid grid-cols-5 gap-2 text-sm mb-3">
          <div>
            <div className="text-[var(--text-tertiary)] text-xs uppercase">Entry</div>
            <div className="font-medium font-mono text-[var(--text-primary)]">${setup.suggested_entry?.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-[var(--text-tertiary)] text-xs uppercase">Stop</div>
            <div className="font-medium font-mono text-[var(--error)]">${setup.suggested_stop?.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-[var(--text-tertiary)] text-xs uppercase">T1</div>
            <div className="font-medium font-mono text-[var(--success)]">${setup.target_1?.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-[var(--text-tertiary)] text-xs uppercase">T2</div>
            <div className="font-medium font-mono text-[var(--success)]">${setup.target_2?.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-[var(--text-tertiary)] text-xs uppercase">R:R</div>
            <div className="font-medium font-mono text-[var(--accent-primary)]">{setup.risk_reward?.toFixed(1)}:1</div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 mt-4">
        <button className={cn('btn flex-1', isReady ? 'btn-primary' : 'btn-secondary')}>
          <Bell className="w-4 h-4 mr-1" />
          {isReady ? 'Alert on Break' : 'Watch Setup'}
        </button>
        <button className="btn btn-ghost">
          <BarChart3 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// Score Bar Component
function ScoreBar({ label, score }: { label: string; score: number }) {
  const getColor = () => {
    if (score >= 70) return 'var(--success)';
    if (score >= 50) return 'var(--warning)';
    return 'var(--error)';
  };

  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-[var(--text-tertiary)] uppercase tracking-wide">{label}</span>
        <span className="text-[var(--text-secondary)] font-mono">{score}</span>
      </div>
      <div className="progress-bar">
        <div
          className="progress-fill"
          style={{
            width: `${score}%`,
            background: getColor()
          }}
        />
      </div>
    </div>
  );
}

// Key Levels Panel
function KeyLevelsPanel({
  symbol,
  levels,
  quote,
  onClose
}: {
  symbol: string;
  levels: KeyLevel[];
  quote: MarketQuote | null | undefined;
  onClose: () => void;
}) {
  const currentPrice = quote?.last_price || 0;

  // Organize levels by category (per KCU methodology)
  const premarketLevels = levels.filter(l =>
    ['pmh', 'pml', 'premarket_high', 'premarket_low'].includes(l.level_type)
  );
  const dailyLevels = levels.filter(l =>
    ['pdh', 'pdl', 'pdc', 'open_price'].includes(l.level_type)
  );
  const intradayLevels = levels.filter(l =>
    ['orb_high', 'orb_low', 'vwap', 'hod', 'lod'].includes(l.level_type)
  );
  const structuralLevels = levels.filter(l =>
    l.level_type.startsWith('structural_') || ['hourly_pivot'].includes(l.level_type)
  );
  const maLevels = levels.filter(l =>
    ['ema_9', 'ema_21', 'sma_50', 'sma_200'].includes(l.level_type)
  );
  const weeklyLevels = levels.filter(l =>
    ['pwh', 'pwl', 'weekly_high', 'weekly_low', 'monthly_high', 'monthly_low'].includes(l.level_type)
  );

  // Detect confluence zones (levels within 0.3% of each other)
  const confluenceZones = detectConfluenceZones(levels, currentPrice);

  // Calculate trend status
  const vwap = levels.find(l => l.level_type === 'vwap')?.price;
  const ema21 = levels.find(l => l.level_type === 'ema_21')?.price;
  const pmHigh = premarketLevels.find(l => ['pmh', 'premarket_high'].includes(l.level_type))?.price;
  const pmLow = premarketLevels.find(l => ['pml', 'premarket_low'].includes(l.level_type))?.price;

  const isAboveVWAP = vwap && currentPrice > vwap;
  const isAboveEMA21 = ema21 && currentPrice > ema21;
  const pmBreak = pmHigh && pmLow ? (
    currentPrice > pmHigh ? 'above' : currentPrice < pmLow ? 'below' : 'inside'
  ) : null;

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2 uppercase tracking-wide">
          <Layers className="w-5 h-5 text-[var(--accent-primary)]" />
          {symbol} Key Levels
        </h2>
        <button onClick={onClose} className="p-1 hover:bg-[var(--bg-elevated)]">
          <X className="w-5 h-5 text-[var(--text-secondary)]" />
        </button>
      </div>

      {/* Trend Status Banner (per KCU methodology) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className={cn(
          'p-3 border text-center',
          isAboveVWAP ? 'border-[var(--success)] bg-[var(--success)]/10' : 'border-[var(--error)] bg-[var(--error)]/10'
        )}>
          <div className="text-xs text-[var(--text-tertiary)] uppercase">VWAP</div>
          <div className={cn('font-semibold', isAboveVWAP ? 'text-[var(--success)]' : 'text-[var(--error)]')}>
            {isAboveVWAP ? 'ABOVE' : 'BELOW'}
          </div>
        </div>
        <div className={cn(
          'p-3 border text-center',
          isAboveEMA21 ? 'border-[var(--success)] bg-[var(--success)]/10' : 'border-[var(--error)] bg-[var(--error)]/10'
        )}>
          <div className="text-xs text-[var(--text-tertiary)] uppercase">21 EMA</div>
          <div className={cn('font-semibold', isAboveEMA21 ? 'text-[var(--success)]' : 'text-[var(--error)]')}>
            {isAboveEMA21 ? 'ABOVE' : 'BELOW'}
          </div>
        </div>
        <div className={cn(
          'p-3 border text-center',
          pmBreak === 'above' ? 'border-[var(--success)] bg-[var(--success)]/10' :
          pmBreak === 'below' ? 'border-[var(--error)] bg-[var(--error)]/10' :
          'border-[var(--warning)] bg-[var(--warning)]/10'
        )}>
          <div className="text-xs text-[var(--text-tertiary)] uppercase">Premarket</div>
          <div className={cn('font-semibold',
            pmBreak === 'above' ? 'text-[var(--success)]' :
            pmBreak === 'below' ? 'text-[var(--error)]' :
            'text-[var(--warning)]'
          )}>
            {pmBreak === 'above' ? 'PM HIGH BROKE' : pmBreak === 'below' ? 'PM LOW BROKE' : 'INSIDE RANGE'}
          </div>
        </div>
        <div className={cn(
          'p-3 border text-center',
          isAboveVWAP && isAboveEMA21 ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10' :
          !isAboveVWAP && !isAboveEMA21 ? 'border-[var(--error)] bg-[var(--error)]/10' :
          'border-[var(--warning)] bg-[var(--warning)]/10'
        )}>
          <div className="text-xs text-[var(--text-tertiary)] uppercase">Bias</div>
          <div className={cn('font-semibold',
            isAboveVWAP && isAboveEMA21 ? 'text-[var(--accent-primary)]' :
            !isAboveVWAP && !isAboveEMA21 ? 'text-[var(--error)]' :
            'text-[var(--warning)]'
          )}>
            {isAboveVWAP && isAboveEMA21 ? 'BULLISH' : !isAboveVWAP && !isAboveEMA21 ? 'BEARISH' : 'NEUTRAL'}
          </div>
        </div>
      </div>

      {/* Confluence Zones (King & Queen) */}
      {confluenceZones.length > 0 && (
        <div className="mb-6 p-4 bg-[var(--accent-primary-glow)] border border-[var(--accent-primary)]">
          <h4 className="text-sm font-semibold text-[var(--accent-primary)] mb-2 uppercase tracking-wider flex items-center gap-2">
            <Target className="w-4 h-4" />
            Confluence Zones (King & Queen)
          </h4>
          <div className="flex flex-wrap gap-3">
            {confluenceZones.map((zone, idx) => (
              <div key={idx} className="bg-[var(--bg-primary)] p-2 border border-[var(--accent-primary)]">
                <div className="font-mono font-semibold text-[var(--accent-primary)]">${zone.price.toFixed(2)}</div>
                <div className="text-xs text-[var(--text-secondary)]">{zone.levels.join(' + ')}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Premarket Levels */}
        {premarketLevels.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-[var(--accent-primary)] mb-3 uppercase tracking-wider">Premarket</h4>
            <div className="space-y-2">
              {premarketLevels.map((level) => (
                <LevelRow key={level.id} level={level} currentPrice={currentPrice} />
              ))}
            </div>
          </div>
        )}

        {/* Daily Levels (PDH, PDL, PDC) */}
        <div>
          <h4 className="text-sm font-semibold text-[var(--text-tertiary)] mb-3 uppercase tracking-wider">Daily</h4>
          <div className="space-y-2">
            {dailyLevels.map((level) => (
              <LevelRow key={level.id} level={level} currentPrice={currentPrice} />
            ))}
          </div>
        </div>

        {/* Intraday Levels */}
        <div>
          <h4 className="text-sm font-semibold text-[var(--text-tertiary)] mb-3 uppercase tracking-wider">Intraday</h4>
          <div className="space-y-2">
            {intradayLevels.map((level) => (
              <LevelRow key={level.id} level={level} currentPrice={currentPrice} />
            ))}
            {intradayLevels.length === 0 && (
              <p className="text-sm text-[var(--text-muted)]">Loading...</p>
            )}
          </div>
        </div>

        {/* Structural Levels (4H chart) */}
        {structuralLevels.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-[var(--warning)] mb-3 uppercase tracking-wider">Structural (4H)</h4>
            <div className="space-y-2">
              {structuralLevels.map((level) => (
                <LevelRow key={level.id} level={level} currentPrice={currentPrice} />
              ))}
            </div>
          </div>
        )}

        {/* Moving Averages */}
        <div>
          <h4 className="text-sm font-semibold text-[var(--text-tertiary)] mb-3 uppercase tracking-wider">Moving Averages</h4>
          <div className="space-y-2">
            {maLevels.map((level) => (
              <LevelRow key={level.id} level={level} currentPrice={currentPrice} />
            ))}
          </div>
        </div>

        {/* Weekly/Monthly Levels */}
        {weeklyLevels.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-[var(--text-tertiary)] mb-3 uppercase tracking-wider">Weekly/Monthly</h4>
            <div className="space-y-2">
              {weeklyLevels.map((level) => (
                <LevelRow key={level.id} level={level} currentPrice={currentPrice} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ORB Info */}
      {quote?.orb_high && quote?.orb_low && (
        <div className="mt-6 p-4 bg-[var(--bg-secondary)] border border-[var(--border-primary)]">
          <h4 className="text-sm font-semibold text-[var(--text-tertiary)] mb-2 uppercase tracking-wider">
            Opening Range (First 15 min)
          </h4>
          <div className="flex items-center gap-6">
            <div>
              <span className="text-xs text-[var(--text-muted)] uppercase">ORB High</span>
              <div className="font-medium font-mono text-[var(--success)]">${quote.orb_high.toFixed(2)}</div>
            </div>
            <div>
              <span className="text-xs text-[var(--text-muted)] uppercase">ORB Low</span>
              <div className="font-medium font-mono text-[var(--error)]">${quote.orb_low.toFixed(2)}</div>
            </div>
            <div>
              <span className="text-xs text-[var(--text-muted)] uppercase">Range</span>
              <div className="font-medium font-mono text-[var(--text-primary)]">
                ${(quote.orb_high - quote.orb_low).toFixed(2)}
                <span className="text-xs text-[var(--text-tertiary)] ml-1">
                  ({((quote.orb_high - quote.orb_low) / quote.orb_low * 100).toFixed(2)}%)
                </span>
              </div>
            </div>
            <div>
              <span className="text-xs text-[var(--text-muted)] uppercase">Status</span>
              <div className="font-medium">
                {currentPrice > quote.orb_high ? (
                  <span className="text-[var(--success)]">Above ORB</span>
                ) : currentPrice < quote.orb_low ? (
                  <span className="text-[var(--error)]">Below ORB</span>
                ) : (
                  <span className="text-[var(--warning)]">Inside ORB</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Confluence Zone Detection (King & Queen strategy)
interface ConfluenceZone {
  price: number;
  levels: string[];
}

function detectConfluenceZones(levels: KeyLevel[], currentPrice: number): ConfluenceZone[] {
  if (levels.length < 2 || currentPrice === 0) return [];

  const zones: ConfluenceZone[] = [];
  const threshold = currentPrice * 0.003; // 0.3% threshold

  // Group levels that are within 0.3% of each other
  const sorted = [...levels].sort((a, b) => a.price - b.price);

  for (let i = 0; i < sorted.length; i++) {
    const cluster: KeyLevel[] = [sorted[i]];

    for (let j = i + 1; j < sorted.length; j++) {
      if (Math.abs(sorted[j].price - sorted[i].price) <= threshold) {
        cluster.push(sorted[j]);
      }
    }

    // Only add if we have 2+ levels in confluence
    if (cluster.length >= 2) {
      const avgPrice = cluster.reduce((sum, l) => sum + l.price, 0) / cluster.length;
      const levelNames = cluster.map(l => getLevelLabel(l.level_type));

      // Check if we already have a zone at this price
      const existing = zones.find(z => Math.abs(z.price - avgPrice) < threshold);
      if (!existing) {
        zones.push({ price: avgPrice, levels: levelNames });
      }
    }
  }

  return zones;
}

// Level label mapping
function getLevelLabel(levelType: string): string {
  const labelMap: Record<string, string> = {
    pdh: 'PDH',
    pdl: 'PDL',
    pdc: 'PDC',
    orb_high: 'ORB High',
    orb_low: 'ORB Low',
    vwap: 'VWAP',
    open_price: 'Open',
    hod: 'HOD',
    lod: 'LOD',
    premarket_high: 'PM High',
    premarket_low: 'PM Low',
    pmh: 'PM High',
    pml: 'PM Low',
    pwh: 'Weekly High',
    pwl: 'Weekly Low',
    ema_9: '9 EMA',
    ema_21: '21 EMA',
    sma_50: '50 SMA',
    sma_200: '200 SMA',
    weekly_high: 'Weekly High',
    weekly_low: 'Weekly Low',
    monthly_high: 'Monthly High',
    monthly_low: 'Monthly Low',
    hourly_pivot: 'Hourly Pivot',
    structural_support: 'Support (4H)',
    structural_resistance: 'Resistance (4H)',
  };

  // Handle dynamic structural levels
  if (levelType.startsWith('structural_')) {
    return levelType.replace('structural_', '').charAt(0).toUpperCase() +
           levelType.replace('structural_', '').slice(1) + ' (4H)';
  }

  return labelMap[levelType] || levelType;
}

// Level Row Component
function LevelRow({ level, currentPrice }: { level: KeyLevel; currentPrice: number }) {
  const distance = currentPrice > 0 ? ((level.price - currentPrice) / currentPrice * 100) : 0;
  const isAbove = level.price > currentPrice;
  const isNear = Math.abs(distance) < 0.5; // Within 0.5%

  return (
    <div className={cn(
      'flex items-center justify-between p-2',
      isNear ? 'bg-[var(--accent-primary-glow)] border border-[var(--accent-primary)]' : 'bg-[var(--bg-elevated)]'
    )}>
      <div>
        <div className="text-sm font-medium text-[var(--text-primary)]">
          {getLevelLabel(level.level_type)}
        </div>
        <div className="text-xs text-[var(--text-muted)]">
          {level.timeframe}
        </div>
      </div>
      <div className="text-right">
        <div className={cn('font-mono font-medium', isNear ? 'text-[var(--accent-primary)]' : 'text-[var(--text-primary)]')}>
          ${level.price.toFixed(2)}
        </div>
        <div className={`text-xs font-mono ${isAbove ? 'text-[var(--success)]' : 'text-[var(--error)]'}`}>
          {distance > 0 ? '+' : ''}{distance.toFixed(2)}%
        </div>
      </div>
    </div>
  );
}
