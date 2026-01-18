/**
 * Practice Scenarios API
 *
 * GET /api/practice/scenarios - List available scenarios
 * POST /api/practice/scenarios - Create a new scenario (admin only)
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { generateScenarioFromHistory, saveScenario } from '@/lib/scenario-generator';
import logger from '@/lib/logger';

/**
 * GET /api/practice/scenarios
 * Get available practice scenarios with optional filters
 */
export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const difficulty = searchParams.get('difficulty');
    const scenarioType = searchParams.get('type');
    const symbol = searchParams.get('symbol');
    const limit = parseInt(searchParams.get('limit') || '20');

    let query = supabaseAdmin
      .from('practice_scenarios')
      .select(`
        id,
        title,
        description,
        symbol,
        scenario_type,
        difficulty,
        tags,
        created_at
      `)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (difficulty) {
      query = query.eq('difficulty', difficulty);
    }
    if (scenarioType) {
      query = query.eq('scenario_type', scenarioType);
    }
    if (symbol) {
      query = query.eq('symbol', symbol.toUpperCase());
    }

    const { data: scenarios, error } = await query;

    if (error) {
      logger.error('Error fetching scenarios', { error: error.message });
      return NextResponse.json({ error: 'Failed to fetch scenarios' }, { status: 500 });
    }

    // Get user's attempt stats for each scenario
    const scenarioIds = scenarios?.map(s => s.id) || [];
    const { data: attempts } = await supabaseAdmin
      .from('practice_attempts')
      .select('scenario_id, is_correct')
      .eq('user_id', session.userId)
      .in('scenario_id', scenarioIds);

    const attemptMap = new Map<string, { attempts: number; correct: number }>();
    for (const attempt of attempts || []) {
      const existing = attemptMap.get(attempt.scenario_id) || { attempts: 0, correct: 0 };
      existing.attempts++;
      if (attempt.is_correct) existing.correct++;
      attemptMap.set(attempt.scenario_id, existing);
    }

    const scenariosWithStats = scenarios?.map(s => ({
      ...s,
      userAttempts: attemptMap.get(s.id)?.attempts || 0,
      userCorrect: attemptMap.get(s.id)?.correct || 0,
    })) || [];

    return NextResponse.json({
      scenarios: scenariosWithStats,
      total: scenariosWithStats.length,
    });

  } catch (error) {
    logger.error('Error in scenarios GET', error instanceof Error ? error : { message: String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/practice/scenarios
 * Create a new practice scenario (admin only)
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
    const { action, symbol, ...scenarioData } = body;

    // Generate scenario from market data
    if (action === 'generate') {
      if (!symbol) {
        return NextResponse.json({ error: 'Symbol required for generation' }, { status: 400 });
      }

      const scenario = await generateScenarioFromHistory(symbol, new Date());

      if (!scenario) {
        return NextResponse.json({
          error: 'Could not generate valid scenario',
          detail: 'Not enough data or no clear setup found',
        }, { status: 400 });
      }

      const result = await saveScenario(scenario, session.userId);

      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        id: result.id,
        scenario,
      });
    }

    // Create custom scenario
    if (!scenarioData.title || !scenarioData.symbol || !scenarioData.chartData || !scenarioData.correctAction) {
      return NextResponse.json({
        error: 'Missing required fields',
        required: ['title', 'symbol', 'chartData', 'correctAction'],
      }, { status: 400 });
    }

    const result = await saveScenario(scenarioData, session.userId);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      id: result.id,
    });

  } catch (error) {
    logger.error('Error in scenarios POST', error instanceof Error ? error : { message: String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
