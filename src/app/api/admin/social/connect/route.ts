// ============================================
// Social Account Connection API
// ============================================
// Initiates OAuth flow for connecting social accounts

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import {
  getInstagramAuthUrl,
  getTikTokAuthUrl,
  getYouTubeAuthUrl,
} from '@/lib/social/oauth';

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
    const redirectPath = '/admin/social-builder';

    switch (platform.toLowerCase()) {
      case 'instagram':
        try {
          authUrl = await getInstagramAuthUrl(redirectPath);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Instagram not configured';
          return NextResponse.json(
            { error: message, configured: false },
            { status: 400 }
          );
        }
        break;

      case 'tiktok':
        try {
          authUrl = await getTikTokAuthUrl(redirectPath);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'TikTok not configured';
          return NextResponse.json(
            { error: message, configured: false },
            { status: 400 }
          );
        }
        break;

      case 'youtube':
        try {
          authUrl = await getYouTubeAuthUrl(redirectPath);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'YouTube not configured';
          return NextResponse.json(
            { error: message, configured: false },
            { status: 400 }
          );
        }
        break;

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
