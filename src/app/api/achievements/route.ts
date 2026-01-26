import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getAuthenticatedUserId } from '@/lib/auth';

// ============================================================================
// TYPES
// ============================================================================

interface AchievementRow {
  id: string;
  user_id: string;
  achievement_type: string;
  achievement_name: string;
  description: string;
  metadata?: Record<string, unknown>;
  earned_at: string;
}

type RarityTier = 'common' | 'rare' | 'epic' | 'legendary';

interface AchievementDefinition {
  name: string;
  description: string;
  icon: string;
  category: 'milestone' | 'streak' | 'learning' | 'trading' | 'consistency' | 'community' | 'competition';
  criteria?: {
    stat: string;
    threshold: number;
    comparison: 'gte' | 'eq';
  };
  // Visual customization
  glowColor?: string;
  borderGradient?: string[];
}

// ============================================================================
// ACHIEVEMENT DEFINITIONS
// ============================================================================

const achievementDefinitions: Record<string, AchievementDefinition> = {
  first_trade: {
    name: 'First Trade',
    description: 'Logged your first trade',
    icon: '📈',
    category: 'milestone',
    criteria: { stat: 'total_trades', threshold: 1, comparison: 'gte' },
    glowColor: 'rgba(59, 130, 246, 0.5)',
  },
  week_streak: {
    name: 'Week Warrior',
    description: '7-day engagement streak',
    icon: '🔥',
    category: 'streak',
    criteria: { stat: 'current_streak', threshold: 7, comparison: 'gte' },
    glowColor: 'rgba(249, 115, 22, 0.5)',
  },
  quiz_master: {
    name: 'Quiz Master',
    description: '100% on 5 quizzes',
    icon: '🎓',
    category: 'learning',
    criteria: { stat: 'perfect_quizzes', threshold: 5, comparison: 'gte' },
    glowColor: 'rgba(168, 85, 247, 0.5)',
  },
  ltp_compliant_10: {
    name: 'LTP Disciple',
    description: '10 fully LTP-compliant trades',
    icon: '✅',
    category: 'trading',
    criteria: { stat: 'ltp_compliant_trades', threshold: 10, comparison: 'gte' },
    glowColor: 'rgba(16, 185, 129, 0.5)',
  },
  profitable_week: {
    name: 'Green Week',
    description: 'First profitable trading week',
    icon: '💚',
    category: 'trading',
    criteria: { stat: 'profitable_weeks', threshold: 1, comparison: 'gte' },
    glowColor: 'rgba(34, 197, 94, 0.5)',
  },
  patience_pays: {
    name: 'Patience Pays',
    description: '5 wins with patience candle confirmation',
    icon: '🕐',
    category: 'trading',
    criteria: { stat: 'patience_candle_wins', threshold: 5, comparison: 'gte' },
    glowColor: 'rgba(99, 102, 241, 0.5)',
  },
  level_master: {
    name: 'Level Master',
    description: '10 wins at key support/resistance levels',
    icon: '📊',
    category: 'trading',
    criteria: { stat: 'key_level_wins', threshold: 10, comparison: 'gte' },
    glowColor: 'rgba(236, 72, 153, 0.5)',
  },
  trend_rider: {
    name: 'Trend Rider',
    description: '10 wins trading with the trend',
    icon: '🏄',
    category: 'trading',
    criteria: { stat: 'trend_aligned_wins', threshold: 10, comparison: 'gte' },
    glowColor: 'rgba(14, 165, 233, 0.5)',
  },
  practice_pro: {
    name: 'Practice Pro',
    description: '20 practice scenarios completed',
    icon: '🎯',
    category: 'learning',
    criteria: { stat: 'practice_completed', threshold: 20, comparison: 'gte' },
    glowColor: 'rgba(245, 158, 11, 0.5)',
  },
  journal_regular: {
    name: 'Journal Regular',
    description: '30 days of trade logging',
    icon: '📝',
    category: 'consistency',
    criteria: { stat: 'logging_days', threshold: 30, comparison: 'gte' },
    glowColor: 'rgba(139, 92, 246, 0.5)',
  },
  helping_hand: {
    name: 'Helping Hand',
    description: 'Helped 10 community members',
    icon: '🤝',
    category: 'community',
    criteria: { stat: 'community_helps', threshold: 10, comparison: 'gte' },
    glowColor: 'rgba(251, 146, 60, 0.5)',
  },
  top_3_weekly: {
    name: 'Podium Finish',
    description: 'Top 3 on weekly leaderboard',
    icon: '🥉',
    category: 'competition',
    criteria: { stat: 'weekly_top_3_finishes', threshold: 1, comparison: 'gte' },
    glowColor: 'rgba(212, 175, 55, 0.5)',
    borderGradient: ['#CD7F32', '#B87333', '#CD7F32'],
  },
  top_1_weekly: {
    name: 'Champion',
    description: '#1 on weekly leaderboard',
    icon: '🏆',
    category: 'competition',
    criteria: { stat: 'weekly_wins', threshold: 1, comparison: 'gte' },
    glowColor: 'rgba(212, 175, 55, 0.7)',
    borderGradient: ['#FFD700', '#FFA500', '#FFD700'],
  },
  // Additional legendary achievements
  course_completer: {
    name: 'Course Graduate',
    description: 'Completed an entire course',
    icon: '🎖️',
    category: 'learning',
    criteria: { stat: 'courses_completed', threshold: 1, comparison: 'gte' },
    glowColor: 'rgba(212, 175, 55, 0.5)',
  },
  hundred_trades: {
    name: 'Century Trader',
    description: 'Logged 100 trades',
    icon: '💯',
    category: 'milestone',
    criteria: { stat: 'total_trades', threshold: 100, comparison: 'gte' },
    glowColor: 'rgba(220, 38, 127, 0.5)',
  },
  month_streak: {
    name: 'Month Master',
    description: '30-day engagement streak',
    icon: '⭐',
    category: 'streak',
    criteria: { stat: 'current_streak', threshold: 30, comparison: 'gte' },
    glowColor: 'rgba(212, 175, 55, 0.6)',
    borderGradient: ['#C0C0C0', '#E8E8E8', '#C0C0C0'],
  },
};

