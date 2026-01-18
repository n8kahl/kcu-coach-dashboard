/**
 * LTP Detector Service
 *
 * Runs the LTP detection engine and broadcasts detected setups.
 * Can run as a scheduled job or on-demand.
 */

import { supabaseAdmin } from './supabase';
import { marketDataService, type Quote, type Bar } from './market-data';
import {
  calculateLTPScore,
  calculateEMA,
  calculateVWAP,
  detectPatienceCandle,
  scoreLevelProximity,
  scoreTrendAlignment,
  scorePatienceQuality,
  calculateTradeParams,
  generateCoachNote,
  getLTPGrade,
  type KeyLevel,
  type MTFAnalysis,
  type DetectedSetup,
} from './ltp-engine';
import { broadcastSetupForming, broadcastSetupReady, type SetupEvent } from './broadcast';

// Configuration
const CONFIG = {
  // Minimum confluence score to broadcast
  minConfluenceScore: 50,

  // Score threshold for "ready" status
  readyThreshold: 70,

  // Detection interval in milliseconds
  detectionIntervalMs: 60000, // 1 minute

  // Default watchlist
  defaultWatchlist: ['SPY', 'QQQ', 'NVDA', 'AAPL', 'TSLA', 'AMD', 'META', 'GOOGL', 'AMZN', 'MSFT'],
};

// Detector state
let isRunning = false;
let detectionInterval: NodeJS.Timeout | null = null;
let watchedSymbols: Set<string> = new Set(CONFIG.defaultWatchlist);

/**
 * Calculate key levels for a symbol
 */
async function calculateKeyLevels(symbol: string): Promise<KeyLevel[]> {
  const levels: KeyLevel[] = [];

  try {
    // Fetch daily and intraday data
    const [dailyBars, intradayBars] = await Promise.all([
      marketDataService.getAggregates(symbol, 'day', 60),
      marketDataService.getAggregates(symbol, '5', 78), // ~6.5 hours
    ]);

    // Previous Day High/Low/Close
    if (dailyBars.length >= 2) {
      const prevDay = dailyBars[dailyBars.length - 2];
      levels.push(
        { type: 'pdh', price: prevDay.h, timeframe: 'daily', strength: 80 },
        { type: 'pdl', price: prevDay.l, timeframe: 'daily', strength: 80 },
        { type: 'pdc', price: prevDay.c, timeframe: 'daily', strength: 70 }
      );
    }

    // Calculate VWAP from intraday
    if (intradayBars.length > 0) {
      const vwap = calculateVWAP(intradayBars);
      levels.push({ type: 'vwap', price: vwap, timeframe: 'intraday', strength: 75 });

      // ORB (first 15 min - 3 bars of 5min)
      const orbBars = intradayBars.slice(0, 3);
      if (orbBars.length >= 3) {
        const orbHigh = Math.max(...orbBars.map((b) => b.h));
        const orbLow = Math.min(...orbBars.map((b) => b.l));
        levels.push(
          { type: 'orb_high', price: orbHigh, timeframe: 'intraday', strength: 85 },
          { type: 'orb_low', price: orbLow, timeframe: 'intraday', strength: 85 }
        );
      }

      // HOD/LOD
      const hod = Math.max(...intradayBars.map((b) => b.h));
      const lod = Math.min(...intradayBars.map((b) => b.l));
      levels.push(
        { type: 'hod', price: hod, timeframe: 'intraday', strength: 70 },
        { type: 'lod', price: lod, timeframe: 'intraday', strength: 70 }
      );

      // EMAs
      if (intradayBars.length >= 21) {
        const closes = intradayBars.map((b) => b.c);
        const ema9 = calculateEMA(closes, 9);
        const ema21 = calculateEMA(closes, 21);
        levels.push(
          { type: 'ema_9', price: ema9, timeframe: 'intraday', strength: 65 },
          { type: 'ema_21', price: ema21, timeframe: 'intraday', strength: 70 }
        );
      }
    }

    // 200 SMA from daily
    if (dailyBars.length >= 200) {
      const closes = dailyBars.slice(-200).map((b) => b.c);
      const sma200 = closes.reduce((a, b) => a + b, 0) / 200;
      levels.push({ type: 'sma_200', price: sma200, timeframe: 'daily', strength: 95 });
    }

    return levels;
  } catch (error) {
    console.error(`[LTP Detector] Error calculating levels for ${symbol}:`, error);
    return [];
  }
}

/**
 * Analyze a single timeframe
 */
