'use client';

// Force dynamic rendering to prevent prerender errors with useSearchParams
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePageContext } from '@/components/ai';
import { Header } from '@/components/layout/header';
import { PageShell, PageSection, Grid, LoadingState, ErrorState, SkeletonStats } from '@/components/layout/page-shell';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Stat, StatGrid } from '@/components/ui/stat';
import { ProgressBar } from '@/components/ui/progress';
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
import type { TradeStats, LeaderboardEntry, Achievement, User } from '@/types';

// Default empty stats
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

// Default achievement for display when none earned yet
const defaultAchievement: Achievement = {
  id: 'first_trade',
  slug: 'first_trade',
  title: 'First Trade',
  description: 'Log your first trade to unlock achievements!',
  icon: '🎯',
  category: 'milestone',
  requirement: { type: 'trade', target: 1, current: 0 },
  xp_reward: 50,
  unlocked: false,
};

interface DashboardData {
  user: User | null;
  stats: TradeStats;
  leaderboard: LeaderboardEntry[];
  latestAchievement: Achievement | null;
  progress: {
    overall: number;
    modules: Array<{ name: string; progress: number }>;
    streak: number;
  };
}

export default function OverviewPage() {
  const router = useRouter();
  usePageContext();
  const [data, setData] = useState<DashboardData>({
    user: null,
    stats: emptyStats,
    leaderboard: [],
    latestAchievement: null,
    progress: { overall: 0, modules: [], streak: 0 },
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        setLoading(true);
        setError(null);

        // Fetch all dashboard data in parallel
        const [userRes, statsRes, leaderboardRes, achievementsRes, progressRes] = await Promise.all([
          fetch('/api/user'),
          fetch('/api/trades/stats'),
          fetch('/api/leaderboard?limit=5'),
          fetch('/api/achievements?latest=true'),
          fetch('/api/learning/v2/progress'),
        ]);

        const userData = userRes.ok ? await userRes.json() : { user: null };
        const statsData = statsRes.ok ? await statsRes.json() : { stats: emptyStats };
        const leaderboardData = leaderboardRes.ok ? await leaderboardRes.json() : { entries: [] };
        const achievementsData = achievementsRes.ok ? await achievementsRes.json() : { achievements: [] };
        const progressRaw = progressRes.ok ? await progressRes.json() : null;

        // Transform v2 progress data to expected shape
        type ModuleProgressData = { completed: number; total: number };
        const modulesRaw = (progressRaw?.modules || {}) as Record<string, ModuleProgressData>;
        const progressData = {
          overall: progressRaw?.overall?.progressPercent || 0,
          modules: Object.entries(modulesRaw).map(([id, data]) => ({
            name: id.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            progress: data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0,
          })),
          streak: progressRaw?.streak?.current || 0,
        };

        // Find the most recently unlocked achievement
        const earnedAchievements = (achievementsData.achievements || []).filter(
          (a: Achievement) => a.unlocked || a.unlocked_at
        );
        const latestAchievement = earnedAchievements.length > 0
          ? earnedAchievements.sort((a: Achievement, b: Achievement) =>
              new Date(b.unlocked_at || 0).getTime() - new Date(a.unlocked_at || 0).getTime()
            )[0]
          : null;

        setData({
          user: userData.user || null,
          stats: statsData.stats || emptyStats,
          leaderboard: leaderboardData.entries || [],
          latestAchievement,
          progress: {
            overall: progressData.overall || 0,
            modules: progressData.modules || [],
            streak: progressData.streak || 0,
          },
        });
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, []);

  const username = data.user?.username || 'Trader';

  // Loading state with skeleton UI
  if (loading) {
    return (
      <>
        <Header
          title="Dashboard"
          subtitle="Loading your data..."
          breadcrumbs={[{ label: 'Dashboard' }, { label: 'Overview' }]}
        />
        <PageShell>
          <PageSection>
            <SkeletonStats count={4} />
          </PageSection>
          <LoadingState
            text="Loading your dashboard..."
            size="lg"
            aria-label="Loading dashboard data"
          />
        </PageShell>
      </>
    );
  }

  // Error state with retry functionality
  if (error) {
    return (
      <>
        <Header
          title="Dashboard"
          subtitle="Error loading data"
          breadcrumbs={[{ label: 'Dashboard' }, { label: 'Overview' }]}
        />
        <PageShell>
          <ErrorState
            title="Failed to Load Dashboard"
            message={error}
            severity="error"
            onRetry={() => window.location.reload()}
            retryText="Reload Dashboard"
          />
        </PageShell>
      </>
    );
  }

  return (
    <>
      <Header
        title="Dashboard"
        subtitle={`Welcome back, ${username}`}
        breadcrumbs={[{ label: 'Dashboard' }, { label: 'Overview' }]}
        actions={
          <Button
            variant="primary"
            size="sm"
            icon={<Share2 className="w-4 h-4" />}
            onClick={() => router.push('/win-cards')}
          >
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
                label="Total P&L"
                value={formatCurrency(data.stats.total_pnl)}
                icon={<TrendingUp className="w-4 h-4" />}
                valueColor={data.stats.total_pnl >= 0 ? 'profit' : 'loss'}
              />
            </Card>
            <Card variant="default" padding="md">
              <Stat
                label="Win Rate"
                value={`${(data.stats.win_rate ?? 0).toFixed(1)}%`}
                icon={<Target className="w-4 h-4" />}
                valueColor={(data.stats.win_rate ?? 0) >= 50 ? 'profit' : 'loss'}
              />
            </Card>
            <Card variant="default" padding="md">
              <Stat
                label="Learning Progress"
                value={`${data.progress.overall}%`}
                icon={<BookOpen className="w-4 h-4" />}
                valueColor="gold"
              />
            </Card>
            <Card variant="default" padding="md">
              <Stat
                label="Current Streak"
                value={`${data.progress.streak} days`}
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
                title="Performance Summary"
                action={
                  <a href="/journal" className="text-xs text-[var(--accent-primary)] hover:underline flex items-center gap-1">
                    View Journal <ArrowRight className="w-3 h-3" />
                  </a>
                }
              />
              <CardContent>
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="text-center p-4 bg-[var(--bg-tertiary)]">
                    <p className="text-2xl font-bold text-[var(--profit)]">{data.stats.winning_trades}</p>
                    <p className="text-xs text-[var(--text-tertiary)] uppercase">Wins</p>
                  </div>
                  <div className="text-center p-4 bg-[var(--bg-tertiary)]">
                    <p className="text-2xl font-bold text-[var(--loss)]">{data.stats.losing_trades}</p>
                    <p className="text-xs text-[var(--text-tertiary)] uppercase">Losses</p>
                  </div>
                  <div className="text-center p-4 bg-[var(--bg-tertiary)]">
                    <p className="text-2xl font-bold text-[var(--accent-primary)]">{data.stats.total_trades}</p>
                    <p className="text-xs text-[var(--text-tertiary)] uppercase">Total Trades</p>
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-[var(--bg-tertiary)]">
                    <p className="text-xs text-[var(--text-tertiary)] uppercase mb-1">Profit Factor</p>
                    <p className="text-lg font-bold text-[var(--text-primary)]">{(data.stats.profit_factor ?? 0).toFixed(2)}</p>
                  </div>
                  <div className="p-3 bg-[var(--bg-tertiary)]">
                    <p className="text-xs text-[var(--text-tertiary)] uppercase mb-1">Best Setup</p>
                    <p className="text-lg font-bold text-[var(--text-primary)]">{data.stats.best_setup}</p>
                  </div>
                  <div className="p-3 bg-[var(--bg-tertiary)]">
                    <p className="text-xs text-[var(--text-tertiary)] uppercase mb-1">Avg Win</p>
                    <p className="text-lg font-bold text-[var(--profit)]">{formatCurrency(data.stats.average_win)}</p>
                  </div>
                  <div className="p-3 bg-[var(--bg-tertiary)]">
                    <p className="text-xs text-[var(--text-tertiary)] uppercase mb-1">Avg Loss</p>
                    <p className="text-lg font-bold text-[var(--loss)]">{formatCurrency(data.stats.average_loss)}</p>
                  </div>
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
                {data.progress.modules.length > 0 ? (
                  <div className="space-y-4">
                    {data.progress.modules.slice(0, 3).map((module) => (
                      <div key={module.name}>
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-[var(--text-secondary)]">{module.name}</span>
                          <span className="text-[var(--accent-primary)] font-medium">{module.progress}%</span>
                        </div>
                        <ProgressBar value={module.progress} variant="gold" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <p className="text-[var(--text-tertiary)] mb-4">Start your learning journey</p>
                    <Button
                      variant="primary"
                      icon={<BookOpen className="w-4 h-4" />}
                      onClick={() => router.push('/learn')}
                    >
                      Begin Learning
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column - 1/3 width */}
          <div className="space-y-6">
            {/* Mini Leaderboard */}
            <MiniLeaderboard entries={data.leaderboard} currentUserId={data.user?.id} />

            {/* Latest Achievement */}
            <FeaturedAchievement achievement={data.latestAchievement || defaultAchievement} />

            {/* Quick Actions */}
            <Card>
              <CardHeader title="Quick Actions" />
              <CardContent>
                <div className="space-y-2">
                  <Button
                    variant="secondary"
                    className="w-full justify-start"
                    icon={<BookOpen className="w-4 h-4" />}
                    onClick={() => router.push('/journal')}
                  >
                    Log a Trade
                  </Button>
                  <Button
                    variant="secondary"
                    className="w-full justify-start"
                    icon={<Target className="w-4 h-4" />}
                    onClick={() => router.push('/learn')}
                  >
                    Take a Quiz
                  </Button>
                  <Button
                    variant="secondary"
                    className="w-full justify-start"
                    icon={<Share2 className="w-4 h-4" />}
                    onClick={() => router.push('/win-cards')}
                  >
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
