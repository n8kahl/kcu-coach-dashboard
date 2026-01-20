#!/usr/bin/env tsx
/**
 * Market Data Ingestion Worker
 *
 * A standalone Node.js process that maintains a single WebSocket connection to
 * Massive.com and redistributes market data via Redis Pub/Sub.
 *
 * This implements the "Single Ingestion, Infinite Distribution" pattern:
 * - One worker per deployment ingests all market data
 * - Data is published to Redis for horizontal scaling
 * - Multiple API instances can subscribe without redundant upstream connections
 *
 * Usage:
 *   tsx scripts/market-worker.ts
 *   MARKET_WATCHLIST=SPY,QQQ,AAPL tsx scripts/market-worker.ts
 *   DEBUG=1 tsx scripts/market-worker.ts
 *
 * Environment variables:
 *   MASSIVE_API_KEY    - Required: Massive.com API key
 *   MASSIVE_WS_URL     - Optional: WebSocket URL (default: wss://socket.massive.com/stocks)
 *   REDIS_URL          - Required: Redis connection URL
 *   MARKET_WATCHLIST   - Optional: Comma-separated list of symbols (default: SPY,QQQ,NVDA,AAPL,TSLA,AMD,META,GOOGL,AMZN,MSFT)
 *   DEBUG              - Optional: Enable verbose logging (set to 1)
 */

import * as dotenv from 'dotenv';
import * as WebSocket from 'ws';

// Load environment variables
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

import { MarketRedistributor, StreamMessage } from '../src/lib/market-redistributor';

// Configuration
const CONFIG = {
  // WebSocket settings
  wsUrl: process.env.MASSIVE_WS_URL || 'wss://socket.massive.com/stocks',
  apiKey: process.env.MASSIVE_API_KEY || '',

  // Watchlist
  watchlist: (process.env.MARKET_WATCHLIST || 'SPY,QQQ,NVDA,AAPL,TSLA,AMD,META,GOOGL,AMZN,MSFT')
    .split(',')
    .map(s => s.trim().toUpperCase())
    .filter(s => s.length > 0),

  // Reconnection settings
  maxReconnectAttempts: 20,
  baseReconnectDelay: 1000, // 1 second
  maxReconnectDelay: 60000, // 60 seconds

  // Health check interval
  healthCheckIntervalMs: 60000, // 1 minute

  // Debug mode
  debug: process.env.DEBUG === '1' || process.env.DEBUG === 'true',
};

// Massive.com message types
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

// Worker state
interface WorkerState {
  ws: WebSocket | null;
  redistributor: MarketRedistributor;
  isConnected: boolean;
  isAuthenticated: boolean;
  reconnectAttempts: number;
  reconnectTimeout: NodeJS.Timeout | null;
  healthCheckInterval: NodeJS.Timeout | null;
  startTime: number;
  messageCount: number;
  lastMessageTime: number;
  subscribedSymbols: Set<string>;
}

const state: WorkerState = {
  ws: null,
  redistributor: new MarketRedistributor(),
  isConnected: false,
  isAuthenticated: false,
  reconnectAttempts: 0,
  reconnectTimeout: null,
  healthCheckInterval: null,
  startTime: Date.now(),
  messageCount: 0,
  lastMessageTime: 0,
  subscribedSymbols: new Set(),
};

