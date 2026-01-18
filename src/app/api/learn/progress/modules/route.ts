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

    if (!courseId) {
      return NextResponse.json({ error: 'courseId is required' }, { status: 400 });
    }

    // Get all modules for the course
    const { data: modules, error: modulesError } = await supabaseAdmin
      .from('course_modules')
      .select('*')
      .eq('course_id', courseId)
      .eq('is_published', true)
      .order('sort_order', { ascending: true });

    if (modulesError) {
      throw modulesError;
    }

    // Get lesson counts and progress for each module
    const modulesWithProgress = await Promise.all(
      (modules || []).map(async (module) => {
        // Get lessons count
        const { count: totalLessons } = await supabaseAdmin
          .from('course_lessons')
          .select('*', { count: 'exact', head: true })
          .eq('module_id', module.id)
          .eq('is_published', true);

        // Get module's lesson IDs first
        const { data: moduleLessons } = await supabaseAdmin
          .from('course_lessons')
          .select('id')
          .eq('module_id', module.id)
          .eq('is_published', true);

        const lessonIds = moduleLessons?.map(l => l.id) || [];

        // Get completed lessons count
        const { count: completedLessons } = lessonIds.length > 0
          ? await supabaseAdmin
              .from('course_lesson_progress')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', user.id)
              .eq('completed', true)
              .in('lesson_id', lessonIds)
          : { count: 0 };

        // Get best quiz score for this module
        const { data: quizAttempt } = await supabaseAdmin
          .from('course_quiz_attempts')
          .select('score_percent, passed')
          .eq('user_id', user.id)
          .eq('module_id', module.id)
          .order('score_percent', { ascending: false })
          .limit(1)
          .single();

        // Check if module is locked
        const { data: canAccess } = await supabaseAdmin.rpc('can_access_module', {
          p_user_id: user.id,
          p_module_id: module.id,
        });

        // Determine unlock reason if locked
        let unlockReason: string | undefined;
        if (!canAccess) {
          if (module.unlock_after_module_id) {
            const { data: prevModule } = await supabaseAdmin
              .from('course_modules')
              .select('title')
              .eq('id', module.unlock_after_module_id)
              .single();
            unlockReason = `Complete ${prevModule?.title || 'previous module'} first`;

            if (module.requires_quiz_pass) {
              unlockReason += ` and pass the quiz with ${module.min_quiz_score}%`;
            }
          } else if (module.unlock_after_days) {
            unlockReason = `Unlocks ${module.unlock_after_days} days after enrollment`;
          }
        }

        const total = totalLessons || 0;
        const completed = completedLessons || 0;

        return {
          ...transformModule(module),
          progress: {
            moduleId: module.id,
            totalLessons: total,
            completedLessons: completed,
            completionPercent: total > 0 ? Math.round((completed / total) * 100) : 0,
            isLocked: !canAccess,
            unlockReason,
            bestQuizScore: quizAttempt?.score_percent ?? null,
            quizPassed: quizAttempt?.passed ?? false,
          },
        };
      })
    );

    return NextResponse.json({
      modules: modulesWithProgress,
    });
  } catch (error) {
    console.error('Error fetching module progress:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
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
