// Store active connections for SSE broadcasting
const connections = new Map<string, Set<ReadableStreamDefaultController>>();

// Helper to add connection
export function addConnection(userId: string, controller: ReadableStreamDefaultController) {
  if (!connections.has(userId)) {
    connections.set(userId, new Set());
  }
  connections.get(userId)!.add(controller);
}

// Helper to remove connection
export function removeConnection(userId: string, controller: ReadableStreamDefaultController) {
  const userConnections = connections.get(userId);
  if (userConnections) {
    userConnections.delete(controller);
    if (userConnections.size === 0) {
      connections.delete(userId);
    }
  }
}

// Helper to broadcast to a specific user
export function broadcastToUser(userId: string, event: string, data: unknown) {
  const userConnections = connections.get(userId);
  if (userConnections) {
    const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    userConnections.forEach((controller) => {
      try {
        controller.enqueue(new TextEncoder().encode(message));
      } catch {
        // Connection closed, ignore
      }
    });
  }
}

// Helper to broadcast to all connected users
export function broadcastToAll(event: string, data: unknown) {
  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  connections.forEach((userConnections) => {
    userConnections.forEach((controller) => {
      try {
        controller.enqueue(new TextEncoder().encode(message));
      } catch {
        // Connection closed, ignore
      }
    });
  });
}

// Get number of active connections
export function getConnectionCount(): number {
  let count = 0;
  connections.forEach((userConnections) => {
    count += userConnections.size;
  });
  return count;
}

// Check if user is connected
export function isUserConnected(userId: string): boolean {
  return connections.has(userId) && connections.get(userId)!.size > 0;
}
