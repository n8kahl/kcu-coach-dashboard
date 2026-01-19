/**
 * Admin Knowledge - Quiz Question Management
 *
 * Handles quiz question imports from bulk uploads
 * and CRUD operations for the Quiz Builder.
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import logger from '@/lib/logger';
import { z } from 'zod';

// Validation schemas
const QuizChoiceSchema = z.object({
  id: z.string().uuid().optional(),
  choiceText: z.string().min(1),
  isCorrect: z.boolean(),
  sortOrder: z.number().optional(),
});

const QuizQuestionSchema = z.object({
  id: z.string().uuid().optional(),
  lessonId: z.string().uuid().nullable().optional(),
  questionType: z.enum(['single', 'multiple', 'true_false']),
  questionText: z.string().min(1),
  explanation: z.string().nullable().optional(),
  remediationVideoId: z.string().uuid().nullable().optional(),
  remediationTimestampSeconds: z.number().nullable().optional(),
  sortOrder: z.number().optional(),
  choices: z.array(QuizChoiceSchema).min(2),
});

const QuizImportSchema = z.object({
  moduleId: z.string().uuid(),
  questions: z.array(QuizQuestionSchema),
  replaceExisting: z.boolean().optional(), // If true, delete existing questions first
});

/**
 * POST /api/admin/knowledge/quiz
 *
 * Import quiz questions for a module.
 *
 * Request body:
 * {
 *   moduleId: string;
 *   questions: Array<{
 *     questionType: 'single' | 'multiple' | 'true_false';
 *     questionText: string;
 *     explanation?: string;
 *     choices: Array<{ choiceText: string; isCorrect: boolean }>;
 *   }>;
 *   replaceExisting?: boolean;
 * }
 */
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!session.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const validationResult = QuizImportSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validationResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { moduleId, questions, replaceExisting } = validationResult.data;

    // Verify module exists
    const { data: module, error: moduleError } = await supabaseAdmin
      .from('course_modules')
      .select('id, title, course_id')
      .eq('id', moduleId)
      .single();

    if (moduleError || !module) {
      return NextResponse.json({ error: 'Module not found' }, { status: 404 });
    }

    logger.info('Importing quiz questions', {
      moduleId,
      questionCount: questions.length,
      replaceExisting,
      adminId: session.userId,
    });

    const results = {
      questionsCreated: 0,
      questionsUpdated: 0,
      choicesCreated: 0,
      errors: [] as string[],
    };

    // If replaceExisting, delete all existing questions and choices for this module
    if (replaceExisting) {
      // First get existing question IDs
      const { data: existingQuestions } = await supabaseAdmin
        .from('quiz_questions')
        .select('id')
        .eq('module_id', moduleId);

      if (existingQuestions && existingQuestions.length > 0) {
        const questionIds = existingQuestions.map((q) => q.id);

        // Delete choices first (foreign key constraint)
        await supabaseAdmin
          .from('quiz_choices')
          .delete()
          .in('question_id', questionIds);

        // Then delete questions
        await supabaseAdmin
          .from('quiz_questions')
          .delete()
          .eq('module_id', moduleId);

        logger.info('Deleted existing quiz questions', {
          moduleId,
          count: existingQuestions.length,
        });
      }
    }

    // Get existing questions for update logic (if not replacing)
    const { data: existingQuestions } = await supabaseAdmin
      .from('quiz_questions')
      .select('id')
      .eq('module_id', moduleId);

    const existingQuestionIds = new Set(existingQuestions?.map((q) => q.id) || []);

    // Process each question
    for (let questionIndex = 0; questionIndex < questions.length; questionIndex++) {
      const questionData = questions[questionIndex];

      try {
        let questionId: string;

        const questionPayload = {
          module_id: moduleId,
          lesson_id: questionData.lessonId || null,
          question_type: questionData.questionType,
          question_text: questionData.questionText,
          explanation: questionData.explanation || null,
          remediation_video_id: questionData.remediationVideoId || null,
          remediation_timestamp_seconds: questionData.remediationTimestampSeconds || null,
          sort_order: questionData.sortOrder ?? questionIndex,
        };

        if (questionData.id && existingQuestionIds.has(questionData.id)) {
          // Update existing question
          const { error: updateError } = await supabaseAdmin
            .from('quiz_questions')
            .update(questionPayload)
            .eq('id', questionData.id);

          if (updateError) {
            results.errors.push(`Question "${questionData.questionText.slice(0, 50)}...": ${updateError.message}`);
            continue;
          }

          questionId = questionData.id;
          results.questionsUpdated++;

          // Delete existing choices for this question
          await supabaseAdmin
            .from('quiz_choices')
            .delete()
            .eq('question_id', questionId);
        } else {
          // Create new question
          const { data: newQuestion, error: insertError } = await supabaseAdmin
            .from('quiz_questions')
            .insert(questionPayload)
            .select('id')
            .single();

          if (insertError || !newQuestion) {
            results.errors.push(
              `Question "${questionData.questionText.slice(0, 50)}...": ${insertError?.message || 'Insert failed'}`
            );
            continue;
          }

          questionId = newQuestion.id;
          results.questionsCreated++;
        }

        // Insert choices for this question
        const choicePayloads = questionData.choices.map((choice, choiceIndex) => ({
          question_id: questionId,
          choice_text: choice.choiceText,
          is_correct: choice.isCorrect,
          sort_order: choice.sortOrder ?? choiceIndex,
        }));

        const { error: choicesError } = await supabaseAdmin
          .from('quiz_choices')
          .insert(choicePayloads);

        if (choicesError) {
          results.errors.push(`Choices for question: ${choicesError.message}`);
        } else {
          results.choicesCreated += choicePayloads.length;
        }
      } catch (questionError) {
        results.errors.push(
          `Question "${questionData.questionText.slice(0, 50)}...": ${
            questionError instanceof Error ? questionError.message : 'Unknown error'
          }`
        );
      }
    }

    logger.info('Quiz import complete', {
      moduleId,
      results,
    });

    return NextResponse.json({
      success: results.errors.length === 0,
      ...results,
    });
  } catch (error) {
    logger.error(
      'Error importing quiz questions',
      error instanceof Error ? error : { message: String(error) }
    );
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/knowledge/quiz
 *
 * Get quiz questions for a module.
 *
 * Query params:
 * - moduleId: string (required)
 */
export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!session.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const moduleId = searchParams.get('moduleId');

    if (!moduleId) {
      return NextResponse.json(
        { error: 'moduleId is required' },
        { status: 400 }
      );
    }

    // Get questions with choices
    const { data: questions, error: questionsError } = await supabaseAdmin
      .from('quiz_questions')
      .select(`
        id,
        module_id,
        lesson_id,
        question_type,
        question_text,
        explanation,
        remediation_video_id,
        remediation_timestamp_seconds,
        sort_order,
        quiz_choices (
          id,
          choice_text,
          is_correct,
          sort_order
        )
      `)
      .eq('module_id', moduleId)
      .order('sort_order', { ascending: true });

    if (questionsError) {
      logger.error('Error fetching quiz questions', { error: questionsError.message });
      return NextResponse.json(
        { error: 'Failed to fetch questions' },
        { status: 500 }
      );
    }

    // Transform to camelCase for frontend
    const transformedQuestions = questions?.map((q) => ({
      id: q.id,
      moduleId: q.module_id,
      lessonId: q.lesson_id,
      questionType: q.question_type,
      questionText: q.question_text,
      explanation: q.explanation,
      remediationVideoId: q.remediation_video_id,
      remediationTimestampSeconds: q.remediation_timestamp_seconds,
      sortOrder: q.sort_order,
      choices: (q.quiz_choices || [])
        .sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order)
        .map((c: { id: string; choice_text: string; is_correct: boolean; sort_order: number }) => ({
          id: c.id,
          questionId: q.id,
          choiceText: c.choice_text,
          isCorrect: c.is_correct,
          sortOrder: c.sort_order,
        })),
    }));

    return NextResponse.json({
      questions: transformedQuestions || [],
    });
  } catch (error) {
    logger.error(
      'Error fetching quiz questions',
      error instanceof Error ? error : { message: String(error) }
    );
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/knowledge/quiz
 *
 * Delete a quiz question.
 *
 * Query params:
 * - questionId: string (required)
 */
export async function DELETE(request: Request) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!session.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const questionId = searchParams.get('questionId');

    if (!questionId) {
      return NextResponse.json(
        { error: 'questionId is required' },
        { status: 400 }
      );
    }

    // Delete choices first (foreign key constraint)
    await supabaseAdmin
      .from('quiz_choices')
      .delete()
      .eq('question_id', questionId);

    // Then delete the question
    const { error: deleteError } = await supabaseAdmin
      .from('quiz_questions')
      .delete()
      .eq('id', questionId);

    if (deleteError) {
      logger.error('Error deleting quiz question', { error: deleteError.message });
      return NextResponse.json(
        { error: 'Failed to delete question' },
        { status: 500 }
      );
    }

    logger.info('Deleted quiz question', {
      questionId,
      adminId: session.userId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error(
      'Error deleting quiz question',
      error instanceof Error ? error : { message: String(error) }
    );
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
