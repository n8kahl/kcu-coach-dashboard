import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getAuthenticatedUser } from '@/lib/auth';

// GET - Get lesson detail with progress
export async function GET(
  request: Request,
  { params }: { params: Promise<{ courseSlug: string; moduleSlug: string; lessonSlug: string }> }
) {
  try {
    const { courseSlug, moduleSlug, lessonSlug } = await params;
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

    // Fetch course
    const { data: course, error: courseError } = await supabaseAdmin
      .from('courses')
      .select('id, title')
      .eq('slug', courseSlug)
      .eq('is_published', true)
      .single();

    if (courseError || !course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    // Fetch module
    const { data: module, error: moduleError } = await supabaseAdmin
      .from('course_modules')
      .select('*')
      .eq('course_id', course.id)
      .eq('slug', moduleSlug)
      .eq('is_published', true)
      .single();

    if (moduleError || !module) {
      return NextResponse.json({ error: 'Module not found' }, { status: 404 });
    }

    // Fetch lesson
    const { data: lesson, error: lessonError } = await supabaseAdmin
      .from('course_lessons')
      .select('*')
      .eq('module_id', module.id)
      .eq('slug', lessonSlug)
      .eq('is_published', true)
      .single();

    if (lessonError || !lesson) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
    }

    // Module access check disabled - all modules unlocked for development
    // TODO: Re-enable when gating is properly configured with user_course_access records
    // if (!lesson.is_preview) {
    //   const { data: canAccess } = await supabaseAdmin.rpc('can_access_module', {
    //     p_user_id: user.id,
    //     p_module_id: module.id,
    //   });
    //   if (!canAccess) {
    //     return NextResponse.json({ error: 'This lesson is locked' }, { status: 403 });
    //   }
    // }

    // Get lesson progress
    const { data: progress } = await supabaseAdmin
      .from('course_lesson_progress')
      .select('*')
      .eq('user_id', user.id)
      .eq('lesson_id', lesson.id)
      .single();

    // Get all lessons in module for navigation and sidebar
    const { data: allLessons } = await supabaseAdmin
      .from('course_lessons')
      .select('*')
      .eq('module_id', module.id)
      .eq('is_published', true)
      .order('sort_order');

    // Get progress for all lessons
    const lessonIds = (allLessons || []).map(l => l.id);
    const { data: allProgress } = await supabaseAdmin
      .from('course_lesson_progress')
      .select('*')
      .eq('user_id', user.id)
      .in('lesson_id', lessonIds);

    const progressMap = new Map((allProgress || []).map(p => [p.lesson_id, p]));

    const allLessonsWithProgress = (allLessons || []).map(l => ({
      id: l.id,
      moduleId: l.module_id,
      title: l.title,
      slug: l.slug,
      description: l.description,
      lessonNumber: l.lesson_number,
      videoDurationSeconds: l.video_duration_seconds,
      thumbnailUrl: l.thumbnail_url,
      sortOrder: l.sort_order,
      isPreview: l.is_preview,
      isPublished: l.is_published,
      isRequired: l.is_required,
      minWatchPercent: l.min_watch_percent,
      allowSkip: l.allow_skip,
      createdAt: l.created_at,
      progress: progressMap.has(l.id) ? {
        id: progressMap.get(l.id).id,
        lessonId: l.id,
        progressSeconds: progressMap.get(l.id).progress_seconds,
        progressPercent: progressMap.get(l.id).progress_percent,
        completed: progressMap.get(l.id).completed,
        completedAt: progressMap.get(l.id).completed_at,
        totalWatchTimeSeconds: progressMap.get(l.id).total_watch_time_seconds,
        watchCount: progressMap.get(l.id).watch_count,
        lastWatchedAt: progressMap.get(l.id).last_watched_at,
      } : undefined,
    }));

    // Find prev/next lessons
    const currentIndex = allLessonsWithProgress.findIndex(l => l.id === lesson.id);
    const prevLesson = currentIndex > 0 ? allLessonsWithProgress[currentIndex - 1] : null;
    const nextLesson = currentIndex < allLessonsWithProgress.length - 1 ? allLessonsWithProgress[currentIndex + 1] : null;

    // Runtime assertion: if videoUid exists, playback URLs should also exist
    if (lesson.video_uid && process.env.NODE_ENV === 'development') {
      if (!lesson.video_playback_hls) {
        console.warn(`[Lesson API] Lesson ${lesson.id} has videoUid but missing video_playback_hls`);
      }
      if (!lesson.video_playback_dash) {
        console.warn(`[Lesson API] Lesson ${lesson.id} has videoUid but missing video_playback_dash`);
      }
    }

    return NextResponse.json({
      lesson: {
        id: lesson.id,
        moduleId: lesson.module_id,
        title: lesson.title,
        slug: lesson.slug,
        description: lesson.description,
        lessonNumber: lesson.lesson_number,
        videoUrl: lesson.video_url,
        videoUid: lesson.video_uid,
        videoPlaybackHls: lesson.video_playback_hls,
        videoPlaybackDash: lesson.video_playback_dash,
        videoDurationSeconds: lesson.video_duration_seconds,
        thumbnailUrl: lesson.thumbnail_url,
        transcriptUrl: lesson.transcript_url,
        // Note: transcriptText is now fetched separately via /transcript endpoint
        sortOrder: lesson.sort_order,
        isPreview: lesson.is_preview,
        isPublished: lesson.is_published,
        isRequired: lesson.is_required,
        minWatchPercent: lesson.min_watch_percent,
        allowSkip: lesson.allow_skip,
        createdAt: lesson.created_at,
      },
      module: {
        id: module.id,
        courseId: module.course_id,
        title: module.title,
        slug: module.slug,
        moduleNumber: module.module_number,
        createdAt: module.created_at,
      },
      progress: progress ? {
        id: progress.id,
        lessonId: progress.lesson_id,
        progressSeconds: progress.progress_seconds,
        progressPercent: progress.progress_percent,
        completed: progress.completed,
        completedAt: progress.completed_at,
        totalWatchTimeSeconds: progress.total_watch_time_seconds,
        uniqueWatchTimeSeconds: progress.unique_watch_time_seconds,
        watchCount: progress.watch_count,
        pauseCount: progress.pause_count,
        seekCount: progress.seek_count,
        playbackSpeedChanges: progress.playback_speed_changes,
        lastPlaybackSpeed: progress.last_playback_speed,
        firstWatchedAt: progress.first_watched_at,
        lastWatchedAt: progress.last_watched_at,
      } : null,
      allLessons: allLessonsWithProgress,
      prevLesson: prevLesson ? { slug: prevLesson.slug, title: prevLesson.title } : null,
      nextLesson: nextLesson ? { slug: nextLesson.slug, title: nextLesson.title } : null,
      courseTitle: course.title,
    });
  } catch (error) {
    console.error('Error in lesson detail API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