// ============================================================================
// RARITY CALCULATION
// ============================================================================

function getRarityTier(percentage: number): RarityTier {
  if (percentage <= 1) return 'legendary';   // ≤1% of users
  if (percentage <= 5) return 'epic';        // ≤5% of users
  if (percentage <= 20) return 'rare';       // ≤20% of users
  return 'common';                           // >20% of users
}

function getRarityConfig(tier: RarityTier) {
  switch (tier) {
    case 'legendary':
      return {
        label: 'Legendary',
        color: '#FFD700',
        bgGradient: 'linear-gradient(135deg, rgba(212,175,55,0.2) 0%, rgba(255,215,0,0.1) 100%)',
        borderGlow: '0 0 20px rgba(212,175,55,0.5)',
        holographic: true,
      };
    case 'epic':
      return {
        label: 'Epic',
        color: '#A855F7',
        bgGradient: 'linear-gradient(135deg, rgba(168,85,247,0.2) 0%, rgba(139,92,246,0.1) 100%)',
        borderGlow: '0 0 15px rgba(168,85,247,0.4)',
        holographic: false,
      };
    case 'rare':
      return {
        label: 'Rare',
        color: '#3B82F6',
        bgGradient: 'linear-gradient(135deg, rgba(59,130,246,0.2) 0%, rgba(96,165,250,0.1) 100%)',
        borderGlow: '0 0 10px rgba(59,130,246,0.3)',
        holographic: false,
      };
    default:
      return {
        label: 'Common',
        color: '#6B7280',
        bgGradient: 'linear-gradient(135deg, rgba(107,114,128,0.1) 0%, rgba(156,163,175,0.05) 100%)',
        borderGlow: 'none',
        holographic: false,
      };
  }
}

