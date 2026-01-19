/**
 * KCU Coaching Rules Service - Digital Somesh Edition
 *
 * Provides real-time coaching guidance channeling Somesh's raw transcript energy.
 * Uses the LTP (Level, Trend, Patience) framework to evaluate setups
 * and deliver straight-talking, no-BS coaching messages.
 *
 * "The trend is your friend. Don't fight the river."
 * "Patience pays the patient hand. Wait for the candle close."
 * "Scared money don't make money. The setup is there. Execute."
 */

import type { LTPAnalysis } from './market-data';

// ============================================================================
// TYPES
// ============================================================================

export interface StructureBreakContext {
  detected: boolean;
  type: 'bullish_break' | 'bearish_break' | null; // lower low after higher highs = bearish, higher high after lower lows = bullish
  breakPrice: number | null;
  direction: 'long' | 'short' | null;
  strength: 'strong' | 'weak' | null; // strong = broke with momentum, weak = marginal break
}

export interface CoachingContext {
  symbol: string;
  currentPrice: number;
  ltpAnalysis: LTPAnalysis | null;
  gammaData?: GammaContext | null;
  fvgData?: FVGContext | null;
  structureBreak?: StructureBreakContext | null;
  activeTrade?: ActiveTradeContext | null;
  mode: 'scan' | 'focus' | 'trade';
  marketSession: 'premarket' | 'open' | 'power_hour' | 'close' | 'after_hours' | 'closed';
}

export interface GammaContext {
  regime: 'positive' | 'negative' | 'neutral';
  maxPain: number;
  callWall: number;
  putWall: number;
  gammaFlip: number;
  dealerPositioning: string;
}

export interface FVGContext {
  nearestBullish: { price: number; distance: number } | null;
  nearestBearish: { price: number; distance: number } | null;
  supportZones: { top: number; bottom: number }[];
  resistanceZones: { top: number; bottom: number }[];
}

export interface ActiveTradeContext {
  entryPrice: number;
  direction: 'long' | 'short';
  stopLoss: number;
  target1: number;
  target2?: number;
  target3?: number;
  currentRMultiple: number;
  positionSize: number;
  enteredAt: string;
}

export interface CoachingMessage {
  type: 'guidance' | 'warning' | 'opportunity' | 'education' | 'trade_management';
  priority: 'high' | 'medium' | 'low';
  title: string;
  message: string;
  action?: string;
  relatedLesson?: {
    module: string;
    lesson: string;
    url: string;
  };
}

// ============================================================================
// COACHING RULE ENGINE
// ============================================================================

