// ============================================
// Social Media OAuth Utilities
// ============================================
// Handles OAuth flows for Instagram, TikTok, and YouTube
// Credentials are stored in the database, not environment variables

import { createHmac, randomBytes } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { decryptToken } from './encryption';

// ============================================
// Types
// ============================================

export interface OAuthState {
  platform: 'instagram' | 'tiktok' | 'youtube';
  redirect?: string;
  nonce: string;
  timestamp: number;
}

export interface PlatformCredentials {
  client_id: string;
  client_secret: string;
  redirect_uri?: string;
  additional_config?: Record<string, string>;
}

export interface InstagramTokenResponse {
  access_token: string;
  user_id: string;
}

export interface InstagramLongLivedTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface InstagramUserProfile {
  id: string;
  username: string;
  account_type?: string;
  media_count?: number;
}

export interface TikTokTokenResponse {
  access_token: string;
  expires_in: number;
  open_id: string;
  refresh_token: string;
  refresh_expires_in: number;
  scope: string;
  token_type: string;
}

export interface TikTokUserProfile {
  open_id: string;
  union_id?: string;
  avatar_url?: string;
  display_name: string;
  follower_count?: number;
}

export interface YouTubeTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  token_type: string;
}

export interface YouTubeChannel {
  id: string;
  title: string;
  customUrl?: string;
  thumbnail?: string;
  subscriberCount?: number;
}

// ============================================
// Credentials Management
// ============================================

const CONFIG_KEY = 'social_app_credentials';

/**
 * Get credentials for a platform from the database
 */
export async function getPlatformCredentials(
  platform: 'instagram' | 'tiktok' | 'youtube'
): Promise<PlatformCredentials> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from('social_builder_config')
    .select('config_value')
    .eq('config_key', CONFIG_KEY)
    .single();

  if (error || !data?.config_value) {
    throw new Error(`${platform} credentials not configured. Please add them in Settings > API Credentials.`);
  }

  const credentials = data.config_value as Record<string, PlatformCredentials>;
  const platformCreds = credentials[platform];

  if (!platformCreds?.client_id || !platformCreds?.client_secret) {
    throw new Error(`${platform} credentials not configured. Please add them in Settings > API Credentials.`);
  }

  // Decrypt the client secret
  const decryptedSecret = decryptToken(platformCreds.client_secret);

  // Get default redirect URI
  const defaultRedirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/social/callback`;

  return {
    client_id: platformCreds.client_id,
    client_secret: decryptedSecret,
    redirect_uri: platformCreds.redirect_uri || defaultRedirectUri,
    additional_config: platformCreds.additional_config,
  };
}

// ============================================
// State Management (CSRF Protection)
// ============================================

/**
 * Create a signed state parameter for OAuth
 */
export function createSignedState(state: OAuthState): string {
  const secret = process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!secret) {
    throw new Error('SESSION_SECRET is required for OAuth state signing');
  }

  const stateJson = JSON.stringify(state);
  const stateBase64 = Buffer.from(stateJson).toString('base64url');
  const signature = createHmac('sha256', secret)
    .update(stateBase64)
    .digest('base64url');

  return `${stateBase64}.${signature}`;
}

/**
 * Verify and parse a signed state parameter
 */
export function verifySignedState(signedState: string): OAuthState | null {
  const secret = process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!secret) return null;

  const parts = signedState.split('.');
  if (parts.length !== 2) return null;

  const [stateBase64, signature] = parts;
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
    const maxAge = 15 * 60 * 1000;
    if (Date.now() - state.timestamp > maxAge) {
      return null;
    }

    return state;
  } catch {
    return null;
  }
}

// ============================================
// Instagram OAuth
// ============================================

/**
 * Get the Instagram authorization URL
 */
export async function getInstagramAuthUrl(redirectPath?: string): Promise<string> {
  const creds = await getPlatformCredentials('instagram');

  const state: OAuthState = {
    platform: 'instagram',
    redirect: redirectPath || '/admin/social-builder',
    nonce: randomBytes(16).toString('hex'),
    timestamp: Date.now(),
  };

  const signedState = createSignedState(state);
  const scope = 'user_profile,user_media';

  const params = new URLSearchParams({
    client_id: creds.client_id,
    redirect_uri: creds.redirect_uri!,
    scope,
    response_type: 'code',
    state: signedState,
  });

  return `https://api.instagram.com/oauth/authorize?${params.toString()}`;
}

