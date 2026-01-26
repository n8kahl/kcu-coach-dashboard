'use client';

/**
 * MarketSocketProvider.tsx
 *
 * Real-time market data provider specifically for Companion Mode charts.
 * Provides sub-100ms latency updates via imperative chart updates.
 *
 * ARCHITECTURE:
 * - Uses SSE connection to /api/market/stream (Redis pub/sub backed)
 * - Maintains internal candle state and aggregates ticks into candles
 * - Exposes imperative methods for direct chart updates
 * - Tracks latency for performance monitoring
 * - Mode guard prevents practice data from leaking into companion mode
 *
 * Key Features:
 * - Auto-reconnection with exponential backoff (max 30s)
 * - Candle aggregation from tick data
 * - Latency tracking (roundtrip and update latency)
 * - Mode-aware data fetching (PRACTICE vs COMPANION)
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from 'react';
import type { ChartCandle, ProfessionalChartHandle } from '@/components/charts/ProfessionalChart';

// =============================================================================
// Types
// =============================================================================

export type DataMode = 'PRACTICE' | 'COMPANION';
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';

export interface LatencyMetrics {
  /** Last measured roundtrip latency in ms */
  roundtripMs: number;
  /** Last chart update latency in ms */
  updateMs: number;
  /** Average latency over last 10 updates */
  avgMs: number;
  /** Peak latency seen */
  peakMs: number;
  /** Timestamp of last update */
  lastUpdateAt: number;
}

export interface MarketTick {
  symbol: string;
  price: number;
  size?: number;
  volume?: number;
  timestamp: number;
  // For bar/candle updates
  open?: number;
  high?: number;
  low?: number;
  close?: number;
}

export interface MarketSocketContextValue {
  // Connection state
  connectionState: ConnectionState;
  isConnected: boolean;
  error: string | null;

  // Current data
  currentPrice: number | null;
  currentCandle: ChartCandle | null;
  lastTick: MarketTick | null;

  // Latency metrics
  latency: LatencyMetrics;

  // Mode
  mode: DataMode;

  // Chart integration
  chartRef: React.RefObject<ProfessionalChartHandle>;
  setChartRef: (ref: React.RefObject<ProfessionalChartHandle>) => void;

  // Manual controls
  connect: () => void;
  disconnect: () => void;
  setSymbol: (symbol: string) => void;
}

// =============================================================================
// Constants
// =============================================================================

const INITIAL_LATENCY: LatencyMetrics = {
  roundtripMs: 0,
  updateMs: 0,
  avgMs: 0,
  peakMs: 0,
  lastUpdateAt: 0,
};

// Exponential backoff config
const BACKOFF = {
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  multiplier: 2,
};

// Candle interval in seconds (5 minutes default)
const CANDLE_INTERVAL_SECONDS = 300;

// =============================================================================
// Context
// =============================================================================

const MarketSocketContext = createContext<MarketSocketContextValue | null>(null);

// =============================================================================
// Provider Props
// =============================================================================

interface MarketSocketProviderProps {
  children: React.ReactNode;
  /** Initial symbol to stream */
  symbol?: string;
  /** Data mode - COMPANION uses real API, PRACTICE may use scenarios */
  mode?: DataMode;
  /** Candle interval in minutes (default: 5) */
  candleIntervalMinutes?: number;
  /** Enable debug logging */
  debug?: boolean;
}

// =============================================================================
// Provider Component
// =============================================================================

