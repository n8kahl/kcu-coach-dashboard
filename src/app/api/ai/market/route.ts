/**
 * Market Intelligence API
 *
 * GET /api/ai/market - Get real-time market data and AI insights
 * POST /api/ai/market - Ask questions about current market conditions
 *
 * Features:
 * - Real-time price data from Massive.com API
 * - Key level detection (PDH/PDL, VWAP, ORB, EMAs)
 * - Patience candle monitoring
 * - Market status (premarket/open/afterhours/closed)
 * - Historical event data for AI analysis
 */

import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import logger from '@/lib/logger';
import Anthropic from '@anthropic-ai/sdk';
import {
  marketDataService,
  type MarketSnapshot,
  type MarketStatus,
  type KeyLevel,
} from '@/lib/market-data';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ============================================
// Types
// ============================================

interface MarketDataResponse {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  trend: 'bullish' | 'bearish' | 'neutral';
  vwap?: number;
  keyLevels: Array<{
    type: string;
    price: number;
    distance: number;
    strength: number;
  }>;
  patienceCandle?: {
    timeframe: string;
    forming: boolean;
    confirmed: boolean;
    direction: 'bullish' | 'bearish';
  };
}

interface APIMarketStatus {
  status: 'premarket' | 'open' | 'afterhours' | 'closed';
  nextEvent: string;
  nextEventTime: string;
}

// ============================================
// GET - Market Data
// ============================================

export async function GET(request: Request) {
  // Parse symbols outside try block so they're available in catch for logging
  const { searchParams } = new URL(request.url);
  const symbolsParam = searchParams.get('symbols') || 'SPY,QQQ';
  const symbols = symbolsParam.split(',').map((s) => s.trim().toUpperCase());

  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if market data service is configured
    if (!marketDataService.isConfigured()) {
      logger.warn('Market data service not configured - MASSIVE_API_KEY missing');
      return NextResponse.json(
        { error: 'Market data service not configured' },
        { status: 503 }
      );
    }

    // Get market status from real API
    const realMarketStatus = await marketDataService.getMarketStatus();
    const marketStatus = convertMarketStatus(realMarketStatus);

    // Get market snapshots for all symbols from real API
    const snapshots = await marketDataService.getMarketSnapshots(symbols);

    // Get VIX for additional context
    const vix = await marketDataService.getVIX();

    // Convert snapshots to response format
    const symbolData: MarketDataResponse[] = [];
    for (const symbol of symbols) {
      const snapshot = snapshots.get(symbol);
      if (snapshot) {
        symbolData.push(convertSnapshot(snapshot));
      }
    }

    return NextResponse.json({
      symbols: symbolData,
      marketStatus,
      vix,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Market data error', {
      error: errorMessage,
      symbols: symbols.join(','),
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Return more informative error in non-production
    return NextResponse.json({
      error: 'Failed to fetch market data',
      details: process.env.NODE_ENV !== 'production' ? errorMessage : undefined,
    }, { status: 500 });
  }
}

// ============================================
// POST - Market Questions
// ============================================

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { question, symbols = ['SPY', 'QQQ'], eventDate } = body;

    if (!question) {
      return NextResponse.json({ error: 'Question is required' }, { status: 400 });
    }

    // Check if market data service is configured
    if (!marketDataService.isConfigured()) {
      return NextResponse.json(
        { error: 'Market data service not configured' },
        { status: 503 }
      );
    }

    // Get current market data
    const realMarketStatus = await marketDataService.getMarketStatus();
    const marketStatus = convertMarketStatus(realMarketStatus);
    const snapshots = await marketDataService.getMarketSnapshots(
      symbols.map((s: string) => s.toUpperCase())
    );
    const vix = await marketDataService.getVIX();

    // If question mentions historical events, fetch historical data
    let historicalContext = '';
    if (eventDate || question.toLowerCase().includes('fomc') ||
        question.toLowerCase().includes('earnings') ||
        question.toLowerCase().includes('last week') ||
        question.toLowerCase().includes('yesterday')) {

      // Try to extract or infer the date
      let targetDate = eventDate;
      if (!targetDate) {
        // Default to recent events based on question keywords
        if (question.toLowerCase().includes('yesterday')) {
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          targetDate = yesterday.toISOString().split('T')[0];
        } else if (question.toLowerCase().includes('last week')) {
          const lastWeek = new Date();
          lastWeek.setDate(lastWeek.getDate() - 7);
          targetDate = lastWeek.toISOString().split('T')[0];
        }
      }

      if (targetDate) {
        const primarySymbol = symbols[0]?.toUpperCase() || 'SPY';
        const eventBars = await marketDataService.getEventBars(
          primarySymbol,
          targetDate,
          1, // 1 day before
          1, // 1 day after
          'minute',
          5   // 5-minute bars
        );

        if (eventBars.length > 0) {
          const openPrice = eventBars[0].open;
          const closePrice = eventBars[eventBars.length - 1].close;
          const highPrice = Math.max(...eventBars.map(b => b.high));
          const lowPrice = Math.min(...eventBars.map(b => b.low));
          const totalVolume = eventBars.reduce((sum, b) => sum + b.volume, 0);
          const priceChange = closePrice - openPrice;
          const priceChangePercent = ((closePrice - openPrice) / openPrice) * 100;

          historicalContext = `
Historical Data for ${primarySymbol} around ${targetDate}:
- Open: $${openPrice.toFixed(2)}
- High: $${highPrice.toFixed(2)}
- Low: $${lowPrice.toFixed(2)}
- Close: $${closePrice.toFixed(2)}
- Range: $${(highPrice - lowPrice).toFixed(2)} (${((highPrice - lowPrice) / lowPrice * 100).toFixed(2)}%)
- Total Volume: ${(totalVolume / 1000000).toFixed(2)}M
- Price Change: ${priceChange >= 0 ? '+' : ''}$${priceChange.toFixed(2)} (${priceChangePercent >= 0 ? '+' : ''}${priceChangePercent.toFixed(2)}%)
- Data points: ${eventBars.length} 5-minute bars`;
        }
      }
    }

    // Build market context for AI
    const symbolDataList: MarketDataResponse[] = [];
    for (const symbol of symbols.map((s: string) => s.toUpperCase())) {
      const snapshot = snapshots.get(symbol);
      if (snapshot) {
        symbolDataList.push(convertSnapshot(snapshot));
      }
    }

    const marketContext = symbolDataList
      .map((d) => `${d.symbol}: $${d.price.toFixed(2)} (${d.changePercent >= 0 ? '+' : ''}${d.changePercent.toFixed(2)}%) - Trend: ${d.trend}
  Key Levels: ${d.keyLevels.map((l) => `${l.type}: $${l.price.toFixed(2)} (${l.distance.toFixed(2)}% away)`).join(', ')}
  VWAP: $${d.vwap?.toFixed(2) || 'N/A'}
  Patience Candle: ${d.patienceCandle?.confirmed ? 'Confirmed' : d.patienceCandle?.forming ? 'Forming' : 'None'} ${d.patienceCandle ? `(${d.patienceCandle.direction})` : ''}`)
      .join('\n\n');

    // Ask Claude about the market
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 800,
      system: `You are a trading coach answering questions about current market conditions. You focus on the LTP Framework (Levels, Trend, Patience).

Current Market Data (LIVE from Massive.com API):
${marketContext}

VIX (Volatility Index): ${vix.toFixed(2)}
Market Status: ${marketStatus.status} (${marketStatus.nextEvent} at ${marketStatus.nextEventTime})
${historicalContext ? `\n${historicalContext}` : ''}

Provide concise, actionable insights. Reference specific price levels and technical observations. If asked about setups, evaluate them using the LTP framework. When discussing historical events, use the actual price data provided.`,
      messages: [{ role: 'user', content: question }],
    });

    const content = response.content[0];
    const answer = content.type === 'text' ? content.text : 'Unable to analyze market data.';

    return NextResponse.json({
      answer,
      marketData: symbolDataList,
      marketStatus,
      vix,
    });
  } catch (error) {
    logger.error('Market question error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to process question' }, { status: 500 });
  }
}

