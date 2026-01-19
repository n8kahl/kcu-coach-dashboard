/**
 * AI Scenario Generation
 *
 * Uses Claude to generate realistic trading practice scenarios
 * with synthetic price data for unlimited practice.
 */

import Anthropic from '@anthropic-ai/sdk';
import logger from '../logger';
import { Bar } from './indicators';

const anthropic = new Anthropic();

export interface AIScenarioParams {
  symbol: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  focusArea: 'level' | 'trend' | 'patience' | 'all';
  setupType?: 'reversal' | 'breakout' | 'continuation' | 'trap' | 'chop';
  marketContext?: 'bullish' | 'bearish' | 'neutral';
}

export interface GeneratedScenario {
  title: string;
  description: string;
  symbol: string;
  scenarioType: string;
  difficulty: string;
  focusArea: string;
  marketContext: {
    spyTrend: string;
    vixLevel: string;
    sectorPerformance: string;
    premarketAction: string;
  };
  chartData: Bar[];
  keyLevels: Array<{
    price: number;
    label: string;
    type: string;
    strength: number;
  }>;
  decisionPoint: {
    price: number;
    time: number;
    context: string;
  };
  correctAction: 'long' | 'short' | 'wait';
  outcomeData: Bar[];
  ltpAnalysis: {
    level: { score: number; reason: string };
    trend: { score: number; reason: string };
    patience: { score: number; reason: string };
  };
  explanation: string;
  tags: string[];
}

const SCENARIO_GENERATION_PROMPT = `You are an expert LTP (Level, Trend, Patience) trading coach creating practice scenarios for students.

Generate a realistic but fictional market scenario that tests the student's ability to identify valid trading setups using the LTP framework.

LTP Framework Scoring:
- LEVEL (35%): Is price at a key support/resistance level? (PDH/PDL, VWAP, ORB, round numbers, etc.)
- TREND (35%): Is the trade aligned with the trend? (EMA stacking, higher highs/lows, VWAP position)
- PATIENCE (30%): Is there confirmation? (Doji, hammer, multiple tests, volume patterns)

PARAMETERS:
- Symbol: {symbol}
- Difficulty: {difficulty}
- Focus Area: {focusArea}
- Setup Type: {setupType}
- Market Context: {marketContext}

DIFFICULTY GUIDELINES:
- Beginner: Clear setups with obvious LTP confluence (80%+ setup), 1-2 key levels
- Intermediate: Good setups requiring analysis (60-80% setup), 2-3 competing levels
- Advanced: Subtle setups or traps (40-60% or trap scenarios), multiple conflicting signals

Generate realistic 5-minute OHLCV data with proper candle relationships. Include:
1. 100 candles of history leading to decision point
2. 20 candles of outcome after decision point
3. Realistic price movements (no gaps > 0.5% between candles unless gap scenario)
4. Volume patterns that support the narrative

OUTPUT FORMAT (JSON only, no markdown):
{
  "title": "SPY Support Bounce at PDL",
  "description": "Price approaching yesterday's low with potential bounce setup",
  "scenarioType": "reversal",
  "marketContext": {
    "spyTrend": "bullish",
    "vixLevel": "14.5 - low volatility",
    "sectorPerformance": "Tech +0.5%, Financials flat",
    "premarketAction": "Flat, testing support"
  },
  "basePrice": 450.00,
  "keyLevels": [
    {"price": 449.20, "label": "PDL", "type": "pdl", "strength": 85},
    {"price": 450.50, "label": "VWAP", "type": "vwap", "strength": 80}
  ],
  "priceAction": {
    "trend": "downtrend into support",
    "volatility": "moderate",
    "pattern": "falling wedge into PDL"
  },
  "decisionContext": "Price testing PDL for third time, small body candle forming",
  "correctAction": "long",
  "outcomeDescription": "Bounce off PDL, reclaim VWAP, +1.5% move",
  "ltpAnalysis": {
    "level": {"score": 88, "reason": "Testing PDL with multiple touches"},
    "trend": {"score": 65, "reason": "Short-term downtrend but higher timeframe bullish"},
    "patience": {"score": 82, "reason": "Doji at PDL shows sellers exhausting"}
  },
  "explanation": "Valid long setup at PDL. Level score high (88%) due to third test of prior day low. Trend score moderate (65%) as short-term bearish but daily bullish. Patience confirmed (82%) with doji showing indecision at level. Entry on break above doji high with stop below PDL."
}`;

