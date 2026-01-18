import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getAuthenticatedUser } from '@/lib/auth';

export async function GET() {
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

    return NextResponse.json({
      currentModule: user.current_module,
      modules: modulesWithProgress,
      overallCompletion,
      totalTopicsCompleted: modulesWithProgress.reduce((sum, m) => sum + m.completedTopics, 0),
      totalTopics: modulesWithProgress.reduce((sum, m) => sum + m.totalTopics, 0),
    });
  } catch (error) {
    console.error('Error fetching progress:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
