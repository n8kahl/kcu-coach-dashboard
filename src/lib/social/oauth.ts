// ============================================
// Social Media OAuth Utilities
// ============================================
// Handles OAuth flows for Instagram, TikTok, and YouTube

import { createHmac, randomBytes } from 'crypto';

// ============================================
// Types
// ============================================

export interface OAuthState {
  platform: 'instagram' | 'tiktok' | 'youtube';
  redirect?: string;
  nonce: string;
  timestamp: number;
}

export interface InstagramTokenResponse {
  access_token: string;
  user_id: string;
}

export interface InstagramLongLivedTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number; // seconds until expiration
}

export interface InstagramUserProfile {
  id: string;
  username: string;
  account_type?: string;
  media_count?: number;
}

// ============================================
// Environment Configuration
// ============================================

function getInstagramConfig() {
  const clientId = process.env.INSTAGRAM_APP_ID;
  const clientSecret = process.env.INSTAGRAM_APP_SECRET;
  const redirectUri = process.env.INSTAGRAM_REDIRECT_URI ||
    `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/social/callback`;

  if (!clientId || !clientSecret) {
    throw new Error('Instagram OAuth not configured: Missing INSTAGRAM_APP_ID or INSTAGRAM_APP_SECRET');
  }

  return { clientId, clientSecret, redirectUri };
}

// ============================================
// State Management (CSRF Protection)
// ============================================

/**
 * Create a signed state parameter for OAuth
 * This prevents CSRF attacks by ensuring the callback is from a legitimate request
 */
export function createSignedState(state: OAuthState): string {
  const secret = process.env.SESSION_SECRET || '';
  if (!secret) {
    throw new Error('SESSION_SECRET is required for OAuth state signing');
  }

  // Encode state as JSON
  const stateJson = JSON.stringify(state);
  const stateBase64 = Buffer.from(stateJson).toString('base64url');

  // Create HMAC signature
  const signature = createHmac('sha256', secret)
    .update(stateBase64)
    .digest('base64url');

  // Return state.signature format
  return `${stateBase64}.${signature}`;
}

/**
 * Verify and parse a signed state parameter
 * Returns null if signature is invalid or state has expired
 */
export function verifySignedState(signedState: string): OAuthState | null {
  const secret = process.env.SESSION_SECRET || '';
  if (!secret) return null;

  const parts = signedState.split('.');
  if (parts.length !== 2) return null;

  const [stateBase64, signature] = parts;

  // Verify signature
  const expectedSignature = createHmac('sha256', secret)
    .update(stateBase64)
    .digest('base64url');

  if (signature !== expectedSignature) {
    return null;
  }

  try {
    const stateJson = Buffer.from(stateBase64, 'base64url').toString();
    const state = JSON.parse(stateJson) as OAuthState;

    // Check if state has expired (15 minute window)
    const now = Date.now();
    const maxAge = 15 * 60 * 1000; // 15 minutes
    if (now - state.timestamp > maxAge) {
      return null;
    }

    return state;
  } catch {
    return null;
  }
}

// ============================================
// Instagram Basic Display API
// ============================================

/**
 * Get the Instagram authorization URL
 * Redirects user to Instagram to grant access
 */
export function getInstagramAuthUrl(redirectPath?: string): string {
  const { clientId, redirectUri } = getInstagramConfig();

  // Create state with platform and optional redirect
  const state: OAuthState = {
    platform: 'instagram',
    redirect: redirectPath || '/admin/social-builder',
    nonce: randomBytes(16).toString('hex'),
    timestamp: Date.now(),
  };

  const signedState = createSignedState(state);

  // Instagram Basic Display API scope
  // Note: user_profile gives access to id, username
  // user_media gives access to user's media
  const scope = 'user_profile,user_media';

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope,
    response_type: 'code',
    state: signedState,
  });

  return `https://api.instagram.com/oauth/authorize?${params.toString()}`;
}

/**
 * Exchange authorization code for access token
 * Returns short-lived token (valid for 1 hour)
 */