/**
 * Generate synthetic OHLCV bars based on scenario parameters
 */
function generateSyntheticBars(
  basePrice: number,
  priceAction: {
    trend: string;
    volatility: string;
    pattern: string;
  },
  correctAction: 'long' | 'short' | 'wait',
  barCount: number = 100
): Bar[] {
  const bars: Bar[] = [];
  let currentPrice = basePrice;
  const volatility = priceAction.volatility === 'high' ? 0.003 : priceAction.volatility === 'low' ? 0.001 : 0.002;

  // Determine trend bias
  let trendBias = 0;
  if (priceAction.trend.includes('uptrend')) trendBias = 0.0002;
  else if (priceAction.trend.includes('downtrend')) trendBias = -0.0002;

  // Start time (9:30 AM ET today)
  const startTime = new Date();
  startTime.setHours(9, 30, 0, 0);
  let currentTime = startTime.getTime();

  for (let i = 0; i < barCount; i++) {
    // Random walk with trend bias
    const change = (Math.random() - 0.5) * 2 * volatility + trendBias;
    const open = currentPrice;
    const close = currentPrice * (1 + change);

    // Generate high and low
    const wickSize = Math.random() * volatility * currentPrice;
    const high = Math.max(open, close) + wickSize * Math.random();
    const low = Math.min(open, close) - wickSize * Math.random();

    // Generate volume (higher at open and near levels)
    const baseVolume = 100000 + Math.random() * 200000;
    const volume = Math.floor(baseVolume * (1 + Math.random() * 0.5));

    bars.push({
      t: currentTime,
      o: Math.round(open * 100) / 100,
      h: Math.round(high * 100) / 100,
      l: Math.round(low * 100) / 100,
      c: Math.round(close * 100) / 100,
      v: volume,
    });

    currentPrice = close;
    currentTime += 5 * 60 * 1000; // 5 minutes
  }

  return bars;
}

/**
 * Generate outcome bars based on correct action
 */
function generateOutcomeBars(
  lastBar: Bar,
  correctAction: 'long' | 'short' | 'wait',
  barCount: number = 20
): Bar[] {
  const bars: Bar[] = [];
  let currentPrice = lastBar.c;
  let currentTime = lastBar.t + 5 * 60 * 1000;

  // Determine outcome movement
  let targetMove = 0;
  if (correctAction === 'long') {
    targetMove = 0.015; // 1.5% up
  } else if (correctAction === 'short') {
    targetMove = -0.015; // 1.5% down
  } else {
    targetMove = (Math.random() - 0.5) * 0.01; // Choppy
  }

  const movePerBar = targetMove / barCount;

  for (let i = 0; i < barCount; i++) {
    const noise = (Math.random() - 0.5) * 0.002;
    const change = movePerBar + noise;
    const open = currentPrice;
    const close = currentPrice * (1 + change);

    const wickSize = Math.abs(close - open) * (0.5 + Math.random());
    const high = Math.max(open, close) + wickSize * Math.random();
    const low = Math.min(open, close) - wickSize * Math.random();

    const volume = Math.floor(100000 + Math.random() * 200000);

    bars.push({
      t: currentTime,
      o: Math.round(open * 100) / 100,
      h: Math.round(high * 100) / 100,
      l: Math.round(low * 100) / 100,
      c: Math.round(close * 100) / 100,
      v: volume,
    });

    currentPrice = close;
    currentTime += 5 * 60 * 1000;
  }

  return bars;
}

/**
 * Generate a fallback scenario when AI is unavailable
 */
