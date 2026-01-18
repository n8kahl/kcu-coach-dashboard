import { z } from 'zod';

/**
 * Environment variable schema
 * Validates all required and optional environment variables
 */
const envSchema = z.object({
  // Node environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Supabase (required)
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('NEXT_PUBLIC_SUPABASE_URL must be a valid URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),

  // Discord OAuth (required)
  DISCORD_CLIENT_ID: z.string().min(1, 'DISCORD_CLIENT_ID is required'),
  DISCORD_CLIENT_SECRET: z.string().min(1, 'DISCORD_CLIENT_SECRET is required'),
  DISCORD_REDIRECT_URI: z.string().url().optional(),

  // Application URLs (required)
  NEXT_PUBLIC_APP_URL: z.string().url('NEXT_PUBLIC_APP_URL must be a valid URL'),

  // Session security (required in production)
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters').optional(),

  // Anthropic AI (required for AI features)
  ANTHROPIC_API_KEY: z.string().min(1, 'ANTHROPIC_API_KEY is required'),

  // Market Data (required for companion mode)
  MASSIVE_API_KEY: z.string().optional(),

  // Redis (optional, for scaling)
  REDIS_URL: z.string().url().optional(),

  // Error tracking (optional)
  SENTRY_DSN: z.string().url().optional(),

  // Thinkific LMS Integration (optional - for SSO deep-linking)
  // Note: The API key is used both for REST API calls AND as the JWT signing secret for SSO
  THINKIFIC_SUBDOMAIN: z.string().default('kaycapitals'),
  THINKIFIC_API_KEY: z.string().optional(),

  // YouTube Channel Indexing (optional - for AI coach remediation)
  YOUTUBE_API_KEY: z.string().optional(),
  KAY_CAPITALS_CHANNEL_ID: z.string().optional(),
});

/**
 * Type for validated environment
 */
export type Env = z.infer<typeof envSchema>;

/**
 * Validate environment variables
 * Call this at app startup to fail fast on missing config
 */
export function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('❌ Environment validation failed:');
    result.error.issues.forEach((issue: z.ZodIssue) => {
      console.error(`   - ${issue.path.join('.')}: ${issue.message}`);
    });

    // In development, continue with warnings
    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️ Continuing in development mode with missing env vars');
      return process.env as unknown as Env;
    }

    throw new Error('Invalid environment configuration');
  }

  // Additional production checks
  if (result.data.NODE_ENV === 'production') {
    if (!result.data.SESSION_SECRET) {
      throw new Error('SESSION_SECRET is required in production');
    }
    if (!result.data.MASSIVE_API_KEY) {
      console.warn('⚠️ MASSIVE_API_KEY not set - companion mode will be limited');
    }
  }

  console.log('✅ Environment validation passed');
  return result.data;
}

/**
 * Get a validated environment variable
 * Use this instead of accessing process.env directly
 */
export function getEnv<K extends keyof Env>(key: K): Env[K] {
  const value = process.env[key as string];

  // Type-safe return
  return value as Env[K];
}

/**
 * Check if running in production
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Check if running in development
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}

/**
 * Check if a feature is enabled based on env vars
 */
export function isFeatureEnabled(feature: 'ai' | 'companion' | 'redis' | 'thinkific_sso' | 'youtube_indexer'): boolean {
  switch (feature) {
    case 'ai':
      return !!process.env.ANTHROPIC_API_KEY;
    case 'companion':
      return !!process.env.MASSIVE_API_KEY;
    case 'redis':
      return !!process.env.REDIS_URL;
    case 'thinkific_sso':
      return !!(process.env.THINKIFIC_API_KEY && process.env.THINKIFIC_SUBDOMAIN);
    case 'youtube_indexer':
      return !!(process.env.YOUTUBE_API_KEY && process.env.KAY_CAPITALS_CHANNEL_ID);
    default:
      return false;
  }
}

/**
 * Direct environment variable access object
 * Provides typed access to environment variables
 */
export const env = {
  get NODE_ENV() { return process.env.NODE_ENV || 'development'; },
  get NEXT_PUBLIC_SUPABASE_URL() { return process.env.NEXT_PUBLIC_SUPABASE_URL || ''; },
  get NEXT_PUBLIC_SUPABASE_ANON_KEY() { return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''; },
  get SUPABASE_SERVICE_ROLE_KEY() { return process.env.SUPABASE_SERVICE_ROLE_KEY || ''; },
  get NEXT_PUBLIC_APP_URL() { return process.env.NEXT_PUBLIC_APP_URL || ''; },
  get ANTHROPIC_API_KEY() { return process.env.ANTHROPIC_API_KEY || ''; },
  // Thinkific (API key is used for both REST API and SSO JWT signing)
  get THINKIFIC_SUBDOMAIN() { return process.env.THINKIFIC_SUBDOMAIN || 'kaycapitals'; },
  get THINKIFIC_API_KEY() { return process.env.THINKIFIC_API_KEY || ''; },
  // YouTube
  get YOUTUBE_API_KEY() { return process.env.YOUTUBE_API_KEY || ''; },
  get KAY_CAPITALS_CHANNEL_ID() { return process.env.KAY_CAPITALS_CHANNEL_ID || ''; },
};

// Validate on module load in production
if (typeof window === 'undefined' && process.env.NODE_ENV === 'production') {
  // Only validate on server-side in production
  try {
    validateEnv();
  } catch (error) {
    console.error('Environment validation failed during startup:', error);
    // Don't throw here to avoid breaking builds
  }
}
