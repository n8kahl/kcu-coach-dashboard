'use client';

import { useState, useEffect } from 'react';
import { Header } from '@/components/layout/header';
import { PageShell, PageSection } from '@/components/layout/page-shell';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatsOverview } from '@/components/dashboard/stats-overview';
import { TradeJournalTable } from '@/components/dashboard/trade-journal-table';
import { TradeWinCard } from '@/components/cards/win-card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Plus, Download, Loader2 } from 'lucide-react';
import type { TradeEntry, TradeStats } from '@/types';

// Default empty stats for loading state
const emptyStats: TradeStats = {
  total_trades: 0,
  winning_trades: 0,
  losing_trades: 0,
  win_rate: 0,
  total_pnl: 0,
  average_win: 0,
  average_loss: 0,
  profit_factor: 0,
  largest_win: 0,
  largest_loss: 0,
  average_hold_time: 0,
  best_setup: '-',
  worst_setup: '-',
};

export default function JournalPage() {
  const [selectedTrade, setSelectedTrade] = useState<TradeEntry | null>(null);
  const [showWinCard, setShowWinCard] = useState(false);
  const [showTradeForm, setShowTradeForm] = useState(false);
  const [trades, setTrades] = useState<TradeEntry[]>([]);
  const [stats, setStats] = useState<TradeStats>(emptyStats);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch trades and stats from API
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        // Fetch trades and stats in parallel
        const [tradesRes, statsRes] = await Promise.all([
          fetch('/api/trades'),
          fetch('/api/trades/stats'),
        ]);

        if (!tradesRes.ok) {
          throw new Error('Failed to fetch trades');
        }
        if (!statsRes.ok) {
          throw new Error('Failed to fetch stats');
        }

        const tradesData = await tradesRes.json();
        const statsData = await statsRes.json();

        setTrades(tradesData.trades || []);
        setStats(statsData.stats || emptyStats);
      } catch (err) {
        console.error('Error fetching journal data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const handleShareTrade = (trade: TradeEntry) => {
    setSelectedTrade(trade);
    setShowWinCard(true);
  };

  return (
    <>
      <Header
        title="Trade Journal"
        subtitle="Track your trades and LTP compliance"
        breadcrumbs={[{ label: 'Dashboard' }, { label: 'Journal' }]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={<Download className="w-4 h-4" />}
              onClick={() => {
                // Export trades as CSV
                if (trades.length === 0) return;
                const headers = ['Date', 'Symbol', 'Direction', 'Entry', 'Exit', 'P&L', 'LTP Grade'];
                const rows = trades.map(t => [
                  new Date(t.entry_time).toLocaleDateString(),
                  t.symbol,
                  t.direction,
                  t.entry_price,
                  t.exit_price || '',
                  t.pnl || 0,
                  t.ltp_score?.overall || 'N/A'
                ]);
                const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
                const blob = new Blob([csv], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `trades-${new Date().toISOString().split('T')[0]}.csv`;
                a.click();
              }}
            >
              Export
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<Plus className="w-4 h-4" />}
              onClick={() => setShowTradeForm(true)}
            >
              Log Trade
            </Button>
          </div>
        }
      />

      <PageShell>
        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--accent-primary)]" />
            <span className="ml-3 text-[var(--text-secondary)]">Loading trades...</span>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <Card className="border-[var(--loss)]">
            <CardContent>
              <p className="text-[var(--loss)] text-center py-4">{error}</p>
              <div className="flex justify-center">
                <Button variant="secondary" onClick={() => window.location.reload()}>
                  Retry
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Content */}
        {!loading && !error && (
          <Tabs defaultValue="trades">
            <TabsList variant="underline">
              <TabsTrigger value="trades" variant="underline">All Trades ({trades.length})</TabsTrigger>
              <TabsTrigger value="stats" variant="underline">Statistics</TabsTrigger>
              <TabsTrigger value="insights" variant="underline">Insights</TabsTrigger>
            </TabsList>

            <TabsContent value="trades">
              {trades.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-12">
                    <p className="text-[var(--text-tertiary)] mb-4">No trades logged yet</p>
                    <Button
                      variant="primary"
                      icon={<Plus className="w-4 h-4" />}
                      onClick={() => setShowTradeForm(true)}
                    >
                      Log Your First Trade
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <TradeJournalTable
                  trades={trades}
                  onShareTrade={handleShareTrade}
                />
              )}
            </TabsContent>

            <TabsContent value="stats">
              <StatsOverview stats={stats} />
            </TabsContent>

          <TabsContent value="insights">
            <PageSection title="AI Insights" description="Pattern analysis from your trading">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader title="Strengths" />
                  <CardContent>
                    <ul className="space-y-2 text-sm text-[var(--text-secondary)]">
                      <li className="flex items-start gap-2">
                        <span className="text-[var(--profit)]">✓</span>
                        Strong LTP compliance on winning trades (85% had all 3 components)
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-[var(--profit)]">✓</span>
                        Best performance during morning session (10-11:30 AM)
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-[var(--profit)]">✓</span>
                        NVDA trades showing highest win rate (78%)
                      </li>
                    </ul>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader title="Areas for Improvement" />
                  <CardContent>
                    <ul className="space-y-2 text-sm text-[var(--text-secondary)]">
                      <li className="flex items-start gap-2">
                        <span className="text-[var(--warning)]">!</span>
                        Losses often occur after lunch (lower volume period)
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-[var(--warning)]">!</span>
                        Patience candle missing on 40% of losing trades
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-[var(--warning)]">!</span>
                        Consider reducing position size on counter-trend trades
                      </li>
                    </ul>
                  </CardContent>
                </Card>

                <Card className="md:col-span-2">
                  <CardHeader title="Recommended Focus" />
                  <CardContent>
                    <p className="text-sm text-[var(--text-secondary)]">
                      Based on your recent trades, focusing on <span className="text-[var(--accent-primary)] font-semibold">waiting for patience candles</span> could improve your win rate by an estimated 8-12%. Your entries at key levels are solid, but premature entries without confirmation are your biggest leak.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </PageSection>
            </TabsContent>
          </Tabs>
        )}

        {/* Win Card Modal */}
        {showWinCard && selectedTrade && (selectedTrade.pnl ?? 0) > 0 && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
            <div className="relative">
              <button
                onClick={() => setShowWinCard(false)}
                className="absolute -top-4 -right-4 w-8 h-8 bg-[var(--bg-card)] border border-[var(--border-primary)] flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
              >
                ×
              </button>
              <TradeWinCard
                symbol={selectedTrade.symbol}
                direction={selectedTrade.direction}
                entryPrice={selectedTrade.entry_price}
                exitPrice={selectedTrade.exit_price ?? selectedTrade.entry_price}
                pnl={selectedTrade.pnl ?? 0}
                pnlPercent={selectedTrade.pnl_percent ?? 0}
                ltpGrade={selectedTrade.ltp_score ? (selectedTrade.ltp_score.overall >= 8 ? 'A' : selectedTrade.ltp_score.overall >= 6 ? 'B' : 'C') : 'N/A'}
                username="TraderJoe"
              />
            </div>
          </div>
        )}

        {/* Trade Form Modal */}
        {showTradeForm && (
          <TradeFormModal
            onClose={() => setShowTradeForm(false)}
            onSubmit={async (trade) => {
              try {
                const res = await fetch('/api/trades', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(trade),
                });
                if (!res.ok) throw new Error('Failed to save trade');
                const { trade: newTrade } = await res.json();
                setTrades(prev => [newTrade, ...prev]);
                setShowTradeForm(false);
              } catch (err) {
                console.error('Error saving trade:', err);
                alert('Failed to save trade. Please try again.');
              }
            }}
          />
        )}
      </PageShell>
    </>
  );
}

