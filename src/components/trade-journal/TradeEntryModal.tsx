'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScreenshotAnalyzer } from './ScreenshotAnalyzer';
import { QuickTradeEntry } from './QuickTradeEntry';
import {
  X,
  Zap,
  FileText,
  Camera,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  Loader2,
} from 'lucide-react';
import type { TradeEntry } from '@/types';
import type { ScreenshotAnalysisResult } from '@/app/api/trades/analyze-screenshot/route';

interface TradeEntryModalProps {
  onClose: () => void;
  onSubmit: (trade: Partial<TradeEntry>) => Promise<void>;
  recentSymbols?: string[];
}

type EntryMode = 'quick' | 'full';

// Setup type options
const SETUP_TYPES = [
  'Breakout',
  'Pullback',
  'Reversal',
  'Continuation',
  'Scalp',
  'Gap Fill',
  'ORB',
  'VWAP Bounce',
  'Level Hold',
  'Other',
];

export function TradeEntryModal({
  onClose,
  onSubmit,
  recentSymbols = [],
}: TradeEntryModalProps) {
  const [entryMode, setEntryMode] = useState<EntryMode>('full');
  const [submitting, setSubmitting] = useState(false);
  const [showScreenshotAnalyzer, setShowScreenshotAnalyzer] = useState(false);
  const [screenshotData, setScreenshotData] = useState<string | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<ScreenshotAnalysisResult | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Form state for full entry mode
  const [formData, setFormData] = useState({
    symbol: 'SPY',
    direction: 'long' as 'long' | 'short',
    entry_price: '',
    exit_price: '',
    quantity: '1',
    entry_time: new Date().toISOString().slice(0, 16),
    exit_time: new Date().toISOString().slice(0, 16),
    setup_type: 'Breakout',
    had_level: false,
    had_trend: false,
    had_patience_candle: false,
    followed_rules: false,
    notes: '',
    // New fields
    emotions: '',
  });

  // Fetch recent symbols on mount
  useEffect(() => {
    async function fetchRecentSymbols() {
      try {
        const res = await fetch('/api/trades?limit=20');
        if (res.ok) {
          const data = await res.json();
          // Extract unique symbols from recent trades
          const symbols = Array.from(new Set(data.trades?.map((t: TradeEntry) => t.symbol) || []));
          // Update recentSymbols if needed
        }
      } catch (err) {
        console.error('Failed to fetch recent symbols:', err);
      }
    }
    fetchRecentSymbols();
  }, []);

  // Handle keyboard shortcut to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Apply AI analysis to form
  const handleApplyAnalysis = useCallback((analysis: ScreenshotAnalysisResult) => {
    setFormData(prev => ({
      ...prev,
      symbol: analysis.symbol || prev.symbol,
      direction: analysis.suggestedDirection || prev.direction,
      setup_type: analysis.setupType !== 'Unknown' ? analysis.setupType : prev.setup_type,
      had_level: analysis.ltpAssessment.level.compliant,
      had_trend: analysis.ltpAssessment.trend.compliant,
      had_patience_candle: analysis.ltpAssessment.patience.compliant,
      notes: prev.notes
        ? `${prev.notes}\n\n--- AI Analysis ---\n${analysis.analysis}`
        : `AI Analysis: ${analysis.analysis}`,
      entry_price: analysis.entryPrice?.toString() || prev.entry_price,
    }));
    setAiAnalysis(analysis);
    setShowScreenshotAnalyzer(false);
  }, []);

  // Handle screenshot analysis complete
  const handleAnalysisComplete = useCallback((analysis: ScreenshotAnalysisResult, imageData: string) => {
    setScreenshotData(imageData);
    setAiAnalysis(analysis);
  }, []);

  // Handle full form submission
  const handleFullSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const entryPrice = parseFloat(formData.entry_price);
    const exitPrice = parseFloat(formData.exit_price);
    const quantity = parseInt(formData.quantity);

    const pnl = formData.direction === 'long'
      ? (exitPrice - entryPrice) * quantity
      : (entryPrice - exitPrice) * quantity;
    const pnlPercent = ((exitPrice - entryPrice) / entryPrice) * 100 * (formData.direction === 'long' ? 1 : -1);

    const trade: Partial<TradeEntry> = {
      symbol: formData.symbol.toUpperCase(),
      direction: formData.direction,
      entry_price: entryPrice,
      exit_price: exitPrice,
      shares: quantity,
      entry_time: formData.entry_time,
      exit_time: formData.exit_time,
      setup_type: formData.setup_type,
      notes: formData.notes,
      pnl,
      pnl_percent: pnlPercent,
      had_level: formData.had_level,
      had_trend: formData.had_trend,
      had_patience_candle: formData.had_patience_candle,
      followed_rules: formData.followed_rules,
      emotions: formData.emotions || 'neutral',
      entry_mode: 'full' as const,
      // Include screenshot and AI analysis if available
      ...(screenshotData && { chart_screenshot: screenshotData }),
      ...(aiAnalysis && { ai_analysis: aiAnalysis }),
    };

    try {
      await onSubmit(trade);
      onClose();
    } catch (err) {
      console.error('Error saving trade:', err);
    } finally {
      setSubmitting(false);
    }
  }, [formData, screenshotData, aiAnalysis, onSubmit, onClose]);

  // Handle quick entry submission
  const handleQuickSubmit = useCallback(async (trade: Partial<TradeEntry>) => {
    await onSubmit(trade);
  }, [onSubmit]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="w-full max-w-2xl max-h-[90vh] overflow-hidden"
      >
        <Card className="overflow-hidden">
          {/* Header with mode toggle */}
          <div className="flex items-center justify-between p-4 border-b border-[var(--border-primary)]">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-bold text-[var(--text-primary)]">Log Trade</h2>

              {/* Entry mode toggle */}
              <div className="flex rounded-md border border-[var(--border-primary)] overflow-hidden">
                <button
                  onClick={() => setEntryMode('quick')}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors',
                    entryMode === 'quick'
                      ? 'bg-[var(--accent-primary)] text-[var(--bg-primary)]'
                      : 'bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                  )}
                >
                  <Zap className="w-3.5 h-3.5" />
                  Quick
                </button>
                <button
                  onClick={() => setEntryMode('full')}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors',
                    entryMode === 'full'
                      ? 'bg-[var(--accent-primary)] text-[var(--bg-primary)]'
                      : 'bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                  )}
                >
                  <FileText className="w-3.5 h-3.5" />
                  Full
                </button>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content area - scrollable */}
          <div className="max-h-[calc(90vh-80px)] overflow-y-auto">
            <AnimatePresence mode="wait">
              {/* Quick Entry Mode */}
              {entryMode === 'quick' && (
                <motion.div
                  key="quick"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="p-4"
                >
                  <QuickTradeEntry
                    onSubmit={handleQuickSubmit}
                    onCancel={onClose}
                    recentSymbols={recentSymbols}
                    className="border-0 shadow-none"
                  />
                </motion.div>
              )}

              {/* Full Entry Mode */}
              {entryMode === 'full' && (
                <motion.div
                  key="full"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="p-4"
                >
                  {/* Screenshot Analyzer Toggle */}
                  <div className="mb-4">
                    <Button
                      variant={showScreenshotAnalyzer ? 'primary' : 'secondary'}
                      size="sm"
                      onClick={() => setShowScreenshotAnalyzer(!showScreenshotAnalyzer)}
                      icon={<Camera className="w-4 h-4" />}
                    >
                      {showScreenshotAnalyzer ? 'Hide Screenshot Analyzer' : 'Analyze Chart Screenshot'}
                    </Button>

                    {/* AI Analysis badge */}
                    {aiAnalysis && !showScreenshotAnalyzer && (
                      <Badge variant="success" className="ml-2">
                        AI Analysis Applied
                      </Badge>
                    )}
                  </div>

                  {/* Screenshot Analyzer */}
                  <AnimatePresence>
                    {showScreenshotAnalyzer && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="mb-4 overflow-hidden"
                      >
                        <ScreenshotAnalyzer
                          onAnalysisComplete={handleAnalysisComplete}
                          onApplyToForm={handleApplyAnalysis}
                          className="border-0 shadow-none bg-[var(--bg-tertiary)]"
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Trade Form */}
                  <form onSubmit={handleFullSubmit} className="space-y-4">
                    {/* Symbol & Direction */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide mb-1">
                          Symbol
                        </label>
                        <input
                          type="text"
                          value={formData.symbol}
                          onChange={(e) => setFormData(p => ({ ...p, symbol: e.target.value.toUpperCase() }))}
                          className={cn(
                            'w-full px-3 py-2 text-base font-bold uppercase',
                            'bg-[var(--bg-tertiary)] border border-[var(--border-primary)]',
                            'text-[var(--text-primary)] focus:border-[var(--accent-primary)] outline-none rounded-md'
                          )}
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide mb-1">
                          Direction
                        </label>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setFormData(p => ({ ...p, direction: 'long' }))}
                            className={cn(
                              'flex-1 flex items-center justify-center gap-1 py-2 rounded-md font-medium transition-all border',
                              formData.direction === 'long'
                                ? 'bg-[var(--profit)]/15 border-[var(--profit)] text-[var(--profit)]'
                                : 'bg-transparent border-[var(--border-primary)] text-[var(--text-secondary)]'
                            )}
                          >
                            <TrendingUp className="w-4 h-4" />
                            Long
                          </button>
                          <button
                            type="button"
                            onClick={() => setFormData(p => ({ ...p, direction: 'short' }))}
                            className={cn(
                              'flex-1 flex items-center justify-center gap-1 py-2 rounded-md font-medium transition-all border',
                              formData.direction === 'short'
                                ? 'bg-[var(--loss)]/15 border-[var(--loss)] text-[var(--loss)]'
                                : 'bg-transparent border-[var(--border-primary)] text-[var(--text-secondary)]'
                            )}
                          >
                            <TrendingDown className="w-4 h-4" />
                            Short
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Prices */}
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide mb-1">
                          Entry Price
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={formData.entry_price}
                          onChange={(e) => setFormData(p => ({ ...p, entry_price: e.target.value }))}
                          className={cn(
                            'w-full px-3 py-2 font-mono',
                            'bg-[var(--bg-tertiary)] border border-[var(--border-primary)]',
                            'text-[var(--text-primary)] focus:border-[var(--accent-primary)] outline-none rounded-md'
                          )}
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide mb-1">
                          Exit Price
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={formData.exit_price}
                          onChange={(e) => setFormData(p => ({ ...p, exit_price: e.target.value }))}
                          className={cn(
                            'w-full px-3 py-2 font-mono',
                            'bg-[var(--bg-tertiary)] border border-[var(--border-primary)]',
                            'text-[var(--text-primary)] focus:border-[var(--accent-primary)] outline-none rounded-md'
                          )}
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide mb-1">
                          Quantity
                        </label>
                        <input
                          type="number"
                          value={formData.quantity}
                          onChange={(e) => setFormData(p => ({ ...p, quantity: e.target.value }))}
                          className={cn(
                            'w-full px-3 py-2 font-mono',
                            'bg-[var(--bg-tertiary)] border border-[var(--border-primary)]',
                            'text-[var(--text-primary)] focus:border-[var(--accent-primary)] outline-none rounded-md'
                          )}
                          required
                        />
                      </div>
                    </div>

                    {/* Setup Type */}
                    <div>
                      <label className="block text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide mb-1">
                        Setup Type
                      </label>
                      <select
                        value={formData.setup_type}
                        onChange={(e) => setFormData(p => ({ ...p, setup_type: e.target.value }))}
                        className={cn(
                          'w-full px-3 py-2',
                          'bg-[var(--bg-tertiary)] border border-[var(--border-primary)]',
                          'text-[var(--text-primary)] focus:border-[var(--accent-primary)] outline-none rounded-md'
                        )}
                      >
                        {SETUP_TYPES.map(type => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </div>

                    {/* LTP Checklist */}
                    <div className="p-4 rounded-lg bg-[var(--bg-tertiary)]">
                      <label className="block text-xs font-medium text-[var(--text-primary)] uppercase tracking-wide mb-3">
                        LTP Compliance Checklist
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { key: 'had_level', label: 'Had Key Level', hint: 'Support/Resistance' },
                          { key: 'had_trend', label: 'With Trend', hint: 'Aligned with HTF' },
                          { key: 'had_patience_candle', label: 'Patience Candle', hint: 'Waited for confirmation' },
                          { key: 'followed_rules', label: 'Followed Rules', hint: 'Stuck to plan' },
                        ].map(item => (
                          <label
                            key={item.key}
                            className={cn(
                              'flex items-center gap-3 p-3 rounded-md border cursor-pointer transition-all',
                              formData[item.key as keyof typeof formData]
                                ? 'bg-[var(--profit)]/10 border-[var(--profit)]'
                                : 'bg-transparent border-[var(--border-primary)] hover:border-[var(--border-secondary)]'
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={formData[item.key as keyof typeof formData] as boolean}
                              onChange={(e) => setFormData(p => ({ ...p, [item.key]: e.target.checked }))}
                              className="w-4 h-4 accent-[var(--profit)]"
                            />
                            <div>
                              <span className="text-sm font-medium text-[var(--text-primary)]">{item.label}</span>
                              <p className="text-xs text-[var(--text-tertiary)]">{item.hint}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Advanced Options Toggle */}
                    <button
                      type="button"
                      onClick={() => setShowAdvanced(!showAdvanced)}
                      className="flex items-center gap-1 text-sm text-[var(--accent-primary)] hover:underline"
                    >
                      {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      {showAdvanced ? 'Hide' : 'Show'} Advanced Options
                    </button>

                    {/* Advanced Options */}
                    <AnimatePresence>
                      {showAdvanced && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="space-y-4 overflow-hidden"
                        >
                          {/* Times */}
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide mb-1">
                                Entry Time
                              </label>
                              <input
                                type="datetime-local"
                                value={formData.entry_time}
                                onChange={(e) => setFormData(p => ({ ...p, entry_time: e.target.value }))}
                                className={cn(
                                  'w-full px-3 py-2',
                                  'bg-[var(--bg-tertiary)] border border-[var(--border-primary)]',
                                  'text-[var(--text-primary)] focus:border-[var(--accent-primary)] outline-none rounded-md'
                                )}
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide mb-1">
                                Exit Time
                              </label>
                              <input
                                type="datetime-local"
                                value={formData.exit_time}
                                onChange={(e) => setFormData(p => ({ ...p, exit_time: e.target.value }))}
                                className={cn(
                                  'w-full px-3 py-2',
                                  'bg-[var(--bg-tertiary)] border border-[var(--border-primary)]',
                                  'text-[var(--text-primary)] focus:border-[var(--accent-primary)] outline-none rounded-md'
                                )}
                              />
                            </div>
                          </div>

                          {/* Emotion */}
                          <div>
                            <label className="block text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide mb-1">
                              Emotion During Trade
                            </label>
                            <select
                              value={formData.emotions}
                              onChange={(e) => setFormData(p => ({ ...p, emotions: e.target.value }))}
                              className={cn(
                                'w-full px-3 py-2',
                                'bg-[var(--bg-tertiary)] border border-[var(--border-primary)]',
                                'text-[var(--text-primary)] focus:border-[var(--accent-primary)] outline-none rounded-md'
                              )}
                            >
                              <option value="">Select emotion...</option>
                              <option value="confident">Confident</option>
                              <option value="calm">Calm</option>
                              <option value="anxious">Anxious</option>
                              <option value="fomo">FOMO</option>
                              <option value="frustrated">Frustrated</option>
                              <option value="revenge">Revenge Trading</option>
                              <option value="bored">Bored</option>
                              <option value="neutral">Neutral</option>
                            </select>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Notes */}
                    <div>
                      <label className="block text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide mb-1">
                        Notes
                      </label>
                      <textarea
                        value={formData.notes}
                        onChange={(e) => setFormData(p => ({ ...p, notes: e.target.value }))}
                        rows={3}
                        className={cn(
                          'w-full px-3 py-2',
                          'bg-[var(--bg-tertiary)] border border-[var(--border-primary)]',
                          'text-[var(--text-primary)] focus:border-[var(--accent-primary)] outline-none rounded-md resize-none'
                        )}
                        placeholder="What did you learn from this trade?"
                      />
                    </div>

                    {/* P&L Preview */}
                    {formData.entry_price && formData.exit_price && (
                      <div className="p-3 rounded-lg bg-[var(--bg-tertiary)]">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-[var(--text-secondary)]">Estimated P&L:</span>
                          {(() => {
                            const entry = parseFloat(formData.entry_price);
                            const exit = parseFloat(formData.exit_price);
                            const qty = parseInt(formData.quantity) || 1;
                            const pnl = formData.direction === 'long'
                              ? (exit - entry) * qty
                              : (entry - exit) * qty;
                            const pnlPercent = ((exit - entry) / entry) * 100 * (formData.direction === 'long' ? 1 : -1);

                            return (
                              <span className={cn(
                                'text-lg font-bold font-mono',
                                pnl >= 0 ? 'text-[var(--profit)]' : 'text-[var(--loss)]'
                              )}>
                                {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)} ({pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%)
                              </span>
                            );
                          })()}
                        </div>
                      </div>
                    )}

                    {/* Submit Buttons */}
                    <div className="flex gap-3 pt-2">
                      <Button type="button" variant="secondary" onClick={onClose} className="flex-1" disabled={submitting}>
                        Cancel
                      </Button>
                      <Button type="submit" variant="primary" className="flex-1" loading={submitting}>
                        Save Trade
                      </Button>
                    </div>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}

export default TradeEntryModal;
