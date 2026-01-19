'use client';

import { useState, useEffect } from 'react';
import { Header } from '@/components/layout/header';
import { PageShell, PageSection } from '@/components/layout/page-shell';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatsOverview } from '@/components/dashboard/stats-overview';
import { TradeJournalTable } from '@/components/dashboard/trade-journal-table';
import { TradeWinCard } from '@/components/cards/win-card';
import { TradeEntryModal } from '@/components/trade-journal';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/toast';
import { Plus, Download, Loader2 } from 'lucide-react';
import type { TradeEntry, TradeStats } from '@/types';
import { usePageContext, useAIContext } from '@/components/ai';

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
  const { showToast } = useToast();
  const [selectedTrade, setSelectedTrade] = useState<TradeEntry | null>(null);
  const [showWinCard, setShowWinCard] = useState(false);
  const [showTradeForm, setShowTradeForm] = useState(false);
  const [trades, setTrades] = useState<TradeEntry[]>([]);
  const [stats, setStats] = useState<TradeStats>(emptyStats);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // AI Context - update page context and track selected trade
  const { setSelectedTrade: setAISelectedTrade } = useAIContext();
  usePageContext();

  // Sync selected trade with AI context
  useEffect(() => {
    setAISelectedTrade(selectedTrade || undefined);
  }, [selectedTrade, setAISelectedTrade]);

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
                  // Use ltp_grade (API format) or fall back to ltp_score (legacy)
                  t.ltp_grade?.grade || (t.ltp_score ? (t.ltp_score.overall >= 8 ? 'A' : t.ltp_score.overall >= 6 ? 'B' : 'C') : 'N/A')
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
            <AIInsightsSection trades={trades} stats={stats} />
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
                ltpGrade={selectedTrade.ltp_grade?.grade || (selectedTrade.ltp_score ? (selectedTrade.ltp_score.overall >= 8 ? 'A' : selectedTrade.ltp_score.overall >= 6 ? 'B' : 'C') : 'N/A')}
                username="TraderJoe"
              />
            </div>
          </div>
        )}

        {/* Trade Form Modal */}
        {showTradeForm && (
          <TradeEntryModal
            onClose={() => setShowTradeForm(false)}
            recentSymbols={Array.from(new Set(trades.slice(0, 10).map(t => t.symbol)))}
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
                showToast({
                  type: 'success',
                  title: 'Trade Logged',
                  message: `${trade.symbol} trade has been saved`,
                });
              } catch (err) {
                console.error('Error saving trade:', err);
                showToast({
                  type: 'error',
                  title: 'Save Failed',
                  message: 'Failed to save trade. Please try again.',
                });
              }
            }}
          />
        )}
      </PageShell>
    </>
  );
}

