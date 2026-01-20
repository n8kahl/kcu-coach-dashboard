import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { adminGuard } from '@/lib/admin-guard';

// ============================================
// Cloudflare Stream Video Status API
// ============================================

const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;

interface CloudflareVideoResponse {
  success: boolean;
  errors: Array<{ message: string }>;
  result?: {
    uid: string;
    thumbnail: string;
    thumbnailTimestampPct: number;
    readyToStream: boolean;
    readyToStreamAt: string | null;
    status: {
      state: 'pendingupload' | 'downloading' | 'queued' | 'inprogress' | 'ready' | 'error';
      pctComplete?: string;
      errorReasonCode?: string;
      errorReasonText?: string;
    };
    meta: {
      name: string;
    };
    created: string;
    modified: string;
    duration: number;
    input: {
      width: number;
      height: number;
    };
    playback: {
      hls: string;
      dash: string;
    };
    preview: string;
    requireSignedURLs: boolean;
    uploaded?: string;
    size?: number;
  };
}

/**
 * GET /api/admin/content/video/status
 *
 * Check the status of a video in Cloudflare Stream
 *
 * Query params:
 * - uid: The Cloudflare Stream video UID
 */
export async function GET(request: NextRequest) {
  // Check admin access
  const authResult = await adminGuard(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { searchParams } = new URL(request.url);
  const uid = searchParams.get('uid');

  if (!uid) {
    return NextResponse.json(
      { success: false, error: 'Missing video uid parameter' },
      { status: 400 }
    );
  }

  if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN) {
    return NextResponse.json(
      { success: false, error: 'Cloudflare credentials not configured' },
      { status: 500 }
    );
  }

  try {
    // Query Cloudflare Stream API for video details
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream/${uid}`,
      {
        headers: {
          'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        },
      }
    );

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      console.error('Cloudflare API error:', errData);
      return NextResponse.json(
        {
          success: false,
          error: errData.errors?.[0]?.message || `Failed to get video status: ${response.status}`,
        },
        { status: response.status }
      );
    }

    const data: CloudflareVideoResponse = await response.json();

    if (!data.success || !data.result) {
      return NextResponse.json(
        {
          success: false,
          error: data.errors?.[0]?.message || 'Failed to get video details',
        },
        { status: 400 }
      );
    }

    // Return relevant video information
    return NextResponse.json({
      success: true,
      result: {
        uid: data.result.uid,
        readyToStream: data.result.readyToStream,
        status: data.result.status,
        duration: data.result.duration,
        thumbnail: data.result.thumbnail,
        playback: data.result.playback,
        meta: data.result.meta,
        input: data.result.input,
        created: data.result.created,
        modified: data.result.modified,
      },
    });
  } catch (error) {
    console.error('Error checking video status:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to check video status',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/content/video/status
 *
 * Update the video status in the database based on Cloudflare status
 *
 * Body:
 * - uid: The Cloudflare Stream video UID
 * - lessonId: (optional) The lesson ID to update
 */
export async function POST(request: NextRequest) {
  // Check admin access
  const authResult = await adminGuard(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const body = await request.json();
  const { uid, lessonId } = body;

  if (!uid) {
    return NextResponse.json(
      { success: false, error: 'Missing video uid' },
      { status: 400 }
    );
  }

  if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN) {
    return NextResponse.json(
      { success: false, error: 'Cloudflare credentials not configured' },
      { status: 500 }
    );
  }

  try {
    // Get video status from Cloudflare
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream/${uid}`,
      {
        headers: {
          'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        },
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: `Failed to get video status: ${response.status}` },
        { status: response.status }
      );
    }

    const data: CloudflareVideoResponse = await response.json();

    if (!data.success || !data.result) {
      return NextResponse.json(
        { success: false, error: 'Failed to get video details' },
        { status: 400 }
      );
    }

    // Map Cloudflare status to our status
    const cfStatus = data.result.status.state;
    let videoStatus: 'pending' | 'processing' | 'ready' | 'error' = 'pending';

    if (data.result.readyToStream || cfStatus === 'ready') {
      videoStatus = 'ready';
    } else if (['downloading', 'queued', 'inprogress'].includes(cfStatus)) {
      videoStatus = 'processing';
    } else if (cfStatus === 'error') {
      videoStatus = 'error';
    }

    // If lessonId provided, update the database
    if (lessonId) {
      const supabase = await createServerClient();

      const updateData: Record<string, unknown> = {
        video_status: videoStatus,
        video_duration_seconds: data.result.duration ? Math.round(data.result.duration) : undefined,
        video_playback_hls: data.result.playback?.hls,
        video_playback_dash: data.result.playback?.dash,
      };

      const { error: updateError } = await supabase
        .from('course_lessons')
        .update(updateData)
        .eq('id', lessonId);

      if (updateError) {
        console.error('Error updating lesson:', updateError);
        // Don't fail the request, just log the error
      }
    }

    return NextResponse.json({
      success: true,
      result: {
        uid: data.result.uid,
        videoStatus,
        readyToStream: data.result.readyToStream,
        status: data.result.status,
        duration: data.result.duration,
        thumbnail: data.result.thumbnail,
        playback: data.result.playback,
      },
    });
  } catch (error) {
    console.error('Error syncing video status:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to sync video status',
      },
      { status: 500 }
    );
  }
}
