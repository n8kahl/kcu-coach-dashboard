/**
 * Admin Content - Cloudflare Stream Upload Token
 *
 * Generates a "Direct Creator Upload" URL for uploading videos
 * directly from the browser to Cloudflare Stream.
 *
 * Centralized under /api/admin/content/video/ for content management.
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import logger from '@/lib/logger';

interface DirectUploadResponse {
  result: {
    uploadURL: string;
    uid: string;
  };
  success: boolean;
  errors: Array<{ code: number; message: string }>;
  messages: string[];
}

/**
 * POST /api/admin/content/video/upload-token
 *
 * Request body:
 * {
 *   maxDurationSeconds?: number;  // Max video duration (default: 3600 = 1 hour)
 *   meta?: { name: string; ... }; // Metadata to attach to the video
 *   requireSignedURLs?: boolean;  // Whether to require signed URLs for playback
 * }
 *
 * Returns:
 * {
 *   uploadURL: string;  // One-time upload URL for direct browser upload
 *   uid: string;        // The video UID to store in the database
 * }
 */
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!session.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const apiToken = process.env.CLOUDFLARE_API_TOKEN;

    if (!accountId || !apiToken) {
      logger.warn('Cloudflare Stream credentials not configured', {
        hasAccountId: !!accountId,
        hasApiToken: !!apiToken,
      });
      return NextResponse.json(
        {
          error: 'Cloudflare Stream not configured',
          details: 'Missing CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN environment variables',
        },
        { status: 503 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const {
      maxDurationSeconds = 3600,
      meta = {},
      requireSignedURLs = false,
      allowedOrigins,
    } = body;

    // Request a direct creator upload URL from Cloudflare
    const cfResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/direct_upload`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          maxDurationSeconds,
          requireSignedURLs,
          allowedOrigins: allowedOrigins || [
            process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
          ],
          meta: {
            ...meta,
            uploadedBy: session.userId,
            uploadedAt: new Date().toISOString(),
          },
        }),
      }
    );

    const cfData: DirectUploadResponse = await cfResponse.json();

    if (!cfData.success || !cfData.result?.uploadURL) {
      logger.error('Cloudflare upload token request failed', {
        errors: cfData.errors,
        messages: cfData.messages,
      });
      return NextResponse.json(
        {
          error: 'Failed to get upload URL',
          details: cfData.errors?.[0]?.message || 'Unknown error',
        },
        { status: 502 }
      );
    }

    logger.info('Generated Cloudflare upload token', {
      uid: cfData.result.uid,
      adminId: session.userId,
      meta: meta.name,
    });

    return NextResponse.json({
      uploadURL: cfData.result.uploadURL,
      uid: cfData.result.uid,
    });
  } catch (error) {
    logger.error(
      'Error generating upload token',
      error instanceof Error ? error : { message: String(error) }
    );
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
