// ============================================
// Social Content Publishing API
// ============================================
// Publishes approved content to connected social platforms

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthenticatedUser } from '@/lib/auth';
import { publishToSocialPlatform, type SocialPlatform } from '@/lib/social/publisher';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ============================================
// POST - Publish content to a platform
// ============================================

export async function POST(request: NextRequest) {
  try {
    // Verify admin access
    const user = await getAuthenticatedUser();
    if (!user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { suggestionId, targetPlatform, mediaUrl, customCaption } = body;

    if (!suggestionId) {
      return NextResponse.json(
        { error: 'suggestionId is required' },
        { status: 400 }
      );
    }

    if (!targetPlatform) {
      return NextResponse.json(
        { error: 'targetPlatform is required' },
        { status: 400 }
      );
    }

    // Fetch the suggestion
    const { data: suggestion, error: suggestionError } = await supabase
      .from('content_suggestions')
      .select('*')
      .eq('id', suggestionId)
      .single();

    if (suggestionError || !suggestion) {
      return NextResponse.json(
        { error: 'Suggestion not found' },
        { status: 404 }
      );
    }

    // Check suggestion is approved
    if (suggestion.status !== 'approved') {
      return NextResponse.json(
        { error: 'Only approved suggestions can be published' },
        { status: 400 }
      );
    }

    // Get connected account for the target platform
    const { data: account, error: accountError } = await supabase
      .from('social_accounts')
      .select('id, platform, account_handle')
      .eq('platform', targetPlatform)
      .eq('is_active', true)
      .single();

    if (accountError || !account) {
      return NextResponse.json(
        { error: `No connected ${targetPlatform} account found` },
        { status: 400 }
      );
    }

    // Build the caption with hashtags
    const caption = customCaption || buildCaption(suggestion);

    // Check for media URL
    // If not provided, check if suggestion has media suggestions
    let finalMediaUrl = mediaUrl;
    if (!finalMediaUrl && suggestion.media_suggestions?.length > 0) {
      finalMediaUrl = suggestion.media_suggestions[0].url;
    }

    if (!finalMediaUrl) {
      return NextResponse.json(
        { error: 'mediaUrl is required for publishing' },
        { status: 400 }
      );
    }

    // Determine media type from suggestion
    const mediaType = getMediaType(suggestion.suggested_media_type);

    // Create social_posts record with 'publishing' status
    const { data: post, error: postError } = await supabase
      .from('social_posts')
      .insert({
        account_id: account.id,
        content_type: suggestion.content_type || 'feed_post',
        caption,
        hashtags: suggestion.suggested_hashtags || [],
        media: finalMediaUrl ? [{ type: mediaType === 'VIDEO' ? 'video' : 'image', url: finalMediaUrl }] : [],
        status: 'publishing',
        content_category: suggestion.category,
        ai_generated: true,
        suggestion_id: suggestionId,
        created_by: user.id,
      })
      .select('id')
      .single();

    if (postError) {
      console.error('[Publish] Failed to create post record:', postError);
      return NextResponse.json(
        { error: 'Failed to create post record' },
        { status: 500 }
      );
    }

    // Publish to the platform
    const result = await publishToSocialPlatform(
      targetPlatform as SocialPlatform,
      account.id,
      finalMediaUrl,
      caption,
      mediaType
    );

    if (result.success) {
      // Update post record with success
      await supabase
        .from('social_posts')
        .update({
          status: 'published',
          platform_post_id: result.platformPostId,
          platform_url: result.platformUrl,
          published_at: new Date().toISOString(),
        })
        .eq('id', post.id);

      // Update suggestion status
      await supabase
        .from('content_suggestions')
        .update({ status: 'published' })
        .eq('id', suggestionId);

      // Log audit event
      await supabase.from('social_audit_log').insert({
        action: 'post_published',
        entity_type: 'social_post',
        entity_id: post.id,
        actor_id: user.id,
        details: {
          platform: targetPlatform,
          account_handle: account.account_handle,
          platform_post_id: result.platformPostId,
          suggestion_id: suggestionId,
        },
      });

      return NextResponse.json({
        success: true,
        data: {
          postId: post.id,
          platformPostId: result.platformPostId,
          platformUrl: result.platformUrl,
        },
      });
    } else {
      // Update post record with failure
      await supabase
        .from('social_posts')
        .update({
          status: 'failed',
          error_message: result.error,
          retry_count: 0,
        })
        .eq('id', post.id);

      // Log audit event
      await supabase.from('social_audit_log').insert({
        action: 'post_failed',
        entity_type: 'social_post',
        entity_id: post.id,
        actor_id: user.id,
        details: {
          platform: targetPlatform,
          error: result.error,
          suggestion_id: suggestionId,
        },
      });

      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Publishing failed',
          postId: post.id,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[Publish] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================
// Helper Functions
// ============================================

/**
 * Build caption from suggestion data
 */
function buildCaption(suggestion: {
  suggested_hook?: string;
  suggested_caption: string;
  suggested_cta?: string;
  suggested_hashtags?: string[];
}): string {
  const parts: string[] = [];

  // Add hook if present
  if (suggestion.suggested_hook) {
    parts.push(suggestion.suggested_hook);
    parts.push(''); // Empty line
  }

  // Add main caption
  parts.push(suggestion.suggested_caption);

  // Add CTA if present
  if (suggestion.suggested_cta) {
    parts.push(''); // Empty line
    parts.push(suggestion.suggested_cta);
  }

  // Add hashtags
  if (suggestion.suggested_hashtags?.length) {
    parts.push(''); // Empty line
    parts.push(suggestion.suggested_hashtags.map((tag) =>
      tag.startsWith('#') ? tag : `#${tag}`
    ).join(' '));
  }

  return parts.join('\n');
}

/**
 * Get media type from suggestion
 */
function getMediaType(
  suggestedMediaType?: string
): 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM' {
  if (!suggestedMediaType) return 'IMAGE';

  const type = suggestedMediaType.toLowerCase();
  if (type.includes('video') || type.includes('reel')) {
    return 'VIDEO';
  }
  if (type.includes('carousel')) {
    return 'CAROUSEL_ALBUM';
  }
  return 'IMAGE';
}

// ============================================
// GET - Get publishing history
// ============================================

export async function GET(request: NextRequest) {
  try {
    // Verify admin access
    const user = await getAuthenticatedUser();
    if (!user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const platform = searchParams.get('platform');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build query
    let query = supabase
      .from('social_posts')
      .select(`
        *,
        account:social_accounts(platform, account_handle),
        suggestion:content_suggestions(topic, category)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    if (platform) {
      query = query.eq('account.platform', platform);
    }

    const { data: posts, count, error } = await query;

    if (error) {
      console.error('[Publish] Fetch error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: posts,
      total: count,
      limit,
      offset,
    });
  } catch (error) {
    console.error('[Publish] GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
