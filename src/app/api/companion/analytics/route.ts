/**
 * Companion Analytics API
 *
 * GET /api/companion/analytics - Get companion usage analytics
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import logger from '@/lib/logger';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'week'; // day, week, month, all

    // Calculate date range
    let startDate: Date;
    const now = new Date();
    switch (period) {
      case 'day':
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 1);
        break;
      default:
        startDate = new Date(0); // All time
    }

    // Get sessions in period
    const { data: sessions, error: sessionsError } = await supabaseAdmin
      .from('companion_sessions')
      .select('*')
      .eq('user_id', session.userId)
      .gte('started_at', startDate.toISOString())
      .order('started_at', { ascending: false });

    if (sessionsError) {
      logger.error('Error fetching companion sessions', { error: sessionsError.message });
      return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
    }

    const sessionsList = sessions || [];

    // Calculate stats
    const totalSessions = sessionsList.length;
    const totalSetupsDetected = sessionsList.reduce((sum, s) => sum + (s.setups_detected || 0), 0);
    const totalSetupsTraded = sessionsList.reduce((sum, s) => sum + (s.setups_traded || 0), 0);
    const totalAlertsSet = sessionsList.reduce((sum, s) => sum + (s.alerts_set || 0), 0);
    const totalAlertsTriggered = sessionsList.reduce((sum, s) => sum + (s.alerts_triggered || 0), 0);
    const totalPracticeAttempts = sessionsList.reduce((sum, s) => sum + (s.practice_attempts || 0), 0);

    // Calculate average session duration
    const completedSessions = sessionsList.filter(s => s.ended_at);
    const avgSessionMinutes = completedSessions.length > 0
      ? Math.round(
          completedSessions.reduce((sum, s) => {
            const duration = (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 60000;
            return sum + duration;
          }, 0) / completedSessions.length
        )
      : 0;

    // Find best performing symbols
    const symbolCounts: Record<string, number> = {};
    sessionsList.forEach(s => {
      (s.symbols_watched || []).forEach((symbol: string) => {
        symbolCounts[symbol] = (symbolCounts[symbol] || 0) + 1;
      });
    });
    const bestPerformingSymbols = Object.entries(symbolCounts)
      .map(([symbol, count]) => ({ symbol, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Find most active day
    const dayCounts: Record<string, number> = {};
    sessionsList.forEach(s => {
      const day = new Date(s.started_at).toLocaleDateString('en-US', { weekday: 'long' });
      dayCounts[day] = (dayCounts[day] || 0) + 1;
    });
    const mostActiveDay = Object.entries(dayCounts)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

    // Get daily breakdown for charts
    const dailyBreakdown: Array<{
      date: string;
      sessions: number;
      setups: number;
      traded: number;
    }> = [];

    if (period === 'week' || period === 'month') {
      const dayMap: Record<string, { sessions: number; setups: number; traded: number }> = {};

      sessionsList.forEach(s => {
        const dateKey = new Date(s.started_at).toISOString().split('T')[0];
        if (!dayMap[dateKey]) {
          dayMap[dateKey] = { sessions: 0, setups: 0, traded: 0 };
        }
        dayMap[dateKey].sessions++;
        dayMap[dateKey].setups += s.setups_detected || 0;
        dayMap[dateKey].traded += s.setups_traded || 0;
      });

      Object.entries(dayMap)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .forEach(([date, data]) => {
          dailyBreakdown.push({ date, ...data });
        });
    }

    return NextResponse.json({
      stats: {
        totalSessions,
        totalSetupsDetected,
        totalSetupsTraded,
        totalAlertsSet,
        totalAlertsTriggered,
        totalPracticeAttempts,
        avgSessionMinutes,
        bestPerformingSymbols,
        mostActiveDay,
        tradeRate: totalSetupsDetected > 0
          ? Math.round((totalSetupsTraded / totalSetupsDetected) * 100)
          : 0,
        alertTriggerRate: totalAlertsSet > 0
          ? Math.round((totalAlertsTriggered / totalAlertsSet) * 100)
          : 0,
      },
      dailyBreakdown,
      period,
      startDate: startDate.toISOString(),
    });
  } catch (error) {
    logger.error('Error in companion analytics', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
