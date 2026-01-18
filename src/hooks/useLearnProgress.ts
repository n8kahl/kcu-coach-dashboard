'use client';

import { useState, useEffect, useCallback } from 'react';
import type {
  CourseProgress,
  LearningStreak,
  DailyActivity,
  CourseModule,
  ModuleProgress,
  Achievement,
} from '@/types/learning';

interface ProgressOverview {
  courseProgress: CourseProgress;
  streak: LearningStreak;
  recentActivity: DailyActivity[];
  resumeLesson: {
    lesson: Record<string, unknown>;
    module: Record<string, unknown>;
    progress: Record<string, unknown>;
  } | null;
}

interface ModuleWithProgress extends CourseModule {
  progress: ModuleProgress;
}

export function useLearnProgress(courseId?: string) {
  const [overview, setOverview] = useState<ProgressOverview | null>(null);
  const [modules, setModules] = useState<ModuleWithProgress[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch progress overview
  const fetchOverview = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (courseId) params.append('courseId', courseId);

      const response = await fetch(`/api/learn/progress/overview?${params}`);
      if (!response.ok) throw new Error('Failed to fetch progress');

      const data = await response.json();
      setOverview(data);
    } catch (err) {
      console.error('Error fetching progress overview:', err);
      setError('Failed to load progress');
    }
  }, [courseId]);

  // Fetch module progress
  const fetchModules = useCallback(async () => {
    if (!courseId) return;

    try {
      const response = await fetch(`/api/learn/progress/modules?courseId=${courseId}`);
      if (!response.ok) throw new Error('Failed to fetch modules');

      const data = await response.json();
      setModules(data.modules);
    } catch (err) {
      console.error('Error fetching modules:', err);
    }
  }, [courseId]);

  // Fetch achievements
  const fetchAchievements = useCallback(async () => {
    try {
      const response = await fetch('/api/learn/achievements');
      if (!response.ok) throw new Error('Failed to fetch achievements');

      const data = await response.json();
      setAchievements(data.achievements);
    } catch (err) {
      console.error('Error fetching achievements:', err);
    }
  }, []);

  // Check for new achievements
  const checkAchievements = useCallback(async () => {
    try {
      const response = await fetch('/api/learn/achievements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId }),
      });

      if (!response.ok) return { newlyEarned: [] };

      const data = await response.json();

      // If new achievements were earned, refresh the list
      if (data.newlyEarned?.length > 0) {
        await fetchAchievements();
      }

      return data;
    } catch (err) {
      console.error('Error checking achievements:', err);
      return { newlyEarned: [] };
    }
  }, [courseId, fetchAchievements]);

  // Refresh all data
  const refresh = useCallback(async () => {
    setLoading(true);
    await Promise.all([
      fetchOverview(),
      fetchModules(),
      fetchAchievements(),
    ]);
    setLoading(false);
  }, [fetchOverview, fetchModules, fetchAchievements]);

  // Initial fetch
  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    overview,
    modules,
    achievements,
    loading,
    error,
    refresh,
    checkAchievements,
  };
}

// Hook for fetching compliance report
export function useComplianceReport(userId?: string, courseId?: string) {
  const [report, setReport] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (userId) params.append('userId', userId);
      if (courseId) params.append('courseId', courseId);

      const response = await fetch(`/api/learn/compliance/report?${params}`);
      if (!response.ok) throw new Error('Failed to fetch report');

      const data = await response.json();
      setReport(data);
    } catch (err) {
      console.error('Error fetching compliance report:', err);
      setError('Failed to load report');
    } finally {
      setLoading(false);
    }
  }, [userId, courseId]);

  const downloadCSV = useCallback(async () => {
    const params = new URLSearchParams();
    if (userId) params.append('userId', userId);
    if (courseId) params.append('courseId', courseId);
    params.append('format', 'csv');

    window.open(`/api/learn/compliance/report?${params}`, '_blank');
  }, [userId, courseId]);

  return {
    report,
    loading,
    error,
    fetchReport,
    downloadCSV,
  };
}
