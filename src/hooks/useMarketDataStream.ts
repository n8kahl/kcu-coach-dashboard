'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Connection status for the market data stream
 */
export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'error' | 'fallback';

/**
 * Message types from the SSE stream
 */
interface StreamMessage {
  type: 'connected' | 'connecting' | 'subscribed' | 'quote' | 'trade' | 'bar' | 'error' | 'heartbeat';
  symbol?: string;
  data?: {
    price?: number;
    size?: number;
    volume?: number;
    vwap?: number;
    open?: number;
    high?: number;
    low?: number;
    close?: number;
    timestamp?: number;
  };
  symbols?: string[];
  message?: string;
}

/**
 * Price data structure
 */
export interface PriceData {
  price: number;
  change?: number;
  changePercent?: number;
  volume?: number;
  vwap?: number;
  high?: number;
  low?: number;
  open?: number;
  timestamp: number;
}

/**
 * Return type for the useMarketDataStream hook
 */
export interface MarketDataStreamResult {
  prices: Record<string, PriceData>;
  connectionStatus: ConnectionStatus;
  lastUpdate: number | null;
  subscribe: (symbols: string[]) => void;
  unsubscribe: (symbols: string[]) => void;
  isUsingFallback: boolean;
}

/**
 * Configuration options for the market data stream
 */
interface MarketDataStreamConfig {
  /** Initial symbols to subscribe to */
  symbols?: string[];
  /** Enable REST fallback polling (default: true) */
  enableFallback?: boolean;
  /** Fallback polling interval in ms (default: 5000) */
  fallbackInterval?: number;
  /** Maximum SSE reconnection attempts before fallback (default: 3) */
  maxReconnectAttempts?: number;
  /** Enable debug logging (default: false) */
  debug?: boolean;
}

/**
 * Throttle function to limit the rate of function calls
 */
function throttle<T extends (...args: unknown[]) => void>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  let lastArgs: Parameters<T> | null = null;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
        if (lastArgs) {
          func(...lastArgs);
          lastArgs = null;
        }
      }, limit);
    } else {
      lastArgs = args;
    }
  };
}

/**
 * useMarketDataStream
 *
 * A production-ready hook for real-time market data streaming.
 * Uses SSE (Server-Sent Events) for real-time updates with REST API fallback.
 *
 * Features:
 * - SSE connection to server-side WebSocket proxy
 * - Automatic REST fallback when SSE unavailable
 * - Throttled state updates
 * - Subscription management
 * - Automatic cleanup on unmount
 *
 * @example
 * ```tsx
 * const { prices, connectionStatus, isUsingFallback } = useMarketDataStream({
 *   symbols: ['SPY', 'QQQ', 'TSLA'],
 * });
 *
 * return (
 *   <div>
 *     <span>Status: {connectionStatus}</span>
 *     <span>SPY: ${prices.SPY?.price.toFixed(2)}</span>
 *     {isUsingFallback && <span>(Polling mode)</span>}
 *   </div>
 * );
 * ```
 */
