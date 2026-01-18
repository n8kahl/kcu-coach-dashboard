import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getAuthenticatedUserId } from '@/lib/auth';
import type { LeaderboardEntry } from '@/types';

// Interface for database rankings
interface RankingEntry {
  userId: string;
  username: string;
  avatar?: string;
  score: number;
  winRate: number;
  totalTrades: number;
  streak: number;
  badges?: string[];
  previousRank?: number;
}

export async function GET(request: Request) {
  try {
    const userId = await getAuthenticatedUserId();

    // Allow unauthenticated access to leaderboard (public data)
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'weekly';
    const limit = parseInt(searchParams.get('limit') || '10');

    // Get the most recent leaderboard for the period
    const { data: leaderboard, error } = await supabaseAdmin
      .from('leaderboards')
      .select('*')
      .eq('period_type', period)
      .order('period_start', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Leaderboard fetch error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Transform rankings to LeaderboardEntry format
    const rankings: RankingEntry[] = leaderboard?.rankings || [];
    const entries: LeaderboardEntry[] = rankings.slice(0, limit).map((r, index) => {
      const currentRank = index + 1;
      const previousRank = r.previousRank || currentRank;

      let change: 'up' | 'down' | 'same' = 'same';
      let changeAmount: number | undefined;

      if (previousRank > currentRank) {
        change = 'up';
        changeAmount = previousRank - currentRank;
      } else if (previousRank < currentRank) {
        change = 'down';
        changeAmount = currentRank - previousRank;
      }

      return {
        rank: currentRank,
        user_id: r.userId,
        username: r.username,
        avatar: r.avatar,
        score: r.score,
        win_rate: r.winRate,
        total_trades: r.totalTrades,
        streak: r.streak,
        badges: r.badges || [],
        change,
        change_amount: changeAmount,
      };
    });

    // Get current user's rank if authenticated
    let userRank: LeaderboardEntry | null = null;
    if (userId && rankings.length > 0) {
      const userIndex = rankings.findIndex((r) => r.userId === userId);
      if (userIndex !== -1) {
        const r = rankings[userIndex];
        const currentRank = userIndex + 1;
        const previousRank = r.previousRank || currentRank;

        let change: 'up' | 'down' | 'same' = 'same';
        let changeAmount: number | undefined;

        if (previousRank > currentRank) {
          change = 'up';
          changeAmount = previousRank - currentRank;
        } else if (previousRank < currentRank) {
          change = 'down';
          changeAmount = currentRank - previousRank;
        }

        userRank = {
          rank: currentRank,
          user_id: r.userId,
          username: r.username,
          avatar: r.avatar,
          score: r.score,
          win_rate: r.winRate,
          total_trades: r.totalTrades,
          streak: r.streak,
          badges: r.badges || [],
          change,
          change_amount: changeAmount,
        };
      }
    }

    return NextResponse.json({
      entries,
      userRank,
      period,
      periodStart: leaderboard?.period_start,
      periodEnd: leaderboard?.period_end,
    });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
