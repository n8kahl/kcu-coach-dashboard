/**
 * SSE Broadcast Utility for KCU Coach
 * Manages real-time connections for Companion Mode
 *
 * Uses Redis pub/sub when available for multi-server support,
 * falls back to in-memory for single-server deployments.
 */

import { publish, subscribe, isRedisAvailable, getRedisSubscriber } from './redis';

// In-memory connection storage
const connections = new Map<string, Set<ReadableStreamDefaultController>>();

// Redis availability flag
let useRedis = false;
let redisInitialized = false;

/**
 * Broadcast mode enum for honest client status reporting
 */
export type BroadcastMode = 'redis' | 'memory' | 'unknown';

/**
 * Get current broadcast mode information.
 * Used to provide honest status to clients about real-time capabilities.
 */
export function getBroadcastMode(): { mode: BroadcastMode; initialized: boolean } {
  if (!redisInitialized) {
    return { mode: 'unknown', initialized: false };
  }
  return {
    mode: useRedis ? 'redis' : 'memory',
    initialized: true,
  };
}

/**
 * Initialize Redis pub/sub if available
 */
async function initializeRedis(): Promise<void> {
  if (redisInitialized) return;

  useRedis = await isRedisAvailable();

  if (useRedis) {
    console.log('[SSE] Using Redis pub/sub for multi-server support');

    // Subscribe to broadcast channel
    await subscribe('sse:broadcast', (_channel, message) => {
      try {
        const { eventType, data, targetUserId } = JSON.parse(message);

        if (targetUserId) {
          // Targeted broadcast
          deliverToUser(targetUserId, eventType, data);
        } else {
          // Broadcast to all
          deliverToAll(eventType, data);
        }
      } catch (error) {
        console.error('[SSE] Error processing Redis message:', error);
      }
    });
  } else {
    console.log('[SSE] Using in-memory broadcast (single server)');
  }

  redisInitialized = true;
}

// Initialize on module load
initializeRedis().catch(console.error);

/**
 * Deliver message to a specific user's connections (local)
 */
function deliverToUser(userId: string, eventType: string, data: unknown): number {
  const userConnections = connections.get(userId);
  if (!userConnections) return 0;

  const message = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  const encodedMessage = new TextEncoder().encode(message);

  let sent = 0;
  const controllers = Array.from(userConnections);
  for (const controller of controllers) {
    try {
      controller.enqueue(encodedMessage);
      sent++;
    } catch {
      // Connection closed, remove it
      userConnections.delete(controller);
    }
  }

  return sent;
}

/**
 * Deliver message to all local connections
 */
function deliverToAll(eventType: string, data: unknown): number {
  const message = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  const encodedMessage = new TextEncoder().encode(message);

  let totalSent = 0;
  const entries = Array.from(connections.entries());
  for (const [, userConnections] of entries) {
    const controllers = Array.from(userConnections);
    for (const controller of controllers) {
      try {
        controller.enqueue(encodedMessage);
        totalSent++;
      } catch {
        // Connection closed, remove it
        userConnections.delete(controller);
      }
    }
  }

  return totalSent;
}

/**
 * Add a new SSE connection for a user
 */
export function addConnection(userId: string, controller: ReadableStreamDefaultController): void {
  if (!connections.has(userId)) {
    connections.set(userId, new Set());
  }
  connections.get(userId)!.add(controller);
  console.log(`[SSE] User ${userId} connected. Total connections: ${getConnectionCount()}`);
}

/**
 * Remove an SSE connection for a user
 */
export function removeConnection(userId: string, controller: ReadableStreamDefaultController): void {
  const userConnections = connections.get(userId);
  if (userConnections) {
    userConnections.delete(controller);
    if (userConnections.size === 0) {
      connections.delete(userId);
    }
    console.log(`[SSE] User ${userId} disconnected. Total connections: ${getConnectionCount()}`);
  }
}

/**
 * Broadcast an event to a specific user
 */
export async function broadcastToUser(userId: string, eventType: string, data: unknown): Promise<boolean> {
  if (useRedis) {
    // Publish to Redis for all servers
    return publish('sse:broadcast', { eventType, data, targetUserId: userId });
  } else {
    // Local delivery only
    return deliverToUser(userId, eventType, data) > 0;
  }
}

/**
 * Broadcast an event to all connected users
 */
export async function broadcastToAll(eventType: string, data: unknown): Promise<number> {
  if (useRedis) {
    // Publish to Redis for all servers
    await publish('sse:broadcast', { eventType, data, targetUserId: null });
    // Also deliver locally
    const sent = deliverToAll(eventType, data);
    console.log(`[SSE] Broadcast ${eventType} via Redis, ${sent} local connections`);
    return sent;
  } else {
    // Local delivery only
    const sent = deliverToAll(eventType, data);
    console.log(`[SSE] Broadcast ${eventType} to ${sent} connections`);
    return sent;
  }
}