// ============================================
// Helper Functions
// ============================================

function convertMarketStatus(status: MarketStatus): APIMarketStatus {
  const now = new Date();
  const etOffset = -5; // EST offset from UTC (simplified)
  const etHour = (now.getUTCHours() + etOffset + 24) % 24;
  const dayOfWeek = now.getUTCDay();

  // Convert from service format to API format
  let apiStatus: APIMarketStatus['status'];
  let nextEvent: string;
  let nextEventTime: string;

  if (status.market === 'open') {
    apiStatus = 'open';
    nextEvent = 'Market closes';
    nextEventTime = '4:00 PM ET';
  } else if (status.earlyHours) {
    apiStatus = 'premarket';
    nextEvent = 'Market opens';
    nextEventTime = '9:30 AM ET';
  } else if (status.afterHours) {
    apiStatus = 'afterhours';
    nextEvent = 'After hours closes';
    nextEventTime = '8:00 PM ET';
  } else {
    apiStatus = 'closed';
    // Weekend check
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      nextEvent = 'Market opens Monday';
      nextEventTime = '9:30 AM ET';
    } else if (etHour < 4) {
      nextEvent = 'Premarket opens';
      nextEventTime = '4:00 AM ET';
    } else {
      nextEvent = 'Premarket opens tomorrow';
      nextEventTime = '4:00 AM ET';
    }
  }

  return { status: apiStatus, nextEvent, nextEventTime };
}

function convertSnapshot(snapshot: MarketSnapshot): MarketDataResponse {
  return {
    symbol: snapshot.symbol,
    price: snapshot.quote.price,
    change: snapshot.quote.change,
    changePercent: snapshot.quote.changePercent,
    trend: snapshot.trend,
    vwap: snapshot.vwap,
    keyLevels: snapshot.keyLevels.map((level: KeyLevel) => ({
      type: level.type,
      price: level.price,
      distance: level.distance || 0,
      strength: level.strength,
    })),
    patienceCandle: snapshot.patienceCandle,
  };
}
