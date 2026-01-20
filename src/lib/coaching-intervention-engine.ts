/**
 * Coaching Intervention Engine - The "Brain" of the Proactive Coach
 *
 * This is the centralized decision engine that determines:
 * - WHEN to intervene (market conditions, user behavior, events)
 * - HOW to intervene (nudge, warning, blocking)
 * - WHAT to say (via VoiceSynthesizer)
 *
 * "The trend is your friend. Don't fight the river."
 */

import type {
  MarketBreadth,
  ProactiveWarning,
  EnhancedEconomicEvent,
  MarketHotContext,
} from './market-data';
import type {
  TradingWeakness,
  UserTradingProfile,
} from '@/types';
import type { UserProfileContext } from '@/types/ai';

// =============================================================================
// TYPES
// =============================================================================

export type InterventionSeverity = 'nudge' | 'warning' | 'dumb_shit';

export type InterventionType =
  | 'market_breadth'      // Don't fight the river
  | 'economic_event'      // Fed speaking
  | 'user_weakness'       // Known bad habit detected
  | 'mental_capital'      // Emotional state
  | 'trade_validation'    // Pre-trade check
  | 'pattern_detection'   // Behavioral pattern
  | 'risk_violation'      // Size/exposure issues
  | 'timing';             // Wrong time to trade

export interface TradeIntent {
  symbol: string;
  direction: 'long' | 'short';
  price: number;
  size: number;
  stopLoss?: number;
  target?: number;
  reasoning?: string;
  timestamp?: string;
}

export interface InterventionResult {
  approved: boolean;
  severity: InterventionSeverity;
  type: InterventionType;
  title: string;
  message: string;               // Somesh-style message
  technicalReason?: string;      // For logging/analysis
  suggestedAction?: string;
  blockedReason?: string;        // If blocked, why
  warnings: string[];            // Additional warnings
  relatedLesson?: {
    module: string;
    lesson: string;
    url: string;
  };
}

export interface InterventionContext {
  // Market state
  breadth: MarketBreadth | null;
  hotContext: MarketHotContext | null;
  currentEvent: EnhancedEconomicEvent | null;

  // User state
  userProfile: UserProfileContext | null;
  todayTradeCount: number;
  todayPnL: number;
  isInTrade: boolean;

  // Trade intent (if checking a trade)
  tradeIntent?: TradeIntent;
}

// =============================================================================
// VOICE SYNTHESIZER - Somesh-Style Message Generator
// =============================================================================

export class VoiceSynthesizer {
  private readonly greetings = [
    "Listen up.",
    "Alright,",
    "Here's the deal.",
    "Pay attention.",
    "Real talk -",
  ];

  private readonly closings = [
    "That's the rule.",
    "Don't fight it.",
    "Stay disciplined.",
    "Patience pays.",
    "Trust the process.",
  ];

  /**
   * Transform a generic message into Somesh-style coaching
   */
  synthesize(
    message: string,
    severity: InterventionSeverity,
    type: InterventionType
  ): string {
    switch (severity) {
      case 'dumb_shit':
        return this.synthesizeDumbShit(message, type);
      case 'warning':
        return this.synthesizeWarning(message, type);
      case 'nudge':
        return this.synthesizeNudge(message, type);
    }
  }

  private synthesizeDumbShit(message: string, type: InterventionType): string {
    const prefixes: Record<InterventionType, string[]> = {
      market_breadth: [
        "🚨 DUMB SHIT ALERT. You're fighting the river.",
        "🛑 The market is telling you NO. Why aren't you listening?",
        "💀 This is how accounts blow up.",
      ],
      economic_event: [
        "🚨 WHAT ARE YOU DOING? Fed speaks in minutes!",
        "💀 You want to hold through this? That's gambling, not trading.",
      ],
      user_weakness: [
        "🚨 Here we go again. Same mistake, different day.",
        "💀 I've warned you about this before. STOP.",
        "🛑 This is YOUR pattern. Break it or it breaks you.",
      ],
      mental_capital: [
        "🛑 STOP. Your head isn't right. Step away.",
        "💀 You're tilted. Every trade from here is revenge trading.",
        "🚨 Mental capital depleted. You're done for today.",
      ],
      trade_validation: [
        "🛑 This trade has no edge. It's DUMB SHIT.",
        "💀 Where's your level? Where's your stop? This is gambling.",
      ],
      pattern_detection: [
        "🚨 I see what you're doing. Don't.",
        "💀 Pattern recognized: You're about to do something stupid.",
      ],
      risk_violation: [
        "🛑 POSITION TOO BIG. Size kills accounts.",
        "💀 You're risking your month on one trade. Don't be a hero.",
      ],
      timing: [
        "🚨 Why are you trading right now? This is amateur hour.",
        "💀 Bad timing. Wait for the setup.",
      ],
    };

    const prefix = this.randomChoice(prefixes[type] || prefixes.trade_validation);
    return `${prefix}\n\n${message}\n\nDon't be a statistic. Close this and walk away.`;
  }

