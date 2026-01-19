/**
 * KCU Coaching Rules Service
 *
 * Provides real-time coaching guidance based on KCU curriculum principles.
 * Uses the LTP (Level, Trend, Patience) framework to evaluate setups
 * and provide actionable coaching messages.
 */

import type { LTPAnalysis } from './market-data';

// ============================================================================
// TYPES
// ============================================================================

export interface CoachingContext {
  symbol: string;
  currentPrice: number;
  ltpAnalysis: LTPAnalysis | null;
  gammaData?: GammaContext | null;
  fvgData?: FVGContext | null;
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
   * Evaluate setup quality and return grade explanation
   */
  getGradeExplanation(grade: string, ltp: LTPAnalysis): string {
    const levelScore = ltp.levels.levelScore;
    const trendScore = ltp.trend.trendScore;
    const patienceScore = ltp.patience.patienceScore;

    switch (grade) {
      case 'A+':
        return 'Perfect LTP alignment. All components scoring 80+. This is an ideal setup per KCU methodology.';
      case 'A':
        return 'Strong LTP alignment. Most components are excellent with minor gaps. High-probability setup.';
      case 'B':
        return `Good potential but needs improvement. ${this.getWeakestComponent(levelScore, trendScore, patienceScore)} needs attention.`;
      case 'C':
        return 'Marginal setup. Multiple LTP components are weak. Consider waiting for better confirmation.';
      case 'D':
        return 'Poor setup. LTP framework not aligned. High risk of failed trade.';
      case 'F':
        return 'No tradeable setup. Avoid this entry. Wait for proper LTP alignment.';
      default:
        return 'Setup quality under evaluation.';
    }
  }

