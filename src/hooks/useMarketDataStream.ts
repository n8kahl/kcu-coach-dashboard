'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Connection status for the WebSocket
 */
export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'error';

/**
 * WebSocket message types from the market data stream
 */
interface PriceUpdateMessage {
  type: 'price_update';
  symbol: string;
  price: number;
  timestamp: number;
}

interface BatchPriceUpdateMessage {
  type: 'batch_update';
  prices: Array<{ symbol: string; price: number }>;
  timestamp: number;
}

interface HeartbeatMessage {
  type: 'heartbeat';
  timestamp: number;
}

interface ErrorMessage {
  type: 'error';
  code: string;
  message: string;
}

type WebSocketMessage =
  | PriceUpdateMessage
  | BatchPriceUpdateMessage
  | HeartbeatMessage
  | ErrorMessage;

/**
 * Return type for the useMarketDataStream hook
 */
export interface MarketDataStreamResult {
  prices: Record<string, number>;
  connectionStatus: ConnectionStatus;
  lastUpdate: number | null;
  subscribe: (symbols: string[]) => void;
  unsubscribe: (symbols: string[]) => void;
}

/**
 * Configuration options for the market data stream
 */
interface MarketDataStreamConfig {
  /** WebSocket URL (defaults to placeholder) */
  url?: string;
  /** Initial symbols to subscribe to */
  symbols?: string[];
  /** Maximum reconnection attempts (default: 10) */
  maxReconnectAttempts?: number;
  /** Base delay for exponential backoff in ms (default: 1000) */
  baseReconnectDelay?: number;
  /** Maximum delay between reconnection attempts in ms (default: 30000) */
  maxReconnectDelay?: number;
  /** Throttle interval for state updates in ms (default: 200) */
  throttleMs?: number;
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
 * Calculate exponential backoff delay with jitter
 */
function getBackoffDelay(
  attempt: number,
  baseDelay: number,
  maxDelay: number
): number {
  // Exponential backoff: baseDelay * 2^attempt
  const exponentialDelay = baseDelay * Math.pow(2, attempt);
  // Add random jitter (0-25% of delay) to prevent thundering herd
  const jitter = exponentialDelay * Math.random() * 0.25;
  // Cap at maxDelay
  return Math.min(exponentialDelay + jitter, maxDelay);
}

/**
 * Parse incoming WebSocket message with type safety
 */
function parseMessage(data: string): WebSocketMessage | null {
  try {
    const parsed = JSON.parse(data);

    // Validate message type
    if (!parsed || typeof parsed !== 'object' || !parsed.type) {
      return null;
    }

    switch (parsed.type) {
      case 'price_update':
        if (typeof parsed.symbol === 'string' && typeof parsed.price === 'number') {
          return parsed as PriceUpdateMessage;
        }
        break;
      case 'batch_update':
        if (Array.isArray(parsed.prices)) {
          return parsed as BatchPriceUpdateMessage;
        }
        break;
      case 'heartbeat':
        return parsed as HeartbeatMessage;
      case 'error':
        if (typeof parsed.code === 'string' && typeof parsed.message === 'string') {
          return parsed as ErrorMessage;
        }
        break;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * useMarketDataStream
 *
 * A production-ready WebSocket hook for real-time market data streaming.
 *
 * Features:
 * - Exponential backoff reconnection with jitter
 * - Throttled state updates (configurable, default 200ms)
 * - Type-safe message handling
 * - Subscription management
 * - Automatic cleanup on unmount
 *
 * @example
 * ```tsx
 * const { prices, connectionStatus } = useMarketDataStream({
 *   symbols: ['SPY', 'QQQ', 'TSLA'],
 *   throttleMs: 200,
 * });
 *
 * return (
 *   <div>
 *     <span>Status: {connectionStatus}</span>
 *     <span>SPY: ${prices.SPY?.toFixed(2)}</span>
 *   </div>
 * );
 * ```
 */
export function useMarketDataStream(
  config: MarketDataStreamConfig = {}
): MarketDataStreamResult {
  const {
    // Placeholder URL - replace with actual market data WebSocket endpoint
    url = process.env.NEXT_PUBLIC_MARKET_WS_URL || 'wss://api.example.com/market-stream',
    symbols: initialSymbols = [],
    maxReconnectAttempts = 10,
    baseReconnectDelay = 1000,
    maxReconnectDelay = 30000,
    throttleMs = 200,
    debug = false,
  } = config;

  // State
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);

  // Refs for WebSocket management
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const subscribedSymbolsRef = useRef<Set<string>>(new Set(initialSymbols));
  const priceBufferRef = useRef<Record<string, number>>({});
  const isUnmountedRef = useRef(false);

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
    }, throttleMs),
    [throttleMs]
  );

