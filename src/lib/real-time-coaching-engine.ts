/**
 * Real-Time Coaching Engine
 *
 * Monitors price movements and triggers instant coaching guidance based on:
 * - Level approaches (VWAP, gamma walls, key levels)
 * - VWAP crosses (bullish/bearish regime change)
 * - Gamma flips (volatility mode changes)
 * - R-multiple milestones during trades
 *
 * Integrates with the Price Bridge to process real-time ticks and
 * broadcasts coaching updates via SSE to the Companion terminal.
 */

import { broadcastCoachingUpdate, type CoachingUpdateEvent } from './broadcast';

// ============================================================================
// TYPES
// ============================================================================

interface UserCoachingContext {
  symbol: string;
  levels: {
    vwap: number;
    putWall: number;
    callWall: number;
    zeroGamma: number;
    pdh?: number;
    pdl?: number;
    orbHigh?: number;
    orbLow?: number;
  };
  lastPrice: number;
  wasAboveVwap: boolean;
  wasPositiveGamma: boolean;
  activeTrade?: {
    direction: 'long' | 'short';
    entryPrice: number;
    stopLoss: number;
    lastRMultiple: number;
  };
  lastEventTime: Map<string, number>; // Throttle per event type
}

// ============================================================================
// REAL-TIME COACHING ENGINE
// ============================================================================

class RealTimeCoachingEngine {
  private userContexts: Map<string, UserCoachingContext> = new Map();
  private readonly THROTTLE_MS = 5000; // 5s minimum between same event type
  private readonly LEVEL_APPROACH_THRESHOLD = 0.5; // 0.5% distance triggers approach
  private readonly LEVEL_VERY_CLOSE_THRESHOLD = 0.2; // 0.2% = very close warning

  /**
   * Set or update coaching context for a user
   */
  setUserContext(userId: string, context: Omit<UserCoachingContext, 'lastEventTime'>) {
    const existing = this.userContexts.get(userId);
    this.userContexts.set(userId, {
      ...context,
      lastEventTime: existing?.lastEventTime || new Map(),
    });
  }

  /**
   * Update active trade for a user
   */
  setActiveTrade(
    userId: string,
    trade: UserCoachingContext['activeTrade'] | undefined
  ) {
    const ctx = this.userContexts.get(userId);
    if (ctx) {
      ctx.activeTrade = trade;
    }
  }

  /**
   * Remove user context on disconnect
   */
  removeUser(userId: string) {
    this.userContexts.delete(userId);
  }

