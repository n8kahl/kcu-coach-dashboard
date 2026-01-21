/**
 * Admin Content Preview API
 *
 * Allows admins to preview unpublished lessons as they would appear to learners.
 * Bypasses publication status checks but still requires admin authentication.
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * GET /api/admin/content/preview/[lessonId]
 * Get a lesson for admin preview (including unpublished content)
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ lessonId: string }> }
) {
  try {
    const { lessonId } = await params;
    const session = await getSession();

    if (!session?.userId || !session.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 401 });
    }

    // Fetch lesson WITHOUT checking is_published
    const { data: lesson, error: lessonError } = await supabaseAdmin
      .from('course_lessons')
      .select('*')
      .eq('id', lessonId)
      .single();

    if (lessonError || !lesson) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
    }

    // Fetch module WITHOUT checking is_published
    const { data: module, error: moduleError } = await supabaseAdmin
      .from('course_modules')
      .select('*')
      .eq('id', lesson.module_id)
      .single();

    if (moduleError || !module) {
      return NextResponse.json({ error: 'Module not found' }, { status: 404 });
    }

    // Fetch course WITHOUT checking is_published
    const { data: course, error: courseError } = await supabaseAdmin
      .from('courses')
      .select('*')
      .eq('id', module.course_id)
      .single();

    if (courseError || !course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    // Get all lessons in module for navigation (including unpublished)
    const { data: allLessons } = await supabaseAdmin
      .from('course_lessons')
      .select('*')
      .eq('module_id', module.id)
      .order('sort_order');

    const allLessonsTransformed = (allLessons || []).map(l => ({
      id: l.id,
      moduleId: l.module_id,
      title: l.title,
      slug: l.slug,
      description: l.description,
      lessonNumber: l.lesson_number,
      videoDurationSeconds: l.video_duration_seconds,
      videoStatus: l.video_status,
      thumbnailUrl: l.thumbnail_url,
      sortOrder: l.sort_order,
      isPreview: l.is_preview,
      isPublished: l.is_published,
      isRequired: l.is_required,
      minWatchPercent: l.min_watch_percent,
      allowSkip: l.allow_skip,
      createdAt: l.created_at,
    }));

    // Find prev/next lessons
    const currentIndex = allLessonsTransformed.findIndex(l => l.id === lesson.id);
    const prevLesson = currentIndex > 0 ? allLessonsTransformed[currentIndex - 1] : null;
    const nextLesson = currentIndex < allLessonsTransformed.length - 1 ? allLessonsTransformed[currentIndex + 1] : null;

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
        videoDurationSeconds: lesson.video_duration_seconds,
        videoStatus: lesson.video_status,
        videoPlaybackHls: lesson.video_playback_hls,
        videoPlaybackDash: lesson.video_playback_dash,
        thumbnailUrl: lesson.thumbnail_url,
        transcriptUrl: lesson.transcript_url,
        transcriptText: lesson.transcript_text,
        resources: lesson.resources || [],
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
        description: module.description,
        isPublished: module.is_published,
        createdAt: module.created_at,
      },
      course: {
        id: course.id,
        title: course.title,
        slug: course.slug,
        description: course.description,
        isPublished: course.is_published,
        createdAt: course.created_at,
      },
      allLessons: allLessonsTransformed,
      prevLesson: prevLesson ? { id: prevLesson.id, slug: prevLesson.slug, title: prevLesson.title } : null,
      nextLesson: nextLesson ? { id: nextLesson.id, slug: nextLesson.slug, title: nextLesson.title } : null,
      // Preview metadata
      previewMode: true,
      publishStatus: {
        coursePublished: course.is_published,
        modulePublished: module.is_published,
        lessonPublished: lesson.is_published,
      },
    });
  } catch (error) {
    console.error('Error in admin preview API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
