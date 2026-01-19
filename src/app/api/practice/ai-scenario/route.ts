/**
 * AI Scenario Generation API
 *
 * POST /api/practice/ai-scenario - Generate an AI-powered practice scenario
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { generateAIScenario, getAdaptiveParams, AIScenarioParams } from '@/lib/practice/ai-scenario';
import logger from '@/lib/logger';

interface GenerateRequest {
  symbol?: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  focusArea?: 'level' | 'trend' | 'patience' | 'all';
  setupType?: 'reversal' | 'breakout' | 'continuation' | 'trap' | 'chop';
  marketContext?: 'bullish' | 'bearish' | 'neutral';
  adaptive?: boolean;
}

/**
 * POST /api/practice/ai-scenario
 * Generate a new AI practice scenario
 */
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: GenerateRequest = await request.json();
    let params: AIScenarioParams;

    if (body.adaptive) {
      // Get user stats for adaptive difficulty
      const { data: stats } = await supabaseAdmin
        .from('user_practice_stats')
        .select('*')
        .eq('user_id', session.userId)
        .single();

      const { data: attempts } = await supabaseAdmin
        .from('practice_attempts')
        .select('is_correct, scenario:practice_scenarios(focus_area)')
        .eq('user_id', session.userId)
        .order('created_at', { ascending: false })
        .limit(20);

      // Analyze weak areas
      const focusStats: Record<string, { correct: number; total: number }> = {
        level: { correct: 0, total: 0 },
        trend: { correct: 0, total: 0 },
        patience: { correct: 0, total: 0 },
      };

      for (const attempt of attempts || []) {
        const focus = (attempt.scenario as { focus_area?: string })?.focus_area || 'all';
        if (focus in focusStats) {
          focusStats[focus].total++;
          if (attempt.is_correct) focusStats[focus].correct++;
        }
      }

      const weakAreas = Object.entries(focusStats)
        .filter(([_, s]) => s.total > 0 && s.correct / s.total < 0.6)
        .sort((a, b) => a[1].correct / a[1].total - b[1].correct / b[1].total)
        .map(([area]) => area);

      params = getAdaptiveParams({
        accuracy: stats?.accuracy_percent || 50,
        weakAreas,
        recentDifficulties: [],
      });
    } else {
      // Use provided params or defaults
      params = {
        symbol: body.symbol || 'SPY',
        difficulty: body.difficulty || 'intermediate',
        focusArea: body.focusArea || 'all',
        setupType: body.setupType,
        marketContext: body.marketContext,
      };
    }

    // Generate the scenario
    const startTime = Date.now();
    const scenario = await generateAIScenario(params);

    if (!scenario) {
      return NextResponse.json(
        { error: 'Failed to generate scenario' },
        { status: 500 }
      );
    }

    // Save to database
    const { data: savedScenario, error: saveError } = await supabaseAdmin
      .from('practice_scenarios')
      .insert({
        title: scenario.title,
        description: scenario.description,
        symbol: scenario.symbol,
        scenario_type: scenario.scenarioType,
        difficulty: scenario.difficulty,
        chart_data: scenario.chartData,
        key_levels: scenario.keyLevels,
        decision_point: new Date(scenario.decisionPoint.time).toISOString(),
        correct_action: scenario.correctAction,
        outcome_data: scenario.outcomeData,
        ltp_analysis: scenario.ltpAnalysis,
        explanation: scenario.explanation,
        tags: scenario.tags,
        focus_area: scenario.focusArea,
        ai_generated: true,
        generation_prompt: JSON.stringify(params),
        market_context: scenario.marketContext,
        source_type: 'ai',
        created_by: session.userId,
      })
      .select()
      .single();

    if (saveError) {
      logger.error('Error saving AI scenario', { error: saveError.message });
      // Return scenario anyway, just not saved
    }

    // Track generation
    if (savedScenario) {
      await supabaseAdmin.from('ai_generated_scenarios').insert({
        user_id: session.userId,
        scenario_id: savedScenario.id,
        generation_params: params,
        generation_time_ms: Date.now() - startTime,
      });
    }

    logger.info('AI scenario generated', {
      userId: session.userId,
      symbol: params.symbol,
      difficulty: params.difficulty,
      generationTimeMs: Date.now() - startTime,
    });

    return NextResponse.json({
      success: true,
      scenario: {
        id: savedScenario?.id,
        ...scenario,
      },
      generationParams: params,
    });
  } catch (error) {
    logger.error('Error in AI scenario generation', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET /api/practice/ai-scenario
 * Get available AI scenario configurations
 */
export async function GET() {
  return NextResponse.json({
    symbols: ['SPY', 'QQQ', 'AAPL', 'NVDA', 'TSLA', 'META', 'MSFT', 'AMZN', 'GOOGL', 'AMD'],
    difficulties: ['beginner', 'intermediate', 'advanced'],
    focusAreas: ['level', 'trend', 'patience', 'all'],
    setupTypes: ['reversal', 'breakout', 'continuation', 'trap', 'chop'],
    marketContexts: ['bullish', 'bearish', 'neutral'],
  });
}