  private synthesizeWarning(message: string, type: InterventionType): string {
    const prefixes: Record<InterventionType, string[]> = {
      market_breadth: [
        "⚠️ The river's flowing the other way.",
        "⚠️ Market breadth says be careful here.",
        "⚠️ ADD/VOLD not supporting this direction.",
      ],
      economic_event: [
        "⚠️ High-impact event approaching.",
        "⚠️ Economic data dropping soon.",
        "⚠️ Calendar check - heads up.",
      ],
      user_weakness: [
        "⚠️ Watch yourself here. This is a trigger for you.",
        "⚠️ Careful - this looks like one of your patterns.",
        "⚠️ Remember what we talked about?",
      ],
      mental_capital: [
        "⚠️ Check your mental state.",
        "⚠️ You've had some losses. Size down.",
        "⚠️ Mental capital running low.",
      ],
      trade_validation: [
        "⚠️ This setup needs work.",
        "⚠️ Something's off here. Double-check.",
        "⚠️ Not your best setup.",
      ],
      pattern_detection: [
        "⚠️ I'm seeing a pattern forming.",
        "⚠️ Watch out - behavioral pattern detected.",
      ],
      risk_violation: [
        "⚠️ Size check - you sure about this?",
        "⚠️ Risk is getting elevated.",
      ],
      timing: [
        "⚠️ Timing isn't ideal.",
        "⚠️ Market session consideration.",
      ],
    };

    const prefix = this.randomChoice(prefixes[type] || prefixes.trade_validation);
    return `${prefix}\n\n${message}`;
  }

  private synthesizeNudge(message: string, type: InterventionType): string {
    const prefixes = [
      "💭 Quick thought -",
      "💡 Reminder:",
      "📝 Note to self:",
      "👀 Just checking -",
    ];

    const prefix = this.randomChoice(prefixes);
    return `${prefix} ${message}`;
  }

  /**
   * Generate a positive affirmation for good behavior
   */
  generateAffirmation(behavior: string): string {
    const affirmations = [
      `✅ Good discipline. ${behavior}. This is how winners trade.`,
      `💪 That's the way. ${behavior}. Patience pays.`,
      `🎯 Sniper mentality. ${behavior}. Keep it up.`,
      `👑 This is the way. ${behavior}. Consistency over excitement.`,
    ];
    return this.randomChoice(affirmations);
  }

  /**
   * Generate market commentary in Somesh style
   */
  generateMarketCommentary(breadth: MarketBreadth): string {
    const { add, vold, tradingBias, healthScore } = breadth;

    if (tradingBias === 'favor_longs' && healthScore > 70) {
      return "🟢 Market's healthy. ADD is positive, VOLD is buying. The river's flowing UP. Favor longs, but still wait for YOUR setup.";
    }

    if (tradingBias === 'favor_shorts' && healthScore < 30) {
      return "🔴 Market's weak. ADD is tanking, selling pressure heavy. The river's flowing DOWN. Favor shorts or stay flat.";
    }

    if (tradingBias === 'caution') {
      return "🟡 Mixed signals. ADD and VOLD are fighting. Choppy water ahead. Size down or sit on your hands.";
    }

    return "Market's neutral. No strong bias. Wait for your setup. Patience pays the patient hand.";
  }

  private randomChoice<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
  }
}

// =============================================================================
// INTERVENTION RULES
// =============================================================================

interface InterventionRule {
  id: string;
  name: string;
  check: (context: InterventionContext) => InterventionResult | null;
  priority: number; // Higher = checked first
}

