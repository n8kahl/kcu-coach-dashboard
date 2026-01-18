/**
 * Practice Scenario Detail API
 *
 * GET /api/practice/scenarios/[id] - Get a specific scenario with chart data
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import logger from '@/lib/logger';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/practice/scenarios/[id]
 * Get full scenario details including chart data (but not outcome until submitted)
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const { searchParams } = new URL(request.url);
    const includeOutcome = searchParams.get('includeOutcome') === 'true';

    const { data: scenario, error } = await supabaseAdmin
      .from('practice_scenarios')
      .select('*')
      .eq('id', id)
      .eq('is_active', true)
      .single();

    if (error || !scenario) {
      return NextResponse.json({ error: 'Scenario not found' }, { status: 404 });
    }

    // Check if user has already attempted this scenario
    const { data: attempt } = await supabaseAdmin
      .from('practice_attempts')
      .select('id, decision, is_correct, feedback, created_at')
      .eq('user_id', session.userId)
      .eq('scenario_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // Build response - hide outcome data and correct answer unless already attempted
    const response: Record<string, unknown> = {
      id: scenario.id,
      title: scenario.title,
      description: scenario.description,
      symbol: scenario.symbol,
      scenarioType: scenario.scenario_type,
      difficulty: scenario.difficulty,
      chartData: scenario.chart_data,
      keyLevels: scenario.key_levels,
      decisionPoint: scenario.decision_point,
      tags: scenario.tags,
      hasAttempted: !!attempt,
    };

    // Only include outcome/answer if user has attempted or admin is requesting
    if (attempt || includeOutcome) {
      response.correctAction = scenario.correct_action;
      response.outcomeData = scenario.outcome_data;
      response.ltpAnalysis = scenario.ltp_analysis;
      response.explanation = scenario.explanation;
    }

    if (attempt) {
      response.lastAttempt = {
        decision: attempt.decision,
        isCorrect: attempt.is_correct,
        feedback: attempt.feedback,
        attemptedAt: attempt.created_at,
      };
    }

    return NextResponse.json(response);

  } catch (error) {
    logger.error('Error fetching scenario', error instanceof Error ? error : { message: String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/practice/scenarios/[id]
 * Delete a scenario (admin only)
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!session.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    // Soft delete by setting is_active to false
    const { error } = await supabaseAdmin
      .from('practice_scenarios')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      logger.error('Error deleting scenario', { error: error.message });
      return NextResponse.json({ error: 'Failed to delete scenario' }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    logger.error('Error in scenario DELETE', error instanceof Error ? error : { message: String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
