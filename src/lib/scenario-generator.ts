/**
 * Scenario Generation Service
 *
 * Generates LTP practice scenarios from historical market data.
 * Identifies key decision points and packages them for practice.
 */

import { marketDataService } from './market-data';
import { identifyKeyLevels, calculateEMA, determineTrend, identifyPatienceCandles } from './ltp-engine';
import { supabaseAdmin } from './supabase';
import logger from './logger';

export interface ScenarioData {
  title: string;
  description: string;
  symbol: string;
  scenarioType: 'reversal' | 'breakout' | 'range' | 'continuation' | 'custom';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  chartData: OHLCV[];
  keyLevels: KeyLevel[];
  decisionPoint: string;
  correctAction: 'long' | 'short' | 'wait';
  outcomeData: OHLCV[];
  ltpAnalysis: LTPAnalysis;
  explanation: string;
  tags: string[];
}

interface OHLCV {
  t: number; // timestamp
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

interface KeyLevel {
  price: number;
  type: 'support' | 'resistance';
  strength: number;
}

interface LTPAnalysis {
  levelScore: number;
  trendScore: number;
  patienceScore: number;
  overallGrade: string;
  levelNotes: string;
  trendNotes: string;
  patienceNotes: string;
}

/**
 * Analyze a historical moment to determine if it's a valid scenario
 */
function analyzeDecisionPoint(
  bars: OHLCV[],
  decisionIndex: number,
  outcomeBars: OHLCV[]
): {
  isValidScenario: boolean;
  correctAction: 'long' | 'short' | 'wait';
  ltpAnalysis: LTPAnalysis;
  explanation: string;
} {
  const closePrices = bars.map(b => b.c);
  const currentPrice = closePrices[closePrices.length - 1];

  // Calculate EMAs
  const ema9 = calculateEMA(closePrices, 9);
  const ema21 = calculateEMA(closePrices, 21);

  // Identify key levels
  const keyLevels = identifyKeyLevels(bars);

  // Determine trend
  const trend = determineTrend(bars.slice(-20));

  // Check for patience candles
  const patienceCandles = identifyPatienceCandles(bars.slice(-5));

  // Calculate scores
  const levelScore = calculateLevelScore(currentPrice, keyLevels);
  const trendScore = calculateTrendScore(trend, currentPrice, ema9, ema21);
  const patienceScore = patienceCandles.length > 0 ? 85 : 50;

  const avgScore = (levelScore + trendScore + patienceScore) / 3;
  const overallGrade =
    avgScore >= 80 ? 'A' :
    avgScore >= 70 ? 'B' :
    avgScore >= 60 ? 'C' : 'D';

  // Determine correct action based on outcome
  let correctAction: 'long' | 'short' | 'wait' = 'wait';
  let explanation = '';

  if (outcomeBars.length > 0) {
    const outcomeHigh = Math.max(...outcomeBars.map(b => b.h));
    const outcomeLow = Math.min(...outcomeBars.map(b => b.l));
    const outcomeClose = outcomeBars[outcomeBars.length - 1].c;

    const upMove = outcomeHigh - currentPrice;
    const downMove = currentPrice - outcomeLow;

    // Determine correct action based on what actually happened
    if (upMove > downMove * 1.5 && outcomeClose > currentPrice) {
      correctAction = 'long';
      explanation = `Price moved ${((outcomeClose - currentPrice) / currentPrice * 100).toFixed(2)}% higher. `;
    } else if (downMove > upMove * 1.5 && outcomeClose < currentPrice) {
      correctAction = 'short';
      explanation = `Price moved ${((currentPrice - outcomeClose) / currentPrice * 100).toFixed(2)}% lower. `;
    } else {
      correctAction = 'wait';
      explanation = 'Price action was choppy with no clear directional move. ';
    }
  }

  // Add LTP analysis to explanation
  if (levelScore >= 70) {
    explanation += 'Price was at a key level. ';
  } else {
    explanation += 'Price was not at a significant level. ';
  }

  if (trendScore >= 70) {
    explanation += `Clear ${trend} trend in place. `;
  } else {
    explanation += 'No clear trend. ';
  }

  if (patienceScore >= 70) {
    explanation += 'Patience candle confirmation present.';
  } else {
    explanation += 'No patience candle confirmation.';
  }

  const ltpAnalysis: LTPAnalysis = {
    levelScore,
    trendScore,
    patienceScore,
    overallGrade,
    levelNotes: levelScore >= 70 ? 'At key support/resistance' : 'Not at key level',
    trendNotes: trend ? `${trend} trend` : 'No clear trend',
    patienceNotes: patienceScore >= 70 ? 'Confirmation candle present' : 'Waiting for confirmation',
  };

  // A valid scenario has a clear correct action
  const isValidScenario = correctAction !== 'wait' || avgScore >= 60;

  return {
    isValidScenario,
    correctAction,
    ltpAnalysis,
    explanation,
  };
}

function calculateLevelScore(price: number, keyLevels: ReturnType<typeof identifyKeyLevels>): number {
  if (!keyLevels || keyLevels.length === 0) return 50;

  let closestDistance = Infinity;
  for (const level of keyLevels) {
    const distance = Math.abs(price - level.price) / price * 100;
    if (distance < closestDistance) {
      closestDistance = distance;
    }
  }

  // Within 0.5% of a level = 90+ score
  if (closestDistance < 0.5) return 90;
  if (closestDistance < 1) return 75;
  if (closestDistance < 2) return 60;
  return 50;
}

function calculateTrendScore(
  trend: ReturnType<typeof determineTrend>,
  price: number,
  ema9: number,
  ema21: number
): number {
  let score = 50;

  // Trend direction
  if (trend === 'uptrend') {
    score += 20;
    if (price > ema9 && ema9 > ema21) score += 20;
  } else if (trend === 'downtrend') {
    score += 20;
    if (price < ema9 && ema9 < ema21) score += 20;
  }

  return Math.min(score, 95);
}

/**
 * Generate a scenario from historical data for a specific date range
 */
export async function generateScenarioFromHistory(
  symbol: string,
  startDate: Date,
  barsBeforeDecision = 100,
  barsAfterDecision = 20
): Promise<ScenarioData | null> {
  try {
    // Fetch historical data
    const allBars = await marketDataService.getAggregates(
      symbol,
      '5',
      barsBeforeDecision + barsAfterDecision
    );

    if (allBars.length < barsBeforeDecision + barsAfterDecision) {
      logger.warn('Not enough historical data for scenario', { symbol, barsAvailable: allBars.length });
      return null;
    }

    // Split into decision point and outcome
    const chartData = allBars.slice(0, barsBeforeDecision);
    const outcomeData = allBars.slice(barsBeforeDecision);

    // Analyze the decision point
    const analysis = analyzeDecisionPoint(chartData, barsBeforeDecision - 1, outcomeData);

    if (!analysis.isValidScenario) {
      return null;
    }

    // Determine scenario type based on analysis
    let scenarioType: ScenarioData['scenarioType'] = 'custom';
    const lastBars = chartData.slice(-10);
    const priceRange = Math.max(...lastBars.map(b => b.h)) - Math.min(...lastBars.map(b => b.l));
    const avgBar = priceRange / lastBars.length;

    if (analysis.ltpAnalysis.levelScore >= 80) {
      scenarioType = analysis.correctAction === 'wait' ? 'range' : 'reversal';
    } else if (analysis.ltpAnalysis.trendScore >= 80) {
      scenarioType = 'continuation';
    } else if (avgBar > priceRange / 5) {
      scenarioType = 'breakout';
    }

    // Determine difficulty
    let difficulty: ScenarioData['difficulty'] = 'intermediate';
    const avgScore = (analysis.ltpAnalysis.levelScore + analysis.ltpAnalysis.trendScore + analysis.ltpAnalysis.patienceScore) / 3;
    if (avgScore >= 80) difficulty = 'beginner'; // Clear setups are easier
    else if (avgScore < 60) difficulty = 'advanced'; // Ambiguous = harder

    const scenario: ScenarioData = {
      title: `${symbol} ${scenarioType.charAt(0).toUpperCase() + scenarioType.slice(1)} Setup`,
      description: `Analyze this ${symbol} chart and determine the best action based on LTP framework.`,
      symbol: symbol.toUpperCase(),
      scenarioType,
      difficulty,
      chartData,
      keyLevels: identifyKeyLevels(chartData).map((l) => ({
        price: l.price,
        type: l.type as 'support' | 'resistance',
        strength: l.strength,
      })),
      decisionPoint: new Date(chartData[chartData.length - 1].t).toISOString(),
      correctAction: analysis.correctAction,
      outcomeData,
      ltpAnalysis: analysis.ltpAnalysis,
      explanation: analysis.explanation,
      tags: [symbol.toUpperCase(), scenarioType, difficulty],
    };

    return scenario;

  } catch (error) {
    logger.error('Error generating scenario', error instanceof Error ? error : { message: String(error) });
    return null;
  }
}

/**
 * Save a scenario to the database
 */
export async function saveScenario(
  scenario: ScenarioData,
  createdBy?: string
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const { data, error } = await supabaseAdmin
      .from('practice_scenarios')
      .insert({
        title: scenario.title,
        description: scenario.description,
        symbol: scenario.symbol,
        scenario_type: scenario.scenarioType,
        difficulty: scenario.difficulty,
        chart_data: scenario.chartData,
        key_levels: scenario.keyLevels,
        decision_point: scenario.decisionPoint,
        correct_action: scenario.correctAction,
        outcome_data: scenario.outcomeData,
        ltp_analysis: scenario.ltpAnalysis,
        explanation: scenario.explanation,
        tags: scenario.tags,
        created_by: createdBy || null,
      })
      .select('id')
      .single();

    if (error) {
      logger.error('Error saving scenario', { error: error.message });
      return { success: false, error: error.message };
    }

    return { success: true, id: data.id };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error('Error in saveScenario', { error: msg });
    return { success: false, error: msg };
  }
}