  // Handle incoming messages
  const handleMessage = useCallback(
    (event: MessageEvent) => {
      const message = parseMessage(event.data);
      if (!message) {
        log('Invalid message received:', event.data);
        return;
      }

      switch (message.type) {
        case 'price_update':
          log('Price update:', message.symbol, message.price);
          priceBufferRef.current[message.symbol] = message.price;
          flushPriceBuffer();
          break;

        case 'batch_update':
          log('Batch update:', message.prices.length, 'prices');
          for (const { symbol, price } of message.prices) {
            priceBufferRef.current[symbol] = price;
          }
          flushPriceBuffer();
          break;

        case 'heartbeat':
          log('Heartbeat received');
          break;

        case 'error':
          log('Error from server:', message.code, message.message);
          break;
      }
    },
    [flushPriceBuffer, log]
  );

  // Send subscription message
  const sendSubscription = useCallback(
    (action: 'subscribe' | 'unsubscribe', symbols: string[]) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: action,
            symbols,
          })
        );
        log(`Sent ${action} for:`, symbols);
      }
    },
    [log]
  );

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (isUnmountedRef.current) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    log('Connecting to WebSocket...');
    setConnectionStatus('connecting');

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (isUnmountedRef.current) {
          ws.close();
          return;
        }

        log('Connected');
        setConnectionStatus('connected');
        reconnectAttemptRef.current = 0;

        // Subscribe to initial symbols
        const symbols = Array.from(subscribedSymbolsRef.current);
        if (symbols.length > 0) {
          sendSubscription('subscribe', symbols);
        }
      };

      ws.onmessage = handleMessage;

      ws.onerror = (error) => {
        log('WebSocket error:', error);
      };

      ws.onclose = (event) => {
        log('Connection closed:', event.code, event.reason);
        wsRef.current = null;

        if (isUnmountedRef.current) return;

        // Attempt reconnection with exponential backoff
        if (reconnectAttemptRef.current < maxReconnectAttempts) {
          const delay = getBackoffDelay(
            reconnectAttemptRef.current,
            baseReconnectDelay,
            maxReconnectDelay
          );

          log(`Reconnecting in ${Math.round(delay)}ms (attempt ${reconnectAttemptRef.current + 1}/${maxReconnectAttempts})`);
          setConnectionStatus('connecting');

          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptRef.current++;
            connect();
          }, delay);
        } else {
          log('Max reconnection attempts reached');
          setConnectionStatus('error');
        }
      };
    } catch (error) {
      log('Failed to create WebSocket:', error);
      setConnectionStatus('error');
    }
  }, [
    url,
    handleMessage,
    sendSubscription,
    maxReconnectAttempts,
    baseReconnectDelay,
    maxReconnectDelay,
    log,
  ]);

  // Subscribe to additional symbols
  const subscribe = useCallback(
    (symbols: string[]) => {
      const newSymbols = symbols.filter((s) => !subscribedSymbolsRef.current.has(s));
      if (newSymbols.length === 0) return;

      for (const symbol of newSymbols) {
        subscribedSymbolsRef.current.add(symbol);
      }
      sendSubscription('subscribe', newSymbols);
    },
    [sendSubscription]
  );

  // Unsubscribe from symbols
  const unsubscribe = useCallback(
    (symbols: string[]) => {
      const existingSymbols = symbols.filter((s) => subscribedSymbolsRef.current.has(s));
      if (existingSymbols.length === 0) return;

      for (const symbol of existingSymbols) {
        subscribedSymbolsRef.current.delete(symbol);
      }
      sendSubscription('unsubscribe', existingSymbols);

      // Remove from prices state
      setPrices((prev) => {
        const updated = { ...prev };
        for (const symbol of existingSymbols) {
          delete updated[symbol];
        }
        return updated;
      });
    },
    [sendSubscription]
  );

  // Connect on mount
  useEffect(() => {
    isUnmountedRef.current = false;
    connect();

    return () => {
      isUnmountedRef.current = true;

      // Clear reconnection timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      // Close WebSocket
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounting');
        wsRef.current = null;
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
  };
}

export default useMarketDataStream;
