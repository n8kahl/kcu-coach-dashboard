'use client';

import { cn, formatCurrency, formatPercent, formatNumber } from '@/lib/utils';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  Target,
  Award,
  Flame,
  BarChart2,
  DollarSign,
  Percent,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Stat, StatGrid } from '@/components/ui/stat';
import { CircularProgress } from '@/components/ui/progress';
import type { TradeStats } from '@/types';

interface StatsOverviewProps {
  stats: TradeStats;
}

export function StatsOverview({ stats }: StatsOverviewProps) {
  return (
    <div className="space-y-6">
      {/* Top Stats Row */}
      <StatGrid columns={4}>
        <Card variant="default" padding="md">
          <Stat
            label="Total P&L"
            value={formatCurrency(stats.totalPnL)}
            icon={<DollarSign className="w-4 h-4" />}
            valueColor={stats.totalPnL >= 0 ? 'profit' : 'loss'}
            variant="default"
          />
        </Card>

        <Card variant="default" padding="md">
          <Stat
            label="Win Rate"
            value={`${stats.winRate.toFixed(1)}%`}
            icon={<Percent className="w-4 h-4" />}
            valueColor={stats.winRate >= 50 ? 'profit' : 'loss'}
          />
        </Card>

        <Card variant="default" padding="md">
          <Stat
            label="Total Trades"
            value={formatNumber(stats.totalTrades)}
            icon={<BarChart2 className="w-4 h-4" />}
          />
        </Card>

        <Card variant="default" padding="md">
          <Stat
            label="Current Streak"
            value={`${stats.currentStreak} days`}
            icon={<Flame className="w-4 h-4" />}
            valueColor="gold"
          />
        </Card>
      </StatGrid>

      {/* Detailed Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Win/Loss Breakdown */}
        <Card>
          <CardHeader title="Win/Loss Breakdown" />
          <CardContent>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 flex items-center justify-center bg-[rgba(34,197,94,0.15)]">
                  <TrendingUp className="w-6 h-6 text-[var(--profit)]" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[var(--profit)]">
                    {stats.winningTrades}
                  </p>
                  <p className="text-xs text-[var(--text-tertiary)] uppercase">Winners</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 flex items-center justify-center bg-[rgba(239,68,68,0.15)]">
                  <TrendingDown className="w-6 h-6 text-[var(--loss)]" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[var(--loss)]">
                    {stats.losingTrades}
                  </p>
                  <p className="text-xs text-[var(--text-tertiary)] uppercase">Losers</p>
                </div>
              </div>
            </div>
            {/* Win rate bar */}
            <div className="h-2 bg-[var(--bg-elevated)] flex overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${stats.winRate}%` }}
                transition={{ duration: 0.5 }}
                className="bg-[var(--profit)]"
              />
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${100 - stats.winRate}%` }}
                transition={{ duration: 0.5 }}
                className="bg-[var(--loss)]"
              />
            </div>
          </CardContent>
        </Card>

        {/* Profit Factor */}
        <Card>
          <CardHeader title="Profit Factor" subtitle="Gross profit / Gross loss" />
          <CardContent>
            <div className="flex items-center justify-center py-4">
              <CircularProgress
                value={Math.min(stats.profitFactor * 50, 100)}
                size={100}
                strokeWidth={10}
                showValue={false}
                variant={stats.profitFactor >= 1.5 ? 'gold' : stats.profitFactor >= 1 ? 'success' : 'error'}
              />
              <div className="absolute">
                <p
                  className={cn(
                    'text-3xl font-bold',
                    stats.profitFactor >= 1.5
                      ? 'text-[var(--accent-primary)]'
                      : stats.profitFactor >= 1
                      ? 'text-[var(--profit)]'
                      : 'text-[var(--loss)]'
                  )}
                >
                  {stats.profitFactor === Infinity ? '∞' : stats.profitFactor.toFixed(2)}
                </p>
              </div>
            </div>
            <div className="text-center mt-2">
              <span
                className={cn(
                  'text-xs font-medium',
                  stats.profitFactor >= 1.5
                    ? 'text-[var(--accent-primary)]'
                    : stats.profitFactor >= 1
                    ? 'text-[var(--profit)]'
                    : 'text-[var(--loss)]'
                )}
              >
                {stats.profitFactor >= 2
                  ? 'Excellent'
                  : stats.profitFactor >= 1.5
                  ? 'Good'
                  : stats.profitFactor >= 1
                  ? 'Break Even'
                  : 'Needs Work'}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Avg Win vs Loss */}
        <Card>
          <CardHeader title="Risk/Reward" />
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase text-[var(--text-tertiary)]">Avg Win</span>
                <span className="text-lg font-bold text-[var(--profit)]">
                  {formatCurrency(stats.avgWin)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase text-[var(--text-tertiary)]">Avg Loss</span>
                <span className="text-lg font-bold text-[var(--loss)]">
                  {formatCurrency(Math.abs(stats.avgLoss))}
                </span>
              </div>
              <div className="pt-2 border-t border-[var(--border-primary)]">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase text-[var(--text-tertiary)]">R:R Ratio</span>
                  <span
                    className={cn(
                      'text-lg font-bold',
                      stats.avgWin / Math.abs(stats.avgLoss) >= 1.5
                        ? 'text-[var(--accent-primary)]'
                        : 'text-[var(--text-primary)]'
                    )}
                  >
                    {(stats.avgWin / Math.abs(stats.avgLoss || 1)).toFixed(2)}:1
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Extremes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Best Trade" subtitle="Largest winning trade" />
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 flex items-center justify-center bg-[rgba(34,197,94,0.15)]">
                  <Award className="w-6 h-6 text-[var(--profit)]" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[var(--profit)]">
                    {formatCurrency(stats.largestWin)}
                  </p>
                  <p className="text-xs text-[var(--text-tertiary)]">Personal Best</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Worst Trade" subtitle="Largest losing trade" />
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 flex items-center justify-center bg-[rgba(239,68,68,0.15)]">
                  <Target className="w-6 h-6 text-[var(--loss)]" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[var(--loss)]">
                    {formatCurrency(stats.largestLoss)}
                  </p>
                  <p className="text-xs text-[var(--text-tertiary)]">Max Drawdown</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* LTP Grade */}
      <Card variant="glow">
        <CardHeader title="LTP Compliance" subtitle="Following Levels • Trends • Patience Candles" />
        <CardContent>
          <div className="flex items-center justify-center py-6">
            <div className="text-center">
              <p className="text-6xl font-bold text-[var(--accent-primary)] glow-text-gold mb-2">
                {stats.avgLTPGrade}
              </p>
              <p className="text-sm text-[var(--text-secondary)]">Average Grade</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
