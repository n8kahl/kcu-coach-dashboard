/**
 * Quiz API Endpoints
 *
 * GET /api/learning/v2/quizzes/[id] - Get quiz details (without answers)
 * POST /api/learning/v2/quizzes/[id] - Submit quiz attempt
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { getQuizById, getQuizByModuleSlug } from '@/data/quizzes';
import {
  SubmitQuizSchema,
  QuizResultSchema,
  type QuizResult,
} from '@/lib/validations/learning';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/learning/v2/quizzes/[id]
 * Get quiz details without revealing correct answers
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();

    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Try to find quiz by ID or module slug
    let quiz = getQuizById(id);
    if (!quiz) {
      quiz = getQuizByModuleSlug(id);
    }

    // If not in local data, try database
    if (!quiz) {
      const { data: dbQuiz, error } = await supabaseAdmin
        .from('quizzes')
        .select('*')
        .eq('id', id)
        .eq('is_published', true)
        .single();

      if (error || !dbQuiz) {
        return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
      }

      // Transform database quiz to our format
      const questions = (dbQuiz.questions as Array<{
        id: string;
        question: string;
        options: { id: string; text: string }[];
        correctOptionId: string;
        explanation: string;
      }>) || [];

      return NextResponse.json({
        id: dbQuiz.id,
        moduleId: dbQuiz.module_id,
        moduleSlug: null,
        title: dbQuiz.title,
        description: dbQuiz.description,
        passingScore: dbQuiz.passing_score || 70,
        timeLimit: dbQuiz.time_limit,
        questions: questions.map((q) => ({
          id: q.id,
          question: q.question,
          options: q.options,
          // Don't include correctOptionId or explanation before submission
        })),
        questionsCount: questions.length,
      });
    }

    // Return quiz without correct answers
    return NextResponse.json({
      id: quiz.id,
      moduleId: quiz.moduleId,
      moduleSlug: quiz.moduleSlug,
      title: quiz.title,
      description: quiz.description,
      passingScore: quiz.passingScore,
      timeLimit: quiz.timeLimit,
      questions: quiz.questions.map((q) => ({
        id: q.id,
        question: q.question,
        options: q.options,
        // Don't include correctOptionId or explanation
      })),
      questionsCount: quiz.questions.length,
    });
  } catch (error) {
    console.error('Error fetching quiz:', error);
    return NextResponse.json({ error: 'Failed to fetch quiz' }, { status: 500 });
  }
}

/**
 * POST /api/learning/v2/quizzes/[id]
 * Submit quiz attempt and get graded results
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();

    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    // Validate input
    const parsed = SubmitQuizSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { answers, timeTaken } = parsed.data;

    // Find quiz
    let quiz = getQuizById(id);
    if (!quiz) {
      quiz = getQuizByModuleSlug(id);
    }

    let questions: Array<{
      id: string;
      question: string;
      options: { id: string; text: string }[];
      correctOptionId: string;
      explanation: string;
    }>;
    let quizId = id;
    let moduleId: string | null = null;

    if (quiz) {
      questions = quiz.questions;
      quizId = quiz.id;
      moduleId = quiz.moduleId;
    } else {
      // Try database
      const { data: dbQuiz, error } = await supabaseAdmin
        .from('quizzes')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !dbQuiz) {
        return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
      }

      questions = dbQuiz.questions as typeof questions;
      quizId = dbQuiz.id;
      moduleId = dbQuiz.module_id;
    }

    // Grade the quiz
    let correctCount = 0;
    const gradedAnswers = answers.map((answer) => {
      const question = questions.find((q) => q.id === answer.questionId);
      if (!question) {
        return {
          questionId: answer.questionId,
          selectedOptionId: answer.selectedOptionId,
          correctOptionId: '',
          isCorrect: false,
          explanation: 'Question not found',
        };
      }

      const isCorrect = question.correctOptionId === answer.selectedOptionId;
      if (isCorrect) correctCount++;

      return {
        questionId: answer.questionId,
        selectedOptionId: answer.selectedOptionId,
        correctOptionId: question.correctOptionId,
        isCorrect,
        explanation: question.explanation,
      };
    });

    const percentage = Math.round((correctCount / questions.length) * 100);
    const passingScore = quiz?.passingScore || 70;
    const passed = percentage >= passingScore;

    // Save quiz attempt to database
    const { data: attempt, error: attemptError } = await supabaseAdmin
      .from('quiz_attempts')
      .insert({
        user_id: session.userId,
        quiz_id: quizId,
        score: correctCount,
        total_questions: questions.length,
        percentage,
        passed,
        answers: gradedAnswers.map((a) => ({
          question_id: a.questionId,
          selected_option_id: a.selectedOptionId,
          is_correct: a.isCorrect,
        })),
        time_taken: timeTaken || null,
        completed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (attemptError) {
      console.error('Error saving quiz attempt:', attemptError);
      // Continue anyway - we can still return the result
    }

    // Update module progress with best quiz score if applicable
    if (moduleId) {
      const { data: currentProgress } = await supabaseAdmin
        .from('user_module_progress')
        .select('quiz_best_score')
        .eq('user_id', session.userId)
        .eq('module_id', moduleId)
        .single();

      if (!currentProgress?.quiz_best_score || percentage > currentProgress.quiz_best_score) {
        await supabaseAdmin
          .from('user_module_progress')
          .upsert(
            {
              user_id: session.userId,
              module_id: moduleId,
              quiz_best_score: percentage,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id,module_id' }
          );
      }
    }

    const result: QuizResult = {
      attemptId: attempt?.id || 'local-' + Date.now(),
      score: correctCount,
      totalQuestions: questions.length,
      percentage,
      passed,
      timeTaken: timeTaken || null,
      answers: gradedAnswers,
    };

    // Validate response shape
    const validated = QuizResultSchema.safeParse(result);
    if (!validated.success) {
      console.error('Quiz result validation failed:', validated.error);
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error submitting quiz:', error);
    return NextResponse.json({ error: 'Failed to submit quiz' }, { status: 500 });
  }
}
