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

    // Build allowed origins list - must include all origins that might upload
    // IMPORTANT: Cloudflare requires origins WITHOUT protocol (e.g., "localhost:3000" not "http://localhost:3000")
    const rawOrigins = allowedOrigins || [
      process.env.NEXT_PUBLIC_APP_URL,
      'http://localhost:3000',
    ].filter(Boolean) as string[];

    // Strip protocol from origins (Cloudflare requirement)
    const origins = rawOrigins.map((origin: string) => {
      try {
        const url = new URL(origin);
        return url.host; // Returns "localhost:3000" or "example.com"
      } catch {
        return origin; // If not a valid URL, use as-is
      }
    });

    const requestBody = {
      maxDurationSeconds,
      requireSignedURLs,
      allowedOrigins: origins,
      meta: {
        ...meta,
        uploadedBy: session.userId,
        uploadedAt: new Date().toISOString(),
      },
    };

    logger.info('Requesting Cloudflare upload token', {
      maxDurationSeconds,
      allowedOrigins: origins,
      metaKeys: Object.keys(meta),
    });

    // Request a direct creator upload URL from Cloudflare
    const cfResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/direct_upload`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      }
    );

    const cfData: DirectUploadResponse = await cfResponse.json();

    if (!cfResponse.ok || !cfData.success || !cfData.result?.uploadURL) {
      logger.error('Cloudflare upload token request failed', {
        status: cfResponse.status,
        statusText: cfResponse.statusText,
        errors: cfData.errors,
        messages: cfData.messages,
        success: cfData.success,
      });
      return NextResponse.json(
        {
          error: 'Failed to get upload URL',
          details: cfData.errors?.[0]?.message || cfData.messages?.[0] || `Cloudflare returned ${cfResponse.status}`,
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
