/**
 * KCU LTP Detection Engine
 *
 * Core engine for detecting LTP (Level, Trend, Patience) trading setups
 * based on Kay Capitals University methodology.
 *
 * Integrates with:
 * - Massive.com WebSocket for real-time market data
 * - MTF (Multi-Timeframe) Analysis
 * - Options Flow data for liquidity zones
 */

const { supabase } = require('./database');
const MarketDataService = require('./market-data');
const OptionsService = require('./options');

class LTPDetectionEngine {
  constructor() {
    this.marketData = new MarketDataService();
    this.options = new OptionsService();
    this.config = null;
    this.watchedSymbols = new Set();
  }

  /**
   * Initialize the engine with configuration from database
   */
  async initialize() {
    // Load configuration
    const { data: configs } = await supabase
      .from('strategy_configs')
      .select('name, config')
      .eq('is_active', true);

    this.config = {};
    for (const c of configs || []) {
      this.config[c.name] = c.config;
    }

    console.log('[LTP Engine] Initialized with config:', Object.keys(this.config));
    return this;
  }

  /**
   * Add symbols to watch for setup detection
   */
  async addSymbols(symbols) {
    for (const symbol of symbols) {
      this.watchedSymbols.add(symbol.toUpperCase());
    }
    console.log(`[LTP Engine] Watching ${this.watchedSymbols.size} symbols`);
  }

  /**
   * Remove symbols from watchlist
   */
  async removeSymbols(symbols) {
    for (const symbol of symbols) {
      this.watchedSymbols.delete(symbol.toUpperCase());
    }
  }

  /**
   * Calculate all key levels for a symbol
   */
  async calculateKeyLevels(symbol) {
    const levels = [];
    const now = new Date();

    try {
      // Fetch aggregates for different timeframes
      const [dailyBars, weeklyBars, intradayBars] = await Promise.all([
        this.marketData.getAggregates(symbol, 'day', 60),
        this.marketData.getAggregates(symbol, 'week', 12),
        this.marketData.getAggregates(symbol, '5', 78) // ~6.5 hours
      ]);

      // Previous Day High/Low/Close
      if (dailyBars && dailyBars.length >= 2) {
        const prevDay = dailyBars[dailyBars.length - 2];
        levels.push(
          { type: 'pdh', price: prevDay.h, timeframe: 'daily', strength: 80 },
          { type: 'pdl', price: prevDay.l, timeframe: 'daily', strength: 80 },
          { type: 'pdc', price: prevDay.c, timeframe: 'daily', strength: 70 }
        );
      }

      // Weekly High/Low
      if (weeklyBars && weeklyBars.length >= 2) {
        const prevWeek = weeklyBars[weeklyBars.length - 2];
        levels.push(
          { type: 'weekly_high', price: prevWeek.h, timeframe: 'weekly', strength: 90 },
          { type: 'weekly_low', price: prevWeek.l, timeframe: 'weekly', strength: 90 }
        );

        // Current week
        const currWeek = weeklyBars[weeklyBars.length - 1];
        if (currWeek) {
          levels.push(
            { type: 'weekly_high', price: currWeek.h, timeframe: 'weekly', strength: 85 },
            { type: 'weekly_low', price: currWeek.l, timeframe: 'weekly', strength: 85 }
          );
        }
      }

      // Calculate VWAP
      if (intradayBars && intradayBars.length > 0) {
        const vwap = this.calculateVWAP(intradayBars);
        levels.push({ type: 'vwap', price: vwap, timeframe: 'intraday', strength: 75 });

        // Calculate ORB (first 15 min - 3 bars of 5min)
        const orbBars = intradayBars.slice(0, 3);
        if (orbBars.length >= 3) {
          const orbHigh = Math.max(...orbBars.map(b => b.h));
          const orbLow = Math.min(...orbBars.map(b => b.l));
          levels.push(
            { type: 'orb_high', price: orbHigh, timeframe: 'intraday', strength: 85 },
            { type: 'orb_low', price: orbLow, timeframe: 'intraday', strength: 85 }
          );
        }

        // HOD/LOD
        const hod = Math.max(...intradayBars.map(b => b.h));
        const lod = Math.min(...intradayBars.map(b => b.l));
        levels.push(
          { type: 'hod', price: hod, timeframe: 'intraday', strength: 70 },
          { type: 'lod', price: lod, timeframe: 'intraday', strength: 70 }
        );
      }

      // Calculate EMAs
      if (intradayBars && intradayBars.length >= 21) {
        const closes = intradayBars.map(b => b.c);
        const ema9 = this.calculateEMA(closes, 9);
        const ema21 = this.calculateEMA(closes, 21);
        levels.push(
          { type: 'ema_9', price: ema9, timeframe: 'intraday', strength: 65 },
          { type: 'ema_21', price: ema21, timeframe: 'intraday', strength: 70 }
        );
      }

      // Calculate 200 SMA from daily bars
      if (dailyBars && dailyBars.length >= 200) {
        const closes = dailyBars.slice(-200).map(b => b.c);
        const sma200 = closes.reduce((a, b) => a + b, 0) / 200;
        levels.push({ type: 'sma_200', price: sma200, timeframe: 'daily', strength: 95 });
      }

      // Store levels in database
      await this.storeLevels(symbol, levels);

      return levels;
    } catch (error) {
      console.error(`[LTP Engine] Error calculating levels for ${symbol}:`, error);
      return [];
    }
  }

