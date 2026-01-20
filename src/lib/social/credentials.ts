// ============================================
// Social App Credentials Utility
// ============================================
// Retrieves OAuth app credentials from database

import { createClient } from '@supabase/supabase-js';
import { decryptToken } from '@/lib/social/encryption';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CONFIG_KEY = 'social_app_credentials';

export interface PlatformCredentials {
  client_id: string;
  client_secret: string;
  redirect_uri?: string;
  additional_config?: Record<string, string>;
}

export interface SocialCredentials {
  instagram?: PlatformCredentials;
  tiktok?: PlatformCredentials;
  youtube?: PlatformCredentials;
}

/**
 * Get decrypted credentials for a platform
 * Used internally by OAuth functions to retrieve app credentials
 */
export async function getDecryptedCredentials(
  platform: 'instagram' | 'tiktok' | 'youtube'
): Promise<PlatformCredentials | null> {
  const { data } = await supabase
    .from('social_builder_config')
    .select('config_value')
    .eq('config_key', CONFIG_KEY)
    .single();

  if (!data?.config_value) return null;

  const credentials = data.config_value as SocialCredentials;
  const platformCreds = credentials[platform];

  if (!platformCreds?.client_id || !platformCreds?.client_secret) {
    return null;
  }

  // Decrypt the client secret
  return {
    ...platformCreds,
    client_secret: decryptToken(platformCreds.client_secret),
  };
}
