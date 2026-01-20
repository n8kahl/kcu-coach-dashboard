/**
 * Market Data Stream API Route
 *
 * Provides Server-Sent Events (SSE) stream of market data to clients.
 *
 * Architecture:
 * - This route is a STATELESS fan-out layer
 * - It subscribes to Redis Pub/Sub channels via MarketRedistributor
 * - Market data is ingested by a separate worker process (scripts/market-worker.ts)
 * - This design allows horizontal scaling with multiple API instances
 *
 * Usage:
 *   GET /api/market/stream?symbols=SPY,QQQ,AAPL
 *
 * Events sent:
 *   - type: 'connecting' - Initial connection state
 *   - type: 'subscribed' - Subscription confirmed with symbol list
 *   - type: 'trade' - Real-time trade data
 *   - type: 'bar' - Aggregated bar/candle data
 *   - type: 'heartbeat' - Keep-alive ping (every 30s)
 *   - type: 'error' - Error notification
 */

import { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  createMarketRedistributor,
  StreamMessage,
  MarketRedistributor,
} from '@/lib/market-redistributor';
import { isRedisAvailable } from '@/lib/redis';

// Configuration
const CONFIG = {
  // Default symbols if none specified
  defaultSymbols: ['SPY', 'QQQ'],

  // Heartbeat interval in milliseconds
  heartbeatIntervalMs: 30000,

  // Maximum symbols per connection
  maxSymbols: 50,
};

/**
 * GET /api/market/stream
 *
 * SSE endpoint for real-time market data
 */
export async function GET(request: NextRequest) {
  // Verify authentication
  const session = await getSession();
  if (!session?.userId) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Check Redis availability
  const redisAvailable = await isRedisAvailable();
  if (!redisAvailable) {
    return new Response(
      JSON.stringify({
        error: 'Market data service unavailable',
        message: 'Redis connection not available. Market data streaming requires Redis.',
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // Parse symbols from query parameters
  const { searchParams } = new URL(request.url);
  const symbolsParam = searchParams.get('symbols');
  let symbols = symbolsParam
    ? symbolsParam.split(',').map(s => s.trim().toUpperCase()).filter(s => s.length > 0)
    : CONFIG.defaultSymbols;

  // Limit number of symbols
  if (symbols.length > CONFIG.maxSymbols) {
    symbols = symbols.slice(0, CONFIG.maxSymbols);
    console.warn(`[MarketStream] Limiting symbols to ${CONFIG.maxSymbols}`);
  }

  // Create SSE stream
  const encoder = new TextEncoder();
  let isActive = true;
  let redistributor: MarketRedistributor | null = null;
  let unsubscribe: (() => void) | null = null;
  let heartbeatInterval: NodeJS.Timeout | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Create redistributor instance for this connection
        redistributor = createMarketRedistributor();

        // Send initial connecting state
        sendMessage(controller, encoder, {
          type: 'connecting' as const,
          message: 'Connecting to market data stream...',
        });

        // Subscribe to requested symbols via Redis
        unsubscribe = await redistributor.subscribeToUpdates(
          symbols,
          (symbol: string, message: StreamMessage) => {
            if (!isActive) return;

            try {
              // Forward the message to the client
              sendMessage(controller, encoder, message);
            } catch {
              // Stream closed
              isActive = false;
              cleanup();
            }
          }
        );

        // Send subscription confirmation
        sendMessage(controller, encoder, {
          type: 'subscribed' as const,
          symbols,
          message: `Subscribed to ${symbols.length} symbol(s)`,
        });

        // Start heartbeat to keep connection alive
        heartbeatInterval = setInterval(() => {
          if (!isActive) {
            cleanup();
            return;
          }

          try {
            sendMessage(controller, encoder, { type: 'heartbeat' as const });
          } catch {
            isActive = false;
            cleanup();
          }
        }, CONFIG.heartbeatIntervalMs);

        console.log(`[MarketStream] Client subscribed to: ${symbols.join(', ')}`);
      } catch (error) {
        console.error('[MarketStream] Error setting up stream:', error);
        sendMessage(controller, encoder, {
          type: 'error' as const,
          message: 'Failed to connect to market data stream',
        });
        controller.close();
      }
    },

    cancel() {
      cleanup();
    },
  });

  // Clean up on request abort
  request.signal.addEventListener('abort', () => {
    isActive = false;
    cleanup();
  });

  // Cleanup function
  function cleanup(): void {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }

    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }

    if (redistributor) {
      redistributor.close().catch(console.error);
      redistributor = null;
    }

    console.log('[MarketStream] Client disconnected');
  }

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}

/**
 * Helper to send SSE message
 */
function sendMessage(
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  data: StreamMessage | Record<string, unknown>
): void {
  const message = `data: ${JSON.stringify(data)}\n\n`;
  controller.enqueue(encoder.encode(message));
}
