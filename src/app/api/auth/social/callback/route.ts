// ============================================
// Social Media OAuth Callback Handler
// ============================================
// Handles OAuth callbacks from Instagram, TikTok, YouTube

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthenticatedUser } from '@/lib/auth';
import { verifySignedState, completeInstagramOAuth } from '@/lib/social/oauth';
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
    if (!user?.isAdmin) {
      return NextResponse.redirect(
        `${baseUrl}${redirectTo}?oauth_error=${encodeURIComponent('Admin access required')}`
      );
    }

    // Handle platform-specific OAuth
    switch (stateData.platform) {
      case 'instagram': {
        // Complete Instagram OAuth flow
        const instagramData = await completeInstagramOAuth(code);

        // Calculate token expiration date
        const tokenExpiresAt = new Date(
          Date.now() + instagramData.expiresIn * 1000
        ).toISOString();

        // Encrypt the access token before storing
        const encryptedToken = encryptToken(instagramData.accessToken);

        // Check if account already exists
        const { data: existingAccount } = await supabase
          .from('social_accounts')
          .select('id')
          .eq('platform', 'instagram')
          .eq('account_id', instagramData.userId)
          .single();

        if (existingAccount) {
          // Update existing account
          const { error: updateError } = await supabase
            .from('social_accounts')
            .update({
              account_name: instagramData.username,
              account_handle: instagramData.username,
              access_token: encryptedToken,
              token_expires_at: tokenExpiresAt,
              metadata: {
                account_type: instagramData.accountType,
                media_count: instagramData.mediaCount,
              },
              posts_count: instagramData.mediaCount || 0,
              is_active: true,
              last_sync_at: new Date().toISOString(),
            })
            .eq('id', existingAccount.id);

          if (updateError) {
            throw new Error(`Failed to update account: ${updateError.message}`);
          }

          // Log audit event
          await supabase.from('social_audit_log').insert({
            action: 'account_reconnected',
            entity_type: 'social_account',
            entity_id: existingAccount.id,
            actor_id: user.id,
            details: {
              platform: 'instagram',
              username: instagramData.username,
            },
          });
        } else {
          // Create new account
          const { data: newAccount, error: insertError } = await supabase
            .from('social_accounts')
            .insert({
              platform: 'instagram',
              account_id: instagramData.userId,
              account_name: instagramData.username,
              account_handle: instagramData.username,
              access_token: encryptedToken,
              token_expires_at: tokenExpiresAt,
              metadata: {
                account_type: instagramData.accountType,
                media_count: instagramData.mediaCount,
              },
              posts_count: instagramData.mediaCount || 0,
              is_active: true,
              connected_by: user.id,
              last_sync_at: new Date().toISOString(),
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
            actor_id: user.id,
            details: {
              platform: 'instagram',
              username: instagramData.username,
            },
          });
        }

        // Redirect with success message
        return NextResponse.redirect(
          `${baseUrl}${redirectTo}?oauth_success=instagram&account=${encodeURIComponent(instagramData.username)}`
        );
      }

      case 'tiktok':
        // TikTok OAuth not yet implemented
        return NextResponse.redirect(
          `${baseUrl}${redirectTo}?oauth_error=${encodeURIComponent('TikTok connection coming soon')}`
        );

      case 'youtube':
        // YouTube OAuth not yet implemented
        return NextResponse.redirect(
          `${baseUrl}${redirectTo}?oauth_error=${encodeURIComponent('YouTube connection coming soon')}`
        );

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
