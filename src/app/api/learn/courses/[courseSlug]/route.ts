import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getAuthenticatedUser } from '@/lib/auth';

// GET - Get course detail with modules and progress
export async function GET(
  request: Request,
  { params }: { params: Promise<{ courseSlug: string }> }
) {
  try {
    const { courseSlug } = await params;
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
      .select('*')
      .eq('slug', courseSlug)
      .eq('is_published', true)
      .single();

    if (courseError || !course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    // Fetch modules with full lesson details
    const { data: modules, error: modulesError } = await supabaseAdmin
      .from('course_modules')
      .select(`
        *,
        lessons:course_lessons(
          id, module_id, title, slug, description, lesson_number,
          video_url, video_uid, video_duration_seconds, video_status,
          video_playback_hls, video_playback_dash, video_thumbnail_animated,
          thumbnail_url, transcript_url, transcript_text, resources,
          require_signed_urls, sort_order, is_preview, is_published,
          is_required, min_watch_percent, allow_skip, created_at
        )
      `)
      .eq('course_id', course.id)
      .eq('is_published', true)
      .order('sort_order');

    if (modulesError) {
      throw new Error('Failed to fetch modules');
    }

    // Get all lesson IDs for progress lookup
    const allLessonIds: string[] = [];
    (modules || []).forEach((module) => {
      (module.lessons || []).forEach((lesson: { id: string }) => {
        allLessonIds.push(lesson.id);
      });
    });

    // Get progress for all lessons at once
    const { data: progressData } = await supabaseAdmin
      .from('course_lesson_progress')
      .select('lesson_id, completed, progress_percent')
      .eq('user_id', user.id)
      .in('lesson_id', allLessonIds);

    const progressMap = new Map<string, { completed: boolean; progressPercent: number }>();
    (progressData || []).forEach((p) => {
      progressMap.set(p.lesson_id, {
        completed: p.completed,
        progressPercent: p.progress_percent || 0,
      });
    });

    // Get progress for each module
    const modulesWithProgress = await Promise.all(
      (modules || []).map(async (module) => {
        const lessons = module.lessons || [];
        const totalLessons = lessons.length;

        // Count completed lessons
        const completedLessons = lessons.filter((l: { id: string }) =>
          progressMap.get(l.id)?.completed
        ).length;

        const completionPercent = totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0;

        // Check if module is locked
        let canAccess = true;
        try {
          const { data } = await supabaseAdmin.rpc('can_access_module', {
            p_user_id: user.id,
            p_module_id: module.id,
          });
          canAccess = data !== false;
        } catch {
          // If RPC doesn't exist, assume accessible
          canAccess = true;
        }

        // Get quiz best score
        const { data: bestQuiz } = await supabaseAdmin
          .from('course_quiz_attempts')
          .select('score_percent, passed')
          .eq('user_id', user.id)
          .eq('module_id', module.id)
          .order('score_percent', { ascending: false })
          .limit(1)
          .single();

        // Transform lessons with progress
        const transformedLessons = lessons
          .sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order)
          .map((lesson: Record<string, unknown>) => {
            const lessonProgress = progressMap.get(lesson.id as string);
            return {
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
              // Add progress
              completed: lessonProgress?.completed || false,
              progressPercent: lessonProgress?.progressPercent || 0,
            };
          });

        return {
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
          // Include lessons
          lessons: transformedLessons,
          totalLessons,
          completedLessons,
          progress: {
            moduleId: module.id,
            totalLessons,
            completedLessons,
            completionPercent,
            isLocked: !canAccess,
            unlockReason: !canAccess ? 'Complete the previous module to unlock' : undefined,
            bestQuizScore: bestQuiz?.score_percent || null,
            quizPassed: bestQuiz?.passed || false,
          },
        };
      })
    );

    // Get course progress
    const { data: courseProgressData } = await supabaseAdmin.rpc('get_course_progress', {
      p_user_id: user.id,
      p_course_id: course.id,
    });

    const courseProgress = courseProgressData?.[0] || {
      total_lessons: 0,
      completed_lessons: 0,
      total_modules: 0,
      completed_modules: 0,
      total_watch_time_seconds: 0,
      total_quiz_attempts: 0,
      best_quiz_scores: [],
      completion_percent: 0,
    };

    // Get resume lesson
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
    if (resumeData?.lesson && resumeData.lesson.module?.course_id === course.id) {
      resumeLesson = {
        lesson: transformLesson(resumeData.lesson),
        module: transformModule(resumeData.lesson.module),
        progress: transformProgress(resumeData),
      };
    }

    return NextResponse.json({
      course: {
        id: course.id,
        title: course.title,
        slug: course.slug,
        description: course.description,
        thumbnailUrl: course.thumbnail_url,
        isPublished: course.is_published,
        isGated: course.is_gated,
        sortOrder: course.sort_order,
        complianceRequired: course.compliance_required,
        createdAt: course.created_at,
        updatedAt: course.updated_at,
        // Include modules with lessons for course player
        modules: modulesWithProgress,
      },
      modules: modulesWithProgress,
      progress: {
        totalLessons: courseProgress.total_lessons,
        completedLessons: courseProgress.completed_lessons,
        totalModules: courseProgress.total_modules,
        completedModules: courseProgress.completed_modules,
        totalWatchTimeSeconds: courseProgress.total_watch_time_seconds,
        totalQuizAttempts: courseProgress.total_quiz_attempts,
        bestQuizScores: courseProgress.best_quiz_scores || [],
        completionPercent: courseProgress.completion_percent || 0,
      },
      resumeLesson,
    });
  } catch (error) {
    console.error('Error in course detail API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

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
