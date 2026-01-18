'use client';

import { useState } from 'react';
import { Header } from '@/components/layout/header';
import { PageShell, PageSection } from '@/components/layout/page-shell';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatsOverview } from '@/components/dashboard/stats-overview';
import { TradeJournalTable } from '@/components/dashboard/trade-journal-table';
import { TradeWinCard } from '@/components/cards/win-card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Plus, Download, Filter } from 'lucide-react';
import type { TradeEntry, TradeStats } from '@/types';

// Mock trades
const mockTrades: TradeEntry[] = [
  {
    id: '1',
    user_id: 'current',
    symbol: 'NVDA',
    direction: 'long',
    entry_price: 890.50,
    exit_price: 920.00,
    quantity: 10,
    entry_time: '2024-01-16T10:30:00Z',
    exit_time: '2024-01-16T14:15:00Z',
    pnl: 295.00,
    pnl_percent: 3.31,
    had_level: true,
    had_trend: true,
    had_patience_candle: true,
    ltp_grade: 'A',
    is_options: false,
    setup_notes: 'Bounced off PDH with strong volume',
    exit_notes: 'Took profit at resistance',
    emotions: 'Confident, disciplined',
    created_at: '2024-01-16T14:15:00Z',
  },
  {
    id: '2',
    user_id: 'current',
    symbol: 'SPY',
    direction: 'short',
    entry_price: 462.30,
    exit_price: 458.50,
    quantity: 50,
    entry_time: '2024-01-15T09:45:00Z',
    exit_time: '2024-01-15T11:30:00Z',
    pnl: 190.00,
    pnl_percent: 0.82,
    had_level: true,
    had_trend: false,
    had_patience_candle: true,
    ltp_grade: 'B',
    is_options: true,
    option_type: 'put',
    strike_price: 460,
    expiration: '2024-01-19',
    setup_notes: 'Rejection at VWAP',
    emotions: 'Slightly anxious at entry',
    created_at: '2024-01-15T11:30:00Z',
  },
  {
    id: '3',
    user_id: 'current',
    symbol: 'TSLA',
    direction: 'long',
    entry_price: 215.00,
    exit_price: 210.50,
    quantity: 20,
    entry_time: '2024-01-14T13:00:00Z',
    exit_time: '2024-01-14T15:45:00Z',
    pnl: -90.00,
    pnl_percent: -2.09,
    had_level: false,
    had_trend: true,
    had_patience_candle: false,
    ltp_grade: 'D',
    is_options: false,
    setup_notes: 'FOMO entry, no clear level',
    exit_notes: 'Cut loss at stop',
    emotions: 'Frustrated, chased the move',
    created_at: '2024-01-14T15:45:00Z',
  },
];

const mockStats: TradeStats = {
  totalTrades: 142,
  winningTrades: 89,
  losingTrades: 53,
  winRate: 62.7,
  totalPnL: 4823.50,
  avgWin: 127.30,
  avgLoss: -78.45,
  profitFactor: 1.82,
  largestWin: 892.00,
  largestLoss: -345.00,
  currentStreak: 5,
  bestStreak: 12,
  avgLTPGrade: 'B+',
};

export default function JournalPage() {
  const [selectedTrade, setSelectedTrade] = useState<TradeEntry | null>(null);
  const [showWinCard, setShowWinCard] = useState(false);

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
        <Tabs defaultValue="trades">
          <TabsList variant="underline">
            <TabsTrigger value="trades" variant="underline">All Trades</TabsTrigger>
            <TabsTrigger value="stats" variant="underline">Statistics</TabsTrigger>
            <TabsTrigger value="insights" variant="underline">Insights</TabsTrigger>
          </TabsList>

          <TabsContent value="trades">
            <TradeJournalTable
              trades={mockTrades}
              onShareTrade={handleShareTrade}
            />
          </TabsContent>

          <TabsContent value="stats">
            <StatsOverview stats={mockStats} />
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

        {/* Win Card Modal */}
        {showWinCard && selectedTrade && selectedTrade.pnl > 0 && (
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
                exitPrice={selectedTrade.exit_price}
                pnl={selectedTrade.pnl}
                pnlPercent={selectedTrade.pnl_percent}
                ltpGrade={selectedTrade.ltp_grade}
                username="TraderJoe"
              />
            </div>
          </div>
        )}
      </PageShell>
    </>
  );
}
