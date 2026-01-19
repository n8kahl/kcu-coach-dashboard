/**
 * Economic Calendar Sync API
 * POST /api/economic/sync - Sync economic events from API (requires CRON_SECRET)
 * GET /api/economic/sync - Get upcoming economic events (rate-limited)
 */

import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import {
  syncEconomicEvents,
  getUpcomingHighImpactEvents,
  getTodayEvents,
} from '@/lib/economic-calendar';
import { checkRateLimit } from '@/lib/redis';

/**
 * Verify cron authorization via Bearer token
 * Returns true if authorized, false otherwise
 */
function verifyCronAuthorization(authHeader: string | null): boolean {
  const cronSecret = process.env.CRON_SECRET;

  // In production, CRON_SECRET must be configured
  if (!cronSecret) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Economic Sync] CRON_SECRET not set - allowing in development');
      return true;
    }
    console.error('[Economic Sync] CRON_SECRET not configured');
    return false;
  }

  // Require Authorization header
  if (!authHeader) {
    return false;
  }

  // Verify Bearer token format and value
  const [scheme, token] = authHeader.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return false;
  }

  // Timing-safe comparison to prevent timing attacks
  if (token.length !== cronSecret.length) {
    return false;
  }

  let mismatch = 0;
  for (let i = 0; i < token.length; i++) {
    mismatch |= token.charCodeAt(i) ^ cronSecret.charCodeAt(i);
  }

  return mismatch === 0;
}

export async function POST(request: NextRequest) {
  try {
    const headersList = await headers();
    const authHeader = headersList.get('authorization');

    // Verify cron authorization
    if (!verifyCronAuthorization(authHeader)) {
      console.error('[Economic Sync] Unauthorized sync attempt');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Rate limit: max 10 syncs per hour per IP
    const forwarded = headersList.get('x-forwarded-for');
    const ip = forwarded?.split(',')[0]?.trim() || 'unknown';
    const rateLimitKey = `economic-sync:${ip}`;
    const rateLimit = await checkRateLimit(rateLimitKey, 10, 60 * 60 * 1000); // 10 per hour

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          retryAfter: Math.ceil((rateLimit.resetAt - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            'Retry-After': Math.ceil((rateLimit.resetAt - Date.now()) / 1000).toString(),
          },
        }
      );
    }

    // Get days parameter from query string
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '14', 10);

    const result = await syncEconomicEvents(days);

    return NextResponse.json({
      success: result.success,
      message: result.success
        ? `Synced ${result.count} economic events`
        : 'Failed to sync events',
      count: result.count,
    });
  } catch (error) {
    console.error('Error syncing economic events:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to sync economic events' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const headersList = await headers();

    // Rate limit: max 60 requests per minute per IP
    const forwarded = headersList.get('x-forwarded-for');
    const ip = forwarded?.split(',')[0]?.trim() || 'unknown';
    const rateLimitKey = `economic-read:${ip}`;
    const rateLimit = await checkRateLimit(rateLimitKey, 60, 60 * 1000); // 60 per minute

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          retryAfter: Math.ceil((rateLimit.resetAt - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            'Retry-After': Math.ceil((rateLimit.resetAt - Date.now()) / 1000).toString(),
          },
        }
      );
    }

    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter'); // 'today', 'upcoming', or 'all'

    if (filter === 'today') {
      const events = await getTodayEvents();
      return NextResponse.json({
        success: true,
        events,
        count: events.length,
      });
    }

    if (filter === 'all') {
      // Return all events with extended range
      const events = await getUpcomingHighImpactEvents(30);
      const todayEvents = await getTodayEvents();
      return NextResponse.json({
        success: true,
        highImpact: events,
        today: todayEvents,
        counts: { highImpact: events.length, today: todayEvents.length },
      });
    }

    // Default: upcoming high-impact events
    const events = await getUpcomingHighImpactEvents(14);
    return NextResponse.json({
      success: true,
      events,
      count: events.length,
    });
  } catch (error) {
    console.error('Error fetching economic events:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch economic events' },
      { status: 500 }
    );
  }
}