// ============================================================================
// DYNAMIC ACHIEVEMENT CHECK
// ============================================================================

interface UserStats {
  total_trades: number;
  current_streak: number;
  perfect_quizzes: number;
  ltp_compliant_trades: number;
  profitable_weeks: number;
  patience_candle_wins: number;
  key_level_wins: number;
  trend_aligned_wins: number;
  practice_completed: number;
  logging_days: number;
  community_helps: number;
  weekly_top_3_finishes: number;
  weekly_wins: number;
  courses_completed: number;
}

async function getUserStats(userId: string): Promise<UserStats | null> {
  try {
    // Fetch user stats from multiple sources
    const [
      { data: tradesData },
      { data: streakData },
      { data: quizData },
      { data: courseData },
    ] = await Promise.all([
      // Trade statistics
      supabaseAdmin
        .from('trade_logs')
        .select('id, ltp_compliant, patience_candle, at_key_level, with_trend, outcome')
        .eq('user_id', userId),
      // Engagement streak from user_profiles or dedicated streak table
      supabaseAdmin
        .from('user_profiles')
        .select('current_streak, longest_streak')
        .eq('user_id', userId)
        .single(),
      // Quiz statistics
      supabaseAdmin
        .from('quiz_attempts')
        .select('score, passed')
        .eq('user_id', userId),
      // Course completion
      supabaseAdmin
        .from('course_progress')
        .select('completion_percent')
        .eq('user_id', userId),
    ]);

    // Calculate derived stats
    const trades = tradesData || [];
    const quizzes = quizData || [];
    const courses = courseData || [];

    const wins = trades.filter(t => t.outcome === 'win');

    return {
      total_trades: trades.length,
      current_streak: streakData?.current_streak || 0,
      perfect_quizzes: quizzes.filter(q => q.score === 100).length,
      ltp_compliant_trades: trades.filter(t => t.ltp_compliant).length,
      profitable_weeks: 0, // Would need weekly aggregation
      patience_candle_wins: wins.filter(t => t.patience_candle).length,
      key_level_wins: wins.filter(t => t.at_key_level).length,
      trend_aligned_wins: wins.filter(t => t.with_trend).length,
      practice_completed: 0, // Would need practice scenarios table
      logging_days: new Set(trades.map(t => new Date(t.id).toDateString())).size,
      community_helps: 0, // Would need community interactions table
      weekly_top_3_finishes: 0, // Would need leaderboard history
      weekly_wins: 0, // Would need leaderboard history
      courses_completed: courses.filter(c => c.completion_percent >= 100).length,
    };
  } catch (error) {
    console.error('Error fetching user stats:', error);
    return null;
  }
}

function checkAchievementCriteria(
  definition: AchievementDefinition,
  stats: UserStats
): { met: boolean; progress: number; threshold: number } {
  if (!definition.criteria) {
    return { met: false, progress: 0, threshold: 1 };
  }

  const { stat, threshold, comparison } = definition.criteria;
  const currentValue = stats[stat as keyof UserStats] || 0;

  const met = comparison === 'gte'
    ? currentValue >= threshold
    : currentValue === threshold;

  return {
    met,
    progress: Math.min(currentValue, threshold),
    threshold,
  };
}

async function awardAchievement(
  userId: string,
  achievementType: string,
  definition: AchievementDefinition
): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin.from('achievements').insert({
      user_id: userId,
      achievement_type: achievementType,
      achievement_name: definition.name,
      description: definition.description,
      metadata: {
        icon: definition.icon,
        category: definition.category,
        awarded_automatically: true,
      },
      earned_at: new Date().toISOString(),
    });

    if (error) {
      // Ignore duplicate errors (already earned)
      if (error.code === '23505') return false;
      throw error;
    }

    return true;
  } catch (error) {
    console.error(`Error awarding achievement ${achievementType}:`, error);
    return false;
  }
}

