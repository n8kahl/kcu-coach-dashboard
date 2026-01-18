'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  TrendingUp,
  TrendingDown,
  Target,
  Bot,
  BookOpen,
  ArrowRight,
  Zap,
  Award,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { DailyBriefing } from '@/components/dashboard/daily-briefing';
import { SkeletonStats, SkeletonCard } from '@/components/ui/feedback';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { DetectedSetup, TradeEntry } from '@/types';

interface DashboardStats {
  todayPnL: number;
  weekPnL: number;
  winRate: number;
  totalTrades: number;
  activeSetups: number;
  pendingAlerts: number;
  currentStreak: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentTrades, setRecentTrades] = useState<TradeEntry[]>([]);
  const [activeSetups, setActiveSetups] = useState<DetectedSetup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboardData = async () => {
    try {
      setRefreshing(true);

      // Fetch all data in parallel
      const [tradesRes, statsRes, weekStatsRes, setupsRes, alertsRes] = await Promise.all([
        fetch('/api/trades?limit=5'),
        fetch('/api/trades/stats?period=all'),
        fetch('/api/trades/stats?period=week'),
        fetch('/api/setups?limit=5&minScore=60'),
        fetch('/api/admin/alerts').catch(() => null), // May not be available
      ]);

      // Handle unauthorized
      if (tradesRes.status === 401) {
        router.push('/login');
        return;
      }

      // Parse responses
      const tradesData = tradesRes.ok ? await tradesRes.json() : { trades: [] };
      const allStatsData = statsRes.ok ? await statsRes.json() : { stats: {} };
      const weekStatsData = weekStatsRes.ok ? await weekStatsRes.json() : { stats: {} };
      const setupsData = setupsRes.ok ? await setupsRes.json() : { setups: [] };
      const alertsData = alertsRes && alertsRes.ok ? await alertsRes.json() : { alerts: [] };

      // Calculate today's P&L from trades
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayTrades = (tradesData.trades || []).filter((trade: TradeEntry) => {
        const tradeDate = new Date(trade.entry_time);
        return tradeDate >= today;
      });
      const todayPnL = todayTrades.reduce((sum: number, t: TradeEntry) => sum + (t.pnl || 0), 0);

      // Build stats object
      const dashboardStats: DashboardStats = {
        todayPnL,
        weekPnL: weekStatsData.stats?.totalPnl || 0,
        winRate: Math.round(allStatsData.stats?.winRate || 0),
        totalTrades: allStatsData.stats?.totalTrades || 0,
        activeSetups: setupsData.setups?.length || 0,
        pendingAlerts: (alertsData.alerts || []).filter((a: { is_active: boolean }) => a.is_active).length,
        currentStreak: allStatsData.stats?.currentStreak || 0,
      };

      setStats(dashboardStats);
      setRecentTrades(tradesData.trades || []);
      setActiveSetups(setupsData.setups || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError('Unable to load dashboard data. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();

    // Refresh setups every 30 seconds
    const interval = setInterval(() => {
      fetchDashboardData();
    }, 30000);

    return () => clearInterval(interval);
  }, [router]);

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Header Skeleton */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="h-8 w-64 bg-[var(--bg-tertiary)] animate-pulse rounded" />
            <div className="h-4 w-48 bg-[var(--bg-tertiary)] animate-pulse rounded mt-2" />
          </div>
        </div>

        {/* Stats Skeleton */}
        <SkeletonStats count={4} />

        {/* Content Skeleton */}
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <SkeletonCard className="h-64" />
          </div>
          <div className="space-y-4">
            <SkeletonCard className="h-48" />
            <SkeletonCard className="h-32" />
          </div>
        </div>
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="space-y-6">
        <Card variant="bordered">
          <CardContent className="text-center py-12">
            <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-[var(--error)]" />
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
              Unable to Load Dashboard
            </h3>
            <p className="text-sm text-[var(--text-tertiary)] mb-4">{error}</p>
            <Button variant="primary" onClick={() => window.location.reload()}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Default stats if none available
  const displayStats = stats || {
    todayPnL: 0,
    weekPnL: 0,
    winRate: 0,
    totalTrades: 0,
    activeSetups: 0,
    pendingAlerts: 0,
    currentStreak: 0,
  };

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Welcome back, Trader</h1>
          <p className="text-gray-400">Here&apos;s your trading overview for today.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            icon={<RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />}
            onClick={fetchDashboardData}
            disabled={refreshing}
          >
            Refresh
          </Button>
          <Link href="/companion" className="btn-primary flex items-center gap-2">
            <Target className="w-4 h-4" />
            Open Companion
          </Link>
        </div>
      </div>

      {/* Daily Briefing */}
      <DailyBriefing className="mb-2" />

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Today's P&L"
          value={`${displayStats.todayPnL >= 0 ? '+' : ''}$${displayStats.todayPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          trend={displayStats.todayPnL >= 0 ? 'up' : 'down'}
          icon={<TrendingUp className="w-5 h-5" />}
        />
        <StatCard
          title="Week P&L"
          value={`${displayStats.weekPnL >= 0 ? '+' : ''}$${displayStats.weekPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          trend={displayStats.weekPnL >= 0 ? 'up' : 'down'}
          icon={<TrendingUp className="w-5 h-5" />}
        />
        <StatCard
          title="Win Rate"
          value={`${displayStats.winRate}%`}
          subtitle={`${displayStats.totalTrades} trades`}
          icon={<Award className="w-5 h-5" />}
        />
        <StatCard
          title="Active Setups"
          value={displayStats.activeSetups.toString()}
          subtitle="High confluence"
          icon={<Target className="w-5 h-5" />}
          highlight={displayStats.activeSetups > 0}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Active Setups */}
        <div className="lg:col-span-2 glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-400" />
              Active Setups
            </h2>
            <Link
              href="/companion"
              className="text-sm text-primary-400 hover:text-primary-300 flex items-center gap-1"
            >
              View All
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {activeSetups.length === 0 ? (
            <div className="text-center py-8">
              <Target className="w-12 h-12 mx-auto mb-3 text-gray-600" />
              <p className="text-gray-400">No active setups at the moment</p>
              <p className="text-sm text-gray-500 mt-1">
                Check back during market hours for LTP setups
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeSetups.map((setup) => (
                <div
                  key={setup.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-dark-bg/50 border border-dark-border hover:border-primary-500/30 transition-colors cursor-pointer"
                  onClick={() => router.push(`/companion?symbol=${setup.symbol}`)}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        setup.direction === 'long' ? 'bg-green-500/20' : 'bg-red-500/20'
                      }`}
                    >
                      {setup.direction === 'long' ? (
                        <TrendingUp className="w-5 h-5 text-green-400" />
                      ) : (
                        <TrendingDown className="w-5 h-5 text-red-400" />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-white">{setup.symbol}</p>
                      <p className="text-sm text-gray-400">{setup.setup_type} Setup</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm font-medium ${
                        setup.confluence_score >= 80
                          ? 'bg-green-500/20 text-green-400'
                          : setup.confluence_score >= 65
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : 'bg-orange-500/20 text-orange-400'
                      }`}
                    >
                      {setup.confluence_score}% Confluence
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="space-y-4">
          {/* Recent Trades */}
          <div className="glass-card p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Recent Trades</h2>
            {recentTrades.length === 0 ? (
              <div className="text-center py-6">
                <BookOpen className="w-10 h-10 mx-auto mb-2 text-gray-600" />
                <p className="text-gray-400 text-sm">No trades yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentTrades.slice(0, 3).map((trade) => (
                  <div key={trade.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-white">{trade.symbol}</span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${
                          trade.direction === 'long'
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-red-500/20 text-red-400'
                        }`}
                      >
                        {trade.direction?.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-right">
                      <p
                        className={`font-medium ${
                          (trade.pnl || 0) >= 0 ? 'text-green-400' : 'text-red-400'
                        }`}
                      >
                        {(trade.pnl || 0) >= 0 ? '+' : ''}
                        {trade.pnl?.toLocaleString() || '0'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(trade.entry_time).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <Link
              href="/journal"
              className="mt-4 w-full btn-secondary flex items-center justify-center gap-2"
            >
              <BookOpen className="w-4 h-4" />
              View Journal
            </Link>
          </div>

          {/* Alerts Notice */}
          {displayStats.pendingAlerts > 0 && (
            <div className="glass-card p-4 border-l-4 border-accent-500">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-accent-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-white">
                    {displayStats.pendingAlerts} Active Alert
                    {displayStats.pendingAlerts > 1 ? 's' : ''}
                  </p>
                  <p className="text-sm text-gray-400 mt-1">
                    Admin has posted new trade alerts
                  </p>
                  <Link
                    href="/alerts"
                    className="text-sm text-accent-400 hover:text-accent-300 flex items-center gap-1 mt-2"
                  >
                    View Alerts
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Current Streak */}
          {displayStats.currentStreak !== 0 && (
            <div
              className={`glass-card p-4 border-l-4 ${
                displayStats.currentStreak > 0 ? 'border-green-500' : 'border-red-500'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    displayStats.currentStreak > 0 ? 'bg-green-500/20' : 'bg-red-500/20'
                  }`}
                >
                  {displayStats.currentStreak > 0 ? (
                    <TrendingUp className="w-5 h-5 text-green-400" />
                  ) : (
                    <TrendingDown className="w-5 h-5 text-red-400" />
                  )}
                </div>
                <div>
                  <p className="font-medium text-white">
                    {Math.abs(displayStats.currentStreak)} Trade{' '}
                    {displayStats.currentStreak > 0 ? 'Win' : 'Loss'} Streak
                  </p>
                  <p className="text-sm text-gray-400">
                    {displayStats.currentStreak > 0
                      ? 'Keep up the momentum!'
                      : 'Review your recent trades'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* AI Coach Prompt */}
          <div className="glass-card p-6 bg-gradient-to-br from-primary-500/10 to-accent-500/10">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-white">AI Coach</h3>
                <p className="text-xs text-gray-400">Ready to help</p>
              </div>
            </div>
            <p className="text-sm text-gray-300 mb-4">
              Need help analyzing a trade or reviewing your strategy?
            </p>
            <Link
              href="/coach"
              className="w-full btn-primary flex items-center justify-center gap-2"
            >
              Start Conversation
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  trend,
  icon,
  highlight,
}: {
  title: string;
  value: string;
  subtitle?: string;
  trend?: 'up' | 'down';
  icon: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div
      className={`glass-card p-4 ${highlight ? 'border-primary-500/50 animate-pulse-glow' : ''}`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-gray-400">{title}</span>
        <span
          className={
            trend === 'up'
              ? 'text-green-400'
              : trend === 'down'
              ? 'text-red-400'
              : 'text-gray-400'
          }
        >
          {icon}
        </span>
      </div>
      <p
        className={`text-2xl font-bold ${
          trend === 'up' ? 'text-green-400' : trend === 'down' ? 'text-red-400' : 'text-white'
        }`}
      >
        {value}
      </p>
      {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
    </div>
  );
}
