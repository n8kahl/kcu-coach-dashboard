// ============================================
// Social Accounts API Route
// ============================================
// Manage connected social media accounts

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthenticatedUser } from '@/lib/auth';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ============================================
// GET - List connected accounts
// ============================================

export async function GET() {
  try {
    // Verify admin access
    const user = await getAuthenticatedUser();
    if (!user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch all active social accounts (excluding token data)
    const { data: accounts, error } = await supabase
      .from('social_accounts')
      .select(`
        id,
        platform,
        account_id,
        account_name,
        account_handle,
        profile_image_url,
        metadata,
        followers_count,
        following_count,
        posts_count,
        is_active,
        connected_by,
        connected_at,
        last_sync_at,
        token_expires_at
      `)
      .eq('is_active', true)
      .order('platform', { ascending: true });

    if (error) {
      console.error('[Accounts] Fetch error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Check token expiration status for each account
    const accountsWithStatus = (accounts || []).map(account => {
      const expiresAt = account.token_expires_at ? new Date(account.token_expires_at) : null;
      const now = new Date();
      const daysUntilExpiry = expiresAt
        ? Math.floor((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      return {
        ...account,
        token_status: !expiresAt
          ? 'unknown'
          : daysUntilExpiry !== null && daysUntilExpiry < 0
            ? 'expired'
            : daysUntilExpiry !== null && daysUntilExpiry < 7
              ? 'expiring_soon'
              : 'valid',
        days_until_expiry: daysUntilExpiry,
      };
    });

    return NextResponse.json({
      success: true,
      data: accountsWithStatus,
    });
  } catch (error) {
    console.error('[Accounts] GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE - Disconnect an account
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
        { error: 'Account ID is required' },
        { status: 400 }
      );
    }

    // Get account info for audit log
    const { data: account } = await supabase
      .from('social_accounts')
      .select('platform, account_handle')
      .eq('id', id)
      .single();

    // Soft delete - set is_active to false
    const { error } = await supabase
      .from('social_accounts')
      .update({
        is_active: false,
        access_token: '', // Clear token
        refresh_token: null,
      })
      .eq('id', id);

    if (error) {
      console.error('[Accounts] Delete error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log audit event
    await supabase.from('social_audit_log').insert({
      action: 'account_disconnected',
      entity_type: 'social_account',
      entity_id: id,
      actor_id: user.id,
      details: {
        platform: account?.platform,
        handle: account?.account_handle,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Account disconnected',
    });
  } catch (error) {
    console.error('[Accounts] DELETE error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
