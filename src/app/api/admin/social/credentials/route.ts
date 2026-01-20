// ============================================
// Social App Credentials API
// ============================================
// Manages OAuth app credentials for social platforms
// Credentials are stored encrypted in social_builder_config

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthenticatedUser } from '@/lib/auth';
import { encryptToken } from '@/lib/social/encryption';
import { z } from 'zod';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CONFIG_KEY = 'social_app_credentials';

// ============================================
// Schema
// ============================================

const PlatformCredentialsSchema = z.object({
  client_id: z.string().min(1, 'Client ID is required'),
  client_secret: z.string().min(1, 'Client Secret is required'),
  redirect_uri: z.string().url().optional(),
  additional_config: z.record(z.string()).optional(),
});

const CredentialsSchema = z.object({
  instagram: PlatformCredentialsSchema.optional(),
  tiktok: PlatformCredentialsSchema.optional(),
  youtube: PlatformCredentialsSchema.optional(),
});

type SocialCredentials = z.infer<typeof CredentialsSchema>;
type PlatformCredentials = z.infer<typeof PlatformCredentialsSchema>;

// ============================================
// GET - Fetch credentials (masked)
// ============================================

export async function GET() {
  try {
    // Verify admin access
    const user = await getAuthenticatedUser();
    if (!user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch from database
    const { data, error } = await supabase
      .from('social_builder_config')
      .select('config_value, updated_at')
      .eq('config_key', CONFIG_KEY)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('[Credentials] Fetch error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Return masked credentials (don't expose secrets)
    const credentials = data?.config_value as SocialCredentials | null;
    const maskedCredentials: Record<string, { configured: boolean; client_id?: string; redirect_uri?: string }> = {
      instagram: { configured: false },
      tiktok: { configured: false },
      youtube: { configured: false },
    };

    if (credentials) {
      for (const platform of ['instagram', 'tiktok', 'youtube'] as const) {
        const creds = credentials[platform];
        if (creds?.client_id && creds?.client_secret) {
          maskedCredentials[platform] = {
            configured: true,
            client_id: creds.client_id,
            redirect_uri: creds.redirect_uri,
          };
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        credentials: maskedCredentials,
        updated_at: data?.updated_at,
      },
    });
  } catch (error) {
    console.error('[Credentials] GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================
// POST - Save credentials for a platform
// ============================================

export async function POST(request: NextRequest) {
  try {
    // Verify admin access
    const user = await getAuthenticatedUser();
    if (!user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { platform, credentials } = body;

    if (!platform || !['instagram', 'tiktok', 'youtube'].includes(platform)) {
      return NextResponse.json(
        { error: 'Invalid platform' },
        { status: 400 }
      );
    }

    // Validate credentials
    const parsed = PlatformCredentialsSchema.safeParse(credentials);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid credentials', details: parsed.error.issues },
        { status: 400 }
      );
    }

    // Fetch existing credentials
    const { data: existing } = await supabase
      .from('social_builder_config')
      .select('config_value')
      .eq('config_key', CONFIG_KEY)
      .single();

    const currentCreds = (existing?.config_value as SocialCredentials) || {};

    // Encrypt the client secret before storing
    const encryptedCreds = {
      ...parsed.data,
      client_secret: encryptToken(parsed.data.client_secret),
    };

    // Update credentials for this platform
    const updatedCreds = {
      ...currentCreds,
      [platform]: encryptedCreds,
    };

    // Upsert to database
    const { error: upsertError } = await supabase
      .from('social_builder_config')
      .upsert({
        config_key: CONFIG_KEY,
        config_value: updatedCreds,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      });

    if (upsertError) {
      console.error('[Credentials] Upsert error:', upsertError);
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    // Log audit event
    await supabase.from('social_audit_log').insert({
      action: 'credentials_updated',
      entity_type: 'social_credentials',
      entity_id: platform,
      actor_id: user.id,
      details: {
        platform,
        client_id: parsed.data.client_id,
      },
    });

    return NextResponse.json({
      success: true,
      message: `${platform} credentials saved`,
    });
  } catch (error) {
    console.error('[Credentials] POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE - Remove credentials for a platform
// ============================================

export async function DELETE(request: NextRequest) {
  try {
    // Verify admin access
    const user = await getAuthenticatedUser();
    if (!user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const platform = searchParams.get('platform');

    if (!platform || !['instagram', 'tiktok', 'youtube'].includes(platform)) {
      return NextResponse.json(
        { error: 'Invalid platform' },
        { status: 400 }
      );
    }

    // Fetch existing credentials
    const { data: existing } = await supabase
      .from('social_builder_config')
      .select('config_value')
      .eq('config_key', CONFIG_KEY)
      .single();

    if (!existing) {
      return NextResponse.json({ success: true });
    }

    const currentCreds = existing.config_value as SocialCredentials;

    // Remove platform credentials
    const updatedCreds = { ...currentCreds };
    delete updatedCreds[platform as keyof SocialCredentials];

    // Update database
    const { error: updateError } = await supabase
      .from('social_builder_config')
      .update({
        config_value: updatedCreds,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq('config_key', CONFIG_KEY);

    if (updateError) {
      console.error('[Credentials] Delete error:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Log audit event
    await supabase.from('social_audit_log').insert({
      action: 'credentials_removed',
      entity_type: 'social_credentials',
      entity_id: platform,
      actor_id: user.id,
      details: { platform },
    });

    return NextResponse.json({
      success: true,
      message: `${platform} credentials removed`,
    });
  } catch (error) {
    console.error('[Credentials] DELETE error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
