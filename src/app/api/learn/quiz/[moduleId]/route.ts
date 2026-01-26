import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getAuthenticatedUser } from '@/lib/auth';

// GET - Get quiz questions for a module
export async function GET(
  request: Request,
  { params }: { params: Promise<{ moduleId: string }> }
) {
  try {
    const { moduleId } = await params;
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

    // Fetch module
    const { data: module, error: moduleError } = await supabaseAdmin
      .from('course_modules')
      .select(`
        *,
        course:courses(slug, title)
      `)
      .eq('id', moduleId)
      .eq('is_published', true)
      .single();

    if (moduleError || !module) {
      return NextResponse.json({ error: 'Module not found' }, { status: 404 });
    }

    // Module access check disabled - all modules unlocked for development
    // TODO: Re-enable when gating is properly configured with user_course_access records
    // const { data: canAccess } = await supabaseAdmin.rpc('can_access_module', {
    //   p_user_id: user.id,
    //   p_module_id: module.id,
    // });
    // if (!canAccess) {
    //   return NextResponse.json(
    //     { error: 'Complete all lessons to unlock this quiz' },
    //     { status: 403 }
    //   );
    // }

    // Fetch quiz questions with choices
    const { data: questions, error: questionsError } = await supabaseAdmin
      .from('course_quiz_questions')
      .select(`
        *,
        choices:course_quiz_choices(*)
      `)
      .eq('module_id', moduleId)
      .eq('is_published', true)
      .order('sort_order');

    if (questionsError) {
      throw new Error('Failed to fetch questions');
    }

    if (!questions || questions.length === 0) {
      return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
    }

    // Get previous best score
    const { data: bestAttempt } = await supabaseAdmin
      .from('course_quiz_attempts')
      .select('score_percent')
      .eq('user_id', user.id)
      .eq('module_id', moduleId)
      .order('score_percent', { ascending: false })
      .limit(1)
      .single();

    // Get attempts count
    const { count: attemptsCount } = await supabaseAdmin
      .from('course_quiz_attempts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('module_id', moduleId);

    // Transform questions - shuffle choices
    const transformedQuestions = questions.map(q => ({
      id: q.id,
      moduleId: q.module_id,
      lessonId: q.lesson_id,
      questionType: q.question_type,
      questionText: q.question_text,
      explanation: q.explanation,
      remediationVideoId: q.remediation_video_id,
      remediationTimestampSeconds: q.remediation_timestamp_seconds,
      sortOrder: q.sort_order,
      choices: shuffleArray((q.choices || []).map((c: Record<string, unknown>) => ({
        id: c.id,
        questionId: c.question_id,
        choiceText: c.choice_text,
        isCorrect: c.is_correct,
        sortOrder: c.sort_order,
      }))),
    }));

    return NextResponse.json({
      module: {
        id: module.id,
        title: module.title,
        slug: module.slug,
        moduleNumber: module.module_number,
      },
      questions: transformedQuestions,
      passingScore: module.min_quiz_score || 70,
      previousBestScore: bestAttempt?.score_percent || null,
      attemptsCount: attemptsCount || 0,
      courseSlug: module.course?.slug || '',
    });
  } catch (error) {
    console.error('Error in quiz API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Fisher-Yates shuffle
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
