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

// Re-export types
export type {
  CourseProgress,
  UserLearningStats,
  LearningActivity,
  ModuleProgress,
} from '@/lib/learning-progress';
