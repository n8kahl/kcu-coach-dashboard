import { getAuthenticatedUserId } from '@/lib/auth';
import { createSSEResponse } from '@/lib/broadcast';

/**
 * GET /api/setups/stream
 * SSE stream for real-time setup updates
 */
export async function GET() {
  try {
    const userId = await getAuthenticatedUserId();

    if (!userId) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Create SSE response
    return createSSEResponse(userId, () => {
      console.log(`[Setups Stream] User ${userId} disconnected`);
    });
  } catch (error) {
    console.error('[Setups Stream] Error:', error);
    return new Response('Internal server error', { status: 500 });
  }
}

// Disable body parsing for SSE
export const dynamic = 'force-dynamic';
