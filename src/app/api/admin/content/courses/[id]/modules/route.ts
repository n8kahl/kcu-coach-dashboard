/**
 * Admin Content API - Course Modules
 *
 * List modules for a course with their lessons.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * GET /api/admin/content/courses/[id]/modules
 * Get all modules for a course with their lessons
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session?.userId || !session.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const courseId = params.id;

    // Fetch modules
    const { data: modules, error: modulesError } = await supabaseAdmin
      .from('course_modules')
      .select('*')
      .eq('course_id', courseId)
      .order('sort_order', { ascending: true });

    if (modulesError) throw modulesError;

    // Fetch lessons for all modules
    const moduleIds = modules?.map((m) => m.id) || [];
    const { data: lessons, error: lessonsError } = await supabaseAdmin
      .from('course_lessons')
      .select('*')
      .in('module_id', moduleIds)
      .order('sort_order', { ascending: true });

    if (lessonsError) throw lessonsError;

    // Group lessons by module
    const lessonsByModule = (lessons || []).reduce(
      (acc, lesson) => {
        if (!acc[lesson.module_id]) acc[lesson.module_id] = [];
        acc[lesson.module_id].push({
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
          requireSignedUrls: lesson.require_signed_urls,
          sortOrder: lesson.sort_order,
          isPreview: lesson.is_preview,
          isPublished: lesson.is_published,
          isRequired: lesson.is_required,
          minWatchPercent: lesson.min_watch_percent,
          allowSkip: lesson.allow_skip,
          createdAt: lesson.created_at,
        });
        return acc;
      },
      {} as Record<string, unknown[]>
    );

    return NextResponse.json({
      modules: (modules || []).map((m) => ({
        id: m.id,
        courseId: m.course_id,
        title: m.title,
        slug: m.slug,
        description: m.description,
        moduleNumber: m.module_number,
        thumbnailUrl: m.thumbnail_url,
        sortOrder: m.sort_order,
        isPublished: m.is_published,
        unlockAfterModuleId: m.unlock_after_module_id,
        unlockAfterDays: m.unlock_after_days,
        requiresQuizPass: m.requires_quiz_pass,
        minQuizScore: m.min_quiz_score,
        isRequired: m.is_required,
        createdAt: m.created_at,
        lessons: lessonsByModule[m.id] || [],
      })),
    });
  } catch (error) {
    console.error('Error fetching modules:', error);
    return NextResponse.json({ error: 'Failed to fetch modules' }, { status: 500 });
  }
}
