'use client';

/**
 * CompanionWatchlist
 *
 * Handles the watchlist UI, rendering symbols, and adding/removing items.
 * Extracted from the monolithic companion page for better modularity.
 */

import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Plus,
  Eye,
  Zap,
  ChevronDown,
  ChevronUp,
  X,
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

export interface WatchlistSymbol {
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

export interface DetectedSetup {
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

// ============================================================================
// PROPS
// ============================================================================

export interface CompanionWatchlistProps {
  watchlist: WatchlistSymbol[];
  setups: DetectedSetup[];
  selectedSymbol: string | null;
  onSelectSymbol: (symbol: string | null) => void;
  onAddSymbol: (symbol: string) => void;
  onRemoveSymbol: (symbol: string) => void;
  loading?: boolean;
  className?: string;
  // Mobile responsiveness
  isOverlay?: boolean;
  onClose?: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function CompanionWatchlist({
  watchlist,
  setups,
  selectedSymbol,
  onSelectSymbol,
  onAddSymbol,
  onRemoveSymbol,
  loading = false,
  className,
  isOverlay = false,
  onClose,
}: CompanionWatchlistProps) {
  const [expanded, setExpanded] = useState(true);
  const [newSymbol, setNewSymbol] = useState('');

  const handleAddSymbol = () => {
    if (!newSymbol.trim()) return;
    onAddSymbol(newSymbol.trim().toUpperCase());
    setNewSymbol('');
  };

  // Collapsed button state
  if (!expanded && !isOverlay) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className={cn(
          'w-10 h-10 rounded-lg bg-[#0d0d0d]/90 backdrop-blur border border-[var(--border-primary)]',
          'flex items-center justify-center hover:bg-[var(--bg-tertiary)] transition-colors',
          className
        )}
      >
        <Eye className="w-4 h-4 text-[var(--accent-primary)]" />
      </button>
    );
  }

  return (
    <div
      className={cn(
        'bg-[#0d0d0d]/90 backdrop-blur border border-[var(--border-primary)] rounded-lg overflow-hidden',
        isOverlay ? 'w-full h-full' : 'max-h-[60vh] w-52',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-primary)]">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-[var(--accent-primary)]" />
          <span className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
            Watch
          </span>
          <span className="text-[10px] text-[var(--text-tertiary)]">
            ({watchlist.length})
          </span>
        </div>
        <div className="flex items-center gap-1">
          {isOverlay && onClose ? (
            <button
              onClick={onClose}
              className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] p-1"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
            >
              {expanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Add Symbol Input */}
      <div className="p-2 border-b border-[var(--border-primary)]">
        <div className="flex gap-1">
          <input
            type="text"
            placeholder="Symbol..."
            value={newSymbol}
            onChange={(e) => setNewSymbol(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && handleAddSymbol()}
            className={cn(
              'flex-1 px-2 py-1 text-xs bg-[var(--bg-tertiary)] border border-[var(--border-primary)]',
              'text-[var(--text-primary)] placeholder-[var(--text-tertiary)]',
              'focus:border-[var(--accent-primary)] focus:outline-none rounded'
            )}
          />
          <button
            onClick={handleAddSymbol}
            disabled={!newSymbol.trim()}
            className={cn(
              'px-2 py-1 bg-[var(--accent-primary)] text-white rounded',
              'hover:bg-[var(--accent-primary)]/90 transition-colors',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Symbol List */}
      <div className={cn('overflow-y-auto', isOverlay ? 'flex-1' : 'max-h-[40vh]')}>
        {loading ? (
          <div className="p-4 text-center">
            <div className="animate-pulse text-xs text-[var(--text-tertiary)]">
              Loading watchlist...
            </div>
          </div>
        ) : watchlist.length === 0 ? (
          <div className="p-4 text-center">
            <p className="text-xs text-[var(--text-tertiary)]">
              No symbols in watchlist.
            </p>
            <p className="text-[10px] text-[var(--text-tertiary)] mt-1">
              Add a symbol above to get started.
            </p>
          </div>
        ) : (
          watchlist.map((item) => {
            const setup = setups.find((s) => s.symbol === item.symbol);
            const isSelected = selectedSymbol === item.symbol;
            const isReady = setup?.setup_stage === 'ready';
            const isForming = setup?.setup_stage === 'forming';

            return (
              <div
                key={item.id}
                className={cn(
                  'w-full flex items-center justify-between text-left transition-colors group',
                  isSelected
                    ? 'bg-[var(--accent-primary)]/20 border-l-2 border-l-[var(--accent-primary)]'
                    : 'hover:bg-[var(--bg-tertiary)]'
                )}
              >
                <button
                  onClick={() => onSelectSymbol(isSelected ? null : item.symbol)}
                  className="flex-1 px-3 py-2 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    {isReady && (
                      <Zap className="w-3 h-3 text-[var(--accent-primary)] animate-pulse" />
                    )}
                    {isForming && !isReady && (
                      <div className="w-2 h-2 rounded-full bg-[var(--warning)]" />
                    )}
                    <span
                      className={cn(
                        'text-xs font-semibold',
                        isSelected
                          ? 'text-[var(--accent-primary)]'
                          : 'text-[var(--text-primary)]'
                      )}
                    >
                      {item.symbol}
                    </span>
                  </div>

                  {item.quote && (
                    <span
                      className={cn(
                        'text-[10px] font-mono',
                        item.quote.change_percent >= 0
                          ? 'text-[var(--success)]'
                          : 'text-[var(--error)]'
                      )}
                    >
                      {item.quote.change_percent >= 0 ? '+' : ''}
                      {item.quote.change_percent.toFixed(1)}%
                    </span>
                  )}
                </button>

                {/* Remove button (shown on hover) */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveSymbol(item.symbol);
                  }}
                  className={cn(
                    'px-2 py-2 text-[var(--text-tertiary)]',
                    'opacity-0 group-hover:opacity-100 transition-opacity',
                    'hover:text-[var(--error)]'
                  )}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Ready Setups Summary */}
      {setups.filter((s) => s.setup_stage === 'ready').length > 0 && (
        <div className="px-3 py-2 border-t border-[var(--border-primary)] bg-[var(--accent-primary)]/5">
          <div className="flex items-center gap-1.5 text-[10px] text-[var(--accent-primary)] font-semibold">
            <Zap className="w-3 h-3" />
            {setups.filter((s) => s.setup_stage === 'ready').length} setup
            {setups.filter((s) => s.setup_stage === 'ready').length !== 1
              ? 's'
              : ''}{' '}
            ready
          </div>
        </div>
      )}
    </div>
  );
}

export default CompanionWatchlist;
