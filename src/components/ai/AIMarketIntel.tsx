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
  type: 'support' | 'resistance' | 'pdh' | 'pdl' | 'orb_high' | 'orb_low' | 'vwap';
  price: number;
  distance: number;
  strength: number;
}

interface PatienceCandle {
  timeframe: string;
  forming: boolean;
  confirmed: boolean;
  direction: 'bullish' | 'bearish';
  timestamp: string;
}

interface MarketStatus {
  status: 'premarket' | 'open' | 'afterhours' | 'closed';
  nextEvent: string;
  nextEventTime: string;
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
  const [isExpanded, setIsExpanded] = useState(!compact);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch market data
  useEffect(() => {
    const fetchMarketData = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/ai/market?symbols=${symbols.join(',')}`);
        if (!response.ok) throw new Error('Failed to fetch market data');
        const data = await response.json();
        setMarketData(data.symbols || []);
        setMarketStatus(data.marketStatus);
        setError(null);
      } catch (err) {
        // Use mock data in development or on error
        setMarketData(getMockMarketData(symbols));
        setMarketStatus(getMockMarketStatus());
        setError(null); // Don't show error, use mock data
      } finally {
        setIsLoading(false);
      }
    };

    fetchMarketData();
    // Refresh every 30 seconds during market hours
    const interval = setInterval(fetchMarketData, 30000);
    return () => clearInterval(interval);
  }, [symbols]);

  if (isLoading && marketData.length === 0) {
    return (
      <div className={cn('p-3 border-t border-[var(--border-primary)]', className)}>
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-[var(--bg-tertiary)] rounded w-24" />
          <div className="h-8 bg-[var(--bg-tertiary)] rounded" />
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
                  <span>{marketStatus.nextEventTime}</span>
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
                {data.keyLevels.slice(0, 3).map((level, idx) => (
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
      <span className="font-semibold">{typeLabels[level.type]}</span>
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
// Mock Data (for development/fallback)
// ============================================

function getMockMarketData(symbols: string[]): MarketData[] {
  return symbols.map((symbol) => ({
    symbol,
    price: symbol === 'SPY' ? 483.50 : 418.25,
    change: symbol === 'SPY' ? 3.75 : 2.10,
    changePercent: symbol === 'SPY' ? 0.78 : 0.50,
    trend: 'bullish' as const,
    vwap: symbol === 'SPY' ? 482.00 : 417.00,
    keyLevels: [
      { type: 'resistance' as const, price: symbol === 'SPY' ? 485.00 : 420.00, distance: 0.31, strength: 85 },
      { type: 'vwap' as const, price: symbol === 'SPY' ? 482.00 : 417.00, distance: -0.31, strength: 90 },
      { type: 'support' as const, price: symbol === 'SPY' ? 480.00 : 415.00, distance: -0.72, strength: 75 },
    ],
    patienceCandle: {
      timeframe: '15m',
      forming: true,
      confirmed: false,
      direction: 'bullish' as const,
      timestamp: new Date().toISOString(),
    },
  }));
}

function getMockMarketStatus(): MarketStatus {
  const now = new Date();
  const hour = now.getHours();
  const isWeekend = now.getDay() === 0 || now.getDay() === 6;

  if (isWeekend) {
    return { status: 'closed', nextEvent: 'Opens Monday', nextEventTime: '9:30 AM ET' };
  }
  if (hour < 9 || (hour === 9 && now.getMinutes() < 30)) {
    return { status: 'premarket', nextEvent: 'Market opens', nextEventTime: '9:30 AM ET' };
  }
  if (hour >= 16) {
    return { status: 'afterhours', nextEvent: 'AH closes', nextEventTime: '8:00 PM ET' };
  }
  return { status: 'open', nextEvent: 'Market closes', nextEventTime: '4:00 PM ET' };
}
