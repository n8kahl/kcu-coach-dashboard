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
            <Button variant="secondary" size="sm" icon={<Download className="w-4 h-4" />}>
              Export
            </Button>
            <Button variant="primary" size="sm" icon={<Plus className="w-4 h-4" />}>
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
                    <Button variant="primary" icon={<Plus className="w-4 h-4" />}>
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
      </PageShell>
    </>
  );
}