const interventionRules: InterventionRule[] = [
  // ============================================
  // CRITICAL: Mental Capital Check
  // ============================================
  {
    id: 'mental_capital_critical',
    name: 'Critical Mental Capital',
    priority: 100,
    check: (ctx) => {
      if (!ctx.userProfile) return null;
      if (ctx.userProfile.mentalCapital > 30) return null;

      return {
        approved: false,
        severity: 'dumb_shit',
        type: 'mental_capital',
        title: 'MENTAL CAPITAL DEPLETED',
        message: `Your mental capital is at ${ctx.userProfile.mentalCapital}/100. You're not in the right headspace to trade. The market will be here tomorrow. You won't if you blow up today.`,
        blockedReason: 'Mental capital below safe threshold',
        technicalReason: `Mental capital: ${ctx.userProfile.mentalCapital}`,
        suggestedAction: 'Step away from the screen. Journal what happened. Reset for tomorrow.',
        warnings: [],
      };
    },
  },

  // ============================================
  // CRITICAL: Imminent Economic Event
  // ============================================
  {
    id: 'imminent_event',
    name: 'Imminent High-Impact Event',
    priority: 95,
    check: (ctx) => {
      if (!ctx.hotContext?.calendar?.isEventImminent) return null;
      const event = ctx.hotContext.calendar.imminentEvent;
      if (!event || event.impact !== 'high') return null;

      return {
        approved: false,
        severity: 'dumb_shit',
        type: 'economic_event',
        title: `${event.event} IN ${event.minutesUntilEvent} MINUTES`,
        message: `${event.event} drops in ${event.minutesUntilEvent} minutes. This can MOVE the market 1-2% in seconds. Flatten positions or stay flat. Don't gamble.`,
        blockedReason: `High-impact event imminent: ${event.event}`,
        technicalReason: `Event: ${event.event}, Minutes: ${event.minutesUntilEvent}`,
        suggestedAction: 'Flatten all positions. Wait for the dust to settle.',
        warnings: [],
      };
    },
  },

  // ============================================
  // CRITICAL: Strong Bearish Breadth + Long Intent
  // ============================================
  {
    id: 'breadth_vs_long',
    name: 'Bearish Breadth vs Long Trade',
    priority: 90,
    check: (ctx) => {
      if (!ctx.breadth || !ctx.tradeIntent) return null;
      if (ctx.tradeIntent.direction !== 'long') return null;
      if (ctx.breadth.add.trend !== 'strong_bearish') return null;

      return {
        approved: false,
        severity: 'dumb_shit',
        type: 'market_breadth',
        title: "DON'T FIGHT THE RIVER",
        message: `ADD is ${ctx.breadth.add.value}. The market is TANKING. Every stock is getting sold. You want to go LONG on ${ctx.tradeIntent.symbol}? That's swimming upstream in a flood. The river will drown you.`,
        blockedReason: 'Strong bearish breadth against long trade',
        technicalReason: `ADD: ${ctx.breadth.add.value}, VOLD: ${ctx.breadth.vold.value}`,
        suggestedAction: 'Wait for ADD to turn or find a short setup instead.',
        warnings: [],
        relatedLesson: {
          module: 'analysis',
          lesson: 'market-structure',
          url: '/curriculum/analysis/market-structure',
        },
      };
    },
  },

  // ============================================
  // CRITICAL: Strong Bullish Breadth + Short Intent
  // ============================================
  {
    id: 'breadth_vs_short',
    name: 'Bullish Breadth vs Short Trade',
    priority: 90,
    check: (ctx) => {
      if (!ctx.breadth || !ctx.tradeIntent) return null;
      if (ctx.tradeIntent.direction !== 'short') return null;
      if (ctx.breadth.add.trend !== 'strong_bullish') return null;

      return {
        approved: false,
        severity: 'dumb_shit',
        type: 'market_breadth',
        title: "BULLS ARE STAMPEDING",
        message: `ADD is +${ctx.breadth.add.value}. Everything is getting bid. You want to SHORT ${ctx.tradeIntent.symbol}? You'll get your face ripped off. Don't short into strength.`,
        blockedReason: 'Strong bullish breadth against short trade',
        technicalReason: `ADD: ${ctx.breadth.add.value}, VOLD: ${ctx.breadth.vold.value}`,
        suggestedAction: 'Wait for ADD to turn or find a long setup instead.',
        warnings: [],
      };
    },
  },

  // ============================================
  // WARNING: Revenge Trading Detection
  // ============================================
  {
    id: 'revenge_trading',
    name: 'Revenge Trading Detection',
    priority: 85,
    check: (ctx) => {
      if (!ctx.userProfile) return null;
      if (ctx.userProfile.consecutiveLosses < 2) return null;
      if (!ctx.userProfile.weaknesses.includes('revenge_trading')) return null;

      const severity: InterventionSeverity =
        ctx.userProfile.consecutiveLosses >= 3 ? 'dumb_shit' : 'warning';

      return {
        approved: severity !== 'dumb_shit',
        severity,
        type: 'user_weakness',
        title: 'REVENGE TRADING ALERT',
        message: `You've had ${ctx.userProfile.consecutiveLosses} losses in a row. I know what you're thinking - "I'll make it back with this next trade." That's REVENGE TRADING. That's how accounts blow up. The market took your money. Don't let it take MORE.`,
        technicalReason: `Consecutive losses: ${ctx.userProfile.consecutiveLosses}, Known weakness: revenge_trading`,
        suggestedAction: 'Step away. Come back fresh tomorrow. The market will be here.',
        warnings: ctx.userProfile.consecutiveLosses >= 3
          ? ['This trade is being blocked due to high revenge trading risk']
          : ['Proceed with extreme caution and reduced size'],
        relatedLesson: {
          module: 'psychology',
          lesson: 'revenge-trading',
          url: '/curriculum/psychology/revenge-trading',
        },
      };
    },
  },

  // ============================================
  // WARNING: Chasing Detection
  // ============================================
  {
    id: 'chasing_detection',
    name: 'Chase Entry Detection',
    priority: 80,
    check: (ctx) => {
      if (!ctx.userProfile) return null;
      if (!ctx.userProfile.weaknesses.includes('chasing_entries')) return null;
      // Would need price context to fully implement
      // For now, flag if user has this weakness

      return {
        approved: true, // Allow but warn
        severity: 'nudge',
        type: 'user_weakness',
        title: 'CHASE CHECK',
        message: "I know you have a tendency to chase. Ask yourself: Am I entering at MY level, or am I chasing because it's moving? Missed trades are NOT losses. There's always another play.",
        technicalReason: 'Known weakness: chasing_entries',
        warnings: ['Review your entry - is this YOUR setup or FOMO?'],
        relatedLesson: {
          module: 'entries',
          lesson: 'patience-candles',
          url: '/curriculum/entries/patience-candles',
        },
      };
    },
  },

  // ============================================
  // WARNING: No Stop Loss
  // ============================================
  {
    id: 'no_stop_loss',
    name: 'No Stop Loss Check',
    priority: 75,
    check: (ctx) => {
      if (!ctx.tradeIntent) return null;
      if (ctx.tradeIntent.stopLoss) return null; // Stop is set

      const severity: InterventionSeverity =
        ctx.userProfile?.weaknesses.includes('no_stop_loss') ? 'warning' : 'nudge';

      return {
        approved: true, // Allow but warn strongly
        severity,
        type: 'trade_validation',
        title: 'WHERE IS YOUR STOP?',
        message: "No stop loss set. Every trade MUST have a defined exit. Hope is not a strategy. Set your stop BEFORE entry - that's non-negotiable.",
        technicalReason: 'Trade intent missing stop loss',
        suggestedAction: 'Define your stop loss based on the setup structure',
        warnings: ['Trade submitted without stop loss'],
        relatedLesson: {
          module: 'risk',
          lesson: 'stop-discipline',
          url: '/curriculum/risk/stop-discipline',
        },
      };
    },
  },

  // ============================================
  // WARNING: Overtrading
  // ============================================
  {
    id: 'overtrading',
    name: 'Overtrading Check',
    priority: 70,
    check: (ctx) => {
      if (!ctx.userProfile) return null;
      const maxTrades = ctx.userProfile.maxDailyTrades || 3;
      if (ctx.todayTradeCount < maxTrades) return null;

      const severity: InterventionSeverity =
        ctx.todayTradeCount >= maxTrades + 2 ? 'dumb_shit' : 'warning';

      return {
        approved: severity !== 'dumb_shit',
        severity,
        type: 'user_weakness',
        title: 'OVERTRADING ALERT',
        message: `You've already made ${ctx.todayTradeCount} trades today. Your limit is ${maxTrades}. Quality over quantity. One good trade a day is all you need. That's the Rule of Ones.`,
        technicalReason: `Trades today: ${ctx.todayTradeCount}, Limit: ${maxTrades}`,
        suggestedAction: "You're done for today. Journal what you've done and prep for tomorrow.",
        warnings: ['Daily trade limit reached'],
      };
    },
  },

  // ============================================
  // WARNING: Event Coming
  // ============================================
  {
    id: 'event_upcoming',
    name: 'Upcoming Economic Event',
    priority: 60,
    check: (ctx) => {
      if (!ctx.hotContext?.calendar?.nextEvent) return null;
      const event = ctx.hotContext.calendar.nextEvent;
      if (event.impact !== 'high') return null;
      if (event.minutesUntilEvent > 30 || event.minutesUntilEvent <= 0) return null;

      return {
        approved: true,
        severity: 'warning',
        type: 'economic_event',
        title: `${event.event} in ${event.minutesUntilEvent} mins`,
        message: `${event.event} drops in ${event.minutesUntilEvent} minutes. High-impact event. If you enter now, you're gambling through the event OR you need to be out before it hits. Make sure you have a plan.`,
        technicalReason: `Event: ${event.event}, Minutes: ${event.minutesUntilEvent}`,
        suggestedAction: 'Plan your exit before the event or wait for it to pass',
        warnings: ['High-impact event approaching'],
      };
    },
  },

  // ============================================
  // WARNING: Caution Market Conditions
  // ============================================
  {
    id: 'market_caution',
    name: 'Market Caution Mode',
    priority: 50,
    check: (ctx) => {
      if (!ctx.breadth) return null;
      if (ctx.breadth.tradingBias !== 'caution') return null;

      return {
        approved: true,
        severity: 'nudge',
        type: 'market_breadth',
        title: 'CHOPPY WATERS',
        message: "Market breadth is mixed. ADD and VOLD are sending conflicting signals. This is chop. Size down or sit on your hands. Don't force trades in unclear conditions.",
        technicalReason: `Trading bias: caution, Health: ${ctx.breadth.healthScore}`,
        suggestedAction: 'Reduce position size by 50% or wait for clearer direction',
        warnings: ['Market conditions favor smaller size or patience'],
      };
    },
  },

  // ============================================
  // INFO: Daily Loss Check
  // ============================================
  {
    id: 'daily_loss_warning',
    name: 'Daily Loss Check',
    priority: 40,
    check: (ctx) => {
      if (!ctx.userProfile) return null;
      const maxLoss = ctx.userProfile.maxDailyLossPercent || 3;
      // Assume todayPnL is percentage
      if (ctx.todayPnL > -maxLoss) return null;

      const severity: InterventionSeverity =
        ctx.todayPnL <= -maxLoss * 1.5 ? 'dumb_shit' : 'warning';

      return {
        approved: severity !== 'dumb_shit',
        severity,
        type: 'risk_violation',
        title: 'DAILY LOSS LIMIT',
        message: `You're down ${Math.abs(ctx.todayPnL).toFixed(2)}% today. Your max daily loss is ${maxLoss}%. You've hit your limit. The market beat you today. Come back fresh tomorrow.`,
        blockedReason: severity === 'dumb_shit' ? 'Daily loss limit exceeded' : undefined,
        technicalReason: `Daily P&L: ${ctx.todayPnL}%, Limit: -${maxLoss}%`,
        suggestedAction: 'Stop trading for the day. Review what went wrong.',
        warnings: ['Daily loss limit reached'],
      };
    },
  },
];