async function analyzeTimeframe(symbol: string, timeframe: string): Promise<MTFAnalysis> {
  const tfMap: Record<string, { mult: string; period: number }> = {
    '2m': { mult: '2', period: 60 },
    '5m': { mult: '5', period: 48 },
    '15m': { mult: '15', period: 32 },
    '1h': { mult: '60', period: 24 },
    '4h': { mult: '240', period: 30 },
    daily: { mult: 'day', period: 50 },
    weekly: { mult: 'week', period: 20 },
  };

  const config = tfMap[timeframe] || { mult: '5', period: 48 };
  const bars = await marketDataService.getAggregates(symbol, config.mult, config.period);

  if (bars.length < 21) {
    return {
      timeframe,
      trend: 'neutral',
      structure: 'range',
      ema_position: 'mixed',
      momentum: 'weak',
      orb_status: null,
      vwap_position: null,
    };
  }

  const closes = bars.map((b) => b.c);
  const currentPrice = closes[closes.length - 1];

  // Calculate EMAs
  const ema9 = calculateEMA(closes, 9);
  const ema21 = calculateEMA(closes, 21);

  // Determine trend
  let trend: 'bullish' | 'bearish' | 'neutral' = 'neutral';
  if (currentPrice > ema9 && ema9 > ema21) trend = 'bullish';
  else if (currentPrice < ema9 && ema9 < ema21) trend = 'bearish';

  // Determine structure
  const highs = bars.slice(-5).map((b) => b.h);
  const lows = bars.slice(-5).map((b) => b.l);
  let structure: 'uptrend' | 'downtrend' | 'range' = 'range';

  const isHigherHighs = highs.every((h, i) => i === 0 || h >= highs[i - 1]);
  const isHigherLows = lows.every((l, i) => i === 0 || l >= lows[i - 1]);
  const isLowerHighs = highs.every((h, i) => i === 0 || h <= highs[i - 1]);
  const isLowerLows = lows.every((l, i) => i === 0 || l <= lows[i - 1]);

  if (isHigherHighs && isHigherLows) structure = 'uptrend';
  else if (isLowerHighs && isLowerLows) structure = 'downtrend';

  // EMA position
  let emaPosition: 'above_all' | 'below_all' | 'mixed' = 'mixed';
  if (currentPrice > ema9 && currentPrice > ema21) emaPosition = 'above_all';
  else if (currentPrice < ema9 && currentPrice < ema21) emaPosition = 'below_all';

  // Momentum
  const change = ((currentPrice - closes[0]) / closes[0]) * 100;
  let momentum: 'strong' | 'moderate' | 'weak' = 'weak';
  if (Math.abs(change) > 2) momentum = 'strong';
  else if (Math.abs(change) > 1) momentum = 'moderate';

  return {
    timeframe,
    trend,
    structure,
    ema_position: emaPosition,
    momentum,
    orb_status: null,
    vwap_position: null,
  };
}

/**
 * Analyze multi-timeframe for a symbol
 */
async function analyzeMTF(symbol: string): Promise<MTFAnalysis[]> {
  const timeframes = ['5m', '15m', '1h', '4h', 'daily'];
  const analyses: MTFAnalysis[] = [];

  for (const tf of timeframes) {
    try {
      const analysis = await analyzeTimeframe(symbol, tf);
      analyses.push(analysis);
    } catch (error) {
      console.error(`[LTP Detector] Error analyzing ${symbol} ${tf}:`, error);
    }
  }

  return analyses;
}

/**
 * Analyze a symbol for LTP setups
 */
async function analyzeSymbol(symbol: string): Promise<DetectedSetup | null> {
  try {
    // Get current quote
    const quote = await marketDataService.getQuote(symbol);
    if (!quote) return null;

    const currentPrice = quote.last;

    // Get key levels
    const levels = await calculateKeyLevels(symbol);
    if (levels.length === 0) return null;

    // Get MTF analysis
    const mtfAnalyses = await analyzeMTF(symbol);
    if (mtfAnalyses.length === 0) return null;

    // Get recent bars for patience candle detection
    const bars = await marketDataService.getAggregates(symbol, '5', 12);

    // Determine direction based on MTF
    const bullishCount = mtfAnalyses.filter((a) => a.trend === 'bullish').length;
    const bearishCount = mtfAnalyses.filter((a) => a.trend === 'bearish').length;
    const direction: 'bullish' | 'bearish' = bullishCount > bearishCount ? 'bullish' : 'bearish';

    // Score Level (L)
    const levelResult = scoreLevelProximity(currentPrice, levels);

    // Score Trend (T)
    const trendScore = scoreTrendAlignment(mtfAnalyses, direction);

    // Score Patience (P)
    const patienceResult = levelResult.level
      ? detectPatienceCandle(bars, levelResult.level.price)
      : { detected: false, count: 0 };
    const patienceScore = scorePatienceQuality(patienceResult);

    // Calculate overall confluence
    const confluenceScore = Math.round(
      levelResult.score * 0.35 + trendScore * 0.35 + patienceScore * 0.3
    );

    // Determine setup stage
    let setupStage: 'forming' | 'ready' | 'triggered' = 'forming';
    if (confluenceScore >= CONFIG.readyThreshold && patienceResult.detected) {
      setupStage = 'ready';
    }

    // Calculate trade parameters
    const tradeParams = calculateTradeParams(currentPrice, levelResult.level, direction);

    // Generate coach note
    const coachNote = generateCoachNote(levelResult, trendScore, patienceResult, direction);

    return {
      symbol,
      direction,
      setup_stage: setupStage,
      confluence_score: confluenceScore,
      level_score: levelResult.score,
      trend_score: trendScore,
      patience_score: patienceScore,
      mtf_score: trendScore,
      primary_level_type: levelResult.level?.type || null,
      primary_level_price: levelResult.level?.price || null,
      patience_candles: patienceResult.count,
      ...tradeParams,
      coach_note: coachNote,
    };
  } catch (error) {
    console.error(`[LTP Detector] Error analyzing ${symbol}:`, error);
    return null;
  }
}

