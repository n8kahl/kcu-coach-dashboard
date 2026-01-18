// ============================================
// KCU Social Builder - Influencer Scraping API
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthenticatedUser } from '@/lib/auth';
import {
  scrapeInfluencer,
  scrapeAllDueInfluencers,
} from '@/lib/social/influencer-scraper';
import { analyzeInfluencerFully } from '@/lib/social/tone-analyzer';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ============================================
// POST - Trigger scraping
// ============================================

export async function POST(request: NextRequest) {
  try {
    // Verify admin access
    const user = await getAuthenticatedUser();
    if (!user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { influencer_id, scrape_all, analyze_tone } = body;

    // Single influencer scrape
    if (influencer_id) {
      const result = await scrapeInfluencer(influencer_id);

      // Optionally run tone analysis
      if (analyze_tone && result.success) {
        try {
          const analysis = await analyzeInfluencerFully(influencer_id);
          return NextResponse.json({
            success: true,
            scrape_result: result,
            tone_analysis: analysis,
          });
        } catch (analysisError) {
          console.error('Tone analysis error:', analysisError);
          return NextResponse.json({
            success: true,
            scrape_result: result,
            tone_analysis_error: 'Tone analysis failed',
          });
        }
      }

      // Log audit event
      await supabase.from('social_audit_log').insert({
        action: 'influencer_scraped',
        entity_type: 'influencer_profile',
        entity_id: influencer_id,
        actor_id: user.id,
        details: {
          posts_scraped: result.posts_scraped,
          new_posts: result.new_posts,
        },
      });

      return NextResponse.json({
        success: true,
        result,
      });
    }

    // Scrape all due influencers
    if (scrape_all) {
      const results = await scrapeAllDueInfluencers();

      const summary = {
        total_scraped: results.length,
        successful: results.filter((r) => r.success).length,
        failed: results.filter((r) => !r.success).length,
        total_posts: results.reduce((sum, r) => sum + r.posts_scraped, 0),
        new_posts: results.reduce((sum, r) => sum + r.new_posts, 0),
      };

      return NextResponse.json({
        success: true,
        summary,
        results,
      });
    }

    return NextResponse.json(
      { error: 'Either influencer_id or scrape_all is required' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Scrape POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================
// GET - Get scraping status/history
// ============================================

export async function GET(request: NextRequest) {
  try {
    // Verify admin access
    const user = await getAuthenticatedUser();
    if (!user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const influencer_id = searchParams.get('influencer_id');

    if (influencer_id) {
      // Get scraping history for specific influencer
      const { data: influencer } = await supabase
        .from('influencer_profiles')
        .select('id, handle, last_scraped_at, scrape_frequency_hours')
        .eq('id', influencer_id)
        .single();

      const { data: recentPosts, count } = await supabase
        .from('influencer_posts')
        .select('id, scraped_at', { count: 'exact' })
        .eq('influencer_id', influencer_id)
        .order('scraped_at', { ascending: false })
        .limit(10);

      const nextScrapeAt = influencer?.last_scraped_at
        ? new Date(
            new Date(influencer.last_scraped_at).getTime() +
              influencer.scrape_frequency_hours * 60 * 60 * 1000
          )
        : null;

      return NextResponse.json({
        success: true,
        influencer,
        total_posts: count,
        recent_scrapes: recentPosts,
        next_scrape_at: nextScrapeAt?.toISOString(),
      });
    }

    // Get overall scraping status
    const { data: influencers } = await supabase
      .from('influencer_profiles')
      .select('id, handle, platform, last_scraped_at, scrape_frequency_hours')
      .eq('is_active', true);

    const now = new Date();
    const dueSoon = influencers?.filter((inf) => {
      if (!inf.last_scraped_at) return true;
      const lastScraped = new Date(inf.last_scraped_at);
      const hoursSince = (now.getTime() - lastScraped.getTime()) / (1000 * 60 * 60);
      return hoursSince >= inf.scrape_frequency_hours * 0.8;
    });

    const { count: totalPosts } = await supabase
      .from('influencer_posts')
      .select('*', { count: 'exact', head: true });

    return NextResponse.json({
      success: true,
      summary: {
        total_influencers: influencers?.length || 0,
        due_for_scrape: dueSoon?.length || 0,
        total_posts: totalPosts || 0,
      },
      due_soon: dueSoon?.map((inf) => ({
        id: inf.id,
        handle: inf.handle,
        platform: inf.platform,
        last_scraped_at: inf.last_scraped_at,
      })),
    });
  } catch (error) {
    console.error('Scrape GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
