'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  Target,
  Zap,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle2,
  Activity,
  Wifi,
  WifiOff,
} from 'lucide-react';

// ============================================
// Types
// ============================================

interface MarketData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  trend: 'bullish' | 'bearish' | 'neutral';
  vwap?: number;
  keyLevels: KeyLevel[];
  patienceCandle?: PatienceCandle;
}

interface KeyLevel {
  type: 'support' | 'resistance' | 'pdh' | 'pdl' | 'orb_high' | 'orb_low' | 'vwap' | 'ema9' | 'ema21' | 'sma200';
  price: number;
  distance: number;
  strength: number;
}

interface PatienceCandle {
  timeframe: string;
  forming: boolean;
  confirmed: boolean;
  direction: 'bullish' | 'bearish';
  timestamp?: string;
}

interface MarketStatus {
  status: 'premarket' | 'open' | 'afterhours' | 'closed';
  nextEvent: string;
  nextEventTime: string;
}

interface MarketAPIResponse {
  symbols: MarketData[];
  marketStatus: MarketStatus;
  vix?: number;
  lastUpdated: string;
  error?: string;
}

// ============================================
// Market Intel Component
// ============================================

interface AIMarketIntelProps {
  symbols?: string[];
  compact?: boolean;
  className?: string;
}

export function AIMarketIntel({
  symbols = ['SPY', 'QQQ'],
  compact = false,
  className,
}: AIMarketIntelProps) {
  const [marketData, setMarketData] = useState<MarketData[]>([]);
  const [marketStatus, setMarketStatus] = useState<MarketStatus | null>(null);
  const [vix, setVix] = useState<number | null>(null);
  const [isExpanded, setIsExpanded] = useState(!compact);
  const [isLoading, setIsLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Fetch market data
  useEffect(() => {
    const fetchMarketData = async () => {
      try {
        const response = await fetch(`/api/ai/market?symbols=${symbols.join(',')}`);
        const data: MarketAPIResponse = await response.json();

        if (!response.ok) {
          if (response.status === 503) {
            // Service not configured - API key missing
            setError('Market data service not configured');
            setIsLive(false);
          } else {
            throw new Error(data.error || 'Failed to fetch market data');
          }
          return;
        }

        setMarketData(data.symbols || []);
        setMarketStatus(data.marketStatus);
        setVix(data.vix || null);
        setLastUpdated(new Date(data.lastUpdated));
        setIsLive(true);
        setError(null);
      } catch (err) {
        console.error('Market data fetch error:', err);
        setError(err instanceof Error ? err.message : 'Connection error');
        setIsLive(false);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMarketData();
    // Refresh every 15 seconds during market hours for live data
    const interval = setInterval(fetchMarketData, 15000);
    return () => clearInterval(interval);
  }, [symbols]);

  if (isLoading) {
    return (
      <div className={cn('p-3 border-t border-[var(--border-primary)]', className)}>
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-[var(--bg-tertiary)] rounded w-24" />
          <div className="h-8 bg-[var(--bg-tertiary)] rounded" />
        </div>
      </div>
    );
  }

  // Show error state if not configured
  if (error && marketData.length === 0) {
    return (
      <div className={cn('border-t border-[var(--border-primary)]', className)}>
        <div className="p-3">
          <div className="flex items-center gap-2 mb-2">
            <WifiOff className="w-4 h-4 text-[var(--text-muted)]" />
            <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
              Market Intel
            </span>
          </div>
          <div className="text-xs text-[var(--text-muted)] bg-[var(--bg-tertiary)] p-2 rounded">
            {error === 'Market data service not configured' ? (
              <>Set <code className="text-[var(--accent-primary)]">MASSIVE_API_KEY</code> for live data</>
            ) : (
              error
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('border-t border-[var(--border-primary)]', className)}>
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-[var(--bg-tertiary)] transition-colors"
      >
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-[var(--accent-primary)]" />
          <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
            Market Intel
          </span>
          {/* Live indicator */}
          {isLive ? (
            <span className="flex items-center gap-1 text-[10px] text-[var(--success)]">
              <Wifi className="w-3 h-3" />
              <span className="hidden sm:inline">LIVE</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
              <WifiOff className="w-3 h-3" />
            </span>
          )}
          {marketStatus && (
            <MarketStatusBadge status={marketStatus.status} />
          )}
        </div>
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-[var(--text-tertiary)]" />
        ) : (
          <ChevronUp className="w-4 h-4 text-[var(--text-tertiary)]" />
        )}
      </button>

      {/* Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-3">
              {/* VIX Display */}
              {vix !== null && (
                <VixDisplay vix={vix} />
              )}

              {/* Symbol Cards */}
              {marketData.map((data) => (
                <SymbolCard key={data.symbol} data={data} compact={compact} />
              ))}

              {/* Market Status Footer */}
              {marketStatus && (
                <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)] pt-2 border-t border-[var(--border-primary)]">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{marketStatus.nextEvent}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>{marketStatus.nextEventTime}</span>
                    {lastUpdated && (
                      <span className="text-[var(--text-muted)]">
                        Updated {formatTimeAgo(lastUpdated)}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================
// VIX Display
// ============================================

function VixDisplay({ vix }: { vix: number }) {
  const getVixLevel = (value: number): { label: string; color: string } => {
    if (value < 15) return { label: 'Low Vol', color: 'text-[var(--success)]' };
    if (value < 20) return { label: 'Normal', color: 'text-[var(--text-secondary)]' };
    if (value < 25) return { label: 'Elevated', color: 'text-[var(--warning)]' };
    if (value < 30) return { label: 'High', color: 'text-[var(--error)]' };
    return { label: 'Extreme', color: 'text-[var(--error)]' };
  };

  const { label, color } = getVixLevel(vix);

  return (
    <div className="flex items-center justify-between bg-[var(--bg-tertiary)] border border-[var(--border-primary)] p-2">
      <div className="flex items-center gap-2">
        <Activity className="w-4 h-4 text-[var(--accent-primary)]" />
        <span className="text-xs font-semibold text-[var(--text-secondary)]">VIX</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="font-mono text-sm text-[var(--text-primary)]">
          {vix.toFixed(2)}
        </span>
        <span className={cn('text-[10px] font-medium', color)}>
          {label}
        </span>
      </div>
    </div>
  );
}

// ============================================
// Symbol Card
// ============================================

function SymbolCard({ data, compact }: { data: MarketData; compact: boolean }) {
  const isPositive = data.change >= 0;
  const TrendIcon = data.trend === 'bullish' ? TrendingUp : data.trend === 'bearish' ? TrendingDown : Minus;

  return (
    <div className="bg-[var(--bg-tertiary)] border border-[var(--border-primary)] p-2">
      {/* Header Row */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm text-[var(--text-primary)]">{data.symbol}</span>
          <TrendIcon
            className={cn(
              'w-4 h-4',
              data.trend === 'bullish' && 'text-[var(--success)]',
              data.trend === 'bearish' && 'text-[var(--error)]',
              data.trend === 'neutral' && 'text-[var(--text-tertiary)]'
            )}
          />
        </div>
        <div className="text-right">
          <span className="font-mono text-sm text-[var(--text-primary)]">
            ${data.price.toFixed(2)}
          </span>
          <span
            className={cn(
              'ml-2 text-xs font-medium',
              isPositive ? 'text-[var(--success)]' : 'text-[var(--error)]'
            )}
          >
            {isPositive ? '+' : ''}{data.changePercent.toFixed(2)}%
          </span>
        </div>
      </div>

      {!compact && (
        <>
          {/* Key Levels */}
          {data.keyLevels.length > 0 && (
            <div className="mb-2">
              <div className="flex items-center gap-1 mb-1">
                <Target className="w-3 h-3 text-[var(--accent-primary)]" />
                <span className="text-[10px] text-[var(--text-tertiary)] uppercase">Key Levels</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {data.keyLevels.slice(0, 4).map((level, idx) => (
                  <KeyLevelBadge key={idx} level={level} />
                ))}
              </div>
            </div>
          )}

          {/* Patience Candle Status */}
          {data.patienceCandle && (
            <PatienceCandleStatus candle={data.patienceCandle} />
          )}
        </>
      )}
    </div>
  );
}

// ============================================
// Sub-components
// ============================================

function MarketStatusBadge({ status }: { status: MarketStatus['status'] }) {
  const config = {
    premarket: { label: 'Pre', color: 'text-[var(--warning)]', dot: 'bg-[var(--warning)]' },
    open: { label: 'Open', color: 'text-[var(--success)]', dot: 'bg-[var(--success)]' },
    afterhours: { label: 'AH', color: 'text-[var(--warning)]', dot: 'bg-[var(--warning)]' },
    closed: { label: 'Closed', color: 'text-[var(--text-muted)]', dot: 'bg-[var(--text-muted)]' },
  };

  const { label, color, dot } = config[status];

  return (
    <span className={cn('flex items-center gap-1 text-[10px] font-medium', color)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', dot, status === 'open' && 'animate-pulse')} />
      {label}
    </span>
  );
}

function KeyLevelBadge({ level }: { level: KeyLevel }) {
  const typeLabels: Record<KeyLevel['type'], string> = {
    support: 'S',
    resistance: 'R',
    pdh: 'PDH',
    pdl: 'PDL',
    orb_high: 'ORB↑',
    orb_low: 'ORB↓',
    vwap: 'VWAP',
    ema9: 'EMA9',
    ema21: 'EMA21',
    sma200: 'SMA200',
  };

  const isNearby = Math.abs(level.distance) < 0.5;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono',
        'border',
        isNearby
          ? 'bg-[var(--accent-primary-glow)] border-[var(--accent-primary)] text-[var(--accent-primary)]'
          : 'bg-[var(--bg-secondary)] border-[var(--border-primary)] text-[var(--text-tertiary)]'
      )}
    >
      <span className="font-semibold">{typeLabels[level.type] || level.type}</span>
      <span>${level.price.toFixed(2)}</span>
      <span className="text-[var(--text-muted)]">({level.distance > 0 ? '+' : ''}{level.distance.toFixed(2)}%)</span>
    </span>
  );
}

function PatienceCandleStatus({ candle }: { candle: PatienceCandle }) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 p-1.5 text-[10px]',
        candle.confirmed
          ? 'bg-[var(--success)]/10 border border-[var(--success)]/30'
          : candle.forming
          ? 'bg-[var(--warning)]/10 border border-[var(--warning)]/30'
          : 'bg-[var(--bg-secondary)] border border-[var(--border-primary)]'
      )}
    >
      {candle.confirmed ? (
        <CheckCircle2 className="w-3 h-3 text-[var(--success)]" />
      ) : candle.forming ? (
        <Zap className="w-3 h-3 text-[var(--warning)] animate-pulse" />
      ) : (
        <AlertCircle className="w-3 h-3 text-[var(--text-muted)]" />
      )}
      <span
        className={cn(
          candle.confirmed
            ? 'text-[var(--success)]'
            : candle.forming
            ? 'text-[var(--warning)]'
            : 'text-[var(--text-muted)]'
        )}
      >
        {candle.confirmed
          ? `${candle.direction === 'bullish' ? '↑' : '↓'} Patience candle confirmed (${candle.timeframe})`
          : candle.forming
          ? `${candle.direction === 'bullish' ? '↑' : '↓'} Patience candle forming (${candle.timeframe})`
          : `No patience candle on ${candle.timeframe}`}
      </span>
    </div>
  );
}

// ============================================
// Helper Functions
// ============================================

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}
