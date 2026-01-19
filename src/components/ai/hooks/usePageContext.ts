'use client';

/**
 * usePageContext Hook
 *
 * Automatically updates the AI context when the page changes.
 * Should be used in page components to ensure context awareness.
 */

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAIContext } from '../AIContextProvider';
import type { DashboardPage, PageSpecificData } from '@/types/ai';

/**
 * Map pathname to DashboardPage type
 */
function pathToPage(pathname: string): DashboardPage {
  // Remove leading slash and split
  const segments = pathname.replace(/^\//, '').split('/');
  const firstSegment = segments[0];

  // Admin pages
  if (firstSegment === 'admin') {
    const adminSection = segments[1];
    const adminPages: Record<string, DashboardPage> = {
      users: 'admin/users',
      'social-builder': 'admin/social-builder',
      knowledge: 'admin/knowledge',
      analytics: 'admin/analytics',
      settings: 'admin/settings',
      'card-builder': 'admin/card-builder',
    };
    return adminPages[adminSection] || 'admin/users';
  }

  // Standard pages
  const pageMap: Record<string, DashboardPage> = {
    overview: 'overview',
    journal: 'journal',
    learning: 'learning',
    learn: 'learning',
    coach: 'coach',
    companion: 'companion',
    practice: 'practice',
    achievements: 'achievements',
    leaderboard: 'leaderboard',
    'win-cards': 'win-cards',
    progress: 'progress',
    resources: 'resources',
  };

  return pageMap[firstSegment] || 'overview';
}

interface UsePageContextOptions {
  /**
   * Additional page-specific data to include in context
   */
  pageData?: PageSpecificData;

  /**
   * Dependencies that trigger a context update when changed
   */
  deps?: unknown[];
}

/**
 * Hook to automatically update AI context when page changes
 *
 * @example
 * // Basic usage - just track page changes
 * usePageContext();
 *
 * @example
 * // With page-specific data
 * usePageContext({
 *   pageData: {
 *     selectedTrade: currentTrade,
 *     tradeFilters: filters,
 *   },
 *   deps: [currentTrade, filters],
 * });
 */
export function usePageContext(options: UsePageContextOptions = {}) {
  const pathname = usePathname();
  const { updatePageContext } = useAIContext();
  const { pageData, deps = [] } = options;

  useEffect(() => {
    const page = pathToPage(pathname || '/overview');
    updatePageContext(page, pageData);
  }, [pathname, updatePageContext, pageData, ...deps]);
}

export default usePageContext;