/**
 * Exchange Instagram authorization code for access token
 */
export async function exchangeInstagramCode(code: string): Promise<InstagramTokenResponse> {
  const creds = await getPlatformCredentials('instagram');

  const params = new URLSearchParams({
    client_id: creds.client_id,
    client_secret: creds.client_secret,
    grant_type: 'authorization_code',
    redirect_uri: creds.redirect_uri!,
    code,
  });

  const response = await fetch('https://api.instagram.com/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('[Instagram OAuth] Token exchange failed:', errorData);
    throw new Error(errorData.error_message || 'Failed to exchange Instagram code');
  }

  return response.json();
}

/**
 * Exchange short-lived token for long-lived token (60 days)
 */
export async function exchangeForLongLivedToken(
  shortLivedToken: string
): Promise<InstagramLongLivedTokenResponse> {
  const creds = await getPlatformCredentials('instagram');

  const params = new URLSearchParams({
    grant_type: 'ig_exchange_token',
    client_secret: creds.client_secret,
    access_token: shortLivedToken,
  });

  const response = await fetch(
    `https://graph.instagram.com/access_token?${params.toString()}`
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Failed to get long-lived token');
  }

  return response.json();
}

/**
 * Refresh Instagram long-lived token
 */
export async function refreshInstagramToken(
  longLivedToken: string
): Promise<InstagramLongLivedTokenResponse> {
  const params = new URLSearchParams({
    grant_type: 'ig_refresh_token',
    access_token: longLivedToken,
  });

  const response = await fetch(
    `https://graph.instagram.com/refresh_access_token?${params.toString()}`
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Failed to refresh token');
  }

  return response.json();
}

/**
 * Get Instagram user profile
 */
export async function getInstagramProfile(accessToken: string): Promise<InstagramUserProfile> {
  const params = new URLSearchParams({
    fields: 'id,username,account_type,media_count',
    access_token: accessToken,
  });

  const response = await fetch(`https://graph.instagram.com/me?${params.toString()}`);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Failed to fetch profile');
  }

  return response.json();
}

/**
 * Complete Instagram OAuth flow
 */
export async function completeInstagramOAuth(code: string): Promise<{
  accessToken: string;
  expiresIn: number;
  userId: string;
  username: string;
  accountType?: string;
  mediaCount?: number;
}> {
  const { access_token: shortLivedToken, user_id: userId } = await exchangeInstagramCode(code);
  const { access_token: longLivedToken, expires_in } = await exchangeForLongLivedToken(shortLivedToken);
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
// TikTok OAuth (Login Kit)
// ============================================

/**
 * Get the TikTok authorization URL
 * Uses TikTok Login Kit v2
 */
export async function getTikTokAuthUrl(redirectPath?: string): Promise<string> {
  const creds = await getPlatformCredentials('tiktok');

  const state: OAuthState = {
    platform: 'tiktok',
    redirect: redirectPath || '/admin/social-builder',
    nonce: randomBytes(16).toString('hex'),
    timestamp: Date.now(),
  };

  const signedState = createSignedState(state);

  // TikTok scopes for content posting and user info
  const scope = 'user.info.basic,video.publish,video.upload';

  const params = new URLSearchParams({
    client_key: creds.client_id,
    redirect_uri: creds.redirect_uri!,
    scope,
    response_type: 'code',
    state: signedState,
  });

  return `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`;
}

/**
 * Exchange TikTok authorization code for access token
 */
export async function exchangeTikTokCode(code: string): Promise<TikTokTokenResponse> {
  const creds = await getPlatformCredentials('tiktok');

  const response = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_key: creds.client_id,
      client_secret: creds.client_secret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: creds.redirect_uri!,
    }).toString(),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('[TikTok OAuth] Token exchange failed:', errorData);
    throw new Error(errorData.error_description || 'Failed to exchange TikTok code');
  }

  return response.json();
}

/**
 * Refresh TikTok access token
 */
export async function refreshTikTokToken(refreshToken: string): Promise<TikTokTokenResponse> {
  const creds = await getPlatformCredentials('tiktok');

  const response = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_key: creds.client_id,
      client_secret: creds.client_secret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }).toString(),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error_description || 'Failed to refresh TikTok token');
  }

  return response.json();
}

/**
 * Get TikTok user profile
 */
