'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import {
  BarChart3,
  Clock,
  Target,
  Bell,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Zap,
  Award,
  Activity,
  Timer,
} from 'lucide-react';

interface SessionStats {
  sessionId: string | null;
  startedAt: string | null;
  duration: number; // minutes
  setupsDetected: number;
  setupsTraded: number;
  alertsSet: number;
  alertsTriggered: number;
  practiceAttempts: number;
  symbolsWatched: string[];
  bestSetup: {
    symbol: string;
    confluence: number;
  } | null;
}

interface WeeklyStats {
  totalSessions: number;
  totalSetupsDetected: number;
  totalSetupsTraded: number;
  avgSessionMinutes: number;
  bestPerformingSymbols: Array<{ symbol: string; count: number }>;
  mostActiveDay: string;
}

interface CompanionSessionReportProps {
  sessionId: string | null;
  className?: string;
}

export function CompanionSessionReport({ sessionId, className }: CompanionSessionReportProps) {
  const [expanded, setExpanded] = useState(false);
  const [sessionStats, setSessionStats] = useState<SessionStats | null>(null);
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStats | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (expanded && !sessionStats) {
      fetchStats();
    }
  }, [expanded, sessionStats]);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const [sessionRes, weeklyRes] = await Promise.all([
        fetch(`/api/companion/session${sessionId ? `?sessionId=${sessionId}` : ''}`),
        fetch('/api/companion/analytics?period=week'),
      ]);

      if (sessionRes.ok) {
        const data = await sessionRes.json();
        if (data.session) {
          setSessionStats({
            sessionId: data.session.id,
            startedAt: data.session.started_at,
            duration: data.session.ended_at
              ? Math.round((new Date(data.session.ended_at).getTime() - new Date(data.session.started_at).getTime()) / 60000)
              : Math.round((Date.now() - new Date(data.session.started_at).getTime()) / 60000),
            setupsDetected: data.session.setups_detected || 0,
            setupsTraded: data.session.setups_traded || 0,
            alertsSet: data.session.alerts_set || 0,
            alertsTriggered: data.session.alerts_triggered || 0,
            practiceAttempts: data.session.practice_attempts || 0,
            symbolsWatched: data.session.symbols_watched || [],
            bestSetup: data.session.best_setup_symbol ? {
              symbol: data.session.best_setup_symbol,
              confluence: data.session.best_setup_confluence || 0,
            } : null,
          });
        }
      }

      if (weeklyRes.ok) {
        const data = await weeklyRes.json();
        setWeeklyStats(data.stats);
      }
    } catch (error) {
      console.error('Error fetching companion stats:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={cn('bg-[var(--bg-secondary)] border border-[var(--border-primary)]', className)}>
      {/* Header - Always Visible */}
      <button
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-[var(--bg-tertiary)] transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <BarChart3 className="w-5 h-5 text-[var(--accent-primary)]" />
          <span className="font-semibold text-[var(--text-primary)]">Session Report</span>
        </div>
        <div className="flex items-center gap-3">
          {sessionStats && (
            <div className="flex items-center gap-4 text-sm">
              <span className="text-[var(--text-tertiary)]">
                <Timer className="w-4 h-4 inline mr-1" />
                {sessionStats.duration}m
              </span>
              <span className="text-[var(--text-tertiary)]">
                <Target className="w-4 h-4 inline mr-1" />
                {sessionStats.setupsDetected} setups
              </span>
            </div>
          )}
          {expanded ? (
            <ChevronUp className="w-5 h-5 text-[var(--text-tertiary)]" />
          ) : (
            <ChevronDown className="w-5 h-5 text-[var(--text-tertiary)]" />
          )}
        </div>
      </button>

      {/* Expanded Content */}
      {expanded && (
        <div className="border-t border-[var(--border-primary)]">
          {loading ? (
            <div className="p-8 text-center">
              <Activity className="w-6 h-6 animate-pulse text-[var(--accent-primary)] mx-auto" />
              <p className="text-sm text-[var(--text-tertiary)] mt-2">Loading stats...</p>
            </div>
          ) : (
            <div className="p-4 space-y-6">
              {/* Current Session Stats */}
              {sessionStats && (
                <div>
                  <h4 className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-3">
                    Current Session
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard
                      icon={<Clock className="w-4 h-4" />}
                      label="Duration"
                      value={`${sessionStats.duration}m`}
                    />
                    <StatCard
                      icon={<Target className="w-4 h-4" />}
                      label="Setups Detected"
                      value={sessionStats.setupsDetected}
                      highlight={sessionStats.setupsDetected > 0}
                    />
                    <StatCard
                      icon={<Bell className="w-4 h-4" />}
                      label="Alerts Set"
                      value={sessionStats.alertsSet}
                    />
                    <StatCard
                      icon={<Zap className="w-4 h-4" />}
                      label="Alerts Triggered"
                      value={sessionStats.alertsTriggered}
                      highlight={sessionStats.alertsTriggered > 0}
                    />
                  </div>

                  {/* Best Setup */}
                  {sessionStats.bestSetup && (
                    <div className="mt-4 p-3 bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/30">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Award className="w-4 h-4 text-[var(--accent-primary)]" />
                          <span className="text-sm text-[var(--text-secondary)]">Best Setup</span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-[var(--accent-primary)]">
                            {sessionStats.bestSetup.symbol}
                          </span>
                          <span className="text-sm text-[var(--text-tertiary)] ml-2">
                            {sessionStats.bestSetup.confluence}% confluence
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Symbols Watched */}
                  {sessionStats.symbolsWatched.length > 0 && (
                    <div className="mt-4">
                      <p className="text-xs text-[var(--text-tertiary)] mb-2">Symbols Watched</p>
                      <div className="flex flex-wrap gap-2">
                        {sessionStats.symbolsWatched.map(symbol => (
                          <span
                            key={symbol}
                            className="px-2 py-1 text-xs font-mono bg-[var(--bg-tertiary)] text-[var(--text-secondary)]"
                          >
                            {symbol}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Weekly Stats */}
              {weeklyStats && (
                <div className="pt-4 border-t border-[var(--border-primary)]">
                  <h4 className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-3">
                    This Week
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard
                      icon={<Activity className="w-4 h-4" />}
                      label="Sessions"
                      value={weeklyStats.totalSessions}
                    />
                    <StatCard
                      icon={<Target className="w-4 h-4" />}
                      label="Total Setups"
                      value={weeklyStats.totalSetupsDetected}
                    />
                    <StatCard
                      icon={<TrendingUp className="w-4 h-4" />}
                      label="Setups Traded"
                      value={weeklyStats.totalSetupsTraded}
                      highlight={weeklyStats.totalSetupsTraded > 0}
                    />
                    <StatCard
                      icon={<Clock className="w-4 h-4" />}
                      label="Avg Session"
                      value={`${weeklyStats.avgSessionMinutes}m`}
                    />
                  </div>

                  {/* Best Performing Symbols */}
                  {weeklyStats.bestPerformingSymbols.length > 0 && (
                    <div className="mt-4">
                      <p className="text-xs text-[var(--text-tertiary)] mb-2">Top Symbols</p>
                      <div className="flex flex-wrap gap-2">
                        {weeklyStats.bestPerformingSymbols.slice(0, 5).map((item, idx) => (
                          <span
                            key={item.symbol}
                            className={cn(
                              'px-2 py-1 text-xs font-mono',
                              idx === 0
                                ? 'bg-[var(--accent-primary)]/20 text-[var(--accent-primary)]'
                                : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'
                            )}
                          >
                            {item.symbol} ({item.count})
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* No Session */}
              {!sessionStats && !weeklyStats && (
                <div className="text-center py-6">
                  <BarChart3 className="w-10 h-10 mx-auto mb-2 text-[var(--text-tertiary)] opacity-50" />
                  <p className="text-sm text-[var(--text-tertiary)]">
                    Start scanning to see session statistics
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  highlight = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  highlight?: boolean;
}) {
  return (
    <div className={cn(
      'p-3 bg-[var(--bg-tertiary)]',
      highlight && 'border border-[var(--accent-primary)]/30'
    )}>
      <div className="flex items-center gap-2 mb-1 text-[var(--text-tertiary)]">
        {icon}
        <span className="text-[10px] uppercase tracking-wider">{label}</span>
      </div>
      <div className={cn(
        'text-xl font-bold font-mono',
        highlight ? 'text-[var(--accent-primary)]' : 'text-[var(--text-primary)]'
      )}>
        {value}
      </div>
    </div>
  );
}

export default CompanionSessionReport;
