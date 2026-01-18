/**
 * Briefing Generation Engine
 *
 * Generates daily briefings with market context, key levels,
 * economic events, and LTP setup opportunities.
 */

import { marketDataService } from './market-data';
import { identifyKeyLevels, determineTrend, calculateEMA } from './ltp-engine';
import { getEventsSummary, EconomicEvent } from './economic-calendar';
import { getUpcomingEarnings, EarningsEvent } from './earnings-calendar';
import { supabaseAdmin } from './supabase';
import logger from './logger';

// Types
export interface Briefing {
  id?: string;
  briefingType: 'morning' | 'eod' | 'weekly';
  generatedAt: string;
  content: BriefingContent;
  marketContext: MarketContext;
  keyLevels: SymbolLevels[];
  setups: LTPSetup[];
  economicEvents: EconomicEvent[];
  earnings?: EarningsEvent[];
  lessonOfDay?: LessonOfDay;
}

export interface BriefingContent {
  headline: string;
  summary: string;
  marketBias: 'bullish' | 'bearish' | 'neutral';
  actionItems: string[];
  warnings?: string[];
}

export interface MarketContext {
  spyPrice: number;
  spyChange: number;
  spyTrend: string;
  qqqPrice: number;
  qqqChange: number;
  qqqTrend: string;
  vixLevel?: number;
  marketPhase: 'pre_market' | 'market_open' | 'market_close' | 'after_hours';
  overallSentiment: 'risk_on' | 'risk_off' | 'neutral';
}

export interface SymbolLevels {
  symbol: string;
  currentPrice: number;
  levels: Array<{
    price: number;
    type: 'support' | 'resistance';
    strength: number;
    note?: string;
  }>;
  ema9: number;
  ema21: number;
  trend: string;
}

export interface LTPSetup {
  symbol: string;
  direction: 'long' | 'short';
  setupType: string;
  levelScore: number;
  trendScore: number;
  note: string;
}

export interface LessonOfDay {
  title: string;
  content: string;
  module?: string;
  lessonId?: string;
}

// Default watchlist for briefings
const BRIEFING_SYMBOLS = ['SPY', 'QQQ', 'AAPL', 'NVDA', 'TSLA', 'AMD', 'META', 'MSFT'];

// Trading tips for lesson of the day
const DAILY_TIPS = [
  {
    title: 'Wait for Confirmation',
    content: 'Never enter a trade without a patience candle confirming your setup. The market rewards patience, not FOMO.',
    module: 'ltp-framework',
  },
  {
    title: 'Trade With the Trend',
    content: 'Higher probability setups come from trading with the prevailing trend. Going against trend requires stronger confluence.',
    module: 'ltp-framework',
  },
  {
    title: 'Levels First',
    content: 'Always identify key support and resistance levels before looking for entries. Levels are the foundation of LTP.',
    module: 'ltp-framework',
  },
  {
    title: 'Size Accordingly',
    content: 'Risk 1-2% of your account per trade max. Consistent sizing leads to consistent results.',
    module: 'risk-management',
  },
  {
    title: 'Honor Your Stops',
    content: 'A stop loss is a promise to yourself. Never move it further away from your entry.',
    module: 'risk-management',
  },
  {
    title: 'First 15 Minutes',
    content: 'The first 15 minutes after market open are often choppy. Wait for range to establish before taking positions.',
    module: 'market-psychology',
  },
  {
    title: 'Less is More',
    content: 'Quality over quantity. One well-planned A-grade setup beats five mediocre trades.',
    module: 'trading-psychology',
  },
];

/**
 * Get market context for SPY and QQQ
 */
