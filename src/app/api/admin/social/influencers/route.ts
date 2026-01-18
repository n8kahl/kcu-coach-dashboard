// ============================================
// KCU Social Builder - Influencer Management API
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthenticatedUser } from '@/lib/auth';
import {
  scrapeInfluencer,
  scrapeInfluencerProfile,
} from '@/lib/social/influencer-scraper';
import { analyzeInfluencerFully } from '@/lib/social/tone-analyzer';
import { InfluencerProfileInput, SocialPlatform } from '@/types/social';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ============================================
// GET - List all tracked influencers
// ============================================

export async function GET(request: NextRequest) {
  try {
    // Verify admin access
    const user = await getAuthenticatedUser();
    if (!user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse query params
    const { searchParams } = new URL(request.url);
    const platform = searchParams.get('platform') as SocialPlatform | null;
    const priority = searchParams.get('priority');
    const isActive = searchParams.get('active') !== 'false';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build query
    let query = supabase
      .from('influencer_profiles')
      .select('*', { count: 'exact' })
      .eq('is_active', isActive)
      .order('relevance_score', { ascending: false })
      .range(offset, offset + limit - 1);

    if (platform) {
      query = query.eq('platform', platform);
    }

    if (priority) {
      query = query.eq('priority', priority);
    }

    const { data: influencers, count, error } = await query;

    if (error) {
      console.error('Error fetching influencers:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: influencers,
      total: count,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Influencers GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================
// POST - Add new influencer to track
// ============================================

export async function POST(request: NextRequest) {
  try {
    // Verify admin access
    const user = await getAuthenticatedUser();
    if (!user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: InfluencerProfileInput = await request.json();

    // Validate required fields
    if (!body.platform || !body.handle) {
      return NextResponse.json(
        { error: 'Platform and handle are required' },
        { status: 400 }
      );
    }

    // Check if already tracked
    const { data: existing } = await supabase
      .from('influencer_profiles')
      .select('id')
      .eq('platform', body.platform)
      .eq('handle', body.handle.toLowerCase().replace('@', ''))
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'Influencer already being tracked', id: existing.id },
        { status: 409 }
      );
    }

    // Scrape initial profile data
    const handle = body.handle.toLowerCase().replace('@', '');
    const profileData = await scrapeInfluencerProfile(body.platform, handle);

    if (!profileData) {
      return NextResponse.json(
        { error: 'Could not fetch influencer profile. Check the handle and try again.' },
        { status: 404 }
      );
    }

    // Create influencer record
    const { data: influencer, error } = await supabase
      .from('influencer_profiles')
      .insert({
        platform: body.platform,
        handle,
        display_name: profileData.display_name || body.display_name,
        bio: profileData.bio,
        profile_url: profileData.profile_url,
        profile_image_url: profileData.profile_image_url,
        platform_user_id: profileData.platform_user_id,
        niche: body.niche || 'day_trading',
        tags: body.tags || [],
        followers_count: profileData.followers_count || 0,
        following_count: profileData.following_count || 0,
        posts_count: profileData.posts_count || 0,
        priority: body.priority || 'medium',
        notes: body.notes,
        scrape_frequency_hours: body.scrape_frequency_hours || 24,
        added_by: user.id,
        is_active: true,
        last_scraped_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating influencer:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log audit event
    await supabase.from('social_audit_log').insert({
      action: 'influencer_added',
      entity_type: 'influencer_profile',
      entity_id: influencer.id,
      actor_id: user.id,
      details: { handle, platform: body.platform },
    });

    // Trigger initial scrape in background (don't wait)
    scrapeInfluencer(influencer.id).catch(console.error);

    return NextResponse.json({
      success: true,
      data: influencer,
      message: 'Influencer added. Initial data scraping started.',
    });
  } catch (error) {
    console.error('Influencers POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================
// PUT - Update influencer settings
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
        { error: 'Influencer ID is required' },
        { status: 400 }
      );
    }

    // Only allow certain fields to be updated
    const allowedUpdates = [
      'priority',
      'notes',
      'tags',
      'niche',
      'scrape_frequency_hours',
      'is_active',
      'relevance_score',
    ];

    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([key]) => allowedUpdates.includes(key))
    );

    const { data, error } = await supabase
      .from('influencer_profiles')
      .update(filteredUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating influencer:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Influencers PUT error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE - Remove influencer from tracking
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

    if (!id) {
      return NextResponse.json(
        { error: 'Influencer ID is required' },
        { status: 400 }
      );
    }

    // Soft delete by setting is_active to false
    const { error } = await supabase
      .from('influencer_profiles')
      .update({ is_active: false })
      .eq('id', id);

    if (error) {
      console.error('Error deleting influencer:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log audit event
    await supabase.from('social_audit_log').insert({
      action: 'influencer_removed',
      entity_type: 'influencer_profile',
      entity_id: id,
      actor_id: user.id,
      details: {},
    });

    return NextResponse.json({
      success: true,
      message: 'Influencer removed from tracking',
    });
  } catch (error) {
    console.error('Influencers DELETE error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
