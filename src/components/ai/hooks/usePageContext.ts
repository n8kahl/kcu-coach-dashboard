'use client';

/**
 * usePageContext Hook
 *
 * Automatically updates the AI context when the page changes.
 * Should be used in page components to ensure context awareness.
 */

import { useEffect, useMemo, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useAIContext } from '../AIContextProvider';
import type { DashboardPage, PageSpecificData } from '@/types/ai';

/**
 * Extract route parameters from pathname
 */
interface RouteParams {
  page: DashboardPage;
  moduleId?: string;
  lessonId?: string;
  tradeId?: string;
  symbol?: string;
  scenarioId?: string;
}

/**
 * Map pathname to DashboardPage type and extract params
 */
function parseRoute(pathname: string): RouteParams {
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
    return { page: adminPages[adminSection] || 'admin/users' };
  }

  // Standard pages with params
  const pageMap: Record<string, DashboardPage> = {
    overview: 'overview',
    dashboard: 'overview',
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

  const page = pageMap[firstSegment] || 'overview';
  const params: RouteParams = { page };

  // Extract specific params based on page type
  switch (page) {
    case 'learning':
      // /learning/[moduleId]/[lessonId]
      if (segments[1]) params.moduleId = segments[1];
      if (segments[2]) params.lessonId = segments[2];
      break;
    case 'journal':
      // /journal/[tradeId]
      if (segments[1]) params.tradeId = segments[1];
      break;
    case 'companion':
      // /companion/[symbol]
      if (segments[1]) params.symbol = segments[1].toUpperCase();
      break;
    case 'practice':
      // /practice/[scenarioId]
      if (segments[1]) params.scenarioId = segments[1];
      break;
  }

  return params;
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
  const searchParams = useSearchParams();
  const { updatePageContext, setSelectedSymbol, setSelectedLesson } = useAIContext();
  const { pageData, deps = [] } = options;

  // Track time spent on page
  const pageStartTime = useRef<Date>(new Date());
  const previousPage = useRef<string | null>(null);

  // Parse route once
  const routeParams = useMemo(() => parseRoute(pathname || '/overview'), [pathname]);

  // Extract query params
  const queryParams = useMemo(() => {
    if (!searchParams) return {};
    return {
      tab: searchParams.get('tab'),
      tradeId: searchParams.get('tradeId'),
      symbol: searchParams.get('symbol'),
      quiz: searchParams.get('quiz') === 'true',
      timestamp: searchParams.get('t') ? parseInt(searchParams.get('t')!, 10) : undefined,
    };
  }, [searchParams]);

  useEffect(() => {
    // Track page transition
    if (previousPage.current && previousPage.current !== pathname) {
      const timeOnPreviousPage = Date.now() - pageStartTime.current.getTime();
      // Could log this for analytics: console.log(`Time on ${previousPage.current}: ${timeOnPreviousPage}ms`);
    }

    previousPage.current = pathname;
    pageStartTime.current = new Date();

    // Build page data from route params and query params
    const combinedPageData: PageSpecificData = {
      ...pageData,
      currentModule: routeParams.moduleId,
      currentLesson: routeParams.lessonId,
    };

    // Add query param data
    if (queryParams.timestamp) {
      combinedPageData.videoTimestamp = queryParams.timestamp;
    }

    // Update context
    updatePageContext(routeParams.page, combinedPageData);

    // Auto-set selections based on route params
    if (routeParams.symbol) {
      setSelectedSymbol(routeParams.symbol);
    }

    if (routeParams.moduleId && routeParams.lessonId) {
      setSelectedLesson({
        moduleId: routeParams.moduleId,
        lessonId: routeParams.lessonId,
        title: `${routeParams.moduleId}/${routeParams.lessonId}`, // Will be updated by page
      });
    }
  }, [
    pathname,
    updatePageContext,
    setSelectedSymbol,
    setSelectedLesson,
    pageData,
    routeParams,
    queryParams,
    ...deps,
  ]);

  // Return useful data for the page component
  return {
    page: routeParams.page,
    routeParams,
    queryParams,
    timeOnPage: () => Date.now() - pageStartTime.current.getTime(),
  };
}

export default usePageContext;