// Logging utilities
function log(level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', message: string, data?: unknown): void {
  if (level === 'DEBUG' && !CONFIG.debug) return;

  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [MarketWorker] [${level}]`;

  if (data) {
    console.log(`${prefix} ${message}`, data);
  } else {
    console.log(`${prefix} ${message}`);
  }
}

function logInfo(message: string, data?: unknown): void {
  log('INFO', message, data);
}

function logWarn(message: string, data?: unknown): void {
  log('WARN', message, data);
}

function logError(message: string, data?: unknown): void {
  log('ERROR', message, data);
}

function logDebug(message: string, data?: unknown): void {
  log('DEBUG', message, data);
}

/**
 * Validate environment configuration
 */
function validateConfig(): boolean {
  const errors: string[] = [];

  if (!CONFIG.apiKey) {
    errors.push('MASSIVE_API_KEY is required');
  }

  if (!process.env.REDIS_URL) {
    errors.push('REDIS_URL is required');
  }

  if (CONFIG.watchlist.length === 0) {
    errors.push('MARKET_WATCHLIST is empty');
  }

  if (errors.length > 0) {
    logError('Configuration validation failed:');
    errors.forEach(e => logError(`  - ${e}`));
    return false;
  }

  logInfo('Configuration validated successfully');
  logInfo(`Watchlist: ${CONFIG.watchlist.join(', ')}`);
  return true;
}

/**
 * Connect to Massive.com WebSocket
 */
function connect(): void {
  if (state.ws && state.ws.readyState === WebSocket.OPEN) {
    logWarn('Already connected, ignoring connect request');
    return;
  }

  logInfo(`Connecting to ${CONFIG.wsUrl}...`);

  try {
    state.ws = new WebSocket(CONFIG.wsUrl);

    state.ws.on('open', handleOpen);
    state.ws.on('message', handleMessage);
    state.ws.on('error', handleError);
    state.ws.on('close', handleClose);
  } catch (error) {
    logError('Failed to create WebSocket connection:', error);
    scheduleReconnect();
  }
}

/**
 * Handle WebSocket open event
 */
function handleOpen(): void {
  logInfo('WebSocket connected');
  state.isConnected = true;
  state.reconnectAttempts = 0;

  // Clear any pending reconnect
  if (state.reconnectTimeout) {
    clearTimeout(state.reconnectTimeout);
    state.reconnectTimeout = null;
  }

  // Authenticate
  authenticate();
}

/**
 * Send authentication to Massive.com
 */
function authenticate(): void {
  if (!state.ws || state.ws.readyState !== WebSocket.OPEN) {
    logWarn('Cannot authenticate - not connected');
    return;
  }

  logInfo('Authenticating with Massive.com...');
  state.ws.send(JSON.stringify({ action: 'auth', params: CONFIG.apiKey }));
}

/**
 * Subscribe to symbols after authentication
 */
function subscribeToSymbols(): void {
  if (!state.ws || state.ws.readyState !== WebSocket.OPEN || !state.isAuthenticated) {
    logWarn('Cannot subscribe - not ready');
    return;
  }

  const symbols = CONFIG.watchlist;

  // Subscribe to trades (T) and aggregates (AM - minute bars)
  const tradeParams = symbols.map(s => `T.${s}`).join(',');
  const aggParams = symbols.map(s => `AM.${s}`).join(',');

  logInfo(`Subscribing to ${symbols.length} symbols...`);

  state.ws.send(JSON.stringify({ action: 'subscribe', params: tradeParams }));
  state.ws.send(JSON.stringify({ action: 'subscribe', params: aggParams }));

  symbols.forEach(s => state.subscribedSymbols.add(s));

  logInfo('Subscription requests sent');
}

/**
 * Handle incoming WebSocket message
 */
function handleMessage(data: WebSocket.Data): void {
  try {
    const messages: MassiveMessage[] = JSON.parse(data.toString());

    for (const msg of messages) {
      processMessage(msg);
    }
  } catch (error) {
    logError('Failed to parse message:', error);
    logDebug('Raw message:', data.toString());
  }
}

/**
 * Process a single message from Massive.com
 */
function processMessage(msg: MassiveMessage): void {
  // Handle status/auth messages
  if (msg.ev === 'status') {
    if (msg.status === 'auth_success') {
      logInfo('Authentication successful');
      state.isAuthenticated = true;
      subscribeToSymbols();
    } else if (msg.status === 'auth_failed') {
      logError('Authentication failed:', msg.message);
      state.isAuthenticated = false;
    } else if (msg.status === 'error') {
      logError('Server error:', msg.message);
    } else if (msg.status === 'connected') {
      logInfo('Connected status received');
    } else {
      logDebug('Status message:', msg);
    }
    return;
  }

  // Handle trade data (T)
  if (msg.ev === 'T' && msg.sym) {
    state.messageCount++;
    state.lastMessageTime = Date.now();

    const streamMsg: StreamMessage = {
      type: 'trade',
      symbol: msg.sym,
      data: {
        price: msg.p,
        size: msg.s,
        timestamp: msg.t,
      },
    };

    publishUpdate(msg.sym, streamMsg);
    return;
  }

  // Handle quote data (Q)
  if (msg.ev === 'Q' && msg.sym) {
    state.messageCount++;
    state.lastMessageTime = Date.now();

    const streamMsg: StreamMessage = {
      type: 'quote',
      symbol: msg.sym,
      data: {
        price: msg.p,
        size: msg.s,
        timestamp: msg.t,
      },
    };

    publishUpdate(msg.sym, streamMsg);
    return;
  }

  // Handle aggregate/bar data (A or AM)
  if ((msg.ev === 'A' || msg.ev === 'AM') && msg.sym) {
    state.messageCount++;
    state.lastMessageTime = Date.now();

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

    publishUpdate(msg.sym, streamMsg);
    return;
  }

  // Log unknown message types in debug mode
  logDebug('Unknown message type:', msg);
}

/**
 * Publish update to Redis via MarketRedistributor
 */
async function publishUpdate(symbol: string, message: StreamMessage): Promise<void> {
  try {
    const success = await state.redistributor.publishUpdate(symbol, message);

    if (!success) {
      logWarn(`Failed to publish update for ${symbol}`);
    } else {
      logDebug(`Published ${message.type} for ${symbol}`, message.data);
    }
  } catch (error) {
    logError(`Error publishing update for ${symbol}:`, error);
  }
}

/**
 * Handle WebSocket error
 */
function handleError(error: Error): void {
  logError('WebSocket error:', error.message);
}

/**
 * Handle WebSocket close
 */
function handleClose(code: number, reason: Buffer): void {
  logWarn(`WebSocket closed: code=${code}, reason=${reason.toString() || 'unknown'}`);
  state.isConnected = false;
  state.isAuthenticated = false;
  state.ws = null;

  scheduleReconnect();
}

/**
 * Schedule reconnection with exponential backoff
 */
function scheduleReconnect(): void {
  if (state.reconnectTimeout) {
    return; // Already scheduled
  }

  if (state.reconnectAttempts >= CONFIG.maxReconnectAttempts) {
    logError(`Max reconnect attempts (${CONFIG.maxReconnectAttempts}) reached. Exiting...`);
    shutdown(1);
    return;
  }

  // Calculate delay with exponential backoff
  const delay = Math.min(
    CONFIG.baseReconnectDelay * Math.pow(2, state.reconnectAttempts),
    CONFIG.maxReconnectDelay
  );

  state.reconnectAttempts++;

  logInfo(`Reconnecting in ${delay}ms (attempt ${state.reconnectAttempts}/${CONFIG.maxReconnectAttempts})...`);

  state.reconnectTimeout = setTimeout(() => {
    state.reconnectTimeout = null;
    connect();
  }, delay);
}

/**
 * Health check - logs worker status every minute
 */
function healthCheck(): void {
  const uptime = Math.floor((Date.now() - state.startTime) / 1000);
  const uptimeStr = formatUptime(uptime);
  const timeSinceLastMessage = state.lastMessageTime > 0
    ? `${Math.floor((Date.now() - state.lastMessageTime) / 1000)}s ago`
    : 'never';

  const status = {
    uptime: uptimeStr,
    connected: state.isConnected,
    authenticated: state.isAuthenticated,
    subscribedSymbols: state.subscribedSymbols.size,
    totalMessages: state.messageCount,
    lastMessage: timeSinceLastMessage,
    reconnectAttempts: state.reconnectAttempts,
  };

  logInfo('Health check:', status);

  // Warning if no messages received recently when connected
  if (state.isConnected && state.isAuthenticated && state.lastMessageTime > 0) {
    const silenceThreshold = 300000; // 5 minutes
    if (Date.now() - state.lastMessageTime > silenceThreshold) {
      logWarn(`No messages received in ${Math.floor((Date.now() - state.lastMessageTime) / 1000)}s - market may be closed or connection stale`);
    }
  }
}

/**
 * Format uptime as human-readable string
 */
function formatUptime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
}

/**
 * Start the worker
 */
function start(): void {
  logInfo('='.repeat(60));
  logInfo('Market Data Ingestion Worker Starting');
  logInfo('='.repeat(60));

  if (!validateConfig()) {
    logError('Configuration validation failed. Exiting...');
    process.exit(1);
  }

  // Start health check interval
  state.healthCheckInterval = setInterval(healthCheck, CONFIG.healthCheckIntervalMs);

  // Connect to WebSocket
  connect();

  logInfo('Worker started successfully');
}

/**
 * Graceful shutdown
 */
async function shutdown(exitCode = 0): Promise<void> {
  logInfo('Shutting down...');

  // Clear intervals
  if (state.healthCheckInterval) {
    clearInterval(state.healthCheckInterval);
    state.healthCheckInterval = null;
  }

  if (state.reconnectTimeout) {
    clearTimeout(state.reconnectTimeout);
    state.reconnectTimeout = null;
  }

  // Close WebSocket
  if (state.ws) {
    try {
      state.ws.close(1000, 'Shutdown');
    } catch {
      // Ignore close errors
    }
    state.ws = null;
  }

  // Close redistributor
  try {
    await state.redistributor.close();
  } catch (error) {
    logError('Error closing redistributor:', error);
  }

  logInfo('Shutdown complete');
  process.exit(exitCode);
}

// Handle process signals
process.on('SIGINT', () => {
  logInfo('Received SIGINT');
  shutdown(0);
});

process.on('SIGTERM', () => {
  logInfo('Received SIGTERM');
  shutdown(0);
});

process.on('uncaughtException', (error) => {
  logError('Uncaught exception:', error);
  shutdown(1);
});

process.on('unhandledRejection', (reason) => {
  logError('Unhandled rejection:', reason);
  shutdown(1);
});

// Start the worker
start();
