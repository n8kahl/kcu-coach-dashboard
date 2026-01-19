'use client';

import { useState, useEffect, useCallback } from 'react';
import type {
  Quote,
  MarketStatus,
  MarketSnapshot,
  KeyLevel,
  IndexQuote,
} from '@/lib/market-data';

// ============================================
// Types
// ============================================

export interface MarketDataState {
  // Primary data
  spyQuote: Quote | null;
  qqqQuote: Quote | null;
  vix: number;
  marketStatus: MarketStatus;

  // Additional snapshots (if requested)
  snapshots: Map<string, MarketSnapshot>;

  // Status
  isLoading: boolean;
  isLive: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

export interface UseMarketDataOptions {
  /** Symbols to track beyond SPY/QQQ */
  additionalSymbols?: string[];
  /** Refresh interval in ms (default: 15000) */
  refreshInterval?: number;
  /** Whether to auto-refresh (default: true) */
  autoRefresh?: boolean;
}

// ============================================
// Hook
// ============================================

export function useMarketData(options: UseMarketDataOptions = {}) {
  const {
    additionalSymbols = [],
    refreshInterval = 15000,
    autoRefresh = true,
  } = options;

  const [state, setState] = useState<MarketDataState>({
    spyQuote: null,
    qqqQuote: null,
    vix: 0,
    marketStatus: { market: 'unknown', afterHours: false, earlyHours: false },
    snapshots: new Map(),
    isLoading: true,
    isLive: false,
    error: null,
    lastUpdated: null,
  });

  const allSymbols = ['SPY', 'QQQ', ...additionalSymbols];

  const fetchMarketData = useCallback(async () => {
    try {
      const response = await fetch(`/api/ai/market?symbols=${allSymbols.join(',')}`);

      if (!response.ok) {
        if (response.status === 503) {
          setState((prev) => ({
            ...prev,
            isLoading: false,
            isLive: false,
            error: 'Market data service not configured (MASSIVE_API_KEY)',
          }));
          return;
        }
        throw new Error('Failed to fetch market data');
      }

      const data = await response.json();

      // Extract SPY and QQQ quotes
      const spyData = data.symbols?.find((s: { symbol: string }) => s.symbol === 'SPY');
      const qqqData = data.symbols?.find((s: { symbol: string }) => s.symbol === 'QQQ');

      // Build snapshots map
      const snapshots = new Map<string, MarketSnapshot>();
      for (const symbolData of data.symbols || []) {
        snapshots.set(symbolData.symbol, {
          symbol: symbolData.symbol,
          quote: {
            symbol: symbolData.symbol,
            price: symbolData.price,
            last: symbolData.price,
            change: symbolData.change,
            changePercent: symbolData.changePercent,
            open: 0,
            high: 0,
            low: 0,
            close: 0,
            volume: 0,
            vwap: symbolData.vwap || 0,
            prevClose: 0,
            prevHigh: 0,
            prevLow: 0,
            timestamp: new Date().toISOString(),
          },
          keyLevels: symbolData.keyLevels || [],
          trend: symbolData.trend,
          vwap: symbolData.vwap || 0,
          patienceCandle: symbolData.patienceCandle,
        });
      }

      // Convert API market status to internal format
      const apiStatus = data.marketStatus;
      const marketStatus: MarketStatus = {
        market: apiStatus?.status === 'open' ? 'open' :
                apiStatus?.status === 'premarket' || apiStatus?.status === 'afterhours' ? 'extended-hours' :
                'closed',
        afterHours: apiStatus?.status === 'afterhours',
        earlyHours: apiStatus?.status === 'premarket',
      };

      setState({
        spyQuote: spyData ? {
          symbol: 'SPY',
          price: spyData.price,
          last: spyData.price,
          change: spyData.change,
          changePercent: spyData.changePercent,
          open: 0,
          high: 0,
          low: 0,
          close: 0,
          volume: 0,
          vwap: spyData.vwap || 0,
          prevClose: 0,
          prevHigh: 0,
          prevLow: 0,
          timestamp: new Date().toISOString(),
        } : null,
        qqqQuote: qqqData ? {
          symbol: 'QQQ',
          price: qqqData.price,
          last: qqqData.price,
          change: qqqData.change,
          changePercent: qqqData.changePercent,
          open: 0,
          high: 0,
          low: 0,
          close: 0,
          volume: 0,
          vwap: qqqData.vwap || 0,
          prevClose: 0,
          prevHigh: 0,
          prevLow: 0,
          timestamp: new Date().toISOString(),
        } : null,
        vix: data.vix || 0,
        marketStatus,
        snapshots,
        isLoading: false,
        isLive: true,
        error: null,
        lastUpdated: new Date(),
      });
    } catch (error) {
      console.error('Market data fetch error:', error);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        isLive: false,
        error: error instanceof Error ? error.message : 'Connection error',
      }));
    }
  }, [allSymbols.join(',')]);

  // Initial fetch
  useEffect(() => {
    fetchMarketData();
  }, [fetchMarketData]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(fetchMarketData, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, fetchMarketData]);

  // Manual refresh function
  const refresh = useCallback(() => {
    setState((prev) => ({ ...prev, isLoading: true }));
    fetchMarketData();
  }, [fetchMarketData]);

  // Get formatted data for MarketStatusBar component
  const getMarketStatusBarData = useCallback(() => {
    const { spyQuote, qqqQuote, vix, marketStatus, lastUpdated, isLive } = state;

    return {
      spyPrice: spyQuote?.price || 0,
      spyChange: spyQuote?.changePercent || 0,
      qqqPrice: qqqQuote?.price || 0,
      qqqChange: qqqQuote?.changePercent || 0,
      vix,
      marketStatus: marketStatus.market === 'open' ? 'open' as const :
                    marketStatus.earlyHours ? 'premarket' as const :
                    marketStatus.afterHours ? 'afterhours' as const :
                    'closed' as const,
      lastUpdated: lastUpdated
        ? lastUpdated.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            timeZone: 'America/New_York',
          }) + ' ET'
        : '',
      isLive,
    };
  }, [state]);

  return {
    ...state,
    refresh,
    getMarketStatusBarData,
  };
}

// ============================================
// Simplified hook for just status bar
// ============================================

export function useMarketStatusBar() {
  const { getMarketStatusBarData, isLoading, error, isLive } = useMarketData({
    refreshInterval: 30000, // 30 seconds for status bar
  });

  return {
    data: getMarketStatusBarData(),
    isLoading,
    error,
    isLive,
  };
}

export default useMarketData;
