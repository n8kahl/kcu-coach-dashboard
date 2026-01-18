// ============================================
// KCU Social Builder - Content Insights API
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import {
  getContentInsights,
  analyzeEngagement,
  analyzeKayCapitalsContent,
  generateVideoContentIdeas,
  analyzeInfluencerForInspiration,
  compareWithCompetitor,
} from '@/lib/social/content-insights';
import type { SocialPlatform } from '@/types/social';

// ============================================
// GET - Fetch content insights
// ============================================

export async function GET(request: NextRequest) {
  try {
    // Verify admin access
    const user = await getAuthenticatedUser();
    if (!user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // 'overview', 'analytics', 'ideas', 'competitor'
    const platform = (searchParams.get('platform') || 'instagram') as SocialPlatform;
    const handle = searchParams.get('handle');

    switch (type) {
      case 'overview':
      case null:
        // Get comprehensive insights
        const insights = await getContentInsights();
        return NextResponse.json({
          success: true,
          data: insights,
        });

      case 'analytics':
        // Get analytics for a specific account
        if (!handle) {
          // Return KayCapitals analytics
          const kcuAnalytics = await analyzeKayCapitalsContent();
          return NextResponse.json({
            success: true,
            data: kcuAnalytics,
          });
        }

        const analytics = await analyzeEngagement(platform, handle, 50);
        return NextResponse.json({
          success: true,
          data: analytics,
        });

      case 'ideas':
        // Generate video content ideas
        const count = parseInt(searchParams.get('count') || '10');
        const ideas = await generateVideoContentIdeas(platform, count);
        return NextResponse.json({
          success: true,
          data: ideas,
        });

      case 'competitor':
        // Analyze competitor for inspiration
        if (!handle) {
          return NextResponse.json(
            { error: 'handle parameter required for competitor analysis' },
            { status: 400 }
          );
        }

        const competitorInsights = await analyzeInfluencerForInspiration(platform, handle);
        return NextResponse.json({
          success: true,
          data: competitorInsights,
        });

      case 'compare':
        // Compare with competitor
        if (!handle) {
          return NextResponse.json(
            { error: 'handle parameter required for comparison' },
            { status: 400 }
          );
        }

        const comparison = await compareWithCompetitor(platform, handle);
        return NextResponse.json({
          success: true,
          data: comparison,
        });

      default:
        return NextResponse.json(
          { error: 'Invalid type parameter' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Insights GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================
// POST - Generate new insights or analyze
// ============================================

export async function POST(request: NextRequest) {
  try {
    // Verify admin access
    const user = await getAuthenticatedUser();
    if (!user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, platform = 'instagram', handle, count = 10 } = body;

    switch (action) {
      case 'generate_ideas':
        const ideas = await generateVideoContentIdeas(platform as SocialPlatform, count);
        return NextResponse.json({
          success: true,
          data: ideas,
          message: `Generated ${ideas.length} content ideas`,
        });

      case 'analyze_account':
        if (!handle) {
          return NextResponse.json(
            { error: 'handle is required' },
            { status: 400 }
          );
        }

        const analytics = await analyzeEngagement(platform as SocialPlatform, handle, 50);
        return NextResponse.json({
          success: true,
          data: analytics,
        });

      case 'analyze_competitor':
        if (!handle) {
          return NextResponse.json(
            { error: 'handle is required' },
            { status: 400 }
          );
        }

        const insights = await analyzeInfluencerForInspiration(platform as SocialPlatform, handle);
        return NextResponse.json({
          success: true,
          data: insights,
          message: `Analyzed @${handle} for content inspiration`,
        });

      case 'refresh_all':
        const allInsights = await getContentInsights();
        return NextResponse.json({
          success: true,
          data: allInsights,
          message: 'Refreshed all content insights',
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Insights POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
