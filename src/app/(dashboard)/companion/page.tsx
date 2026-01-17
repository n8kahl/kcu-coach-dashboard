'use client';

import { useState, useEffect } from 'react';
import { Button, Badge, Input } from '@/components/ui';
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
  Layers
} from 'lucide-react';

interface WatchlistSymbol {
  id: string;
  symbol: string;
  added_at: string;
  levels: KeyLevel[];
  quote: MarketQuote | null;
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
  primary_level_type: string;
  primary_level_price: number;
  patience_candles: number;
  coach_note: string;
  suggested_entry: number;
  suggested_stop: number;
  target_1: number;
  target_2: number;
  detected_at: string;
}

export default function CompanionPage() {
  const [watchlist, setWatchlist] = useState<WatchlistSymbol[]>([]);
  const [setups, setSetups] = useState<DetectedSetup[]>([]);
  const [newSymbol, setNewSymbol] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);

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

  const readySetups = setups.filter(s => s.setup_stage === 'ready');
  const formingSetups = setups.filter(s => s.setup_stage === 'forming');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Companion Mode
          </h1>
          <p className="text-gray-400">
            Real-time LTP setup detection and trade guidance
          </p>
        </div>
        <Badge variant="warning" className="animate-pulse flex items-center gap-1">
          <Activity className="w-3 h-3" />
          LIVE
        </Badge>
      </div>

      {/* Ready Setups Alert Banner */}
      {readySetups.length > 0 && (
        <div className="glass-card p-4 border-l-4 border-yellow-500 animate-pulse-glow">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-500 rounded-lg flex items-center justify-center">
                <Target className="w-5 h-5 text-black" />
              </div>
              <div>
                <p className="font-semibold text-white">
                  {readySetups.length} Setup{readySetups.length > 1 ? 's' : ''} Ready!
                </p>
                <p className="text-sm text-gray-400">
                  {readySetups.map(s => s.symbol).join(', ')} - All LTP criteria met
                </p>
              </div>
            </div>
            <Button size="sm">
              View Setups
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Watchlist Panel */}
        <div className="glass-card p-6 lg:col-span-1">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
            <Eye className="w-5 h-5 text-primary-400" />
            Watchlist
          </h2>

          {/* Add Symbol Input */}
          <div className="flex gap-2 mb-4">
            <Input
              placeholder="Add symbol (e.g., NVDA)"
              value={newSymbol}
              onChange={(e) => setNewSymbol(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && addSymbol()}
              className="flex-1"
            />
            <Button size="sm" onClick={addSymbol}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          {/* Symbol List */}
          <div className="space-y-2">
            {watchlist.map((item) => (
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
              <div className="text-center py-8 text-gray-500">
                <Eye className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No symbols in watchlist</p>
                <p className="text-sm">Add symbols to start detecting setups</p>
              </div>
            )}
          </div>
        </div>

        {/* Setups Panel */}
        <div className="glass-card p-6 lg:col-span-2">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5 text-yellow-400" />
            LTP Setups
          </h2>

          {/* Ready Setups */}
          {readySetups.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-yellow-400 mb-3 flex items-center gap-2">
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
              <h3 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
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
            <div className="text-center py-12 text-gray-500">
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
  setup
}: {
  item: WatchlistSymbol;
  isSelected: boolean;
  onSelect: () => void;
  onRemove: () => void;
  setup?: DetectedSetup;
}) {
  const hasSetup = !!setup;
  const isReady = setup?.setup_stage === 'ready';

  return (
    <div
      className={cn(
        'p-3 border rounded-lg cursor-pointer transition-all',
        isSelected
          ? 'border-primary-500 bg-primary-500/10'
          : 'border-dark-border hover:border-gray-600',
        isReady && 'ring-1 ring-yellow-500 animate-pulse'
      )}
      onClick={onSelect}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="font-bold text-white">{item.symbol}</div>
          {item.quote && (
            <span className={`text-sm ${item.quote.change_percent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {item.quote.change_percent >= 0 ? '+' : ''}{item.quote.change_percent?.toFixed(2)}%
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasSetup && (
            <Badge
              variant={isReady ? 'warning' : 'default'}
              className={isReady ? 'animate-pulse' : ''}
            >
              {setup.confluence_score}%
            </Badge>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="p-1 hover:bg-dark-border rounded"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>

      {item.quote && (
        <div className="mt-2 text-sm text-gray-400">
          ${item.quote.last_price?.toFixed(2)}
        </div>
      )}

      {hasSetup && (
        <div className="mt-2 flex gap-2 text-xs">
          <span className={cn(
            setup.level_score >= 70 ? 'text-green-500' : setup.level_score >= 50 ? 'text-yellow-500' : 'text-red-500'
          )}>
            L:{setup.level_score}
          </span>
          <span className={cn(
            setup.trend_score >= 70 ? 'text-green-500' : setup.trend_score >= 50 ? 'text-yellow-500' : 'text-red-500'
          )}>
            T:{setup.trend_score}
          </span>
          <span className={cn(
            setup.patience_score >= 70 ? 'text-green-500' : setup.patience_score >= 50 ? 'text-yellow-500' : 'text-red-500'
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
        'p-4 border rounded-lg',
        isReady
          ? 'border-yellow-500 bg-yellow-500/10'
          : 'border-dark-border bg-dark-bg/50'
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={cn(
            'w-10 h-10 rounded-lg flex items-center justify-center',
            isReady ? 'bg-yellow-500 text-black' : 'bg-dark-border text-gray-400'
          )}>
            {setup.direction === 'bullish' ? (
              <TrendingUp className="w-5 h-5" />
            ) : (
              <TrendingDown className="w-5 h-5" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg text-white">{setup.symbol}</span>
              <Badge variant={setup.direction === 'bullish' ? 'success' : 'error'}>
                {setup.direction.toUpperCase()}
              </Badge>
            </div>
            <div className="text-sm text-gray-400">
              {setup.primary_level_type?.toUpperCase()} @ ${setup.primary_level_price?.toFixed(2)}
            </div>
          </div>
        </div>

        <div className="text-right">
          <div className={cn('text-2xl font-bold', isReady ? 'text-yellow-400' : 'text-white')}>
            {setup.confluence_score}
          </div>
          <div className="text-xs text-gray-500">CONFLUENCE</div>
        </div>
      </div>

      {/* LTP Scores */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <ScoreBar label="Level" score={setup.level_score} />
        <ScoreBar label="Trend" score={setup.trend_score} />
        <ScoreBar label="Patience" score={setup.patience_score} />
      </div>

      {/* Coach Note */}
      {setup.coach_note && (
        <div className="p-3 bg-dark-bg border border-dark-border rounded-lg text-sm text-gray-300 mb-3">
          💡 {setup.coach_note}
        </div>
      )}

      {/* Trade Params (for ready setups) */}
      {isReady && setup.suggested_entry && (
        <div className="grid grid-cols-4 gap-2 text-sm">
          <div>
            <div className="text-gray-500">Entry</div>
            <div className="font-medium text-white">${setup.suggested_entry?.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-gray-500">Stop</div>
            <div className="font-medium text-red-500">${setup.suggested_stop?.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-gray-500">Target 1</div>
            <div className="font-medium text-green-500">${setup.target_1?.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-gray-500">Target 2</div>
            <div className="font-medium text-green-500">${setup.target_2?.toFixed(2)}</div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 mt-4">
        <Button variant={isReady ? 'primary' : 'secondary'} size="sm" className="flex-1">
          <Bell className="w-4 h-4 mr-1" />
          {isReady ? 'Alert on Break' : 'Watch Setup'}
        </Button>
        <Button variant="secondary" size="sm">
          <BarChart3 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

// Score Bar Component
function ScoreBar({ label, score }: { label: string; score: number }) {
  const color = score >= 70 ? 'bg-green-500' : score >= 50 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-500">{label}</span>
        <span className="text-gray-300">{score}</span>
      </div>
      <div className="h-1.5 bg-dark-border rounded-full overflow-hidden">
        <div
          className={`h-full ${color} transition-all duration-500`}
          style={{ width: `${score}%` }}
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
    ['pdh', 'pdl', 'orb_high', 'orb_low', 'vwap', 'open_price', 'hod', 'lod'].includes(l.level_type)
  );
  const maLevels = levels.filter(l =>
    ['ema_8', 'ema_21', 'sma_50', 'sma_200'].includes(l.level_type)
  );
  const htfLevels = levels.filter(l =>
    ['weekly_high', 'weekly_low', 'monthly_high', 'monthly_low'].includes(l.level_type)
  );

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Layers className="w-5 h-5 text-primary-400" />
          {symbol} Key Levels
        </h2>
        <button onClick={onClose} className="p-1 hover:bg-dark-border rounded">
          <X className="w-5 h-5 text-gray-400" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Intraday Levels */}
        <div>
          <h4 className="text-sm font-semibold text-gray-400 mb-3">Intraday</h4>
          <div className="space-y-2">
            {intradayLevels.map((level) => (
              <LevelRow key={level.id} level={level} currentPrice={currentPrice} />
            ))}
            {intradayLevels.length === 0 && (
              <p className="text-sm text-gray-500">Loading...</p>
            )}
          </div>
        </div>

        {/* Moving Averages */}
        <div>
          <h4 className="text-sm font-semibold text-gray-400 mb-3">Moving Averages</h4>
          <div className="space-y-2">
            {maLevels.map((level) => (
              <LevelRow key={level.id} level={level} currentPrice={currentPrice} />
            ))}
          </div>
        </div>

        {/* Higher Timeframe */}
        <div>
          <h4 className="text-sm font-semibold text-gray-400 mb-3">Higher Timeframe</h4>
          <div className="space-y-2">
            {htfLevels.map((level) => (
              <LevelRow key={level.id} level={level} currentPrice={currentPrice} />
            ))}
          </div>
        </div>
      </div>

      {/* ORB Info */}
      {quote?.orb_high && quote?.orb_low && (
        <div className="mt-6 p-4 bg-dark-bg border border-dark-border rounded-lg">
          <h4 className="text-sm font-semibold text-gray-400 mb-2">
            Opening Range (First 15 min)
          </h4>
          <div className="flex items-center gap-6">
            <div>
              <span className="text-xs text-gray-500">ORB High</span>
              <div className="font-medium text-green-500">${quote.orb_high.toFixed(2)}</div>
            </div>
            <div>
              <span className="text-xs text-gray-500">ORB Low</span>
              <div className="font-medium text-red-500">${quote.orb_low.toFixed(2)}</div>
            </div>
            <div>
              <span className="text-xs text-gray-500">Range</span>
              <div className="font-medium text-white">
                ${(quote.orb_high - quote.orb_low).toFixed(2)}
                <span className="text-xs text-gray-500 ml-1">
                  ({((quote.orb_high - quote.orb_low) / quote.orb_low * 100).toFixed(2)}%)
                </span>
              </div>
            </div>
            <div>
              <span className="text-xs text-gray-500">Status</span>
              <div className="font-medium">
                {currentPrice > quote.orb_high ? (
                  <span className="text-green-500">Above ORB</span>
                ) : currentPrice < quote.orb_low ? (
                  <span className="text-red-500">Below ORB</span>
                ) : (
                  <span className="text-yellow-500">Inside ORB</span>
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
    orb_high: 'ORB High',
    orb_low: 'ORB Low',
    vwap: 'VWAP',
    open_price: 'Open',
    hod: 'HOD',
    lod: 'LOD',
    ema_8: '8 EMA',
    ema_21: '21 EMA',
    sma_50: '50 SMA',
    sma_200: '200 SMA',
    weekly_high: 'Weekly High',
    weekly_low: 'Weekly Low',
    monthly_high: 'Monthly High',
    monthly_low: 'Monthly Low'
  };

  return (
    <div className={cn(
      'flex items-center justify-between p-2 rounded',
      isNear ? 'bg-primary-500/20 border border-primary-500' : 'bg-dark-border/50'
    )}>
      <div>
        <div className="text-sm font-medium text-white">
          {labelMap[level.level_type] || level.level_type}
        </div>
        <div className="text-xs text-gray-500">
          {level.timeframe}
        </div>
      </div>
      <div className="text-right">
        <div className={cn('font-mono font-medium', isNear ? 'text-primary-400' : 'text-white')}>
          ${level.price.toFixed(2)}
        </div>
        <div className={`text-xs ${isAbove ? 'text-green-500' : 'text-red-500'}`}>
          {distance > 0 ? '+' : ''}{distance.toFixed(2)}%
        </div>
      </div>
    </div>
  );
}