  /**
   * Calculate VWAP from bars
   */
  calculateVWAP(bars) {
    let cumulativeTPV = 0; // Typical Price * Volume
    let cumulativeVolume = 0;

    for (const bar of bars) {
      const typicalPrice = (bar.h + bar.l + bar.c) / 3;
      cumulativeTPV += typicalPrice * bar.v;
      cumulativeVolume += bar.v;
    }

    return cumulativeVolume > 0 ? cumulativeTPV / cumulativeVolume : 0;
  }

  /**
   * Calculate EMA
   */
  calculateEMA(data, period) {
    if (data.length < period) return data[data.length - 1];

    const multiplier = 2 / (period + 1);
    let ema = data.slice(0, period).reduce((a, b) => a + b, 0) / period;

    for (let i = period; i < data.length; i++) {
      ema = (data[i] - ema) * multiplier + ema;
    }

    return ema;
  }

  /**
   * Store levels in database
   */
  async storeLevels(symbol, levels) {
    // Delete existing levels for symbol
    await supabase
      .from('key_levels')
      .delete()
      .eq('symbol', symbol);

    // Insert new levels
    const records = levels.map(level => ({
      symbol,
      level_type: level.type,
      timeframe: level.timeframe,
      price: level.price,
      strength: level.strength,
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour expiry
    }));

    await supabase
      .from('key_levels')
      .insert(records);
  }

  /**
   * Analyze Multi-Timeframe for a symbol
   */
  async analyzeMTF(symbol) {
    const timeframes = this.config?.mtf_timeframes?.enabled_timeframes ||
      ['2m', '5m', '15m', '1h', '4h', 'daily', 'weekly'];

    const analyses = [];

    for (const tf of timeframes) {
      try {
        const analysis = await this.analyzeTimeframe(symbol, tf);
        analyses.push(analysis);

        // Store in database
        await supabase
          .from('mtf_analysis')
          .upsert({
            symbol,
            timeframe: tf,
            ...analysis,
            calculated_at: new Date().toISOString()
          }, { onConflict: 'symbol,timeframe' });
      } catch (error) {
        console.error(`[LTP Engine] Error analyzing ${symbol} ${tf}:`, error);
      }
    }

    return analyses;
  }

  /**
   * Analyze a single timeframe
   */
  async analyzeTimeframe(symbol, timeframe) {
    const tfMap = {
      '2m': { mult: '2', period: 60 },
      '5m': { mult: '5', period: 48 },
      '15m': { mult: '15', period: 32 },
      '1h': { mult: '60', period: 24 },
      '4h': { mult: '240', period: 30 },
      'daily': { mult: 'day', period: 50 },
      'weekly': { mult: 'week', period: 20 }
    };

    const config = tfMap[timeframe] || { mult: '5', period: 48 };
    const bars = await this.marketData.getAggregates(symbol, config.mult, config.period);

    if (!bars || bars.length < 21) {
      return { trend: 'neutral', structure: 'range', momentum: 'weak' };
    }

    const closes = bars.map(b => b.c);
    const currentPrice = closes[closes.length - 1];

    // Calculate EMAs
    const ema9 = this.calculateEMA(closes, 9);
    const ema21 = this.calculateEMA(closes, 21);

    // Determine trend
    let trend = 'neutral';
    if (currentPrice > ema9 && ema9 > ema21) trend = 'bullish';
    else if (currentPrice < ema9 && ema9 < ema21) trend = 'bearish';

    // Determine structure
    const highs = bars.slice(-5).map(b => b.h);
    const lows = bars.slice(-5).map(b => b.l);
    let structure = 'range';

    const isHigherHighs = highs.every((h, i) => i === 0 || h >= highs[i - 1]);
    const isHigherLows = lows.every((l, i) => i === 0 || l >= lows[i - 1]);
    const isLowerHighs = highs.every((h, i) => i === 0 || h <= highs[i - 1]);
    const isLowerLows = lows.every((l, i) => i === 0 || l <= lows[i - 1]);

    if (isHigherHighs && isHigherLows) structure = 'uptrend';
    else if (isLowerHighs && isLowerLows) structure = 'downtrend';

    // EMA position
    let emaPosition = 'mixed';
    if (currentPrice > ema9 && currentPrice > ema21) emaPosition = 'above_all';
    else if (currentPrice < ema9 && currentPrice < ema21) emaPosition = 'below_all';

    // Momentum (using price change)
    const change = (currentPrice - closes[0]) / closes[0] * 100;
    let momentum = 'weak';
    if (Math.abs(change) > 2) momentum = 'strong';
    else if (Math.abs(change) > 1) momentum = 'moderate';

    return {
      trend,
      structure,
      ema_position: emaPosition,
      momentum,
      orb_status: null, // Set elsewhere for intraday
      vwap_position: null // Set elsewhere for intraday
    };
  }

