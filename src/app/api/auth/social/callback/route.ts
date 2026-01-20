// ============================================
// Social Media OAuth Callback Handler
// ============================================
// Handles OAuth callbacks from Instagram, TikTok, YouTube

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthenticatedUser } from '@/lib/auth';
import {
  verifySignedState,
  completeInstagramOAuth,
  completeTikTokOAuth,
  completeYouTubeOAuth,
} from '@/lib/social/oauth';
import { encryptToken } from '@/lib/social/encryption';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const errorReason = searchParams.get('error_reason');
  const errorDescription = searchParams.get('error_description');

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const defaultRedirect = '/admin/social-builder';

  // Handle OAuth errors
  if (error) {
    console.error('[Social OAuth] Error:', { error, errorReason, errorDescription });
    const errorMessage = encodeURIComponent(errorDescription || error);
    return NextResponse.redirect(
      `${baseUrl}${defaultRedirect}?oauth_error=${errorMessage}`
    );
  }

  // Validate required parameters
  if (!code) {
    return NextResponse.redirect(
      `${baseUrl}${defaultRedirect}?oauth_error=${encodeURIComponent('No authorization code received')}`
    );
  }

  if (!state) {
    return NextResponse.redirect(
      `${baseUrl}${defaultRedirect}?oauth_error=${encodeURIComponent('Invalid state parameter')}`
    );
  }

  // Verify and parse state
  const stateData = verifySignedState(state);
  if (!stateData) {
    console.warn('[Social OAuth] Invalid or expired state signature');
    return NextResponse.redirect(
      `${baseUrl}${defaultRedirect}?oauth_error=${encodeURIComponent('Invalid or expired authorization request')}`
    );
  }

  const redirectTo = stateData.redirect || defaultRedirect;

  try {
    // Verify admin access
    const user = await getAuthenticatedUser();
    if (!user?.isAdmin || !user.id) {
      return NextResponse.redirect(
        `${baseUrl}${redirectTo}?oauth_error=${encodeURIComponent('Admin access required')}`
      );
    }

    const userId = user.id;

    // Handle platform-specific OAuth
    switch (stateData.platform) {
      case 'instagram': {
        const data = await completeInstagramOAuth(code);
        const tokenExpiresAt = new Date(Date.now() + data.expiresIn * 1000).toISOString();
        const encryptedToken = encryptToken(data.accessToken);

        await upsertAccount({
          platform: 'instagram',
          accountId: data.userId,
          accountName: data.username,
          accountHandle: data.username,
          accessToken: encryptedToken,
          tokenExpiresAt,
          metadata: {
            account_type: data.accountType,
            media_count: data.mediaCount,
          },
          postsCount: data.mediaCount || 0,
          userId,
        });

        return NextResponse.redirect(
          `${baseUrl}${redirectTo}?oauth_success=instagram&account=${encodeURIComponent(data.username)}`
        );
      }

      case 'tiktok': {
        const data = await completeTikTokOAuth(code);
        const tokenExpiresAt = new Date(Date.now() + data.expiresIn * 1000).toISOString();
        const encryptedToken = encryptToken(data.accessToken);
        const encryptedRefreshToken = encryptToken(data.refreshToken);

        await upsertAccount({
          platform: 'tiktok',
          accountId: data.userId,
          accountName: data.displayName,
          accountHandle: data.displayName,
          accessToken: encryptedToken,
          refreshToken: encryptedRefreshToken,
          tokenExpiresAt,
          profileImageUrl: data.avatarUrl,
          followersCount: data.followerCount,
          metadata: {
            avatar_url: data.avatarUrl,
            follower_count: data.followerCount,
          },
          userId,
        });

        return NextResponse.redirect(
          `${baseUrl}${redirectTo}?oauth_success=tiktok&account=${encodeURIComponent(data.displayName)}`
        );
      }

      case 'youtube': {
        const data = await completeYouTubeOAuth(code);
        const tokenExpiresAt = new Date(Date.now() + data.expiresIn * 1000).toISOString();
        const encryptedToken = encryptToken(data.accessToken);
        const encryptedRefreshToken = data.refreshToken ? encryptToken(data.refreshToken) : null;

        await upsertAccount({
          platform: 'youtube',
          accountId: data.channelId,
          accountName: data.channelTitle,
          accountHandle: data.customUrl || data.channelTitle,
          accessToken: encryptedToken,
          refreshToken: encryptedRefreshToken,
          tokenExpiresAt,
          profileImageUrl: data.thumbnail,
          followersCount: data.subscriberCount,
          metadata: {
            channel_id: data.channelId,
            custom_url: data.customUrl,
            thumbnail: data.thumbnail,
            subscriber_count: data.subscriberCount,
          },
          userId,
        });

        return NextResponse.redirect(
          `${baseUrl}${redirectTo}?oauth_success=youtube&account=${encodeURIComponent(data.channelTitle)}`
        );
      }

      default:
        return NextResponse.redirect(
          `${baseUrl}${redirectTo}?oauth_error=${encodeURIComponent('Unknown platform')}`
        );
    }
  } catch (error) {
    console.error('[Social OAuth] Callback error:', error);
    const message = error instanceof Error ? error.message : 'Connection failed';
    return NextResponse.redirect(
      `${baseUrl}${redirectTo}?oauth_error=${encodeURIComponent(message)}`
    );
  }
}

