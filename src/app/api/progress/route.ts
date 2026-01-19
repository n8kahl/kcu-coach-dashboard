/**
 * @deprecated Use /api/learning/v2/progress instead
 * This route is maintained for backward compatibility only.
 * It proxies to the v2 API and transforms the response.
 */
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getAuthenticatedUser } from '@/lib/auth';

export async function GET(request: Request) {
  // Log deprecation warning
  console.warn('[DEPRECATED] /api/progress is deprecated. Use /api/learning/v2/progress');

  // Build the v2 URL from the current request
  const url = new URL(request.url);
  const v2Url = new URL('/api/learning/v2/progress', url.origin);

  try {
    // Fetch from v2 API (internal call)
    const v2Response = await fetch(v2Url.toString(), {
      headers: request.headers,
    });

    if (!v2Response.ok) {
      const error = await v2Response.json();
      return NextResponse.json(error, { status: v2Response.status });
    }

    const v2Data = await v2Response.json();

    // Transform v2 response to legacy format
    type ModuleProgressData = { completed: number; total: number };
    const modulesData = (v2Data.modules || {}) as Record<string, ModuleProgressData>;
    const legacyResponse = {
      overall: v2Data.overall?.progressPercent || 0,
      streak: v2Data.streak?.current || 0,
      modules: Object.entries(modulesData).map(([id, data]) => ({
        name: id.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
        progress: data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0,
      })),
      // Also include v2 format for consumers that support it
      ...v2Data,
    };

    const response = NextResponse.json(legacyResponse);
    response.headers.set('X-Deprecated', 'Use /api/learning/v2/progress');
    return response;
  } catch {
    // Fallback to legacy implementation if v2 call fails
    return legacyGetProgress();
  }
}

// Legacy implementation as fallback
async function legacyGetProgress() {
  try {
    const sessionUser = await getAuthenticatedUser();

    if (!sessionUser?.discordId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user ID from Discord ID
    const { data: user } = await supabaseAdmin
      .from('user_profiles')
      .select('id, current_module')
      .eq('discord_id', sessionUser.discordId)
      .single();

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get learning progress
    const { data: progress, error } = await supabaseAdmin
      .from('learning_progress')
      .select('*')
      .eq('user_id', user.id)
      .order('module', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Define module structure
    const modules = [
      {
        id: 'fundamentals',
        name: 'Trading Fundamentals',
        description: 'Core concepts every trader needs to know',
        topics: [
          'market_structure',
          'order_types',
          'risk_management',
          'position_sizing',
          'trading_psychology',
        ],
      },
      {
        id: 'ltp_framework',
        name: 'LTP Framework',
        description: 'Levels, Trends, and Patience Candles',
        topics: [
          'support_resistance',
          'trend_identification',
          'patience_candles',
          'entry_criteria',
          'exit_strategies',
        ],
      },
      {
        id: 'entry_exit',
        name: 'Entry & Exit Mastery',
        description: 'Perfecting your trade execution',
        topics: [
          'entry_timing',
          'stop_placement',
          'profit_targets',
          'scaling_in_out',
          'trade_management',
        ],
      },
      {
        id: 'psychology',
        name: 'Trading Psychology',
        description: 'Master your emotions and mindset',
        topics: ['fear_greed', 'discipline', 'patience', 'loss_handling', 'confidence'],
      },
      {
        id: 'advanced',
        name: 'Advanced Strategies',
        description: 'Level up your trading game',
        topics: [
          'options_basics',
          'multi_timeframe',
          'volatility_trading',
          'news_trading',
          'portfolio_management',
        ],
      },
    ];

    // Merge progress data with module structure
    const progressByKey = (progress || []).reduce(
      (acc, p) => {
        acc[`${p.module}:${p.topic}`] = p;
        return acc;
      },
      {} as Record<string, (typeof progress)[number]>
    );

    const modulesWithProgress = modules.map((module) => {
      const topicsWithProgress = module.topics.map((topic) => {
        const key = `${module.id}:${topic}`;
        const topicProgress = progressByKey[key];

        return {
          id: topic,
          name: topic.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
          status: topicProgress?.status || 'not_started',
          completion_percentage: topicProgress?.completion_percentage || 0,
          quiz_attempts: topicProgress?.quiz_attempts || 0,
          quiz_best_score: topicProgress?.quiz_best_score || 0,
          time_spent_seconds: topicProgress?.time_spent_seconds || 0,
        };
      });

      const completedTopics = topicsWithProgress.filter(
        (t) => t.status === 'completed' || t.status === 'mastered'
      ).length;

      const totalCompletion = Math.round(
        topicsWithProgress.reduce((sum, t) => sum + t.completion_percentage, 0) /
          topicsWithProgress.length
      );

      return {
        ...module,
        topics: topicsWithProgress,
        completedTopics,
        totalTopics: module.topics.length,
        completionPercentage: totalCompletion,
        status:
          totalCompletion >= 90
            ? 'mastered'
            : totalCompletion >= 70
              ? 'completed'
              : totalCompletion > 0
                ? 'in_progress'
                : 'not_started',
      };
    });

    // Calculate overall progress
    const overallCompletion = Math.round(
      modulesWithProgress.reduce((sum, m) => sum + m.completionPercentage, 0) /
        modulesWithProgress.length
    );

    // Get user's current streak
    const { data: userProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('current_streak, last_active_date')
      .eq('id', user.id)
      .single();

    const streak = userProfile?.current_streak || 0;

    return NextResponse.json({
      currentModule: user.current_module,
      modules: modulesWithProgress,
      overallCompletion,
      overall: overallCompletion,
      streak,
      totalTopicsCompleted: modulesWithProgress.reduce((sum, m) => sum + m.completedTopics, 0),
      totalTopics: modulesWithProgress.reduce((sum, m) => sum + m.totalTopics, 0),
      progress: modulesWithProgress.reduce(
        (acc, m) => {
          acc[`mod_${m.id}`] = {
            completed: m.completedTopics,
            total: m.totalTopics,
          };
          return acc;
        },
        {} as Record<string, { completed: number; total: number }>
      ),
    });
  } catch (error) {
    console.error('Error fetching progress:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
