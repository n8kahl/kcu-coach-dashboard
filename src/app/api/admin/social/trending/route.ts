// ============================================
// KCU Social Builder - Trending Topics API
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthenticatedUser } from '@/lib/auth';
import {
  aggregateAllTrending,
  getActiveTrendingTopics,
  generateAITrendingTopics,
} from '@/lib/social/trending-aggregator';
import type { TrendingCategory } from '@/types/social';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ============================================
// GET - Fetch trending topics
// ============================================

export async function GET(request: NextRequest) {
  try {
    // Verify admin access
    const user = await getAuthenticatedUser();
    if (!user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') as TrendingCategory | null;
    const limit = parseInt(searchParams.get('limit') || '20');
    const source = searchParams.get('source'); // 'x', 'tiktok', 'news', 'all'
    const refresh = searchParams.get('refresh') === 'true';

    // If refresh requested, aggregate new topics
    if (refresh) {
      await aggregateAllTrending();
    }

    // Build query
    let query = supabase
      .from('trending_topics')
      .select('*', { count: 'exact' })
      .eq('is_active', true)
      .order('trend_score', { ascending: false })
      .limit(limit);

    if (category) {
      query = query.eq('category', category);
    }

    if (source && source !== 'all') {
      query = query.ilike('source', `%${source}%`);
    }

    const { data: topics, count, error } = await query;

    if (error) {
      console.error('Error fetching trending topics:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // If no topics found and not just refreshed, try to generate some
    if ((!topics || topics.length === 0) && !refresh) {
      const aiTopics = await generateAITrendingTopics('all');
      return NextResponse.json({
        success: true,
        data: aiTopics,
        total: aiTopics.length,
        source: 'ai_generated',
      });
    }

    return NextResponse.json({
      success: true,
      data: topics,
      total: count,
    });
  } catch (error) {
    console.error('Trending GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================
// POST - Refresh/aggregate trending topics
// ============================================

export async function POST(request: NextRequest) {
  try {
    // Verify admin access
    const user = await getAuthenticatedUser();
    if (!user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, sources } = body;

    if (action === 'refresh' || action === 'aggregate') {
      // Aggregate from all sources
      const topics = await aggregateAllTrending();

      // Log audit event
      await supabase.from('social_audit_log').insert({
        action: 'trending_refreshed',
        entity_type: 'trending_topics',
        actor_id: user.id,
        details: {
          topics_count: topics.length,
          sources: sources || 'all',
        },
      });

      return NextResponse.json({
        success: true,
        message: `Aggregated ${topics.length} trending topics`,
        data: topics,
      });
    }

    if (action === 'generate_ai') {
      // Generate AI-powered trending topics
      const source = sources?.[0] || 'all';
      const topics = await generateAITrendingTopics(source);

      return NextResponse.json({
        success: true,
        message: `Generated ${topics.length} AI trending topics`,
        data: topics,
      });
    }

    return NextResponse.json(
      { error: 'Invalid action. Use "refresh", "aggregate", or "generate_ai"' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Trending POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================
// PUT - Update trending topic
// ============================================

export async function PUT(request: NextRequest) {
  try {
    // Verify admin access
    const user = await getAuthenticatedUser();
    if (!user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Topic ID is required' },
        { status: 400 }
      );
    }

    // Allowed updates
    const allowedUpdates = [
      'is_active',
      'processed_for_suggestions',
      'suggested_hooks',
      'content_angles',
      'relevant_hashtags',
    ];

    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([key]) => allowedUpdates.includes(key))
    );

    const { data, error } = await supabase
      .from('trending_topics')
      .update({
        ...filteredUpdates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Trending PUT error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE - Remove trending topic
// ============================================

export async function DELETE(request: NextRequest) {
  try {
    // Verify admin access
    const user = await getAuthenticatedUser();
    if (!user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const action = searchParams.get('action');

    if (action === 'cleanup') {
      // Delete old inactive topics
      const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { error, count } = await supabase
        .from('trending_topics')
        .delete()
        .eq('is_active', false)
        .lt('updated_at', cutoff);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: `Cleaned up ${count || 0} old topics`,
      });
    }

    if (!id) {
      return NextResponse.json(
        { error: 'Topic ID is required' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('trending_topics')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Topic deleted',
    });
  } catch (error) {
    console.error('Trending DELETE error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