// ============================================
// Helper: Upsert social account
// ============================================

interface UpsertAccountParams {
  platform: 'instagram' | 'tiktok' | 'youtube';
  accountId: string;
  accountName: string;
  accountHandle: string;
  accessToken: string;
  refreshToken?: string | null;
  tokenExpiresAt: string;
  profileImageUrl?: string;
  followersCount?: number;
  postsCount?: number;
  metadata?: Record<string, unknown>;
  userId: string;
}

async function upsertAccount(params: UpsertAccountParams): Promise<void> {
  const {
    platform,
    accountId,
    accountName,
    accountHandle,
    accessToken,
    refreshToken,
    tokenExpiresAt,
    profileImageUrl,
    followersCount,
    postsCount,
    metadata,
    userId,
  } = params;

  // Check if account already exists
  const { data: existingAccount } = await supabase
    .from('social_accounts')
    .select('id')
    .eq('platform', platform)
    .eq('account_id', accountId)
    .single();

  const accountData = {
    account_name: accountName,
    account_handle: accountHandle,
    access_token: accessToken,
    refresh_token: refreshToken || null,
    token_expires_at: tokenExpiresAt,
    profile_image_url: profileImageUrl || null,
    followers_count: followersCount || 0,
    posts_count: postsCount || 0,
    metadata: metadata || {},
    is_active: true,
    last_sync_at: new Date().toISOString(),
  };

  if (existingAccount) {
    // Update existing account
    const { error: updateError } = await supabase
      .from('social_accounts')
      .update(accountData)
      .eq('id', existingAccount.id);

    if (updateError) {
      throw new Error(`Failed to update account: ${updateError.message}`);
    }

    // Log audit event
    await supabase.from('social_audit_log').insert({
      action: 'account_reconnected',
      entity_type: 'social_account',
      entity_id: existingAccount.id,
      actor_id: userId,
      details: { platform, account_handle: accountHandle },
    });
  } else {
    // Create new account
    const { data: newAccount, error: insertError } = await supabase
      .from('social_accounts')
      .insert({
        platform,
        account_id: accountId,
        ...accountData,
        connected_by: userId,
      })
      .select('id')
      .single();

    if (insertError) {
      throw new Error(`Failed to save account: ${insertError.message}`);
    }

    // Log audit event
    await supabase.from('social_audit_log').insert({
      action: 'account_connected',
      entity_type: 'social_account',
      entity_id: newAccount?.id,
      actor_id: userId,
      details: { platform, account_handle: accountHandle },
    });
  }
}
