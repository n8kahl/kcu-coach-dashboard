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

  // Get user profile
  const { data: user } = await supabaseAdmin
    .from('user_profiles')
    .select('id')
    .eq('discord_id', session.user.discordId)
    .single();

  if (!user) {
    redirect('/login');
  }

  // Fetch course
  const { data: course, error: courseError } = await supabaseAdmin
    .from('courses')
    .select('id, title')
    .eq('slug', courseSlug)
    .eq('is_published', true)
    .single();

  if (courseError || !course) {
    notFound();
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
    notFound();
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
    notFound();
  }

  // Module access check disabled - all modules unlocked for development
  // TODO: Re-enable when gating is properly configured with user_course_access records
  // if (!lesson.is_preview) {
  //   const { data: canAccess } = await supabaseAdmin.rpc('can_access_module', {
  //     p_user_id: user.id,
  //     p_module_id: module.id,
  //   });
  //   if (!canAccess) {
  //     return { locked: true, courseSlug, moduleSlug };
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

  const moduleData: CourseModule = {
    id: module.id,
    courseId: module.course_id,
    title: module.title,
    slug: module.slug,
    description: module.description,
    moduleNumber: module.module_number,
    thumbnailUrl: module.thumbnail_url,
    sortOrder: module.sort_order,
    isPublished: module.is_published,
    unlockAfterModuleId: module.unlock_after_module_id,
    unlockAfterDays: module.unlock_after_days,
    requiresQuizPass: module.requires_quiz_pass,
    minQuizScore: module.min_quiz_score,
    isRequired: module.is_required,
    createdAt: module.created_at,
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
    module: moduleData,
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
