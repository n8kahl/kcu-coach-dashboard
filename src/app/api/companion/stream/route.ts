import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { addConnection, removeConnection } from '@/lib/broadcast';
import { priceBridge } from '@/lib/price-bridge';
import { supabaseAdmin } from '@/lib/supabase';
import logger from '@/lib/logger';

// SSE endpoint for real-time updates
export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.userId;

    // Get symbols from query params or fetch from watchlist
    const url = new URL(request.url);
    let symbols: string[] = [];

    const symbolsParam = url.searchParams.get('symbols');
    if (symbolsParam) {
      symbols = symbolsParam.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
    } else {
      // Fetch user's watchlist to get symbols
      try {
        const { data: watchlist } = await supabaseAdmin
          .from('watchlists')
          .select('symbols')
          .eq('user_id', userId)
          .single();

        if (watchlist?.symbols) {
          symbols = watchlist.symbols;
        }
      } catch (e) {
        logger.warn('[SSE] Failed to fetch watchlist for price bridge', { error: e instanceof Error ? e.message : String(e) });
      }
    }

    // Register user with price bridge for real-time updates
    if (symbols.length > 0) {
      await priceBridge.registerUser(userId, symbols);
      logger.debug(`[SSE] User ${userId} registered for real-time prices: ${symbols.join(', ')}`);
    }

    // Create SSE stream
    const stream = new ReadableStream({
      start(controller) {
        // Register connection
        addConnection(userId, controller);

        // Send initial connection message
        const connectMessage = `event: connected\ndata: ${JSON.stringify({
          userId,
          timestamp: new Date().toISOString(),
          message: 'Connected to KCU Companion Mode',
          realtimeEnabled: symbols.length > 0,
          symbols: symbols,
        })}\n\n`;

        try {
          controller.enqueue(new TextEncoder().encode(connectMessage));
        } catch (e) {
          console.error('Error sending connect message:', e);
        }

        // Heartbeat every 30 seconds to keep connection alive
        const heartbeat = setInterval(() => {
          try {
            const heartbeatMessage = `event: heartbeat\ndata: ${JSON.stringify({
              timestamp: new Date().toISOString()
            })}\n\n`;
            controller.enqueue(new TextEncoder().encode(heartbeatMessage));
          } catch (e) {
            // Connection closed
            clearInterval(heartbeat);
            removeConnection(userId, controller);
            priceBridge.unregisterUser(userId);
          }
        }, 30000);

        // Handle connection close
        request.signal.addEventListener('abort', () => {
          clearInterval(heartbeat);
          removeConnection(userId, controller);
          priceBridge.unregisterUser(userId);
          try {
            controller.close();
          } catch (e) {
            // Already closed
          }
        });
      },
      cancel() {
        // Cleanup handled in abort listener
        priceBridge.unregisterUser(userId);
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no' // Disable nginx buffering
      }
    });
  } catch (error) {
    console.error('Error in stream GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST endpoint to update symbol subscriptions (when watchlist changes)
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { symbols } = await request.json();

    if (!Array.isArray(symbols)) {
      return NextResponse.json({ error: 'symbols must be an array' }, { status: 400 });
    }

    const normalizedSymbols = symbols.map((s: string) => s.trim().toUpperCase()).filter(Boolean);

    await priceBridge.updateUserSymbols(session.userId, normalizedSymbols);

    logger.debug(`[SSE] User ${session.userId} updated symbols: ${normalizedSymbols.join(', ')}`);

    return NextResponse.json({ success: true, symbols: normalizedSymbols });
  } catch (error) {
    console.error('Error updating stream symbols:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