function generateFallbackScenario(params: AIScenarioParams): GeneratedScenario {
  // Predefined scenarios based on difficulty
  const scenarios = {
    beginner: {
      title: `${params.symbol} Support Bounce`,
      description: 'Clear support level test with strong buying pressure',
      correctAction: 'long' as const,
      basePrice: params.symbol === 'SPY' ? 450 : params.symbol === 'QQQ' ? 380 : 150,
    },
    intermediate: {
      title: `${params.symbol} VWAP Rejection`,
      description: 'Price testing VWAP with mixed signals',
      correctAction: 'wait' as const,
      basePrice: params.symbol === 'SPY' ? 450 : params.symbol === 'QQQ' ? 380 : 150,
    },
    advanced: {
      title: `${params.symbol} False Breakout Trap`,
      description: 'Failed breakout above resistance with reversal pattern',
      correctAction: 'short' as const,
      basePrice: params.symbol === 'SPY' ? 450 : params.symbol === 'QQQ' ? 380 : 150,
    },
  };

  const config = scenarios[params.difficulty];
  const priceAction = {
    trend: params.difficulty === 'beginner' ? 'uptrend into support' : 'neutral',
    volatility: params.difficulty === 'advanced' ? 'high' : 'moderate',
    pattern: 'range',
  };

  const chartData = generateSyntheticBars(config.basePrice, priceAction, config.correctAction, 150);
  const lastBar = chartData[chartData.length - 1];
  const outcomeData = generateOutcomeBars(lastBar, config.correctAction);

  // Generate key levels based on chart data
  const highPrice = Math.max(...chartData.map(c => c.h));
  const lowPrice = Math.min(...chartData.map(c => c.l));

  return {
    title: config.title,
    description: config.description,
    symbol: params.symbol,
    scenarioType: 'synthetic',
    difficulty: params.difficulty,
    focusArea: params.focusArea,
    marketContext: {
      spyTrend: 'bullish',
      vixLevel: '15.5 - moderate',
      sectorPerformance: 'Tech +0.3%, Financials -0.2%',
      premarketAction: 'Slightly higher, testing resistance',
    },
    chartData,
    keyLevels: [
      { price: Math.round(highPrice * 100) / 100, label: 'PDH', type: 'pdh', strength: 85 },
      { price: Math.round(lowPrice * 100) / 100, label: 'PDL', type: 'pdl', strength: 85 },
      { price: Math.round(lastBar.c * 100) / 100, label: 'VWAP', type: 'vwap', strength: 80 },
      { price: Math.round(((highPrice + lowPrice) / 2) * 100) / 100, label: 'Mid', type: 'support', strength: 65 },
    ],
    decisionPoint: {
      price: lastBar.c,
      time: lastBar.t,
      context: `${params.symbol} is testing a key level. Analyze using the LTP framework to determine the best action.`,
    },
    correctAction: config.correctAction,
    outcomeData,
    ltpAnalysis: {
      level: {
        score: params.difficulty === 'beginner' ? 85 : params.difficulty === 'intermediate' ? 70 : 55,
        reason: 'Price at key support/resistance level with multiple touches',
      },
      trend: {
        score: params.difficulty === 'beginner' ? 80 : params.difficulty === 'intermediate' ? 65 : 50,
        reason: 'EMA alignment shows trend direction',
      },
      patience: {
        score: params.difficulty === 'beginner' ? 82 : params.difficulty === 'intermediate' ? 68 : 45,
        reason: 'Candle patterns suggest continuation/reversal',
      },
    },
    explanation: `This ${params.difficulty} scenario tests your ability to identify ${config.correctAction === 'long' ? 'bullish' : config.correctAction === 'short' ? 'bearish' : 'choppy'} setups using the LTP framework.`,
    tags: [params.symbol, params.difficulty, params.focusArea, 'synthetic'],
  };
}

/**
 * Generate an AI scenario using Claude
 */
