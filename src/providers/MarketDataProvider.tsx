'use client';

import React, { createContext, useContext, useCallback, useMemo } from 'react';
import { useMarketDataStream, type PriceData, type ConnectionStatus } from '@/hooks/useMarketDataStream';

/**
 * Market status information
 */
export interface MarketStatus {
  market: 'open' | 'closed' | 'extended-hours' | 'unknown';
  afterHours: boolean;
  earlyHours: boolean;
}

/**
 * Context value type
 */
interface MarketDataContextValue {
  // Real-time prices from SSE/WebSocket
  prices: Record<string, PriceData>;

  // Connection status
  connectionStatus: ConnectionStatus;
  isUsingFallback: boolean;
  lastUpdate: number | null;

  // Subscription management
  subscribe: (symbols: string[]) => void;
  unsubscribe: (symbols: string[]) => void;

  // Helper functions
  getPrice: (symbol: string) => number | null;
  getPriceData: (symbol: string) => PriceData | null;
  getChange: (symbol: string) => { change: number; changePercent: number } | null;
}

const MarketDataContext = createContext<MarketDataContextValue | null>(null);

/**
 * Provider props
 */
interface MarketDataProviderProps {
  children: React.ReactNode;
  /** Default symbols to subscribe to on mount */
  defaultSymbols?: string[];
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * MarketDataProvider
 *
 * Provides app-wide market data through a single SSE connection with REST fallback.
 * Wrap your app with this provider to share real-time market data across components.
 *
 * @example
 * ```tsx
 * // In layout.tsx or a parent component
 * <MarketDataProvider defaultSymbols={['SPY', 'QQQ']}>
 *   <App />
 * </MarketDataProvider>
 *
 * // In any child component
 * const { prices, connectionStatus, subscribe } = useMarketDataContext();
 * ```
 */
export function MarketDataProvider({
  children,
  defaultSymbols = ['SPY', 'QQQ'],
  debug = false,
}: MarketDataProviderProps) {
  const {
    prices,
    connectionStatus,
    lastUpdate,
    subscribe,
    unsubscribe,
    isUsingFallback,
  } = useMarketDataStream({
    symbols: defaultSymbols,
    debug,
  });

  // Helper: Get just the price for a symbol
  const getPrice = useCallback(
    (symbol: string): number | null => {
      return prices[symbol]?.price ?? null;
    },
    [prices]
  );

  // Helper: Get full price data for a symbol
  const getPriceData = useCallback(
    (symbol: string): PriceData | null => {
      return prices[symbol] ?? null;
    },
    [prices]
  );

  // Helper: Get change info for a symbol
  const getChange = useCallback(
    (symbol: string): { change: number; changePercent: number } | null => {
      const data = prices[symbol];
      if (!data || data.change === undefined || data.changePercent === undefined) {
        return null;
      }
      return {
        change: data.change,
        changePercent: data.changePercent,
      };
    },
    [prices]
  );

  const value = useMemo<MarketDataContextValue>(
    () => ({
      prices,
      connectionStatus,
      isUsingFallback,
      lastUpdate,
      subscribe,
      unsubscribe,
      getPrice,
      getPriceData,
      getChange,
    }),
    [
      prices,
      connectionStatus,
      isUsingFallback,
      lastUpdate,
      subscribe,
      unsubscribe,
      getPrice,
      getPriceData,
      getChange,
    ]
  );

  return (
    <MarketDataContext.Provider value={value}>
      {children}
    </MarketDataContext.Provider>
  );
}

/**
 * Hook to access market data context
 *
 * Must be used within a MarketDataProvider
 */
export function useMarketDataContext(): MarketDataContextValue {
  const context = useContext(MarketDataContext);
  if (!context) {
    throw new Error('useMarketDataContext must be used within a MarketDataProvider');
  }
  return context;
}

/**
 * Hook for components that need market data but may be outside the provider
 * Returns null if not within provider instead of throwing
 */
export function useOptionalMarketData(): MarketDataContextValue | null {
  return useContext(MarketDataContext);
}

export default MarketDataProvider;
