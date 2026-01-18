import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getAuthenticatedUser } from '@/lib/auth';

// GET - Fetch lesson progress
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const lessonId = searchParams.get('lessonId');
    const moduleId = searchParams.get('moduleId');

    if (lessonId) {
      // Get progress for specific lesson
      const { data: progress } = await supabaseAdmin
        .from('course_lesson_progress')
        .select('*')
        .eq('user_id', user.id)
        .eq('lesson_id', lessonId)
        .single();

      return NextResponse.json({ progress: progress ? transformProgress(progress) : null });
    }

    if (moduleId) {
      // Get progress for all lessons in a module
      const { data: lessons } = await supabaseAdmin
        .from('course_lessons')
        .select('id')
        .eq('module_id', moduleId)
        .eq('is_published', true);

      const lessonIds = (lessons || []).map(l => l.id);

      const { data: progressData } = await supabaseAdmin
        .from('course_lesson_progress')
        .select('*')
        .eq('user_id', user.id)
        .in('lesson_id', lessonIds);

      return NextResponse.json({
        progress: (progressData || []).map(transformProgress),
      });
    }

    return NextResponse.json({ error: 'lessonId or moduleId is required' }, { status: 400 });
  } catch (error) {
    console.error('Error fetching lesson progress:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Update lesson progress (with compliance tracking)
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
    const {
      lessonId,
      progressSeconds,
      watchTimeIncrement,
      pauseCount,
      seekCount,
      playbackSpeed,
      completed,
      deviceType,
      browser,
    } = body;

    if (!lessonId) {
      return NextResponse.json({ error: 'lessonId is required' }, { status: 400 });
    }

    // Get lesson duration for percentage calculation
    const { data: lesson } = await supabaseAdmin
      .from('course_lessons')
      .select('video_duration_seconds, min_watch_percent')
      .eq('id', lessonId)
      .single();

    if (!lesson) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
    }

    const duration = lesson.video_duration_seconds || 0;
    const progressPercent = duration > 0 ? Math.min((progressSeconds / duration) * 100, 100) : 0;

    // Check if lesson should be marked as completed
    const minWatchPercent = lesson.min_watch_percent || 90;
    const shouldComplete = completed || progressPercent >= minWatchPercent;

    // Get existing progress
    const { data: existingProgress } = await supabaseAdmin
      .from('course_lesson_progress')
      .select('*')
      .eq('user_id', user.id)
      .eq('lesson_id', lessonId)
      .single();

    const now = new Date().toISOString();

    // Upsert progress
    const progressData = {
      user_id: user.id,
      lesson_id: lessonId,
      progress_seconds: progressSeconds,
      progress_percent: progressPercent,
      completed: shouldComplete,
      completed_at: shouldComplete && !existingProgress?.completed ? now : existingProgress?.completed_at,
      total_watch_time_seconds: (existingProgress?.total_watch_time_seconds || 0) + (watchTimeIncrement || 0),
      unique_watch_time_seconds: Math.max(existingProgress?.unique_watch_time_seconds || 0, progressSeconds),
      watch_count: existingProgress?.watch_count || 1,
      pause_count: (existingProgress?.pause_count || 0) + (pauseCount || 0),
      seek_count: (existingProgress?.seek_count || 0) + (seekCount || 0),
      playback_speed_changes: playbackSpeed !== existingProgress?.last_playback_speed
        ? (existingProgress?.playback_speed_changes || 0) + 1
        : existingProgress?.playback_speed_changes || 0,
      last_playback_speed: playbackSpeed || 1.0,
      first_watched_at: existingProgress?.first_watched_at || now,
      last_watched_at: now,
      last_device_type: deviceType,
      last_browser: browser,
    };

    const { data: progress, error } = await supabaseAdmin
      .from('course_lesson_progress')
      .upsert(progressData, { onConflict: 'user_id,lesson_id' })
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Update daily activity if watch time was added
    if (watchTimeIncrement && watchTimeIncrement > 0) {
      await supabaseAdmin.rpc('update_daily_activity', {
        p_user_id: user.id,
        p_lessons_started: existingProgress ? 0 : 1,
        p_lessons_completed: shouldComplete && !existingProgress?.completed ? 1 : 0,
        p_watch_seconds: watchTimeIncrement,
        p_quizzes_taken: 0,
        p_quizzes_passed: 0,
      });
    }

    return NextResponse.json({
      progress: transformProgress(progress),
      completed: shouldComplete,
    });
  } catch (error) {
    console.error('Error updating lesson progress:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
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