class KCUCoachingRules {
  /**
   * Generate coaching messages based on current context
   */
  getCoachingMessages(context: CoachingContext): CoachingMessage[] {
    const messages: CoachingMessage[] = [];

    // Get messages based on mode
    switch (context.mode) {
      case 'scan':
        messages.push(...this.getScanModeGuidance(context));
        break;
      case 'focus':
        messages.push(...this.getFocusModeGuidance(context));
        break;
      case 'trade':
        messages.push(...this.getTradeModeGuidance(context));
        break;
    }

    // Always add market session context
    messages.push(...this.getMarketSessionGuidance(context));

    // Sort by priority
    return messages.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  /**
   * Get a single primary coaching message for display
   */
  getPrimaryMessage(context: CoachingContext): CoachingMessage | null {
    const messages = this.getCoachingMessages(context);
    return messages.length > 0 ? messages[0] : null;
  }

  /**
   * Evaluate setup quality and return grade explanation - Somesh style
   * Grades: A+ (Sniper), A/B (Decent), C/D/F (Dumb Shit)
   */
  getGradeExplanation(grade: string, ltp: LTPAnalysis): string {
    const levelScore = ltp.levels.levelScore;
    const trendScore = ltp.trend.trendScore;
    const patienceScore = ltp.patience.patienceScore;

    switch (grade) {
      case 'A+':
        return '🎯 SNIPER SETUP. This is it. Level, trend, patience - all aligned. The market is handing you this trade on a silver platter. Don\'t overthink it. Execute.';
      case 'A':
        return '💪 SNIPER SETUP. Strong LTP alignment. Minor gaps but this is tradeable. The setup is there. Scared money don\'t make money.';
      case 'B':
        return `👀 DECENT SETUP. Could be something, but ${this.getWeakestComponent(levelScore, trendScore, patienceScore)} ain\'t cooperating. Wait for it to get better or size down.`;
      case 'C':
        return '⚠️ This setup is questionable. Multiple LTP components are weak. Why are you even looking at this? Go find a real setup.';
      case 'D':
        return '🚫 DUMB SHIT. This is how you blow up accounts. LTP ain\'t aligned. Close the chart and walk away.';
      case 'F':
        return '💀 DUMB SHIT. There\'s no setup here. This is gambling, not trading. The market will eat your lunch. Find something else.';
      default:
        return 'Analyzing... patience pays the patient hand.';
    }
  }

  private getWeakestComponent(level: number, trend: number, patience: number): string {
    const min = Math.min(level, trend, patience);
    if (min === level) return 'you\'re not at a key level - where\'s your edge?';
    if (min === trend) return 'the trend is your friend - why are you fighting the river?';
    return 'patience candle ain\'t confirmed - wait for the close!';
  }

  // ============================================================================
  // SCAN MODE GUIDANCE
  // ============================================================================

  private getScanModeGuidance(context: CoachingContext): CoachingMessage[] {
    const messages: CoachingMessage[] = [];
    const ltp = context.ltpAnalysis;

    if (!ltp) {
      messages.push({
        type: 'guidance',
        priority: 'medium',
        title: 'Pick a Stock',
        message: 'What are we trading today? Pick something from your watchlist. One stock, one direction - that\'s the rule of ones.',
        action: 'Add symbols to watchlist'
      });
      return messages;
    }

    // Grade-based guidance - Somesh style
    if (ltp.grade === 'A+' || ltp.grade === 'A') {
      messages.push({
        type: 'opportunity',
        priority: 'high',
        title: `🎯 SNIPER ALERT: ${context.symbol}`,
        message: `${context.symbol} is setting up BEAUTIFULLY. ${ltp.grade} grade - level, trend, patience all lining up. This is what we wait for. Get focused.`,
        action: 'Switch to Focus mode - this could be the one',
        relatedLesson: {
          module: 'setups',
          lesson: 'ltp-framework',
          url: '/curriculum/setups/ltp-framework'
        }
      });
    } else if (ltp.grade === 'B') {
      messages.push({
        type: 'guidance',
        priority: 'medium',
        title: `👀 Watching: ${context.symbol}`,
        message: `Something brewing here. Not perfect, but could turn into something. ${this.getImprovementNeeded(ltp)}`,
        action: 'Keep it on the radar'
      });
    } else if (ltp.grade === 'C' || ltp.grade === 'D' || ltp.grade === 'F') {
      messages.push({
        type: 'warning',
        priority: 'low',
        title: `❌ Not Here: ${context.symbol}`,
        message: 'This ain\'t it, chief. The setup isn\'t there. Don\'t force it. There\'s always another play.',
        action: 'Find a better chart'
      });
    }

    // Level proximity alerts
    if (ltp.levels.levelProximity === 'at_level') {
      messages.push({
        type: 'opportunity',
        priority: 'high',
        title: '📍 At Key Level',
        message: `Price is kissing a level. ${this.describeLevelContext(ltp)} Levels are like magnets - this is where setups happen.`,
        relatedLesson: {
          module: 'entries',
          lesson: 'levels-mastery',
          url: '/curriculum/entries/levels-mastery'
        }
      });
    }

    // Structure break guidance
    if (context.structureBreak?.detected) {
      messages.push(...this.getStructureBreakGuidance(context));
    }

    // Add gamma context if available
    if (context.gammaData) {
      messages.push(...this.getGammaGuidance(context));
    }

    return messages;
  }

  // ============================================================================
  // FOCUS MODE GUIDANCE
  // ============================================================================

  private getFocusModeGuidance(context: CoachingContext): CoachingMessage[] {
    const messages: CoachingMessage[] = [];
    const ltp = context.ltpAnalysis;

    if (!ltp) return messages;

    // Entry timing guidance - Somesh style
    if (ltp.grade === 'A+' || ltp.grade === 'A') {
      if (ltp.patience.candle5m?.confirmed || ltp.patience.candle15m?.confirmed) {
        messages.push({
          type: 'opportunity',
          priority: 'high',
          title: '🚀 PATIENCE CONFIRMED - GO TIME',
          message: 'The candle closed. LTP is aligned. Scared money don\'t make money. The setup is there. EXECUTE.',
          action: 'Pull the trigger - this is what we waited for',
          relatedLesson: {
            module: 'entries',
            lesson: 'patience-candles',
            url: '/curriculum/entries/patience-candles'
          }
        });
      } else if (ltp.patience.candle5m?.forming || ltp.patience.candle15m?.forming) {
        messages.push({
          type: 'guidance',
          priority: 'high',
          title: '⏳ Patience Candle Forming...',
          message: 'Hold up. Candle ain\'t closed yet. PATIENCE PAYS THE PATIENT HAND. Don\'t anticipate - WAIT for the close.',
          action: 'Eyes on the candle close'
        });
      } else {
        messages.push({
          type: 'guidance',
          priority: 'medium',
          title: '🔍 Waiting for Confirmation',
          message: 'Setup looks good but we need a patience candle. The market will show you EXACTLY what it wants to do. Be patient.',
          action: 'Wait for candle pattern at level'
        });
      }
    }

    // Trend alignment check
    if (ltp.trend.trendAlignment === 'conflicting') {
      messages.push({
        type: 'warning',
        priority: 'medium',
        title: '⚔️ Timeframes Fighting',
        message: 'Daily says one thing, intraday says another. The trend is your friend - don\'t fight the river. Size down or skip this one.',
        relatedLesson: {
          module: 'analysis',
          lesson: 'multi-timeframe',
          url: '/curriculum/analysis/multi-timeframe'
        }
      });
    }

    // Structure break in focus mode
    if (context.structureBreak?.detected) {
      messages.push(...this.getStructureBreakGuidance(context));
    }

    // FVG targets
    if (context.fvgData) {
      messages.push(...this.getFVGGuidance(context));
    }

    return messages;
  }

  // ============================================================================
  // TRADE MODE GUIDANCE (Active Trade Management)
  // ============================================================================

  private getTradeModeGuidance(context: CoachingContext): CoachingMessage[] {
    const messages: CoachingMessage[] = [];
    const trade = context.activeTrade;

    if (!trade) {
      messages.push({
        type: 'guidance',
        priority: 'medium',
        title: 'Log Your Trade',
        message: 'You in a trade? Log it so I can coach you through it. Every trade is a lesson.',
        action: 'Log your entry'
      });
      return messages;
    }

    const currentR = trade.currentRMultiple;

    // R-multiple based guidance - Somesh style
    if (currentR >= 2) {
      messages.push({
        type: 'trade_management',
        priority: 'high',
        title: '🎉 PAYDAY - 2R+ Hit!',
        message: `Trade at ${currentR.toFixed(1)}R. RING THE REGISTER. Take 50% off, let the rest ride. Never turn a winner into a loser.`,
        action: 'Bank profits, trail the rest',
        relatedLesson: {
          module: 'exits',
          lesson: 'scaling-out',
          url: '/curriculum/exits/scaling-out'
        }
      });
    } else if (currentR >= 1) {
      messages.push({
        type: 'trade_management',
        priority: 'medium',
        title: '💰 1R - Lock It In',
        message: `At ${currentR.toFixed(2)}R. Move that stop to breakeven NOW. House money from here. You can\'t lose on this trade anymore.`,
        action: 'Stop to B/E - protect your gains'
      });
    } else if (currentR > 0 && currentR < 1) {
      messages.push({
        type: 'guidance',
        priority: 'low',
        title: '📈 In The Green',
        message: `Trade at ${currentR.toFixed(2)}R. Let it work. Don\'t micromanage. Stick to the plan.`,
        action: 'Hold and let it develop'
      });
    } else if (currentR <= -0.5 && currentR > -1) {
      messages.push({
        type: 'warning',
        priority: 'high',
        title: '⚠️ Getting Close to Stop',
        message: `Trade at ${currentR.toFixed(2)}R. DON\'T BE A HERO. Respect the stop. Don\'t move it to "give it room." That\'s how accounts blow up.`,
        relatedLesson: {
          module: 'risk',
          lesson: 'stop-discipline',
          url: '/curriculum/risk/stop-discipline'
        }
      });
    } else if (currentR <= -1) {
      messages.push({
        type: 'warning',
        priority: 'high',
        title: '🛑 STOP HIT',
        message: 'Your stop should have triggered. If it didn\'t, GET OUT NOW. Live to trade another day. One trade won\'t make you, but one bad trade can break you.',
        action: 'Exit immediately if stop was breached'
      });
    }

    // Check if setup is deteriorating
    const ltp = context.ltpAnalysis;
    if (ltp && (ltp.grade === 'D' || ltp.grade === 'F')) {
      messages.push({
        type: 'warning',
        priority: 'high',
        title: '📉 Setup Breaking Down',
        message: 'The LTP that got you in? It\'s gone. Setup quality degraded. Don\'t hope and pray - either manage it or exit.',
        action: 'Consider early exit'
      });
    }

    // Structure break during trade
    if (context.structureBreak?.detected) {
      const breakDir = context.structureBreak.direction;
      const tradeDir = trade.direction;
      if ((breakDir === 'long' && tradeDir === 'short') || (breakDir === 'short' && tradeDir === 'long')) {
        messages.push({
          type: 'warning',
          priority: 'high',
          title: '🔄 Structure Break AGAINST You',
          message: `Market structure just broke against your ${tradeDir} position. The trend might be shifting. Tighten stop or take profits.`,
          action: 'Manage the position - structure changed'
        });
      }
    }

    return messages;
  }

  // ============================================================================
  // MARKET SESSION GUIDANCE
  // ============================================================================

  private getMarketSessionGuidance(context: CoachingContext): CoachingMessage[] {
    const messages: CoachingMessage[] = [];

    switch (context.marketSession) {
      case 'premarket':
        messages.push({
          type: 'education',
          priority: 'low',
          title: '☀️ Pre-Market Prep Time',
          message: 'This is when you do the WORK. Mark your levels. Know your PDH/PDL. What gapped? What has news? Be READY when that bell rings.',
          relatedLesson: {
            module: 'routine',
            lesson: 'premarket-prep',
            url: '/curriculum/routine/premarket-prep'
          }
        });
        break;

      case 'open':
        messages.push({
          type: 'guidance',
          priority: 'medium',
          title: '🔔 Market Open - WAIT',
          message: 'First 15 minutes is amateur hour. ORB forming. DON\'T CHASE. Let the levels establish. The suckers get trapped now. Don\'t be a sucker.',
        });
        break;

      case 'power_hour':
        messages.push({
          type: 'guidance',
          priority: 'medium',
          title: '⚡ Power Hour',
          message: 'Final hour - the big boys are moving. Volatility spikes. If you\'re in a trade, MANAGE IT. If you\'re flat, this can be prime time for setups.',
        });
        break;

      case 'after_hours':
        messages.push({
          type: 'education',
          priority: 'low',
          title: '📝 Review Time',
          message: 'Market\'s closed. NOW you journal. What worked? What didn\'t? Be honest. The best traders are students of their own trades.',
          relatedLesson: {
            module: 'routine',
            lesson: 'trade-journaling',
            url: '/curriculum/routine/trade-journaling'
          }
        });
        break;

      case 'closed':
        messages.push({
          type: 'education',
          priority: 'low',
          title: '💤 Markets Closed',
          message: 'Rest up. Review charts. Plan tomorrow\'s watchlist. Preparation is what separates winners from losers.',
        });
        break;
    }

    return messages;
  }

  // ============================================================================
  // GAMMA GUIDANCE
  // ============================================================================

  private getGammaGuidance(context: CoachingContext): CoachingMessage[] {
    const messages: CoachingMessage[] = [];
    const gamma = context.gammaData;

    if (!gamma) return messages;

    if (gamma.regime === 'negative') {
      messages.push({
        type: 'warning',
        priority: 'medium',
        title: '🔴 Negative Gamma - WATCH OUT',
        message: 'Dealers are SHORT gamma. When price moves, it can ACCELERATE. The moves get violent. Size DOWN, stops WIDER. Don\'t get caught slipping.',
        relatedLesson: {
          module: 'advanced',
          lesson: 'gamma-exposure',
          url: '/curriculum/advanced/gamma-exposure'
        }
      });
    } else if (gamma.regime === 'positive') {
      messages.push({
        type: 'guidance',
        priority: 'low',
        title: '🟢 Positive Gamma - Range Bound',
        message: 'Dealers are LONG gamma. They\'ll fade the extremes. Price tends to stay in a range. Mean reversion plays work well here.',
      });
    }

    // Max pain proximity
    const priceDiff = Math.abs(context.currentPrice - gamma.maxPain) / context.currentPrice * 100;
    if (priceDiff < 0.5) {
      messages.push({
        type: 'guidance',
        priority: 'medium',
        title: '🧲 Max Pain Zone',
        message: `Price at $${context.currentPrice.toFixed(2)}, max pain at $${gamma.maxPain.toFixed(2)}. OPEX week? Expect a pin. MMs want those options to expire worthless.`,
      });
    }

    return messages;
  }

  // ============================================================================
  // FVG GUIDANCE
  // ============================================================================

  private getFVGGuidance(context: CoachingContext): CoachingMessage[] {
    const messages: CoachingMessage[] = [];
    const fvg = context.fvgData;

    if (!fvg) return messages;

    // Near bullish FVG (potential support)
    if (fvg.nearestBullish && fvg.nearestBullish.distance < 0.5) {
      messages.push({
        type: 'opportunity',
        priority: 'medium',
        title: '📗 Bullish FVG Below',
        message: `Unfilled bullish gap at $${fvg.nearestBullish.price.toFixed(2)}. The market left something behind - it often comes back to fill. Watch for support here.`,
        relatedLesson: {
          module: 'advanced',
          lesson: 'fair-value-gaps',
          url: '/curriculum/advanced/fair-value-gaps'
        }
      });
    }

    // Near bearish FVG (potential resistance)
    if (fvg.nearestBearish && fvg.nearestBearish.distance < 0.5) {
      messages.push({
        type: 'warning',
        priority: 'medium',
        title: '📕 Bearish FVG Above',
        message: `Unfilled bearish gap at $${fvg.nearestBearish.price.toFixed(2)}. Sellers left a gap - if we go up there, expect resistance. Could be a shorting zone.`,
      });
    }

    return messages;
  }

  // ============================================================================
  // STRUCTURE BREAK GUIDANCE
  // ============================================================================

  private getStructureBreakGuidance(context: CoachingContext): CoachingMessage[] {
    const messages: CoachingMessage[] = [];
    const sb = context.structureBreak;

    if (!sb || !sb.detected) return messages;

    if (sb.type === 'bullish_break') {
      messages.push({
        type: 'opportunity',
        priority: 'high',
        title: '📈 STRUCTURE BREAK - Bullish',
        message: `Higher high after lower lows! Structure shifted bullish at $${sb.breakPrice?.toFixed(2)}. The trend might be flipping. ${sb.strength === 'strong' ? 'Strong momentum - this is real.' : 'Weak break - needs confirmation.'}`,
        relatedLesson: {
          module: 'analysis',
          lesson: 'market-structure',
          url: '/curriculum/analysis/market-structure'
        }
      });
    } else if (sb.type === 'bearish_break') {
      messages.push({
        type: 'warning',
        priority: 'high',
        title: '📉 STRUCTURE BREAK - Bearish',
        message: `Lower low after higher highs! Structure shifted bearish at $${sb.breakPrice?.toFixed(2)}. Bulls losing control. ${sb.strength === 'strong' ? 'Strong momentum - bears taking over.' : 'Weak break - watch for failed breakdown.'}`,
        relatedLesson: {
          module: 'analysis',
          lesson: 'market-structure',
          url: '/curriculum/analysis/market-structure'
        }
      });
    }

    return messages;
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private getImprovementNeeded(ltp: LTPAnalysis): string {
    const issues: string[] = [];

    if (ltp.levels.levelScore < 60) {
      issues.push('You\'re not at a level - where\'s your edge?');
    }
    if (ltp.trend.trendScore < 60) {
      issues.push('Trend\'s not clear - the trend is your friend, find one');
    }
    if (ltp.patience.patienceScore < 60) {
      issues.push('No patience candle yet - wait for confirmation');
    }

    return issues.length > 0 ? issues.join('. ') : 'Getting there. Almost tradeable.';
  }

  private describeLevelContext(ltp: LTPAnalysis): string {
    const levels: string[] = [];

    if (ltp.levels.levelProximity === 'at_level') {
      const nearest = ltp.levels.nearest[0];
      if (nearest) {
        levels.push(`Testing ${nearest.type.toUpperCase()} at $${nearest.price.toFixed(2)}`);
      }
    }

    if (ltp.levels.pricePosition === 'above_vwap') {
      levels.push('Above VWAP - bullish bias, favor longs');
    } else if (ltp.levels.pricePosition === 'below_vwap') {
      levels.push('Below VWAP - bearish bias, favor shorts');
    }

    return levels.join('. ');
  }

  /**
   * Get coaching for screenshot analysis results - Somesh style
   */
  getScreenshotCoaching(analysisResult: ScreenshotAnalysisResult): CoachingMessage[] {
    const messages: CoachingMessage[] = [];
    const { setup, recommendation, coaching } = analysisResult;

    // Get Somesh-style title based on grade
    const getGradeTitle = (quality: string, action: string): string => {
      if (quality === 'A+' || quality === 'A') {
        return action === 'ENTER' ? '🎯 SNIPER SETUP - EXECUTE' : `🎯 SNIPER SETUP - ${action}`;
      } else if (quality === 'B') {
        return `👀 DECENT SETUP - ${action}`;
      }
      return `❌ DUMB SHIT - ${action}`;
    };

    // Primary recommendation
    messages.push({
      type: recommendation.action === 'ENTER' ? 'opportunity' :
            recommendation.action === 'AVOID' ? 'warning' : 'guidance',
      priority: recommendation.action === 'ENTER' || recommendation.action === 'AVOID' ? 'high' : 'medium',
      title: getGradeTitle(setup.quality, recommendation.action),
      message: coaching.message,
      action: recommendation.action === 'ENTER' ? 'Scared money don\'t make money - execute the plan' :
              recommendation.action === 'WAIT' ? 'Patience pays the patient hand - keep watching' :
              recommendation.action === 'AVOID' ? 'There\'s always another play - find it' : undefined
    });

    // Add warnings
    for (const warning of coaching.warnings) {
      messages.push({
        type: 'warning',
        priority: 'medium',
        title: '⚠️ Watch This',
        message: warning
      });
    }

    // Add tips
    for (const tip of coaching.tips) {
      messages.push({
        type: 'education',
        priority: 'low',
        title: '💡 Pro Tip',
        message: tip
      });
    }

    // Add relevant lessons
    for (const lesson of coaching.relevantLessons) {
      messages.push({
        type: 'education',
        priority: 'low',
        title: `📚 ${lesson.title}`,
        message: lesson.relevance,
        relatedLesson: {
          module: lesson.moduleSlug,
          lesson: lesson.lessonSlug,
          url: `/curriculum/${lesson.moduleSlug}/${lesson.lessonSlug}`
        }
      });
    }

    return messages;
  }
}

// Type for screenshot analysis results
interface ScreenshotAnalysisResult {
  setup: {
    symbol?: string;
    direction?: 'LONG' | 'SHORT' | 'NEUTRAL';
    quality: 'A+' | 'A' | 'B' | 'C' | 'F';
    ltpScore: {
      level: number;
      trend: number;
      patience: number;
      overall: number;
    };
  };
  recommendation: {
    action: 'ENTER' | 'WAIT' | 'AVOID' | 'EXIT';
    reasoning: string;
  };
  coaching: {
    message: string;
    relevantLessons: {
      moduleSlug: string;
      lessonSlug: string;
      title: string;
      relevance: string;
    }[];
    warnings: string[];
    tips: string[];
  };
}

// Export singleton instance
export const kcuCoachingRules = new KCUCoachingRules();

// Export utility functions
export function getMarketSession(): 'premarket' | 'open' | 'power_hour' | 'close' | 'after_hours' | 'closed' {
  const now = new Date();
  const est = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const hours = est.getHours();
  const minutes = est.getMinutes();
  const time = hours * 60 + minutes;
  const dayOfWeek = est.getDay();

  // Weekend
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return 'closed';
  }

  // Pre-market: 4:00 AM - 9:30 AM
  if (time >= 240 && time < 570) {
    return 'premarket';
  }

  // Market open: 9:30 AM - 10:00 AM (first 30 mins)
  if (time >= 570 && time < 600) {
    return 'open';
  }

  // Regular session: 10:00 AM - 3:00 PM
  if (time >= 600 && time < 900) {
    return 'open';
  }

  // Power hour: 3:00 PM - 4:00 PM
  if (time >= 900 && time < 960) {
    return 'power_hour';
  }

  // After hours: 4:00 PM - 8:00 PM
  if (time >= 960 && time < 1200) {
    return 'after_hours';
  }

  return 'closed';
}

export function calculateRMultiple(
  entryPrice: number,
  currentPrice: number,
  stopLoss: number,
  direction: 'long' | 'short'
): number {
  const risk = Math.abs(entryPrice - stopLoss);
  if (risk === 0) return 0;

  const pnl = direction === 'long'
    ? currentPrice - entryPrice
    : entryPrice - currentPrice;

  return pnl / risk;
}

// ============================================================================
// KCU CURRICULUM CONSTANTS - Used by AI Coaching
// ============================================================================

export const KCU_CORE_QUOTES = [
  // The Big Three - LTP
  "Level. Trend. Patience. That's the whole game. Master LTP and you master the market.",
  "The trend is your friend. Don't fight the river.",
  "Patience pays the patient hand. Wait for the candle close.",
  "Levels are like magnets. Price is DRAWN to them. Trade the reactions.",

  // Execution & Mindset
  "Scared money don't make money. The setup is there. EXECUTE.",
  "Don't be a hero. Respect the stop. Live to trade another day.",
  "One good trade a day is all you need. That's the Rule of Ones.",
  "Missed trades are NOT losses. There's ALWAYS another play.",

  // Discipline
  "The market will show you EXACTLY what it wants to do. Your job is to WAIT and REACT.",
  "Don't chase entries. The suckers chase. Let the trade come to you.",
  "Size kills accounts. Risk management isn't sexy, but it keeps you in the game.",
  "95% of your profits come from 5% of your trades. Be PATIENT for the A+ setups.",

  // Key Levels
  "The 200 SMA is the line in the sand. Bulls live above it, bears live below.",
  "VWAP is your intraday compass. Above = bullish bias. Below = bearish bias.",
  "PDH/PDL - yesterday's range tells you today's battlefield.",

  // Trade Management
  "Never turn a winning trade into a loser. Move that stop to breakeven at 1R.",
  "Take partials at targets. Let runners ride. Ring the register.",
  "If something doesn't feel right, it probably isn't. Trust your gut, but HONOR YOUR PLAN.",

  // Psychology
  "Revenge trading is how accounts die. Step away after a loss.",
  "The best traders are students of their own trades. Journal EVERYTHING.",
  "You can't control the market. You CAN control your risk.",
];

export const KCU_CORE_PRINCIPLES = {
  ruleOfOnes: "ONE stock. ONE direction. ONE opportunity. That's it. Focus beats diversification every single time.",
  threeThingsAtLevels: ["Price action - what's the candle saying?", "Volume - is money flowing?", "Momentum - are the EMAs spreading or converging?"],
  threeTypesOfTrading: ["Trend following - the bread and butter", "Counter-trend reversals - high risk, high reward", "Range trading - when the market's choppy"],
  nintyFivePercentRule: "95% of your profits come from 5% of your trades. Most days you're waiting. The winners are PATIENT.",
  cFramework: "Conviction (do you believe in it?) + Confirmation (did the candle close?) + Commitment (execute the plan) = Consistent profits",
  ltpFramework: "Level (where am I trading?) + Trend (which way is the river flowing?) + Patience (did I get my candle?) = A+ Setup",
};

export const TIMEFRAME_RULES = [
  { timeframe: "Weekly/Daily", description: "The BIG picture. Where's the macro trend? Where are the KEY levels? This is your roadmap." },
  { timeframe: "4-Hour", description: "Intermediate trend confirmation. Find those significant S/R zones that everyone sees." },
  { timeframe: "1-Hour", description: "Swing trade entries. This is where the institutional boys play." },
  { timeframe: "15-Min", description: "The patience candle timeframe. Wait for the close. Don't anticipate." },
  { timeframe: "5-Min", description: "Scalp precision. Quick in, quick out. Not for everyone." },
];

export const PATIENCE_CANDLE_TYPES = [
  { type: "hammer", direction: "bullish", description: "Hammer at support - buyers stepped in HARD. Long lower wick says 'we ain't going lower.'" },
  { type: "inverted_hammer", direction: "bullish", description: "Inverted hammer at support - buyers testing. Could be reversal cooking." },
  { type: "bullish_engulfing", direction: "bullish", description: "Engulfing green candle - bulls just swallowed the bears. Strong signal at support." },
  { type: "morning_star", direction: "bullish", description: "Morning star - three-candle reversal. When you see this at support, PAY ATTENTION." },
  { type: "shooting_star", direction: "bearish", description: "Shooting star at resistance - sellers rejected higher prices. Bears stepping in." },
  { type: "hanging_man", direction: "bearish", description: "Hanging man at resistance - looks bullish but it's a trap. Sellers testing." },
  { type: "bearish_engulfing", direction: "bearish", description: "Engulfing red candle - bears just ate the bulls for lunch. Strong signal at resistance." },
  { type: "evening_star", direction: "bearish", description: "Evening star - three-candle reversal at resistance. The party's over for the bulls." },
];

export const LEVEL_RULES = {
  howToDraw: [
    "Use the 4-hour chart - find levels with 2+ touches. If price respects it TWICE, it's real.",
    "Where did price REVERSE hard? Those are your key levels.",
    "Draw from the BODIES, not the wicks. Wicks are noise, bodies show intent.",
    "Levels that TRAPPED traders are gold - look for big moves away from a level.",
    "PDH/PDL - yesterday's high and low. These are ALWAYS in play.",
    "VWAP is your intraday dynamic level. Institutions use it. You should too.",
  ],
  keyPrinciple: "Levels are ZONES, not exact prices. Give yourself a 0.5-1% buffer. Don't get stopped out by a wick.",
};

export const SMA_200_RULES = {
  corePrinciple: "The 200 SMA is the LINE IN THE SAND. This is where bulls and bears go to war.",
  rules: [
    "Above 200 SMA = bullish bias. Favor calls. Favor longs. Don't fight it.",
    "Below 200 SMA = bearish bias. Favor puts. Favor shorts. Don't fight it.",
    "AT the 200 SMA = KEY decision zone. This is where fortunes are made and lost. WAIT for confirmation.",
    "The SLOPE matters - rising 200 SMA = macro uptrend. Falling = macro downtrend.",
    "Bounces off 200 SMA are high-probability entries. Add this to your watchlist when price approaches.",
  ],
};

export const PROFIT_TARGETS = [
  "First target: 1R - RING THE REGISTER. Take 50% off. You're playing with house money now.",
  "Second target: 2R - Take another 25% off. BANK THOSE PROFITS.",
  "Runner: Let the remaining 25% ride with a trailing stop. This is where home runs happen.",
];

export const PROFIT_TAKING_METHOD = [
  "Have a plan BEFORE you enter. Know your targets. Know your stop. No plan = gambling.",
  "Scale out in thirds: 1/3 at 1R, 1/3 at 2R, let 1/3 run. This is how you compound winners.",
  "Stop to breakeven after first target. NEVER turn a winner into a loser.",
  "It's okay to take profits early if something doesn't feel right. Trust your gut sometimes.",
  "Greed kills accounts. A profit is a profit. Take what the market gives you.",
];

export const VOLUME_RULES = {
  interpretations: [
    { condition: "High volume at level", meaning: "BIG BOYS are interested. Watch for confirmation. Something's happening." },
    { condition: "Low volume rally", meaning: "WEAK. This move is on fumes. Expect failure." },
    { condition: "Volume spike on breakout", meaning: "VALID breakout. Real money is flowing. Follow the move." },
    { condition: "Volume climax", meaning: "EXHAUSTION. Everyone's in. Nobody left to buy/sell. Reversal incoming." },
    { condition: "Declining volume in trend", meaning: "Trend is TIRED. Interest is fading. Be cautious." },
  ],
};

export const MOMENTUM_RULES = {
  strongMomentum: [
    "Wide-range candles - the market is MOVING",
    "Consecutive same-color candles - momentum is BUILDING",
    "Price staying at highs/lows of range - buyers/sellers in CONTROL",
    "EMAs spreading apart - trend is ACCELERATING",
  ],
  weakMomentum: [
    "Small doji candles - INDECISION. Nobody knows what's next.",
    "Mixed candle colors - CHOP. Stay out.",
    "Long wicks - REJECTION. Buyers and sellers fighting.",
    "EMAs converging - trend is DYING. Prepare for reversal or range.",
  ],
};

export const GAP_STRATEGY = {
  gapDown: "Gap down? Wait for break of pre-market low. If it RECLAIMS the gap = CALLS. Suckers got trapped short.",
  gapUp: "Gap up? Wait for break of pre-market high. If it FAILS to hold = PUTS. Suckers got trapped long.",
  whyItWorks: "Gaps trap traders. The amateurs chase, then get squeezed when smart money reverses it. Trade the REVERSAL, not the chase.",
};

export const ORB_RULES = {
  definition: "Opening Range Breakout - first 15-30 minutes high/low. This is where the battlefield gets drawn.",
  uses: [
    "Above ORB high = bullish bias for the day. Favor longs.",
    "Below ORB low = bearish bias for the day. Favor shorts.",
    "ORB range = the day's initial value area. Know these numbers.",
    "FAILED ORB breakouts are GOLD. The trap is set, now fade it.",
  ],
};

export const DYNAMITE_LEVELS = {
  definition: "DYNAMITE = Day's low, Yesterday's high/low, Next day's open, All-time highs/lows, Monthly levels, Intraday pivots, Technical levels, Earnings/events",
  additionalLevels: "PDH, PDL, PWH, PWL, VWAP, 200 SMA, 50 SMA, 20 EMA, 9 EMA - KNOW THESE NUMBERS",
  tradingRules: [
    "More levels clustered = STRONGER zone. Confluence is KING.",
    "Trade the REACTION at the level, not your expectation of what should happen.",
    "WAIT for the candle to close. Patience pays the patient hand.",
  ],
};

export const REVERSAL_RULES = {
  keyPrinciple: "Reversals need THREE things: EXHAUSTION + LEVEL + PATIENCE CANDLE. Miss one? Skip the trade.",
  requirements: [
    "Price at a SIGNIFICANT level. Not some random line you drew.",
    "EXHAUSTION - volume climax, extended move, everyone's on one side of the boat.",
    "PATIENCE CANDLE - wait for confirmation. Don't anticipate reversals.",
    "Counter-trend plays are LOWER probability. Size accordingly.",
  ],
  successRate: "Reversals are harder than trend trades. But when they work? BIG rewards. Risk/reward makes up for lower hit rate.",
};

export const RISK_MANAGEMENT = {
  positionSizing: [
    "Never risk more than 1-2% of your account on ONE trade. This is NON-NEGOTIABLE.",
    "Size based on your STOP LOSS distance, not your greed or your ego.",
    "Unsure? SIZE DOWN. You can always add if you're right.",
    "Bigger account = same percentage. The math scales. Don't get crazy.",
  ],
  riskReward: [
    "Minimum 2:1 risk/reward. If you can't get 2:1, SKIP THE TRADE.",
    "A+ setups justify 3:1 or better. This is where you make real money.",
    "Below 1:1 R/R? That's not trading. That's gambling.",
  ],
  stopLossRules: [
    "Stop goes on the OTHER SIDE of the level or patience candle. Logic, not hope.",
    "NEVER move your stop further from entry. This is how accounts blow up.",
    "Mental stops don't work. Use HARD stops. The market doesn't care about your feelings.",
  ],
};

export const COMMON_MISTAKES = [
  { mistake: "Chasing entries", solution: "STOP CHASING. Let the trade come to you. Wait for pullbacks to levels." },
  { mistake: "No stop loss", solution: "No stop = gambling. ALWAYS define your risk BEFORE entry." },
  { mistake: "Overtrading", solution: "Quality over quantity. 1-3 good trades a DAY. That's it. More isn't better." },
  { mistake: "Moving stop further", solution: "DON'T BE A HERO. Accept the loss. Move on. Live to trade another day." },
  { mistake: "Averaging down", solution: "Adding to losers is how accounts die. CUT losers, ADD to winners." },
  { mistake: "Trading FOMO", solution: "Missed trades are NOT losses. There's ALWAYS another play." },
  { mistake: "Not taking profits", solution: "Greed kills. Follow your profit plan. Ring the register." },
  { mistake: "Fighting the trend", solution: "The trend is your FRIEND. Stop fighting the river." },
  { mistake: "Revenge trading", solution: "Lost money? Walk away. Revenge trading doubles your losses." },
  { mistake: "No trade plan", solution: "No plan = no edge. Know your entry, stop, and targets BEFORE you click." },
];