export function useMarketDataStream(
  config: MarketDataStreamConfig = {}
): MarketDataStreamResult {
  const {
    symbols: initialSymbols = [],
    enableFallback = true,
    fallbackInterval = 10000, // Increased from 5000 to reduce rate limit issues
    maxReconnectAttempts = 3,
    debug = false,
  } = config;

  // State
  const [prices, setPrices] = useState<Record<string, PriceData>>({});
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);
  const [isUsingFallback, setIsUsingFallback] = useState(false);

  // Refs
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fallbackIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const subscribedSymbolsRef = useRef<Set<string>>(new Set(initialSymbols));
  const priceBufferRef = useRef<Record<string, PriceData>>({});
  const isUnmountedRef = useRef(false);
  const previousPricesRef = useRef<Record<string, number>>({});

  // Debug logger
  const log = useCallback(
    (...args: unknown[]) => {
      if (debug) {
        console.log('[MarketDataStream]', ...args);
      }
    },
    [debug]
  );

  // Throttled state update function
  const flushPriceBuffer = useCallback(
    throttle(() => {
      if (isUnmountedRef.current) return;

      const bufferedPrices = { ...priceBufferRef.current };
      if (Object.keys(bufferedPrices).length > 0) {
        setPrices((prev) => ({ ...prev, ...bufferedPrices }));
        setLastUpdate(Date.now());
        priceBufferRef.current = {};
      }
    }, 200),
    []
  );

  // REST fallback fetch - limited concurrency to prevent rate limiting
  const fetchFallbackData = useCallback(async () => {
    if (isUnmountedRef.current) return;

    const symbols = Array.from(subscribedSymbolsRef.current);
    if (symbols.length === 0) return;

    // Limit to max 3 concurrent requests to avoid rate limiting
    const MAX_CONCURRENT = 3;
    const fetchSymbol = async (symbol: string) => {
      try {
        const res = await fetch(`/api/market/quote?symbol=${symbol}`);
        if (!res.ok) {
          if (res.status === 503) {
            log('Market data service not configured');
            setConnectionStatus('error');
            return null;
          }
          if (res.status === 429) {
            log('Rate limited, skipping symbol:', symbol);
            return null;
          }
          return null;
        }
        const d = await res.json();
        return d.quote;
      } catch (e) {
        log('Fallback fetch error for', symbol, e);
        return null;
      }
    };

    try {
      // Process symbols in batches to limit concurrency
      for (let i = 0; i < symbols.length; i += MAX_CONCURRENT) {
        if (isUnmountedRef.current) return;

        const batch = symbols.slice(i, i + MAX_CONCURRENT);
        const results = await Promise.all(batch.map(fetchSymbol));

        results.forEach((quote) => {
          if (quote) {
            priceBufferRef.current[quote.symbol] = {
              price: quote.price,
              change: quote.change,
              changePercent: quote.changePercent,
              volume: quote.volume,
              vwap: quote.vwap,
              high: quote.high,
              low: quote.low,
              open: quote.open,
              timestamp: Date.now(),
            };
            previousPricesRef.current[quote.symbol] = quote.price;
          }
        });
      }

      flushPriceBuffer();
    } catch (error) {
      log('Fallback fetch error:', error);
    }
  }, [flushPriceBuffer, log]);

  // Start fallback polling
  const startFallback = useCallback(() => {
    if (!enableFallback || isUnmountedRef.current) return;

    log('Starting REST fallback polling');
    setIsUsingFallback(true);
    setConnectionStatus('fallback');

    // Initial fetch
    fetchFallbackData();

    // Start interval
    fallbackIntervalRef.current = setInterval(fetchFallbackData, fallbackInterval);
  }, [enableFallback, fallbackInterval, fetchFallbackData, log]);

  // Stop fallback polling
  const stopFallback = useCallback(() => {
    if (fallbackIntervalRef.current) {
      clearInterval(fallbackIntervalRef.current);
      fallbackIntervalRef.current = null;
    }
    setIsUsingFallback(false);
  }, []);

  // Connect to SSE stream
  const connect = useCallback(() => {
    if (isUnmountedRef.current) return;
    if (eventSourceRef.current?.readyState === EventSource.OPEN) return;

    const symbols = Array.from(subscribedSymbolsRef.current);
    if (symbols.length === 0) {
      log('No symbols to subscribe to');
      return;
    }

    log('Connecting to SSE stream...');
    setConnectionStatus('connecting');

    try {
      const url = `/api/market/stream?symbols=${symbols.join(',')}`;
      const eventSource = new EventSource(url);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        if (isUnmountedRef.current) {
          eventSource.close();
          return;
        }
        log('SSE connected');
        reconnectAttemptRef.current = 0;
        stopFallback();

        // Always do an initial REST fetch to get current prices immediately
        // This is especially important during market closed hours when streams have no data
        fetchFallbackData();
      };

      eventSource.onmessage = (event) => {
        try {
          const message: StreamMessage = JSON.parse(event.data);

          switch (message.type) {
            case 'connected':
              log('Server confirmed connection');
              setConnectionStatus('connected');
              break;

            case 'subscribed':
              log('Subscribed to:', message.symbols);
              break;

            case 'trade':
            case 'bar':
              if (message.symbol && message.data) {
                const prev = previousPricesRef.current[message.symbol];
                const price = message.data.price || message.data.close || 0;

                priceBufferRef.current[message.symbol] = {
                  price,
                  volume: message.data.volume,
                  vwap: message.data.vwap,
                  high: message.data.high,
                  low: message.data.low,
                  open: message.data.open,
                  timestamp: message.data.timestamp || Date.now(),
                  change: prev ? price - prev : undefined,
                  changePercent: prev ? ((price - prev) / prev) * 100 : undefined,
                };

                previousPricesRef.current[message.symbol] = price;
                flushPriceBuffer();
              }
              break;

            case 'error':
              log('Stream error:', message.message);
              break;

            case 'heartbeat':
              log('Heartbeat received');
              break;
          }
        } catch (e) {
          log('Message parse error:', e);
        }
      };

      eventSource.onerror = () => {
        log('SSE error/disconnected');
        eventSource.close();
        eventSourceRef.current = null;

        if (isUnmountedRef.current) return;

        // Attempt reconnection
        if (reconnectAttemptRef.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptRef.current), 10000);
          log(`Reconnecting in ${delay}ms (attempt ${reconnectAttemptRef.current + 1}/${maxReconnectAttempts})`);

          setConnectionStatus('connecting');
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptRef.current++;
            connect();
          }, delay);
        } else {
          log('Max reconnect attempts reached, switching to fallback');
          setConnectionStatus('fallback');
          startFallback();
        }
      };
    } catch (error) {
      log('Failed to create EventSource:', error);
      setConnectionStatus('error');
      startFallback();
    }
  }, [fetchFallbackData, flushPriceBuffer, log, maxReconnectAttempts, startFallback, stopFallback]);

  // Subscribe to additional symbols
  const subscribe = useCallback(
    (symbols: string[]) => {
      const newSymbols = symbols.filter((s) => !subscribedSymbolsRef.current.has(s));
      if (newSymbols.length === 0) return;

      for (const symbol of newSymbols) {
        subscribedSymbolsRef.current.add(symbol);
      }

      // Reconnect to include new symbols
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      connect();
    },
    [connect]
  );

  // Unsubscribe from symbols
  const unsubscribe = useCallback(
    (symbols: string[]) => {
      const existingSymbols = symbols.filter((s) => subscribedSymbolsRef.current.has(s));
      if (existingSymbols.length === 0) return;

      for (const symbol of existingSymbols) {
        subscribedSymbolsRef.current.delete(symbol);
        delete previousPricesRef.current[symbol];
      }

      // Remove from prices state
      setPrices((prev) => {
        const updated = { ...prev };
        for (const symbol of existingSymbols) {
          delete updated[symbol];
        }
        return updated;
      });

      // Reconnect with updated symbols
      if (subscribedSymbolsRef.current.size > 0) {
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
          eventSourceRef.current = null;
        }
        connect();
      }
    },
    [connect]
  );

  // Connect on mount
  useEffect(() => {
    isUnmountedRef.current = false;

    if (subscribedSymbolsRef.current.size > 0) {
      connect();
    }

    return () => {
      isUnmountedRef.current = true;

      // Clear reconnection timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      // Stop fallback
      if (fallbackIntervalRef.current) {
        clearInterval(fallbackIntervalRef.current);
        fallbackIntervalRef.current = null;
      }

      // Close EventSource
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [connect]);

  // Update subscribed symbols when initialSymbols changes
  useEffect(() => {
    const currentSymbols = subscribedSymbolsRef.current;
    const newSymbols = new Set(initialSymbols);

    // Subscribe to new symbols
    const toSubscribe = initialSymbols.filter((s) => !currentSymbols.has(s));
    if (toSubscribe.length > 0) {
      subscribe(toSubscribe);
    }

    // Unsubscribe from removed symbols
    const toUnsubscribe = Array.from(currentSymbols).filter((s) => !newSymbols.has(s));
    if (toUnsubscribe.length > 0) {
      unsubscribe(toUnsubscribe);
    }
  }, [initialSymbols, subscribe, unsubscribe]);

  return {
    prices,
    connectionStatus,
    lastUpdate,
    subscribe,
    unsubscribe,
    isUsingFallback,
  };
}

export default useMarketDataStream;