async function getMarketContext(): Promise<MarketContext | null> {
  try {
    const [spyBars, qqqBars] = await Promise.all([
      marketDataService.getAggregates('SPY', '5', 50),
      marketDataService.getAggregates('QQQ', '5', 50),
    ]);

    if (spyBars.length === 0 || qqqBars.length === 0) {
      return null;
    }

    const spyClose = spyBars[spyBars.length - 1].c;
    const spyPrevClose = spyBars[0].c;
    const spyChange = ((spyClose - spyPrevClose) / spyPrevClose) * 100;
    const spyTrend = determineTrend(spyBars);

    const qqqClose = qqqBars[qqqBars.length - 1].c;
    const qqqPrevClose = qqqBars[0].c;
    const qqqChange = ((qqqClose - qqqPrevClose) / qqqPrevClose) * 100;
    const qqqTrend = determineTrend(qqqBars);

    // Determine market phase based on time
    const now = new Date();
    const hour = now.getHours();
    let marketPhase: MarketContext['marketPhase'] = 'market_open';
    if (hour < 9 || (hour === 9 && now.getMinutes() < 30)) {
      marketPhase = 'pre_market';
    } else if (hour >= 16) {
      marketPhase = 'after_hours';
    } else if (hour >= 15 && now.getMinutes() >= 45) {
      marketPhase = 'market_close';
    }

    // Overall sentiment
    let overallSentiment: MarketContext['overallSentiment'] = 'neutral';
    if (spyChange > 0.5 && qqqChange > 0.5) {
      overallSentiment = 'risk_on';
    } else if (spyChange < -0.5 && qqqChange < -0.5) {
      overallSentiment = 'risk_off';
    }

    return {
      spyPrice: spyClose,
      spyChange,
      spyTrend: spyTrend || 'range',
      qqqPrice: qqqClose,
      qqqChange,
      qqqTrend: qqqTrend || 'range',
      marketPhase,
      overallSentiment,
    };

  } catch (error) {
    logger.error('Error getting market context', error instanceof Error ? error : { message: String(error) });
    return null;
  }
}

/**
 * Get key levels for a symbol
 */