  private getWeakestComponent(level: number, trend: number, patience: number): string {
    const min = Math.min(level, trend, patience);
    if (min === level) return 'Level proximity';
    if (min === trend) return 'Trend alignment';
    return 'Patience confirmation';
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
        title: 'Awaiting Analysis',
        message: 'Select a symbol to begin LTP analysis. Focus on your watchlist for best results.',
        action: 'Add symbols to watchlist'
      });
      return messages;
    }

    // Grade-based guidance
    if (ltp.grade === 'A+' || ltp.grade === 'A') {
      messages.push({
        type: 'opportunity',
        priority: 'high',
        title: `High-Quality Setup: ${context.symbol}`,
        message: `${context.symbol} showing ${ltp.grade} grade setup. ${ltp.recommendation}`,
        action: 'Switch to Focus mode to monitor entry',
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
        title: `Developing Setup: ${context.symbol}`,
        message: `B-grade setup forming. ${this.getImprovementNeeded(ltp)}`,
        action: 'Continue monitoring for improvement'
      });
    }

    // Level proximity alerts
    if (ltp.levels.levelProximity === 'at_level') {
      messages.push({
        type: 'opportunity',
        priority: 'high',
        title: 'At Key Level',
        message: `Price at key level. ${this.describeLevelContext(ltp)}`,
        relatedLesson: {
          module: 'entries',
          lesson: 'levels-mastery',
          url: '/curriculum/entries/levels-mastery'
        }
      });
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

    // Entry timing guidance
    if (ltp.grade === 'A+' || ltp.grade === 'A') {
      if (ltp.patience.candle5m?.confirmed || ltp.patience.candle15m?.confirmed) {
        messages.push({
          type: 'opportunity',
          priority: 'high',
          title: 'Entry Signal Active',
          message: 'Patience candle confirmed. LTP aligned. Valid entry window.',
          action: 'Execute entry per trade plan',
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
          title: 'Patience Candle Forming',
          message: 'Wait for candle close confirmation. Do not anticipate the close.',
          action: 'Monitor for candle close'
        });
      }
    }

    // Trend alignment check
    if (ltp.trend.trendAlignment === 'conflicting') {
      messages.push({
        type: 'warning',
        priority: 'medium',
        title: 'Mixed Timeframe Signals',
        message: 'Daily and intraday trends are conflicting. Consider smaller position size.',
        relatedLesson: {
          module: 'analysis',
          lesson: 'multi-timeframe',
          url: '/curriculum/analysis/multi-timeframe'
        }
      });
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
        title: 'No Active Trade',
        message: 'Enter trade details to receive real-time coaching during your trade.',
        action: 'Log your entry'
      });
      return messages;
    }

    const currentR = trade.currentRMultiple;

    // R-multiple based guidance
    if (currentR >= 2) {
      messages.push({
        type: 'trade_management',
        priority: 'high',
        title: 'Target Zone Reached',
        message: `Trade at ${currentR.toFixed(1)}R. Consider taking partials. Let remainder run with trailing stop.`,
        action: 'Take 50% profits, trail rest',
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
        title: 'First Target Zone',
        message: `At 1R (${currentR.toFixed(2)}R). Move stop to breakeven if not already.`,
        action: 'Move stop to B/E'
      });
    } else if (currentR <= -0.5) {
      messages.push({
        type: 'warning',
        priority: 'high',
        title: 'Approaching Stop',
        message: `Trade at ${currentR.toFixed(2)}R. Honor your stop. No moving stops to "give it room."`,
        relatedLesson: {
          module: 'risk',
          lesson: 'stop-discipline',
          url: '/curriculum/risk/stop-discipline'
        }
      });
    }

    // Check if setup is deteriorating
    const ltp = context.ltpAnalysis;
    if (ltp && (ltp.grade === 'D' || ltp.grade === 'F')) {
      messages.push({
        type: 'warning',
        priority: 'high',
        title: 'Setup Deteriorating',
        message: 'LTP analysis shows setup quality has degraded. Consider early exit.',
        action: 'Evaluate exit'
      });
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
          title: 'Pre-Market Prep',
          message: 'Review watchlist, mark key levels, identify PDH/PDL. Wait for ORB levels to establish.',
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
          title: 'Market Open',
          message: 'First 15 mins = ORB formation. Observe, don\'t chase. Let levels establish.',
        });
        break;

      case 'power_hour':
        messages.push({
          type: 'guidance',
          priority: 'low',
          title: 'Power Hour Active',
          message: 'Final hour often sees increased volatility. Manage open positions carefully.',
        });
        break;

      case 'after_hours':
        messages.push({
          type: 'education',
          priority: 'low',
          title: 'After Hours',
          message: 'Review today\'s trades. Journal entries, exits, and lessons learned.',
          relatedLesson: {
            module: 'routine',
            lesson: 'trade-journaling',
            url: '/curriculum/routine/trade-journaling'
          }
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
        title: 'Negative Gamma Environment',
        message: 'Dealers short gamma. Moves can accelerate. Use wider stops, smaller size.',
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
        title: 'Positive Gamma Environment',
        message: 'Dealers long gamma. Expect mean reversion. Fade extremes, trade ranges.',
      });
    }

    // Max pain proximity
    const priceDiff = Math.abs(context.currentPrice - gamma.maxPain) / context.currentPrice * 100;
    if (priceDiff < 0.5) {
      messages.push({
        type: 'guidance',
        priority: 'low',
        title: 'Near Max Pain',
        message: `Price near max pain ($${gamma.maxPain.toFixed(2)}). Pin risk elevated for OPEX.`,
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
        title: 'Bullish FVG Nearby',
        message: `Unfilled bullish FVG at $${fvg.nearestBullish.price.toFixed(2)}. Potential support zone.`,
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
        title: 'Bearish FVG Above',
        message: `Unfilled bearish FVG at $${fvg.nearestBearish.price.toFixed(2)}. Potential resistance zone.`,
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
      issues.push('Price not at key level');
    }
    if (ltp.trend.trendScore < 60) {
      issues.push('Trend not clearly defined');
    }
    if (ltp.patience.patienceScore < 60) {
      issues.push('Waiting for patience candle confirmation');
    }

    return issues.length > 0 ? issues.join('. ') + '.' : 'Minor improvements needed.';
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
      levels.push('Above VWAP (bullish bias)');
    } else if (ltp.levels.pricePosition === 'below_vwap') {
      levels.push('Below VWAP (bearish bias)');
    }

    return levels.join('. ');
  }

  /**
   * Get coaching for screenshot analysis results
   */
  getScreenshotCoaching(analysisResult: ScreenshotAnalysisResult): CoachingMessage[] {
    const messages: CoachingMessage[] = [];
    const { setup, recommendation, coaching } = analysisResult;

    // Primary recommendation
    messages.push({
      type: recommendation.action === 'ENTER' ? 'opportunity' :
            recommendation.action === 'AVOID' ? 'warning' : 'guidance',
      priority: recommendation.action === 'ENTER' || recommendation.action === 'AVOID' ? 'high' : 'medium',
      title: `${setup.quality} Grade Setup - ${recommendation.action}`,
      message: coaching.message,
      action: recommendation.action === 'ENTER' ? 'Execute per plan' :
              recommendation.action === 'WAIT' ? 'Monitor for improvement' :
              recommendation.action === 'AVOID' ? 'Find better setup' : undefined
    });

    // Add warnings
    for (const warning of coaching.warnings) {
      messages.push({
        type: 'warning',
        priority: 'medium',
        title: 'Chart Warning',
        message: warning
      });
    }

    // Add tips
    for (const tip of coaching.tips) {
      messages.push({
        type: 'education',
        priority: 'low',
        title: 'Coaching Tip',
        message: tip
      });
    }

    // Add relevant lessons
    for (const lesson of coaching.relevantLessons) {
      messages.push({
        type: 'education',
        priority: 'low',
        title: lesson.title,
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