// Trade Form Modal Component
function TradeFormModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (trade: Partial<TradeEntry>) => Promise<void>;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    symbol: 'SPY',
    direction: 'long' as 'long' | 'short',
    entry_price: '',
    exit_price: '',
    quantity: '1',
    entry_time: new Date().toISOString().slice(0, 16),
    exit_time: new Date().toISOString().slice(0, 16),
    setup_type: 'breakout',
    had_level: false,
    had_trend: false,
    had_patience_candle: false,
    followed_rules: false,
    notes: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const entryPrice = parseFloat(formData.entry_price);
    const exitPrice = parseFloat(formData.exit_price);
    const quantity = parseInt(formData.quantity);

    const pnl = formData.direction === 'long'
      ? (exitPrice - entryPrice) * quantity
      : (entryPrice - exitPrice) * quantity;
    const pnlPercent = ((exitPrice - entryPrice) / entryPrice) * 100 * (formData.direction === 'long' ? 1 : -1);

    await onSubmit({
      symbol: formData.symbol,
      direction: formData.direction,
      entry_price: entryPrice,
      exit_price: exitPrice,
      quantity,
      entry_time: formData.entry_time,
      exit_time: formData.exit_time,
      setup_type: formData.setup_type,
      notes: formData.notes,
      pnl,
      pnl_percent: pnlPercent,
    });

    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <CardHeader title="Log Trade" />
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Symbol & Direction */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Symbol</label>
                <input
                  type="text"
                  value={formData.symbol}
                  onChange={(e) => setFormData(p => ({ ...p, symbol: e.target.value.toUpperCase() }))}
                  className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] focus:border-[var(--accent-primary)] outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Direction</label>
                <select
                  value={formData.direction}
                  onChange={(e) => setFormData(p => ({ ...p, direction: e.target.value as 'long' | 'short' }))}
                  className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] focus:border-[var(--accent-primary)] outline-none"
                >
                  <option value="long">Long</option>
                  <option value="short">Short</option>
                </select>
              </div>
            </div>

            {/* Prices */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Entry Price</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.entry_price}
                  onChange={(e) => setFormData(p => ({ ...p, entry_price: e.target.value }))}
                  className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] focus:border-[var(--accent-primary)] outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Exit Price</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.exit_price}
                  onChange={(e) => setFormData(p => ({ ...p, exit_price: e.target.value }))}
                  className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] focus:border-[var(--accent-primary)] outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Quantity</label>
                <input
                  type="number"
                  value={formData.quantity}
                  onChange={(e) => setFormData(p => ({ ...p, quantity: e.target.value }))}
                  className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] focus:border-[var(--accent-primary)] outline-none"
                  required
                />
              </div>
            </div>

            {/* LTP Checklist */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">LTP Checklist</label>
              <div className="space-y-2">
                {[
                  { key: 'had_level', label: 'Had a key level (support/resistance)' },
                  { key: 'had_trend', label: 'Traded with the trend' },
                  { key: 'had_patience_candle', label: 'Waited for patience candle' },
                  { key: 'followed_rules', label: 'Followed all trading rules' },
                ].map(item => (
                  <label key={item.key} className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                    <input
                      type="checkbox"
                      checked={formData[item.key as keyof typeof formData] as boolean}
                      onChange={(e) => setFormData(p => ({ ...p, [item.key]: e.target.checked }))}
                      className="w-4 h-4 accent-[var(--accent-primary)]"
                    />
                    {item.label}
                  </label>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData(p => ({ ...p, notes: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] focus:border-[var(--accent-primary)] outline-none resize-none"
                placeholder="What did you learn from this trade?"
              />
            </div>

            {/* Buttons */}
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
                Cancel
              </Button>
              <Button type="submit" variant="primary" className="flex-1" disabled={submitting}>
                {submitting ? 'Saving...' : 'Save Trade'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
