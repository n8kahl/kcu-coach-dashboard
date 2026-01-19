import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getModuleBySlug } from '@/data/curriculum';

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const slug = params.slug;

    // First, try to get from native course_modules
    const { data: module, error: moduleError } = await supabaseAdmin
      .from('course_modules')
      .select(`
        id,
        course_id,
        title,
        slug,
        description,
        module_number,
        thumbnail_url,
        sort_order,
        is_published,
        unlock_after_module_id,
        unlock_after_days,
        requires_quiz_pass,
        min_quiz_score,
        is_required,
        created_at,
        courses (
          id,
          title,
          slug,
          description,
          thumbnail_url,
          is_published,
          is_gated,
          compliance_required
        )
      `)
      .eq('slug', slug)
      .single();

    if (module && !moduleError) {
      // Get all lessons for this module
      const { data: lessons, error: lessonsError } = await supabaseAdmin
        .from('course_lessons')
        .select(`
          id,
          module_id,
          title,
          slug,
          description,
          lesson_number,
          video_url,
          video_uid,
          video_duration_seconds,
          video_status,
          video_playback_hls,
          video_playback_dash,
          video_thumbnail_animated,
          thumbnail_url,
          transcript_url,
          transcript_text,
          resources,
          require_signed_urls,
          sort_order,
          is_preview,
          is_published,
          is_required,
          min_watch_percent,
          allow_skip,
          created_at
        `)
        .eq('module_id', module.id)
        .eq('is_published', true)
        .order('sort_order', { ascending: true });

      if (lessonsError) {
        console.error('Error fetching lessons:', lessonsError);
      }

      // Get quiz info for this module
      const { data: quizQuestions } = await supabaseAdmin
        .from('course_quiz_questions')
        .select('id')
        .eq('module_id', module.id);

      const quizInfo = quizQuestions && quizQuestions.length > 0
        ? {
            questionsCount: quizQuestions.length,
            passingScore: module.min_quiz_score || 70,
          }
        : null;

      return NextResponse.json({
        module: {
          id: module.id,
          courseId: module.course_id,
          slug: module.slug,
          title: module.title,
          description: module.description,
          moduleNumber: module.module_number,
          thumbnailUrl: module.thumbnail_url,
          sortOrder: module.sort_order,
          isPublished: module.is_published,
          isRequired: module.is_required,
          requiresQuizPass: module.requires_quiz_pass,
          minQuizScore: module.min_quiz_score,
          unlockAfterModuleId: module.unlock_after_module_id,
          unlockAfterDays: module.unlock_after_days,
          createdAt: module.created_at,
        },
        course: module.courses,
        lessons: (lessons || []).map(lesson => ({
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
          videoThumbnailAnimated: lesson.video_thumbnail_animated,
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
        })),
        quiz: quizInfo,
        source: 'native',
      });
    }

    // Fall back to local curriculum data
    const localModule = getModuleBySlug(slug);

    if (!localModule) {
      return NextResponse.json(
        { error: 'Module not found' },
        { status: 404 }
      );
    }

    // Return module with lesson summaries (no full transcripts for local)
    const response = {
      module: {
        id: localModule.id,
        slug: localModule.slug,
        title: localModule.title,
        description: localModule.description,
        sortOrder: localModule.order,
        isPublished: true,
        isRequired: false,
      },
      course: null,
      lessons: localModule.lessons.map((lesson, index) => ({
        id: lesson.id,
        moduleId: localModule.id,
        title: lesson.title,
        slug: lesson.slug,
        description: lesson.description,
        lessonNumber: `${index + 1}`,
        videoUrl: lesson.video_id ? `https://youtube.com/watch?v=${lesson.video_id}` : null,
        videoUid: null,
        videoDurationSeconds: lesson.duration * 60,
        videoStatus: 'ready',
        videoPlaybackHls: null,
        videoPlaybackDash: null,
        thumbnailUrl: null,
        transcriptUrl: null,
        transcriptText: null,
        resources: [],
        sortOrder: index + 1,
        isPreview: false,
        isPublished: true,
        isRequired: true,
        minWatchPercent: 80,
        allowSkip: false,
      })),
      quiz: null,
      source: 'local',
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching module:', error);
    return NextResponse.json(
      { error: 'Failed to fetch module' },
      { status: 500 }
    );
  }
}
