import { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth';

// Massive.com WebSocket message types
interface MassiveMessage {
  ev?: string;
  status?: string;
  message?: string;
  sym?: string;
  p?: number;
  s?: number;
  t?: number;
  v?: number;
  vw?: number;
  o?: number;
  h?: number;
  l?: number;
  c?: number;
}

// Normalized message format we send to clients
interface StreamMessage {
  type: 'connected' | 'subscribed' | 'quote' | 'trade' | 'bar' | 'error' | 'heartbeat';
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

// Connection manager for shared WebSocket
class MassiveWebSocketManager {
  private static instance: MassiveWebSocketManager | null = null;
  private ws: WebSocket | null = null;
  private subscribers: Map<string, Set<(msg: StreamMessage) => void>> = new Map();
  private globalListeners: Set<(msg: StreamMessage) => void> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private isConnecting = false;
  private subscribedSymbols: Set<string> = new Set();

  static getInstance(): MassiveWebSocketManager {
    if (!MassiveWebSocketManager.instance) {
      MassiveWebSocketManager.instance = new MassiveWebSocketManager();
    }
    return MassiveWebSocketManager.instance;
  }

  private async connect(): Promise<void> {
    if (this.isConnecting || this.ws?.readyState === WebSocket.OPEN) return;

    const apiKey = process.env.MASSIVE_API_KEY;
    if (!apiKey) {
      this.notifyAll({ type: 'error', message: 'Market data not configured' });
      return;
    }

    this.isConnecting = true;
    const wsUrl = process.env.MASSIVE_WS_URL || 'wss://socket.massive.com/stocks';

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('[MarketStream] Connected to Massive.com');
        this.isConnecting = false;
        this.reconnectAttempts = 0;

        // Authenticate
        this.ws?.send(JSON.stringify({ action: 'auth', params: apiKey }));
      };

      this.ws.onmessage = (event) => {
        try {
          const messages: MassiveMessage[] = JSON.parse(event.data);

          for (const msg of messages) {
            this.handleMessage(msg);
          }
        } catch (err) {
          console.error('[MarketStream] Parse error:', err);
        }
      };

      this.ws.onerror = (error) => {
        console.error('[MarketStream] WebSocket error:', error);
        this.isConnecting = false;
      };

      this.ws.onclose = () => {
        console.log('[MarketStream] Disconnected');
        this.isConnecting = false;
        this.ws = null;
        this.scheduleReconnect();
      };
    } catch (error) {
      console.error('[MarketStream] Connection failed:', error);
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  private handleMessage(msg: MassiveMessage): void {
    // Authentication status
    if (msg.ev === 'status') {
      if (msg.status === 'auth_success') {
        console.log('[MarketStream] Authenticated');
        this.notifyAll({ type: 'connected' });

        // Resubscribe to existing symbols
        if (this.subscribedSymbols.size > 0) {
          this.sendSubscribe(Array.from(this.subscribedSymbols));
        }
      } else if (msg.status === 'error') {
        this.notifyAll({ type: 'error', message: msg.message });
      }
      return;
    }

    // Trade data
    if (msg.ev === 'T' && msg.sym) {
      const streamMsg: StreamMessage = {
        type: 'trade',
        symbol: msg.sym,
        data: {
          price: msg.p,
          size: msg.s,
          timestamp: msg.t,
        },
      };
      this.notifySymbol(msg.sym, streamMsg);
      return;
    }

    // Quote data
    if (msg.ev === 'Q' && msg.sym) {
      const streamMsg: StreamMessage = {
        type: 'quote',
        symbol: msg.sym,
        data: {
          price: msg.p,
          size: msg.s,
          timestamp: msg.t,
        },
      };
      this.notifySymbol(msg.sym, streamMsg);
      return;
    }

    // Aggregate (bar) data
    if ((msg.ev === 'A' || msg.ev === 'AM') && msg.sym) {
      const streamMsg: StreamMessage = {
        type: 'bar',
        symbol: msg.sym,
        data: {
          open: msg.o,
          high: msg.h,
          low: msg.l,
          close: msg.c,
          volume: msg.v,
          vwap: msg.vw,
          timestamp: msg.t,
        },
      };
      this.notifySymbol(msg.sym, streamMsg);
    }
  }

  private notifySymbol(symbol: string, msg: StreamMessage): void {
    const listeners = this.subscribers.get(symbol);
    if (listeners) {
      Array.from(listeners).forEach(listener => listener(msg));
    }
    // Also notify global listeners
    Array.from(this.globalListeners).forEach(listener => listener(msg));
  }

  private notifyAll(msg: StreamMessage): void {
    Array.from(this.globalListeners).forEach(listener => listener(msg));
    Array.from(this.subscribers.values()).forEach(listeners => {
      Array.from(listeners).forEach(listener => listener(msg));
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('[MarketStream] Max reconnect attempts reached');
      this.notifyAll({ type: 'error', message: 'Connection lost' });
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;

    console.log(`[MarketStream] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delay);
  }

  private sendSubscribe(symbols: string[]): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      // Subscribe to trades and aggregates
      this.ws.send(JSON.stringify({ action: 'subscribe', params: symbols.map(s => `T.${s}`).join(',') }));
      this.ws.send(JSON.stringify({ action: 'subscribe', params: symbols.map(s => `AM.${s}`).join(',') }));
    }
  }

  subscribe(symbols: string[], listener: (msg: StreamMessage) => void): () => void {
    // Ensure connection
    this.connect();

    // Add listener to each symbol
    for (const symbol of symbols) {
      if (!this.subscribers.has(symbol)) {
        this.subscribers.set(symbol, new Set());
      }
      this.subscribers.get(symbol)!.add(listener);

      // Track and subscribe to new symbols
      if (!this.subscribedSymbols.has(symbol)) {
        this.subscribedSymbols.add(symbol);
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.sendSubscribe([symbol]);
        }
      }
    }

    // Add as global listener for connection events
    this.globalListeners.add(listener);

    // Return unsubscribe function
    return () => {
      for (const symbol of symbols) {
        this.subscribers.get(symbol)?.delete(listener);
      }
      this.globalListeners.delete(listener);
    };
  }

  getConnectionState(): 'connected' | 'connecting' | 'disconnected' {
    if (this.ws?.readyState === WebSocket.OPEN) return 'connected';
    if (this.isConnecting || this.ws?.readyState === WebSocket.CONNECTING) return 'connecting';
    return 'disconnected';
  }
}

// SSE endpoint for clients
export async function GET(request: NextRequest) {
  // Verify authentication
  const session = await getSession();
  if (!session?.userId) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Get symbols from query
  const { searchParams } = new URL(request.url);
  const symbolsParam = searchParams.get('symbols');
  const symbols = symbolsParam ? symbolsParam.split(',').map(s => s.trim().toUpperCase()) : ['SPY', 'QQQ'];

  // Set up SSE stream
  const encoder = new TextEncoder();
  let isActive = true;

  const stream = new ReadableStream({
    start(controller) {
      const manager = MassiveWebSocketManager.getInstance();

      // Send initial connection state
      const initialState = manager.getConnectionState();
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: initialState === 'connected' ? 'connected' : 'connecting' })}\n\n`)
      );

      // Subscribe to updates
      const unsubscribe = manager.subscribe(symbols, (msg) => {
        if (!isActive) return;

        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(msg)}\n\n`));
        } catch {
          // Stream closed
          isActive = false;
        }
      });

      // Send confirmation of subscription
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: 'subscribed', symbols })}\n\n`)
      );

      // Heartbeat to keep connection alive
      const heartbeatInterval = setInterval(() => {
        if (!isActive) {
          clearInterval(heartbeatInterval);
          return;
        }
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'heartbeat' })}\n\n`));
        } catch {
          isActive = false;
          clearInterval(heartbeatInterval);
        }
      }, 30000);

      // Clean up on close
      request.signal.addEventListener('abort', () => {
        isActive = false;
        clearInterval(heartbeatInterval);
        unsubscribe();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
