/**
 * Admin API to seed practice scenarios
 * POST /api/admin/seed-scenarios
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import logger from '@/lib/logger';

// Sample scenarios to seed
const SEED_SCENARIOS = [
  {
    title: 'Support Bounce Setup - AAPL',
    description: 'Price has pulled back to a clear support level after an uptrend. Identify the correct action at this key level.',
    symbol: 'AAPL',
    scenario_type: 'level_test',
    difficulty: 'beginner',
    chart_timeframe: '5m',
    chart_data: {
      candles: [
        { t: 1704898800000, o: 185.20, h: 185.45, l: 185.10, c: 185.35, v: 125000 },
        { t: 1704899100000, o: 185.35, h: 185.50, l: 185.00, c: 185.10, v: 150000 },
        { t: 1704899400000, o: 185.10, h: 185.25, l: 184.85, c: 184.90, v: 180000 },
        { t: 1704899700000, o: 184.90, h: 185.05, l: 184.75, c: 184.80, v: 165000 },
        { t: 1704900000000, o: 184.80, h: 184.95, l: 184.50, c: 184.55, v: 200000 },
        { t: 1704900300000, o: 184.55, h: 184.70, l: 184.45, c: 184.52, v: 145000 },
        { t: 1704900600000, o: 184.52, h: 184.65, l: 184.48, c: 184.55, v: 130000 },
        { t: 1704900900000, o: 184.55, h: 184.75, l: 184.50, c: 184.70, v: 140000 },
      ],
      volume_profile: { high_vol_node: 184.50, low_vol_node: 185.00 }
    },
    key_levels: [
      { type: 'support', price: 184.50, strength: 85, label: 'Previous Day Low' },
      { type: 'vwap', price: 184.80, strength: 70, label: 'VWAP' },
      { type: 'ema', price: 185.00, strength: 60, label: '21 EMA' }
    ],
    decision_point: { price: 184.55, time: 1704900600000, context: 'Price testing PDL with decreasing volume' },
    correct_action: 'long',
    outcome_data: { result: 'win', exit_price: 185.80, pnl_percent: 0.85, candles_to_target: 8 },
    ltp_analysis: {
      level: { score: 85, reason: 'Clear PDL support at $184.50 with multiple prior touches' },
      trend: { score: 70, reason: 'Above VWAP on daily, pullback within uptrend' },
      patience: { score: 75, reason: '3 candles of consolidation at level showing absorption' }
    },
    explanation: 'This is a textbook support bounce. The Previous Day Low (PDL) at $184.50 provided strong support. Notice how volume decreased as price approached the level, and the small-bodied candles showed seller exhaustion. The correct action is to go long with a stop below $184.45.',
    tags: ['level', 'support', 'pdl', 'beginner', 'bounce'],
    focus_area: 'level',
    category: 'level_identification',
    source_type: 'seed',
    related_lesson_slug: 'ltp-framework/level-identification',
    is_active: true
  },
  {
    title: 'Resistance Rejection - MSFT',
    description: 'Price rallying into overhead resistance. Determine if this is a short opportunity or if you should wait.',
    symbol: 'MSFT',
    scenario_type: 'level_test',
    difficulty: 'beginner',
    chart_timeframe: '5m',
    chart_data: {
      candles: [
        { t: 1704898800000, o: 375.00, h: 375.50, l: 374.80, c: 375.40, v: 100000 },
        { t: 1704899100000, o: 375.40, h: 376.20, l: 375.35, c: 376.10, v: 120000 },
        { t: 1704899400000, o: 376.10, h: 376.80, l: 376.00, c: 376.70, v: 140000 },
        { t: 1704899700000, o: 376.70, h: 377.40, l: 376.60, c: 377.30, v: 160000 },
        { t: 1704900000000, o: 377.30, h: 377.95, l: 377.20, c: 377.85, v: 180000 },
        { t: 1704900300000, o: 377.85, h: 378.10, l: 377.70, c: 377.90, v: 150000 },
        { t: 1704900600000, o: 377.90, h: 378.05, l: 377.60, c: 377.65, v: 130000 },
        { t: 1704900900000, o: 377.65, h: 377.80, l: 377.50, c: 377.55, v: 110000 },
      ],
      volume_profile: { high_vol_node: 377.00, low_vol_node: 378.00 }
    },
    key_levels: [
      { type: 'resistance', price: 378.00, strength: 90, label: 'Previous Day High' },
      { type: 'vwap', price: 376.50, strength: 70, label: 'VWAP' },
      { type: 'round_number', price: 378.00, strength: 65, label: 'Round Number' }
    ],
    decision_point: { price: 377.90, time: 1704900300000, context: 'Price approaching PDH with waning momentum' },
    correct_action: 'short',
    outcome_data: { result: 'win', exit_price: 376.20, pnl_percent: 0.45, candles_to_target: 6 },
    ltp_analysis: {
      level: { score: 90, reason: 'PDH confluence with round number $378 creates strong resistance' },
      trend: { score: 65, reason: 'Extended move up, overextended from VWAP' },
      patience: { score: 70, reason: '2 rejection candles forming at resistance' }
    },
    explanation: 'This setup shows classic resistance rejection. The Previous Day High (PDH) at $378 aligned with a psychological round number. The decreasing volume and smaller candle bodies near resistance signaled buyer exhaustion. A short entry with stop above $378.15 was the correct play.',
    tags: ['level', 'resistance', 'pdh', 'beginner', 'rejection'],
    focus_area: 'level',
    category: 'level_identification',
    source_type: 'seed',
    related_lesson_slug: 'ltp-framework/level-identification',
    is_active: true
  },
  {
    title: 'VWAP Reclaim Long - NVDA',
    description: 'Price reclaiming VWAP after morning weakness. Is this a valid long setup?',
    symbol: 'NVDA',
    scenario_type: 'trend_continuation',
    difficulty: 'beginner',
    chart_timeframe: '5m',
    chart_data: {
      candles: [
        { t: 1704898800000, o: 482.00, h: 482.50, l: 480.00, c: 480.50, v: 250000 },
        { t: 1704899100000, o: 480.50, h: 481.00, l: 479.50, c: 479.80, v: 280000 },
        { t: 1704899400000, o: 479.80, h: 480.20, l: 478.50, c: 478.80, v: 300000 },
        { t: 1704899700000, o: 478.80, h: 479.50, l: 478.20, c: 479.30, v: 260000 },
        { t: 1704900000000, o: 479.30, h: 480.50, l: 479.00, c: 480.40, v: 240000 },
        { t: 1704900300000, o: 480.40, h: 481.20, l: 480.30, c: 481.00, v: 220000 },
        { t: 1704900600000, o: 481.00, h: 481.50, l: 480.80, c: 481.30, v: 200000 },
        { t: 1704900900000, o: 481.30, h: 481.80, l: 481.10, c: 481.60, v: 180000 },
      ],
      volume_profile: { high_vol_node: 480.00, low_vol_node: 479.00 }
    },
    key_levels: [
      { type: 'vwap', price: 480.50, strength: 80, label: 'VWAP' },
      { type: 'ema', price: 480.00, strength: 70, label: '9 EMA' },
      { type: 'support', price: 478.50, strength: 75, label: 'Morning Low' }
    ],
    decision_point: { price: 481.00, time: 1704900300000, context: 'Price just reclaimed VWAP with increasing volume' },
    correct_action: 'long',
    outcome_data: { result: 'win', exit_price: 484.50, pnl_percent: 0.73, candles_to_target: 10 },
    ltp_analysis: {
      level: { score: 80, reason: 'VWAP reclaim provides dynamic support' },
      trend: { score: 75, reason: 'Higher lows forming, buyers stepping in' },
      patience: { score: 70, reason: 'Clean reclaim candle with follow-through' }
    },
    explanation: 'VWAP reclaims are powerful setups when the broader trend is bullish. Here, NVDA showed morning weakness but found support at $478.50. The reclaim above VWAP with increasing volume confirmed buyer strength. Long entry above $481 with stop below VWAP.',
    tags: ['vwap', 'reclaim', 'trend', 'beginner', 'momentum'],
    focus_area: 'trend',
    category: 'vwap_setups',
    source_type: 'seed',
    related_lesson_slug: 'ltp-framework/trend-analysis',
    is_active: true
  },
  {
    title: 'Failed Breakdown Recovery - AMD',
    description: 'Price broke below support but quickly recovered. What does this tell us?',
    symbol: 'AMD',
    scenario_type: 'reversal',
    difficulty: 'beginner',
    chart_timeframe: '5m',
    chart_data: {
      candles: [
        { t: 1704898800000, o: 142.50, h: 142.80, l: 142.20, c: 142.40, v: 180000 },
        { t: 1704899100000, o: 142.40, h: 142.50, l: 141.80, c: 141.90, v: 220000 },
        { t: 1704899400000, o: 141.90, h: 142.00, l: 141.50, c: 141.60, v: 260000 },
        { t: 1704899700000, o: 141.60, h: 141.70, l: 140.80, c: 140.95, v: 350000 },
        { t: 1704900000000, o: 140.95, h: 141.80, l: 140.85, c: 141.70, v: 400000 },
        { t: 1704900300000, o: 141.70, h: 142.20, l: 141.60, c: 142.10, v: 320000 },
        { t: 1704900600000, o: 142.10, h: 142.50, l: 142.00, c: 142.40, v: 250000 },
        { t: 1704900900000, o: 142.40, h: 142.80, l: 142.30, c: 142.70, v: 200000 },
      ],
      volume_profile: { high_vol_node: 141.50, low_vol_node: 142.50 }
    },
    key_levels: [
      { type: 'support', price: 141.50, strength: 85, label: 'Key Support' },
      { type: 'vwap', price: 142.00, strength: 70, label: 'VWAP' },
      { type: 'round_number', price: 141.00, strength: 60, label: '$141 Psych Level' }
    ],
    decision_point: { price: 141.70, time: 1704900000000, context: 'Price swept below support and reversed sharply' },
    correct_action: 'long',
    outcome_data: { result: 'win', exit_price: 143.80, pnl_percent: 1.48, candles_to_target: 12 },
    ltp_analysis: {
      level: { score: 85, reason: 'Failed breakdown traps shorts, creates fuel for reversal' },
      trend: { score: 80, reason: 'V-shaped recovery shows strong buying pressure' },
      patience: { score: 75, reason: 'Waited for reclaim above support to confirm' }
    },
    explanation: 'Failed breakdowns are powerful reversal signals. When price breaks below support but immediately recovers, it traps shorts who now need to cover. This buying pressure fuels the reversal. The key is waiting for price to reclaim the broken level before entering long.',
    tags: ['failed_breakdown', 'reversal', 'trap', 'beginner', 'recovery'],
    focus_area: 'level',
    category: 'reversal_patterns',
    source_type: 'seed',
    related_lesson_slug: 'ltp-framework/patience-timing',
    is_active: true
  },
  {
    title: 'Trend Continuation Pullback - TSLA',
    description: 'Strong trend with a healthy pullback to moving averages. Time to add?',
    symbol: 'TSLA',
    scenario_type: 'trend_continuation',
    difficulty: 'intermediate',
    chart_timeframe: '5m',
    chart_data: {
      candles: [
        { t: 1704898800000, o: 245.00, h: 247.50, l: 244.80, c: 247.20, v: 500000 },
        { t: 1704899100000, o: 247.20, h: 249.00, l: 247.00, c: 248.80, v: 480000 },
        { t: 1704899400000, o: 248.80, h: 250.50, l: 248.50, c: 250.20, v: 520000 },
        { t: 1704899700000, o: 250.20, h: 250.80, l: 248.50, c: 248.80, v: 450000 },
        { t: 1704900000000, o: 248.80, h: 249.20, l: 247.50, c: 247.80, v: 400000 },
        { t: 1704900300000, o: 247.80, h: 248.50, l: 247.00, c: 247.30, v: 380000 },
        { t: 1704900600000, o: 247.30, h: 247.80, l: 246.80, c: 247.50, v: 350000 },
        { t: 1704900900000, o: 247.50, h: 248.20, l: 247.20, c: 248.00, v: 320000 },
      ],
      volume_profile: { high_vol_node: 248.00, low_vol_node: 250.00 }
    },
    key_levels: [
      { type: 'ema', price: 247.50, strength: 80, label: '9 EMA' },
      { type: 'ema', price: 246.00, strength: 75, label: '21 EMA' },
      { type: 'vwap', price: 248.00, strength: 70, label: 'VWAP' }
    ],
    decision_point: { price: 247.50, time: 1704900600000, context: 'Pullback to 9 EMA in strong uptrend' },
    correct_action: 'long',
    outcome_data: { result: 'win', exit_price: 253.00, pnl_percent: 2.22, candles_to_target: 15 },
    ltp_analysis: {
      level: { score: 75, reason: '9 EMA acting as dynamic support in trend' },
      trend: { score: 90, reason: 'Strong momentum, higher highs and higher lows intact' },
      patience: { score: 80, reason: 'Healthy pullback with decreasing volume, not panic selling' }
    },
    explanation: 'In strong trends, pullbacks to key moving averages offer excellent entries. This TSLA setup shows a healthy pullback after a strong move up. Volume decreased during the pullback (healthy) and the 9 EMA provided dynamic support. Long entry near the EMA with stop below the 21 EMA.',
    tags: ['trend', 'pullback', 'ema', 'intermediate', 'momentum'],
    focus_area: 'trend',
    category: 'trend_continuation',
    source_type: 'seed',
    related_lesson_slug: 'ltp-framework/trend-analysis',
    is_active: true
  },
  {
    title: 'Multi-Timeframe Confluence - META',
    description: 'Daily and 5-minute levels aligning. How should you approach this setup?',
    symbol: 'META',
    scenario_type: 'mtf_confluence',
    difficulty: 'intermediate',
    chart_timeframe: '5m',
    chart_data: {
      candles: [
        { t: 1704898800000, o: 355.00, h: 355.80, l: 354.50, c: 355.50, v: 200000 },
        { t: 1704899100000, o: 355.50, h: 356.20, l: 355.30, c: 356.00, v: 180000 },
        { t: 1704899400000, o: 356.00, h: 356.50, l: 355.80, c: 356.30, v: 170000 },
        { t: 1704899700000, o: 356.30, h: 356.80, l: 356.00, c: 356.50, v: 160000 },
        { t: 1704900000000, o: 356.50, h: 357.00, l: 356.20, c: 356.40, v: 150000 },
        { t: 1704900300000, o: 356.40, h: 356.60, l: 355.80, c: 355.90, v: 140000 },
        { t: 1704900600000, o: 355.90, h: 356.20, l: 355.50, c: 355.70, v: 130000 },
        { t: 1704900900000, o: 355.70, h: 356.00, l: 355.40, c: 355.80, v: 120000 },
      ],
      volume_profile: { high_vol_node: 356.00, low_vol_node: 355.00 }
    },
    key_levels: [
      { type: 'daily_support', price: 355.50, strength: 90, label: 'Daily Support' },
      { type: 'weekly_vwap', price: 355.00, strength: 85, label: 'Weekly VWAP' },
      { type: 'fib', price: 356.00, strength: 75, label: '50% Fib Retracement' }
    ],
    decision_point: { price: 355.70, time: 1704900600000, context: 'Price at daily support with weekly VWAP nearby' },
    correct_action: 'long',
    outcome_data: { result: 'win', exit_price: 360.00, pnl_percent: 1.21, candles_to_target: 18 },
    ltp_analysis: {
      level: { score: 95, reason: 'Daily support + Weekly VWAP = high confluence zone' },
      trend: { score: 80, reason: 'Weekly uptrend, daily consolidating' },
      patience: { score: 85, reason: 'Multiple timeframe alignment gives higher probability' }
    },
    explanation: 'Multi-timeframe confluence is one of the highest probability setups. When daily support aligns with weekly VWAP, you have institutional-level support. This META setup shows exactly that - the daily chart support at $355.50 aligned with weekly VWAP. Higher timeframe alignment = higher probability.',
    tags: ['mtf', 'confluence', 'daily', 'weekly', 'intermediate', 'support'],
    focus_area: 'level',
    category: 'mtf_analysis',
    source_type: 'seed',
    related_lesson_slug: 'ltp-framework/mtf-confluence',
    is_active: true
  },
  {
    title: 'Gap Fill Psychology - GOOGL',
    description: 'Price filling an overnight gap. Understand the psychology and trade it.',
    symbol: 'GOOGL',
    scenario_type: 'gap_fill',
    difficulty: 'intermediate',
    chart_timeframe: '5m',
    chart_data: {
      candles: [
        { t: 1704898800000, o: 142.00, h: 142.50, l: 141.80, c: 142.30, v: 300000 },
        { t: 1704899100000, o: 142.30, h: 142.80, l: 142.20, c: 142.60, v: 280000 },
        { t: 1704899400000, o: 142.60, h: 143.00, l: 142.50, c: 142.80, v: 260000 },
        { t: 1704899700000, o: 142.80, h: 143.20, l: 142.70, c: 143.00, v: 240000 },
        { t: 1704900000000, o: 143.00, h: 143.30, l: 142.80, c: 143.10, v: 220000 },
        { t: 1704900300000, o: 143.10, h: 143.40, l: 143.00, c: 143.30, v: 200000 },
        { t: 1704900600000, o: 143.30, h: 143.50, l: 143.20, c: 143.40, v: 180000 },
        { t: 1704900900000, o: 143.40, h: 143.60, l: 143.30, c: 143.50, v: 170000 },
      ],
      volume_profile: { high_vol_node: 143.00, low_vol_node: 142.00 }
    },
    key_levels: [
      { type: 'gap_fill', price: 143.50, strength: 85, label: 'Gap Fill Level (Prior Close)' },
      { type: 'vwap', price: 142.80, strength: 70, label: 'VWAP' },
      { type: 'open', price: 142.00, strength: 65, label: 'Open' }
    ],
    decision_point: { price: 143.40, time: 1704900600000, context: 'Price approaching gap fill level with momentum' },
    correct_action: 'wait',
    outcome_data: { result: 'wait_correct', exit_price: null, pnl_percent: 0, candles_to_target: 0 },
    ltp_analysis: {
      level: { score: 85, reason: 'Gap fill levels often see profit-taking' },
      trend: { score: 60, reason: 'Momentum may exhaust at gap fill' },
      patience: { score: 90, reason: 'Wait to see reaction at gap fill before committing' }
    },
    explanation: 'Gap fills are tricky. While price often fills gaps, the reaction AT the fill level is uncertain. Many traders take profits at gap fills, causing reversals. The correct action here is to WAIT and see how price reacts at the gap fill before taking a new position. Patience over action.',
    tags: ['gap', 'psychology', 'patience', 'intermediate', 'wait'],
    focus_area: 'patience',
    category: 'gap_trading',
    source_type: 'seed',
    related_lesson_slug: 'ltp-framework/patience-timing',
    is_active: true
  },
  {
    title: 'Bear Trap at Support - SPY',
    description: 'Sharp breakdown below support followed by immediate reversal. Classic trap pattern.',
    symbol: 'SPY',
    scenario_type: 'psychology',
    difficulty: 'advanced',
    chart_timeframe: '5m',
    chart_data: {
      candles: [
        { t: 1704898800000, o: 472.00, h: 472.30, l: 471.50, c: 471.70, v: 800000 },
        { t: 1704899100000, o: 471.70, h: 471.90, l: 471.20, c: 471.40, v: 850000 },
        { t: 1704899400000, o: 471.40, h: 471.60, l: 470.80, c: 470.90, v: 950000 },
        { t: 1704899700000, o: 470.90, h: 471.00, l: 469.50, c: 469.80, v: 1500000 },
        { t: 1704900000000, o: 469.80, h: 471.50, l: 469.60, c: 471.30, v: 1800000 },
        { t: 1704900300000, o: 471.30, h: 472.00, l: 471.20, c: 471.90, v: 1200000 },
        { t: 1704900600000, o: 471.90, h: 472.50, l: 471.80, c: 472.40, v: 1000000 },
        { t: 1704900900000, o: 472.40, h: 472.80, l: 472.30, c: 472.70, v: 900000 },
      ],
      volume_profile: { high_vol_node: 471.00, low_vol_node: 470.00 }
    },
    key_levels: [
      { type: 'support', price: 471.00, strength: 90, label: 'Key Support' },
      { type: 'stop_hunt', price: 469.50, strength: 85, label: 'Stop Hunt Zone' },
      { type: 'vwap', price: 471.50, strength: 70, label: 'VWAP' }
    ],
    decision_point: { price: 471.30, time: 1704900000000, context: 'Price just reclaimed support after sharp breakdown' },
    correct_action: 'long',
    outcome_data: { result: 'win', exit_price: 474.00, pnl_percent: 0.57, candles_to_target: 10 },
    ltp_analysis: {
      level: { score: 90, reason: 'Failed breakdown with immediate reclaim = trapped shorts' },
      trend: { score: 85, reason: 'Massive volume on reversal candle shows institutional buying' },
      patience: { score: 80, reason: 'Entry on reclaim, not during the chaos' }
    },
    explanation: 'Bear traps are advanced setups but highly profitable. The sharp breakdown below $471 triggered stop losses, then smart money bought the discount. The key tells: 1) Massive volume on the reversal candle 2) Immediate reclaim of broken support 3) Strong close near highs. Enter long on reclaim with stops below the trap low.',
    tags: ['trap', 'psychology', 'advanced', 'reversal', 'institutional'],
    focus_area: 'psychology',
    category: 'trap_patterns',
    source_type: 'seed',
    related_lesson_slug: 'ltp-framework/market-psychology',
    is_active: true
  },
  {
    title: 'Liquidity Sweep & Reversal - QQQ',
    description: 'Price swept liquidity above highs then reversed. Recognize this institutional pattern.',
    symbol: 'QQQ',
    scenario_type: 'liquidity',
    difficulty: 'advanced',
    chart_timeframe: '5m',
    chart_data: {
      candles: [
        { t: 1704898800000, o: 398.00, h: 398.50, l: 397.80, c: 398.30, v: 600000 },
        { t: 1704899100000, o: 398.30, h: 398.80, l: 398.20, c: 398.60, v: 580000 },
        { t: 1704899400000, o: 398.60, h: 399.00, l: 398.50, c: 398.90, v: 620000 },
        { t: 1704899700000, o: 398.90, h: 399.30, l: 398.80, c: 399.20, v: 650000 },
        { t: 1704900000000, o: 399.20, h: 400.20, l: 399.10, c: 399.40, v: 1200000 },
        { t: 1704900300000, o: 399.40, h: 399.50, l: 398.50, c: 398.60, v: 950000 },
        { t: 1704900600000, o: 398.60, h: 398.80, l: 397.80, c: 398.00, v: 850000 },
        { t: 1704900900000, o: 398.00, h: 398.20, l: 397.50, c: 397.70, v: 780000 },
      ],
      volume_profile: { high_vol_node: 399.00, low_vol_node: 400.00 }
    },
    key_levels: [
      { type: 'liquidity', price: 400.00, strength: 95, label: 'Liquidity Pool (Stops)' },
      { type: 'resistance', price: 399.50, strength: 85, label: 'Prior High' },
      { type: 'vwap', price: 398.50, strength: 70, label: 'VWAP' }
    ],
    decision_point: { price: 399.40, time: 1704900000000, context: 'Price swept above $400 then immediately rejected' },
    correct_action: 'short',
    outcome_data: { result: 'win', exit_price: 396.00, pnl_percent: 0.85, candles_to_target: 12 },
    ltp_analysis: {
      level: { score: 95, reason: 'Liquidity sweep above $400 trapped breakout buyers' },
      trend: { score: 85, reason: 'Failed breakout with engulfing candle = trend reversal' },
      patience: { score: 90, reason: 'Wait for rejection confirmation, not anticipation' }
    },
    explanation: 'Liquidity sweeps are how institutions enter positions. They push price through obvious levels ($400 round number) to trigger stops and breakout entries, then reverse. The key: 1) Spike above resistance with high volume 2) Immediate rejection 3) Close below the prior high. Short on confirmation with stop above the sweep high.',
    tags: ['liquidity', 'sweep', 'institutional', 'advanced', 'reversal'],
    focus_area: 'psychology',
    category: 'liquidity_concepts',
    source_type: 'seed',
    related_lesson_slug: 'ltp-framework/market-psychology',
    is_active: true
  },
  {
    title: 'FOMO Test - COIN',
    description: 'Explosive move higher. Do you chase or wait? Test your discipline.',
    symbol: 'COIN',
    scenario_type: 'psychology',
    difficulty: 'advanced',
    chart_timeframe: '5m',
    chart_data: {
      candles: [
        { t: 1704898800000, o: 145.00, h: 146.00, l: 144.80, c: 145.80, v: 400000 },
        { t: 1704899100000, o: 145.80, h: 148.00, l: 145.70, c: 147.80, v: 600000 },
        { t: 1704899400000, o: 147.80, h: 151.00, l: 147.50, c: 150.80, v: 900000 },
        { t: 1704899700000, o: 150.80, h: 154.00, l: 150.50, c: 153.50, v: 1200000 },
        { t: 1704900000000, o: 153.50, h: 155.50, l: 153.00, c: 155.00, v: 1100000 },
        { t: 1704900300000, o: 155.00, h: 156.00, l: 154.50, c: 155.50, v: 1000000 },
        { t: 1704900600000, o: 155.50, h: 156.50, l: 155.00, c: 155.80, v: 900000 },
        { t: 1704900900000, o: 155.80, h: 156.20, l: 155.20, c: 155.40, v: 850000 },
      ],
      volume_profile: { high_vol_node: 153.00, low_vol_node: 155.00 }
    },
    key_levels: [
      { type: 'extension', price: 157.00, strength: 70, label: '1.618 Extension' },
      { type: 'vwap', price: 150.00, strength: 75, label: 'VWAP' },
      { type: 'ema', price: 148.00, strength: 70, label: '9 EMA' }
    ],
    decision_point: { price: 155.50, time: 1704900300000, context: 'Parabolic move, 7% up from open, extended from all MAs' },
    correct_action: 'wait',
    outcome_data: { result: 'wait_correct', exit_price: null, pnl_percent: 0, candles_to_target: 0 },
    ltp_analysis: {
      level: { score: 40, reason: 'No clear level support nearby, in no-mans land' },
      trend: { score: 50, reason: 'Strong but extremely extended, high risk of pullback' },
      patience: { score: 95, reason: 'Chasing extended moves = buying others exits' }
    },
    explanation: 'This is a FOMO test. COIN moved 7% in 30 minutes - tempting but dangerous. At this point: 1) Price is extended from ALL support levels 2) No nearby structure for stops 3) Late buyers are providing exit liquidity. The correct action is to WAIT for a pullback to VWAP or moving averages. Chasing here typically leads to buying the top.',
    tags: ['fomo', 'psychology', 'discipline', 'advanced', 'extended'],
    focus_area: 'patience',
    category: 'psychology_tests',
    source_type: 'seed',
    related_lesson_slug: 'ltp-framework/patience-timing',
    is_active: true
  }
];

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if admin (optional - you can remove this check for initial seeding)
    // if (!session.isAdmin) {
    //   return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    // }

    // First, run the migration to add new columns if they don't exist
    const migrationQueries = [
      `ALTER TABLE practice_scenarios ADD COLUMN IF NOT EXISTS source_type VARCHAR(50) DEFAULT 'manual'`,
      `ALTER TABLE practice_scenarios ADD COLUMN IF NOT EXISTS source_date TIMESTAMPTZ`,
      `ALTER TABLE practice_scenarios ADD COLUMN IF NOT EXISTS chart_timeframe VARCHAR(10) DEFAULT '5m'`,
      `ALTER TABLE practice_scenarios ADD COLUMN IF NOT EXISTS related_lesson_slug VARCHAR(255)`,
      `ALTER TABLE practice_scenarios ADD COLUMN IF NOT EXISTS ai_coaching_prompt TEXT`,
      `ALTER TABLE practice_scenarios ADD COLUMN IF NOT EXISTS community_attempts INTEGER DEFAULT 0`,
      `ALTER TABLE practice_scenarios ADD COLUMN IF NOT EXISTS community_accuracy DECIMAL(5,2) DEFAULT 0`,
      `ALTER TABLE practice_scenarios ADD COLUMN IF NOT EXISTS focus_area VARCHAR(50)`,
      `ALTER TABLE practice_scenarios ADD COLUMN IF NOT EXISTS category VARCHAR(100)`,
    ];

    for (const query of migrationQueries) {
      const { error } = await supabaseAdmin.rpc('exec_sql', { sql: query }).maybeSingle();
      if (error && !error.message.includes('already exists')) {
        logger.warn('Migration query warning', { query, error: error.message });
      }
    }

    // Check existing scenarios
    const { count: existingCount } = await supabaseAdmin
      .from('practice_scenarios')
      .select('*', { count: 'exact', head: true })
      .eq('source_type', 'seed');

    if (existingCount && existingCount > 0) {
      return NextResponse.json({
        message: 'Scenarios already seeded',
        existingCount,
        skipped: true
      });
    }

    // Insert scenarios
    const { data, error } = await supabaseAdmin
      .from('practice_scenarios')
      .insert(SEED_SCENARIOS)
      .select('id, title');

    if (error) {
      logger.error('Error seeding scenarios', { error: error.message });
      return NextResponse.json({ error: 'Failed to seed scenarios', details: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Seeded ${data?.length || 0} practice scenarios`,
      scenarios: data
    });

  } catch (error) {
    logger.error('Error in seed scenarios', error instanceof Error ? error : { message: String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'POST to this endpoint to seed practice scenarios',
    scenarioCount: SEED_SCENARIOS.length
  });
}
