// ============================================
// Social Account Connection API
// ============================================
// Initiates OAuth flow for connecting social accounts

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { getInstagramAuthUrl } from '@/lib/social/oauth';

// ============================================
// GET - Get OAuth URL for a platform
// ============================================

export async function GET(request: NextRequest) {
  try {
    // Verify admin access
    const user = await getAuthenticatedUser();
    if (!user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const platform = searchParams.get('platform');

    if (!platform) {
      return NextResponse.json(
        { error: 'Platform is required' },
        { status: 400 }
      );
    }

    let authUrl: string;

    switch (platform.toLowerCase()) {
      case 'instagram':
        try {
          authUrl = getInstagramAuthUrl('/admin/social-builder');
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Instagram not configured';
          return NextResponse.json(
            { error: message, configured: false },
            { status: 400 }
          );
        }
        break;

      case 'tiktok':
        return NextResponse.json(
          { error: 'TikTok connection coming soon', configured: false },
          { status: 400 }
        );

      case 'youtube':
        return NextResponse.json(
          { error: 'YouTube connection coming soon', configured: false },
          { status: 400 }
        );

      default:
        return NextResponse.json(
          { error: 'Unknown platform' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      authUrl,
      platform,
    });
  } catch (error) {
    console.error('[Connect] GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
