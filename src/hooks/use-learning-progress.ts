'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  CourseProgress,
  UserLearningStats,
  LearningActivity,
  ModuleProgress,
} from '@/lib/learning-progress';

// ============================================
// Types
// ============================================

interface UnifiedProgressData {
  stats?: UserLearningStats;
  courses?: CourseProgress[];
  modules?: ModuleProgress[];
  recentActivity?: LearningActivity[];
}

interface UseLearningProgressOptions {
  include?: ('stats' | 'courses' | 'modules' | 'activity')[];
  activityLimit?: number;
  autoRefresh?: boolean;
  refreshInterval?: number; // ms
}

interface UseLearningProgressReturn {
  data: UnifiedProgressData | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  syncProgress: () => Promise<void>;
}

// ============================================
// Hook
// ============================================

export function useLearningProgress(
  options: UseLearningProgressOptions = {}
): UseLearningProgressReturn {
  // Convert array to stable string key immediately
  // This prevents infinite loops from array reference changes
  const includeKey = (options.include || ['stats', 'courses', 'modules', 'activity']).join(',');
  const activityLimit = options.activityLimit ?? 10;
  const autoRefresh = options.autoRefresh ?? false;
  const refreshInterval = options.refreshInterval ?? 60000;

  const [data, setData] = useState<UnifiedProgressData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Track mounted state
  const isMountedRef = useRef(true);
  // Track last fetch key to prevent duplicate fetches
  const lastFetchKeyRef = useRef<string | null>(null);

  const fetchProgress = useCallback(async () => {
    const fetchKey = `${includeKey}-${activityLimit}`;

    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams({
        include: includeKey,
        activityLimit: activityLimit.toString(),
      });

      const response = await fetch(`/api/learning/progress/unified?${params}`);

      if (!isMountedRef.current) return;

      if (!response.ok) {
        throw new Error('Failed to fetch learning progress');
      }

      const result = await response.json();

      if (!isMountedRef.current) return;

      setData({
        stats: result.stats,
        courses: result.courses,
        modules: result.modules,
        recentActivity: result.recentActivity,
      });
      lastFetchKeyRef.current = fetchKey;
    } catch (err) {
      if (!isMountedRef.current) return;
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [includeKey, activityLimit]);

  const syncProgress = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/learning/progress/unified', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to sync progress');
      }

      // Refresh data after sync
      await fetchProgress();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
      setIsLoading(false);
    }
  }, [fetchProgress]);

  // Initial fetch and refetch when key changes
  useEffect(() => {
    const fetchKey = `${includeKey}-${activityLimit}`;

    // Only fetch if key changed or never fetched
    if (lastFetchKeyRef.current !== fetchKey) {
      fetchProgress();
    }
  }, [includeKey, activityLimit, fetchProgress]);

  // Auto-refresh interval
  useEffect(() => {
    if (!autoRefresh) return;

    const intervalId = setInterval(fetchProgress, refreshInterval);
    return () => clearInterval(intervalId);
  }, [autoRefresh, refreshInterval, fetchProgress]);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return {
    data,
    isLoading,
    error,
    refresh: fetchProgress,
    syncProgress,
  };
}

// ============================================
// Convenience Hooks - Use stable string constants
// ============================================

// Stable options objects to prevent re-renders
const STATS_OPTIONS: UseLearningProgressOptions = { include: ['stats'] };
const COURSES_OPTIONS: UseLearningProgressOptions = { include: ['courses'] };
const MODULES_OPTIONS: UseLearningProgressOptions = { include: ['modules'] };

/**
 * Hook for just learning stats
 */
export function useLearningStats() {
  const { data, isLoading, error, refresh } = useLearningProgress(STATS_OPTIONS);

  return {
    stats: data?.stats || null,
    isLoading,
    error,
    refresh,
  };
}

/**
 * Hook for course progress list
 */
export function useCourseProgress() {
  const { data, isLoading, error, refresh } = useLearningProgress(COURSES_OPTIONS);

  return {
    courses: data?.courses || [],
    isLoading,
    error,
    refresh,
  };
}

/**
 * Hook for module progress with Thinkific linking
 */
export function useModuleProgress() {
  const { data, isLoading, error, refresh, syncProgress } = useLearningProgress(MODULES_OPTIONS);

  return {
    modules: data?.modules || [],
    isLoading,
    error,
    refresh,
    syncProgress,
  };
}

/**
 * Hook for recent learning activity
 */
export function useRecentActivity(limit: number = 10) {
  // Use useMemo pattern with stable reference
  const { data, isLoading, error, refresh } = useLearningProgress({
    include: ['activity'],
    activityLimit: limit,
  });

  return {
    activity: data?.recentActivity || [],
    isLoading,
    error,
    refresh,
  };
}

// ============================================
// Utility Hook for Thinkific SSO
// ============================================

interface UseThinkificSSOReturn {
  generateSSOUrl: (params: {
    type: 'course' | 'lesson' | 'dashboard';
    courseSlug?: string;
    lessonSlug?: string;
    timestampSeconds?: number;
  }) => Promise<string | null>;
  isLoading: boolean;
  error: string | null;
}

export function useThinkificSSO(): UseThinkificSSOReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateSSOUrl = useCallback(async (params: {
    type: 'course' | 'lesson' | 'dashboard';
    courseSlug?: string;
    lessonSlug?: string;
    timestampSeconds?: number;
  }): Promise<string | null> => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/thinkific/sso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate SSO URL');
      }

      const data = await response.json();
      return data.ssoUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    generateSSOUrl,
    isLoading,
    error,
  };
}

/**
 * Hook to open Thinkific content with SSO
 */
export function useOpenThinkific() {
  const { generateSSOUrl, isLoading, error } = useThinkificSSO();

  const openCourse = useCallback(async (courseSlug: string) => {
    const url = await generateSSOUrl({ type: 'course', courseSlug });
    if (url) {
      window.open(url, '_blank');
    }
  }, [generateSSOUrl]);

  const openLesson = useCallback(async (
    courseSlug: string,
    lessonSlug: string,
    timestampSeconds?: number
  ) => {
    const url = await generateSSOUrl({
      type: 'lesson',
      courseSlug,
      lessonSlug,
      timestampSeconds,
    });
    if (url) {
      window.open(url, '_blank');
    }
  }, [generateSSOUrl]);

  const openDashboard = useCallback(async () => {
    const url = await generateSSOUrl({ type: 'dashboard' });
    if (url) {
      window.open(url, '_blank');
    }
  }, [generateSSOUrl]);

  return {
    openCourse,
    openLesson,
    openDashboard,
    isLoading,
    error,
  };
}

export default useLearningProgress;
