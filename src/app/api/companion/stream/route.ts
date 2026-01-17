import { NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth';
import { addConnection, removeConnection } from '@/lib/broadcast';

// GET /api/companion/stream - SSE endpoint for real-time updates
export async function GET(request: Request) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let controllerRef: ReadableStreamDefaultController | null = null;

  const stream = new ReadableStream({
    start(controller) {
      controllerRef = controller;

      // Add this connection
      addConnection(userId, controller);

      // Send initial connection message
      const connectMessage = `event: connected\ndata: ${JSON.stringify({
        userId,
        timestamp: new Date().toISOString()
      })}\n\n`;
      controller.enqueue(new TextEncoder().encode(connectMessage));

      // Send heartbeat every 30 seconds to keep connection alive
      const heartbeatInterval = setInterval(() => {
        try {
          const heartbeat = `event: heartbeat\ndata: ${JSON.stringify({
            timestamp: new Date().toISOString()
          })}\n\n`;
          controller.enqueue(new TextEncoder().encode(heartbeat));
        } catch {
          clearInterval(heartbeatInterval);
        }
      }, 30000);

      // Cleanup on close
      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeatInterval);
        if (controllerRef) {
          removeConnection(userId, controllerRef);
        }
      });
    },
    cancel() {
      if (controllerRef) {
        removeConnection(userId, controllerRef);
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
