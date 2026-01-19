import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getAuthenticatedUser } from '@/lib/auth';

interface QuizAnswer {
  questionId: string;
  selectedChoiceIds: string[];
  isCorrect: boolean;
  timeSpentSeconds: number;
}

// POST - Submit quiz answers
export async function POST(
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

    const body = await request.json();
    const { answers } = body as { answers: QuizAnswer[] };

    if (!answers || !Array.isArray(answers)) {
      return NextResponse.json({ error: 'Invalid answers' }, { status: 400 });
    }

    // Fetch module for passing score
    const { data: module, error: moduleError } = await supabaseAdmin
      .from('course_modules')
      .select('min_quiz_score')
      .eq('id', moduleId)
      .single();

    if (moduleError || !module) {
      return NextResponse.json({ error: 'Module not found' }, { status: 404 });
    }

    // Calculate score
    const correctCount = answers.filter(a => a.isCorrect).length;
    const totalQuestions = answers.length;
    const scorePercent = totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0;
    const passed = scorePercent >= (module.min_quiz_score || 70);
    const totalTimeSpent = answers.reduce((sum, a) => sum + a.timeSpentSeconds, 0);

    // Get current attempt number
    const { count: previousAttempts } = await supabaseAdmin
      .from('course_quiz_attempts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('module_id', moduleId);

    const attemptNumber = (previousAttempts || 0) + 1;

    // Save quiz attempt
    const { data: attempt, error: attemptError } = await supabaseAdmin
      .from('course_quiz_attempts')
      .insert({
        user_id: user.id,
        module_id: moduleId,
        questions_total: totalQuestions,
        questions_correct: correctCount,
        score_percent: scorePercent,
        passed,
        answers: answers.map(a => ({
          question_id: a.questionId,
          selected_choices: a.selectedChoiceIds,
          is_correct: a.isCorrect,
          time_spent_seconds: a.timeSpentSeconds,
        })),
        started_at: new Date(Date.now() - totalTimeSpent * 1000).toISOString(),
        completed_at: new Date().toISOString(),
        time_spent_seconds: totalTimeSpent,
        device_type: getDeviceType(request.headers.get('user-agent') || ''),
        browser: getBrowser(request.headers.get('user-agent') || ''),
        attempt_number: attemptNumber,
      })
      .select()
      .single();

    if (attemptError) {
      console.error('Error saving quiz attempt:', attemptError);
      throw new Error('Failed to save quiz attempt');
    }

    // Update daily activity
    await supabaseAdmin.rpc('update_daily_activity', {
      p_user_id: user.id,
      p_lessons_started: 0,
      p_lessons_completed: 0,
      p_watch_seconds: 0,
      p_quizzes_taken: 1,
      p_quizzes_passed: passed ? 1 : 0,
    });

    // Check for quiz-related achievements
    if (passed) {
      // Check for "Quiz Ace" achievement (100% score)
      if (scorePercent === 100) {
        await checkAndAwardAchievement(user.id, 'quiz_ace');
      }

      // Check for "Quiz Master" achievement (all quizzes passed)
      await checkAllQuizzesPassed(user.id);
    }

    return NextResponse.json({
      attempt: {
        id: attempt.id,
        moduleId: attempt.module_id,
        questionsTotal: attempt.questions_total,
        questionsCorrect: attempt.questions_correct,
        scorePercent: attempt.score_percent,
        passed: attempt.passed,
        attemptNumber: attempt.attempt_number,
        completedAt: attempt.completed_at,
      },
      score: scorePercent,
      passed,
      correctCount,
      totalQuestions,
    });
  } catch (error) {
    console.error('Error submitting quiz:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function checkAndAwardAchievement(userId: string, achievementSlug: string) {
  try {
    // Get achievement
    const { data: achievement } = await supabaseAdmin
      .from('learning_achievements')
      .select('id')
      .eq('slug', achievementSlug)
      .single();

    if (!achievement) return;

    // Check if already earned
    const { data: existing } = await supabaseAdmin
      .from('user_learning_achievements')
      .select('id')
      .eq('user_id', userId)
      .eq('achievement_id', achievement.id)
      .single();

    if (existing) return;

    // Award achievement
    await supabaseAdmin
      .from('user_learning_achievements')
      .insert({
        user_id: userId,
        achievement_id: achievement.id,
        context: { source: 'quiz' },
      });
  } catch (error) {
    console.error('Error awarding achievement:', error);
  }
}

async function checkAllQuizzesPassed(userId: string) {
  try {
    // Get all modules with quizzes
    const { data: modulesWithQuizzes } = await supabaseAdmin
      .from('course_modules')
      .select('id')
      .eq('is_published', true)
      .eq('requires_quiz_pass', true);

    if (!modulesWithQuizzes || modulesWithQuizzes.length === 0) return;

    // Check if user has passed all quizzes
    const moduleIds = modulesWithQuizzes.map(m => m.id);
    const { data: passedQuizzes } = await supabaseAdmin
      .from('course_quiz_attempts')
      .select('module_id')
      .eq('user_id', userId)
      .eq('passed', true)
      .in('module_id', moduleIds);

    const passedModuleIds = new Set((passedQuizzes || []).map(q => q.module_id));

    if (passedModuleIds.size === modulesWithQuizzes.length) {
      await checkAndAwardAchievement(userId, 'quiz_master');
    }
  } catch (error) {
    console.error('Error checking quiz master achievement:', error);
  }
}

function getDeviceType(userAgent: string): string {
  if (/tablet|ipad/i.test(userAgent)) return 'tablet';
  if (/mobile|iphone|android/i.test(userAgent)) return 'mobile';
  return 'desktop';
}

function getBrowser(userAgent: string): string {
  if (userAgent.includes('Chrome')) return 'Chrome';
  if (userAgent.includes('Firefox')) return 'Firefox';
  if (userAgent.includes('Safari')) return 'Safari';
  if (userAgent.includes('Edge')) return 'Edge';
  return 'Unknown';
}