  /**
   * Process a price update and generate coaching events
   */
  async processPrice(userId: string, symbol: string, price: number): Promise<void> {
    const ctx = this.userContexts.get(userId);
    if (!ctx || ctx.symbol !== symbol) return;

    const events: CoachingUpdateEvent[] = [];

    // --- Check Level Approaches ---
    const levelChecks: Array<{ name: string; level: number | undefined }> = [
      { name: 'VWAP', level: ctx.levels.vwap },
      { name: 'Put Wall', level: ctx.levels.putWall },
      { name: 'Call Wall', level: ctx.levels.callWall },
      { name: 'Zero Gamma', level: ctx.levels.zeroGamma },
      { name: 'PDH', level: ctx.levels.pdh },
      { name: 'PDL', level: ctx.levels.pdl },
      { name: 'ORB High', level: ctx.levels.orbHigh },
      { name: 'ORB Low', level: ctx.levels.orbLow },
    ];

    for (const { name, level } of levelChecks) {
      if (!level || level <= 0) continue;

      const distancePercent = Math.abs((price - level) / price) * 100;

      if (distancePercent <= this.LEVEL_APPROACH_THRESHOLD && distancePercent > 0.05) {
        const event = this.createLevelApproachEvent(
          symbol,
          name,
          level,
          price,
          distancePercent
        );
        if (this.shouldBroadcast(ctx, event.eventType + ':' + name)) {
          events.push(event);
        }
      }
    }

    // --- Check VWAP Cross ---
    if (ctx.levels.vwap > 0) {
      const isAboveVwap = price > ctx.levels.vwap;
      if (isAboveVwap !== ctx.wasAboveVwap && ctx.lastPrice > 0) {
        const event = this.createVwapCrossEvent(symbol, isAboveVwap, price, ctx.levels.vwap);
        if (this.shouldBroadcast(ctx, 'vwap_cross')) {
          events.push(event);
        }
        ctx.wasAboveVwap = isAboveVwap;
      }
    }

    // --- Check Gamma Regime Flip ---
    if (ctx.levels.zeroGamma > 0) {
      const isPositiveGamma = price > ctx.levels.zeroGamma;
      if (isPositiveGamma !== ctx.wasPositiveGamma && ctx.lastPrice > 0) {
        const event = this.createGammaFlipEvent(symbol, isPositiveGamma, price);
        if (this.shouldBroadcast(ctx, 'gamma_flip')) {
          events.push(event);
        }
        ctx.wasPositiveGamma = isPositiveGamma;
      }
    }

    // --- Check R-Multiple Milestones (if in active trade) ---
    if (ctx.activeTrade) {
      const rMultiple = this.calculateRMultiple(
        ctx.activeTrade.entryPrice,
        price,
        ctx.activeTrade.stopLoss,
        ctx.activeTrade.direction
      );

      const milestones = [1, 2, 3, -0.5]; // 1R, 2R, 3R, and half-stop warning
      for (const milestone of milestones) {
        const crossed =
          milestone > 0
            ? rMultiple >= milestone && ctx.activeTrade.lastRMultiple < milestone
            : rMultiple <= milestone && ctx.activeTrade.lastRMultiple > milestone;

        if (crossed) {
          const event = this.createRMilestoneEvent(
            symbol,
            milestone,
            rMultiple,
            price,
            ctx.activeTrade.direction
          );
          if (this.shouldBroadcast(ctx, `r_milestone:${milestone}`)) {
            events.push(event);
          }
        }
      }

      ctx.activeTrade.lastRMultiple = rMultiple;
    }

    // Update last price
    ctx.lastPrice = price;

    // Broadcast events
    for (const event of events) {
      await broadcastCoachingUpdate(userId, event);
      ctx.lastEventTime.set(event.eventType, Date.now());
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private shouldBroadcast(ctx: UserCoachingContext, eventKey: string): boolean {
    const lastTime = ctx.lastEventTime.get(eventKey) || 0;
    return Date.now() - lastTime >= this.THROTTLE_MS;
  }

  private createLevelApproachEvent(
    symbol: string,
    levelName: string,
    level: number,
    price: number,
    distancePercent: number
  ): CoachingUpdateEvent {
    const isVeryClose = distancePercent <= this.LEVEL_VERY_CLOSE_THRESHOLD;
    const direction = price < level ? 'approaching from below' : 'approaching from above';

    return {
      symbol,
      eventType: 'level_approach',
      priority: isVeryClose ? 'high' : 'medium',
      message: {
        type: 'warning',
        content: isVeryClose
          ? `At ${levelName} ($${level.toFixed(2)}) - watch for reaction!`
          : `${distancePercent.toFixed(1)}% from ${levelName} at $${level.toFixed(2)}`,
        emoji: isVeryClose ? '🚨' : '🎯',
      },
      context: {
        currentPrice: price,
        relevantLevel: level,
        direction: price > level ? 'bullish' : 'bearish',
      },
      timestamp: new Date().toISOString(),
    };
  }

  private createVwapCrossEvent(
    symbol: string,
    isBullish: boolean,
    price: number,
    vwap: number
  ): CoachingUpdateEvent {
    return {
      symbol,
      eventType: 'vwap_cross',
      priority: 'high',
      message: {
        type: isBullish ? 'opportunity' : 'warning',
        content: isBullish
          ? 'VWAP reclaimed! Bulls back in control. Look for continuation above.'
          : 'Lost VWAP. Bears taking over. Watch for failed retests.',
        emoji: isBullish ? '🚀' : '⚠️',
      },
      context: {
        currentPrice: price,
        relevantLevel: vwap,
        direction: isBullish ? 'bullish' : 'bearish',
      },
      timestamp: new Date().toISOString(),
    };
  }

  private createGammaFlipEvent(
    symbol: string,
    isPositive: boolean,
    price: number
  ): CoachingUpdateEvent {
    return {
      symbol,
      eventType: 'gamma_flip',
      priority: 'critical',
      message: {
        type: 'warning',
        content: isPositive
          ? 'Entered POSITIVE gamma. Dealers hedging bullish. Expect mean reversion to key levels.'
          : 'Entered NEGATIVE gamma. VOLATILITY MODE. Expect amplified moves. SIZE DOWN.',
        emoji: isPositive ? '📈' : '⚡',
      },
      context: {
        currentPrice: price,
        direction: isPositive ? 'bullish' : 'bearish',
      },
      timestamp: new Date().toISOString(),
    };
  }

  private createRMilestoneEvent(
    symbol: string,
    milestone: number,
    currentR: number,
    price: number,
    direction: 'long' | 'short'
  ): CoachingUpdateEvent {
    if (milestone === -0.5) {
      return {
        symbol,
        eventType: 'r_milestone',
        priority: 'critical',
        message: {
          type: 'warning',
          content: `Halfway to stop! Currently at ${currentR.toFixed(1)}R. Consider reducing size or adjusting stop.`,
          emoji: '🛑',
        },
        context: { currentPrice: price, direction: direction === 'long' ? 'bullish' : 'bearish' },
        timestamp: new Date().toISOString(),
      };
    }

    const messages: Record<number, { content: string; emoji: string }> = {
      1: {
        content: `Hit 1R target! Consider taking partials. Move stop to break-even on remaining.`,
        emoji: '💰',
      },
      2: {
        content: `2R reached! Lock in profits. Trail stop tight on remaining position.`,
        emoji: '🔥',
      },
      3: {
        content: `3R achieved! Home run! Consider closing most of position.`,
        emoji: '🎉',
      },
    };

    const msg = messages[milestone] || { content: `${milestone}R reached!`, emoji: '✅' };

    return {
      symbol,
      eventType: 'r_milestone',
      priority: 'high',
      message: {
        type: 'guidance',
        content: msg.content,
        emoji: msg.emoji,
      },
      context: { currentPrice: price, direction: direction === 'long' ? 'bullish' : 'bearish' },
      timestamp: new Date().toISOString(),
    };
  }

  private calculateRMultiple(
    entry: number,
    current: number,
    stop: number,
    direction: 'long' | 'short'
  ): number {
    const risk = Math.abs(entry - stop);
    if (risk === 0) return 0;

    const pnl = direction === 'long' ? current - entry : entry - current;
    return pnl / risk;
  }
}

// Export singleton instance
export const coachingEngine = new RealTimeCoachingEngine();
