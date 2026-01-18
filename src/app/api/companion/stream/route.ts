import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { addConnection, removeConnection } from '@/lib/broadcast';

// SSE endpoint for real-time updates
export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.userId;

    // Create SSE stream
    const stream = new ReadableStream({
      start(controller) {
        // Register connection
        addConnection(userId, controller);

        // Send initial connection message
        const connectMessage = `event: connected\ndata: ${JSON.stringify({
          userId,
          timestamp: new Date().toISOString(),
          message: 'Connected to KCU Companion Mode'
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
          }
        }, 30000);

        // Handle connection close
        request.signal.addEventListener('abort', () => {
          clearInterval(heartbeat);
          removeConnection(userId, controller);
          try {
            controller.close();
          } catch (e) {
            // Already closed
          }
        });
      },
      cancel() {
        // Cleanup handled in abort listener
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
