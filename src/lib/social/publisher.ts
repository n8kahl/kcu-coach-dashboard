// ============================================
// Social Media Publisher Service
// ============================================
// Handles publishing content to connected social platforms

import { createClient } from '@supabase/supabase-js';
import { decryptToken } from './encryption';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ============================================
// Types
// ============================================

export interface PublishResult {
  success: boolean;
  platformPostId?: string;
  platformUrl?: string;
  error?: string;
}

export interface MediaContainer {
  id: string;
}

export interface InstagramPublishResponse {
  id: string;
}

export interface SocialAccount {
  id: string;
  platform: string;
  account_id: string;
  account_name: string;
  account_handle: string;
  access_token: string;
  token_expires_at: string | null;
  metadata: Record<string, unknown>;
  is_active: boolean;
}

// ============================================
// Account Token Management
// ============================================

/**
 * Get a valid access token for a social account
 * Throws if token is expired or account is inactive
 */
export async function getValidToken(accountId: string): Promise<{
  token: string;
  account: SocialAccount;
}> {
  const { data: account, error } = await supabase
    .from('social_accounts')
    .select('*')
    .eq('id', accountId)
    .single();

  if (error || !account) {
    throw new Error('Account not found');
  }

  if (!account.is_active) {
    throw new Error('Account is disconnected');
  }

  // Check token expiration
  if (account.token_expires_at) {
    const expiresAt = new Date(account.token_expires_at);
    if (expiresAt < new Date()) {
      throw new Error('Access token has expired. Please reconnect the account.');
    }
  }

  // Decrypt the token
  const decryptedToken = decryptToken(account.access_token);

  return {
    token: decryptedToken,
    account: account as SocialAccount,
  };
}

// ============================================
// Instagram Graph API Publishing
// ============================================

/**
 * Create an Instagram media container
 * This is step 1 of the two-step publishing process
 *
 * For images: Creates a container with the image URL
 * For carousels: Creates individual containers, then a carousel container
 * For reels: Creates a video container
 */
async function createInstagramMediaContainer(
  accessToken: string,
  instagramUserId: string,
  imageUrl: string,
  caption: string,
  mediaType: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM' = 'IMAGE'
): Promise<MediaContainer> {
  const params: Record<string, string> = {
    access_token: accessToken,
    caption,
  };

  if (mediaType === 'IMAGE') {
    params.image_url = imageUrl;
  } else if (mediaType === 'VIDEO') {
    params.video_url = imageUrl;
    params.media_type = 'REELS';
  }

  const response = await fetch(
    `https://graph.facebook.com/v18.0/${instagramUserId}/media`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('[Instagram Publisher] Container creation failed:', errorData);
    throw new Error(
      errorData.error?.message || 'Failed to create media container'
    );
  }

  const data = await response.json();
  return { id: data.id };
}

/**
 * Check the status of a media container
 * Used for video uploads that may take time to process
 */
async function checkContainerStatus(
  accessToken: string,
  containerId: string
): Promise<'IN_PROGRESS' | 'FINISHED' | 'ERROR'> {
  const params = new URLSearchParams({
    fields: 'status_code',
    access_token: accessToken,
  });

  const response = await fetch(
    `https://graph.facebook.com/v18.0/${containerId}?${params.toString()}`
  );

  if (!response.ok) {
    throw new Error('Failed to check container status');
  }

  const data = await response.json();
  return data.status_code || 'FINISHED';
}

/**
 * Publish a media container to Instagram
 * This is step 2 of the two-step publishing process
 */
async function publishInstagramContainer(
  accessToken: string,
  instagramUserId: string,
  containerId: string
): Promise<InstagramPublishResponse> {
  const response = await fetch(
    `https://graph.facebook.com/v18.0/${instagramUserId}/media_publish`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        creation_id: containerId,
        access_token: accessToken,
      }),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('[Instagram Publisher] Publish failed:', errorData);
    throw new Error(errorData.error?.message || 'Failed to publish media');
  }

  return response.json();
}

/**
 * Wait for a video container to finish processing
 * Polls the status every 5 seconds, times out after 5 minutes
 */