export async function generateAIScenario(params: AIScenarioParams): Promise<GeneratedScenario | null> {
  // Check if Anthropic API key is available
  if (!process.env.ANTHROPIC_API_KEY) {
    logger.warn('No Anthropic API key found, using fallback scenario');
    return generateFallbackScenario(params);
  }

  const prompt = SCENARIO_GENERATION_PROMPT
    .replace('{symbol}', params.symbol)
    .replace('{difficulty}', params.difficulty)
    .replace('{focusArea}', params.focusArea)
    .replace('{setupType}', params.setupType || 'any')
    .replace('{marketContext}', params.marketContext || 'neutral');

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    // Parse JSON response
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const scenarioData = JSON.parse(jsonMatch[0]);

    // Generate synthetic price data
    const chartData = generateSyntheticBars(
      scenarioData.basePrice || 450,
      scenarioData.priceAction || { trend: 'neutral', volatility: 'moderate', pattern: 'range' },
      scenarioData.correctAction
    );

    const lastBar = chartData[chartData.length - 1];
    const outcomeData = generateOutcomeBars(lastBar, scenarioData.correctAction);

    // Build complete scenario
    const scenario: GeneratedScenario = {
      title: scenarioData.title,
      description: scenarioData.description,
      symbol: params.symbol,
      scenarioType: scenarioData.scenarioType || 'custom',
      difficulty: params.difficulty,
      focusArea: params.focusArea,
      marketContext: scenarioData.marketContext || {
        spyTrend: 'neutral',
        vixLevel: '15 - moderate',
        sectorPerformance: 'Mixed',
        premarketAction: 'Flat',
      },
      chartData,
      keyLevels: (scenarioData.keyLevels || []).map((l: {
        price?: number;
        label?: string;
        type?: string;
        strength?: number;
      }) => ({
        price: l.price || lastBar.c,
        label: l.label || 'Level',
        type: l.type || 'support',
        strength: l.strength || 70,
      })),
      decisionPoint: {
        price: lastBar.c,
        time: lastBar.t,
        context: scenarioData.decisionContext || 'Analyze the setup',
      },
      correctAction: scenarioData.correctAction,
      outcomeData,
      ltpAnalysis: scenarioData.ltpAnalysis || {
        level: { score: 70, reason: 'Level analysis' },
        trend: { score: 70, reason: 'Trend analysis' },
        patience: { score: 70, reason: 'Patience analysis' },
      },
      explanation: scenarioData.explanation || 'Analyze using LTP framework',
      tags: [params.symbol, params.difficulty, params.focusArea, scenarioData.scenarioType || 'ai-generated'],
    };

    logger.info('AI scenario generated', {
      symbol: params.symbol,
      difficulty: params.difficulty,
      correctAction: scenario.correctAction,
    });

    return scenario;
  } catch (error) {
    logger.error('Error generating AI scenario, using fallback', {
      error: error instanceof Error ? error.message : String(error),
      params,
    });
    // Return fallback scenario instead of null
    return generateFallbackScenario(params);
  }
}

/**
 * Get adaptive scenario parameters based on user performance
 */
export function getAdaptiveParams(userStats: {
  accuracy: number;
  weakAreas: string[];
  recentDifficulties: string[];
}): AIScenarioParams {
  // Determine difficulty
  let difficulty: AIScenarioParams['difficulty'] = 'beginner';
  if (userStats.accuracy >= 80) difficulty = 'advanced';
  else if (userStats.accuracy >= 60) difficulty = 'intermediate';

  // Determine focus area based on weak areas
  let focusArea: AIScenarioParams['focusArea'] = 'all';
  if (userStats.weakAreas.length > 0) {
    const weakest = userStats.weakAreas[0];
    if (weakest === 'level' || weakest === 'trend' || weakest === 'patience') {
      focusArea = weakest;
    }
  }

  // Choose random symbol
  const symbols = ['SPY', 'QQQ', 'AAPL', 'NVDA', 'TSLA', 'META', 'MSFT', 'AMZN'];
  const symbol = symbols[Math.floor(Math.random() * symbols.length)];

  return {
    symbol,
    difficulty,
    focusArea,
  };
}