/**
 * Get total number of active connections
 */
export function getConnectionCount(): number {
  let total = 0;
  const allConnections = Array.from(connections.values());
  for (const userConnections of allConnections) {
    total += userConnections.size;
  }
  return total;
}

/**
 * Check if a user is connected
 */
export function isUserConnected(userId: string): boolean {
  return connections.has(userId) && connections.get(userId)!.size > 0;
}

/**
 * Get all connected user IDs
 */
export function getConnectedUsers(): string[] {
  return Array.from(connections.keys());
}

// ============================================
// Event Type Definitions
// ============================================

export interface SetupEvent {
  id: string;
  symbol: string;
  direction: 'bullish' | 'bearish';
  confluenceScore: number;
  levelScore: number;
  trendScore: number;
  patienceScore: number;
  mtfScore: number;
  coachNote: string;
  suggestedEntry?: number;
  suggestedStop?: number;
  target1?: number;
  target2?: number;
  target3?: number;
  riskReward?: number;
}

export interface AdminAlertEvent {
  id: string;
  alertType: 'loading' | 'entering' | 'adding' | 'take_profit' | 'exiting' | 'stopped_out' | 'update';
  symbol: string;
  direction: 'long' | 'short';
  entryPrice?: number;
  stopLoss?: number;
  targets?: number[];
  message?: string;
  admin: {
    username: string;
    avatar?: string;
  };
}

export interface PriceUpdateEvent {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  vwap?: number;
}

export interface LevelApproachEvent {
  symbol: string;
  levelType: string;
  levelPrice: number;
  currentPrice: number;
  distancePercent: number;
}

export interface CoachingUpdateEvent {
  symbol: string;
  eventType: 'level_approach' | 'level_cross' | 'vwap_cross' | 'gamma_flip' |
             'r_milestone' | 'patience_forming' | 'patience_break';
  priority: 'critical' | 'high' | 'medium' | 'low';
  message: {
    type: 'guidance' | 'warning' | 'opportunity';
    content: string;
    emoji?: string;
  };
  context: {
    currentPrice: number;
    relevantLevel?: number;
    direction?: 'bullish' | 'bearish';
  };
  timestamp: string;
}

export interface CompanionMessageEvent {
  sessionId: string;
  messageType: 'info' | 'warning' | 'action' | 'milestone' | 'risk' | 'education';
  message: string;
  triggerType?: string;
  priceAtMessage?: number;
  pnlPercent?: number;
}

// ============================================
// Helper Functions for Specific Event Types
// ============================================

export function broadcastSetupForming(setup: SetupEvent): Promise<number> {
  return broadcastToAll('setup_forming', setup);
}

export function broadcastSetupReady(setup: SetupEvent): Promise<number> {
  return broadcastToAll('setup_ready', setup);
}

export function broadcastSetupTriggered(setup: SetupEvent): Promise<number> {
  return broadcastToAll('setup_triggered', setup);
}

export function broadcastAdminAlert(alert: AdminAlertEvent): Promise<number> {
  return broadcastToAll('admin_alert', alert);
}

export function broadcastPriceUpdate(userId: string, update: PriceUpdateEvent): Promise<boolean> {
  return broadcastToUser(userId, 'price_update', update);
}

export function broadcastLevelApproach(userId: string, approach: LevelApproachEvent): Promise<boolean> {
  return broadcastToUser(userId, 'level_approach', approach);
}

export function broadcastCoachingUpdate(userId: string, event: CoachingUpdateEvent): Promise<boolean> {
  return broadcastToUser(userId, 'coaching_update', event);
}

export function broadcastCompanionMessage(userId: string, message: CompanionMessageEvent): Promise<boolean> {
  return broadcastToUser(userId, 'companion_message', message);
}

// ============================================
// SSE Stream Response Helper
// ============================================

/**
 * Create an SSE response with proper headers and cleanup
 */
export function createSSEResponse(
  userId: string,
  onCancel?: () => void
): Response {
  let controller: ReadableStreamDefaultController;

  const stream = new ReadableStream({
    start(ctrl) {
      controller = ctrl;
      addConnection(userId, controller);

      // Send initial connection event
      const welcome = `event: connected\ndata: ${JSON.stringify({ userId, timestamp: Date.now() })}\n\n`;
      controller.enqueue(new TextEncoder().encode(welcome));
    },
    cancel() {
      removeConnection(userId, controller);
      onCancel?.();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}