async function waitForContainerProcessing(
  accessToken: string,
  containerId: string,
  maxWaitMs = 5 * 60 * 1000
): Promise<void> {
  const startTime = Date.now();
  const pollInterval = 5000; // 5 seconds

  while (Date.now() - startTime < maxWaitMs) {
    const status = await checkContainerStatus(accessToken, containerId);

    if (status === 'FINISHED') {
      return;
    }

    if (status === 'ERROR') {
      throw new Error('Media processing failed');
    }

    // Wait before next poll
    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  throw new Error('Media processing timed out');
}

/**
 * Get the permalink for a published Instagram post
 */
async function getInstagramPostUrl(
  accessToken: string,
  mediaId: string
): Promise<string | undefined> {
  const params = new URLSearchParams({
    fields: 'permalink',
    access_token: accessToken,
  });

  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${mediaId}?${params.toString()}`
    );

    if (response.ok) {
      const data = await response.json();
      return data.permalink;
    }
  } catch (err) {
    console.warn('[Instagram Publisher] Failed to get permalink:', err);
  }

  return undefined;
}

/**
 * Publish content to Instagram
 *
 * @param accountId - The social_accounts.id for the Instagram account
 * @param mediaUrl - Public URL to the image or video
 * @param caption - The caption including hashtags
 * @param mediaType - Type of media (IMAGE, VIDEO, or CAROUSEL_ALBUM)
 */
export async function publishToInstagram(
  accountId: string,
  mediaUrl: string,
  caption: string,
  mediaType: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM' = 'IMAGE'
): Promise<PublishResult> {
  try {
    // Get valid token and account info
    const { token, account } = await getValidToken(accountId);

    // Instagram Graph API requires the Instagram Business Account ID
    // This should be stored in the account metadata
    const instagramUserId = account.account_id;

    if (!instagramUserId) {
      throw new Error('Instagram user ID not found in account');
    }

    // Step 1: Create media container
    console.log('[Instagram Publisher] Creating media container...');
    const container = await createInstagramMediaContainer(
      token,
      instagramUserId,
      mediaUrl,
      caption,
      mediaType
    );

    // For video content, wait for processing
    if (mediaType === 'VIDEO') {
      console.log('[Instagram Publisher] Waiting for video processing...');
      await waitForContainerProcessing(token, container.id);
    }

    // Step 2: Publish the container
    console.log('[Instagram Publisher] Publishing container...');
    const publishResult = await publishInstagramContainer(
      token,
      instagramUserId,
      container.id
    );

    // Get the post URL
    const platformUrl = await getInstagramPostUrl(token, publishResult.id);

    console.log('[Instagram Publisher] Published successfully:', publishResult.id);

    return {
      success: true,
      platformPostId: publishResult.id,
      platformUrl,
    };
  } catch (error) {
    console.error('[Instagram Publisher] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown publishing error',
    };
  }
}

// ============================================
// TikTok Publishing (Placeholder)
// ============================================

export async function publishToTikTok(
  _accountId: string,
  _mediaUrl: string,
  _caption: string
): Promise<PublishResult> {
  return {
    success: false,
    error: 'TikTok publishing not yet implemented',
  };
}

// ============================================
// YouTube Publishing (Placeholder)
// ============================================

export async function publishToYouTube(
  _accountId: string,
  _mediaUrl: string,
  _caption: string
): Promise<PublishResult> {
  return {
    success: false,
    error: 'YouTube publishing not yet implemented',
  };
}

// ============================================
// Unified Publishing Interface
// ============================================

export type SocialPlatform = 'instagram' | 'tiktok' | 'youtube';

/**
 * Publish content to a social platform
 */
export async function publishToSocialPlatform(
  platform: SocialPlatform,
  accountId: string,
  mediaUrl: string,
  caption: string,
  mediaType?: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM'
): Promise<PublishResult> {
  switch (platform) {
    case 'instagram':
      return publishToInstagram(accountId, mediaUrl, caption, mediaType);
    case 'tiktok':
      return publishToTikTok(accountId, mediaUrl, caption);
    case 'youtube':
      return publishToYouTube(accountId, mediaUrl, caption);
    default:
      return {
        success: false,
        error: `Unknown platform: ${platform}`,
      };
  }
}