  /**
   * Detect patience candle at a level
   */
  detectPatienceCandle(bars, levelPrice) {
    if (!bars || bars.length < 3) return { detected: false, count: 0 };

    const recentBars = bars.slice(-5);
    let patienceCount = 0;
    const maxCandleSize = this.config?.ltp_detection_thresholds?.patience_candle_max_size_percent || 0.5;

    for (const bar of recentBars) {
      const candleSize = Math.abs(bar.c - bar.o) / bar.o * 100;
      const distanceToLevel = Math.abs(bar.c - levelPrice) / levelPrice * 100;

      // Patience candle criteria:
      // 1. Small body (< maxCandleSize%)
      // 2. Near the level (within 0.3%)
      if (candleSize < maxCandleSize && distanceToLevel < 0.3) {
        patienceCount++;
      }
    }

    return {
      detected: patienceCount >= 2,
      count: patienceCount
    };
  }

  /**
   * Score the Level (L) component
   */
  scoreLevelProximity(currentPrice, levels) {
    let maxScore = 0;
    let bestLevel = null;

    for (const level of levels) {
      const distance = Math.abs(currentPrice - level.price) / currentPrice * 100;
      const proximityThreshold = this.config?.ltp_detection_thresholds?.level_proximity_percent || 0.3;

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
   * Score the Trend (T) component
   */
  scoreTrendAlignment(mtfAnalyses, direction) {
    const weights = this.config?.mtf_timeframes?.weights || {
      weekly: 0.15, daily: 0.20, '4h': 0.15, '1h': 0.20, '15m': 0.15, '5m': 0.10, '2m': 0.05
    };

    let score = 0;

    for (const analysis of mtfAnalyses) {
      const weight = weights[analysis.timeframe] || 0.1;
      const aligned = (direction === 'bullish' && analysis.trend === 'bullish') ||
                      (direction === 'bearish' && analysis.trend === 'bearish');

      if (aligned) {
        score += weight * 100;
      }
    }

    return Math.round(score);
  }

  /**
   * Score the Patience (P) component
   */
  scorePatienceQuality(patienceResult) {
    if (!patienceResult.detected) return 0;

    // More patience candles = higher score
    const countScore = Math.min(patienceResult.count * 20, 60);
    const baseScore = 40; // For having patience candles at all

    return countScore + baseScore;
  }

  /**
   * Analyze a symbol for LTP setups
   */
  async analyzeSymbol(symbol) {
    try {
      // Get current quote
      const quote = await this.marketData.getQuote(symbol);
      if (!quote) return null;

      const currentPrice = quote.last;

      // Get key levels
      const { data: levels } = await supabase
        .from('key_levels')
        .select('*')
        .eq('symbol', symbol)
        .gt('expires_at', new Date().toISOString());

      if (!levels || levels.length === 0) {
        await this.calculateKeyLevels(symbol);
        return null; // Will analyze on next iteration
      }

      // Get MTF analysis
      const { data: mtfAnalyses } = await supabase
        .from('mtf_analysis')
        .select('*')
        .eq('symbol', symbol)
        .gt('calculated_at', new Date(Date.now() - 30 * 60 * 1000).toISOString());

      if (!mtfAnalyses || mtfAnalyses.length === 0) {
        await this.analyzeMTF(symbol);
        return null;
      }

      // Get recent bars for patience candle detection
      const bars = await this.marketData.getAggregates(symbol, '5', 12);

      // Determine potential direction based on MTF
      const bullishCount = mtfAnalyses.filter(a => a.trend === 'bullish').length;
      const bearishCount = mtfAnalyses.filter(a => a.trend === 'bearish').length;
      const direction = bullishCount > bearishCount ? 'bullish' : 'bearish';

      // Score Level (L)
      const levelResult = this.scoreLevelProximity(currentPrice, levels);

      // Score Trend (T)
      const trendScore = this.scoreTrendAlignment(mtfAnalyses, direction);

      // Score Patience (P)
      const patienceResult = levelResult.level
        ? this.detectPatienceCandle(bars, levelResult.level.price)
        : { detected: false, count: 0 };
      const patienceScore = this.scorePatienceQuality(patienceResult);

      // Calculate MTF alignment score
      const mtfScore = trendScore; // Reuse trend score for MTF

      // Calculate overall confluence
      const confluenceScore = Math.round(
        (levelResult.score * 0.35) +
        (trendScore * 0.35) +
        (patienceScore * 0.30)
      );

      // Determine setup stage
      const threshold = this.config?.ltp_detection_thresholds?.confluence_threshold || 70;
      let setupStage = 'forming';
      if (confluenceScore >= threshold && patienceResult.detected) {
        setupStage = 'ready';
      }

      // Calculate trade parameters
      const tradeParams = this.calculateTradeParams(currentPrice, levelResult.level, direction);

      // Generate coach note
      const coachNote = this.generateCoachNote(levelResult, trendScore, patienceResult, direction);

      return {
        symbol,
        direction,
        setup_stage: setupStage,
        confluence_score: confluenceScore,
        level_score: levelResult.score,
        trend_score: trendScore,
        patience_score: patienceScore,
        mtf_score: mtfScore,
        primary_level_type: levelResult.level?.level_type,
        primary_level_price: levelResult.level?.price,
        patience_candles: patienceResult.count,
        ...tradeParams,
        coach_note: coachNote
      };
    } catch (error) {
      console.error(`[LTP Engine] Error analyzing ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Calculate trade parameters (entry, stop, targets)
   */
  calculateTradeParams(currentPrice, level, direction) {
    if (!level) {
      return {
        suggested_entry: null,
        suggested_stop: null,
        target_1: null,
        target_2: null,
        target_3: null,
        risk_reward: null
      };
    }

    const levelPrice = level.price;
    const atr = currentPrice * 0.01; // Estimate 1% ATR

    let entry, stop, target1, target2, target3;

    if (direction === 'bullish') {
      entry = currentPrice; // Market entry
      stop = levelPrice - atr; // Below level
      target1 = entry + (entry - stop); // 1R
      target2 = entry + (entry - stop) * 2; // 2R
      target3 = entry + (entry - stop) * 3; // 3R
    } else {
      entry = currentPrice;
      stop = levelPrice + atr; // Above level
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
      risk_reward: Math.round(riskReward * 10) / 10
    };
  }

  /**
   * Generate coaching note for the setup
   */
  generateCoachNote(levelResult, trendScore, patienceResult, direction) {
    const notes = [];

    // Level note
    if (levelResult.score >= 70) {
      notes.push(`Strong ${levelResult.level?.level_type?.toUpperCase()} level confluence.`);
    } else if (levelResult.score >= 50) {
      notes.push(`Price near ${levelResult.level?.level_type?.toUpperCase()}.`);
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
   * Run detection cycle for all watched symbols
   */
  async runDetectionCycle() {
    console.log(`[LTP Engine] Running detection for ${this.watchedSymbols.size} symbols`);

    const results = [];

    for (const symbol of this.watchedSymbols) {
      try {
        const analysis = await this.analyzeSymbol(symbol);

        if (analysis && analysis.confluence_score >= 50) {
          // Store or update detected setup
          const { data, error } = await supabase
            .from('detected_setups')
            .upsert({
              ...analysis,
              detected_at: new Date().toISOString(),
              detected_by: 'system'
            }, {
              onConflict: 'symbol'
            })
            .select()
            .single();

          if (data) {
            results.push(data);
          }
        }
      } catch (error) {
        console.error(`[LTP Engine] Error processing ${symbol}:`, error);
      }
    }

    return results;
  }

  /**
   * Start continuous detection loop
   */
  async startContinuousDetection(intervalMs = 60000) {
    console.log(`[LTP Engine] Starting continuous detection (interval: ${intervalMs}ms)`);

    // Initial run
    await this.runDetectionCycle();

    // Set up interval
    this.detectionInterval = setInterval(async () => {
      await this.runDetectionCycle();
    }, intervalMs);
  }

  /**
   * Stop detection loop
   */
  stopContinuousDetection() {
    if (this.detectionInterval) {
      clearInterval(this.detectionInterval);
      this.detectionInterval = null;
      console.log('[LTP Engine] Stopped continuous detection');
    }
  }
}

module.exports = LTPDetectionEngine;