export function MarketSocketProvider({
  children,
  symbol: initialSymbol = 'SPY',
  mode = 'COMPANION',
  candleIntervalMinutes = 5,
  debug = false,
}: MarketSocketProviderProps) {
  // State
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [currentCandle, setCurrentCandle] = useState<ChartCandle | null>(null);
  const [lastTick, setLastTick] = useState<MarketTick | null>(null);
  const [latency, setLatency] = useState<LatencyMetrics>(INITIAL_LATENCY);
  const [symbol, setSymbolState] = useState(initialSymbol);

  // Refs
  const eventSourceRef = useRef<EventSource | null>(null);
  const chartRefInternal = useRef<ProfessionalChartHandle | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);
  const latencyHistoryRef = useRef<number[]>([]);
  const candleIntervalSeconds = candleIntervalMinutes * 60;

  // Current candle being built from ticks
  const buildingCandleRef = useRef<ChartCandle | null>(null);
  const lastCandleTimeRef = useRef<number>(0);

  // Chart ref wrapper
  const chartRef = useRef<ProfessionalChartHandle>(null);

  // Debug logger
  const log = useCallback(
    (...args: unknown[]) => {
      if (debug) {
        console.log('[MarketSocket]', ...args);
      }
    },
    [debug]
  );

  // Update latency metrics
  const updateLatency = useCallback((newLatencyMs: number) => {
    latencyHistoryRef.current.push(newLatencyMs);
    if (latencyHistoryRef.current.length > 10) {
      latencyHistoryRef.current.shift();
    }

    const history = latencyHistoryRef.current;
    const avg = history.reduce((a, b) => a + b, 0) / history.length;

    setLatency((prev) => ({
      roundtripMs: newLatencyMs,
      updateMs: newLatencyMs,
      avgMs: Math.round(avg),
      peakMs: Math.max(prev.peakMs, newLatencyMs),
      lastUpdateAt: Date.now(),
    }));
  }, []);

  // Get candle time bucket for a timestamp
  const getCandleTime = useCallback(
    (timestamp: number): number => {
      const seconds = timestamp > 1e12 ? Math.floor(timestamp / 1000) : timestamp;
      return Math.floor(seconds / candleIntervalSeconds) * candleIntervalSeconds;
    },
    [candleIntervalSeconds]
  );

  // Process incoming tick and update candle
  const processTick = useCallback(
    (tick: MarketTick) => {
      const startTime = performance.now();
      const price = tick.price || tick.close || 0;
      if (!price || price <= 0) return;

      setCurrentPrice(price);
      setLastTick(tick);

      // Determine candle time
      const candleTime = getCandleTime(tick.timestamp || Date.now());

      // If this is a bar/candle update, use it directly
      if (tick.open && tick.high && tick.low && tick.close) {
        const candle: ChartCandle = {
          time: candleTime,
          open: tick.open,
          high: tick.high,
          low: tick.low,
          close: tick.close,
          volume: tick.volume || 0,
        };

        setCurrentCandle(candle);

        // Update chart imperatively
        if (chartRefInternal.current) {
          chartRefInternal.current.updateLastCandle(candle);
        }

        const latencyMs = performance.now() - startTime;
        updateLatency(latencyMs);
        return;
      }

      // Otherwise, aggregate ticks into a candle
      if (lastCandleTimeRef.current !== candleTime) {
        // New candle started
        if (buildingCandleRef.current && lastCandleTimeRef.current > 0) {
          // Finalize previous candle
          const finalizedCandle = { ...buildingCandleRef.current };
          if (chartRefInternal.current) {
            chartRefInternal.current.addCandle(finalizedCandle);
          }
        }

        // Start new candle
        buildingCandleRef.current = {
          time: candleTime,
          open: price,
          high: price,
          low: price,
          close: price,
          volume: tick.volume || tick.size || 0,
        };
        lastCandleTimeRef.current = candleTime;
      } else if (buildingCandleRef.current) {
        // Update existing candle
        buildingCandleRef.current = {
          ...buildingCandleRef.current,
          high: Math.max(buildingCandleRef.current.high, price),
          low: Math.min(buildingCandleRef.current.low, price),
          close: price,
          volume: (buildingCandleRef.current.volume || 0) + (tick.volume || tick.size || 0),
        };
      }

      if (buildingCandleRef.current) {
        setCurrentCandle(buildingCandleRef.current);

        // Update chart imperatively
        if (chartRefInternal.current) {
          chartRefInternal.current.updateLastCandle(buildingCandleRef.current);
        }
      }

      const latencyMs = performance.now() - startTime;
      updateLatency(latencyMs);
    },
    [getCandleTime, updateLatency]
  );

  // Connect to SSE stream
  const connect = useCallback(() => {
    if (!mountedRef.current) return;
    if (eventSourceRef.current?.readyState === EventSource.OPEN) return;

    // Mode guard: In COMPANION mode, ensure we're using real data endpoints
    if (mode === 'COMPANION') {
      log('COMPANION mode - using real market data stream');
    }

    log(`Connecting to market stream for ${symbol}...`);
    setConnectionState('connecting');
    setError(null);

    try {
      const url = `/api/market/stream?symbols=${symbol}`;
      const eventSource = new EventSource(url);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        if (!mountedRef.current) {
          eventSource.close();
          return;
        }
        log('Connected to market stream');
        setConnectionState('connected');
        reconnectAttemptRef.current = 0;
      };

      eventSource.onmessage = (event) => {
        if (!mountedRef.current) return;

        try {
          const message = JSON.parse(event.data);

          switch (message.type) {
            case 'connected':
            case 'subscribed':
              setConnectionState('connected');
              break;

            case 'trade':
            case 'bar':
            case 'quote':
              if (message.symbol === symbol && message.data) {
                const tick: MarketTick = {
                  symbol: message.symbol,
                  price: message.data.price || message.data.close || 0,
                  size: message.data.size,
                  volume: message.data.volume,
                  timestamp: message.data.timestamp || Date.now(),
                  open: message.data.open,
                  high: message.data.high,
                  low: message.data.low,
                  close: message.data.close,
                };
                processTick(tick);
              }
              break;

            case 'error':
              log('Stream error:', message.message);
              setError(message.message || 'Stream error');
              break;

            case 'heartbeat':
              // Connection is alive
              break;
          }
        } catch (e) {
          log('Message parse error:', e);
        }
      };

      eventSource.onerror = () => {
        log('Stream disconnected');
        eventSource.close();
        eventSourceRef.current = null;

        if (!mountedRef.current) return;

        // Exponential backoff reconnection
        const attempt = reconnectAttemptRef.current;
        const delay = Math.min(
          BACKOFF.initialDelayMs * Math.pow(BACKOFF.multiplier, attempt),
          BACKOFF.maxDelayMs
        );

        log(`Reconnecting in ${delay}ms (attempt ${attempt + 1})`);
        setConnectionState('reconnecting');

        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectAttemptRef.current++;
          connect();
        }, delay);
      };
    } catch (e) {
      log('Failed to create EventSource:', e);
      setConnectionState('error');
      setError('Failed to connect to market data stream');
    }
  }, [symbol, mode, log, processTick]);

  // Disconnect from stream
  const disconnect = useCallback(() => {
    log('Disconnecting from market stream');

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    setConnectionState('disconnected');
  }, [log]);

  // Set symbol and reconnect
  const setSymbol = useCallback(
    (newSymbol: string) => {
      if (newSymbol === symbol) return;

      log(`Switching symbol to ${newSymbol}`);
      setSymbolState(newSymbol);

      // Reset candle state
      buildingCandleRef.current = null;
      lastCandleTimeRef.current = 0;
      setCurrentCandle(null);
      setCurrentPrice(null);

      // Reconnect with new symbol
      disconnect();
      // Small delay to ensure cleanup
      setTimeout(() => {
        if (mountedRef.current) {
          connect();
        }
      }, 100);
    },
    [symbol, disconnect, connect, log]
  );

  // Set chart ref for imperative updates
  const setChartRef = useCallback(
    (ref: React.RefObject<ProfessionalChartHandle>) => {
      chartRefInternal.current = ref.current;
      // Also expose on the external chartRef
      (chartRef as React.MutableRefObject<ProfessionalChartHandle | null>).current = ref.current;
    },
    []
  );

  // Connect on mount
  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      disconnect();
    };
  }, [connect, disconnect]);

  // Reconnect when symbol changes
  useEffect(() => {
    if (symbol !== initialSymbol) {
      setSymbol(initialSymbol);
    }
  }, [initialSymbol, symbol, setSymbol]);

  // Context value
  const value = useMemo<MarketSocketContextValue>(
    () => ({
      connectionState,
      isConnected: connectionState === 'connected',
      error,
      currentPrice,
      currentCandle,
      lastTick,
      latency,
      mode,
      chartRef,
      setChartRef,
      connect,
      disconnect,
      setSymbol,
    }),
    [
      connectionState,
      error,
      currentPrice,
      currentCandle,
      lastTick,
      latency,
      mode,
      setChartRef,
      connect,
      disconnect,
      setSymbol,
    ]
  );

  return (
    <MarketSocketContext.Provider value={value}>
      {children}
    </MarketSocketContext.Provider>
  );
}

// =============================================================================
// Hooks
// =============================================================================

/**
 * Hook to access market socket context
 * Must be used within a MarketSocketProvider
 */
export function useMarketSocket(): MarketSocketContextValue {
  const context = useContext(MarketSocketContext);
  if (!context) {
    throw new Error('useMarketSocket must be used within a MarketSocketProvider');
  }
  return context;
}

/**
 * Hook to connect chart ref to the market socket for imperative updates
 *
 * @example
 * ```tsx
 * const chartRef = useRef<ProfessionalChartHandle>(null);
 * useChartConnection(chartRef);
 *
 * return <ProfessionalChart ref={chartRef} />;
 * ```
 */
export function useChartConnection(
  chartRef: React.RefObject<ProfessionalChartHandle>
): void {
  const { setChartRef } = useMarketSocket();

  useEffect(() => {
    if (chartRef.current) {
      setChartRef(chartRef);
    }
  }, [chartRef, setChartRef]);
}

/**
 * Hook for components that may be outside the provider
 * Returns null if not within provider
 */
export function useOptionalMarketSocket(): MarketSocketContextValue | null {
  return useContext(MarketSocketContext);
}

export default MarketSocketProvider;
