/**
 * Practice Stats API
 *
 * GET /api/practice/stats - Get user's practice statistics with streak info
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import logger from '@/lib/logger';

export async function GET() {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get practice stats from the view
    const { data: analyticsData } = await supabaseAdmin
      .from('user_practice_analytics')
      .select('*')
      .eq('user_id', session.userId)
      .single();

    // Get streak data
    const { data: streakData } = await supabaseAdmin
      .from('practice_streaks')
      .select('*')
      .eq('user_id', session.userId)
      .eq('streak_type', 'correct_in_row')
      .single();

    // Get days practiced (unique dates with attempts)
    const { data: attemptDates } = await supabaseAdmin
      .from('practice_attempts')
      .select('created_at')
      .eq('user_id', session.userId);

    const uniqueDays = new Set(
      (attemptDates || []).map(a => new Date(a.created_at).toDateString())
    );

    const stats = {
      totalAttempts: analyticsData?.total_attempts || 0,
      correctAttempts: analyticsData?.correct_attempts || 0,
      accuracyPercent: analyticsData?.accuracy_percent || 0,
      uniqueScenarios: analyticsData?.unique_scenarios || 0,
      avgTimeSeconds: Math.round(analyticsData?.avg_time_seconds || 0),
      currentStreak: streakData?.current_count || 0,
      bestStreak: streakData?.best_count || 0,
      daysPracticed: uniqueDays.size,
      lastPracticeAt: analyticsData?.last_practice_at,
    };

    return NextResponse.json({ stats });
  } catch (error) {
    logger.error('Error fetching practice stats', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
