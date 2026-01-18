/**
 * Practice Submit API
 *
 * POST /api/practice/submit - Submit a practice attempt
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { generateAttemptFeedback } from '@/lib/scenario-generator';
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
    const { scenarioId, decision, reasoning, ltpChecklist, timeTakenSeconds } = body;

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

    // Generate feedback
    const scenarioData = {
      title: scenario.title,
      description: scenario.description,
      symbol: scenario.symbol,
      scenarioType: scenario.scenario_type,
      difficulty: scenario.difficulty,
      chartData: scenario.chart_data,
      keyLevels: scenario.key_levels,
      decisionPoint: scenario.decision_point,
      correctAction: scenario.correct_action,
      outcomeData: scenario.outcome_data,
      ltpAnalysis: scenario.ltp_analysis,
      explanation: scenario.explanation,
      tags: scenario.tags,
    };

    const feedback = await generateAttemptFeedback(
      scenarioData,
      decision,
      reasoning,
      isCorrect
    );

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
        time_taken_seconds: timeTakenSeconds,
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

    logger.info('Practice attempt submitted', {
      userId: session.userId,
      scenarioId,
      decision,
      isCorrect,
    });

    return NextResponse.json({
      success: true,
      attempt: {
        id: attempt.id,
        isCorrect,
        feedback,
      },
      correctAction: scenario.correct_action,
      outcomeData: scenario.outcome_data,
      ltpAnalysis: scenario.ltp_analysis,
      explanation: scenario.explanation,
      userStats: stats ? {
        totalAttempts: stats.total_attempts,
        correctAttempts: stats.correct_attempts,
        accuracyPercent: stats.accuracy_percent,
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