// ============================================================================
// API HANDLER
// ============================================================================

export async function GET(request: Request) {
  try {
    const userId = await getAuthenticatedUserId();

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const syncAchievements = url.searchParams.get('sync') === 'true';
    const category = url.searchParams.get('category');

    // Fetch user's earned achievements
    const { data: achievements, error } = await supabaseAdmin
      .from('achievements')
      .select('*')
      .eq('user_id', userId)
      .order('earned_at', { ascending: false }) as {
        data: AchievementRow[] | null;
        error: { message: string } | null
      };

    if (error) {
      return NextResponse.json(
        { error: error.message, code: 'DB_ERROR' },
        { status: 500 }
      );
    }

    // Fetch rarity data (how many users have each achievement)
    const { data: rarityData } = await supabaseAdmin
      .from('achievements')
      .select('achievement_type')
      .then(async (result) => {
        if (!result.data) return { data: null };

        // Get total user count for percentage calculation
        const { count: totalUsers } = await supabaseAdmin
          .from('user_profiles')
          .select('*', { count: 'exact', head: true });

        // Count achievements per type
        const counts: Record<string, number> = {};
        result.data.forEach((a: { achievement_type: string }) => {
          counts[a.achievement_type] = (counts[a.achievement_type] || 0) + 1;
        });

        // Calculate percentages
        const percentages: Record<string, number> = {};
        const userCount = totalUsers || 1;
        Object.entries(counts).forEach(([type, count]) => {
          percentages[type] = Math.round((count / userCount) * 100);
        });

        return { data: percentages };
      });

    const rarityPercentages = rarityData || {};
    const earnedTypes = new Set(achievements?.map((a) => a.achievement_type) || []);

    // Optional: Sync achievements (check and auto-award)
    let newlyAwarded: string[] = [];
    if (syncAchievements) {
      const userStats = await getUserStats(userId);

      if (userStats) {
        for (const [type, definition] of Object.entries(achievementDefinitions)) {
          if (!earnedTypes.has(type) && definition.criteria) {
            const { met } = checkAchievementCriteria(definition, userStats);
            if (met) {
              const awarded = await awardAchievement(userId, type, definition);
              if (awarded) {
                newlyAwarded.push(type);
                earnedTypes.add(type);
              }
            }
          }
        }
      }
    }

    // Get user stats for progress tracking
    const userStats = syncAchievements ? null : await getUserStats(userId);

    // Build response with enhanced metadata
    let filteredDefinitions = Object.entries(achievementDefinitions);
    if (category) {
      filteredDefinitions = filteredDefinitions.filter(
        ([_, def]) => def.category === category
      );
    }

    const allAchievements = filteredDefinitions.map(([type, def]) => {
      const earned = achievements?.find((a) => a.achievement_type === type);
      const rarityPercent = rarityPercentages[type] || 0;
      const rarityTier = getRarityTier(rarityPercent);
      const rarityConfig = getRarityConfig(rarityTier);

      // Calculate progress for unearned achievements
      let progress = null;
      if (!earnedTypes.has(type) && userStats && def.criteria) {
        const result = checkAchievementCriteria(def, userStats);
        progress = {
          current: result.progress,
          target: result.threshold,
          percent: Math.round((result.progress / result.threshold) * 100),
        };
      }

      return {
        type,
        name: def.name,
        description: def.description,
        icon: def.icon,
        category: def.category,
        earned: earnedTypes.has(type),
        earned_at: earned?.earned_at || null,
        metadata: earned?.metadata || null,
        // Rarity info
        rarity: {
          tier: rarityTier,
          percentage: rarityPercent,
          label: rarityConfig.label,
          description: rarityPercent > 0
            ? `Only ${rarityPercent}% of traders have this`
            : 'Be the first to earn this!',
        },
        // Visual styling hints
        visual: {
          glowColor: def.glowColor,
          borderGradient: def.borderGradient,
          bgGradient: rarityConfig.bgGradient,
          borderGlow: rarityConfig.borderGlow,
          holographic: rarityConfig.holographic,
          color: rarityConfig.color,
        },
        // Progress tracking for unearned
        progress,
      };
    });

    // Sort: earned first (by date), then by progress percentage
    allAchievements.sort((a, b) => {
      if (a.earned && !b.earned) return -1;
      if (!a.earned && b.earned) return 1;
      if (a.earned && b.earned) {
        return new Date(b.earned_at!).getTime() - new Date(a.earned_at!).getTime();
      }
      // Sort unearned by progress
      const aProgress = a.progress?.percent || 0;
      const bProgress = b.progress?.percent || 0;
      return bProgress - aProgress;
    });

    // Identify "almost there" achievements (>50% progress)
    const almostThere = allAchievements.filter(
      a => !a.earned && a.progress && a.progress.percent >= 50
    );

    // Category breakdown
    const categories = Array.from(new Set(allAchievements.map(a => a.category)));
    const categoryStats = categories.map(cat => ({
      category: cat,
      total: allAchievements.filter(a => a.category === cat).length,
      earned: allAchievements.filter(a => a.category === cat && a.earned).length,
    }));

    const response = NextResponse.json({
      achievements: allAchievements,
      summary: {
        earnedCount: earnedTypes.size,
        totalCount: Object.keys(achievementDefinitions).length,
        completionPercent: Math.round(
          (earnedTypes.size / Object.keys(achievementDefinitions).length) * 100
        ),
      },
      almostThere,
      categoryStats,
      newlyAwarded: newlyAwarded.length > 0 ? newlyAwarded : undefined,
    });

    // Add caching headers
    response.headers.set(
      'Cache-Control',
      'private, s-maxage=60, stale-while-revalidate=300'
    );

    return response;
  } catch (error) {
    console.error('Error fetching achievements:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'SERVER_ERROR' },
      { status: 500 }
    );
  }
}

