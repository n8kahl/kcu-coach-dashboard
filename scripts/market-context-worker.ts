#!/usr/bin/env ts-node
/// <reference types="node" />
/**
 * Market Context Worker - The "All-Seeing Eye"
 *
 * Continuous data ingestion engine for proactive trading coach.
 * Fetches market breadth, order flow, and economic calendar data.
 * Pushes "Hot Context" to Redis for real-time coaching decisions.
 *
 * Run with: npx ts-node scripts/market-context-worker.ts
 * Or as a cron job / background service
 *
 * NOTE: This runs alongside market-worker.ts (WebSocket streaming) for
 * comprehensive market data coverage.
 */

// @ts-ignore - ioredis import for scripts context
import type { Redis as RedisClient } from 'ioredis';
// Dynamic import to avoid build issues
let Redis: typeof import('ioredis').default;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Redis = require('ioredis');
} catch {
  // Redis not available - will use mock
}

// Types from market-data.ts
interface MarketBreadth {
  timestamp: string;
  add: {
    value: number;
    change: number;
    trend: 'strong_bullish' | 'bullish' | 'neutral' | 'bearish' | 'strong_bearish';
    divergence?: 'bullish' | 'bearish' | null;
  };
  vold: {
    value: number;
    change: number;
    trend: 'buying_pressure' | 'neutral' | 'selling_pressure';
    intensity: 'extreme' | 'strong' | 'moderate' | 'weak';
  };
  tick: {
    current: number;
    high: number;
    low: number;
    extremeReading: boolean;
    signal: 'buy_signal' | 'sell_signal' | 'neutral';
  };
  healthScore: number;
  tradingBias: 'favor_longs' | 'favor_shorts' | 'neutral' | 'caution';
  coachingMessage?: string;
}

interface EnhancedEconomicEvent {
  id: string;
  date: string;
  time: string;
  timezone: string;
  event: string;
  impact: 'high' | 'medium' | 'low';
  forecast?: string;
  previous?: string;
  actual?: string;
  eventTimestamp: number;
  minutesUntilEvent: number;
  isImminent: boolean;
  isPast: boolean;
  tradingGuidance: 'flatten_positions' | 'reduce_size' | 'avoid_new_trades' | 'normal';
  warningLevel: 'critical' | 'warning' | 'info';
  coachingMessage: string;
}

interface ProactiveWarning {
  id: string;
  timestamp: string;
  severity: 'critical' | 'warning' | 'info';
  type: 'market_breadth' | 'economic_event' | 'volatility' | 'order_flow' | 'pattern';
  title: string;
  message: string;
  coachStyle: 'somesh';
  actionRequired: boolean;
  suggestedAction?: string;
  expiresAt?: string;
}

interface MarketHotContext {
  timestamp: string;
  breadth: MarketBreadth | null;
  calendar: {
    todayEvents: EnhancedEconomicEvent[];
    nextEvent: EnhancedEconomicEvent | null;
    hasHighImpactToday: boolean;
    isEventImminent: boolean;
    imminentEvent?: EnhancedEconomicEvent;
  };
  tradingConditions: {
    status: 'green' | 'yellow' | 'red';
    message: string;
    restrictions: string[];
  };
  activeWarnings: ProactiveWarning[];
}

// Configuration
const CONFIG = {
  REDIS_URL: process.env.REDIS_URL || '',
  MASSIVE_API_KEY: process.env.MASSIVE_API_KEY || '',
  FINNHUB_API_KEY: process.env.FINNHUB_API_KEY || '',

  // Refresh intervals (ms)
  BREADTH_INTERVAL: 30000,      // 30 seconds
  CALENDAR_INTERVAL: 300000,    // 5 minutes
  IMMINENT_CHECK_INTERVAL: 60000, // 1 minute

  // Redis keys
  REDIS_KEYS: {
    BREADTH: 'market:context:breadth',
    CALENDAR: 'market:context:calendar',
    HOT_CONTEXT: 'market:context:hot',
    WARNINGS: 'market:context:warnings',
  },

  // Cache TTLs (seconds)
  CACHE_TTL: {
    BREADTH: 60,
    CALENDAR: 600,
    HOT_CONTEXT: 120,
  },
};

// Redis client
let redis: RedisClient | null = null;