// =============================================================================
// COACHING INTERVENTION ENGINE
// =============================================================================

export class CoachingInterventionEngine {
  private voiceSynthesizer: VoiceSynthesizer;
  private rules: InterventionRule[];

  constructor() {
    this.voiceSynthesizer = new VoiceSynthesizer();
    this.rules = [...interventionRules].sort((a, b) => b.priority - a.priority);
  }

  /**
   * Evaluate a trade intent and return intervention results
   */
  evaluateTrade(context: InterventionContext): InterventionResult {
    // Run through all rules in priority order
    for (const rule of this.rules) {
      const result = rule.check(context);
      if (result && !result.approved) {
        // Blocking intervention - synthesize voice and return
        return {
          ...result,
          message: this.voiceSynthesizer.synthesize(
            result.message,
            result.severity,
            result.type
          ),
        };
      }
    }

    // Collect all warnings (non-blocking)
    const warnings: string[] = [];
    let worstSeverity: InterventionSeverity = 'nudge';
    let primaryWarning: InterventionResult | null = null;

    for (const rule of this.rules) {
      const result = rule.check(context);
      if (result && result.approved && result.warnings.length > 0) {
        warnings.push(...result.warnings);
        if (
          result.severity === 'warning' ||
          (result.severity === 'nudge' && worstSeverity === 'nudge')
        ) {
          worstSeverity = result.severity;
          if (!primaryWarning || result.severity === 'warning') {
            primaryWarning = result;
          }
        }
      }
    }

    // If there are warnings, return the primary one
    if (primaryWarning) {
      return {
        ...primaryWarning,
        approved: true,
        warnings,
        message: this.voiceSynthesizer.synthesize(
          primaryWarning.message,
          primaryWarning.severity,
          primaryWarning.type
        ),
      };
    }

    // All clear - trade approved
    return {
      approved: true,
      severity: 'nudge',
      type: 'trade_validation',
      title: 'TRADE APPROVED',
      message: this.voiceSynthesizer.generateAffirmation(
        'Sticking to your rules'
      ),
      warnings: [],
    };
  }

