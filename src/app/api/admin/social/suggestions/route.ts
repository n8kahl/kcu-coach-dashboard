// ============================================
// KCU Social Builder - Content Suggestions API
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthenticatedUser } from '@/lib/auth';
import { SuggestionStatus, ContentCategory } from '@/types/social';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ============================================
// GET - List content suggestions
// ============================================

export async function GET(request: NextRequest) {
  try {
    // Verify admin access
    const user = await getAuthenticatedUser();
    if (!user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as SuggestionStatus | null;
    const category = searchParams.get('category') as ContentCategory | null;
    const platform = searchParams.get('platform');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build query
    let query = supabase
      .from('content_suggestions')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    } else {
      // By default, exclude expired
      query = query.neq('status', 'expired');
    }

    if (category) {
      query = query.eq('category', category);
    }

    if (platform) {
      query = query.contains('platforms', [platform]);
    }

    const { data: suggestions, count, error } = await query;

    if (error) {
      console.error('Error fetching suggestions:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: suggestions,
      total: count,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Suggestions GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================
// PUT - Update suggestion (approve/reject/edit)
// ============================================

export async function PUT(request: NextRequest) {
  try {
    // Verify admin access
    const user = await getAuthenticatedUser();
    if (!user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, action, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Suggestion ID is required' },
        { status: 400 }
      );
    }

    // Handle specific actions
    if (action === 'approve') {
      const { data, error } = await supabase
        .from('content_suggestions')
        .update({
          status: 'approved',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          ...updates, // Allow edits during approval
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // Log audit event
      await supabase.from('social_audit_log').insert({
        action: 'suggestion_approved',
        entity_type: 'content_suggestion',
        entity_id: id,
        actor_id: user.id,
        details: { edited: Object.keys(updates).length > 0 },
      });

      return NextResponse.json({ success: true, data });
    }

    if (action === 'reject') {
      const { data, error } = await supabase
        .from('content_suggestions')
        .update({
          status: 'rejected',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          review_notes: updates.review_notes || '',
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // Log audit event
      await supabase.from('social_audit_log').insert({
        action: 'suggestion_rejected',
        entity_type: 'content_suggestion',
        entity_id: id,
        actor_id: user.id,
        details: { reason: updates.review_notes },
      });

      return NextResponse.json({ success: true, data });
    }

    // General update (edit)
    const allowedUpdates = [
      'suggested_caption',
      'suggested_hashtags',
      'suggested_hook',
      'suggested_cta',
      'platform_variants',
      'topic',
      'category',
      'suggested_media_type',
      'media_suggestions',
      'review_notes',
    ];

    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([key]) => allowedUpdates.includes(key))
    );

    if (Object.keys(filteredUpdates).length > 0) {
      filteredUpdates.status = 'edited';
    }

    const { data, error } = await supabase
      .from('content_suggestions')
      .update(filteredUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Suggestions PUT error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE - Remove suggestion
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
        { error: 'Suggestion ID is required' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('content_suggestions')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Suggestion deleted',
    });
  } catch (error) {
    console.error('Suggestions DELETE error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================
// POST - Bulk actions on suggestions
// ============================================

export async function POST(request: NextRequest) {
  try {
    // Verify admin access
    const user = await getAuthenticatedUser();
    if (!user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, suggestion_ids } = body;

    if (!action || !suggestion_ids?.length) {
      return NextResponse.json(
        { error: 'action and suggestion_ids are required' },
        { status: 400 }
      );
    }

    let updateData: Record<string, unknown> = {};

    switch (action) {
      case 'approve_all':
        updateData = {
          status: 'approved',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        };
        break;
      case 'reject_all':
        updateData = {
          status: 'rejected',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        };
        break;
      case 'delete_all':
        const { error: deleteError } = await supabase
          .from('content_suggestions')
          .delete()
          .in('id', suggestion_ids);

        if (deleteError) {
          return NextResponse.json({ error: deleteError.message }, { status: 500 });
        }

        return NextResponse.json({
          success: true,
          message: `Deleted ${suggestion_ids.length} suggestions`,
        });
      case 'expire_old':
        // Mark suggestions older than 7 days as expired
        const expiryDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const { error: expireError, count } = await supabase
          .from('content_suggestions')
          .update({ status: 'expired' })
          .eq('status', 'pending')
          .lt('created_at', expiryDate);

        if (expireError) {
          return NextResponse.json({ error: expireError.message }, { status: 500 });
        }

        return NextResponse.json({
          success: true,
          message: `Expired ${count || 0} old suggestions`,
        });
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

    const { error } = await supabase
      .from('content_suggestions')
      .update(updateData)
      .in('id', suggestion_ids);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `${action} completed for ${suggestion_ids.length} suggestions`,
    });
  } catch (error) {
    console.error('Suggestions POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
