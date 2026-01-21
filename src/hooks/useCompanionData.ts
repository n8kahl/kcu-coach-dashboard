'use client';

/**
 * useCompanionData Hook
 *
 * Robust data layer hook for the Companion page that handles:
 * - Watchlist, Setups, and MarketStatus data fetching
 * - Loading and error states
 * - Visibility-aware polling that pauses when tab is not focused
 * - Manual refresh capability
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { WatchlistSymbol, DetectedSetup } from '@/components/companion';
import type { PriceUpdateEvent } from '@/lib/broadcast';

// ============================================================================
// TYPES
// ============================================================================

export interface MarketStatus {
  spy: { price: number; change: number };
  qqq: { price: number; change: number };
  vix?: { price: number; change: number };
  isOpen: boolean;
  timeToClose: string;
}

export interface CompanionDataState {
  watchlist: WatchlistSymbol[];
  setups: DetectedSetup[];
  readySetups: DetectedSetup[];
  formingSetups: DetectedSetup[];
  marketStatus: MarketStatus | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

export interface UseCompanionDataOptions {
  /** Polling interval in ms (default: 30000) */
  pollInterval?: number;
  /** Minimum confluence score for setups (default: 50) */
  minConfluence?: number;
  /** Whether to enable auto-polling (default: true) */
  autoPolling?: boolean;
}

