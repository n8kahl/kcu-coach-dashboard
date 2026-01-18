import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getAuthenticatedUserId } from '@/lib/auth';

interface AchievementRow {
  id: string;
  user_id: string;
  achievement_type: string;
  achievement_name: string;
  description: string;
  metadata?: Record<string, unknown>;
  earned_at: string;
}

export async function GET() {
  try {
    const userId = await getAuthenticatedUserId();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: achievements, error } = await supabaseAdmin
      .from('achievements')
      .select('*')
      .eq('user_id', userId)
      .order('earned_at', { ascending: false }) as { data: AchievementRow[] | null; error: { message: string } | null };

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Define all possible achievements with their requirements for progress tracking
    const achievementDefinitions = {
      first_trade: {
        name: 'First Trade',
        description: 'Logged your first trade',
        icon: '📈',
        category: 'milestone',
      },
      week_streak: {
        name: 'Week Warrior',
        description: '7-day engagement streak',
        icon: '🔥',
        category: 'streak',
      },
      quiz_master: {
        name: 'Quiz Master',
        description: '100% on 5 quizzes',
        icon: '🎓',
        category: 'learning',
      },
      ltp_compliant_10: {
        name: 'LTP Disciple',
        description: '10 fully LTP-compliant trades',
        icon: '✅',
        category: 'trading',
      },
      profitable_week: {
        name: 'Green Week',
        description: 'First profitable trading week',
        icon: '💚',
        category: 'trading',
      },
      patience_pays: {
        name: 'Patience Pays',
        description: '5 wins with patience candle confirmation',
        icon: '🕐',
        category: 'trading',
      },
      level_master: {
        name: 'Level Master',
        description: '10 wins at key support/resistance levels',
        icon: '📊',
        category: 'trading',
      },
      trend_rider: {
        name: 'Trend Rider',
        description: '10 wins trading with the trend',
        icon: '🏄',
        category: 'trading',
      },
      practice_pro: {
        name: 'Practice Pro',
        description: '20 practice scenarios completed',
        icon: '🎯',
        category: 'learning',
      },
      journal_regular: {
        name: 'Journal Regular',
        description: '30 days of trade logging',
        icon: '📝',
        category: 'consistency',
      },
      helping_hand: {
        name: 'Helping Hand',
        description: 'Helped 10 community members',
        icon: '🤝',
        category: 'community',
      },
      top_3_weekly: {
        name: 'Podium Finish',
        description: 'Top 3 on weekly leaderboard',
        icon: '🥉',
        category: 'competition',
      },
      top_1_weekly: {
        name: 'Champion',
        description: '#1 on weekly leaderboard',
        icon: '🏆',
        category: 'competition',
      },
    };

    // Merge earned achievements with definitions
    const earnedTypes = new Set(achievements?.map((a) => a.achievement_type) || []);

    const allAchievements = Object.entries(achievementDefinitions).map(([type, def]) => {
      const earned = achievements?.find((a) => a.achievement_type === type);
      return {
        type,
        ...def,
        earned: earnedTypes.has(type),
        earned_at: earned?.earned_at || null,
        metadata: earned?.metadata || null,
      };
    });

    return NextResponse.json({
      achievements: allAchievements,
      earnedCount: earnedTypes.size,
      totalCount: Object.keys(achievementDefinitions).length,
    });
  } catch (error) {
    console.error('Error fetching achievements:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
