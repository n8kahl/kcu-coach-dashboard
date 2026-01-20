/**
 * useTradeInterceptor Hook
 *
 * The "Pre-Flight Check" for all trade actions.
 * Intercepts Buy/Sell actions and validates them against:
 * - Market breadth conditions
 * - Economic calendar
 * - User trading profile (weaknesses, mental capital)
 * - Risk parameters
 *
 * Returns: approved (green), caution (yellow toast), or rejected (red modal)
 */

import { useState, useCallback } from 'react';
import { useToast } from '@/components/ui/use-toast';
import {
  coachingInterventionEngine,
  type TradeIntent,
  type InterventionResult,
  type InterventionContext,
} from '@/lib/coaching-intervention-engine';
import {
  getMarketBreadth,
  getHotContext,
  type MarketBreadth,
  type MarketHotContext,
} from '@/lib/market-data';
import type { UserProfileContext } from '@/types/ai';

// =============================================================================
// TYPES
// =============================================================================

export type InterceptorStatus = 'idle' | 'checking' | 'approved' | 'caution' | 'rejected';

export interface TradeInterceptorState {
  status: InterceptorStatus;
  isChecking: boolean;
  result: InterventionResult | null;
  showModal: boolean;
}

export interface UseTradeInterceptorOptions {
  // User's trading profile context
  userProfile?: UserProfileContext | null;
  // Number of trades made today
  todayTradeCount?: number;
  // Today's P&L percentage
  todayPnL?: number;
  // Is user currently in a trade?
  isInTrade?: boolean;
  // Callback when trade is approved
  onApproved?: (intent: TradeIntent) => void;
  // Callback when trade is rejected
  onRejected?: (result: InterventionResult) => void;
  // Auto-dismiss caution after ms (0 = don't auto-dismiss)
  cautionAutoDismissMs?: number;
}

export interface UseTradeInterceptorReturn {
  // Current state
  state: TradeInterceptorState;
  // Intercept a trade intent
  interceptTrade: (intent: TradeIntent) => Promise<InterventionResult>;
  // Manually dismiss the modal
  dismissModal: () => void;
  // Force approve (override warning)
  forceApprove: () => void;
  // Reset state
  reset: () => void;
  // Current market commentary
  marketCommentary: string | null;
  // Active warnings
  activeWarnings: InterventionResult[];
}

// =============================================================================
// HOOK IMPLEMENTATION
// =============================================================================

