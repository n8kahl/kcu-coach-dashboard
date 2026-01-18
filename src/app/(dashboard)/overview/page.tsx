'use client';

import { Header } from '@/components/layout/header';
import { PageShell, PageSection, Grid } from '@/components/layout/page-shell';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Stat, StatGrid } from '@/components/ui/stat';
import { ProgressBar } from '@/components/ui/progress';
import { StatsOverview } from '@/components/dashboard/stats-overview';
import { MiniLeaderboard } from '@/components/dashboard/leaderboard';
import { FeaturedAchievement } from '@/components/dashboard/achievements';
import { formatCurrency } from '@/lib/utils';
import {
  TrendingUp,
  BookOpen,
  Trophy,
  Flame,
  Target,
  Share2,
  ArrowRight,
} from 'lucide-react';
import type { TradeStats, LeaderboardEntry, Achievement } from '@/types';

// Mock data
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

const mockLeaderboard: LeaderboardEntry[] = [
  { rank: 1, user_id: '1', username: 'PrinterKing', score: 12450, wins: 45, pnl: 8923.50, streak: 8 },
  { rank: 2, user_id: '2', username: 'LTPMaster', score: 10230, wins: 38, pnl: 6543.20, streak: 5 },
  { rank: 3, user_id: '3', username: 'PatienceCandle', score: 9870, wins: 36, pnl: 5234.00, streak: 6 },
  { rank: 4, user_id: 'current', username: 'TraderJoe', score: 8650, wins: 32, pnl: 4823.50, streak: 5 },
  { rank: 5, user_id: '5', username: 'LevelSniper', score: 7890, wins: 29, pnl: 3456.80, streak: 3 },
];

const mockAchievement: Achievement = {
  id: '1',
  type: 'seven_day_streak',
  name: '7-Day Streak',
  description: 'Trade for 7 consecutive days',
  emoji: '🔥',
  earned_at: '2024-01-15T10:30:00Z',
};

export default function OverviewPage() {
  return (
    <>
      <Header
        title="Dashboard"
        subtitle="Welcome back, TraderJoe"
        breadcrumbs={[{ label: 'Dashboard' }, { label: 'Overview' }]}
        actions={
          <Button variant="primary" size="sm" icon={<Share2 className="w-4 h-4" />}>
            Share Progress
          </Button>
        }
      />

      <PageShell>
        {/* Quick Stats */}
        <PageSection>
          <StatGrid columns={4}>
            <Card variant="default" padding="md">
              <Stat
                label="Today's P&L"
                value={formatCurrency(342.50)}
                icon={<TrendingUp className="w-4 h-4" />}
                valueColor="profit"
                change={2.3}
                changeLabel="vs avg"
              />
            </Card>
            <Card variant="default" padding="md">
              <Stat
                label="Win Rate"
                value="62.7%"
                icon={<Target className="w-4 h-4" />}
                valueColor="profit"
                change={5.2}
                changeLabel="this week"
              />
            </Card>
            <Card variant="default" padding="md">
              <Stat
                label="Learning Progress"
                value="68%"
                icon={<BookOpen className="w-4 h-4" />}
                valueColor="gold"
              />
            </Card>
            <Card variant="default" padding="md">
              <Stat
                label="Current Streak"
                value="5 days"
                icon={<Flame className="w-4 h-4" />}
                valueColor="gold"
              />
            </Card>
          </StatGrid>
        </PageSection>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - 2/3 width */}
          <div className="lg:col-span-2 space-y-6">
            {/* Recent Performance */}
            <Card>
              <CardHeader
                title="This Week's Performance"
                action={
                  <a href="/journal" className="text-xs text-[var(--accent-primary)] hover:underline flex items-center gap-1">
                    View Journal <ArrowRight className="w-3 h-3" />
                  </a>
                }
              />
              <CardContent>
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="text-center p-4 bg-[var(--bg-tertiary)]">
                    <p className="text-2xl font-bold text-[var(--profit)]">8</p>
                    <p className="text-xs text-[var(--text-tertiary)] uppercase">Wins</p>
                  </div>
                  <div className="text-center p-4 bg-[var(--bg-tertiary)]">
                    <p className="text-2xl font-bold text-[var(--loss)]">3</p>
                    <p className="text-xs text-[var(--text-tertiary)] uppercase">Losses</p>
                  </div>
                  <div className="text-center p-4 bg-[var(--bg-tertiary)]">
                    <p className="text-2xl font-bold text-[var(--accent-primary)]">B+</p>
                    <p className="text-xs text-[var(--text-tertiary)] uppercase">Avg Grade</p>
                  </div>
                </div>

                {/* P&L Chart Placeholder */}
                <div className="h-48 bg-[var(--bg-tertiary)] flex items-center justify-center text-[var(--text-tertiary)]">
                  P&L Chart Coming Soon
                </div>
              </CardContent>
            </Card>

            {/* Learning Progress Preview */}
            <Card>
              <CardHeader
                title="Learning Progress"
                action={
                  <a href="/progress" className="text-xs text-[var(--accent-primary)] hover:underline flex items-center gap-1">
                    Continue Learning <ArrowRight className="w-3 h-3" />
                  </a>
                }
              />
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-[var(--text-secondary)]">LTP Framework</span>
                      <span className="text-[var(--accent-primary)] font-medium">85%</span>
                    </div>
                    <ProgressBar value={85} variant="gold" />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-[var(--text-secondary)]">Entry & Exit Rules</span>
                      <span className="text-[var(--accent-primary)] font-medium">60%</span>
                    </div>
                    <ProgressBar value={60} variant="gold" />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-[var(--text-secondary)]">Psychology</span>
                      <span className="text-[var(--accent-primary)] font-medium">45%</span>
                    </div>
                    <ProgressBar value={45} variant="gold" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - 1/3 width */}
          <div className="space-y-6">
            {/* Mini Leaderboard */}
            <MiniLeaderboard entries={mockLeaderboard} currentUserId="current" />

            {/* Latest Achievement */}
            <FeaturedAchievement achievement={mockAchievement} />

            {/* Quick Actions */}
            <Card>
              <CardHeader title="Quick Actions" />
              <CardContent>
                <div className="space-y-2">
                  <Button variant="secondary" className="w-full justify-start" icon={<BookOpen className="w-4 h-4" />}>
                    Log a Trade
                  </Button>
                  <Button variant="secondary" className="w-full justify-start" icon={<Target className="w-4 h-4" />}>
                    Take a Quiz
                  </Button>
                  <Button variant="secondary" className="w-full justify-start" icon={<Share2 className="w-4 h-4" />}>
                    Create Win Card
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </PageShell>
    </>
  );
}
