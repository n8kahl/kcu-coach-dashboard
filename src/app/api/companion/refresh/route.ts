import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { marketDataService } from '@/lib/market-data';
import {
  calculateEMA,
  calculateVWAP,
  identifyKeyLevels,
  Bar as LTPBar,
} from '@/lib/ltp-engine';
import logger from '@/lib/logger';
import { withRateLimitAndTimeout, getEndpointUserKey } from '@/lib/rate-limit';

interface KeyLevelInsert {
  symbol: string;
  level_type: string;
  timeframe: string;
  price: number;
  strength: number;
  calculated_at: string;
  expires_at: string;
  metadata: Record<string, unknown>;
}

/**
 * POST /api/companion/refresh
 * Manually refresh key levels for a symbol or all watchlist symbols
 */
async function refreshHandler(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if market data API is configured
    if (!marketDataService.isConfigured()) {
      return NextResponse.json({
        error: 'Market data not configured',
        detail: 'MASSIVE_API_KEY environment variable is not set'
      }, { status: 503 });
    }

    const body = await request.json().catch(() => ({}));
    const { symbol, refreshAll = false } = body;

    let symbolsToRefresh: string[] = [];

    if (symbol) {
      // Refresh single symbol
      symbolsToRefresh = [symbol.toUpperCase()];
    } else if (refreshAll) {
      // Get all symbols from user's watchlist
      let { data: watchlist } = await supabaseAdmin
        .from('watchlists')
        .select('symbols')
        .eq('user_id', session.userId)
        .eq('is_shared', false)
        .single();

      if (!watchlist) {
        const { data: watchlistByOwnerId } = await supabaseAdmin
          .from('watchlists')
          .select('symbols')
          .eq('owner_id', session.userId)
          .eq('is_shared', false)
          .single();
        watchlist = watchlistByOwnerId;
      }

      symbolsToRefresh = watchlist?.symbols || [];
    }

    if (symbolsToRefresh.length === 0) {
      return NextResponse.json({
        error: 'No symbols to refresh',
        detail: 'Provide a symbol or add symbols to your watchlist first'
      }, { status: 400 });
    }

    logger.info('Refreshing key levels', { symbols: symbolsToRefresh, userId: session.userId });

    const results: { symbol: string; levelsCount: number; error?: string }[] = [];

    for (const sym of symbolsToRefresh) {
      try {
        const levels = await calculateKeyLevelsForSymbol(sym);

        if (levels.length > 0) {
          // Store in database - upsert based on symbol + level_type
          const { error: upsertError } = await supabaseAdmin
            .from('key_levels')
            .upsert(levels, {
              onConflict: 'symbol,level_type',
              ignoreDuplicates: false
            });

          if (upsertError) {
            logger.warn('Failed to store key levels', { symbol: sym, error: upsertError.message });
            results.push({ symbol: sym, levelsCount: 0, error: upsertError.message });
          } else {
            results.push({ symbol: sym, levelsCount: levels.length });
          }
        } else {
          results.push({ symbol: sym, levelsCount: 0, error: 'No data available' });
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Error calculating levels', { symbol: sym, error: errorMsg });
        results.push({ symbol: sym, levelsCount: 0, error: errorMsg });
      }
    }

    const successCount = results.filter(r => r.levelsCount > 0).length;
    const totalLevels = results.reduce((sum, r) => sum + r.levelsCount, 0);

    return NextResponse.json({
      success: true,
      refreshed: successCount,
      total: symbolsToRefresh.length,
      totalLevels,
      results
    });

  } catch (error) {
    logger.error('Error refreshing levels', error instanceof Error ? error : { message: String(error) });
    return NextResponse.json({
      error: 'Internal server error',
      detail: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Export with rate limiting (5 requests/minute - market data is expensive) and timeout (60 seconds)
export const POST = withRateLimitAndTimeout(
  refreshHandler,
  getEndpointUserKey('companion-refresh'),
  { limit: 5, windowSeconds: 60, timeoutMs: 60000 }
);

/**
 * Calculate key levels for a single symbol
 * Per KCU methodology:
 * - Use 4-hour chart for structural levels with multiple touchpoints
 * - Include premarket high/low
 * - Weekly high/low for broader context
 */
async function calculateKeyLevelsForSymbol(symbol: string): Promise<KeyLevelInsert[]> {
  const levels: KeyLevelInsert[] = [];
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now

  // Fetch all required data in parallel
  const [dailyBars, weeklyBars, fourHourBars, intradayBars, premarketBars, quote] = await Promise.all([
    marketDataService.getAggregates(symbol, 'day', 200), // Get 200 days for SMA 200
    marketDataService.getWeeklyBars(symbol, 52), // Get 52 weeks
    marketDataService.getAggregates(symbol, '240', 100), // 4-hour bars (~2 months)
    marketDataService.getAggregates(symbol, '5', 78), // ~6.5 hours of 5min bars
    marketDataService.getPremarketBars(symbol), // Premarket data
    marketDataService.getQuote(symbol)
  ]);

  const baseLevel = {
    symbol: symbol.toUpperCase(),
    calculated_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
    metadata: {}
  };

  // ===========================================
  // PREVIOUS DAY LEVELS (PDH, PDL, PDC)
  // ===========================================
  if (dailyBars.length >= 2) {
    const prevDay = dailyBars[dailyBars.length - 2];
    const today = dailyBars[dailyBars.length - 1];

    levels.push(
      { ...baseLevel, level_type: 'pdh', timeframe: 'daily', price: prevDay.h, strength: 80 },
      { ...baseLevel, level_type: 'pdl', timeframe: 'daily', price: prevDay.l, strength: 80 },
      { ...baseLevel, level_type: 'pdc', timeframe: 'daily', price: prevDay.c, strength: 70 },
      { ...baseLevel, level_type: 'open_price', timeframe: 'daily', price: today.o, strength: 65 }
    );
  }

  // ===========================================
  // PREMARKET HIGH/LOW (PMH, PML)
  // ===========================================
  if (premarketBars.length > 0) {
    const pmh = Math.max(...premarketBars.map(b => b.h));
    const pml = Math.min(...premarketBars.map(b => b.l));
    levels.push(
      { ...baseLevel, level_type: 'pmh', timeframe: 'premarket', price: pmh, strength: 75 },
      { ...baseLevel, level_type: 'pml', timeframe: 'premarket', price: pml, strength: 75 }
    );
  }

  // ===========================================
  // WEEKLY HIGH/LOW (WH, WL)
  // ===========================================
  if (weeklyBars.length >= 2) {
    const prevWeek = weeklyBars[weeklyBars.length - 2];
    levels.push(
      { ...baseLevel, level_type: 'pwh', timeframe: 'weekly', price: prevWeek.h, strength: 90 },
      { ...baseLevel, level_type: 'pwl', timeframe: 'weekly', price: prevWeek.l, strength: 90 }
    );
  }

  // ===========================================
  // STRUCTURAL LEVELS FROM 4-HOUR CHART
  // Per KCU: Look for multiple touchpoints on 4H chart
  // ===========================================
  if (fourHourBars.length >= 10) {
    // Convert to LTPBar format for ltp-engine
    const barsForEngine: LTPBar[] = fourHourBars.map(b => ({
      o: b.o,
      h: b.h,
      l: b.l,
      c: b.c,
      v: b.v,
      t: b.t
    }));

    const structuralLevels = identifyKeyLevels(barsForEngine);

    // Add structural levels (support/resistance with multiple touchpoints)
    structuralLevels.forEach((level, index) => {
      // Only add top 5 strongest structural levels
      if (index < 5) {
        levels.push({
          ...baseLevel,
          level_type: `structural_${level.type}`,
          timeframe: '4h',
          price: level.price,
          strength: level.strength,
          metadata: {
            type: level.type,
            touchpoints: Math.ceil(level.strength / 25) // Estimate touchpoints from strength
          }
        });
      }
    });
  }

  // ===========================================
  // INTRADAY LEVELS (VWAP, ORB, HOD/LOD, EMAs)
  // ===========================================
  if (intradayBars.length > 0) {
    // VWAP
    const barsForVWAP: LTPBar[] = intradayBars.map(b => ({
      o: b.o, h: b.h, l: b.l, c: b.c, v: b.v, t: b.t
    }));
    const vwap = calculateVWAP(barsForVWAP);
    if (vwap > 0) {
      levels.push({ ...baseLevel, level_type: 'vwap', timeframe: 'intraday', price: vwap, strength: 75 });
    }

    // ORB (Opening Range - first 15 min = 3 bars of 5min)
    const orbBars = intradayBars.slice(0, 3);
    if (orbBars.length >= 3) {
      const orbHigh = Math.max(...orbBars.map(b => b.h));
      const orbLow = Math.min(...orbBars.map(b => b.l));
      levels.push(
        { ...baseLevel, level_type: 'orb_high', timeframe: 'intraday', price: orbHigh, strength: 85 },
        { ...baseLevel, level_type: 'orb_low', timeframe: 'intraday', price: orbLow, strength: 85 }
      );
    }

    // HOD/LOD (High/Low of Day)
    const hod = Math.max(...intradayBars.map(b => b.h));
    const lod = Math.min(...intradayBars.map(b => b.l));
    levels.push(
      { ...baseLevel, level_type: 'hod', timeframe: 'intraday', price: hod, strength: 70 },
      { ...baseLevel, level_type: 'lod', timeframe: 'intraday', price: lod, strength: 70 }
    );

    // EMAs from intraday closes
    if (intradayBars.length >= 21) {
      const closes = intradayBars.map(b => b.c);
      const ema9 = calculateEMA(closes, 9);
      const ema21 = calculateEMA(closes, 21);

      levels.push(
        { ...baseLevel, level_type: 'ema_9', timeframe: 'intraday', price: ema9, strength: 65 },
        { ...baseLevel, level_type: 'ema_21', timeframe: 'intraday', price: ema21, strength: 70 }
      );
    }
  }

  // ===========================================
  // DAILY SMAs (50, 200)
  // ===========================================
  if (dailyBars.length >= 50) {
    const closes = dailyBars.map(b => b.c);
    const sma50 = closes.slice(-50).reduce((a, b) => a + b, 0) / 50;
    levels.push({ ...baseLevel, level_type: 'sma_50', timeframe: 'daily', price: sma50, strength: 85 });
  }

  if (dailyBars.length >= 200) {
    const closes = dailyBars.map(b => b.c);
    const sma200 = closes.slice(-200).reduce((a, b) => a + b, 0) / 200;
    levels.push({ ...baseLevel, level_type: 'sma_200', timeframe: 'daily', price: sma200, strength: 95 });
  }

  // Store current quote in market_data_cache if available
  if (quote) {
    await supabaseAdmin
      .from('market_data_cache')
      .upsert({
        symbol: symbol.toUpperCase(),
        last_price: quote.last,
        change_percent: quote.changePercent,
        volume: quote.volume,
        vwap: quote.vwap,
        orb_high: levels.find(l => l.level_type === 'orb_high')?.price || null,
        orb_low: levels.find(l => l.level_type === 'orb_low')?.price || null,
        updated_at: now.toISOString()
      }, { onConflict: 'symbol' });
  }

  return levels;
}

/**
 * GET /api/companion/refresh
 * Check refresh status / API configuration
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isConfigured = marketDataService.isConfigured();

    // Check market status if configured
    let marketStatus = null;
    if (isConfigured) {
      try {
        marketStatus = await marketDataService.getMarketStatus();
      } catch {
        // Ignore errors, just report null
      }
    }

    return NextResponse.json({
      configured: isConfigured,
      marketStatus,
      message: isConfigured
        ? 'Market data API is configured. POST to refresh levels.'
        : 'MASSIVE_API_KEY not configured. Contact admin to enable market data.'
    });

  } catch (error) {
    return NextResponse.json({
      error: 'Internal server error',
      detail: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