// AI Insights Section Component
function AIInsightsSection({
  trades,
  stats,
}: {
  trades: TradeEntry[];
  stats: TradeStats;
}) {
  // Generate dynamic insights based on actual trade data
  const generateInsights = () => {
    const strengths: string[] = [];
    const improvements: string[] = [];
    let recommendation = '';

    if (trades.length === 0) {
      return {
        strengths: ['Start logging trades to see your strengths'],
        improvements: ['Log at least 5 trades to get personalized insights'],
        recommendation: 'Begin by logging your trades to receive AI-powered analysis of your trading patterns.',
      };
    }

    // Analyze win rate
    if (stats.win_rate >= 60) {
      strengths.push(`Strong win rate of ${stats.win_rate.toFixed(0)}% - above the 50% breakeven threshold`);
    } else if (stats.win_rate < 50) {
      improvements.push(`Win rate of ${stats.win_rate.toFixed(0)}% is below breakeven - focus on trade selection`);
    }

    // Analyze profit factor
    if (stats.profit_factor >= 1.5) {
      strengths.push(`Excellent profit factor of ${stats.profit_factor.toFixed(2)} - your winners outpace your losers`);
    } else if (stats.profit_factor < 1) {
      improvements.push('Profit factor below 1.0 - consider tightening stop losses or letting winners run');
    }

    // Analyze trade volume and patterns
    const winningTrades = trades.filter((t) => (t.pnl ?? 0) > 0);
    const losingTrades = trades.filter((t) => (t.pnl ?? 0) < 0);

    // Analyze LTP compliance on winners vs losers
    // Helper to get LTP score (0-100) from either ltp_grade or legacy ltp_score
    const getLtpScore = (t: TradeEntry) => {
      if (t.ltp_grade?.score !== undefined) return t.ltp_grade.score;
      if (t.ltp_score?.overall !== undefined) return t.ltp_score.overall * 10; // Convert 0-10 to 0-100
      return null;
    };

    const winnersWithLTP = winningTrades.filter((t) => {
      const score = getLtpScore(t);
      return score !== null && score >= 70; // 70% = B grade or better
    });
    const losersWithLTP = losingTrades.filter((t) => {
      const score = getLtpScore(t);
      return score !== null && score >= 70;
    });

    if (winningTrades.length > 0 && winnersWithLTP.length / winningTrades.length > 0.6) {
      const ltpWinRate = Math.round((winnersWithLTP.length / winningTrades.length) * 100);
      strengths.push(`${ltpWinRate}% of your winning trades had strong LTP compliance`);
    }

    if (losingTrades.length > 0) {
      const losersWithoutLTP = losingTrades.filter((t) => {
        const score = getLtpScore(t);
        return score === null || score < 50; // Below 50% = C grade or worse
      });
      if (losersWithoutLTP.length / losingTrades.length > 0.5) {
        const noLTPRate = Math.round((losersWithoutLTP.length / losingTrades.length) * 100);
        improvements.push(`${noLTPRate}% of losing trades lacked LTP confirmation - wait for proper setups`);
      }
    }

    // Analyze by symbol
    const symbolStats: Record<string, { wins: number; losses: number; pnl: number }> = {};
    trades.forEach((t) => {
      if (!symbolStats[t.symbol]) {
        symbolStats[t.symbol] = { wins: 0, losses: 0, pnl: 0 };
      }
      if ((t.pnl ?? 0) > 0) symbolStats[t.symbol].wins++;
      else symbolStats[t.symbol].losses++;
      symbolStats[t.symbol].pnl += t.pnl ?? 0;
    });

    const sortedSymbols = Object.entries(symbolStats)
      .filter(([_, s]) => s.wins + s.losses >= 3)
      .sort(([_, a], [__, b]) => {
        const aWinRate = a.wins / (a.wins + a.losses);
        const bWinRate = b.wins / (b.wins + b.losses);
        return bWinRate - aWinRate;
      });

    if (sortedSymbols.length > 0) {
      const [bestSymbol, bestStats] = sortedSymbols[0];
      const winRate = Math.round((bestStats.wins / (bestStats.wins + bestStats.losses)) * 100);
      if (winRate >= 60) {
        strengths.push(`Strong edge in ${bestSymbol} with ${winRate}% win rate`);
      }

      if (sortedSymbols.length > 1) {
        const [worstSymbol, worstStats] = sortedSymbols[sortedSymbols.length - 1];
        const worstWinRate = Math.round((worstStats.wins / (worstStats.wins + worstStats.losses)) * 100);
        if (worstWinRate < 40) {
          improvements.push(`Consider reducing exposure to ${worstSymbol} (${worstWinRate}% win rate)`);
        }
      }
    }

    // Analyze by direction
    const longTrades = trades.filter((t) => t.direction === 'long');
    const shortTrades = trades.filter((t) => t.direction === 'short');

    if (longTrades.length >= 3 && shortTrades.length >= 3) {
      const longWinRate = longTrades.filter((t) => (t.pnl ?? 0) > 0).length / longTrades.length;
      const shortWinRate = shortTrades.filter((t) => (t.pnl ?? 0) > 0).length / shortTrades.length;

      if (longWinRate > shortWinRate + 0.15) {
        strengths.push(`Stronger on longs (${Math.round(longWinRate * 100)}%) than shorts (${Math.round(shortWinRate * 100)}%)`);
        if (shortWinRate < 0.4) {
          improvements.push('Consider being more selective with short setups');
        }
      } else if (shortWinRate > longWinRate + 0.15) {
        strengths.push(`Stronger on shorts (${Math.round(shortWinRate * 100)}%) than longs (${Math.round(longWinRate * 100)}%)`);
      }
    }

    // Analyze average win vs loss
    if (stats.average_win > 0 && stats.average_loss > 0) {
      const rrRatio = stats.average_win / stats.average_loss;
      if (rrRatio >= 1.5) {
        strengths.push(`Good risk/reward ratio of ${rrRatio.toFixed(1)}:1 on average`);
      } else if (rrRatio < 1) {
        improvements.push(`Average win ($${stats.average_win.toFixed(0)}) is smaller than average loss ($${stats.average_loss.toFixed(0)}) - consider wider targets`);
      }
    }

    // Generate recommendation based on analysis
    if (improvements.length === 0) {
      recommendation = 'Your trading is showing strong patterns. Continue following your system and maintain discipline. Consider journaling your mental state for each trade to identify any subtle patterns.';
    } else {
      // Find the most impactful improvement
      if (stats.win_rate < 50) {
        recommendation = 'Focus on trade selection and LTP compliance. Wait for A+ setups with all three components (Level, Trend, Patience) before entering trades.';
      } else if (stats.profit_factor < 1.2) {
        recommendation = 'Your entries are good, but consider letting winners run longer. Review your exit strategy and consider trailing stops on profitable positions.';
      } else {
        recommendation = improvements[0].includes('LTP')
          ? 'Waiting for patience candles could significantly improve your results. The data shows your LTP-compliant trades perform better.'
          : 'Review your recent losing trades and look for common patterns. Focus on the areas for improvement identified above.';
      }
    }

    // Ensure we have at least some insights
    if (strengths.length === 0) {
      strengths.push('You are actively logging your trades - great discipline!');
      if (trades.length >= 5) {
        strengths.push('Building a trade history to analyze patterns');
      }
    }

    if (improvements.length === 0 && trades.length < 10) {
      improvements.push('Log more trades to unlock detailed pattern analysis');
    }

    return { strengths, improvements, recommendation };
  };

  const { strengths, improvements, recommendation } = generateInsights();

  return (
    <PageSection title="AI Insights" description="Pattern analysis from your trading">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Strengths" />
          <CardContent>
            <ul className="space-y-2 text-sm text-[var(--text-secondary)]">
              {strengths.map((strength, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-[var(--profit)] flex-shrink-0">✓</span>
                  {strength}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Areas for Improvement" />
          <CardContent>
            <ul className="space-y-2 text-sm text-[var(--text-secondary)]">
              {improvements.map((improvement, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-[var(--warning)] flex-shrink-0">!</span>
                  {improvement}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader title="Recommended Focus" />
          <CardContent>
            <p className="text-sm text-[var(--text-secondary)]">
              {recommendation}
            </p>
          </CardContent>
        </Card>
      </div>
    </PageSection>
  );
}