export function useTradeInterceptor(
  options: UseTradeInterceptorOptions = {}
): UseTradeInterceptorReturn {
  const {
    userProfile = null,
    todayTradeCount = 0,
    todayPnL = 0,
    isInTrade = false,
    onApproved,
    onRejected,
    cautionAutoDismissMs = 5000,
  } = options;

  const { toast } = useToast();

  const [state, setState] = useState<TradeInterceptorState>({
    status: 'idle',
    isChecking: false,
    result: null,
    showModal: false,
  });

  const [marketCommentary, setMarketCommentary] = useState<string | null>(null);
  const [activeWarnings, setActiveWarnings] = useState<InterventionResult[]>([]);
  const [pendingIntent, setPendingIntent] = useState<TradeIntent | null>(null);

  /**
   * Build intervention context from current state
   */
  const buildContext = useCallback(async (
    intent: TradeIntent
  ): Promise<InterventionContext> => {
    // Fetch current market state
    const [breadth, hotContext] = await Promise.all([
      getMarketBreadth().catch(() => null),
      getHotContext().catch(() => null),
    ]);

    // Get next event from hot context
    const currentEvent = hotContext?.calendar?.nextEvent || null;

    return {
      breadth,
      hotContext,
      currentEvent,
      userProfile,
      todayTradeCount,
      todayPnL,
      isInTrade,
      tradeIntent: intent,
    };
  }, [userProfile, todayTradeCount, todayPnL, isInTrade]);

  /**
   * Intercept a trade intent and validate it
   */
  const interceptTrade = useCallback(async (
    intent: TradeIntent
  ): Promise<InterventionResult> => {
    setState(prev => ({
      ...prev,
      status: 'checking',
      isChecking: true,
    }));

    setPendingIntent(intent);

    try {
      // Build context and evaluate
      const context = await buildContext(intent);
      const result = coachingInterventionEngine.evaluateTrade(context);

      // Update market commentary
      if (context.breadth) {
        setMarketCommentary(
          coachingInterventionEngine.getMarketCommentary(context.breadth)
        );
      }

      // Handle result based on approval status and severity
      if (!result.approved) {
        // REJECTED - Show blocking modal
        setState({
          status: 'rejected',
          isChecking: false,
          result,
          showModal: true,
        });

        onRejected?.(result);

        // Show toast as well
        toast({
          variant: 'destructive',
          title: result.title,
          description: result.blockedReason || 'Trade blocked by coach',
        });

      } else if (result.severity === 'warning') {
        // CAUTION - Show warning toast, allow override
        setState({
          status: 'caution',
          isChecking: false,
          result,
          showModal: true, // Show modal for warnings too
        });

        toast({
          variant: 'default',
          title: `⚠️ ${result.title}`,
          description: result.warnings[0] || result.message.slice(0, 100),
          duration: cautionAutoDismissMs > 0 ? cautionAutoDismissMs : undefined,
        });

      } else if (result.severity === 'nudge' && result.warnings.length > 0) {
        // NUDGE - Show info toast, auto-approve
        setState({
          status: 'approved',
          isChecking: false,
          result,
          showModal: false,
        });

        toast({
          title: `💡 ${result.title}`,
          description: result.message.slice(0, 100),
          duration: 3000,
        });

        onApproved?.(intent);

      } else {
        // APPROVED - Clean pass
        setState({
          status: 'approved',
          isChecking: false,
          result,
          showModal: false,
        });

        toast({
          title: '✅ Trade Approved',
          description: result.message.slice(0, 80),
          duration: 2000,
        });

        onApproved?.(intent);
      }

      return result;

    } catch (error) {
      console.error('[TradeInterceptor] Error:', error);

      // On error, allow trade with warning
      const errorResult: InterventionResult = {
        approved: true,
        severity: 'nudge',
        type: 'trade_validation',
        title: 'Check Failed',
        message: 'Could not validate trade. Proceeding with caution.',
        warnings: ['Trade validation encountered an error'],
      };

      setState({
        status: 'caution',
        isChecking: false,
        result: errorResult,
        showModal: false,
      });

      return errorResult;
    }
  }, [buildContext, toast, onApproved, onRejected, cautionAutoDismissMs]);

  /**
   * Dismiss the modal
   */
  const dismissModal = useCallback(() => {
    setState(prev => ({
      ...prev,
      showModal: false,
    }));
  }, []);

  /**
   * Force approve a trade (override warning)
   */
  const forceApprove = useCallback(() => {
    if (pendingIntent && state.status === 'caution') {
      toast({
        title: '⚠️ Override Applied',
        description: 'Trade approved with warning override. Be careful.',
        duration: 3000,
      });

      setState({
        status: 'approved',
        isChecking: false,
        result: state.result,
        showModal: false,
      });

      onApproved?.(pendingIntent);
    }
  }, [pendingIntent, state, toast, onApproved]);

  /**
   * Reset state
   */
  const reset = useCallback(() => {
    setState({
      status: 'idle',
      isChecking: false,
      result: null,
      showModal: false,
    });
    setPendingIntent(null);
  }, []);

  return {
    state,
    interceptTrade,
    dismissModal,
    forceApprove,
    reset,
    marketCommentary,
    activeWarnings,
  };
}

// =============================================================================
// QUICK VALIDATION HELPERS
// =============================================================================

/**
 * Quick check if market conditions allow trading
 */
export async function canTrade(): Promise<{
  allowed: boolean;
  reason?: string;
  severity?: 'warning' | 'critical';
}> {
  try {
    const hotContext = await getHotContext();

    if (!hotContext) {
      return { allowed: true };
    }

    // Check for imminent events
    if (hotContext.calendar?.isEventImminent) {
      const event = hotContext.calendar.imminentEvent;
      return {
        allowed: false,
        reason: `${event?.event} in ${event?.minutesUntilEvent} minutes. Wait for it to pass.`,
        severity: 'critical',
      };
    }

    // Check trading conditions
    if (hotContext.tradingConditions?.status === 'red') {
      return {
        allowed: false,
        reason: hotContext.tradingConditions.message,
        severity: 'critical',
      };
    }

    if (hotContext.tradingConditions?.status === 'yellow') {
      return {
        allowed: true,
        reason: hotContext.tradingConditions.message,
        severity: 'warning',
      };
    }

    return { allowed: true };

  } catch (error) {
    console.error('[canTrade] Error:', error);
    return { allowed: true };
  }
}

/**
 * Quick check if direction is supported by breadth
 */
export async function checkDirectionVsBreadth(
  direction: 'long' | 'short'
): Promise<{
  supported: boolean;
  reason?: string;
  breadthBias?: string;
}> {
  try {
    const breadth = await getMarketBreadth();

    if (!breadth) {
      return { supported: true };
    }

    if (direction === 'long' && breadth.add.trend === 'strong_bearish') {
      return {
        supported: false,
        reason: "ADD is strongly bearish. Don't fight the river with longs.",
        breadthBias: breadth.tradingBias,
      };
    }

    if (direction === 'short' && breadth.add.trend === 'strong_bullish') {
      return {
        supported: false,
        reason: "ADD is strongly bullish. Don't short into strength.",
        breadthBias: breadth.tradingBias,
      };
    }

    return {
      supported: true,
      breadthBias: breadth.tradingBias,
    };

  } catch (error) {
    console.error('[checkDirectionVsBreadth] Error:', error);
    return { supported: true };
  }
}

export default useTradeInterceptor;
