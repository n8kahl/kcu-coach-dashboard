'use client';

import Link from 'next/link';
import {
  TrendingUp,
  TrendingDown,
  Target,
  Bot,
  BookOpen,
  Bell,
  ArrowRight,
  Zap,
  Award,
  AlertTriangle,
} from 'lucide-react';
import { DailyBriefing } from '@/components/dashboard/daily-briefing';

export default function DashboardPage() {
  // Mock data - would come from API in production
  const stats = {
    todayPnL: 1250.00,
    weekPnL: 3420.00,
    winRate: 68,
    totalTrades: 24,
    activeSetups: 3,
    pendingAlerts: 2,
  };

  const recentTrades = [
    { id: 1, symbol: 'SPY', direction: 'long', pnl: 450, time: '10:32 AM' },
    { id: 2, symbol: 'TSLA', direction: 'short', pnl: -120, time: '11:15 AM' },
    { id: 3, symbol: 'QQQ', direction: 'long', pnl: 280, time: '2:45 PM' },
  ];

  const activeSetups = [
    { symbol: 'AAPL', type: 'LTP', confluence: 82, direction: 'long' },
    { symbol: 'NVDA', type: 'ORB', confluence: 75, direction: 'long' },
    { symbol: 'META', type: 'VWAP', confluence: 68, direction: 'short' },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Welcome back, Trader</h1>
          <p className="text-gray-400">Here&apos;s your trading overview for today.</p>
        </div>
        <div className="flex items-center gap-3">
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
          value={`$${stats.todayPnL.toLocaleString()}`}
          trend={stats.todayPnL >= 0 ? 'up' : 'down'}
          icon={<TrendingUp className="w-5 h-5" />}
        />
        <StatCard
          title="Week P&L"
          value={`$${stats.weekPnL.toLocaleString()}`}
          trend={stats.weekPnL >= 0 ? 'up' : 'down'}
          icon={<TrendingUp className="w-5 h-5" />}
        />
        <StatCard
          title="Win Rate"
          value={`${stats.winRate}%`}
          subtitle={`${stats.totalTrades} trades`}
          icon={<Award className="w-5 h-5" />}
        />
        <StatCard
          title="Active Setups"
          value={stats.activeSetups.toString()}
          subtitle="High confluence"
          icon={<Target className="w-5 h-5" />}
          highlight
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
            <Link href="/companion" className="text-sm text-primary-400 hover:text-primary-300 flex items-center gap-1">
              View All
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="space-y-3">
            {activeSetups.map((setup, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-4 rounded-lg bg-dark-bg/50 border border-dark-border hover:border-primary-500/30 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    setup.direction === 'long' ? 'bg-green-500/20' : 'bg-red-500/20'
                  }`}>
                    {setup.direction === 'long' ? (
                      <TrendingUp className="w-5 h-5 text-green-400" />
                    ) : (
                      <TrendingDown className="w-5 h-5 text-red-400" />
                    )}
                  </div>
                  <div>
                    <p className="font-semibold text-white">{setup.symbol}</p>
                    <p className="text-sm text-gray-400">{setup.type} Setup</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm font-medium ${
                    setup.confluence >= 80
                      ? 'bg-green-500/20 text-green-400'
                      : setup.confluence >= 65
                        ? 'bg-yellow-500/20 text-yellow-400'
                        : 'bg-orange-500/20 text-orange-400'
                  }`}>
                    {setup.confluence}% Confluence
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="space-y-4">
          {/* Recent Trades */}
          <div className="glass-card p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Recent Trades</h2>
            <div className="space-y-3">
              {recentTrades.map((trade) => (
                <div key={trade.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-white">{trade.symbol}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      trade.direction === 'long'
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}>
                      {trade.direction.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className={`font-medium ${trade.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {trade.pnl >= 0 ? '+' : ''}{trade.pnl.toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-500">{trade.time}</p>
                  </div>
                </div>
              ))}
            </div>
            <Link
              href="/journal"
              className="mt-4 w-full btn-secondary flex items-center justify-center gap-2"
            >
              <BookOpen className="w-4 h-4" />
              View Journal
            </Link>
          </div>

          {/* Alerts Notice */}
          {stats.pendingAlerts > 0 && (
            <div className="glass-card p-4 border-l-4 border-accent-500">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-accent-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-white">
                    {stats.pendingAlerts} Active Alerts
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
            <Link href="/coach" className="w-full btn-primary flex items-center justify-center gap-2">
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
    <div className={`glass-card p-4 ${highlight ? 'border-primary-500/50 animate-pulse-glow' : ''}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-gray-400">{title}</span>
        <span className={trend === 'up' ? 'text-green-400' : trend === 'down' ? 'text-red-400' : 'text-gray-400'}>
          {icon}
        </span>
      </div>
      <p className={`text-2xl font-bold ${
        trend === 'up' ? 'text-green-400' : trend === 'down' ? 'text-red-400' : 'text-white'
      }`}>
        {value}
      </p>
      {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
    </div>
  );
}
