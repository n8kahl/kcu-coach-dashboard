import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getAuthenticatedUserId } from '@/lib/auth';
import {
  safeDivideValue,
  safeWinRate,
  safeProfitFactor,
  safeAverage,
} from '@/lib/number';

export async function GET(request: Request) {
  try {
    const userId = await getAuthenticatedUserId();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'all'; // 'week', 'month', 'year', 'all'

    // Calculate date range
    let startDate: string | null = null;
    const now = new Date();

    switch (period) {
      case 'week':
        startDate = new Date(now.setDate(now.getDate() - 7)).toISOString();
        break;
      case 'month':
        startDate = new Date(now.setMonth(now.getMonth() - 1)).toISOString();
        break;
      case 'year':
        startDate = new Date(now.setFullYear(now.getFullYear() - 1)).toISOString();
        break;
    }

    let query = supabaseAdmin
      .from('trade_journal')
      .select('*')
      .eq('user_id', userId);

    if (startDate) {
      query = query.gte('entry_time', startDate);
    }

    const { data: trades, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!trades || trades.length === 0) {
      return NextResponse.json({
        stats: {
          totalTrades: 0,
          winRate: 0,
          totalPnl: 0,
          avgPnl: 0,
          profitFactor: 0,
          avgWin: 0,
          avgLoss: 0,
          largestWin: 0,
          largestLoss: 0,
          ltpCompliance: 0,
          avgLtpScore: 0,
          winningStreak: 0,
          losingStreak: 0,
          emotionBreakdown: {},
          setupBreakdown: {},
        },
      });
    }

    // Calculate stats
    const winners = trades.filter((t) => t.pnl > 0);
    const losers = trades.filter((t) => t.pnl < 0);

    const totalPnl = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const totalWins = winners.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const totalLosses = Math.abs(losers.reduce((sum, t) => sum + (t.pnl || 0), 0));

    const ltpCompliantTrades = trades.filter(
      (t) => t.had_level && t.had_trend && t.had_patience_candle && t.followed_rules
    );

    // Calculate streaks
    let maxWinStreak = 0;
    let maxLoseStreak = 0;
    let tempStreak = 0;
    let lastResult: 'win' | 'loss' | null = null;
    let currentStreak = 0;

    const sortedTrades = [...trades].sort(
      (a, b) => new Date(a.entry_time).getTime() - new Date(b.entry_time).getTime()
    );

    for (const trade of sortedTrades) {
      const result = trade.pnl > 0 ? 'win' : 'loss';

      if (result === lastResult) {
        tempStreak++;
      } else {
        if (lastResult === 'win') {
          maxWinStreak = Math.max(maxWinStreak, tempStreak);
        } else if (lastResult === 'loss') {
          maxLoseStreak = Math.max(maxLoseStreak, tempStreak);
        }
        tempStreak = 1;
      }
      lastResult = result;
    }

    // Final streak check
    if (lastResult === 'win') {
      maxWinStreak = Math.max(maxWinStreak, tempStreak);
      currentStreak = tempStreak;
    } else if (lastResult === 'loss') {
      maxLoseStreak = Math.max(maxLoseStreak, tempStreak);
      currentStreak = -tempStreak;
    }

    // Define trade type for proper typing
    type Trade = (typeof trades)[number];

    // Emotion breakdown
    const emotionBreakdown: Record<string, { count: number; winRate: number; avgPnl: number }> = {};
    const emotionGroups: Record<string, Trade[]> = {};
    for (const t of trades) {
      const emotion = t.emotions || 'unknown';
      if (!emotionGroups[emotion]) emotionGroups[emotion] = [];
      emotionGroups[emotion].push(t);
    }

    for (const emotion of Object.keys(emotionGroups)) {
      const emotionTrades = emotionGroups[emotion];
      const emotionWins = emotionTrades.filter((t) => t.pnl > 0).length;
      const emotionPnl = emotionTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
      emotionBreakdown[emotion] = {
        count: emotionTrades.length,
        winRate: safeWinRate(emotionWins, emotionTrades.length),
        avgPnl: safeAverage(emotionPnl, emotionTrades.length),
      };
    }

    // Setup breakdown
    const setupBreakdown: Record<string, { count: number; winRate: number; avgPnl: number }> = {};
    const setupGroups: Record<string, Trade[]> = {};
    for (const t of trades) {
      const setup = t.setup_type || 'unknown';
      if (!setupGroups[setup]) setupGroups[setup] = [];
      setupGroups[setup].push(t);
    }

    for (const setup of Object.keys(setupGroups)) {
      const setupTrades = setupGroups[setup];
      const setupWins = setupTrades.filter((t) => t.pnl > 0).length;
      const setupPnl = setupTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
      setupBreakdown[setup] = {
        count: setupTrades.length,
        winRate: safeWinRate(setupWins, setupTrades.length),
        avgPnl: safeAverage(setupPnl, setupTrades.length),
      };
    }

    const stats = {
      totalTrades: trades.length,
      winRate: safeWinRate(winners.length, trades.length),
      totalPnl,
      avgPnl: safeAverage(totalPnl, trades.length),
      profitFactor: safeProfitFactor(totalWins, totalLosses),
      avgWin: safeAverage(totalWins, winners.length),
      avgLoss: safeAverage(totalLosses, losers.length),
      largestWin: winners.length > 0 ? Math.max(...winners.map((t) => t.pnl)) : 0,
      largestLoss: losers.length > 0 ? Math.min(...losers.map((t) => t.pnl)) : 0,
      ltpCompliance: safeWinRate(ltpCompliantTrades.length, trades.length),
      avgLtpScore: safeAverage(
        trades.reduce((sum, t) => sum + (t.ltp_grade?.score || 0), 0),
        trades.length
      ),
      winningStreak: maxWinStreak,
      losingStreak: maxLoseStreak,
      currentStreak,
      emotionBreakdown,
      setupBreakdown,
    };

    return NextResponse.json({ stats });
  } catch (error) {
    console.error('Error fetching trade stats:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
