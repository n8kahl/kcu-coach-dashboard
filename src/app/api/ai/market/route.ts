/**
 * Market Intelligence API
 *
 * GET /api/ai/market - Get real-time market data and AI insights
 * POST /api/ai/market - Ask questions about current market conditions
 *
 * Features:
 * - Real-time price data (mock for now, can integrate with data provider)
 * - Key level detection
 * - Patience candle monitoring
 * - Market status (premarket/open/afterhours/closed)
 */

import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import logger from '@/lib/logger';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ============================================
// Types
// ============================================

interface MarketData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  trend: 'bullish' | 'bearish' | 'neutral';
  vwap?: number;
  keyLevels: KeyLevel[];
  patienceCandle?: PatienceCandle;
}

interface KeyLevel {
  type: 'support' | 'resistance' | 'pdh' | 'pdl' | 'orb_high' | 'orb_low' | 'vwap';
  price: number;
  distance: number;
  strength: number;
}

interface PatienceCandle {
  timeframe: string;
  forming: boolean;
  confirmed: boolean;
  direction: 'bullish' | 'bearish';
  timestamp: string;
}

interface MarketStatus {
  status: 'premarket' | 'open' | 'afterhours' | 'closed';
  nextEvent: string;
  nextEventTime: string;
}

// ============================================
// GET - Market Data
// ============================================