async function getSymbolLevels(symbol: string): Promise<SymbolLevels | null> {
  try {
    const bars = await marketDataService.getAggregates(symbol, '5', 100);

    if (bars.length < 21) {
      return null;
    }

    const closes = bars.map(b => b.c);
    const currentPrice = closes[closes.length - 1];

    const ema9 = calculateEMA(closes, 9);
    const ema21 = calculateEMA(closes, 21);
    const trend = determineTrend(bars.slice(-20));
    const levels = identifyKeyLevels(bars);

    return {
      symbol: symbol.toUpperCase(),
      currentPrice,
      levels: levels.map((l) => ({
        price: l.price,
        type: l.type as 'support' | 'resistance',
        strength: l.strength,
        note: l.price > currentPrice ? 'Above current' : 'Below current',
      })),
      ema9,
      ema21,
      trend: trend || 'range',
    };

  } catch (error) {
    logger.error('Error getting symbol levels', { symbol, error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

/**
 * Identify potential LTP setups
 */
async function identifySetups(symbols: string[]): Promise<LTPSetup[]> {
  const setups: LTPSetup[] = [];

  for (const symbol of symbols) {
    try {
      const symbolLevels = await getSymbolLevels(symbol);
      if (!symbolLevels) continue;

      const { currentPrice, levels, ema9, ema21, trend } = symbolLevels;

      // Check for setup at key levels
      for (const level of levels) {
        const distance = Math.abs(currentPrice - level.price) / currentPrice * 100;

        if (distance < 0.5 && level.strength >= 70) {
          // Near a strong level
          const direction = level.type === 'support' ? 'long' : 'short';
          const trendAligned = (direction === 'long' && trend === 'uptrend') ||
                              (direction === 'short' && trend === 'downtrend');

          const levelScore = level.strength;
          const trendScore = trendAligned ? 85 : 50;

          if (levelScore + trendScore >= 140) {
            setups.push({
              symbol: symbol.toUpperCase(),
              direction,
              setupType: level.type === 'support' ? 'bounce' : 'rejection',
              levelScore,
              trendScore,
              note: `At ${level.type} ${level.price.toFixed(2)} with ${trend || 'range'}`,
            });
          }
        }
      }
    } catch {
      // Skip symbol on error
    }
  }

  // Sort by combined score
  setups.sort((a, b) => (b.levelScore + b.trendScore) - (a.levelScore + a.trendScore));

  return setups.slice(0, 5); // Top 5 setups
}

/**
 * Select lesson of the day
 */
function selectLessonOfDay(): LessonOfDay {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
  const tip = DAILY_TIPS[dayOfYear % DAILY_TIPS.length];
  return tip;
}

/**
 * Generate morning briefing
 */
export async function generateMorningBriefing(): Promise<Briefing | null> {
  try {
    logger.info('Generating morning briefing');

    const [marketContext, eventsSummary, earnings] = await Promise.all([
      getMarketContext(),
      getEventsSummary(),
      getUpcomingEarnings(7), // Get earnings for next 7 days
    ]);

    if (!marketContext) {
      logger.warn('Could not get market context');
      return null;
    }

    // Get key levels for watchlist symbols
    const keyLevels: SymbolLevels[] = [];
    for (const symbol of BRIEFING_SYMBOLS.slice(0, 4)) {
      const levels = await getSymbolLevels(symbol);
      if (levels) keyLevels.push(levels);
    }

    // Identify potential setups
    const setups = await identifySetups(BRIEFING_SYMBOLS);

    // Select lesson of the day
    const lessonOfDay = selectLessonOfDay();

    // Filter earnings to only include watchlist symbols (top 10)
    const watchlistEarnings = earnings
      .filter(e => BRIEFING_SYMBOLS.includes(e.symbol))
      .slice(0, 10);

    // Build content
    const headline = buildHeadline(marketContext, eventsSummary.hasHighImpact);
    const summary = buildSummary(marketContext, setups.length, eventsSummary.hasHighImpact);

    const actionItems: string[] = [];
    if (setups.length > 0) {
      actionItems.push(`Watch ${setups.map(s => s.symbol).join(', ')} for potential entries`);
    }
    if (eventsSummary.hasHighImpact) {
      actionItems.push('Consider waiting for economic data release before entering new positions');
    }
    actionItems.push('Focus on A-grade setups only');
    actionItems.push('Review your trading plan before the open');

    const warnings: string[] = [];
    if (eventsSummary.warning) {
      warnings.push(eventsSummary.warning);
    }
    if (marketContext.overallSentiment === 'risk_off') {
      warnings.push('Risk-off environment detected. Consider smaller position sizes.');
    }
    // Add earnings warnings for today
    const todayEarnings = watchlistEarnings.filter(
      e => e.reportDate === new Date().toISOString().split('T')[0]
    );
    if (todayEarnings.length > 0) {
      warnings.push(`Earnings today: ${todayEarnings.map(e => e.symbol).join(', ')}. Expect increased volatility.`);
    }

    const content: BriefingContent = {
      headline,
      summary,
      marketBias: marketContext.spyChange > 0.3 ? 'bullish' :
                  marketContext.spyChange < -0.3 ? 'bearish' : 'neutral',
      actionItems,
      warnings: warnings.length > 0 ? warnings : undefined,
    };

    const briefing: Briefing = {
      briefingType: 'morning',
      generatedAt: new Date().toISOString(),
      content,
      marketContext,
      keyLevels,
      setups,
      economicEvents: eventsSummary.events,
      earnings: watchlistEarnings,
      lessonOfDay,
    };

    // Save to database
    const { data, error } = await supabaseAdmin
      .from('briefings')
      .insert({
        briefing_type: briefing.briefingType,
        content: briefing.content,
        market_context: briefing.marketContext,
        key_levels: briefing.keyLevels,
        setups: briefing.setups,
        economic_events: briefing.economicEvents,
        earnings: briefing.earnings,
        lesson_of_day: briefing.lessonOfDay,
      })
      .select('id')
      .single();

    if (error) {
      logger.error('Error saving briefing', { error: error.message });
    } else {
      briefing.id = data.id;
    }

    // Update config
    await supabaseAdmin
      .from('briefing_configs')
      .update({ last_generated_at: new Date().toISOString() })
      .eq('briefing_type', 'morning');

    logger.info('Morning briefing generated', { id: briefing.id });

    return briefing;

  } catch (error) {
    logger.error('Error generating morning briefing', error instanceof Error ? error : { message: String(error) });
    return null;
  }
}

/**
 * Generate EOD briefing
 */
export async function generateEODBriefing(): Promise<Briefing | null> {
  try {
    logger.info('Generating EOD briefing');

    const marketContext = await getMarketContext();

    if (!marketContext) {
      logger.warn('Could not get market context');
      return null;
    }

    // Summary of the day
    const dayResult = marketContext.spyChange > 0.5 ? 'strong bullish' :
                      marketContext.spyChange > 0 ? 'slightly bullish' :
                      marketContext.spyChange < -0.5 ? 'strong bearish' :
                      marketContext.spyChange < 0 ? 'slightly bearish' : 'flat';

    const content: BriefingContent = {
      headline: `Market closes ${dayResult}`,
      summary: `SPY ${marketContext.spyChange >= 0 ? '+' : ''}${marketContext.spyChange.toFixed(2)}% | ` +
               `QQQ ${marketContext.qqqChange >= 0 ? '+' : ''}${marketContext.qqqChange.toFixed(2)}%`,
      marketBias: marketContext.spyChange > 0 ? 'bullish' : marketContext.spyChange < 0 ? 'bearish' : 'neutral',
      actionItems: [
        'Review your trades from today',
        'Journal any lessons learned',
        'Prepare watchlist for tomorrow',
      ],
    };

    const briefing: Briefing = {
      briefingType: 'eod',
      generatedAt: new Date().toISOString(),
      content,
      marketContext,
      keyLevels: [],
      setups: [],
      economicEvents: [],
    };

    // Save to database
    const { data, error } = await supabaseAdmin
      .from('briefings')
      .insert({
        briefing_type: briefing.briefingType,
        content: briefing.content,
        market_context: briefing.marketContext,
        key_levels: briefing.keyLevels,
        setups: briefing.setups,
        economic_events: briefing.economicEvents,
      })
      .select('id')
      .single();

    if (error) {
      logger.error('Error saving EOD briefing', { error: error.message });
    } else {
      briefing.id = data.id;
    }

    return briefing;

  } catch (error) {
    logger.error('Error generating EOD briefing', error instanceof Error ? error : { message: String(error) });
    return null;
  }
}

function buildHeadline(context: MarketContext, hasHighImpactEvents: boolean): string {
  const direction = context.spyChange > 0.3 ? 'higher' :
                    context.spyChange < -0.3 ? 'lower' : 'flat';

  let headline = `Markets point ${direction} `;

  if (hasHighImpactEvents) {
    headline += '- High Impact Data Today';
  } else if (context.overallSentiment === 'risk_on') {
    headline += '- Risk On';
  } else if (context.overallSentiment === 'risk_off') {
    headline += '- Caution Advised';
  }

  return headline;
}

function buildSummary(context: MarketContext, setupCount: number, hasEvents: boolean): string {
  let summary = `SPY ${context.spyChange >= 0 ? '+' : ''}${context.spyChange.toFixed(2)}% (${context.spyTrend}) | `;
  summary += `QQQ ${context.qqqChange >= 0 ? '+' : ''}${context.qqqChange.toFixed(2)}% (${context.qqqTrend}). `;

  if (setupCount > 0) {
    summary += `${setupCount} potential LTP setup${setupCount > 1 ? 's' : ''} identified. `;
  }

  if (hasEvents) {
    summary += 'Economic data scheduled - watch for volatility.';
  }

  return summary;
}

/**
 * Get the latest briefing of a type
 */
export async function getLatestBriefing(type: 'morning' | 'eod' | 'weekly'): Promise<Briefing | null> {
  try {
    const { data, error } = await supabaseAdmin
      .rpc('get_latest_briefing', { p_type: type });

    if (error || !data || data.length === 0) {
      return null;
    }

    const row = data[0];
    return {
      id: row.id,
      briefingType: row.briefing_type,
      generatedAt: row.generated_at,
      content: row.content,
      marketContext: row.market_context,
      keyLevels: row.key_levels || [],
      setups: row.setups || [],
      economicEvents: row.economic_events || [],
      earnings: row.earnings || [],
      lessonOfDay: row.lesson_of_day,
    };

  } catch (error) {
    logger.error('Error getting latest briefing', error instanceof Error ? error : { message: String(error) });
    return null;
  }
}
