/**
 * SSE Broadcast Utility for KCU Coach
 * Manages real-time connections for Companion Mode
 */

// In-memory connection storage
// In production, use Redis for multi-server support
const connections = new Map<string, Set<ReadableStreamDefaultController>>();

/**
 * Add a new SSE connection for a user
 */
export function addConnection(userId: string, controller: ReadableStreamDefaultController) {
  if (!connections.has(userId)) {
    connections.set(userId, new Set());
  }
  connections.get(userId)!.add(controller);
  console.log(`[SSE] User ${userId} connected. Total connections: ${getConnectionCount()}`);
}

/**
 * Remove an SSE connection for a user
 */
export function removeConnection(userId: string, controller: ReadableStreamDefaultController) {
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
export function broadcastToUser(userId: string, eventType: string, data: any) {
  const userConnections = connections.get(userId);
  if (!userConnections) return false;

  const message = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  const encodedMessage = new TextEncoder().encode(message);

  let sent = 0;
  const controllers = Array.from(userConnections);
  for (const controller of controllers) {
    try {
      controller.enqueue(encodedMessage);
      sent++;
    } catch (e) {
      // Connection closed, remove it
      userConnections.delete(controller);
    }
  }

  return sent > 0;
}

/**
 * Broadcast an event to all connected users
 */
export function broadcastToAll(eventType: string, data: any) {
  const message = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  const encodedMessage = new TextEncoder().encode(message);

  let totalSent = 0;
  const entries = Array.from(connections.entries());
  for (const [userId, userConnections] of entries) {
    const controllers = Array.from(userConnections);
    for (const controller of controllers) {
      try {
        controller.enqueue(encodedMessage);
        totalSent++;
      } catch (e) {
        // Connection closed, remove it
        userConnections.delete(controller);
      }
    }
  }

  console.log(`[SSE] Broadcast ${eventType} to ${totalSent} connections`);
  return totalSent;
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

// Event type definitions for type safety
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

// Helper functions for broadcasting specific event types
export function broadcastSetupForming(setup: SetupEvent) {
  return broadcastToAll('setup_forming', setup);
}

export function broadcastSetupReady(setup: SetupEvent) {
  return broadcastToAll('setup_ready', setup);
}

export function broadcastSetupTriggered(setup: SetupEvent) {
  return broadcastToAll('setup_triggered', setup);
}

export function broadcastAdminAlert(alert: AdminAlertEvent) {
  return broadcastToAll('admin_alert', alert);
}

export function broadcastPriceUpdate(userId: string, update: PriceUpdateEvent) {
  return broadcastToUser(userId, 'price_update', update);
}

export function broadcastLevelApproach(userId: string, approach: LevelApproachEvent) {
  return broadcastToUser(userId, 'level_approach', approach);
}