export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const symbolsParam = searchParams.get('symbols') || 'SPY,QQQ';
    const symbols = symbolsParam.split(',').map((s) => s.trim().toUpperCase());

    // Get market status
    const marketStatus = getMarketStatus();

    // Get market data for each symbol
    // In production, this would fetch from a real data provider (Polygon, Alpha Vantage, etc.)
    const symbolData = symbols.map((symbol) => getSymbolData(symbol, marketStatus.status));

    return NextResponse.json({
      symbols: symbolData,
      marketStatus,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Market data error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to fetch market data' }, { status: 500 });
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
    const { question, symbols = ['SPY', 'QQQ'] } = body;

    if (!question) {
      return NextResponse.json({ error: 'Question is required' }, { status: 400 });
    }

    // Get current market data
    const marketStatus = getMarketStatus();
    const symbolData = symbols.map((s: string) => getSymbolData(s.toUpperCase(), marketStatus.status));

    // Build context for AI
    const marketContext = symbolData
      .map((d) => `${d.symbol}: $${d.price.toFixed(2)} (${d.changePercent >= 0 ? '+' : ''}${d.changePercent.toFixed(2)}%) - Trend: ${d.trend}
  Key Levels: ${d.keyLevels.map((l) => `${l.type}: $${l.price.toFixed(2)} (${l.distance.toFixed(2)}% away)`).join(', ')}
  Patience Candle: ${d.patienceCandle?.confirmed ? 'Confirmed' : d.patienceCandle?.forming ? 'Forming' : 'None'} on ${d.patienceCandle?.timeframe || 'N/A'}`)
      .join('\n\n');

    // Ask Claude about the market
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      system: `You are a trading coach answering questions about current market conditions. You focus on the LTP Framework (Levels, Trend, Patience).

Current Market Data:
${marketContext}

Market Status: ${marketStatus.status} (${marketStatus.nextEvent} at ${marketStatus.nextEventTime})

Provide concise, actionable insights. Reference specific price levels and technical observations. If asked about setups, evaluate them using the LTP framework.`,
      messages: [{ role: 'user', content: question }],
    });

    const content = response.content[0];
    const answer = content.type === 'text' ? content.text : 'Unable to analyze market data.';

    return NextResponse.json({
      answer,
      marketData: symbolData,
      marketStatus,
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

function getMarketStatus(): MarketStatus {
  const now = new Date();
  const etOffset = -5; // EST offset from UTC (simplified, doesn't handle DST)
  const etHour = (now.getUTCHours() + etOffset + 24) % 24;
  const etMinute = now.getUTCMinutes();
  const dayOfWeek = now.getUTCDay();

  // Weekend check
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return {
      status: 'closed',
      nextEvent: 'Market opens Monday',
      nextEventTime: '9:30 AM ET',
    };
  }

  // Time checks (simplified)
  if (etHour < 4) {
    return {
      status: 'closed',
      nextEvent: 'Premarket opens',
      nextEventTime: '4:00 AM ET',
    };
  }
  if (etHour >= 4 && (etHour < 9 || (etHour === 9 && etMinute < 30))) {
    return {
      status: 'premarket',
      nextEvent: 'Market opens',
      nextEventTime: '9:30 AM ET',
    };
  }
  if ((etHour === 9 && etMinute >= 30) || (etHour > 9 && etHour < 16)) {
    return {
      status: 'open',
      nextEvent: 'Market closes',
      nextEventTime: '4:00 PM ET',
    };
  }
  if (etHour >= 16 && etHour < 20) {
    return {
      status: 'afterhours',
      nextEvent: 'After hours closes',
      nextEventTime: '8:00 PM ET',
    };
  }

  return {
    status: 'closed',
    nextEvent: 'Premarket opens',
    nextEventTime: '4:00 AM ET',
  };
}

function getSymbolData(symbol: string, marketStatus: MarketStatus['status']): MarketData {
  // In production, fetch real data from market data provider
  // For now, return realistic mock data

  const baseData: Record<string, { basePrice: number; baseLevels: number[] }> = {
    SPY: { basePrice: 483.50, baseLevels: [480, 482, 483, 485, 487] },
    QQQ: { basePrice: 418.25, baseLevels: [415, 417, 418, 420, 422] },
    AAPL: { basePrice: 185.50, baseLevels: [183, 185, 187, 190] },
    NVDA: { basePrice: 875.00, baseLevels: [860, 870, 880, 900] },
    MSFT: { basePrice: 405.00, baseLevels: [400, 405, 410, 415] },
    TSLA: { basePrice: 245.00, baseLevels: [240, 245, 250, 255] },
  };

  const data = baseData[symbol] || { basePrice: 100, baseLevels: [98, 100, 102] };

  // Add some randomness for realism (in production, use real data)
  const randomChange = (Math.random() - 0.5) * 4; // -2 to +2
  const price = data.basePrice + randomChange;
  const change = randomChange;
  const changePercent = (change / data.basePrice) * 100;

  // Determine trend
  const trend: 'bullish' | 'bearish' | 'neutral' =
    changePercent > 0.3 ? 'bullish' : changePercent < -0.3 ? 'bearish' : 'neutral';

  // Calculate VWAP (mock - slightly below current price for bullish)
  const vwap = price - (trend === 'bullish' ? 1.5 : trend === 'bearish' ? -1.5 : 0);

  // Generate key levels
  const keyLevels: KeyLevel[] = data.baseLevels.map((levelPrice, idx) => {
    const distance = ((price - levelPrice) / price) * 100;
    const types: KeyLevel['type'][] = ['support', 'vwap', 'resistance', 'pdh', 'pdl'];
    return {
      type: types[idx % types.length],
      price: levelPrice,
      distance: parseFloat(distance.toFixed(2)),
      strength: 70 + Math.floor(Math.random() * 25),
    };
  }).sort((a, b) => Math.abs(a.distance) - Math.abs(b.distance));

  // Patience candle status (mock)
  const patienceCandle: PatienceCandle = {
    timeframe: '15m',
    forming: Math.random() > 0.5,
    confirmed: Math.random() > 0.7,
    direction: trend === 'bearish' ? 'bearish' : 'bullish',
    timestamp: new Date().toISOString(),
  };

  // Adjust for after-hours
  if (marketStatus !== 'open') {
    patienceCandle.forming = false;
    patienceCandle.confirmed = false;
  }

  return {
    symbol,
    price: parseFloat(price.toFixed(2)),
    change: parseFloat(change.toFixed(2)),
    changePercent: parseFloat(changePercent.toFixed(2)),
    trend,
    vwap: parseFloat(vwap.toFixed(2)),
    keyLevels: keyLevels.slice(0, 4),
    patienceCandle,
  };
}
