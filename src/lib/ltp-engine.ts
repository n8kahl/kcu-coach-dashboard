/**
 * KCU LTP Detection Engine (TypeScript)
 *
 * Core engine for detecting LTP (Level, Trend, Patience) trading setups
 * based on Kay Capitals University methodology.
 */

import { supabaseAdmin } from './supabase';

// Types
export interface Bar {
  o: number; // open
  h: number; // high
  l: number; // low
  c: number; // close
  v: number; // volume
  t: number; // timestamp
}

export interface KeyLevel {
  type: string;
  price: number;
  timeframe: string;
  strength: number;
}

export interface MTFAnalysis {
  timeframe: string;
  trend: 'bullish' | 'bearish' | 'neutral';
  structure: 'uptrend' | 'downtrend' | 'range';
  ema_position: 'above_all' | 'below_all' | 'mixed';
  momentum: 'strong' | 'moderate' | 'weak';
  orb_status: string | null;
  vwap_position: string | null;
}

export interface PatienceResult {
  detected: boolean;
  count: number;
}

export interface LevelResult {
  score: number;
  level: KeyLevel | null;
}

export interface LTPScore {
  level: number;
  trend: number;
  patience: number;
  overall: number;
}

export interface DetectedSetup {
  symbol: string;
  direction: 'bullish' | 'bearish';
  setup_stage: 'forming' | 'ready' | 'triggered';
  confluence_score: number;
  level_score: number;
  trend_score: number;
  patience_score: number;
  mtf_score: number;
  primary_level_type: string | null;
  primary_level_price: number | null;
  patience_candles: number;
  suggested_entry: number | null;
  suggested_stop: number | null;
  target_1: number | null;
  target_2: number | null;
  target_3: number | null;
  risk_reward: number | null;
  coach_note: string;
}

export interface LTPConfig {
  ltp_detection_thresholds?: {
    level_proximity_percent?: number;
    patience_candle_max_size_percent?: number;
    confluence_threshold?: number;
  };
  mtf_timeframes?: {
    enabled_timeframes?: string[];
    weights?: Record<string, number>;
  };
}

/**
 * Calculate LTP score for a trade entry
 */
export function calculateLTPScore(
  levelScore: number,
  trendScore: number,
  patienceScore: number
): LTPScore {
  // Normalize scores to 0-100
  const normalizedLevel = Math.min(100, Math.max(0, levelScore));
  const normalizedTrend = Math.min(100, Math.max(0, trendScore));
  const normalizedPatience = Math.min(100, Math.max(0, patienceScore));

  // Calculate weighted overall score
  // Weights: Level 35%, Trend 35%, Patience 30%
  const overall = (normalizedLevel * 0.35) + (normalizedTrend * 0.35) + (normalizedPatience * 0.30);

  return {
    level: normalizedLevel,
    trend: normalizedTrend,
    patience: normalizedPatience,
    overall: Math.round(overall),
  };
}

/**
 * Calculate EMA from price data
 */
export function calculateEMA(data: number[], period: number): number {
  if (data.length < period) return data[data.length - 1] || 0;

  const multiplier = 2 / (period + 1);
  let ema = data.slice(0, period).reduce((a, b) => a + b, 0) / period;

  for (let i = period; i < data.length; i++) {
    ema = (data[i] - ema) * multiplier + ema;
  }

  return ema;
}

/**
 * Calculate VWAP from bar data
 */
export function calculateVWAP(bars: Bar[]): number {
  let cumulativeTPV = 0;
  let cumulativeVolume = 0;

  for (const bar of bars) {
    const typicalPrice = (bar.h + bar.l + bar.c) / 3;
    cumulativeTPV += typicalPrice * bar.v;
    cumulativeVolume += bar.v;
  }

  return cumulativeVolume > 0 ? cumulativeTPV / cumulativeVolume : 0;
}

/**
 * Detect patience candles near a price level
 */
