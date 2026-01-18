/**
 * Hooks Index
 *
 * Central export point for all custom hooks.
 */

// Learning Progress Hooks
export {
  useLearningProgress,
  useLearningStats,
  useCourseProgress,
  useModuleProgress,
  useRecentActivity,
  useThinkificSSO,
  useOpenThinkific,
} from './use-learning-progress';

// Re-export types
export type {
  CourseProgress,
  UserLearningStats,
  LearningActivity,
  ModuleProgress,
} from '@/lib/learning-progress';
