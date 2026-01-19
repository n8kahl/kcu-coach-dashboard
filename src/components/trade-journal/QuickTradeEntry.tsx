'use client';

import { useState, useCallback, useEffect, useRef, KeyboardEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  TrendingUp,
  TrendingDown,
  Check,
  X,
  Zap,
  ChevronDown,
  Clock,
  DollarSign,
} from 'lucide-react';
import type { TradeEntry } from '@/types';

interface QuickTradeEntryProps {
  onSubmit: (trade: Partial<TradeEntry>) => Promise<void>;
  onCancel?: () => void;
  recentSymbols?: string[];
  className?: string;
}

// Emotion options with emojis
const EMOTIONS = [
  { key: 'confident', emoji: '😊', label: 'Confident' },
  { key: 'anxious', emoji: '😰', label: 'Anxious' },
  { key: 'frustrated', emoji: '😤', label: 'Frustrated' },
  { key: 'neutral', emoji: '😐', label: 'Neutral' },
] as const;

// Common trading symbols
const COMMON_SYMBOLS = ['SPY', 'QQQ', 'AAPL', 'TSLA', 'NVDA', 'AMD', 'META', 'AMZN', 'MSFT', 'GOOGL'];

export function QuickTradeEntry({
  onSubmit,
  onCancel,
  recentSymbols = [],
  className,
}: QuickTradeEntryProps) {
  const [symbol, setSymbol] = useState('');
  const [direction, setDirection] = useState<'long' | 'short'>('long');
  const [result, setResult] = useState<'win' | 'loss' | 'breakeven' | null>(null);
  const [pnl, setPnl] = useState('');
  const [emotion, setEmotion] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showSymbols, setShowSymbols] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const symbolInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Combine recent symbols with common ones (deduplicated)
  const allSymbols = Array.from(new Set([...recentSymbols, ...COMMON_SYMBOLS]));

  // Filter symbols based on input
  const filteredSymbols = allSymbols.filter(s =>
    s.toLowerCase().includes(symbol.toLowerCase())
  ).slice(0, 8);

  // Focus symbol input on mount
  useEffect(() => {
    symbolInputRef.current?.focus();
  }, []);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel?.();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowSymbols(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle symbol input keyboard navigation
  const handleSymbolKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!showSymbols || filteredSymbols.length === 0) {
      if (e.key === 'ArrowDown') {
        setShowSymbols(true);
        setHighlightedIndex(0);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => (prev + 1) % filteredSymbols.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => (prev - 1 + filteredSymbols.length) % filteredSymbols.length);
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredSymbols[highlightedIndex]) {
          setSymbol(filteredSymbols[highlightedIndex]);
          setShowSymbols(false);
        }
        break;
      case 'Escape':
        setShowSymbols(false);
        break;
    }
  };

  // Handle form submission
  const handleSubmit = useCallback(async () => {
    if (!symbol || result === null) return;

    setSubmitting(true);

    const pnlValue = parseFloat(pnl) || 0;
    const adjustedPnl = result === 'loss' ? -Math.abs(pnlValue) : result === 'win' ? Math.abs(pnlValue) : 0;

    const now = new Date().toISOString();

    const trade: Partial<TradeEntry> = {
      symbol: symbol.toUpperCase(),
      direction,
      entry_time: now,
      exit_time: now,
      pnl: adjustedPnl,
      pnl_percent: 0, // Can't calculate without entry/exit prices
      emotions: emotion || 'neutral',
      entry_mode: 'quick' as const,
      notes: `Quick entry: ${result === 'win' ? 'Winner' : result === 'loss' ? 'Loser' : 'Breakeven'} (${EMOTIONS.find(e => e.key === emotion)?.emoji || '😐'} ${emotion || 'neutral'})`,
    };

    try {
      await onSubmit(trade);

      // Reset form but keep symbol for consecutive entries
      setResult(null);
      setPnl('');
      setEmotion(null);
      symbolInputRef.current?.focus();
    } finally {
      setSubmitting(false);
    }
  }, [symbol, direction, result, pnl, emotion, onSubmit]);

  // Handle enter key on PnL input
  const handlePnlKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && symbol && result !== null) {
      handleSubmit();
    }
  };

  return (
    <Card className={cn('relative', className)}>
      <CardHeader
        title="Quick Entry"
        icon={<Zap className="w-4 h-4" />}
        action={
          onCancel && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancel}
              className="text-[var(--text-tertiary)]"
            >
              <X className="w-4 h-4" />
            </Button>
          )
        }
      />
      <CardContent>
        <div className="space-y-4">
          {/* Symbol Input with Autocomplete */}
          <div className="relative" ref={dropdownRef}>
            <label className="block text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide mb-1">
              Symbol
            </label>
            <input
              ref={symbolInputRef}
              type="text"
              value={symbol}
              onChange={(e) => {
                setSymbol(e.target.value.toUpperCase());
                setShowSymbols(true);
                setHighlightedIndex(0);
              }}
              onFocus={() => setShowSymbols(true)}
              onKeyDown={handleSymbolKeyDown}
              placeholder="SPY"
              className={cn(
                'w-full px-3 py-2.5 text-lg font-bold uppercase',
                'bg-[var(--bg-tertiary)] border border-[var(--border-primary)]',
                'text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]',
                'focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)]',
                'outline-none rounded-md transition-all'
              )}
            />
            <ChevronDown className="absolute right-3 top-8 w-4 h-4 text-[var(--text-tertiary)]" />

            {/* Symbol Dropdown */}
            <AnimatePresence>
              {showSymbols && filteredSymbols.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="absolute z-50 w-full mt-1 py-1 bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-md shadow-lg max-h-48 overflow-y-auto"
                >
                  {recentSymbols.length > 0 && (
                    <div className="px-3 py-1 text-xs text-[var(--text-tertiary)] uppercase">
                      Recent
                    </div>
                  )}
                  {filteredSymbols.map((s, index) => (
                    <button
                      key={s}
                      onClick={() => {
                        setSymbol(s);
                        setShowSymbols(false);
                      }}
                      className={cn(
                        'w-full px-3 py-2 text-left text-sm font-medium',
                        'hover:bg-[var(--bg-tertiary)] transition-colors',
                        index === highlightedIndex && 'bg-[var(--bg-tertiary)]',
                        recentSymbols.includes(s) ? 'text-[var(--accent-primary)]' : 'text-[var(--text-primary)]'
                      )}
                    >
                      {s}
                      {recentSymbols.includes(s) && (
                        <Clock className="inline-block w-3 h-3 ml-2 text-[var(--text-tertiary)]" />
                      )}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Direction Toggle */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide mb-1">
              Direction
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setDirection('long')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md font-medium transition-all',
                  'border',
                  direction === 'long'
                    ? 'bg-[var(--profit)]/15 border-[var(--profit)] text-[var(--profit)]'
                    : 'bg-transparent border-[var(--border-primary)] text-[var(--text-secondary)] hover:border-[var(--profit)] hover:text-[var(--profit)]'
                )}
              >
                <TrendingUp className="w-4 h-4" />
                Long
              </button>
              <button
                onClick={() => setDirection('short')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md font-medium transition-all',
                  'border',
                  direction === 'short'
                    ? 'bg-[var(--loss)]/15 border-[var(--loss)] text-[var(--loss)]'
                    : 'bg-transparent border-[var(--border-primary)] text-[var(--text-secondary)] hover:border-[var(--loss)] hover:text-[var(--loss)]'
                )}
              >
                <TrendingDown className="w-4 h-4" />
                Short
              </button>
            </div>
          </div>

          {/* Result Selection */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide mb-1">
              Result
            </label>
            <div className="flex gap-2">
              {[
                { key: 'win', label: 'Win', color: 'profit' },
                { key: 'loss', label: 'Loss', color: 'loss' },
                { key: 'breakeven', label: 'B/E', color: 'text-tertiary' },
              ].map(({ key, label, color }) => (
                <button
                  key={key}
                  onClick={() => setResult(key as 'win' | 'loss' | 'breakeven')}
                  className={cn(
                    'flex-1 py-2.5 rounded-md font-medium transition-all border',
                    result === key
                      ? color === 'profit'
                        ? 'bg-[var(--profit)]/15 border-[var(--profit)] text-[var(--profit)]'
                        : color === 'loss'
                        ? 'bg-[var(--loss)]/15 border-[var(--loss)] text-[var(--loss)]'
                        : 'bg-[var(--bg-tertiary)] border-[var(--text-tertiary)] text-[var(--text-primary)]'
                      : 'bg-transparent border-[var(--border-primary)] text-[var(--text-secondary)] hover:border-[var(--border-secondary)]'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* P&L Amount */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide mb-1">
              P&L ($)
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
              <input
                type="number"
                value={pnl}
                onChange={(e) => setPnl(e.target.value)}
                onKeyDown={handlePnlKeyDown}
                placeholder="0.00"
                className={cn(
                  'w-full pl-8 pr-3 py-2.5 text-lg font-mono',
                  'bg-[var(--bg-tertiary)] border border-[var(--border-primary)]',
                  'text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]',
                  'focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)]',
                  'outline-none rounded-md transition-all',
                  result === 'win' && 'text-[var(--profit)]',
                  result === 'loss' && 'text-[var(--loss)]'
                )}
              />
            </div>
          </div>

          {/* Quick Emotion Select */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide mb-1">
              How did you feel?
            </label>
            <div className="flex gap-2">
              {EMOTIONS.map(({ key, emoji, label }) => (
                <button
                  key={key}
                  onClick={() => setEmotion(emotion === key ? null : key)}
                  title={label}
                  className={cn(
                    'flex-1 py-3 rounded-md text-2xl transition-all border',
                    emotion === key
                      ? 'bg-[var(--accent-primary)]/15 border-[var(--accent-primary)] scale-105'
                      : 'bg-transparent border-[var(--border-primary)] hover:bg-[var(--bg-tertiary)] grayscale hover:grayscale-0'
                  )}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex gap-2 pt-2">
            {onCancel && (
              <Button
                variant="secondary"
                onClick={onCancel}
                className="flex-1"
                disabled={submitting}
              >
                Cancel
              </Button>
            )}
            <Button
              variant="primary"
              onClick={handleSubmit}
              disabled={!symbol || result === null || submitting}
              loading={submitting}
              icon={<Check className="w-4 h-4" />}
              className="flex-1"
            >
              Save Trade
            </Button>
          </div>

          {/* Keyboard shortcuts hint */}
          <p className="text-xs text-[var(--text-tertiary)] text-center">
            Press <kbd className="px-1.5 py-0.5 bg-[var(--bg-tertiary)] rounded text-[var(--text-secondary)]">Enter</kbd> to save, <kbd className="px-1.5 py-0.5 bg-[var(--bg-tertiary)] rounded text-[var(--text-secondary)]">Esc</kbd> to cancel
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default QuickTradeEntry;