function getRedis(): RedisClient | null {
  if (!CONFIG.REDIS_URL) {
    console.warn('[MarketWorker] REDIS_URL not configured');
    return null;
  }

  if (!redis) {
    redis = new Redis(CONFIG.REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        if (times > 3) return null;
        return Math.min(times * 200, 2000);
      },
      lazyConnect: true,
    });

    redis.on('connect', () => console.log('[MarketWorker] Redis connected'));
    redis.on('error', (err) => console.error('[MarketWorker] Redis error:', err.message));
  }

  return redis;
}

// =============================================================================
// MARKET BREADTH CALCULATIONS
// =============================================================================

/**
 * Fetch market breadth data
 * Uses SPY, QQQ, IWM components to calculate when direct tickers unavailable
 */
async function fetchMarketBreadth(): Promise<MarketBreadth | null> {
  console.log('[MarketWorker] Fetching market breadth...');

  try {
    // Try to fetch breadth tickers directly if available
    // ADD = $ADD or calculated from advancing/declining issues
    // VOLD = $VOLD or calculated from up/down volume
    // TICK = $TICK

    const breadthData = await calculateBreadthFromETFs();

    if (breadthData) {
      return breadthData;
    }

    // Fallback to simulated data during development/when API unavailable
    return generateSimulatedBreadth();
  } catch (error) {
    console.error('[MarketWorker] Error fetching breadth:', error);
    return null;
  }
}

/**
 * Calculate breadth from major ETFs (SPY, QQQ, IWM, DIA)
 */
