/**
 * Market Data Tools for Claude Tool Use
 *
 * Defines tools that allow Claude to query market data from Massive.com/Polygon.io API.
 * These tools wrap the existing marketDataService methods.
 */

import { marketDataService } from './market-data';
import type { Tool } from '@anthropic-ai/sdk/resources/messages';
import logger from './logger';

// ============================================
// Tool Definitions
// ============================================

export const marketDataTools: Tool[] = [
  {
    name: 'get_quote',
    description:
      'Get the current real-time quote for a stock symbol including price, change, volume, VWAP, and OHLC data. Use this for questions about current/today\'s prices.',
    input_schema: {
      type: 'object' as const,
      properties: {
        symbol: {
          type: 'string',
          description: 'Stock ticker symbol (e.g., SPY, AAPL, QQQ, MSFT)',
        },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'get_historical_price',
    description:
      'Get historical OHLCV data for a specific date or date range. Use for questions like "What did X close at on Y date?" or "Show me price action last week". Dates should be in YYYY-MM-DD format.',
    input_schema: {
      type: 'object' as const,
      properties: {
        symbol: {
          type: 'string',
          description: 'Stock ticker symbol',
        },
        from_date: {
          type: 'string',
          description: 'Start date in YYYY-MM-DD format',
        },
        to_date: {
          type: 'string',
          description: 'End date in YYYY-MM-DD format (defaults to from_date for single day)',
        },
        timeframe: {
          type: 'string',
          enum: ['1m', '5m', '15m', '1h', 'day'],
          description: 'Timeframe for bars (default: day for daily OHLCV)',
        },
      },
      required: ['symbol', 'from_date'],
    },
  },
  {
    name: 'get_ltp_analysis',
    description:
      'Get comprehensive LTP (Level, Trend, Patience) framework analysis for a symbol. Returns key levels (PDH/PDL, VWAP, EMAs, SMA200), multi-timeframe trend analysis, patience candle status, and overall setup grade (A+ to F).',
    input_schema: {
      type: 'object' as const,
      properties: {
        symbol: {
          type: 'string',
          description: 'Stock ticker symbol',
        },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'get_mtf_analysis',
    description:
      'Get multi-timeframe trend analysis showing trend direction and EMA alignment across 5m, 15m, 1h, and daily timeframes. Use for questions about trend alignment or conflicting timeframes.',
    input_schema: {
      type: 'object' as const,
      properties: {
        symbol: {
          type: 'string',
          description: 'Stock ticker symbol',
        },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'get_key_levels',
    description:
      'Get key support/resistance levels including PDH, PDL, VWAP, Opening Range Breakout (ORB) levels, EMA9, EMA21, and SMA200. Shows distance from current price.',
    input_schema: {
      type: 'object' as const,
      properties: {
        symbol: {
          type: 'string',
          description: 'Stock ticker symbol',
        },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'get_market_context',
    description:
      'Get overall market context including market status (open/closed/extended hours), VIX level, volatility assessment, and upcoming economic events (FOMC, CPI, NFP, etc.).',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_technical_indicator',
    description:
      'Get technical indicator values (SMA, EMA, RSI, MACD) for a symbol. Specify the indicator type and optional parameters like period.',
    input_schema: {
      type: 'object' as const,
      properties: {
        symbol: {
          type: 'string',
          description: 'Stock ticker symbol',
        },
        indicator: {
          type: 'string',
          enum: ['sma', 'ema', 'rsi', 'macd'],
          description: 'Type of technical indicator',
        },
        period: {
          type: 'number',
          description: 'Period for the indicator (default: SMA/EMA=20, RSI=14)',
        },
        timeframe: {
          type: 'string',
          enum: ['minute', 'hour', 'day'],
          description: 'Timeframe for calculation (default: day)',
        },
      },
      required: ['symbol', 'indicator'],
    },
  },
];

// ============================================
// Tool Executors
// ============================================

interface ToolInput {
  symbol?: string;
  from_date?: string;
  to_date?: string;
  timeframe?: string;
  indicator?: string;
  period?: number;
}

/**
 * Execute a market data tool and return the result as a string
 */
export async function executeMarketDataTool(
  toolName: string,
  input: ToolInput
): Promise<string> {
  // Check if service is configured
  if (!marketDataService.isConfigured()) {
    return JSON.stringify({
      error: 'Market data service not configured',
      message: 'Real-time market data is not available. The MASSIVE_API_KEY environment variable is not set.',
    });
  }

  try {
    switch (toolName) {
      case 'get_quote':
        return await executeGetQuote(input.symbol!);

      case 'get_historical_price':
        return await executeGetHistoricalPrice(input);

      case 'get_ltp_analysis':
        return await executeGetLTPAnalysis(input.symbol!);

      case 'get_mtf_analysis':
        return await executeGetMTFAnalysis(input.symbol!);

      case 'get_key_levels':
        return await executeGetKeyLevels(input.symbol!);

      case 'get_market_context':
        return await executeGetMarketContext();

      case 'get_technical_indicator':
        return await executeGetTechnicalIndicator(input);

      default:
        return JSON.stringify({ error: `Unknown tool: ${toolName}` });
    }
  } catch (error) {
    logger.error('Market data tool execution error', {
      tool: toolName,
      input,
      error: error instanceof Error ? error.message : String(error),
    });
    return JSON.stringify({
      error: 'Tool execution failed',
      message: `Unable to fetch market data: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }
}

// ============================================
// Individual Tool Implementations
// ============================================

async function executeGetQuote(symbol: string): Promise<string> {
  const quote = await marketDataService.getQuote(symbol.toUpperCase());

  if (!quote) {
    return JSON.stringify({
      error: 'No data available',
      message: `Could not find quote data for ${symbol.toUpperCase()}`,
    });
  }

  return JSON.stringify({
    symbol: quote.symbol,
    price: quote.price,
    change: quote.change,
    changePercent: quote.changePercent,
    open: quote.open,
    high: quote.high,
    low: quote.low,
    close: quote.close,
    volume: quote.volume,
    vwap: quote.vwap,
    prevClose: quote.prevClose,
    timestamp: quote.timestamp,
  });
}

async function executeGetHistoricalPrice(input: ToolInput): Promise<string> {
  const symbol = input.symbol!.toUpperCase();
  const fromDate = input.from_date!;
  const toDate = input.to_date || fromDate;

  // Parse timeframe to multiplier
  let timespan = 'day';
  let multiplier = 1;

  if (input.timeframe) {
    switch (input.timeframe) {
      case '1m':
        timespan = 'minute';
        multiplier = 1;
        break;
      case '5m':
        timespan = 'minute';
        multiplier = 5;
        break;
      case '15m':
        timespan = 'minute';
        multiplier = 15;
        break;
      case '1h':
        timespan = 'hour';
        multiplier = 1;
        break;
      case 'day':
      default:
        timespan = 'day';
        multiplier = 1;
    }
  }

  const bars = await marketDataService.getHistoricalBars(
    symbol,
    fromDate,
    toDate,
    timespan,
    multiplier
  );

  if (!bars || bars.length === 0) {
    return JSON.stringify({
      error: 'No data available',
      message: `No historical data found for ${symbol} from ${fromDate} to ${toDate}. This might be a weekend or holiday.`,
    });
  }

  // For single day queries, return summarized data
  if (fromDate === toDate && bars.length > 0) {
    const dayBars = bars;
    const open = dayBars[0].open;
    const close = dayBars[dayBars.length - 1].close;
    const high = Math.max(...dayBars.map((b) => b.high));
    const low = Math.min(...dayBars.map((b) => b.low));
    const volume = dayBars.reduce((sum, b) => sum + b.volume, 0);
    const change = close - open;
    const changePercent = ((close - open) / open) * 100;

    return JSON.stringify({
      symbol,
      date: fromDate,
      open,
      high,
      low,
      close,
      volume,
      change,
      changePercent,
      barCount: bars.length,
    });
  }

  // For range queries, return summary and key data points
  const open = bars[0].open;
  const close = bars[bars.length - 1].close;
  const high = Math.max(...bars.map((b) => b.high));
  const low = Math.min(...bars.map((b) => b.low));
  const totalVolume = bars.reduce((sum, b) => sum + b.volume, 0);

  return JSON.stringify({
    symbol,
    fromDate,
    toDate,
    open,
    high,
    low,
    close,
    totalVolume,
    change: close - open,
    changePercent: ((close - open) / open) * 100,
    barCount: bars.length,
    // Include first and last few bars for context
    firstBar: bars[0],
    lastBar: bars[bars.length - 1],
  });
}

async function executeGetLTPAnalysis(symbol: string): Promise<string> {
  const analysis = await marketDataService.getLTPAnalysis(symbol.toUpperCase());

  if (!analysis) {
    return JSON.stringify({
      error: 'No data available',
      message: `Could not generate LTP analysis for ${symbol.toUpperCase()}`,
    });
  }

  return JSON.stringify({
    symbol: analysis.symbol,
    timestamp: analysis.timestamp,
    grade: analysis.grade,
    setupQuality: analysis.setupQuality,
    confluenceScore: analysis.confluenceScore,
    recommendation: analysis.recommendation,
    levels: {
      score: analysis.levels.levelScore,
      position: analysis.levels.pricePosition,
      proximity: analysis.levels.levelProximity,
      pdh: analysis.levels.pdh,
      pdl: analysis.levels.pdl,
      vwap: analysis.levels.vwap,
      orbHigh: analysis.levels.orbHigh,
      orbLow: analysis.levels.orbLow,
      ema9: analysis.levels.ema9,
      ema21: analysis.levels.ema21,
      sma200: analysis.levels.sma200,
      priceVsSma200: analysis.levels.priceVsSma200,
    },
    trend: {
      score: analysis.trend.trendScore,
      daily: analysis.trend.dailyTrend,
      intraday: analysis.trend.intradayTrend,
      alignment: analysis.trend.trendAlignment,
      currentPrice: analysis.trend.mtf.currentPrice,
      overallBias: analysis.trend.mtf.overallBias,
      alignmentScore: analysis.trend.mtf.alignmentScore,
      conflictingTimeframes: analysis.trend.mtf.conflictingTimeframes,
    },
    patience: {
      score: analysis.patience.patienceScore,
      candle5m: analysis.patience.candle5m,
      candle15m: analysis.patience.candle15m,
      candle1h: analysis.patience.candle1h,
    },
  });
}

async function executeGetMTFAnalysis(symbol: string): Promise<string> {
  const analysis = await marketDataService.getMTFAnalysis(symbol.toUpperCase());

  if (!analysis) {
    return JSON.stringify({
      error: 'No data available',
      message: `Could not generate MTF analysis for ${symbol.toUpperCase()}`,
    });
  }

  return JSON.stringify({
    symbol: analysis.symbol,
    currentPrice: analysis.currentPrice,
    overallBias: analysis.overallBias,
    alignmentScore: analysis.alignmentScore,
    conflictingTimeframes: analysis.conflictingTimeframes,
    timeframes: analysis.timeframes.map((tf) => ({
      timeframe: tf.timeframe,
      trend: tf.trend,
      ema9: tf.ema9,
      ema21: tf.ema21,
      priceVsEma9: tf.priceVsEma9,
      priceVsEma21: tf.priceVsEma21,
      emaAlignment: tf.emaAlignment,
    })),
  });
}

async function executeGetKeyLevels(symbol: string): Promise<string> {
  const levels = await marketDataService.getKeyLevels(symbol.toUpperCase());
  const quote = await marketDataService.getQuote(symbol.toUpperCase());

  if (!levels || levels.length === 0) {
    return JSON.stringify({
      error: 'No data available',
      message: `Could not find key levels for ${symbol.toUpperCase()}`,
    });
  }

  const currentPrice = quote?.price || 0;

  return JSON.stringify({
    symbol: symbol.toUpperCase(),
    currentPrice,
    levels: levels.map((level) => ({
      type: level.type,
      price: level.price,
      strength: level.strength,
      distance: level.distance,
      distancePercent: currentPrice > 0 ? ((level.price - currentPrice) / currentPrice) * 100 : 0,
    })),
  });
}

async function executeGetMarketContext(): Promise<string> {
  const context = await marketDataService.getMarketContext();

  return JSON.stringify({
    marketStatus: context.marketStatus.market,
    isAfterHours: context.marketStatus.afterHours,
    isPremarket: context.marketStatus.earlyHours,
    vix: context.vix,
    volatilityLevel: context.volatilityLevel,
    highImpactToday: context.highImpactToday,
    upcomingEvents: context.upcomingEvents.slice(0, 5).map((e) => ({
      date: e.date,
      time: e.time,
      event: e.event,
      impact: e.impact,
    })),
  });
}

async function executeGetTechnicalIndicator(input: ToolInput): Promise<string> {
  const symbol = input.symbol!.toUpperCase();
  const indicator = input.indicator!.toLowerCase();
  const period = input.period;
  const timeframe = input.timeframe || 'day';

  switch (indicator) {
    case 'sma': {
      const result = await marketDataService.getSMA(symbol, period || 20, timeframe, 10);
      if (!result || result.values.length === 0) {
        return JSON.stringify({ error: 'No data available', message: `Could not calculate SMA for ${symbol}` });
      }
      const latest = result.values[result.values.length - 1];
      return JSON.stringify({
        symbol,
        indicator: 'SMA',
        period: result.period,
        timeframe,
        currentValue: latest.value,
        timestamp: new Date(latest.timestamp).toISOString(),
      });
    }

    case 'ema': {
      const result = await marketDataService.getEMA(symbol, period || 9, timeframe, 10);
      if (!result || result.values.length === 0) {
        return JSON.stringify({ error: 'No data available', message: `Could not calculate EMA for ${symbol}` });
      }
      const latest = result.values[result.values.length - 1];
      return JSON.stringify({
        symbol,
        indicator: 'EMA',
        period: result.period,
        timeframe,
        currentValue: latest.value,
        timestamp: new Date(latest.timestamp).toISOString(),
      });
    }

    case 'rsi': {
      const result = await marketDataService.getRSI(symbol, period || 14, timeframe, 10);
      if (!result || result.values.length === 0) {
        return JSON.stringify({ error: 'No data available', message: `Could not calculate RSI for ${symbol}` });
      }
      const latest = result.values[result.values.length - 1];
      const rsiValue = latest.value;
      const condition = rsiValue > 70 ? 'overbought' : rsiValue < 30 ? 'oversold' : 'neutral';
      return JSON.stringify({
        symbol,
        indicator: 'RSI',
        period: result.period,
        timeframe,
        currentValue: rsiValue,
        condition,
        timestamp: new Date(latest.timestamp).toISOString(),
      });
    }

    case 'macd': {
      const result = await marketDataService.getMACD(symbol, timeframe);
      if (!result || result.values.length === 0) {
        return JSON.stringify({ error: 'No data available', message: `Could not calculate MACD for ${symbol}` });
      }
      const latest = result.values[result.values.length - 1];
      return JSON.stringify({
        symbol,
        indicator: 'MACD',
        timeframe,
        macd: latest.macd,
        signal: latest.signal,
        histogram: latest.histogram,
        crossover: latest.histogram > 0 ? 'bullish' : 'bearish',
        timestamp: new Date(latest.timestamp).toISOString(),
      });
    }

    default:
      return JSON.stringify({ error: 'Unknown indicator', message: `Indicator "${indicator}" is not supported` });
  }
}

// ============================================
// Helper Functions
// ============================================

/**
 * Get the list of market data tools for Claude API
 */
export function getMarketDataTools(): Tool[] {
  return marketDataTools;
}