export interface UseCompanionDataReturn extends CompanionDataState {
  /** Manually refresh all data */
  refresh: () => Promise<void>;
  /** Update watchlist after adding/removing a symbol */
  refetchWatchlist: () => Promise<void>;
  /** Check if polling is active */
  isPolling: boolean;
  /** Handler for real-time price updates from SSE */
  handlePriceUpdate: (update: PriceUpdateEvent) => void;
  /** Real-time prices map (symbol → latest price data) */
  realtimePrices: Map<string, PriceUpdateEvent>;
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

export function useCompanionData(
  options: UseCompanionDataOptions = {}
): UseCompanionDataReturn {
  const {
    pollInterval = 15000, // Reduced from 30s to 15s for fresher data
    minConfluence = 50,
    autoPolling = true,
  } = options;

  // State
  const [state, setState] = useState<CompanionDataState>({
    watchlist: [],
    setups: [],
    readySetups: [],
    formingSetups: [],
    marketStatus: null,
    isLoading: true,
    isRefreshing: false,
    error: null,
    lastUpdated: null,
  });

  // Real-time price state - updated via SSE price_update events
  const [realtimePrices, setRealtimePrices] = useState<Map<string, PriceUpdateEvent>>(
    () => new Map()
  );

  // Handler for real-time price updates from SSE stream
  const handlePriceUpdate = useCallback((update: PriceUpdateEvent) => {
    setRealtimePrices((prev) => {
      const next = new Map(prev);
      next.set(update.symbol, update);
      return next;
    });
  }, []);

  // Merge real-time prices into watchlist for up-to-date display
  const enrichedWatchlist = useMemo((): WatchlistSymbol[] => {
    return state.watchlist.map((item) => {
      const rtPrice = realtimePrices.get(item.symbol);
      // Only update if we have real-time data AND the item has a quote
      if (rtPrice && item.quote) {
        return {
          ...item,
          quote: {
            ...item.quote,
            last_price: rtPrice.price,
            change_percent: rtPrice.changePercent,
            volume: rtPrice.volume,
            // Use real-time VWAP if available, otherwise keep existing
            vwap: rtPrice.vwap ?? item.quote.vwap,
          },
        };
      }
      return item;
    });
  }, [state.watchlist, realtimePrices]);

  // Refs for visibility tracking
  const isVisibleRef = useRef(true);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  // ============================================================================
  // DATA FETCHING FUNCTIONS
  // ============================================================================

  const fetchWatchlist = useCallback(async (): Promise<WatchlistSymbol[]> => {
    try {
      const res = await fetch('/api/companion/watchlist');
      if (!res.ok) throw new Error('Failed to fetch watchlist');
      const data = await res.json();
      return data.symbols || [];
    } catch (error) {
      console.error('Error fetching watchlist:', error);
      throw error;
    }
  }, []);

  const fetchSetups = useCallback(async (): Promise<DetectedSetup[]> => {
    try {
      const res = await fetch(`/api/companion/setups?minConfluence=${minConfluence}`);
      if (!res.ok) throw new Error('Failed to fetch setups');
      const data = await res.json();
      return data.setups || [];
    } catch (error) {
      console.error('Error fetching setups:', error);
      throw error;
    }
  }, [minConfluence]);

  const fetchMarketStatus = useCallback(async (): Promise<MarketStatus | null> => {
    try {
      const res = await fetch('/api/market/status');
      if (!res.ok) return null;
      return await res.json();
    } catch {
      // Silently fail for market status - it's not critical
      return null;
    }
  }, []);

  // ============================================================================
  // COMBINED DATA REFRESH
  // ============================================================================

  const refreshAll = useCallback(async (isInitial = false) => {
    if (!isMountedRef.current) return;

    // Only show loading on initial fetch
    if (isInitial) {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));
    } else {
      setState((prev) => ({ ...prev, isRefreshing: true }));
    }

    try {
      // Fetch all data in parallel
      const [watchlistData, setupsData, marketStatusData] = await Promise.all([
        fetchWatchlist(),
        fetchSetups(),
        fetchMarketStatus(),
      ]);

      if (!isMountedRef.current) return;

      // Compute derived states
      const readySetups = setupsData.filter((s) => s.setup_stage === 'ready');
      const formingSetups = setupsData.filter((s) => s.setup_stage === 'forming');

      setState({
        watchlist: watchlistData,
        setups: setupsData,
        readySetups,
        formingSetups,
        marketStatus: marketStatusData,
        isLoading: false,
        isRefreshing: false,
        error: null,
        lastUpdated: new Date(),
      });
    } catch (error) {
      if (!isMountedRef.current) return;

      const errorMessage =
        error instanceof Error ? error.message : 'Failed to fetch data';

      setState((prev) => ({
        ...prev,
        isLoading: false,
        isRefreshing: false,
        error: errorMessage,
      }));
    }
  }, [fetchWatchlist, fetchSetups, fetchMarketStatus]);

  // ============================================================================
  // MANUAL REFRESH (Exposed to consumers)
  // ============================================================================

  const refresh = useCallback(async () => {
    await refreshAll(false);
  }, [refreshAll]);

  const refetchWatchlist = useCallback(async () => {
    try {
      const watchlistData = await fetchWatchlist();
      if (!isMountedRef.current) return;

      setState((prev) => ({
        ...prev,
        watchlist: watchlistData,
        lastUpdated: new Date(),
      }));
    } catch (error) {
      console.error('Error refetching watchlist:', error);
    }
  }, [fetchWatchlist]);

  // ============================================================================
  // VISIBILITY-AWARE POLLING
  // ============================================================================

  // Handle visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      isVisibleRef.current = document.visibilityState === 'visible';

      // If becoming visible again, do an immediate refresh
      if (isVisibleRef.current && autoPolling) {
        refreshAll(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [refreshAll, autoPolling]);

  // Set up polling interval
  useEffect(() => {
    if (!autoPolling) return;

    const poll = () => {
      // Only poll if tab is visible
      if (isVisibleRef.current) {
        refreshAll(false);
      }
    };

    // Initial fetch
    refreshAll(true);

    // Set up interval
    pollIntervalRef.current = setInterval(poll, pollInterval);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [autoPolling, pollInterval, refreshAll]);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  // ============================================================================
  // RETURN
  // ============================================================================

  return {
    ...state,
    // Override watchlist with real-time enriched version
    watchlist: enrichedWatchlist,
    refresh,
    refetchWatchlist,
    isPolling: autoPolling && isVisibleRef.current,
    // Real-time price handling
    handlePriceUpdate,
    realtimePrices,
  };
}

export default useCompanionData;
