import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

// POST - Submit quiz attempt
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { quizId, answers, timeTaken } = body;

    if (!quizId || !answers) {
      return NextResponse.json(
        { error: 'Quiz ID and answers are required' },
        { status: 400 }
      );
    }

    // Fetch the quiz to calculate score
    const { data: quiz, error: quizError } = await supabaseAdmin
      .from('quizzes')
      .select('*')
      .eq('id', quizId)
      .single();

    if (quizError || !quiz) {
      return NextResponse.json(
        { error: 'Quiz not found' },
        { status: 404 }
      );
    }

    // Calculate score
    const questions = quiz.questions as Array<{
      id: string;
      correctOptionId: string;
    }>;

    let correctCount = 0;
    const gradedAnswers = answers.map((answer: { questionId: string; selectedOptionId: string }) => {
      const question = questions.find((q) => q.id === answer.questionId);
      const isCorrect = question?.correctOptionId === answer.selectedOptionId;
      if (isCorrect) correctCount++;

      return {
        question_id: answer.questionId,
        selected_option_id: answer.selectedOptionId,
        is_correct: isCorrect,
      };
    });

    const percentage = Math.round((correctCount / questions.length) * 100);
    const passed = percentage >= (quiz.passing_score || 70);

    // Save quiz attempt
    const { data: attempt, error: attemptError } = await supabaseAdmin
      .from('quiz_attempts')
      .insert({
        user_id: session.user.id,
        quiz_id: quizId,
        score: correctCount,
        total_questions: questions.length,
        percentage,
        passed,
        answers: gradedAnswers,
        time_taken: timeTaken || null,
        completed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (attemptError) {
      console.error('Error saving quiz attempt:', attemptError);
      return NextResponse.json(
        { error: 'Failed to save quiz attempt' },
        { status: 500 }
      );
    }

    // If quiz is associated with a module, update best score
    if (quiz.module_id) {
      const { data: currentProgress } = await supabaseAdmin
        .from('user_module_progress')
        .select('quiz_best_score')
        .eq('user_id', session.user.id)
        .eq('module_id', quiz.module_id)
        .single();

      if (!currentProgress?.quiz_best_score || percentage > currentProgress.quiz_best_score) {
        await supabaseAdmin
          .from('user_module_progress')
          .upsert(
            {
              user_id: session.user.id,
              module_id: quiz.module_id,
              quiz_best_score: percentage,
              updated_at: new Date().toISOString(),
            },
            {
              onConflict: 'user_id,module_id',
            }
          );
      }
    }

    return NextResponse.json({
      success: true,
      attempt: {
        id: attempt.id,
        score: correctCount,
        totalQuestions: questions.length,
        percentage,
        passed,
        timeTaken: timeTaken || null,
      },
    });
  } catch (error) {
    console.error('Error submitting quiz:', error);
    return NextResponse.json(
      { error: 'Failed to submit quiz' },
      { status: 500 }
    );
  }
}
