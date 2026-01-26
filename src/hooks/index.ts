/**
 * Hooks Index
 *
 * Central export point for all custom hooks.
 */

// Learning Progress Hooks (Legacy)
export {
  useLearningProgress,
  useLearningStats,
  useCourseProgress,
  useModuleProgress,
  useRecentActivity,
} from './use-learning-progress';

// New Video Learning System Hooks
export { useDebounce, useDebouncedValue } from './useDebounce';
export { useVideoProgress } from './useVideoProgress';
export { useLearnProgress, useComplianceReport } from './useLearnProgress';

// Market Data Hooks
export { useMarketData, useMarketStatusBar } from './useMarketData';

// Companion Hooks
export {
  useCompanionData,
  type CompanionDataState,
  type UseCompanionDataOptions,
  type UseCompanionDataReturn,
  type MarketStatus as CompanionMarketStatus,
} from './useCompanionData';

// Learning Ledger (Compliance Audit Trail)
export {
  useLearningLedger,
  useVideoLedger,
  useQuizLedger,
} from './useLearningLedger';

// Practice Simulator Hooks
export {
  usePracticeEngine,
  type GamePhase,
  type TradeStatus,
  type PracticeMode,
  type Candle,
  type KeyLevel,
  type GammaLevel,
  type ScenarioData,
  type TradePlan,
  type ActiveTrade,
  type GameState,
  type GameControls,
  type TradeControls,
  type SessionStats,
  type ChartProps,
  type UsePracticeEngineOptions,
  type UsePracticeEngineReturn,
} from './usePracticeEngine';

// Candle Replay Hooks
export {
  useCandleReplay,
  useBatchCandleReplay,
  easingFunctions,
  type OHLCCandle,
  type AnimatingCandle,
  type CandleReplayState,
  type UseCandleReplayOptions,
  type UseCandleReplayReturn,
} from './useCandleReplay';

// Voice Hooks
export {
  useSomeshVoice,
  VOICE_ALERTS,
  TRIGGER_PRIORITY,
  type VoiceTrigger,
} from './useSomeshVoice';

// Re-export types
export type {
  CourseProgress,
  UserLearningStats,
  LearningActivity,
  ModuleProgress,
} from '@/lib/learning-progress';
