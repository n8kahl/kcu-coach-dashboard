#!/usr/bin/env node
/**
 * Script to regenerate practice_scenarios.sql with 100+ candles per scenario
 *
 * Run with: node scripts/generate-practice-scenarios.mjs
 */

import { writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Candle generation utilities
function generateCandle(prevCandle, timestamp, basePrice, volatility, trend, volumeMultiplier = 1) {
  const priceRange = basePrice * (volatility / 100);
  const open = prevCandle ? prevCandle.c : basePrice;
  const trendImpact = trend * priceRange * 0.3;
  const randomMove = (Math.random() - 0.5) * priceRange;
  const closeMove = trendImpact + randomMove;
  const close = open + closeMove;
  const wickSize = Math.random() * priceRange * 0.5;
  const highWick = Math.random() * wickSize;
  const lowWick = Math.random() * wickSize;
  const high = Math.max(open, close) + highWick;
  const low = Math.min(open, close) - lowWick;
  const baseVolume = 100000 + Math.random() * 200000;
  const trendVolume = Math.abs(closeMove / priceRange) * 100000;
  const volume = Math.round((baseVolume + trendVolume) * volumeMultiplier);

  return {
    t: timestamp,
    o: Math.round(open * 100) / 100,
    h: Math.round(high * 100) / 100,
    l: Math.round(low * 100) / 100,
    c: Math.round(close * 100) / 100,
    v: volume,
  };
}

function generateTrendingCandles(count, startPrice, endPrice, volatility, startTime, intervalMs, volumeProfile = 'normal') {
  const candles = [];
  const priceStep = (endPrice - startPrice) / count;

  for (let i = 0; i < count; i++) {
    const timestamp = startTime + (i * intervalMs);
    const targetPrice = startPrice + (priceStep * i);
    const trend = priceStep > 0 ? 0.6 : -0.6;

    let volumeMult = 1;
    if (volumeProfile === 'increasing') {
      volumeMult = 0.7 + (0.6 * (i / count));
    } else if (volumeProfile === 'decreasing') {
      volumeMult = 1.3 - (0.6 * (i / count));
    } else if (volumeProfile === 'climax') {
      const midpoint = count / 2;
      const distFromMid = Math.abs(i - midpoint) / midpoint;
      volumeMult = 1.5 - (distFromMid * 0.8);
    }

    const prevCandle = candles.length > 0 ? candles[candles.length - 1] : null;
    candles.push(generateCandle(prevCandle, timestamp, targetPrice, volatility, trend, volumeMult));
  }

  return candles;
}

function generateConsolidationCandles(count, centerPrice, rangePercent, volatility, startTime, intervalMs) {
  const candles = [];
  const rangeSize = centerPrice * (rangePercent / 100);

  for (let i = 0; i < count; i++) {
    const timestamp = startTime + (i * intervalMs);
    const oscillation = Math.sin(i * 0.5) * (rangeSize / 2);
    const targetPrice = centerPrice + oscillation;
    const prevCandle = candles.length > 0 ? candles[candles.length - 1] : null;
    candles.push(generateCandle(prevCandle, timestamp, targetPrice, volatility * 0.5, 0, 0.7));
  }

  return candles;
}

// Scenario-specific generators
function generateSupportBounce(basePrice, vol, start, interval, supportLevel) {
  const candles = [];
  let time = start;

  // Phase 1: Initial uptrend (30 candles)
  candles.push(...generateTrendingCandles(30, basePrice, basePrice * 1.02, vol, time, interval, 'normal'));
  time += 30 * interval;

  // Phase 2: Pullback to support (35 candles)
  candles.push(...generateTrendingCandles(35, candles[candles.length - 1].c, supportLevel + (basePrice * 0.002), vol, time, interval, 'decreasing'));
  time += 35 * interval;

  // Phase 3: Consolidation at support (15 candles) - DECISION POINT
  candles.push(...generateConsolidationCandles(15, supportLevel + (basePrice * 0.003), 0.3, vol * 0.6, time, interval));
  time += 15 * interval;

  // Phase 4: Bounce (20 candles) - OUTCOME
  candles.push(...generateTrendingCandles(20, candles[candles.length - 1].c, basePrice * 1.015, vol, time, interval, 'increasing'));

  return candles;
}

function generateResistanceRejection(basePrice, vol, start, interval, resistanceLevel) {
  const candles = [];
  let time = start;

  // Phase 1: Initial ranging (25 candles)
  candles.push(...generateTrendingCandles(25, basePrice * 0.98, basePrice, vol, time, interval, 'normal'));
  time += 25 * interval;

  // Phase 2: Rally toward resistance (40 candles)
  candles.push(...generateTrendingCandles(40, candles[candles.length - 1].c, resistanceLevel - (basePrice * 0.002), vol, time, interval, 'increasing'));
  time += 40 * interval;

  // Phase 3: Test/rejection (15 candles) - DECISION POINT
  candles.push(...generateConsolidationCandles(15, resistanceLevel - (basePrice * 0.003), 0.3, vol * 0.7, time, interval));
  time += 15 * interval;

  // Phase 4: Rejection (20 candles) - OUTCOME
  candles.push(...generateTrendingCandles(20, candles[candles.length - 1].c, basePrice * 0.99, vol, time, interval, 'increasing'));

  return candles;
}

function generateVWAPReclaim(basePrice, vol, start, interval, vwapLevel) {
  const candles = [];
  let time = start;

  // Phase 1: Open above VWAP (15 candles)
  candles.push(...generateTrendingCandles(15, basePrice * 1.005, basePrice * 1.01, vol, time, interval, 'normal'));
  time += 15 * interval;

  // Phase 2: Morning weakness (30 candles)
  candles.push(...generateTrendingCandles(30, candles[candles.length - 1].c, vwapLevel - (basePrice * 0.015), vol * 1.2, time, interval, 'increasing'));
  time += 30 * interval;

  // Phase 3: Base building (20 candles)
  candles.push(...generateConsolidationCandles(20, vwapLevel - (basePrice * 0.01), 0.4, vol * 0.7, time, interval));
  time += 20 * interval;

  // Phase 4: Reclaim attempt (15 candles) - DECISION POINT
  candles.push(...generateTrendingCandles(15, candles[candles.length - 1].c, vwapLevel + (basePrice * 0.003), vol, time, interval, 'increasing'));
  time += 15 * interval;

  // Phase 5: Continuation (20 candles) - OUTCOME
  candles.push(...generateTrendingCandles(20, candles[candles.length - 1].c, basePrice * 1.02, vol, time, interval, 'normal'));

  return candles;
}

function generateFailedBreakdown(basePrice, vol, start, interval, supportLevel) {
  const candles = [];
  let time = start;

  // Phase 1: Downtrend (35 candles)
  candles.push(...generateTrendingCandles(35, basePrice * 1.01, supportLevel + (basePrice * 0.005), vol, time, interval, 'normal'));
  time += 35 * interval;

  // Phase 2: Breakdown (10 candles) - TRAP
  candles.push(...generateTrendingCandles(10, candles[candles.length - 1].c, supportLevel - (basePrice * 0.015), vol * 1.5, time, interval, 'climax'));
  time += 10 * interval;

  // Phase 3: Sharp reversal (10 candles) - DECISION POINT
  candles.push(...generateTrendingCandles(10, candles[candles.length - 1].c, supportLevel + (basePrice * 0.005), vol * 1.3, time, interval, 'climax'));
  time += 10 * interval;

  // Phase 4: Continuation higher (25 candles)
  candles.push(...generateTrendingCandles(25, candles[candles.length - 1].c, basePrice * 1.03, vol, time, interval, 'decreasing'));
  time += 25 * interval;

  // Phase 5: Consolidation (20 candles)
  candles.push(...generateConsolidationCandles(20, candles[candles.length - 1].c, 0.3, vol * 0.6, time, interval));

  return candles;
}

function generateORBBreakout(basePrice, vol, start, interval) {
  const candles = [];
  let time = start;
  const orbHigh = basePrice * 1.008;

  // Phase 1: Opening range (12 candles)
  for (let i = 0; i < 12; i++) {
    const prev = candles.length > 0 ? candles[candles.length - 1] : null;
    candles.push(generateCandle(prev, time + (i * interval), basePrice, vol * 1.2, (Math.random() - 0.5) * 0.6, 1.5));
  }
  time += 12 * interval;

  // Phase 2: Consolidation (25 candles)
  candles.push(...generateConsolidationCandles(25, basePrice * 1.002, 0.5, vol * 0.7, time, interval));
  time += 25 * interval;

  // Phase 3: Breakout (15 candles) - DECISION POINT
  candles.push(...generateTrendingCandles(15, candles[candles.length - 1].c, orbHigh * 1.005, vol, time, interval, 'increasing'));
  time += 15 * interval;

  // Phase 4: Continuation (30 candles) - OUTCOME
  candles.push(...generateTrendingCandles(30, candles[candles.length - 1].c, basePrice * 1.025, vol, time, interval, 'normal'));
  time += 30 * interval;

  // Phase 5: Pullback (18 candles)
  candles.push(...generateTrendingCandles(18, candles[candles.length - 1].c, basePrice * 1.018, vol * 0.8, time, interval, 'decreasing'));

  return candles;
}

function generatePatienceTest(basePrice, vol, start, interval, supportLevel) {
  const candles = [];
  let time = start;

  // Phase 1: Downtrend (40 candles)
  candles.push(...generateTrendingCandles(40, basePrice * 1.02, supportLevel + (basePrice * 0.005), vol, time, interval, 'normal'));
  time += 40 * interval;

  // Phase 2: Approach support - no confirmation (25 candles) - DECISION POINT
  candles.push(...generateTrendingCandles(25, candles[candles.length - 1].c, supportLevel - (basePrice * 0.01), vol * 0.8, time, interval, 'decreasing'));
  time += 25 * interval;

  // Phase 3: Eventually bounces (35 candles) - OUTCOME
  candles.push(...generateTrendingCandles(35, candles[candles.length - 1].c, basePrice, vol, time, interval, 'normal'));

  return candles;
}

function generateGapFill(basePrice, vol, start, interval) {
  const candles = [];
  let time = start;
  const gapOpen = basePrice * 1.01;
  const prevClose = basePrice * 0.98;

  // Phase 1: Gap open pop (10 candles)
  candles.push(...generateTrendingCandles(10, gapOpen, gapOpen * 1.01, vol * 1.3, time, interval, 'climax'));
  time += 10 * interval;

  // Phase 2: Fade start (25 candles)
  candles.push(...generateTrendingCandles(25, candles[candles.length - 1].c, gapOpen * 0.995, vol, time, interval, 'normal'));
  time += 25 * interval;

  // Phase 3: VWAP loss (20 candles) - DECISION POINT
  candles.push(...generateTrendingCandles(20, candles[candles.length - 1].c, basePrice * 0.995, vol, time, interval, 'increasing'));
  time += 20 * interval;

  // Phase 4: Gap fill (25 candles) - OUTCOME
  candles.push(...generateTrendingCandles(25, candles[candles.length - 1].c, prevClose * 1.002, vol, time, interval, 'decreasing'));
  time += 25 * interval;

  // Phase 5: Bounce (20 candles)
  candles.push(...generateTrendingCandles(20, candles[candles.length - 1].c, basePrice, vol * 0.8, time, interval, 'normal'));

  return candles;
}

function generateTrendExhaustion(basePrice, vol, start, interval) {
  const candles = [];
  let time = start;

  // Phase 1: Strong rally (40 candles)
  candles.push(...generateTrendingCandles(40, basePrice * 0.92, basePrice * 1.02, vol * 1.1, time, interval, 'increasing'));
  time += 40 * interval;

  // Phase 2: Exhaustion signs (20 candles)
  candles.push(...generateTrendingCandles(20, candles[candles.length - 1].c, basePrice * 1.05, vol * 0.6, time, interval, 'decreasing'));
  time += 20 * interval;

  // Phase 3: Topping (15 candles) - DECISION POINT
  candles.push(...generateConsolidationCandles(15, basePrice * 1.045, 0.4, vol * 0.5, time, interval));
  time += 15 * interval;

  // Phase 4: Breakdown (25 candles) - OUTCOME
  candles.push(...generateTrendingCandles(25, candles[candles.length - 1].c, basePrice * 0.99, vol * 1.2, time, interval, 'increasing'));

  return candles;
}

function generateBelowVWAPShort(basePrice, vol, start, interval, vwapLevel) {
  const candles = [];
  let time = start;

  // Phase 1: Open weak below VWAP (15 candles)
  candles.push(...generateTrendingCandles(15, basePrice * 0.995, basePrice * 0.99, vol, time, interval, 'normal'));
  time += 15 * interval;

  // Phase 2: Failed VWAP reclaim attempt (25 candles)
  candles.push(...generateTrendingCandles(25, candles[candles.length - 1].c, vwapLevel - (basePrice * 0.002), vol, time, interval, 'normal'));
  time += 25 * interval;

  // Phase 3: Rejection from VWAP (15 candles) - DECISION POINT
  candles.push(...generateTrendingCandles(15, candles[candles.length - 1].c, basePrice * 0.985, vol, time, interval, 'increasing'));
  time += 15 * interval;

  // Phase 4: Continuation down (25 candles) - OUTCOME
  candles.push(...generateTrendingCandles(25, candles[candles.length - 1].c, basePrice * 0.97, vol, time, interval, 'normal'));
  time += 25 * interval;

  // Phase 5: Consolidation (20 candles)
  candles.push(...generateConsolidationCandles(20, candles[candles.length - 1].c, 0.4, vol * 0.7, time, interval));

  return candles;
}

// Base start time - Jan 10, 2024 9:30 AM ET
const BASE_START_TIME = 1704898800000;
const FIVE_MIN_INTERVAL = 5 * 60 * 1000;
const FIFTEEN_MIN_INTERVAL = 15 * 60 * 1000;
const ONE_MIN_INTERVAL = 60 * 1000;

// Scenario configurations
const scenarios = [
  // BEGINNER SCENARIOS
  {
    title: 'Support Bounce Setup - AAPL',
    description: 'Price has pulled back to a clear support level after an uptrend. Identify the correct action at this key level.',
    symbol: 'AAPL',
    scenarioType: 'support_bounce',
    dbScenarioType: 'level_test',
    difficulty: 'beginner',
    chartTimeframe: '5m',
    basePrice: 185.00,
    volatility: 0.4,
    keyLevels: [
      { type: 'support', price: 184.50, strength: 85, label: 'Previous Day Low' },
      { type: 'vwap', price: 184.80, strength: 70, label: 'VWAP' },
      { type: 'ema', price: 185.00, strength: 60, label: '21 EMA' },
    ],
    correctAction: 'long',
    outcomeData: { result: 'win', exit_price: 185.80, pnl_percent: 0.85, candles_to_target: 12 },
    ltpAnalysis: {
      level: { score: 85, reason: 'Clear PDL support at $184.50 with multiple prior touches' },
      trend: { score: 70, reason: 'Above VWAP on daily, pullback within uptrend' },
      patience: { score: 75, reason: '3 candles of consolidation at level showing absorption' },
    },
    explanation: 'This is a textbook support bounce. The Previous Day Low (PDL) at $184.50 provided strong support. Notice how volume decreased as price approached the level, and the small-bodied candles showed seller exhaustion. The correct action is to go long with a stop below $184.45.',
    tags: ['level', 'support', 'pdl', 'beginner', 'bounce'],
    focusArea: 'level',
    category: 'level_identification',
    relatedLessonSlug: 'ltp-framework/level-identification',
    decisionContext: 'Price testing PDL with decreasing volume and absorption candles',
  },
  {
    title: 'Resistance Rejection - MSFT',
    description: 'Price rallying into overhead resistance. Determine if this is a short opportunity or if you should wait.',
    symbol: 'MSFT',
    scenarioType: 'resistance_rejection',
    dbScenarioType: 'level_test',
    difficulty: 'beginner',
    chartTimeframe: '5m',
    basePrice: 377.00,
    volatility: 0.35,
    keyLevels: [
      { type: 'resistance', price: 378.00, strength: 90, label: 'Previous Day High' },
      { type: 'vwap', price: 376.50, strength: 70, label: 'VWAP' },
      { type: 'round_number', price: 378.00, strength: 65, label: 'Round Number' },
    ],
    correctAction: 'short',
    outcomeData: { result: 'win', exit_price: 376.20, pnl_percent: 0.45, candles_to_target: 8 },
    ltpAnalysis: {
      level: { score: 90, reason: 'PDH confluence with round number $378 creates strong resistance' },
      trend: { score: 65, reason: 'Extended move up, overextended from VWAP' },
      patience: { score: 70, reason: '2 rejection candles forming at resistance' },
    },
    explanation: 'This setup shows classic resistance rejection. The Previous Day High (PDH) at $378 aligned with a psychological round number. The decreasing volume and smaller candle bodies near resistance signaled buyer exhaustion. A short entry with stop above $378.15 was the correct play.',
    tags: ['level', 'resistance', 'pdh', 'beginner', 'rejection'],
    focusArea: 'level',
    category: 'level_identification',
    relatedLessonSlug: 'ltp-framework/level-identification',
    decisionContext: 'Price approaching PDH with waning momentum and rejection wicks',
  },
  {
    title: 'VWAP Reclaim Long - NVDA',
    description: 'Price reclaiming VWAP after morning weakness. Is this a valid long setup?',
    symbol: 'NVDA',
    scenarioType: 'vwap_reclaim',
    dbScenarioType: 'trend_continuation',
    difficulty: 'beginner',
    chartTimeframe: '5m',
    basePrice: 480.00,
    volatility: 0.5,
    keyLevels: [
      { type: 'vwap', price: 480.50, strength: 80, label: 'VWAP' },
      { type: 'ema', price: 480.00, strength: 70, label: '9 EMA' },
      { type: 'support', price: 478.50, strength: 75, label: 'Morning Low' },
    ],
    correctAction: 'long',
    outcomeData: { result: 'win', exit_price: 484.50, pnl_percent: 0.73, candles_to_target: 15 },
    ltpAnalysis: {
      level: { score: 80, reason: 'VWAP reclaim provides dynamic support' },
      trend: { score: 75, reason: 'Higher lows forming, buyers stepping in' },
      patience: { score: 70, reason: 'Clean reclaim candle with follow-through' },
    },
    explanation: 'VWAP reclaims are powerful setups when the broader trend is bullish. Here, NVDA showed morning weakness but found support at $478.50. The reclaim above VWAP with increasing volume confirmed buyer strength. Long entry above $481 with stop below VWAP.',
    tags: ['vwap', 'reclaim', 'trend', 'beginner', 'momentum'],
    focusArea: 'trend',
    category: 'vwap_setups',
    relatedLessonSlug: 'ltp-framework/trend-analysis',
    decisionContext: 'Price just reclaimed VWAP with increasing volume',
  },
  {
    title: 'Failed Breakdown Recovery - AMD',
    description: 'Price broke below support but quickly recovered. What does this tell us?',
    symbol: 'AMD',
    scenarioType: 'failed_breakdown',
    dbScenarioType: 'reversal',
    difficulty: 'beginner',
    chartTimeframe: '5m',
    basePrice: 142.00,
    volatility: 0.6,
    keyLevels: [
      { type: 'support', price: 141.50, strength: 85, label: 'Key Support' },
      { type: 'vwap', price: 142.00, strength: 70, label: 'VWAP' },
      { type: 'round_number', price: 141.00, strength: 60, label: '$141 Psych Level' },
    ],
    correctAction: 'long',
    outcomeData: { result: 'win', exit_price: 143.80, pnl_percent: 1.48, candles_to_target: 18 },
    ltpAnalysis: {
      level: { score: 85, reason: 'Failed breakdown traps shorts, creates fuel for reversal' },
      trend: { score: 80, reason: 'V-shaped recovery shows strong buying pressure' },
      patience: { score: 75, reason: 'Waited for reclaim above support to confirm' },
    },
    explanation: 'Failed breakdowns are powerful reversal signals. When price breaks below support but immediately recovers, it traps shorts who now need to cover. This buying pressure fuels the reversal. The key is waiting for price to reclaim the broken level before entering long.',
    tags: ['failed_breakdown', 'reversal', 'trap', 'beginner', 'recovery'],
    focusArea: 'level',
    category: 'reversal_patterns',
    relatedLessonSlug: 'ltp-framework/patience-candles',
    decisionContext: 'Price swept below support and reversed sharply with high volume',
  },
  {
    title: 'Simple Trend Following - SPY',
    description: 'SPY in a clear uptrend above all major MAs. Is this pullback a buying opportunity?',
    symbol: 'SPY',
    scenarioType: 'support_bounce',
    dbScenarioType: 'trend_continuation',
    difficulty: 'beginner',
    chartTimeframe: '5m',
    basePrice: 472.00,
    volatility: 0.25,
    keyLevels: [
      { type: 'ema', price: 471.50, strength: 80, label: '21 EMA' },
      { type: 'vwap', price: 472.00, strength: 75, label: 'VWAP' },
      { type: 'ema', price: 471.00, strength: 70, label: '50 SMA' },
    ],
    correctAction: 'long',
    outcomeData: { result: 'win', exit_price: 474.20, pnl_percent: 0.51, candles_to_target: 12 },
    ltpAnalysis: {
      level: { score: 80, reason: '21 EMA acting as dynamic support in uptrend' },
      trend: { score: 90, reason: 'Clear uptrend with higher highs and higher lows' },
      patience: { score: 75, reason: 'Waiting for bounce confirmation at EMA' },
    },
    explanation: 'In a clear uptrend, pullbacks to the 21 EMA offer low-risk entry points. The trend is your friend - as long as price holds above key moving averages, buying dips is the correct strategy. Here, the 21 EMA provided the perfect bounce point.',
    tags: ['trend', 'ema', 'pullback', 'beginner', 'continuation'],
    focusArea: 'trend',
    category: 'trend_following',
    relatedLessonSlug: 'ltp-framework/trend-analysis',
    decisionContext: 'Pullback to 21 EMA in established uptrend',
  },
  {
    title: 'Patience at the Level - META',
    description: 'Price reached support but no confirmation yet. Do you enter immediately or wait?',
    symbol: 'META',
    scenarioType: 'patience_test',
    dbScenarioType: 'patience_test',
    difficulty: 'beginner',
    chartTimeframe: '5m',
    basePrice: 354.00,
    volatility: 0.4,
    keyLevels: [
      { type: 'support', price: 352.50, strength: 85, label: 'Key Support Zone' },
      { type: 'round_number', price: 352.50, strength: 70, label: 'Psychological Level' },
    ],
    correctAction: 'wait',
    outcomeData: { result: 'avoided_loss', exit_price: 350.50, note: 'Price broke down further before reversing' },
    ltpAnalysis: {
      level: { score: 85, reason: 'Good support zone identified at $352.50' },
      trend: { score: 50, reason: 'Still in downtrend, no reversal confirmation' },
      patience: { score: 40, reason: 'No patience candles yet, momentum still down' },
    },
    explanation: 'This scenario tests patience. While the level is valid, there is no confirmation of a reversal. The candles are still making lower lows with no sign of buying pressure. The LTP framework requires patience - wait for at least 2-3 candles of consolidation or a clear reversal candle before entering.',
    tags: ['patience', 'wait', 'confirmation', 'beginner', 'discipline'],
    focusArea: 'patience',
    category: 'patience_candles',
    relatedLessonSlug: 'ltp-framework/patience-candles',
    decisionContext: 'Price at support but still making lower lows, no absorption',
  },
  {
    title: 'Clear ORB Breakout - TSLA',
    description: 'TSLA breaks above the Opening Range High with volume. Is this a valid long entry?',
    symbol: 'TSLA',
    scenarioType: 'orb_breakout',
    dbScenarioType: 'breakout',
    difficulty: 'beginner',
    chartTimeframe: '5m',
    basePrice: 246.00,
    volatility: 0.6,
    keyLevels: [
      { type: 'orb_high', price: 247.00, strength: 85, label: 'ORB High (First 30 min)' },
      { type: 'orb_low', price: 244.00, strength: 85, label: 'ORB Low' },
      { type: 'vwap', price: 246.50, strength: 75, label: 'VWAP' },
    ],
    correctAction: 'long',
    outcomeData: { result: 'win', exit_price: 252.50, pnl_percent: 1.69, candles_to_target: 15 },
    ltpAnalysis: {
      level: { score: 85, reason: 'ORB high at $247 clearly defined and respected' },
      trend: { score: 85, reason: 'Breaking out with volume confirms bullish momentum' },
      patience: { score: 80, reason: 'Waited for clean break and retest' },
    },
    explanation: 'Opening Range Breakouts are classic momentum plays. The first 30 minutes establish a range, and a break above/below with volume signals direction for the day. Here, TSLA broke above $247 ORB high with 50% higher volume - a strong confirmation. Entry on the breakout candle with stop below ORB high.',
    tags: ['orb', 'breakout', 'momentum', 'beginner', 'opening_range'],
    focusArea: 'level',
    category: 'orb_strategies',
    relatedLessonSlug: 'ltp-framework/level-identification',
    decisionContext: 'Clean break above ORB high with strong volume',
  },
  {
    title: 'Below VWAP Weakness - GOOGL',
    description: 'GOOGL trading below VWAP all morning. Price attempts to reclaim but fails. What do you do?',
    symbol: 'GOOGL',
    scenarioType: 'below_vwap_short',
    dbScenarioType: 'trend_continuation',
    difficulty: 'beginner',
    chartTimeframe: '5m',
    basePrice: 141.00,
    volatility: 0.35,
    keyLevels: [
      { type: 'vwap', price: 141.70, strength: 80, label: 'VWAP' },
      { type: 'ema', price: 141.50, strength: 70, label: '9 EMA' },
      { type: 'support', price: 140.00, strength: 75, label: 'Morning Low' },
    ],
    correctAction: 'short',
    outcomeData: { result: 'win', exit_price: 139.50, pnl_percent: 0.99, candles_to_target: 12 },
    ltpAnalysis: {
      level: { score: 80, reason: 'VWAP acting as resistance after failed reclaim' },
      trend: { score: 85, reason: 'Below VWAP all day, sellers in control' },
      patience: { score: 75, reason: 'Waited for failed reclaim confirmation' },
    },
    explanation: 'When a stock is below VWAP and fails to reclaim it, this confirms weakness. The failed reclaim at $141.50 showed sellers were defending VWAP. Short entry below $140.90 with stop above VWAP. Target the morning low and below.',
    tags: ['vwap', 'below_vwap', 'weakness', 'beginner', 'short'],
    focusArea: 'trend',
    category: 'vwap_setups',
    relatedLessonSlug: 'ltp-framework/trend-analysis',
    decisionContext: 'Failed VWAP reclaim attempt, price rejecting lower',
  },
  // INTERMEDIATE SCENARIOS
  {
    title: 'Gap Fill Short - NFLX',
    description: 'NFLX gapped up but struggling to hold. Is this a gap fill short opportunity?',
    symbol: 'NFLX',
    scenarioType: 'gap_fill',
    dbScenarioType: 'gap_trade',
    difficulty: 'intermediate',
    chartTimeframe: '5m',
    basePrice: 485.00,
    volatility: 0.5,
    keyLevels: [
      { type: 'gap_top', price: 485.00, strength: 75, label: 'Gap Open' },
      { type: 'vwap', price: 485.50, strength: 70, label: 'VWAP' },
      { type: 'previous_close', price: 480.00, strength: 85, label: 'Previous Close (Gap Fill Target)' },
    ],
    correctAction: 'short',
    outcomeData: { result: 'win', exit_price: 480.50, pnl_percent: 0.76, candles_to_target: 15 },
    ltpAnalysis: {
      level: { score: 80, reason: 'Previous close at $480 is the gap fill target' },
      trend: { score: 75, reason: 'Below VWAP, making lower highs - gap fading' },
      patience: { score: 70, reason: 'Waited for VWAP loss and lower high confirmation' },
    },
    explanation: 'Gap fills are high-probability trades. When a stock gaps up but fails to hold the gap and loses VWAP, it often fills back to the previous close. Here NFLX showed classic gap fade behavior - initial pop, failure to hold, VWAP loss, and methodical decline toward the gap fill target at $480.',
    tags: ['gap', 'gap_fill', 'short', 'intermediate', 'fade'],
    focusArea: 'trend',
    category: 'gap_strategies',
    relatedLessonSlug: 'ltp-framework/gap-strategies',
    decisionContext: 'Failed to hold gap, now below VWAP and trending down',
  },
  {
    title: 'Trend Exhaustion Warning - COIN',
    description: 'COIN has rallied 8% and showing signs of exhaustion. Time to short or wait?',
    symbol: 'COIN',
    scenarioType: 'trend_exhaustion',
    dbScenarioType: 'exhaustion',
    difficulty: 'intermediate',
    chartTimeframe: '5m',
    basePrice: 150.00,
    volatility: 0.8,
    keyLevels: [
      { type: 'vwap', price: 149.00, strength: 75, label: 'VWAP (Far Below)' },
      { type: 'extension', price: 155.00, strength: 70, label: '1.618 Fib Extension' },
      { type: 'round_number', price: 155.00, strength: 65, label: '$155 Psychological' },
    ],
    correctAction: 'wait',
    outcomeData: { result: 'correct_wait', note: 'Price chopped for 30 mins before reversing - early short would have been stopped out' },
    ltpAnalysis: {
      level: { score: 60, reason: 'No clear resistance level, just extended' },
      trend: { score: 45, reason: 'Still technically uptrend but exhaustion signs' },
      patience: { score: 30, reason: 'No reversal confirmation yet, just slowing momentum' },
    },
    explanation: 'Exhaustion does not equal reversal. While COIN showed signs of slowing (declining volume, smaller candles), there was no clear reversal signal. Shorting into strength often results in getting stopped out on one more push higher. The correct action is to wait for a clear reversal pattern or level rejection.',
    tags: ['exhaustion', 'patience', 'wait', 'intermediate', 'overextended'],
    focusArea: 'patience',
    category: 'exhaustion_patterns',
    relatedLessonSlug: 'ltp-framework/patience-candles',
    decisionContext: 'Extended 8% from open, volume declining, candles getting smaller',
  },
  // ADVANCED SCENARIOS
  {
    title: 'The Bear Trap - RIVN',
    description: 'RIVN breaks below key support triggering stops, then reverses sharply. Can you identify the trap?',
    symbol: 'RIVN',
    scenarioType: 'bear_trap',
    dbScenarioType: 'trap_recognition',
    difficulty: 'advanced',
    chartTimeframe: '5m',
    basePrice: 18.50,
    volatility: 1.0,
    keyLevels: [
      { type: 'support', price: 18.00, strength: 85, label: 'Key Support (Broken Then Reclaimed)' },
      { type: 'trap_low', price: 17.50, strength: 90, label: 'Bear Trap Low' },
      { type: 'vwap', price: 18.20, strength: 70, label: 'VWAP' },
    ],
    correctAction: 'long',
    outcomeData: { result: 'win', exit_price: 19.80, pnl_percent: 9.39, candles_to_target: 12 },
    ltpAnalysis: {
      level: { score: 90, reason: 'Bear trap identified - breakdown failed and reversed' },
      trend: { score: 85, reason: 'V-shaped recovery with massive volume shows trapped shorts' },
      patience: { score: 80, reason: 'Waited for reclaim of broken support to confirm trap' },
    },
    explanation: 'Bear traps occur when price breaks below support, triggering stop losses and short entries, then immediately reverses. The high volume on the breakdown followed by even higher volume on the recovery is the tell. Trapped shorts fuel the rally. Entry above the reclaimed support level.',
    tags: ['bear_trap', 'trap', 'reversal', 'advanced', 'stop_hunt'],
    focusArea: 'level',
    category: 'trap_patterns',
    relatedLessonSlug: 'ltp-framework/trap-patterns',
    decisionContext: 'Sharp reversal after breakdown below $18 support',
  },
  {
    title: 'The FOMO Test - SMCI',
    description: 'SMCI has rallied 15% and social media is buzzing. Everyone is buying. What do you do?',
    symbol: 'SMCI',
    scenarioType: 'trend_exhaustion',
    dbScenarioType: 'psychology',
    difficulty: 'advanced',
    chartTimeframe: '5m',
    basePrice: 50.00,
    volatility: 1.2,
    keyLevels: [
      { type: 'no_clear_level', price: 52.00, strength: 40, label: 'No Defined Level' },
      { type: 'vwap', price: 49.00, strength: 70, label: 'VWAP (Far Below)' },
      { type: 'extension', price: 54.00, strength: 50, label: 'Potential Extension' },
    ],
    correctAction: 'wait',
    outcomeData: { result: 'avoided_loss', note: 'Price dropped to $48 before bouncing - chasers got crushed' },
    ltpAnalysis: {
      level: { score: 30, reason: 'No clear level to trade against, just chasing momentum' },
      trend: { score: 60, reason: 'Uptrend yes, but massively extended from any level' },
      patience: { score: 20, reason: 'FOMO setup - no patience, just emotion' },
    },
    explanation: 'This is a discipline test. When a stock is up 15% with social media buzzing, the urge to buy is overwhelming. But there is no LTP setup here - no level to trade against, completely extended from VWAP, and patience score is zero. The correct action is to wait and let others chase. Missing a move is not losing money.',
    tags: ['fomo', 'psychology', 'discipline', 'advanced', 'wait'],
    focusArea: 'patience',
    category: 'psychology',
    relatedLessonSlug: 'ltp-framework/trading-psychology',
    decisionContext: 'Massive rally, everyone on social media buying, FOMO intense',
  },
];

// Generate candles for a scenario config
function generateCandlesForScenario(config) {
  const interval = config.chartTimeframe === '1m' ? ONE_MIN_INTERVAL :
                   config.chartTimeframe === '15m' ? FIFTEEN_MIN_INTERVAL :
                   FIVE_MIN_INTERVAL;

  const mainLevel = config.keyLevels[0]?.price || config.basePrice;

  switch (config.scenarioType) {
    case 'support_bounce':
      return generateSupportBounce(config.basePrice, config.volatility, BASE_START_TIME, interval, mainLevel);
    case 'resistance_rejection':
      return generateResistanceRejection(config.basePrice, config.volatility, BASE_START_TIME, interval, mainLevel);
    case 'vwap_reclaim':
      return generateVWAPReclaim(config.basePrice, config.volatility, BASE_START_TIME, interval, mainLevel);
    case 'failed_breakdown':
    case 'bear_trap':
      return generateFailedBreakdown(config.basePrice, config.volatility, BASE_START_TIME, interval, mainLevel);
    case 'orb_breakout':
      return generateORBBreakout(config.basePrice, config.volatility, BASE_START_TIME, interval);
    case 'patience_test':
      return generatePatienceTest(config.basePrice, config.volatility, BASE_START_TIME, interval, mainLevel);
    case 'gap_fill':
      return generateGapFill(config.basePrice, config.volatility, BASE_START_TIME, interval);
    case 'trend_exhaustion':
      return generateTrendExhaustion(config.basePrice, config.volatility, BASE_START_TIME, interval);
    case 'below_vwap_short':
      return generateBelowVWAPShort(config.basePrice, config.volatility, BASE_START_TIME, interval, mainLevel);
    default:
      return generateSupportBounce(config.basePrice, config.volatility, BASE_START_TIME, interval, mainLevel);
  }
}

// Escape SQL strings
function escapeSql(str) {
  return str.replace(/'/g, "''");
}

// Generate SQL for a single scenario
function generateScenarioSQL(config, candles) {
  const decisionIndex = Math.floor(candles.length * 0.7);
  const decisionCandle = candles[decisionIndex];

  const chartData = JSON.stringify({ candles });
  const keyLevels = JSON.stringify(config.keyLevels);
  const decisionPoint = JSON.stringify({
    price: decisionCandle.c,
    time: decisionCandle.t,
    context: config.decisionContext,
  });
  const outcomeData = JSON.stringify(config.outcomeData);
  const ltpAnalysis = JSON.stringify(config.ltpAnalysis);
  const tags = `ARRAY[${config.tags.map(t => `'${t}'`).join(', ')}]`;

  return `(
  '${escapeSql(config.title)}',
  '${escapeSql(config.description)}',
  '${config.symbol}',
  '${config.dbScenarioType}',
  '${config.difficulty}',
  '${config.chartTimeframe}',
  '${escapeSql(chartData)}',
  '${escapeSql(keyLevels)}',
  '${escapeSql(decisionPoint)}',
  '${config.correctAction}',
  '${escapeSql(outcomeData)}',
  '${escapeSql(ltpAnalysis)}',
  '${escapeSql(config.explanation)}',
  ${tags},
  '${config.focusArea}',
  '${config.category}',
  'seed',
  '${config.relatedLessonSlug}',
  true
)`;
}

// Main generation function
function generateSeedFile() {
  const header = `-- ============================================
-- KCU Practice Scenarios Seed Data
-- ENHANCED VERSION with 100+ candles per scenario
-- Generated: ${new Date().toISOString()}
-- ============================================

-- Clear existing seed scenarios
DELETE FROM practice_scenarios WHERE source_type = 'seed';

-- ============================================
-- PRACTICE SCENARIOS WITH FULL CHART DATA
-- ============================================

INSERT INTO practice_scenarios (
  title, description, symbol, scenario_type, difficulty, chart_timeframe,
  chart_data, key_levels, decision_point, correct_action, outcome_data,
  ltp_analysis, explanation, tags, focus_area, category, source_type,
  related_lesson_slug, is_active
) VALUES
`;

  const scenarioSQLs = [];

  for (const config of scenarios) {
    console.log(`Generating candles for: ${config.title}`);
    const candles = generateCandlesForScenario(config);
    console.log(`  Generated ${candles.length} candles`);
    const sql = generateScenarioSQL(config, candles);
    scenarioSQLs.push(sql);
  }

  const footer = `;

-- Update community stats to realistic values
UPDATE practice_scenarios SET
  community_attempts = floor(random() * 500 + 50)::int,
  community_accuracy = (random() * 30 + 55)::decimal(5,2)
WHERE source_type = 'seed';

SELECT 'Practice scenarios seeded successfully. Total scenarios: ' || COUNT(*) as result
FROM practice_scenarios WHERE source_type = 'seed';
`;

  return header + scenarioSQLs.join(',\n') + footer;
}

// Run the generator
console.log('Generating practice scenarios with 100+ candles each...\n');
const sql = generateSeedFile();

const outputPath = join(__dirname, '..', 'supabase', 'seeds', 'practice_scenarios_enhanced.sql');
writeFileSync(outputPath, sql);

console.log(`\nGenerated seed file: ${outputPath}`);
console.log(`Total scenarios: ${scenarios.length}`);
