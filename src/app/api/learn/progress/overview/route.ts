import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getAuthenticatedUser } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const sessionUser = await getAuthenticatedUser();

    if (!sessionUser?.discordId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile
    const { data: user } = await supabaseAdmin
      .from('user_profiles')
      .select('id')
      .eq('discord_id', sessionUser.discordId)
      .single();

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('courseId');

    // Get course progress using the database function
    let courseProgress = null;
    if (courseId) {
      const { data } = await supabaseAdmin.rpc('get_course_progress', {
        p_user_id: user.id,
        p_course_id: courseId,
      });
      if (data && data.length > 0) {
        courseProgress = {
          totalLessons: data[0].total_lessons,
          completedLessons: data[0].completed_lessons,
          totalModules: data[0].total_modules,
          completedModules: data[0].completed_modules,
          totalWatchTimeSeconds: data[0].total_watch_time_seconds,
          totalQuizAttempts: data[0].total_quiz_attempts,
          bestQuizScores: data[0].best_quiz_scores || [],
          completionPercent: data[0].completion_percent || 0,
        };
      }
    }

    // Get learning streak
    const { data: streak } = await supabaseAdmin
      .from('user_learning_streaks')
      .select('current_streak, longest_streak, last_activity_date, streak_start_date')
      .eq('user_id', user.id)
      .single();

    // Get recent activity (last 90 days)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const { data: recentActivity } = await supabaseAdmin
      .from('user_daily_activity')
      .select('*')
      .eq('user_id', user.id)
      .gte('activity_date', ninetyDaysAgo.toISOString().split('T')[0])
      .order('activity_date', { ascending: false });

    // Get resume lesson (last watched, not completed)
    const { data: resumeData } = await supabaseAdmin
      .from('course_lesson_progress')
      .select(`
        *,
        lesson:course_lessons(
          *,
          module:course_modules(*)
        )
      `)
      .eq('user_id', user.id)
      .eq('completed', false)
      .gt('progress_seconds', 0)
      .order('last_watched_at', { ascending: false })
      .limit(1)
      .single();

    let resumeLesson = null;
    if (resumeData?.lesson) {
      resumeLesson = {
        lesson: transformLesson(resumeData.lesson),
        module: transformModule(resumeData.lesson.module),
        progress: transformProgress(resumeData),
      };
    }

    return NextResponse.json({
      courseProgress: courseProgress || {
        totalLessons: 0,
        completedLessons: 0,
        totalModules: 0,
        completedModules: 0,
        totalWatchTimeSeconds: 0,
        totalQuizAttempts: 0,
        bestQuizScores: [],
        completionPercent: 0,
      },
      streak: streak
        ? {
            currentStreak: streak.current_streak,
            longestStreak: streak.longest_streak,
            lastActivityDate: streak.last_activity_date,
            streakStartDate: streak.streak_start_date,
          }
        : {
            currentStreak: 0,
            longestStreak: 0,
            lastActivityDate: null,
            streakStartDate: null,
          },
      recentActivity: (recentActivity || []).map(transformActivity),
      resumeLesson,
    });
  } catch (error) {
    console.error('Error fetching progress overview:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Transform database records to API types
function transformLesson(record: Record<string, unknown>) {
  return {
    id: record.id,
    moduleId: record.module_id,
    title: record.title,
    slug: record.slug,
    description: record.description,
    lessonNumber: record.lesson_number,
    videoUrl: record.video_url,
    videoUid: record.video_uid,
    videoDurationSeconds: record.video_duration_seconds,
    thumbnailUrl: record.thumbnail_url,
    transcriptUrl: record.transcript_url,
    transcriptText: record.transcript_text,
    sortOrder: record.sort_order,
    isPreview: record.is_preview,
    isPublished: record.is_published,
    isRequired: record.is_required,
    minWatchPercent: record.min_watch_percent,
    allowSkip: record.allow_skip,
    createdAt: record.created_at,
  };
}

function transformModule(record: Record<string, unknown>) {
  return {
    id: record.id,
    courseId: record.course_id,
    title: record.title,
    slug: record.slug,
    description: record.description,
    moduleNumber: record.module_number,
    thumbnailUrl: record.thumbnail_url,
    sortOrder: record.sort_order,
    isPublished: record.is_published,
    unlockAfterModuleId: record.unlock_after_module_id,
    unlockAfterDays: record.unlock_after_days,
    requiresQuizPass: record.requires_quiz_pass,
    minQuizScore: record.min_quiz_score,
    isRequired: record.is_required,
    createdAt: record.created_at,
  };
}

function transformProgress(record: Record<string, unknown>) {
  return {
    id: record.id,
    lessonId: record.lesson_id,
    progressSeconds: record.progress_seconds,
    progressPercent: record.progress_percent,
    completed: record.completed,
    completedAt: record.completed_at,
    totalWatchTimeSeconds: record.total_watch_time_seconds,
    uniqueWatchTimeSeconds: record.unique_watch_time_seconds,
    watchCount: record.watch_count,
    pauseCount: record.pause_count,
    seekCount: record.seek_count,
    playbackSpeedChanges: record.playback_speed_changes,
    lastPlaybackSpeed: record.last_playback_speed,
    firstWatchedAt: record.first_watched_at,
    lastWatchedAt: record.last_watched_at,
  };
}

function transformActivity(record: Record<string, unknown>) {
  return {
    activityDate: record.activity_date,
    lessonsStarted: record.lessons_started,
    lessonsCompleted: record.lessons_completed,
    watchTimeSeconds: record.watch_time_seconds,
    quizzesTaken: record.quizzes_taken,
    quizzesPassed: record.quizzes_passed,
    engagementScore: record.engagement_score,
  };
}