/**
 * Generate feedback for a practice attempt using Claude
 */
export async function generateAttemptFeedback(
  scenario: ScenarioData,
  userDecision: string,
  userReasoning: string | undefined,
  isCorrect: boolean
): Promise<string> {
  // Simple feedback based on correctness and LTP analysis
  let feedback = '';

  if (isCorrect) {
    feedback = `Correct! ${scenario.explanation}`;
  } else {
    feedback = `Not quite. The correct action was to ${scenario.correctAction}. ${scenario.explanation}`;
  }

  // Add LTP breakdown
  feedback += `\n\nLTP Analysis:\n`;
  feedback += `- Level Score: ${scenario.ltpAnalysis.levelScore}% - ${scenario.ltpAnalysis.levelNotes}\n`;
  feedback += `- Trend Score: ${scenario.ltpAnalysis.trendScore}% - ${scenario.ltpAnalysis.trendNotes}\n`;
  feedback += `- Patience Score: ${scenario.ltpAnalysis.patienceScore}% - ${scenario.ltpAnalysis.patienceNotes}\n`;
  feedback += `- Overall Grade: ${scenario.ltpAnalysis.overallGrade}`;

  if (userReasoning) {
    feedback += `\n\nYour reasoning was considered in the evaluation.`;
  }

  return feedback;
}

