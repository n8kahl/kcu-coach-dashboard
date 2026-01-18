'use client';

import { useState, useEffect, useCallback } from 'react';
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
  const {
    include = ['stats', 'courses', 'modules', 'activity'],
    activityLimit = 10,
    autoRefresh = false,
    refreshInterval = 60000, // 1 minute
  } = options;

  const [data, setData] = useState<UnifiedProgressData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProgress = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams({
        include: include.join(','),
        activityLimit: activityLimit.toString(),
      });

      const response = await fetch(`/api/learning/progress/unified?${params}`);

      if (!response.ok) {
        throw new Error('Failed to fetch learning progress');
      }

      const result = await response.json();
      setData({
        stats: result.stats,
        courses: result.courses,
        modules: result.modules,
        recentActivity: result.recentActivity,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [include, activityLimit]);

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

  // Initial fetch
  useEffect(() => {
    fetchProgress();
  }, [fetchProgress]);

  // Auto-refresh interval
  useEffect(() => {
    if (!autoRefresh) return;

    const intervalId = setInterval(fetchProgress, refreshInterval);
    return () => clearInterval(intervalId);
  }, [autoRefresh, refreshInterval, fetchProgress]);

  return {
    data,
    isLoading,
    error,
    refresh: fetchProgress,
    syncProgress,
  };
}

// ============================================
// Convenience Hooks
// ============================================

/**
 * Hook for just learning stats
 */
export function useLearningStats() {
  const { data, isLoading, error, refresh } = useLearningProgress({
    include: ['stats'],
  });

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
  const { data, isLoading, error, refresh } = useLearningProgress({
    include: ['courses'],
  });

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
  const { data, isLoading, error, refresh, syncProgress } = useLearningProgress({
    include: ['modules'],
  });

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
