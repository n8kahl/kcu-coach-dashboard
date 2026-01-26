import { notFound, redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { LessonClient } from './LessonClient';
import type { CourseLesson, CourseModule, LessonProgress } from '@/types/learning';

interface LessonPageProps {
  params: Promise<{
    courseSlug: string;
    moduleSlug: string;
    lessonSlug: string;
  }>;
}

interface LessonWithProgress extends CourseLesson {
  progress?: LessonProgress;
}

async function getLessonData(courseSlug: string, moduleSlug: string, lessonSlug: string) {
  const session = await getSession();

  if (!session?.user?.discordId) {
    redirect('/login');
  }

  // Parallel fetch: user profile AND lesson with nested course/module data
  const [userResult, lessonResult] = await Promise.all([
    supabaseAdmin
      .from('user_profiles')
      .select('id')
      .eq('discord_id', session.user.discordId)
      .single(),
    // Single query with JOINs to get lesson + module + course
    supabaseAdmin
      .from('course_lessons')
      .select(`
        *,
        course_modules!inner (
          *,
          courses!inner (
            id,
            title,
            slug
          )
        )
      `)
      .eq('slug', lessonSlug)
      .eq('is_published', true)
      .eq('course_modules.slug', moduleSlug)
      .eq('course_modules.is_published', true)
      .eq('course_modules.courses.slug', courseSlug)
      .eq('course_modules.courses.is_published', true)
      .single(),
  ]);

  const { data: user } = userResult;
  const { data: lessonWithRelations, error: lessonError } = lessonResult;

  if (!user) {
    redirect('/login');
  }

  if (lessonError || !lessonWithRelations) {
    notFound();
  }

  // Extract nested data
  const moduleData = lessonWithRelations.course_modules as Record<string, unknown>;
  const courseData = moduleData.courses as { id: string; title: string; slug: string };
  const lesson = lessonWithRelations;
  const module = moduleData;
  const course = courseData;

  // Module access check disabled - all modules unlocked for development
  // TODO: Re-enable when gating is properly configured with user_course_access records

  // Parallel fetch: current lesson progress AND all lessons in module
  const [progressResult, allLessonsResult] = await Promise.all([
    supabaseAdmin
      .from('course_lesson_progress')
      .select('*')
      .eq('user_id', user.id)
      .eq('lesson_id', lesson.id)
      .single(),
    supabaseAdmin
      .from('course_lessons')
      .select('*')
      .eq('module_id', module.id as string)
      .eq('is_published', true)
      .order('sort_order'),
  ]);

  const { data: progress } = progressResult;
  const { data: allLessons } = allLessonsResult;

  // Get progress for all lessons (needs lessonIds from previous query)
  const lessonIds = (allLessons || []).map(l => l.id);
  const { data: allProgress } = await supabaseAdmin
    .from('course_lesson_progress')
    .select('*')
    .eq('user_id', user.id)
    .in('lesson_id', lessonIds);

  const progressMap = new Map((allProgress || []).map(p => [p.lesson_id, p]));

  const allLessonsWithProgress: LessonWithProgress[] = (allLessons || []).map(l => ({
    id: l.id,
    moduleId: l.module_id,
    title: l.title,
    slug: l.slug,
    description: l.description,
    lessonNumber: l.lesson_number,
    videoUrl: l.video_url,
    videoUid: l.video_uid,
    videoPlaybackHls: l.video_playback_hls,
    videoPlaybackDash: l.video_playback_dash,
    videoThumbnailAnimated: l.video_thumbnail_animated,
    videoDurationSeconds: l.video_duration_seconds,
    videoStatus: l.video_status || 'ready',
    thumbnailUrl: l.thumbnail_url,
    transcriptUrl: l.transcript_url,
    transcriptText: null, // Don't include in list
    resources: l.resources || [],
    requireSignedUrls: l.require_signed_urls || false,
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
      uniqueWatchTimeSeconds: progressMap.get(l.id).unique_watch_time_seconds || 0,
      watchCount: progressMap.get(l.id).watch_count,
      pauseCount: progressMap.get(l.id).pause_count || 0,
      seekCount: progressMap.get(l.id).seek_count || 0,
      playbackSpeedChanges: progressMap.get(l.id).playback_speed_changes || 0,
      lastPlaybackSpeed: progressMap.get(l.id).last_playback_speed || 1,
      firstWatchedAt: progressMap.get(l.id).first_watched_at,
      lastWatchedAt: progressMap.get(l.id).last_watched_at,
    } : undefined,
  }));

  // Find prev/next lessons
  const currentIndex = allLessonsWithProgress.findIndex(l => l.id === lesson.id);
  const prevLesson = currentIndex > 0 ? allLessonsWithProgress[currentIndex - 1] : null;
  const nextLesson = currentIndex < allLessonsWithProgress.length - 1 ? allLessonsWithProgress[currentIndex + 1] : null;

  // Transform lesson to match the expected format
  const lessonData: CourseLesson = {
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
    videoThumbnailAnimated: lesson.video_thumbnail_animated,
    videoDurationSeconds: lesson.video_duration_seconds,
    videoStatus: lesson.video_status || 'ready',
    thumbnailUrl: lesson.thumbnail_url,
    transcriptUrl: lesson.transcript_url,
    transcriptText: null, // Loaded separately via /transcript endpoint
    resources: lesson.resources || [],
    requireSignedUrls: lesson.require_signed_urls || false,
    sortOrder: lesson.sort_order,
    isPreview: lesson.is_preview,
    isPublished: lesson.is_published,
    isRequired: lesson.is_required,
    minWatchPercent: lesson.min_watch_percent,
    allowSkip: lesson.allow_skip,
    createdAt: lesson.created_at,
  };

  const moduleOutput: CourseModule = {
    id: module.id as string,
    courseId: module.course_id as string,
    title: module.title as string,
    slug: module.slug as string,
    description: module.description as string,
    moduleNumber: module.module_number as string,
    thumbnailUrl: module.thumbnail_url as string | null,
    sortOrder: module.sort_order as number,
    isPublished: module.is_published as boolean,
    unlockAfterModuleId: module.unlock_after_module_id as string | null,
    unlockAfterDays: module.unlock_after_days as number | null,
    requiresQuizPass: module.requires_quiz_pass as boolean,
    minQuizScore: module.min_quiz_score as number | null,
    isRequired: module.is_required as boolean,
    createdAt: module.created_at as string,
  };

  const progressData: LessonProgress | null = progress ? {
    id: progress.id,
    lessonId: progress.lesson_id,
    progressSeconds: progress.progress_seconds,
    progressPercent: progress.progress_percent,
    completed: progress.completed,
    completedAt: progress.completed_at,
    totalWatchTimeSeconds: progress.total_watch_time_seconds,
    uniqueWatchTimeSeconds: progress.unique_watch_time_seconds || 0,
    watchCount: progress.watch_count,
    pauseCount: progress.pause_count || 0,
    seekCount: progress.seek_count || 0,
    playbackSpeedChanges: progress.playback_speed_changes || 0,
    lastPlaybackSpeed: progress.last_playback_speed || 1,
    firstWatchedAt: progress.first_watched_at,
    lastWatchedAt: progress.last_watched_at,
  } : null;

  return {
    locked: false,
    lesson: lessonData,
    module: moduleOutput,
    progress: progressData,
    allLessons: allLessonsWithProgress,
    prevLesson: prevLesson ? { slug: prevLesson.slug, title: prevLesson.title } : null,
    nextLesson: nextLesson ? { slug: nextLesson.slug, title: nextLesson.title } : null,
    courseTitle: course.title,
    courseSlug,
    moduleSlug,
  };
}

export default async function LessonPage({ params }: LessonPageProps) {
  const { courseSlug, moduleSlug, lessonSlug } = await params;

  const data = await getLessonData(courseSlug, moduleSlug, lessonSlug);

  if (data.locked) {
    // Redirect to module page with locked message
    redirect(`/learn/${data.courseSlug}/${data.moduleSlug}?locked=true`);
  }

  return (
    <LessonClient
      lesson={data.lesson!}
      module={data.module!}
      progress={data.progress!}
      allLessons={data.allLessons!}
      prevLesson={data.prevLesson!}
      nextLesson={data.nextLesson!}
      courseTitle={data.courseTitle!}
      courseSlug={courseSlug}
      moduleSlug={moduleSlug}
    />
  );
}