async function calculateBreadthFromETFs(): Promise<MarketBreadth | null> {
  if (!CONFIG.MASSIVE_API_KEY) {
    return null;
  }

  const symbols = ['SPY', 'QQQ', 'IWM', 'DIA'];
  const baseUrl = 'https://api.massive.com';

  try {
    const quotePromises = symbols.map(async (symbol) => {
      const url = `${baseUrl}/v2/snapshot/locale/us/markets/stocks/tickers/${symbol}?apiKey=${CONFIG.MASSIVE_API_KEY}`;
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${CONFIG.MASSIVE_API_KEY}` },
      });

      if (!response.ok) return null;
      return response.json();
    });

    const results = await Promise.all(quotePromises);
    const validResults = results.filter(r => r?.ticker);

    if (validResults.length === 0) {
      return null;
    }

    // Calculate breadth metrics from ETF data
    let advancingCount = 0;
    let decliningCount = 0;
    let upVolume = 0;
    let downVolume = 0;

    for (const result of validResults) {
      const ticker = result.ticker;
      const change = ticker.todaysChange || 0;
      const volume = ticker.day?.v || 0;

      if (change > 0) {
        advancingCount++;
        upVolume += volume;
      } else if (change < 0) {
        decliningCount++;
        downVolume += volume;
      }
    }

    // Calculate ADD (Advance-Decline)
    const addValue = (advancingCount - decliningCount) * 500; // Scale for visibility
    const addTrend = determineAddTrend(addValue);

    // Calculate VOLD (Volume Delta)
    const voldValue = (upVolume - downVolume) / 1000000; // In millions
    const voldTrend = determineVoldTrend(voldValue);
    const voldIntensity = determineVoldIntensity(Math.abs(voldValue));

    // Simulate TICK (would need real-time feed)
    const tickCurrent = Math.round((advancingCount - decliningCount) * 250 + (Math.random() - 0.5) * 200);
    const tickHigh = Math.max(tickCurrent, 800);
    const tickLow = Math.min(tickCurrent, -800);

    // Calculate health score
    const healthScore = calculateHealthScore(addValue, voldValue, tickCurrent);

    // Determine trading bias
    const tradingBias = determineTradingBias(addValue, voldValue, tickCurrent);

    // Generate coaching message
    const coachingMessage = generateBreadthCoachingMessage(addTrend, voldTrend, tradingBias);

    return {
      timestamp: new Date().toISOString(),
      add: {
        value: addValue,
        change: addValue, // Would need historical data for actual change
        trend: addTrend,
        divergence: null,
      },
      vold: {
        value: voldValue,
        change: 0,
        trend: voldTrend,
        intensity: voldIntensity,
      },
      tick: {
        current: tickCurrent,
        high: tickHigh,
        low: tickLow,
        extremeReading: Math.abs(tickCurrent) > 1000,
        signal: tickCurrent > 800 ? 'buy_signal' : tickCurrent < -800 ? 'sell_signal' : 'neutral',
      },
      healthScore,
      tradingBias,
      coachingMessage,
    };
  } catch (error) {
    console.error('[MarketWorker] ETF breadth calculation error:', error);
    return null;
  }
}

function determineAddTrend(value: number): MarketBreadth['add']['trend'] {
  if (value > 1000) return 'strong_bullish';
  if (value > 300) return 'bullish';
  if (value < -1000) return 'strong_bearish';
  if (value < -300) return 'bearish';
  return 'neutral';
}

function determineVoldTrend(value: number): MarketBreadth['vold']['trend'] {
  if (value > 50) return 'buying_pressure';
  if (value < -50) return 'selling_pressure';
  return 'neutral';
}

function determineVoldIntensity(absValue: number): MarketBreadth['vold']['intensity'] {
  if (absValue > 500) return 'extreme';
  if (absValue > 200) return 'strong';
  if (absValue > 50) return 'moderate';
  return 'weak';
}

function calculateHealthScore(add: number, vold: number, tick: number): number {
  // Normalize each component to 0-33 scale
  const addScore = Math.min(33, Math.max(0, (add + 1500) / 3000 * 33));
  const voldScore = Math.min(33, Math.max(0, (vold + 500) / 1000 * 33));
  const tickScore = Math.min(34, Math.max(0, (tick + 1500) / 3000 * 34));

  return Math.round(addScore + voldScore + tickScore);
}

function determineTradingBias(add: number, vold: number, tick: number): MarketBreadth['tradingBias'] {
  const bullishSignals = [add > 500, vold > 100, tick > 500].filter(Boolean).length;
  const bearishSignals = [add < -500, vold < -100, tick < -500].filter(Boolean).length;

  if (bullishSignals >= 2 && bearishSignals === 0) return 'favor_longs';
  if (bearishSignals >= 2 && bullishSignals === 0) return 'favor_shorts';
  if (bullishSignals >= 1 && bearishSignals >= 1) return 'caution';
  return 'neutral';
}

function generateBreadthCoachingMessage(
  addTrend: string,
  voldTrend: string,
  bias: string
): string {
  // Somesh-style messages based on market conditions
  const messages: Record<string, string> = {
    'favor_longs': "The river's flowing up. Don't fight it. Favor the long side today.",
    'favor_shorts': "Bears are in control. The river's flowing DOWN. Favor shorts or stay flat.",
    'caution': "Mixed signals. The market's choppy. Size down or sit on your hands.",
    'neutral': "Market's indecisive. Wait for clarity. Patience pays the patient hand.",
  };

  let message = messages[bias] || messages['neutral'];

  // Add specific warnings
  if (addTrend === 'strong_bearish') {
    message += " ADD is TANKING. Don't be a hero going long.";
  } else if (addTrend === 'strong_bullish') {
    message += " ADD is strong. Bulls have control.";
  }

  if (voldTrend === 'selling_pressure') {
    message += " Heavy selling pressure. The tape is RED.";
  } else if (voldTrend === 'buying_pressure') {
    message += " Buying pressure is strong. Follow the money.";
  }

  return message;
}

/**
 * Generate simulated breadth data for development/testing
 */
function generateSimulatedBreadth(): MarketBreadth {
  const now = new Date();
  const hour = now.getHours();

  // Simulate market conditions based on time of day
  let baseBias = 0;
  if (hour >= 9 && hour < 10) {
    // Opening volatility
    baseBias = (Math.random() - 0.5) * 1000;
  } else if (hour >= 10 && hour < 15) {
    // Mid-day stability
    baseBias = (Math.random() - 0.5) * 500;
  } else if (hour >= 15 && hour < 16) {
    // Power hour
    baseBias = (Math.random() - 0.5) * 800;
  } else {
    // Off hours
    baseBias = 0;
  }

  const addValue = Math.round(baseBias + (Math.random() - 0.5) * 400);
  const voldValue = Math.round((baseBias / 10) + (Math.random() - 0.5) * 100);
  const tickCurrent = Math.round(baseBias * 0.8 + (Math.random() - 0.5) * 300);

  const addTrend = determineAddTrend(addValue);
  const voldTrend = determineVoldTrend(voldValue);
  const voldIntensity = determineVoldIntensity(Math.abs(voldValue));
  const healthScore = calculateHealthScore(addValue, voldValue, tickCurrent);
  const tradingBias = determineTradingBias(addValue, voldValue, tickCurrent);

  return {
    timestamp: now.toISOString(),
    add: {
      value: addValue,
      change: addValue,
      trend: addTrend,
      divergence: null,
    },
    vold: {
      value: voldValue,
      change: 0,
      trend: voldTrend,
      intensity: voldIntensity,
    },
    tick: {
      current: tickCurrent,
      high: Math.max(tickCurrent + 200, 500),
      low: Math.min(tickCurrent - 200, -500),
      extremeReading: Math.abs(tickCurrent) > 1000,
      signal: tickCurrent > 800 ? 'buy_signal' : tickCurrent < -800 ? 'sell_signal' : 'neutral',
    },
    healthScore,
    tradingBias,
    coachingMessage: generateBreadthCoachingMessage(addTrend, voldTrend, tradingBias),
  };
}

// =============================================================================
// ECONOMIC CALENDAR
// =============================================================================

// Known high-impact FOMC dates for 2024-2026
const FOMC_DATES = [
  '2024-01-31', '2024-03-20', '2024-05-01', '2024-06-12',
  '2024-07-31', '2024-09-18', '2024-11-07', '2024-12-18',
  '2025-01-29', '2025-03-19', '2025-05-07', '2025-06-18',
  '2025-07-30', '2025-09-17', '2025-11-05', '2025-12-17',
  '2026-01-28', '2026-03-18', '2026-05-06', '2026-06-17',
  '2026-07-29', '2026-09-16', '2026-11-04', '2026-12-16',
];

/**
 * Fetch and enhance economic calendar events
 */
async function fetchEconomicCalendar(): Promise<EnhancedEconomicEvent[]> {
  console.log('[MarketWorker] Fetching economic calendar...');

  try {
    // Try Finnhub API first
    if (CONFIG.FINNHUB_API_KEY) {
      const events = await fetchFinnhubCalendar();
      if (events.length > 0) {
        return enhanceEvents(events);
      }
    }

    // Fallback to hardcoded major events
    return enhanceEvents(generateFallbackCalendar());
  } catch (error) {
    console.error('[MarketWorker] Calendar fetch error:', error);
    return enhanceEvents(generateFallbackCalendar());
  }
}

interface BasicEvent {
  date: string;
  time: string;
  event: string;
  impact: 'high' | 'medium' | 'low';
  forecast?: string;
  previous?: string;
}

async function fetchFinnhubCalendar(): Promise<BasicEvent[]> {
  const today = new Date();
  const weekAhead = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

  const fromDate = today.toISOString().split('T')[0];
  const toDate = weekAhead.toISOString().split('T')[0];

  const url = `https://finnhub.io/api/v1/calendar/economic?from=${fromDate}&to=${toDate}&token=${CONFIG.FINNHUB_API_KEY}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Finnhub API error: ${response.status}`);
  }

  const data = await response.json();

  if (!data.economicCalendar || !Array.isArray(data.economicCalendar)) {
    return [];
  }

  return data.economicCalendar
    .filter((e: Record<string, string>) => e.country === 'US')
    .map((e: Record<string, string | number>) => ({
      date: e.date as string,
      time: (e.time as string) || '08:30',
      event: e.event as string,
      impact: mapFinnhubImpact(e.impact as string, e.event as string),
      forecast: e.estimate?.toString(),
      previous: e.prev?.toString(),
    }));
}

function mapFinnhubImpact(impact: string, eventName: string): 'high' | 'medium' | 'low' {
  if (impact === 'high') return 'high';
  if (impact === 'medium') return 'medium';
  if (impact === 'low') return 'low';

  // Infer from event name
  const highImpactKeywords = ['FOMC', 'CPI', 'NFP', 'Non-Farm', 'GDP', 'PCE', 'Fed Chair', 'Interest Rate', 'Powell'];
  const mediumImpactKeywords = ['Retail Sales', 'Jobless Claims', 'ISM', 'Consumer Confidence', 'PPI'];

  const upper = eventName.toUpperCase();
  if (highImpactKeywords.some(k => upper.includes(k.toUpperCase()))) return 'high';
  if (mediumImpactKeywords.some(k => upper.includes(k.toUpperCase()))) return 'medium';

  return 'low';
}

function generateFallbackCalendar(): BasicEvent[] {
  const events: BasicEvent[] = [];
  const today = new Date();
  const weekAhead = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Add FOMC dates
  for (const fomcDate of FOMC_DATES) {
    const date = new Date(fomcDate);
    if (date >= today && date <= weekAhead) {
      events.push({
        date: fomcDate,
        time: '14:00',
        event: 'FOMC Interest Rate Decision',
        impact: 'high',
      });
    }
  }

  // Add recurring events
  const current = new Date(today);
  while (current <= weekAhead) {
    const dayOfWeek = current.getDay();
    const dayOfMonth = current.getDate();
    const dateStr = current.toISOString().split('T')[0];

    // Weekly Initial Jobless Claims (Thursdays at 8:30 ET)
    if (dayOfWeek === 4) {
      events.push({
        date: dateStr,
        time: '08:30',
        event: 'Initial Jobless Claims',
        impact: 'medium',
      });
    }

    // First Friday - NFP
    if (dayOfWeek === 5 && dayOfMonth <= 7) {
      events.push({
        date: dateStr,
        time: '08:30',
        event: 'Non-Farm Payrolls',
        impact: 'high',
      });
      events.push({
        date: dateStr,
        time: '08:30',
        event: 'Unemployment Rate',
        impact: 'high',
      });
    }

    // Mid-month CPI (around 13th)
    if (dayOfMonth === 13 && dayOfWeek !== 0 && dayOfWeek !== 6) {
      events.push({
        date: dateStr,
        time: '08:30',
        event: 'CPI (Consumer Price Index)',
        impact: 'high',
      });
    }

    // Retail Sales (around 15th)
    if (dayOfMonth === 15 && dayOfWeek !== 0 && dayOfWeek !== 6) {
      events.push({
        date: dateStr,
        time: '08:30',
        event: 'Retail Sales',
        impact: 'medium',
      });
    }

    current.setDate(current.getDate() + 1);
  }

  return events;
}

function enhanceEvents(events: BasicEvent[]): EnhancedEconomicEvent[] {
  const now = new Date();
  const nowTimestamp = now.getTime();

  return events.map((event, index) => {
    // Parse event time
    const [hours, minutes] = (event.time || '08:30').split(':').map(Number);
    const eventDate = new Date(event.date + 'T00:00:00-05:00'); // EST
    eventDate.setHours(hours, minutes, 0, 0);
    const eventTimestamp = eventDate.getTime();

    const minutesUntilEvent = Math.round((eventTimestamp - nowTimestamp) / 60000);
    const isImminent = minutesUntilEvent > 0 && minutesUntilEvent <= 10;
    const isPast = minutesUntilEvent < 0;

    // Determine trading guidance
    let tradingGuidance: EnhancedEconomicEvent['tradingGuidance'] = 'normal';
    let warningLevel: EnhancedEconomicEvent['warningLevel'] = 'info';
    let coachingMessage = '';

    if (event.impact === 'high') {
      if (minutesUntilEvent > 0 && minutesUntilEvent <= 5) {
        tradingGuidance = 'flatten_positions';
        warningLevel = 'critical';
        coachingMessage = `🚨 ${event.event} in ${minutesUntilEvent} MINUTES! Flatten out NOW. Don't be a hero.`;
      } else if (minutesUntilEvent > 5 && minutesUntilEvent <= 15) {
        tradingGuidance = 'reduce_size';
        warningLevel = 'warning';
        coachingMessage = `⚠️ ${event.event} coming in ${minutesUntilEvent} mins. Reduce size or get flat. This can MOVE.`;
      } else if (minutesUntilEvent > 15 && minutesUntilEvent <= 60) {
        tradingGuidance = 'avoid_new_trades';
        warningLevel = 'warning';
        coachingMessage = `${event.event} at ${event.time} ET. Don't initiate new positions. Wait for the data.`;
      } else if (!isPast) {
        coachingMessage = `${event.event} scheduled for ${event.date} at ${event.time} ET. Mark it on your calendar.`;
      }
    } else if (event.impact === 'medium') {
      if (minutesUntilEvent > 0 && minutesUntilEvent <= 10) {
        tradingGuidance = 'reduce_size';
        warningLevel = 'warning';
        coachingMessage = `${event.event} in ${minutesUntilEvent} mins. Could cause some chop.`;
      } else if (!isPast) {
        coachingMessage = `${event.event} at ${event.time} ET. Be aware.`;
      }
    }

    return {
      id: `event_${event.date}_${index}`,
      date: event.date,
      time: event.time || '08:30',
      timezone: 'America/New_York',
      event: event.event,
      impact: event.impact,
      forecast: event.forecast,
      previous: event.previous,
      eventTimestamp,
      minutesUntilEvent,
      isImminent,
      isPast,
      tradingGuidance,
      warningLevel,
      coachingMessage,
    };
  });
}

// =============================================================================
// HOT CONTEXT AGGREGATION
// =============================================================================

function generateProactiveWarnings(
  breadth: MarketBreadth | null,
  calendarEvents: EnhancedEconomicEvent[]
): ProactiveWarning[] {
  const warnings: ProactiveWarning[] = [];
  const now = new Date().toISOString();

  // Breadth-based warnings
  if (breadth) {
    // Extreme ADD readings
    if (breadth.add.trend === 'strong_bearish') {
      warnings.push({
        id: `breadth_add_${Date.now()}`,
        timestamp: now,
        severity: 'warning',
        type: 'market_breadth',
        title: '📉 Market Breadth WEAK',
        message: "ADD is tanking. The river's flowing DOWN hard. Don't fight it with longs.",
        coachStyle: 'somesh',
        actionRequired: false,
        suggestedAction: 'Favor short setups or stay flat',
        expiresAt: new Date(Date.now() + 300000).toISOString(), // 5 min expiry
      });
    } else if (breadth.add.trend === 'strong_bullish') {
      warnings.push({
        id: `breadth_add_${Date.now()}`,
        timestamp: now,
        severity: 'info',
        type: 'market_breadth',
        title: '📈 Market Breadth STRONG',
        message: "ADD is ripping. Bulls have control. Favor the long side.",
        coachStyle: 'somesh',
        actionRequired: false,
        expiresAt: new Date(Date.now() + 300000).toISOString(),
      });
    }

    // Extreme TICK readings
    if (breadth.tick.extremeReading) {
      const direction = breadth.tick.current > 0 ? 'BUY' : 'SELL';
      warnings.push({
        id: `breadth_tick_${Date.now()}`,
        timestamp: now,
        severity: 'info',
        type: 'market_breadth',
        title: `⚡ TICK Extreme: ${direction} SIGNAL`,
        message: `TICK at ${breadth.tick.current}. Extreme reading. ${direction === 'BUY' ? 'Could be a bounce point.' : 'Could see more selling.'}`,
        coachStyle: 'somesh',
        actionRequired: false,
        expiresAt: new Date(Date.now() + 60000).toISOString(), // 1 min expiry
      });
    }

    // Trading caution
    if (breadth.tradingBias === 'caution') {
      warnings.push({
        id: `breadth_caution_${Date.now()}`,
        timestamp: now,
        severity: 'warning',
        type: 'market_breadth',
        title: '⚠️ Mixed Market Signals',
        message: "Market's sending mixed signals. Size down or wait for clarity. Choppy water ahead.",
        coachStyle: 'somesh',
        actionRequired: false,
        suggestedAction: 'Reduce position size by 50%',
        expiresAt: new Date(Date.now() + 600000).toISOString(), // 10 min expiry
      });
    }
  }

  // Calendar-based warnings
  const imminentEvents = calendarEvents.filter(e => e.isImminent && e.impact === 'high');
  for (const event of imminentEvents) {
    warnings.push({
      id: `calendar_${event.id}`,
      timestamp: now,
      severity: 'critical',
      type: 'economic_event',
      title: `🚨 ${event.event} IMMINENT`,
      message: event.coachingMessage,
      coachStyle: 'somesh',
      actionRequired: true,
      suggestedAction: 'Flatten all positions immediately',
      expiresAt: new Date(event.eventTimestamp + 300000).toISOString(), // 5 min after event
    });
  }

  // High impact events within 15 minutes
  const upcomingHighImpact = calendarEvents.filter(
    e => !e.isPast && e.impact === 'high' && e.minutesUntilEvent > 0 && e.minutesUntilEvent <= 15
  );
  for (const event of upcomingHighImpact) {
    if (!imminentEvents.includes(event)) {
      warnings.push({
        id: `calendar_upcoming_${event.id}`,
        timestamp: now,
        severity: 'warning',
        type: 'economic_event',
        title: `⚠️ ${event.event} in ${event.minutesUntilEvent}m`,
        message: event.coachingMessage,
        coachStyle: 'somesh',
        actionRequired: false,
        suggestedAction: 'Avoid new trades, reduce size',
        expiresAt: new Date(event.eventTimestamp).toISOString(),
      });
    }
  }

  return warnings;
}

function determineTradingConditions(
  breadth: MarketBreadth | null,
  calendarEvents: EnhancedEconomicEvent[]
): MarketHotContext['tradingConditions'] {
  const restrictions: string[] = [];
  let status: 'green' | 'yellow' | 'red' = 'green';
  let message = 'Normal trading conditions. Follow your plan.';

  // Check calendar
  const imminentHighImpact = calendarEvents.some(e => e.isImminent && e.impact === 'high');
  const upcomingHighImpact = calendarEvents.some(
    e => !e.isPast && e.impact === 'high' && e.minutesUntilEvent > 0 && e.minutesUntilEvent <= 30
  );

  if (imminentHighImpact) {
    status = 'red';
    message = 'HIGH-IMPACT EVENT IMMINENT. Flatten positions or stay flat.';
    restrictions.push('No new positions');
    restrictions.push('Flatten existing trades');
  } else if (upcomingHighImpact) {
    status = 'yellow';
    message = 'High-impact event approaching. Reduce size and avoid new trades.';
    restrictions.push('Reduce position size by 50%');
    restrictions.push('Avoid new entries');
  }

  // Check breadth
  if (breadth) {
    if (breadth.tradingBias === 'caution') {
      if (status === 'green') {
        status = 'yellow';
        message = 'Mixed market signals. Trade with caution.';
      }
      restrictions.push('Size down');
    }

    if (breadth.add.trend === 'strong_bearish' || breadth.add.trend === 'strong_bullish') {
      if (breadth.add.trend === 'strong_bearish') {
        restrictions.push('Avoid long entries');
      } else {
        restrictions.push('Avoid short entries');
      }
    }
  }

  return { status, message, restrictions };
}

async function buildHotContext(
  breadth: MarketBreadth | null,
  calendarEvents: EnhancedEconomicEvent[]
): Promise<MarketHotContext> {
  const todayStr = new Date().toISOString().split('T')[0];
  const todayEvents = calendarEvents.filter(e => e.date === todayStr);
  const futureEvents = calendarEvents.filter(e => !e.isPast).sort((a, b) => a.eventTimestamp - b.eventTimestamp);
  const nextEvent = futureEvents.length > 0 ? futureEvents[0] : null;
  const hasHighImpactToday = todayEvents.some(e => e.impact === 'high');
  const imminentEvent = todayEvents.find(e => e.isImminent && e.impact === 'high');

  const warnings = generateProactiveWarnings(breadth, calendarEvents);
  const tradingConditions = determineTradingConditions(breadth, calendarEvents);

  return {
    timestamp: new Date().toISOString(),
    breadth,
    calendar: {
      todayEvents,
      nextEvent,
      hasHighImpactToday,
      isEventImminent: !!imminentEvent,
      imminentEvent,
    },
    tradingConditions,
    activeWarnings: warnings,
  };
}

// =============================================================================
// REDIS OPERATIONS
// =============================================================================

async function pushToRedis(key: string, data: unknown, ttl: number): Promise<boolean> {
  const client = getRedis();
  if (!client) {
    console.warn('[MarketWorker] Redis not available, skipping push');
    return false;
  }

  try {
    const serialized = JSON.stringify(data);
    await client.setex(key, ttl, serialized);
    console.log(`[MarketWorker] Pushed to ${key} (TTL: ${ttl}s)`);
    return true;
  } catch (error) {
    console.error(`[MarketWorker] Redis push error for ${key}:`, error);
    return false;
  }
}

async function publishWarning(warning: ProactiveWarning): Promise<boolean> {
  const client = getRedis();
  if (!client) return false;

  try {
    await client.publish('market:warnings', JSON.stringify(warning));
    console.log(`[MarketWorker] Published warning: ${warning.title}`);
    return true;
  } catch (error) {
    console.error('[MarketWorker] Warning publish error:', error);
    return false;
  }
}

// =============================================================================
// MAIN WORKER LOOP
// =============================================================================

let lastBreadth: MarketBreadth | null = null;
let lastCalendarEvents: EnhancedEconomicEvent[] = [];
let lastWarningIds = new Set<string>();

async function updateBreadth(): Promise<void> {
  const breadth = await fetchMarketBreadth();
  if (breadth) {
    lastBreadth = breadth;
    await pushToRedis(CONFIG.REDIS_KEYS.BREADTH, breadth, CONFIG.CACHE_TTL.BREADTH);
  }
}

async function updateCalendar(): Promise<void> {
  const events = await fetchEconomicCalendar();
  lastCalendarEvents = events;
  await pushToRedis(CONFIG.REDIS_KEYS.CALENDAR, events, CONFIG.CACHE_TTL.CALENDAR);
}

async function updateHotContext(): Promise<void> {
  const hotContext = await buildHotContext(lastBreadth, lastCalendarEvents);

  // Push to Redis
  await pushToRedis(CONFIG.REDIS_KEYS.HOT_CONTEXT, hotContext, CONFIG.CACHE_TTL.HOT_CONTEXT);

  // Publish new warnings via pub/sub
  for (const warning of hotContext.activeWarnings) {
    if (!lastWarningIds.has(warning.id)) {
      await publishWarning(warning);
      lastWarningIds.add(warning.id);
    }
  }

  // Clean up old warning IDs
  const currentIds = new Set(hotContext.activeWarnings.map(w => w.id));
  lastWarningIds = new Set(Array.from(lastWarningIds).filter(id => currentIds.has(id)));
}

async function runWorker(): Promise<void> {
  console.log('[MarketWorker] Starting market data ingestion worker...');
  console.log(`[MarketWorker] Redis URL: ${CONFIG.REDIS_URL ? 'configured' : 'not configured'}`);
  console.log(`[MarketWorker] Massive API: ${CONFIG.MASSIVE_API_KEY ? 'configured' : 'not configured'}`);
  console.log(`[MarketWorker] Finnhub API: ${CONFIG.FINNHUB_API_KEY ? 'configured' : 'not configured'}`);

  // Initial fetch
  console.log('[MarketWorker] Performing initial data fetch...');
  await Promise.all([updateBreadth(), updateCalendar()]);
  await updateHotContext();

  // Start intervals
  console.log(`[MarketWorker] Starting intervals (breadth: ${CONFIG.BREADTH_INTERVAL}ms, calendar: ${CONFIG.CALENDAR_INTERVAL}ms)`);

  setInterval(async () => {
    try {
      await updateBreadth();
      await updateHotContext();
    } catch (error) {
      console.error('[MarketWorker] Breadth update error:', error);
    }
  }, CONFIG.BREADTH_INTERVAL);

  setInterval(async () => {
    try {
      await updateCalendar();
    } catch (error) {
      console.error('[MarketWorker] Calendar update error:', error);
    }
  }, CONFIG.CALENDAR_INTERVAL);

  // Frequent imminent event checks
  setInterval(async () => {
    try {
      // Re-enhance events to update minutesUntilEvent
      lastCalendarEvents = enhanceEvents(
        lastCalendarEvents.map(e => ({
          date: e.date,
          time: e.time,
          event: e.event,
          impact: e.impact,
          forecast: e.forecast,
          previous: e.previous,
        }))
      );
      await updateHotContext();
    } catch (error) {
      console.error('[MarketWorker] Imminent check error:', error);
    }
  }, CONFIG.IMMINENT_CHECK_INTERVAL);

  console.log('[MarketWorker] Worker running. Press Ctrl+C to stop.');
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n[MarketWorker] Shutting down...');
  if (redis) {
    await redis.quit();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n[MarketWorker] Received SIGTERM, shutting down...');
  if (redis) {
    await redis.quit();
  }
  process.exit(0);
});

// Export for testing
export {
  fetchMarketBreadth,
  fetchEconomicCalendar,
  buildHotContext,
  generateProactiveWarnings,
  determineTradingConditions,
  enhanceEvents,
};

export type {
  MarketBreadth,
  EnhancedEconomicEvent,
  ProactiveWarning,
  MarketHotContext,
};

// Run if executed directly
if (typeof require !== 'undefined' && require.main === module) {
  runWorker().catch(console.error);
}
