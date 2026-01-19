/**
 * @deprecated Use /api/achievements instead
 * This route is part of the Thinkific-based learning system.
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getAuthenticatedUser } from '@/lib/auth';

// GET - Fetch learning achievements (DEPRECATED)
export async function GET() {
  try {
    const sessionUser = await getAuthenticatedUser();

    if (!sessionUser?.discordId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: user } = await supabaseAdmin
      .from('user_profiles')
      .select('id')
      .eq('discord_id', sessionUser.discordId)
      .single();

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get all achievements with user's earned status
    const { data: achievements, error: achievementsError } = await supabaseAdmin
      .from('learning_achievements')
      .select('*')
      .order('sort_order', { ascending: true });

    if (achievementsError) {
      throw achievementsError;
    }

    // Get user's earned achievements
    const { data: earnedAchievements } = await supabaseAdmin
      .from('user_learning_achievements')
      .select('achievement_id, earned_at, context')
      .eq('user_id', user.id);

    const earnedMap = new Map(
      (earnedAchievements || []).map(ea => [ea.achievement_id, ea])
    );

    const transformedAchievements = (achievements || []).map(achievement => {
      const earned = earnedMap.get(achievement.id);
      return {
        id: achievement.id,
        slug: achievement.slug,
        title: achievement.title,
        description: achievement.description,
        icon: achievement.icon,
        criteria: achievement.criteria,
        sortOrder: achievement.sort_order,
        isSecret: achievement.is_secret,
        earnedAt: earned?.earned_at || null,
        context: earned?.context || null,
      };
    });

    return NextResponse.json({ achievements: transformedAchievements });
  } catch (error) {
    console.error('Error fetching achievements:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Check and award achievements
export async function POST(request: NextRequest) {
  try {
    const sessionUser = await getAuthenticatedUser();

    if (!sessionUser?.discordId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: user } = await supabaseAdmin
      .from('user_profiles')
      .select('id')
      .eq('discord_id', sessionUser.discordId)
      .single();

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const { courseId } = body;

    // Get all unearned achievements
    const { data: achievements } = await supabaseAdmin
      .from('learning_achievements')
      .select('*');

    const { data: earnedAchievements } = await supabaseAdmin
      .from('user_learning_achievements')
      .select('achievement_id')
      .eq('user_id', user.id);

    const earnedIds = new Set((earnedAchievements || []).map(ea => ea.achievement_id));
    const unearnedAchievements = (achievements || []).filter(a => !earnedIds.has(a.id));

    // Get user stats for checking criteria
    const stats = await getUserStats(user.id, courseId);

    // Check each unearned achievement
    const newlyEarned: { id: string; title: string }[] = [];

    for (const achievement of unearnedAchievements) {
      const criteria = achievement.criteria as Record<string, unknown>;
      let earned = false;
      let context: Record<string, unknown> | null = null;

      switch (criteria.type) {
        case 'lessons_completed':
          if (stats.lessonsCompleted >= (criteria.count as number)) {
            earned = true;
            context = { lessonsCompleted: stats.lessonsCompleted };
          }
          break;

        case 'modules_completed':
          if (stats.modulesCompleted >= (criteria.count as number)) {
            earned = true;
            context = { modulesCompleted: stats.modulesCompleted };
          }
          break;

        case 'streak_days':
          if (stats.currentStreak >= (criteria.count as number)) {
            earned = true;
            context = { streak: stats.currentStreak };
          }
          break;

        case 'daily_lessons':
          if (stats.todayLessonsCompleted >= (criteria.count as number)) {
            earned = true;
            context = { lessonsToday: stats.todayLessonsCompleted };
          }
          break;

        case 'daily_watch_hours':
          if (stats.todayWatchHours >= (criteria.hours as number)) {
            earned = true;
            context = { hoursToday: stats.todayWatchHours };
          }
          break;

        case 'perfect_quiz':
          if (stats.perfectQuizzes >= (criteria.count as number)) {
            earned = true;
          }
          break;

        case 'all_quizzes_passed':
          if (stats.allQuizzesPassed) {
            earned = true;
          }
          break;

        case 'watch_time_hours':
          if (stats.totalWatchHours >= (criteria.hours as number)) {
            earned = true;
            context = { totalHours: stats.totalWatchHours };
          }
          break;

        case 'course_percent':
          if (stats.courseCompletionPercent >= (criteria.value as number)) {
            earned = true;
            context = { completionPercent: stats.courseCompletionPercent };
          }
          break;
      }

      if (earned) {
        // Award the achievement
        await supabaseAdmin
          .from('user_learning_achievements')
          .insert({
            user_id: user.id,
            achievement_id: achievement.id,
            earned_at: new Date().toISOString(),
            context,
          });

        newlyEarned.push({ id: achievement.id, title: achievement.title });
      }
    }

    return NextResponse.json({
      newlyEarned,
      totalEarned: earnedIds.size + newlyEarned.length,
    });
  } catch (error) {
    console.error('Error checking achievements:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function getUserStats(userId: string, courseId?: string) {
  // Get lesson completion count
  const { count: lessonsCompleted } = await supabaseAdmin
    .from('course_lesson_progress')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('completed', true);

  // Get module completion count (simplified - modules where all required lessons are complete)
  const { data: moduleData } = await supabaseAdmin.rpc('get_course_progress', {
    p_user_id: userId,
    p_course_id: courseId || '00000000-0000-0000-0000-000000000000',
  });

  // Get streak
  const { data: streak } = await supabaseAdmin
    .from('user_learning_streaks')
    .select('current_streak')
    .eq('user_id', userId)
    .single();

  // Get today's activity
  const today = new Date().toISOString().split('T')[0];
  const { data: todayActivity } = await supabaseAdmin
    .from('user_daily_activity')
    .select('lessons_completed, watch_time_seconds')
    .eq('user_id', userId)
    .eq('activity_date', today)
    .single();

  // Get total watch time
  const { data: watchTimeData } = await supabaseAdmin
    .from('course_lesson_progress')
    .select('total_watch_time_seconds')
    .eq('user_id', userId);

  const totalWatchSeconds = (watchTimeData || []).reduce(
    (sum, p) => sum + (p.total_watch_time_seconds || 0),
    0
  );

  // Get quiz stats
  const { data: quizAttempts } = await supabaseAdmin
    .from('course_quiz_attempts')
    .select('score_percent, passed')
    .eq('user_id', userId);

  const perfectQuizzes = (quizAttempts || []).filter(a => a.score_percent === 100).length;

  // Check if all quizzes passed (need to compare with total modules)
  const passedQuizModules = new Set(
    (quizAttempts || []).filter(a => a.passed).map(() => 'module') // Simplified
  );

  return {
    lessonsCompleted: lessonsCompleted || 0,
    modulesCompleted: moduleData?.[0]?.completed_modules || 0,
    currentStreak: streak?.current_streak || 0,
    todayLessonsCompleted: todayActivity?.lessons_completed || 0,
    todayWatchHours: (todayActivity?.watch_time_seconds || 0) / 3600,
    totalWatchHours: totalWatchSeconds / 3600,
    perfectQuizzes,
    allQuizzesPassed: passedQuizModules.size >= (moduleData?.[0]?.total_modules || 1),
    courseCompletionPercent: moduleData?.[0]?.completion_percent || 0,
  };
}
