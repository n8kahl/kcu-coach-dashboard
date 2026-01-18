/**
 * Admin Integrations Status API
 *
 * Returns real-time status of configured integrations.
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

interface IntegrationStatus {
  name: string;
  configured: boolean;
  connected: boolean;
  error?: string;
}

/**
 * Check if an environment variable is configured
 */
function isConfigured(envVar: string): boolean {
  const value = process.env[envVar];
  return !!value && value.length > 0 && value !== 'undefined';
}

/**
 * GET /api/admin/integrations
 * Returns status of all integrations
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!session.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const integrations: Record<string, IntegrationStatus> = {};

    // Check Supabase
    integrations.supabase = {
      name: 'Supabase',
      configured: isConfigured('NEXT_PUBLIC_SUPABASE_URL') && isConfigured('SUPABASE_SERVICE_ROLE_KEY'),
      connected: false,
    };

    if (integrations.supabase.configured) {
      try {
        const { supabaseAdmin } = await import('@/lib/supabase');
        const { error } = await supabaseAdmin.from('users').select('id').limit(1);
        integrations.supabase.connected = !error;
        if (error) integrations.supabase.error = error.message;
      } catch (e) {
        integrations.supabase.error = e instanceof Error ? e.message : 'Connection failed';
      }
    }

    // Check Discord
    integrations.discord = {
      name: 'Discord',
      configured: isConfigured('DISCORD_CLIENT_ID') && isConfigured('DISCORD_CLIENT_SECRET'),
      connected: integrations.supabase.connected, // Discord works if Supabase auth works
    };

    // Check Market Data (Massive/Polygon)
    integrations.marketData = {
      name: 'Market Data',
      configured: isConfigured('MASSIVE_API_KEY'),
      connected: false,
    };

    if (integrations.marketData.configured) {
      try {
        const { marketDataService } = await import('@/lib/market-data');
        const status = await marketDataService.getMarketStatus();
        integrations.marketData.connected = status.market !== 'unknown';
      } catch (e) {
        integrations.marketData.error = e instanceof Error ? e.message : 'Connection failed';
      }
    }

    // Check Anthropic (Claude)
    integrations.anthropic = {
      name: 'Anthropic',
      configured: isConfigured('ANTHROPIC_API_KEY'),
      connected: isConfigured('ANTHROPIC_API_KEY'), // Assume connected if configured
    };

    // Check OpenAI (Embeddings)
    integrations.openai = {
      name: 'OpenAI',
      configured: isConfigured('OPENAI_API_KEY'),
      connected: isConfigured('OPENAI_API_KEY'), // Assume connected if configured
    };

    // Check Redis (optional)
    integrations.redis = {
      name: 'Redis',
      configured: isConfigured('REDIS_URL'),
      connected: false,
    };

    if (integrations.redis.configured) {
      try {
        const { getRedisClient } = await import('@/lib/redis');
        const client = getRedisClient();
        integrations.redis.connected = client !== null;
      } catch {
        integrations.redis.connected = false;
      }
    }

    // Summary of API keys
    const apiKeys = [
      { label: 'DISCORD_CLIENT_ID', configured: isConfigured('DISCORD_CLIENT_ID') },
      { label: 'DISCORD_CLIENT_SECRET', configured: isConfigured('DISCORD_CLIENT_SECRET') },
      { label: 'SUPABASE_URL', configured: isConfigured('NEXT_PUBLIC_SUPABASE_URL') },
      { label: 'SUPABASE_SERVICE_KEY', configured: isConfigured('SUPABASE_SERVICE_ROLE_KEY') },
      { label: 'ANTHROPIC_API_KEY', configured: isConfigured('ANTHROPIC_API_KEY') },
      { label: 'OPENAI_API_KEY', configured: isConfigured('OPENAI_API_KEY') },
      { label: 'MASSIVE_API_KEY', configured: isConfigured('MASSIVE_API_KEY') },
      { label: 'REDIS_URL', configured: isConfigured('REDIS_URL') },
    ];

    return NextResponse.json({
      integrations,
      apiKeys,
    });

  } catch (error) {
    console.error('Error checking integrations:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
