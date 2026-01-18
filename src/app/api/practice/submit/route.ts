/**
 * Practice Submit API
 *
 * POST /api/practice/submit - Submit a practice attempt with AI coaching
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { generateAttemptFeedback } from '@/lib/scenario-generator';
import { generateAICoachingFeedback, generateQuickDrillFeedback } from '@/lib/practice-ai-coach';
import logger from '@/lib/logger';

interface SubmitRequest {
  scenarioId: string;
  decision: 'long' | 'short' | 'wait';
  reasoning?: string;
  ltpChecklist?: {
    levelScore?: number;
    trendScore?: number;
    patienceScore?: number;
    notes?: string;
  };
  timeTakenSeconds?: number;
  sessionId?: string;
  mode?: string;
  useAICoaching?: boolean;
  emotionTag?: string;
}

/**
 * POST /api/practice/submit
 * Submit a practice attempt and get feedback
 */
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: SubmitRequest = await request.json();
    const {
      scenarioId,
      decision,
      reasoning,
      ltpChecklist,
      timeTakenSeconds,
      sessionId,
      mode,
      useAICoaching,
      emotionTag,
    } = body;

    // Validate request
    if (!scenarioId || !decision) {
      return NextResponse.json({
        error: 'scenarioId and decision are required',
      }, { status: 400 });
    }

    if (!['long', 'short', 'wait'].includes(decision)) {
      return NextResponse.json({
        error: 'decision must be "long", "short", or "wait"',
      }, { status: 400 });
    }

    // Fetch the scenario
    const { data: scenario, error: scenarioError } = await supabaseAdmin
      .from('practice_scenarios')
      .select('*')
      .eq('id', scenarioId)
      .eq('is_active', true)
      .single();

    if (scenarioError || !scenario) {
      return NextResponse.json({ error: 'Scenario not found' }, { status: 404 });
    }

    // Determine if correct
    const isCorrect = decision === scenario.correct_action;

    // Build scenario data for feedback
    const scenarioData = {
      title: scenario.title,
      description: scenario.description,
      symbol: scenario.symbol,
      scenarioType: scenario.scenario_type,
      difficulty: scenario.difficulty,
      chartData: scenario.chart_data,
      keyLevels: scenario.key_levels || [],
      decisionPoint: scenario.decision_point,
      correctAction: scenario.correct_action,
      outcomeData: scenario.outcome_data,
      ltpAnalysis: scenario.ltp_analysis || {
        level: { score: 70, reason: 'Level analysis' },
        trend: { score: 70, reason: 'Trend analysis' },
        patience: { score: 70, reason: 'Patience analysis' },
      },
      explanation: scenario.explanation,
      tags: scenario.tags || [],
      focusArea: scenario.focus_area,
      relatedLessonSlug: scenario.related_lesson_slug,
    };

    // Generate feedback - AI or basic
    let feedback: string;
    let aiCoaching = null;

    if (mode === 'quick_drill') {
      // Quick drill gets simple feedback
      const quickFeedback = await generateQuickDrillFeedback(scenarioData, {
        decision,
        reasoning,
        timeTakenSeconds,
      });
      feedback = `${quickFeedback.quickFeedback} ${quickFeedback.tip}`;
    } else if (useAICoaching) {
      // Get user context for personalized coaching
      const { data: userStats } = await supabaseAdmin
        .from('user_practice_stats')
        .select('*')
        .eq('user_id', session.userId)
        .single();

      const { data: streakData } = await supabaseAdmin
        .from('practice_streaks')
        .select('current_count, best_count')
        .eq('user_id', session.userId)
        .eq('streak_type', 'correct_in_row')
        .single();

      const userContext = userStats ? {
        totalAttempts: userStats.total_attempts || 0,
        correctAttempts: userStats.correct_attempts || 0,
        accuracyPercent: userStats.accuracy_percent || 0,
        currentStreak: streakData?.current_count || 0,
      } : undefined;

      // Generate AI coaching feedback
      try {
        aiCoaching = await generateAICoachingFeedback(
          scenarioData,
          {
            decision,
            reasoning,
            ltpChecklist: ltpChecklist ? {
              levelScore: ltpChecklist.levelScore,
              trendScore: ltpChecklist.trendScore,
              patienceScore: ltpChecklist.patienceScore,
              notes: ltpChecklist.notes,
            } : undefined,
            timeTakenSeconds,
            emotionTag,
          },
          userContext
        );
        feedback = aiCoaching.summary;
      } catch (aiError) {
        logger.warn('AI coaching failed, using basic feedback', {
          error: aiError instanceof Error ? aiError.message : String(aiError),
        });
        feedback = await generateAttemptFeedback(
          scenarioData,
          decision,
          reasoning,
          isCorrect
        );
      }
    } else {
      // Basic feedback
      feedback = await generateAttemptFeedback(
        scenarioData,
        decision,
        reasoning,
        isCorrect
      );
    }

    // Save the attempt
    const { data: attempt, error: attemptError } = await supabaseAdmin
      .from('practice_attempts')
      .insert({
        user_id: session.userId,
        scenario_id: scenarioId,
        decision,
        reasoning,
        ltp_checklist: ltpChecklist,
        is_correct: isCorrect,
        feedback,
        ai_coaching_response: aiCoaching ? JSON.stringify(aiCoaching) : null,
        time_taken_seconds: timeTakenSeconds,
        session_id: sessionId || null,
        source: mode || 'practice',
        emotion_tag: emotionTag || null,
      })
      .select()
      .single();

    if (attemptError) {
      logger.error('Error saving attempt', { error: attemptError.message });
      return NextResponse.json({ error: 'Failed to save attempt' }, { status: 500 });
    }

    // Get user's updated stats
    const { data: stats } = await supabaseAdmin
      .from('user_practice_stats')
      .select('*')
      .eq('user_id', session.userId)
      .single();

    // Get updated streak
    const { data: updatedStreak } = await supabaseAdmin
      .from('practice_streaks')
      .select('current_count, best_count')
      .eq('user_id', session.userId)
      .eq('streak_type', 'correct_in_row')
      .single();

    logger.info('Practice attempt submitted', {
      userId: session.userId,
      scenarioId,
      decision,
      isCorrect,
      mode,
      hasAICoaching: !!aiCoaching,
    });

    // Format LTP analysis for response
    const ltpAnalysis = scenario.ltp_analysis ? {
      level: scenario.ltp_analysis.level || { score: 70, reason: scenario.ltp_analysis.levelNotes || '' },
      trend: scenario.ltp_analysis.trend || { score: 70, reason: scenario.ltp_analysis.trendNotes || '' },
      patience: scenario.ltp_analysis.patience || { score: 70, reason: scenario.ltp_analysis.patienceNotes || '' },
    } : null;

    return NextResponse.json({
      success: true,
      attempt: {
        id: attempt.id,
        isCorrect,
        feedback,
        aiCoaching,
      },
      correctAction: scenario.correct_action,
      outcomeData: scenario.outcome_data,
      ltpAnalysis,
      explanation: scenario.explanation,
      userStats: stats ? {
        totalAttempts: stats.total_attempts,
        correctAttempts: stats.correct_attempts,
        accuracyPercent: stats.accuracy_percent,
        currentStreak: updatedStreak?.current_count || 0,
        bestStreak: updatedStreak?.best_count || 0,
      } : null,
    });

  } catch (error) {
    logger.error('Error in practice submit', error instanceof Error ? error : { message: String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET /api/practice/submit
 * Get user's practice statistics
 */
export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');

    // Get overall stats
    const { data: stats } = await supabaseAdmin
      .from('user_practice_stats')
      .select('*')
      .eq('user_id', session.userId)
      .single();

    // Get recent attempts
    const { data: recentAttempts } = await supabaseAdmin
      .from('practice_attempts')
      .select(`
        id,
        decision,
        is_correct,
        feedback,
        time_taken_seconds,
        created_at,
        scenario:practice_scenarios (
          id,
          title,
          symbol,
          scenario_type,
          difficulty,
          correct_action
        )
      `)
      .eq('user_id', session.userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    // Get performance by scenario type
    const { data: typeStats } = await supabaseAdmin
      .from('practice_attempts')
      .select(`
        is_correct,
        scenario:practice_scenarios (scenario_type)
      `)
      .eq('user_id', session.userId);

    const byType: Record<string, { attempts: number; correct: number }> = {};
    for (const attempt of typeStats || []) {
      const type = (attempt.scenario as { scenario_type?: string })?.scenario_type || 'unknown';
      if (!byType[type]) byType[type] = { attempts: 0, correct: 0 };
      byType[type].attempts++;
      if (attempt.is_correct) byType[type].correct++;
    }

    return NextResponse.json({
      stats: stats ? {
        totalAttempts: stats.total_attempts,
        correctAttempts: stats.correct_attempts,
        accuracyPercent: stats.accuracy_percent,
        uniqueScenarios: stats.unique_scenarios,
        avgTimeSeconds: stats.avg_time_seconds,
        lastPracticeAt: stats.last_practice_at,
      } : null,
      recentAttempts: recentAttempts || [],
      performanceByType: byType,
    });

  } catch (error) {
    logger.error('Error fetching practice stats', error instanceof Error ? error : { message: String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
