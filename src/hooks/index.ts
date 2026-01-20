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
  useThinkificSSO,
  useOpenThinkific,
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

// Re-export types
export type {
  CourseProgress,
  UserLearningStats,
  LearningActivity,
  ModuleProgress,
} from '@/lib/learning-progress';
