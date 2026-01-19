/**
 * Practice Scenario Detail API
 *
 * GET /api/practice/scenarios/[id] - Get a specific scenario with chart data
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import logger from '@/lib/logger';
import {
  generateScenarioData,
  type ScenarioDataConfig,
} from '@/lib/practice/scenario-data-generator';

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
    const includeOutcomeParam = searchParams.get('includeOutcome') === 'true';

    // Only admins can request outcome data via includeOutcome param
    // Non-admins must have attempted the scenario to see the answer
    const includeOutcome = includeOutcomeParam && session.isAdmin === true;

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

    // Enhance chart data if insufficient candles (< 100)
    let chartData = scenario.chart_data;
    const existingCandles = chartData?.candles?.length || 0;

    if (existingCandles < 100) {
      try {
        // Generate proper historical data using the scenario generator
        const setupTypeMap: Record<string, ScenarioDataConfig['setupType']> = {
          'level_test': 'support_bounce',
          'trend_continuation': 'trend_continuation',
          'reversal': 'failed_breakdown',
          'breakout': 'breakout',
          'gap_trade': 'gap_fill',
          'mtf_analysis': 'support_bounce',
          'exhaustion': 'exhaustion',
          'psychology': 'exhaustion',
          'patience_test': 'support_bounce',
          'trap_recognition': 'bear_trap',
          'liquidity_sweep': 'liquidity_sweep',
          'divergence': 'divergence',
        };

        const setupType = setupTypeMap[scenario.scenario_type] || 'support_bounce';

        // Get base price from existing data or key levels
        const basePrice = chartData?.candles?.[0]?.o ||
          scenario.key_levels?.[0]?.price ||
          100;

        const outcomeResult = scenario.outcome_data?.result;
        const outcome = outcomeResult === 'win' ? 'win' :
                        outcomeResult === 'loss' ? 'loss' : 'neutral';

        const config: ScenarioDataConfig = {
          symbol: scenario.symbol,
          basePrice,
          volatility: getSymbolVolatility(scenario.symbol),
          trend: getTrendForSetup(setupType),
          setupType,
          timeframe: (scenario.chart_timeframe || '5m') as ScenarioDataConfig['timeframe'],
          totalCandles: 150,
          decisionPointIndex: 120,
          outcomeCandles: 25,
          outcome,
        };

        const generatedData = generateScenarioData(config);

        chartData = {
          candles: generatedData.candles,
          volume_profile: chartData?.volume_profile || {
            high_vol_node: generatedData.decisionPointCandle.l,
            low_vol_node: generatedData.decisionPointCandle.h,
          },
          premarket: {
            high: generatedData.premarketHigh,
            low: generatedData.premarketLow,
          },
        };
      } catch (genError) {
        logger.warn('Failed to generate enhanced chart data', { error: genError });
        // Continue with original data if generation fails
      }
    }

    // Build response - hide outcome data and correct answer unless already attempted
    const response: Record<string, unknown> = {
      id: scenario.id,
      title: scenario.title,
      description: scenario.description,
      symbol: scenario.symbol,
      scenarioType: scenario.scenario_type,
      difficulty: scenario.difficulty,
      chartTimeframe: scenario.chart_timeframe || '5m',
      chartData,
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

// Helper functions for scenario data generation

function getSymbolVolatility(symbol: string): number {
  const volatilities: Record<string, number> = {
    'SPY': 1.2,
    'QQQ': 1.5,
    'AAPL': 1.8,
    'NVDA': 3.5,
    'TSLA': 4.0,
    'META': 2.5,
    'MSFT': 1.6,
    'AMZN': 2.2,
    'GOOGL': 1.8,
    'AMD': 3.0,
    'NFLX': 2.8,
    'BA': 2.5,
    'COIN': 5.0,
    'CRM': 2.2,
    'PYPL': 2.8,
    'SHOP': 3.5,
    'RIVN': 4.5,
    'SMCI': 6.0,
    'DIS': 2.0,
    'GME': 8.0,
    'PLTR': 3.5,
    'XLF': 1.0,
    'IWM': 1.5,
    'TTD': 3.0,
    'INTC': 2.2,
  };
  return volatilities[symbol] || 2.0;
}

function getTrendForSetup(setupType: ScenarioDataConfig['setupType']): ScenarioDataConfig['trend'] {
  switch (setupType) {
    case 'support_bounce':
    case 'failed_breakdown':
    case 'double_bottom':
    case 'bear_trap':
    case 'divergence':
      return 'bearish'; // Setup requires prior down move

    case 'resistance_rejection':
    case 'exhaustion':
    case 'liquidity_sweep':
      return 'bullish'; // Setup requires prior up move

    case 'trend_continuation':
    case 'breakout':
      return 'bullish';

    case 'vwap_reclaim':
    case 'gap_fill':
      return 'choppy';

    default:
      return 'neutral';
  }
}