export function detectPatienceCandle(
  bars: Bar[],
  levelPrice: number,
  maxCandleSize: number = 0.5
): PatienceResult {
  if (!bars || bars.length < 3) {
    return { detected: false, count: 0 };
  }

  const recentBars = bars.slice(-5);
  let patienceCount = 0;

  for (const bar of recentBars) {
    const candleSize = (Math.abs(bar.c - bar.o) / bar.o) * 100;
    const distanceToLevel = (Math.abs(bar.c - levelPrice) / levelPrice) * 100;

    // Patience candle criteria:
    // 1. Small body (< maxCandleSize%)
    // 2. Near the level (within 0.3%)
    if (candleSize < maxCandleSize && distanceToLevel < 0.3) {
      patienceCount++;
    }
  }

  return {
    detected: patienceCount >= 2,
    count: patienceCount,
  };
}

/**
 * Score level proximity for the L component
 */
export function scoreLevelProximity(
  currentPrice: number,
  levels: KeyLevel[],
  proximityThreshold: number = 0.3
): LevelResult {
  let maxScore = 0;
  let bestLevel: KeyLevel | null = null;

  for (const level of levels) {
    const distance = (Math.abs(currentPrice - level.price) / currentPrice) * 100;

    if (distance <= proximityThreshold) {
      // Score based on level strength and proximity
      const proximityScore = (1 - distance / proximityThreshold) * 50;
      const strengthScore = (level.strength / 100) * 50;
      const score = proximityScore + strengthScore;

      if (score > maxScore) {
        maxScore = score;
        bestLevel = level;
      }
    }
  }

  return { score: Math.round(maxScore), level: bestLevel };
}

/**
 * Score trend alignment across multiple timeframes
 */
export function scoreTrendAlignment(
  mtfAnalyses: MTFAnalysis[],
  direction: 'bullish' | 'bearish',
  weights?: Record<string, number>
): number {
  const defaultWeights: Record<string, number> = {
    weekly: 0.15,
    daily: 0.20,
    '4h': 0.15,
    '1h': 0.20,
    '15m': 0.15,
    '5m': 0.10,
    '2m': 0.05,
  };

  const tfWeights = weights || defaultWeights;
  let score = 0;

  for (const analysis of mtfAnalyses) {
    const weight = tfWeights[analysis.timeframe] || 0.1;
    const aligned =
      (direction === 'bullish' && analysis.trend === 'bullish') ||
      (direction === 'bearish' && analysis.trend === 'bearish');

    if (aligned) {
      score += weight * 100;
    }
  }

  return Math.round(score);
}

/**
 * Score patience candle quality for the P component
 */
export function scorePatienceQuality(patienceResult: PatienceResult): number {
  if (!patienceResult.detected) return 0;

  // More patience candles = higher score
  const countScore = Math.min(patienceResult.count * 20, 60);
  const baseScore = 40; // For having patience candles at all

  return countScore + baseScore;
}

/**
 * Calculate trade parameters (entry, stop, targets)
 */
export function calculateTradeParams(
  currentPrice: number,
  level: KeyLevel | null,
  direction: 'bullish' | 'bearish'
): {
  suggested_entry: number | null;
  suggested_stop: number | null;
  target_1: number | null;
  target_2: number | null;
  target_3: number | null;
  risk_reward: number | null;
} {
  if (!level) {
    return {
      suggested_entry: null,
      suggested_stop: null,
      target_1: null,
      target_2: null,
      target_3: null,
      risk_reward: null,
    };
  }

  const levelPrice = level.price;
  const atr = currentPrice * 0.01; // Estimate 1% ATR

  let entry: number, stop: number, target1: number, target2: number, target3: number;

  if (direction === 'bullish') {
    entry = currentPrice;
    stop = levelPrice - atr;
    target1 = entry + (entry - stop); // 1R
    target2 = entry + (entry - stop) * 2; // 2R
    target3 = entry + (entry - stop) * 3; // 3R
  } else {
    entry = currentPrice;
    stop = levelPrice + atr;
    target1 = entry - (stop - entry); // 1R
    target2 = entry - (stop - entry) * 2; // 2R
    target3 = entry - (stop - entry) * 3; // 3R
  }

  const risk = Math.abs(entry - stop);
  const reward = Math.abs(target2 - entry);
  const riskReward = risk > 0 ? reward / risk : 0;

  return {
    suggested_entry: Math.round(entry * 100) / 100,
    suggested_stop: Math.round(stop * 100) / 100,
    target_1: Math.round(target1 * 100) / 100,
    target_2: Math.round(target2 * 100) / 100,
    target_3: Math.round(target3 * 100) / 100,
    risk_reward: Math.round(riskReward * 10) / 10,
  };
}