export async function getTikTokProfile(accessToken: string): Promise<TikTokUserProfile> {
  const response = await fetch(
    'https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name,follower_count',
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Failed to fetch TikTok profile');
  }

  const data = await response.json();
  return data.data.user;
}

/**
 * Complete TikTok OAuth flow
 */
export async function completeTikTokOAuth(code: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  userId: string;
  displayName: string;
  avatarUrl?: string;
  followerCount?: number;
}> {
  const tokenResponse = await exchangeTikTokCode(code);
  const profile = await getTikTokProfile(tokenResponse.access_token);

  return {
    accessToken: tokenResponse.access_token,
    refreshToken: tokenResponse.refresh_token,
    expiresIn: tokenResponse.expires_in,
    userId: tokenResponse.open_id,
    displayName: profile.display_name,
    avatarUrl: profile.avatar_url,
    followerCount: profile.follower_count,
  };
}

// ============================================
// YouTube/Google OAuth
// ============================================

/**
 * Get the YouTube (Google) authorization URL
 */
export async function getYouTubeAuthUrl(redirectPath?: string): Promise<string> {
  const creds = await getPlatformCredentials('youtube');

  const state: OAuthState = {
    platform: 'youtube',
    redirect: redirectPath || '/admin/social-builder',
    nonce: randomBytes(16).toString('hex'),
    timestamp: Date.now(),
  };

  const signedState = createSignedState(state);

  // YouTube Data API scopes
  const scope = [
    'https://www.googleapis.com/auth/youtube.upload',
    'https://www.googleapis.com/auth/youtube.readonly',
    'https://www.googleapis.com/auth/userinfo.profile',
  ].join(' ');

  const params = new URLSearchParams({
    client_id: creds.client_id,
    redirect_uri: creds.redirect_uri!,
    scope,
    response_type: 'code',
    state: signedState,
    access_type: 'offline', // Get refresh token
    prompt: 'consent', // Always show consent to get refresh token
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Exchange YouTube/Google authorization code for tokens
 */
export async function exchangeYouTubeCode(code: string): Promise<YouTubeTokenResponse> {
  const creds = await getPlatformCredentials('youtube');

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: creds.client_id,
      client_secret: creds.client_secret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: creds.redirect_uri!,
    }).toString(),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('[YouTube OAuth] Token exchange failed:', errorData);
    throw new Error(errorData.error_description || 'Failed to exchange YouTube code');
  }

  return response.json();
}

/**
 * Refresh YouTube/Google access token
 */
export async function refreshYouTubeToken(refreshToken: string): Promise<YouTubeTokenResponse> {
  const creds = await getPlatformCredentials('youtube');

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: creds.client_id,
      client_secret: creds.client_secret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }).toString(),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error_description || 'Failed to refresh YouTube token');
  }

  return response.json();
}

/**
 * Get YouTube channel info
 */
export async function getYouTubeChannel(accessToken: string): Promise<YouTubeChannel> {
  const params = new URLSearchParams({
    part: 'snippet,statistics',
    mine: 'true',
  });

  const response = await fetch(
    `https://www.googleapis.com/youtube/v3/channels?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Failed to fetch YouTube channel');
  }

  const data = await response.json();
  const channel = data.items?.[0];

  if (!channel) {
    throw new Error('No YouTube channel found for this account');
  }

  return {
    id: channel.id,
    title: channel.snippet.title,
    customUrl: channel.snippet.customUrl,
    thumbnail: channel.snippet.thumbnails?.default?.url,
    subscriberCount: parseInt(channel.statistics?.subscriberCount || '0'),
  };
}

/**
 * Complete YouTube OAuth flow
 */
export async function completeYouTubeOAuth(code: string): Promise<{
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  channelId: string;
  channelTitle: string;
  customUrl?: string;
  thumbnail?: string;
  subscriberCount?: number;
}> {
  const tokenResponse = await exchangeYouTubeCode(code);
  const channel = await getYouTubeChannel(tokenResponse.access_token);

  return {
    accessToken: tokenResponse.access_token,
    refreshToken: tokenResponse.refresh_token,
    expiresIn: tokenResponse.expires_in,
    channelId: channel.id,
    channelTitle: channel.title,
    customUrl: channel.customUrl,
    thumbnail: channel.thumbnail,
    subscriberCount: channel.subscriberCount,
  };
}
