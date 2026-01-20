'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useOptionalMarketData } from '@/providers/MarketDataProvider';
import type { PriceData } from '@/hooks/useMarketDataStream';
import type {
  Quote,
  MarketStatus,
  MarketSnapshot,
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

  // Connection info
  isUsingStream: boolean;
}

export interface UseMarketDataOptions {
  /** Symbols to track beyond SPY/QQQ */
  additionalSymbols?: string[];
  /** Refresh interval in ms for REST fallback (default: 15000) */
  refreshInterval?: number;
  /** Whether to auto-refresh when using REST (default: true) */
  autoRefresh?: boolean;
}

// ============================================
// Helper: Convert PriceData to Quote
// ============================================

function priceDataToQuote(symbol: string, data: PriceData): Quote {
  return {
    symbol,
    price: data.price,
    last: data.price,
    change: data.change || 0,
    changePercent: data.changePercent || 0,
    open: data.open || 0,
    high: data.high || 0,
    low: data.low || 0,
    close: data.price,
    volume: data.volume || 0,
    vwap: data.vwap || 0,
    prevClose: 0,
    prevHigh: 0,
    prevLow: 0,
    timestamp: new Date(data.timestamp).toISOString(),
  };
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

  // Try to use the shared provider first
  const providerData = useOptionalMarketData();

  // Local state for REST fallback
  const [restState, setRestState] = useState<MarketDataState>({
    spyQuote: null,
    qqqQuote: null,
    vix: 0,
    marketStatus: { market: 'unknown', afterHours: false, earlyHours: false },
    snapshots: new Map(),
    isLoading: true,
    isLive: false,
    error: null,
    lastUpdated: null,
    isUsingStream: false,
  });

  const allSymbols = useMemo(
    () => ['SPY', 'QQQ', ...additionalSymbols],
    [additionalSymbols]
  );

  // Subscribe to additional symbols when using provider
  useEffect(() => {
    if (providerData && additionalSymbols.length > 0) {
      providerData.subscribe(additionalSymbols);
    }
  }, [providerData, additionalSymbols]);

  // REST fallback fetch (only used when provider is not available)
  const fetchMarketData = useCallback(async () => {
    if (providerData) return; // Skip if using provider

    try {
      const response = await fetch(`/api/ai/market?symbols=${allSymbols.join(',')}`);

      if (!response.ok) {
        if (response.status === 503) {
          setRestState((prev) => ({
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

      setRestState({
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
        isUsingStream: false,
      });
    } catch (error) {
      console.error('Market data fetch error:', error);
      setRestState((prev) => ({
        ...prev,
        isLoading: false,
        isLive: false,
        error: error instanceof Error ? error.message : 'Connection error',
      }));
    }
  }, [allSymbols, providerData]);

  // Initial fetch for REST fallback
  useEffect(() => {
    if (!providerData) {
      fetchMarketData();
    }
  }, [fetchMarketData, providerData]);

  // Auto-refresh for REST fallback
  useEffect(() => {
    if (!autoRefresh || providerData) return;

    const interval = setInterval(fetchMarketData, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, fetchMarketData, providerData]);

  // Manual refresh function
  const refresh = useCallback(() => {
    if (providerData) {
      // For stream, just trigger a UI update (data is already live)
      return;
    }
    setRestState((prev) => ({ ...prev, isLoading: true }));
    fetchMarketData();
  }, [fetchMarketData, providerData]);

  // Build state from provider or REST
  const state = useMemo<MarketDataState>(() => {
    if (providerData) {
      const { prices, connectionStatus, lastUpdate, isUsingFallback } = providerData;

      const spyData = prices['SPY'];
      const qqqData = prices['QQQ'];
      const vixData = prices['VIX'];

      // Build snapshots from provider data
      const snapshots = new Map<string, MarketSnapshot>();
      for (const [symbol, priceData] of Object.entries(prices)) {
        snapshots.set(symbol, {
          symbol,
          quote: priceDataToQuote(symbol, priceData),
          keyLevels: [],
          trend: (priceData.change || 0) >= 0 ? 'bullish' : 'bearish',
          vwap: priceData.vwap || 0,
        });
      }

      return {
        spyQuote: spyData ? priceDataToQuote('SPY', spyData) : null,
        qqqQuote: qqqData ? priceDataToQuote('QQQ', qqqData) : null,
        vix: vixData?.price || 0,
        marketStatus: { market: 'unknown', afterHours: false, earlyHours: false },
        snapshots,
        isLoading: connectionStatus === 'connecting',
        isLive: connectionStatus === 'connected' || connectionStatus === 'fallback',
        error: connectionStatus === 'error' ? 'Connection error' : null,
        lastUpdated: lastUpdate ? new Date(lastUpdate) : null,
        isUsingStream: !isUsingFallback,
      };
    }
    return restState;
  }, [providerData, restState]);

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
      isUsingStream: state.isUsingStream,
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
    refreshInterval: 30000, // 30 seconds for status bar (only used as fallback)
  });

  return {
    data: getMarketStatusBarData(),
    isLoading,
    error,
    isLive,
  };
}

export default useMarketData;