/**
 * Generate LTP grade from overall score
 */
export function getLTPGrade(overallScore: number): string {
  if (overallScore >= 90) return 'A';
  if (overallScore >= 80) return 'B';
  if (overallScore >= 70) return 'C';
  if (overallScore >= 60) return 'D';
  return 'F';
}

/**
 * Generate coaching note for the setup
 */
export function generateCoachNote(
  levelResult: LevelResult,
  trendScore: number,
  patienceResult: PatienceResult,
  direction: 'bullish' | 'bearish'
): string {
  const notes: string[] = [];

  // Level note
  if (levelResult.score >= 70) {
    notes.push(`Strong ${levelResult.level?.type?.toUpperCase()} level confluence.`);
  } else if (levelResult.score >= 50) {
    notes.push(`Price near ${levelResult.level?.type?.toUpperCase()}.`);
  }

  // Trend note
  if (trendScore >= 70) {
    notes.push(`MTF trend strongly ${direction}.`);
  } else if (trendScore >= 50) {
    notes.push(`Trend leaning ${direction}.`);
  }

  // Patience note
  if (patienceResult.detected) {
    notes.push(`${patienceResult.count} patience candle(s) confirmed.`);
  } else {
    notes.push('Waiting for patience candle confirmation.');
  }

  return notes.join(' ');
}

/**
 * Fetch detected setups for a list of symbols
 */
export async function getDetectedSetups(symbols?: string[]): Promise<DetectedSetup[]> {
  try {
    let query = supabaseAdmin
      .from('detected_setups')
      .select('*')
      .gt('detected_at', new Date(Date.now() - 30 * 60 * 1000).toISOString()) // Last 30 mins
      .order('confluence_score', { ascending: false });

    if (symbols && symbols.length > 0) {
      query = query.in('symbol', symbols);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[LTP Engine] Error fetching setups:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('[LTP Engine] Error:', error);
    return [];
  }
}

/**
 * Fetch key levels for a symbol
 */
export async function getKeyLevels(symbol: string): Promise<KeyLevel[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('key_levels')
      .select('*')
      .eq('symbol', symbol)
      .gt('expires_at', new Date().toISOString());

    if (error) {
      console.error('[LTP Engine] Error fetching levels:', error);
      return [];
    }

    return (data || []).map((row) => ({
      type: row.level_type,
      price: row.price,
      timeframe: row.timeframe,
      strength: row.strength,
    }));
  } catch (error) {
    console.error('[LTP Engine] Error:', error);
    return [];
  }
}

/**
 * Fetch MTF analysis for a symbol
 */
export async function getMTFAnalysis(symbol: string): Promise<MTFAnalysis[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('mtf_analysis')
      .select('*')
      .eq('symbol', symbol)
      .gt('calculated_at', new Date(Date.now() - 30 * 60 * 1000).toISOString());

    if (error) {
      console.error('[LTP Engine] Error fetching MTF:', error);
      return [];
    }

    return (data || []).map((row) => ({
      timeframe: row.timeframe,
      trend: row.trend,
      structure: row.structure,
      ema_position: row.ema_position,
      momentum: row.momentum,
      orb_status: row.orb_status,
      vwap_position: row.vwap_position,
    }));
  } catch (error) {
    console.error('[LTP Engine] Error:', error);
    return [];
  }
}
