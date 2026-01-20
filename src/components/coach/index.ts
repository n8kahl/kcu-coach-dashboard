/**
 * Proactive Coaching Components
 *
 * Components for the real-time proactive trading coach.
 */

export { LiveCoachOverlay } from './LiveCoachOverlay';
export { TradeInterceptorModal } from './TradeInterceptorModal';

// Re-export hook for convenience
export { useTradeInterceptor, canTrade, checkDirectionVsBreadth } from '@/hooks/useTradeInterceptor';

// Re-export engine types
export type {
  InterventionResult,
  InterventionSeverity,
  InterventionType,
  TradeIntent,
  InterventionContext,
} from '@/lib/coaching-intervention-engine';
