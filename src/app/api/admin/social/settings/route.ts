// ============================================
// Social Builder Settings API Route
// Manage Social Builder configuration
// ============================================

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { withErrorHandler, internalError, badRequest } from '@/lib/api-errors';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ============================================
// Request Validation Schemas
// ============================================

const PlatformScheduleSchema = z.object({
  optimal_times: z.array(z.string()),
  max_posts_per_day: z.number().min(1).max(10),
});

const PostingScheduleSchema = z.object({
  instagram: PlatformScheduleSchema,
  tiktok: PlatformScheduleSchema,
  youtube: PlatformScheduleSchema,
});

const AISettingsSchema = z.object({
  temperature: z.number().min(0).max(1),
  max_suggestions_per_day: z.number().min(1).max(100),
  auto_generate: z.boolean(),
  require_approval: z.boolean(),
});

const ComplianceSchema = z.object({
  include_disclaimer: z.boolean(),
  disclaimer_text: z.string().max(500),
  require_review: z.boolean(),
});

const HashtagLimitsSchema = z.object({
  min: z.number().min(0),
  max: z.number().max(50),
  optimal: z.number(),
});

const HashtagLimitsByPlatformSchema = z.object({
  instagram: HashtagLimitsSchema,
  tiktok: HashtagLimitsSchema,
  youtube: HashtagLimitsSchema,
});

const SocialSettingsSchema = z.object({
  posting_schedule: PostingScheduleSchema,
  ai_settings: AISettingsSchema,
  compliance: ComplianceSchema,
  hashtag_limits: HashtagLimitsByPlatformSchema,
});

export type SocialSettings = z.infer<typeof SocialSettingsSchema>;

// ============================================
// Default Settings
// ============================================

const defaultSettings: SocialSettings = {
  posting_schedule: {
    instagram: { optimal_times: ['09:00', '12:00', '18:00'], max_posts_per_day: 3 },
    tiktok: { optimal_times: ['07:00', '12:00', '19:00'], max_posts_per_day: 3 },
    youtube: { optimal_times: ['14:00', '17:00'], max_posts_per_day: 1 },
  },
  ai_settings: {
    temperature: 0.7,
    max_suggestions_per_day: 10,
    auto_generate: false,
    require_approval: true,
  },
  compliance: {
    include_disclaimer: true,
    disclaimer_text: 'Educational content only. Not financial advice.',
    require_review: true,
  },
  hashtag_limits: {
    instagram: { min: 5, max: 30, optimal: 11 },
    tiktok: { min: 3, max: 8, optimal: 5 },
    youtube: { min: 0, max: 15, optimal: 8 },
  },
};

// Config key used in the database
const CONFIG_KEY = 'social_builder_settings';

// ============================================
// GET - Fetch current settings
// ============================================

export const GET = withErrorHandler(async () => {
  await requireAdmin();

  try {
    // Fetch settings from database
    const { data, error } = await supabase
      .from('social_builder_config')
      .select('config_value, updated_at, updated_by')
      .eq('config_key', CONFIG_KEY)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows found, which is OK for first-time load
      console.error('[Settings] Fetch error:', error);
      return internalError('Failed to fetch settings');
    }

    // If no settings exist, return defaults
    if (!data) {
      return NextResponse.json({
        success: true,
        data: {
          settings: defaultSettings,
          updatedAt: null,
          updatedBy: null,
          isDefault: true,
        },
      });
    }

    // Merge with defaults to ensure all fields exist
    const savedSettings = data.config_value as Partial<SocialSettings>;
    const mergedSettings: SocialSettings = {
      posting_schedule: {
        ...defaultSettings.posting_schedule,
        ...savedSettings.posting_schedule,
      },
      ai_settings: {
        ...defaultSettings.ai_settings,
        ...savedSettings.ai_settings,
      },
      compliance: {
        ...defaultSettings.compliance,
        ...savedSettings.compliance,
      },
      hashtag_limits: {
        ...defaultSettings.hashtag_limits,
        ...savedSettings.hashtag_limits,
      },
    };

    return NextResponse.json({
      success: true,
      data: {
        settings: mergedSettings,
        updatedAt: data.updated_at,
        updatedBy: data.updated_by,
        isDefault: false,
      },
    });
  } catch (error) {
    console.error('[Settings] Unexpected error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return internalError(message);
  }
});

// ============================================
// POST - Save settings
// ============================================

export const POST = withErrorHandler(async (request: Request) => {
  const adminUser = await requireAdmin();

  try {
    const body = await request.json();

    // Validate the settings
    const validationResult = SocialSettingsSchema.safeParse(body);
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
      return badRequest(`Invalid settings: ${errors.join(', ')}`);
    }

    const settings = validationResult.data;

    // Upsert the settings
    const { error } = await supabase
      .from('social_builder_config')
      .upsert(
        {
          config_key: CONFIG_KEY,
          config_value: settings,
          description: 'Social Builder UI settings (posting schedule, AI, compliance, hashtags)',
          updated_by: adminUser.userId,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'config_key',
        }
      );

    if (error) {
      console.error('[Settings] Save error:', error);
      return internalError('Failed to save settings');
    }

    // Log the audit event
    await supabase.from('social_audit_log').insert({
      action: 'config_updated',
      entity_type: 'social_builder_config',
      entity_id: CONFIG_KEY,
      actor_id: adminUser.userId,
      details: {
        config_key: CONFIG_KEY,
        changed_sections: Object.keys(settings),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Settings saved successfully',
      data: {
        settings,
        updatedAt: new Date().toISOString(),
        updatedBy: adminUser.userId,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return badRequest(`Validation error: ${error.errors.map(e => e.message).join(', ')}`);
    }

    console.error('[Settings] Unexpected error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return internalError(message);
  }
});

// ============================================
// PUT - Reset to defaults
// ============================================

export const PUT = withErrorHandler(async () => {
  const adminUser = await requireAdmin();

  try {
    // Delete existing settings (will fall back to defaults on GET)
    const { error } = await supabase
      .from('social_builder_config')
      .delete()
      .eq('config_key', CONFIG_KEY);

    if (error) {
      console.error('[Settings] Reset error:', error);
      return internalError('Failed to reset settings');
    }

    // Log the audit event
    await supabase.from('social_audit_log').insert({
      action: 'config_updated',
      entity_type: 'social_builder_config',
      entity_id: CONFIG_KEY,
      actor_id: adminUser.userId,
      details: {
        config_key: CONFIG_KEY,
        action: 'reset_to_defaults',
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Settings reset to defaults',
      data: {
        settings: defaultSettings,
        updatedAt: null,
        updatedBy: null,
        isDefault: true,
      },
    });
  } catch (error) {
    console.error('[Settings] Unexpected error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return internalError(message);
  }
});
