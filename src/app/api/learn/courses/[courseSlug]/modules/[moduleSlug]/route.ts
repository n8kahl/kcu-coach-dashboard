import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getAuthenticatedUser } from '@/lib/auth';

// GET - Get module detail with lessons and progress
export async function GET(
  request: Request,
  { params }: { params: Promise<{ courseSlug: string; moduleSlug: string }> }
) {
  try {
    const { courseSlug, moduleSlug } = await params;
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

    // Check if module is locked
    const { data: canAccess } = await supabaseAdmin.rpc('can_access_module', {
      p_user_id: user.id,
      p_module_id: module.id,
    });

    if (!canAccess) {
      return NextResponse.json({ error: 'This module is locked' }, { status: 403 });
    }

    // Fetch lessons with progress
    const { data: lessons, error: lessonsError } = await supabaseAdmin
      .from('course_lessons')
      .select('*')
      .eq('module_id', module.id)
      .eq('is_published', true)
      .order('sort_order');

    if (lessonsError) {
      throw new Error('Failed to fetch lessons');
    }

    // Get progress for each lesson
    const lessonIds = (lessons || []).map(l => l.id);
    const { data: progressData } = await supabaseAdmin
      .from('course_lesson_progress')
      .select('*')
      .eq('user_id', user.id)
      .in('lesson_id', lessonIds);

    const progressMap = new Map((progressData || []).map(p => [p.lesson_id, p]));

    const lessonsWithProgress = (lessons || []).map(lesson => ({
      id: lesson.id,
      moduleId: lesson.module_id,
      title: lesson.title,
      slug: lesson.slug,
      description: lesson.description,
      lessonNumber: lesson.lesson_number,
      videoUrl: lesson.video_url,
      videoUid: lesson.video_uid,
      videoDurationSeconds: lesson.video_duration_seconds,
      thumbnailUrl: lesson.thumbnail_url,
      transcriptUrl: lesson.transcript_url,
      sortOrder: lesson.sort_order,
      isPreview: lesson.is_preview,
      isPublished: lesson.is_published,
      isRequired: lesson.is_required,
      minWatchPercent: lesson.min_watch_percent,
      allowSkip: lesson.allow_skip,
      createdAt: lesson.created_at,
      progress: progressMap.has(lesson.id) ? {
        id: progressMap.get(lesson.id).id,
        lessonId: lesson.id,
        progressSeconds: progressMap.get(lesson.id).progress_seconds,
        progressPercent: progressMap.get(lesson.id).progress_percent,
        completed: progressMap.get(lesson.id).completed,
        completedAt: progressMap.get(lesson.id).completed_at,
        totalWatchTimeSeconds: progressMap.get(lesson.id).total_watch_time_seconds,
        uniqueWatchTimeSeconds: progressMap.get(lesson.id).unique_watch_time_seconds,
        watchCount: progressMap.get(lesson.id).watch_count,
        lastWatchedAt: progressMap.get(lesson.id).last_watched_at,
      } : undefined,
    }));

    // Calculate module progress
    const totalLessons = lessonsWithProgress.length;
    const completedLessons = lessonsWithProgress.filter(l => l.progress?.completed).length;
    const completionPercent = totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0;

    // Get quiz info if exists
    const { data: quizQuestions } = await supabaseAdmin
      .from('course_quiz_questions')
      .select('id')
      .eq('module_id', module.id)
      .eq('is_published', true);

    let quiz = null;
    if (quizQuestions && quizQuestions.length > 0) {
      const { data: bestAttempt } = await supabaseAdmin
        .from('course_quiz_attempts')
        .select('*')
        .eq('user_id', user.id)
        .eq('module_id', module.id)
        .order('score_percent', { ascending: false })
        .limit(1)
        .single();

      const { count: attemptsCount } = await supabaseAdmin
        .from('course_quiz_attempts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('module_id', module.id);

      quiz = {
        questionsCount: quizQuestions.length,
        passingScore: module.min_quiz_score || 70,
        bestAttempt: bestAttempt ? {
          id: bestAttempt.id,
          moduleId: bestAttempt.module_id,
          questionsTotal: bestAttempt.questions_total,
          questionsCorrect: bestAttempt.questions_correct,
          scorePercent: bestAttempt.score_percent,
          passed: bestAttempt.passed,
          startedAt: bestAttempt.started_at,
          completedAt: bestAttempt.completed_at,
          attemptNumber: bestAttempt.attempt_number,
        } : null,
        attemptsCount: attemptsCount || 0,
      };
    }

    // Get previous and next modules
    const { data: allModules } = await supabaseAdmin
      .from('course_modules')
      .select('id, slug, title, sort_order')
      .eq('course_id', course.id)
      .eq('is_published', true)
      .order('sort_order');

    const currentIndex = (allModules || []).findIndex(m => m.id === module.id);
    const prevModule = currentIndex > 0 ? allModules![currentIndex - 1] : null;
    const nextModule = currentIndex < (allModules?.length || 0) - 1 ? allModules![currentIndex + 1] : null;

    // Check if next module is locked
    let nextModuleLocked = false;
    if (nextModule) {
      const { data: canAccessNext } = await supabaseAdmin.rpc('can_access_module', {
        p_user_id: user.id,
        p_module_id: nextModule.id,
      });
      nextModuleLocked = !canAccessNext;
    }

    return NextResponse.json({
      module: {
        id: module.id,
        courseId: module.course_id,
        title: module.title,
        slug: module.slug,
        description: module.description,
        moduleNumber: module.module_number,
        thumbnailUrl: module.thumbnail_url,
        sortOrder: module.sort_order,
        isPublished: module.is_published,
        requiresQuizPass: module.requires_quiz_pass,
        minQuizScore: module.min_quiz_score,
        isRequired: module.is_required,
        createdAt: module.created_at,
      },
      lessons: lessonsWithProgress,
      progress: {
        moduleId: module.id,
        totalLessons,
        completedLessons,
        completionPercent,
        isLocked: false,
        bestQuizScore: quiz?.bestAttempt?.scorePercent || null,
        quizPassed: quiz?.bestAttempt?.passed || false,
      },
      quiz,
      prevModule: prevModule ? { slug: prevModule.slug, title: prevModule.title } : null,
      nextModule: nextModule ? { slug: nextModule.slug, title: nextModule.title, isLocked: nextModuleLocked } : null,
      courseTitle: course.title,
    });
  } catch (error) {
    console.error('Error in module detail API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