/**
 * Get scenarios matching filters
 */
export async function getScenarios(filters?: {
  difficulty?: string;
  scenarioType?: string;
  symbol?: string;
  limit?: number;
}): Promise<ScenarioData[]> {
  let query = supabaseAdmin
    .from('practice_scenarios')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (filters?.difficulty) {
    query = query.eq('difficulty', filters.difficulty);
  }
  if (filters?.scenarioType) {
    query = query.eq('scenario_type', filters.scenarioType);
  }
  if (filters?.symbol) {
    query = query.eq('symbol', filters.symbol.toUpperCase());
  }
  if (filters?.limit) {
    query = query.limit(filters.limit);
  }

  const { data, error } = await query;

  if (error) {
    logger.error('Error fetching scenarios', { error: error.message });
    return [];
  }

  return (data || []).map(row => ({
    title: row.title,
    description: row.description,
    symbol: row.symbol,
    scenarioType: row.scenario_type,
    difficulty: row.difficulty,
    chartData: row.chart_data,
    keyLevels: row.key_levels,
    decisionPoint: row.decision_point,
    correctAction: row.correct_action,
    outcomeData: row.outcome_data,
    ltpAnalysis: row.ltp_analysis,
    explanation: row.explanation,
    tags: row.tags,
  }));
}
