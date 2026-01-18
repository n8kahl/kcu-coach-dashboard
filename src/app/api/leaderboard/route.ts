import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getAuthenticatedUserId } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const userId = await getAuthenticatedUserId();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'weekly'; // 'weekly' or 'monthly'
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
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get current user's rank
    let userRank = null;
    if (leaderboard?.rankings) {
      const userEntry = leaderboard.rankings.find(
        (r: { userId: string }) => r.userId === userId
      );
      if (userEntry) {
        userRank = userEntry;
      }
    }

    return NextResponse.json({
      leaderboard: leaderboard
        ? {
            ...leaderboard,
            rankings: leaderboard.rankings?.slice(0, limit) || [],
          }
        : null,
      userRank,
      period,
    });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
