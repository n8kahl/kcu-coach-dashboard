// ============================================
// KCU Social Builder - Content Generation API
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthenticatedUser } from '@/lib/auth';
import {
  generateContentSuggestions,
  aggregateKCUData,
  saveSuggestions,
  generateWinPost,
  generateMarketCommentary,
  generateEducationalPost,
} from '@/lib/social/content-generator';
import {
  ContentGenerationContext,
  SocialPlatform,
  ContentCategory,
  TrendingTopic,
  InfluencerPost,
} from '@/types/social';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ============================================
// POST - Generate content suggestions
// ============================================

export async function POST(request: NextRequest) {
  try {
    // Verify admin access
    const user = await getAuthenticatedUser();
    if (!user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      platforms = ['instagram'],
      category,
      count = 5,
      include_trending = true,
      include_influencer_posts = true,
      include_kcu_data = true,
      quick_type, // 'win', 'market', 'educational'
      quick_data, // Data for quick generation
    } = body;

    // Quick generation shortcuts
    if (quick_type) {
      let suggestion;
      switch (quick_type) {
        case 'win':
          if (!quick_data) {
            return NextResponse.json(
              { error: 'quick_data required for win posts' },
              { status: 400 }
            );
          }
          suggestion = await generateWinPost(quick_data);
          break;
        case 'market':
          if (!quick_data) {
            return NextResponse.json(
              { error: 'quick_data (trending topic) required' },
              { status: 400 }
            );
          }
          suggestion = await generateMarketCommentary(quick_data);
          break;
        case 'educational':
          if (!quick_data?.topic) {
            return NextResponse.json(
              { error: 'quick_data.topic required' },
              { status: 400 }
            );
          }
          suggestion = await generateEducationalPost(quick_data.topic);
          break;
        default:
          return NextResponse.json(
            { error: 'Invalid quick_type' },
            { status: 400 }
          );
      }

      // Save the suggestion
      const savedIds = await saveSuggestions([suggestion]);

      return NextResponse.json({
        success: true,
        suggestion,
        saved_id: savedIds[0],
      });
    }

    // Build generation context
    const context: ContentGenerationContext = {
      target_platforms: platforms as SocialPlatform[],
      target_category: category as ContentCategory | undefined,
      count,
    };

    // Fetch trending topics if requested
    if (include_trending) {
      const { data: trendingTopics } = await supabase
        .from('trending_topics')
        .select('*')
        .eq('is_active', true)
        .order('trend_score', { ascending: false })
        .limit(10);

      context.trending_topics = trendingTopics as TrendingTopic[];
    }

    // Fetch high-performing influencer posts if requested
    if (include_influencer_posts) {
      const { data: influencerPosts } = await supabase
        .from('influencer_posts')
        .select('*')
        .eq('content_inspiration_used', false)
        .gte('engagement_rate', 3) // Only high engagement posts
        .order('engagement_rate', { ascending: false })
        .limit(15);

      context.influencer_posts = influencerPosts as InfluencerPost[];
    }

    // Aggregate KCU platform data if requested
    if (include_kcu_data) {
      context.kcu_data = await aggregateKCUData();
    }

    // Generate suggestions
    const result = await generateContentSuggestions(context);

    // Save suggestions to database
    const savedIds = await saveSuggestions(result.suggestions);

    // Mark influencer posts as used for inspiration
    if (context.influencer_posts?.length) {
      const postIds = context.influencer_posts.map((p) => p.id);
      await supabase
        .from('influencer_posts')
        .update({ content_inspiration_used: true })
        .in('id', postIds);
    }

    // Mark trending topics as processed
    if (context.trending_topics?.length) {
      const topicIds = context.trending_topics.map((t) => t.id);
      await supabase
        .from('trending_topics')
        .update({ processed_for_suggestions: true })
        .in('id', topicIds);
    }

    return NextResponse.json({
      success: true,
      suggestions: result.suggestions,
      saved_ids: savedIds,
      reasoning: result.reasoning,
      inspiration_sources: result.inspiration_sources,
    });
  } catch (error) {
    console.error('Generate POST error:', error);
    return NextResponse.json(
      { error: 'Content generation failed: ' + (error as Error).message },
      { status: 500 }
    );
  }
}

// ============================================
// GET - Get generation history/stats
// ============================================

export async function GET(request: NextRequest) {
  try {
    // Verify admin access
    const user = await getAuthenticatedUser();
    if (!user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '7');

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    // Get generation stats
    const { data: suggestions, count: totalSuggestions } = await supabase
      .from('content_suggestions')
      .select('*', { count: 'exact' })
      .gte('created_at', since);

    const byStatus = suggestions?.reduce(
      (acc, s) => {
        acc[s.status] = (acc[s.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const byCategory = suggestions?.reduce(
      (acc, s) => {
        if (s.category) acc[s.category] = (acc[s.category] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const byPlatform = suggestions?.reduce(
      (acc, s) => {
        s.platforms?.forEach((p: string) => {
          acc[p] = (acc[p] || 0) + 1;
        });
        return acc;
      },
      {} as Record<string, number>
    );

    // Get average scores
    const avgEngagementScore =
      suggestions?.reduce((sum, s) => sum + (s.predicted_engagement_score || 0), 0) /
        (suggestions?.length || 1) || 0;

    const avgToneScore =
      suggestions?.reduce((sum, s) => sum + (s.kcu_tone_match_score || 0), 0) /
        (suggestions?.length || 1) || 0;

    // Get AI settings
    const { data: aiConfig } = await supabase
      .from('social_builder_config')
      .select('config_value')
      .eq('config_key', 'ai_settings')
      .single();

    return NextResponse.json({
      success: true,
      stats: {
        period_days: days,
        total_suggestions: totalSuggestions,
        by_status: byStatus,
        by_category: byCategory,
        by_platform: byPlatform,
        avg_predicted_engagement: Math.round(avgEngagementScore * 10) / 10,
        avg_tone_match_score: Math.round(avgToneScore * 10) / 10,
      },
      ai_settings: aiConfig?.config_value,
    });
  } catch (error) {
    console.error('Generate GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
