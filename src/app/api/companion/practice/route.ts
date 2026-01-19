/**
 * Practice from Companion API
 *
 * POST /api/companion/practice - Create a practice scenario from a live companion setup
 * GET /api/companion/practice - Get practice scenarios generated from companion
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import logger from '@/lib/logger';

interface CreatePracticeRequest {
  setupId: string;
  symbol: string;
  direction: string;
  confluenceScore: number;
  levelScore: number;
  trendScore: number;
  patienceScore: number;
  primaryLevelType: string;
  primaryLevelPrice: number;
  suggestedEntry: number;
  suggestedStop: number;
  target1: number;
  target2: number;
  coachNote: string;
  chartSnapshot?: Record<string, unknown>;
}

/**
 * POST - Create a practice scenario from live companion setup
 */
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: CreatePracticeRequest = await request.json();
    const {
      setupId,
      symbol,
      direction,
      confluenceScore,
      levelScore,
      trendScore,
      patienceScore,
      primaryLevelType,
      primaryLevelPrice,
      suggestedEntry,
      suggestedStop,
      target1,
      target2,
      coachNote,
      chartSnapshot,
    } = body;

    if (!setupId || !symbol) {
      return NextResponse.json({ error: 'setupId and symbol are required' }, { status: 400 });
    }

    // Determine correct action based on setup
    let correctAction: 'long' | 'short' | 'wait' = 'wait';
    if (confluenceScore >= 70) {
      correctAction = direction === 'bullish' ? 'long' : 'short';
    } else if (confluenceScore >= 50) {
      // Medium confluence - could go either way, but lean toward direction
      correctAction = direction === 'bullish' ? 'long' : 'short';
    }

    // Determine difficulty based on confluence clarity
    let difficulty: 'beginner' | 'intermediate' | 'advanced' = 'intermediate';
    if (confluenceScore >= 80) {
      difficulty = 'beginner'; // Clear setup
    } else if (confluenceScore < 60) {
      difficulty = 'advanced'; // Ambiguous
    }

    // Build chart data from snapshot or create placeholder
    const chartData = chartSnapshot || {
      candles: [],
      volume_profile: {},
    };

    // Build key levels
    const keyLevels = [
      {
        type: primaryLevelType,
        price: primaryLevelPrice,
        strength: levelScore,
        label: `${primaryLevelType.toUpperCase()} $${primaryLevelPrice.toFixed(2)}`,
      },
    ];

    if (suggestedEntry) {
      keyLevels.push({
        type: 'entry',
        price: suggestedEntry,
        strength: 80,
        label: `Entry $${suggestedEntry.toFixed(2)}`,
      });
    }

    if (suggestedStop) {
      keyLevels.push({
        type: 'stop',
        price: suggestedStop,
        strength: 80,
        label: `Stop $${suggestedStop.toFixed(2)}`,
      });
    }

    if (target1) {
      keyLevels.push({
        type: 'target',
        price: target1,
        strength: 70,
        label: `Target 1 $${target1.toFixed(2)}`,
      });
    }

    // Create the practice scenario
    const { data: scenario, error: scenarioError } = await supabaseAdmin
      .from('practice_scenarios')
      .insert({
        title: `${symbol} ${direction.charAt(0).toUpperCase() + direction.slice(1)} Setup - Live`,
        description: `Live setup detected by Companion: ${coachNote || 'Analyze this real-time LTP setup.'}`,
        symbol: symbol.toUpperCase(),
        scenario_type: 'live_setup',
        difficulty,
        chart_timeframe: '5m',
        chart_data: chartData,
        key_levels: keyLevels,
        decision_point: {
          price: suggestedEntry || primaryLevelPrice,
          time: Date.now(),
          context: coachNote || `${direction.charAt(0).toUpperCase() + direction.slice(1)} setup at ${primaryLevelType}`,
        },
        correct_action: correctAction,
        outcome_data: {
          result: 'pending',
          note: 'Outcome will be determined by actual market movement',
        },
        ltp_analysis: {
          level: { score: levelScore, reason: `${primaryLevelType} at $${primaryLevelPrice.toFixed(2)}` },
          trend: { score: trendScore, reason: `${direction.charAt(0).toUpperCase() + direction.slice(1)} bias` },
          patience: { score: patienceScore, reason: coachNote || 'Setup forming' },
        },
        explanation: `This is a live ${direction} setup with ${confluenceScore}% confluence. ${coachNote || ''}`,
        tags: [symbol.toUpperCase(), direction, 'live', 'companion'],
        source_type: 'companion',
        source_symbol: symbol.toUpperCase(),
        source_date: new Date().toISOString(),
        focus_area: levelScore >= trendScore && levelScore >= patienceScore ? 'level' :
                    trendScore >= patienceScore ? 'trend' : 'patience',
        category: 'live_setup',
        is_active: true,
      })
      .select()
      .single();

    if (scenarioError) {
      logger.error('Error creating practice scenario from companion', {
        error: scenarioError.message,
      });
      return NextResponse.json({ error: 'Failed to create scenario' }, { status: 500 });
    }

    // Track that this setup was used for practice (silently ignore if session doesn't exist)
    try {
      await supabaseAdmin
        .from('companion_sessions')
        .update({
          practice_attempts: supabaseAdmin.rpc('increment_field', { amount: 1 }),
        })
        .eq('user_id', session.userId)
        .is('ended_at', null);
    } catch {
      // Session might not exist, that's ok
    }

    logger.info('Practice scenario created from companion', {
      userId: session.userId,
      setupId,
      symbol,
      scenarioId: scenario.id,
    });

    return NextResponse.json({
      success: true,
      scenario: {
        id: scenario.id,
        title: scenario.title,
        symbol: scenario.symbol,
        difficulty: scenario.difficulty,
        correctAction: scenario.correct_action,
        ltpAnalysis: scenario.ltp_analysis,
      },
    });
  } catch (error) {
    logger.error('Error in companion practice POST', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET - Get practice scenarios generated from companion
 */
export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');

    const { data: scenarios, error } = await supabaseAdmin
      .from('practice_scenarios')
      .select(`
        id,
        title,
        symbol,
        difficulty,
        correct_action,
        ltp_analysis,
        source_date,
        community_accuracy,
        community_attempts
      `)
      .eq('source_type', 'companion')
      .eq('is_active', true)
      .order('source_date', { ascending: false })
      .limit(limit);

    if (error) {
      logger.error('Error fetching companion practice scenarios', { error: error.message });
      return NextResponse.json({ error: 'Failed to fetch scenarios' }, { status: 500 });
    }

    // Get user's attempts on these scenarios
    const scenarioIds = scenarios?.map(s => s.id) || [];
    const { data: userAttempts } = await supabaseAdmin
      .from('practice_attempts')
      .select('scenario_id, is_correct')
      .eq('user_id', session.userId)
      .in('scenario_id', scenarioIds);

    const attemptsByScenario: Record<string, { total: number; correct: number }> = {};
    (userAttempts || []).forEach(a => {
      if (!attemptsByScenario[a.scenario_id]) {
        attemptsByScenario[a.scenario_id] = { total: 0, correct: 0 };
      }
      attemptsByScenario[a.scenario_id].total++;
      if (a.is_correct) attemptsByScenario[a.scenario_id].correct++;
    });

    const scenariosWithAttempts = (scenarios || []).map(s => ({
      ...s,
      userAttempts: attemptsByScenario[s.id]?.total || 0,
      userCorrect: attemptsByScenario[s.id]?.correct || 0,
    }));

    return NextResponse.json({
      scenarios: scenariosWithAttempts,
      count: scenarios?.length || 0,
    });
  } catch (error) {
    logger.error('Error in companion practice GET', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