  /**
   * Get proactive market commentary
   */
  getMarketCommentary(breadth: MarketBreadth | null): string {
    if (!breadth) {
      return "Market data unavailable. Trade with normal caution.";
    }
    return this.voiceSynthesizer.generateMarketCommentary(breadth);
  }

  /**
   * Generate warnings for current market state (no trade intent)
   */
  getActiveWarnings(context: Omit<InterventionContext, 'tradeIntent'>): ProactiveWarning[] {
    const warnings: ProactiveWarning[] = [];
    const now = new Date().toISOString();

    // Mental capital warning
    if (context.userProfile && context.userProfile.mentalCapital <= 50) {
      warnings.push({
        id: `mental_${Date.now()}`,
        timestamp: now,
        severity: context.userProfile.mentalCapital <= 30 ? 'critical' : 'warning',
        type: 'pattern',
        title: 'Mental Capital Low',
        message: context.userProfile.mentalCapital <= 30
          ? "Your mental capital is depleted. You shouldn't be trading today."
          : 'Mental capital below optimal. Consider reduced size or sitting out.',
        coachStyle: 'somesh',
        actionRequired: context.userProfile.mentalCapital <= 30,
        suggestedAction: 'Step away and reset',
      });
    }

    // Consecutive losses warning
    if (context.userProfile && context.userProfile.consecutiveLosses >= 2) {
      warnings.push({
        id: `losses_${Date.now()}`,
        timestamp: now,
        severity: context.userProfile.consecutiveLosses >= 3 ? 'critical' : 'warning',
        type: 'pattern',
        title: `${context.userProfile.consecutiveLosses} Consecutive Losses`,
        message: `You've had ${context.userProfile.consecutiveLosses} losses in a row. Watch for revenge trading. The market will be here tomorrow.`,
        coachStyle: 'somesh',
        actionRequired: false,
      });
    }

    // Include hot context warnings
    if (context.hotContext?.activeWarnings) {
      warnings.push(...context.hotContext.activeWarnings);
    }

    return warnings;
  }

  /**
   * Check if a specific weakness is being triggered
   */
  checkWeakness(
    weakness: TradingWeakness,
    context: InterventionContext
  ): InterventionResult | null {
    // Find rules that check for this weakness
    const relevantRules = this.rules.filter(r =>
      r.id.includes(weakness) || r.name.toLowerCase().includes(weakness.replace('_', ' '))
    );

    for (const rule of relevantRules) {
      const result = rule.check(context);
      if (result) {
        return {
          ...result,
          message: this.voiceSynthesizer.synthesize(
            result.message,
            result.severity,
            result.type
          ),
        };
      }
    }

    return null;
  }
}

// Export singleton instance
export const coachingInterventionEngine = new CoachingInterventionEngine();

// Export voice synthesizer for direct use
export const voiceSynthesizer = new VoiceSynthesizer();