// ============================================================================
// SYNC ENDPOINT
// ============================================================================

export async function POST(request: Request) {
  try {
    const userId = await getAuthenticatedUserId();

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
        { status: 401 }
      );
    }

    // Get current achievements
    const { data: achievements } = await supabaseAdmin
      .from('achievements')
      .select('achievement_type')
      .eq('user_id', userId);

    const earnedTypes = new Set(achievements?.map(a => a.achievement_type) || []);

    // Get user stats
    const userStats = await getUserStats(userId);

    if (!userStats) {
      return NextResponse.json(
        { error: 'Could not fetch user stats', code: 'STATS_ERROR' },
        { status: 500 }
      );
    }

    // Check and award any new achievements
    const newlyAwarded: Array<{
      type: string;
      name: string;
      description: string;
      icon: string;
    }> = [];

    for (const [type, definition] of Object.entries(achievementDefinitions)) {
      if (!earnedTypes.has(type) && definition.criteria) {
        const { met } = checkAchievementCriteria(definition, userStats);
        if (met) {
          const awarded = await awardAchievement(userId, type, definition);
          if (awarded) {
            newlyAwarded.push({
              type,
              name: definition.name,
              description: definition.description,
              icon: definition.icon,
            });
          }
        }
      }
    }

    return NextResponse.json({
      synced: true,
      newlyAwarded,
      message: newlyAwarded.length > 0
        ? `Congratulations! You earned ${newlyAwarded.length} new achievement(s)!`
        : 'All achievements are up to date.',
    });
  } catch (error) {
    console.error('Error syncing achievements:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'SERVER_ERROR' },
      { status: 500 }
    );
  }
}
