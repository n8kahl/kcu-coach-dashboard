'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
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
  RefreshCw
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

  useEffect(() => {
    fetchWatchlist();
    fetchSetups();

    // Poll for updates every 30 seconds
    const interval = setInterval(() => {
      fetchSetups();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

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
          <div className="badge badge-gold flex items-center gap-2">
            <Activity className="w-3 h-3" />
            <span className="pulse-dot">LIVE</span>
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
            <button className="btn btn-primary">
              View Setups
              <ChevronRight className="w-4 h-4 ml-1" />
            </button>
          </div>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
      className={cn(
        'p-3 border cursor-pointer transition-all',
        isSelected
          ? 'border-[var(--accent-primary)] bg-[var(--accent-primary-glow)]'
          : 'border-[var(--border-primary)] hover:border-[var(--border-secondary)]',
        isReady && 'ring-1 ring-[var(--accent-primary)]',
        isShared && 'border-l-2 border-l-[var(--accent-primary)]'
      )}
      onClick={onSelect}
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
              className="p-1 hover:bg-[var(--bg-elevated)]"
            >
              <X className="w-4 h-4 text-[var(--text-tertiary)]" />
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

  // Organize levels by category
  const intradayLevels = levels.filter(l =>
    ['pdh', 'pdl', 'pdc', 'orb_high', 'orb_low', 'vwap', 'open_price', 'hod', 'lod', 'premarket_high', 'premarket_low'].includes(l.level_type)
  );
  const maLevels = levels.filter(l =>
    ['ema_9', 'ema_21', 'sma_50', 'sma_200'].includes(l.level_type)
  );
  const htfLevels = levels.filter(l =>
    ['weekly_high', 'weekly_low', 'monthly_high', 'monthly_low', 'hourly_pivot'].includes(l.level_type)
  );

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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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

        {/* Moving Averages */}
        <div>
          <h4 className="text-sm font-semibold text-[var(--text-tertiary)] mb-3 uppercase tracking-wider">Moving Averages</h4>
          <div className="space-y-2">
            {maLevels.map((level) => (
              <LevelRow key={level.id} level={level} currentPrice={currentPrice} />
            ))}
          </div>
        </div>

        {/* Higher Timeframe */}
        <div>
          <h4 className="text-sm font-semibold text-[var(--text-tertiary)] mb-3 uppercase tracking-wider">Higher Timeframe</h4>
          <div className="space-y-2">
            {htfLevels.map((level) => (
              <LevelRow key={level.id} level={level} currentPrice={currentPrice} />
            ))}
          </div>
        </div>
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

// Level Row Component
function LevelRow({ level, currentPrice }: { level: KeyLevel; currentPrice: number }) {
  const distance = currentPrice > 0 ? ((level.price - currentPrice) / currentPrice * 100) : 0;
  const isAbove = level.price > currentPrice;
  const isNear = Math.abs(distance) < 0.5; // Within 0.5%

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
    ema_9: '9 EMA',
    ema_21: '21 EMA',
    sma_50: '50 SMA',
    sma_200: '200 SMA',
    weekly_high: 'Weekly High',
    weekly_low: 'Weekly Low',
    monthly_high: 'Monthly High',
    monthly_low: 'Monthly Low',
    hourly_pivot: 'Hourly Pivot'
  };

  return (
    <div className={cn(
      'flex items-center justify-between p-2',
      isNear ? 'bg-[var(--accent-primary-glow)] border border-[var(--accent-primary)]' : 'bg-[var(--bg-elevated)]'
    )}>
      <div>
        <div className="text-sm font-medium text-[var(--text-primary)]">
          {labelMap[level.level_type] || level.level_type}
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