/**
 * Run detection cycle for all watched symbols
 */
async function runDetectionCycle(): Promise<DetectedSetup[]> {
  console.log(`[LTP Detector] Running detection for ${watchedSymbols.size} symbols`);

  const results: DetectedSetup[] = [];

  const symbolsArray = Array.from(watchedSymbols.values());
  for (const symbol of symbolsArray) {
    try {
      const analysis = await analyzeSymbol(symbol);

      if (analysis && analysis.confluence_score >= CONFIG.minConfluenceScore) {
        results.push(analysis);

        // Store in database
        try {
          await supabaseAdmin.from('detected_setups').upsert(
            {
              ...analysis,
              detected_at: new Date().toISOString(),
              detected_by: 'system',
            },
            { onConflict: 'symbol' }
          );
        } catch (dbError) {
          console.error(`[LTP Detector] DB error for ${symbol}:`, dbError);
        }

        // Broadcast to connected clients
        const setupEvent: SetupEvent = {
          id: `${symbol}-${Date.now()}`,
          symbol: analysis.symbol,
          direction: analysis.direction,
          confluenceScore: analysis.confluence_score,
          levelScore: analysis.level_score,
          trendScore: analysis.trend_score,
          patienceScore: analysis.patience_score,
          mtfScore: analysis.mtf_score,
          coachNote: analysis.coach_note,
          suggestedEntry: analysis.suggested_entry || undefined,
          suggestedStop: analysis.suggested_stop || undefined,
          target1: analysis.target_1 || undefined,
          target2: analysis.target_2 || undefined,
          target3: analysis.target_3 || undefined,
          riskReward: analysis.risk_reward || undefined,
        };

        if (analysis.setup_stage === 'ready') {
          await broadcastSetupReady(setupEvent);
        } else {
          await broadcastSetupForming(setupEvent);
        }
      }
    } catch (error) {
      console.error(`[LTP Detector] Error processing ${symbol}:`, error);
    }
  }

  console.log(`[LTP Detector] Detected ${results.length} setups`);
  return results;
}

/**
 * Start continuous detection
 */
export function startDetector(): void {
  if (isRunning) {
    console.log('[LTP Detector] Already running');
    return;
  }

  if (!marketDataService.isConfigured()) {
    console.warn('[LTP Detector] Market data API not configured, skipping');
    return;
  }

  isRunning = true;
  console.log('[LTP Detector] Starting continuous detection');

  // Run immediately
  runDetectionCycle().catch(console.error);

  // Set up interval
  detectionInterval = setInterval(() => {
    runDetectionCycle().catch(console.error);
  }, CONFIG.detectionIntervalMs);
}

/**
 * Stop detection
 */
export function stopDetector(): void {
  if (detectionInterval) {
    clearInterval(detectionInterval);
    detectionInterval = null;
  }
  isRunning = false;
  console.log('[LTP Detector] Stopped');
}

/**
 * Check if detector is running
 */
export function isDetectorRunning(): boolean {
  return isRunning;
}

/**
 * Add symbols to watchlist
 */
export function addSymbols(symbols: string[]): void {
  for (const symbol of symbols) {
    watchedSymbols.add(symbol.toUpperCase());
  }
  console.log(`[LTP Detector] Watching ${watchedSymbols.size} symbols`);
}

/**
 * Remove symbols from watchlist
 */
export function removeSymbols(symbols: string[]): void {
  for (const symbol of symbols) {
    watchedSymbols.delete(symbol.toUpperCase());
  }
}

/**
 * Get current watchlist
 */
export function getWatchlist(): string[] {
  return Array.from(watchedSymbols);
}

/**
 * Run a single detection cycle (for manual/API trigger)
 */
export async function runOnce(): Promise<DetectedSetup[]> {
  return runDetectionCycle();
}

/**
 * Analyze a single symbol on-demand
 */
export async function analyzeOnDemand(symbol: string): Promise<DetectedSetup | null> {
  return analyzeSymbol(symbol);
}

export default {
  start: startDetector,
  stop: stopDetector,
  isRunning: isDetectorRunning,
  addSymbols,
  removeSymbols,
  getWatchlist,
  runOnce,
  analyzeOnDemand,
};