export async function exchangeInstagramCode(code: string): Promise<InstagramTokenResponse> {
  const { clientId, clientSecret, redirectUri } = getInstagramConfig();

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
    code,
  });

  const response = await fetch('https://api.instagram.com/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('[Instagram OAuth] Token exchange failed:', errorData);
    throw new Error(errorData.error_message || 'Failed to exchange Instagram code for token');
  }

  return response.json();
}

/**
 * Exchange short-lived token for long-lived token
 * Long-lived tokens are valid for 60 days
 */
export async function exchangeForLongLivedToken(
  shortLivedToken: string
): Promise<InstagramLongLivedTokenResponse> {
  const { clientSecret } = getInstagramConfig();

  const params = new URLSearchParams({
    grant_type: 'ig_exchange_token',
    client_secret: clientSecret,
    access_token: shortLivedToken,
  });

  const response = await fetch(
    `https://graph.instagram.com/access_token?${params.toString()}`,
    { method: 'GET' }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('[Instagram OAuth] Long-lived token exchange failed:', errorData);
    throw new Error(errorData.error?.message || 'Failed to exchange for long-lived token');
  }

  return response.json();
}

/**
 * Refresh a long-lived token before it expires
 * Returns a new token valid for another 60 days
 */
export async function refreshInstagramToken(
  longLivedToken: string
): Promise<InstagramLongLivedTokenResponse> {
  const params = new URLSearchParams({
    grant_type: 'ig_refresh_token',
    access_token: longLivedToken,
  });

  const response = await fetch(
    `https://graph.instagram.com/refresh_access_token?${params.toString()}`,
    { method: 'GET' }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('[Instagram OAuth] Token refresh failed:', errorData);
    throw new Error(errorData.error?.message || 'Failed to refresh Instagram token');
  }

  return response.json();
}

/**
 * Get Instagram user profile information
 */
export async function getInstagramProfile(accessToken: string): Promise<InstagramUserProfile> {
  const fields = 'id,username,account_type,media_count';
  const params = new URLSearchParams({
    fields,
    access_token: accessToken,
  });

  const response = await fetch(
    `https://graph.instagram.com/me?${params.toString()}`,
    { method: 'GET' }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('[Instagram OAuth] Profile fetch failed:', errorData);
    throw new Error(errorData.error?.message || 'Failed to fetch Instagram profile');
  }

  return response.json();
}

// ============================================
// Complete Instagram OAuth Flow
// ============================================

/**
 * Complete the Instagram OAuth flow
 * 1. Exchange code for short-lived token
 * 2. Exchange for long-lived token
 * 3. Fetch user profile
 * Returns all data needed to store the account
 */
export async function completeInstagramOAuth(code: string): Promise<{
  accessToken: string;
  expiresIn: number;
  userId: string;
  username: string;
  accountType?: string;
  mediaCount?: number;
}> {
  // Step 1: Exchange code for short-lived token
  const { access_token: shortLivedToken, user_id: userId } = await exchangeInstagramCode(code);

  // Step 2: Exchange for long-lived token (60 days)
  const { access_token: longLivedToken, expires_in } = await exchangeForLongLivedToken(shortLivedToken);

  // Step 3: Get user profile
  const profile = await getInstagramProfile(longLivedToken);

  return {
    accessToken: longLivedToken,
    expiresIn: expires_in,
    userId,
    username: profile.username,
    accountType: profile.account_type,
    mediaCount: profile.media_count,
  };
}

// ============================================
// TikTok OAuth (Placeholder)
// ============================================

export function getTikTokAuthUrl(_redirectPath?: string): string {
  // TikTok OAuth requires TikTok for Developers app approval
  // Placeholder for future implementation
  throw new Error('TikTok OAuth not yet implemented');
}

// ============================================
// YouTube OAuth (Placeholder)
// ============================================

export function getYouTubeAuthUrl(_redirectPath?: string): string {
  // YouTube OAuth uses Google OAuth 2.0
  // Placeholder for future implementation
  throw new Error('YouTube OAuth not yet implemented');
}
