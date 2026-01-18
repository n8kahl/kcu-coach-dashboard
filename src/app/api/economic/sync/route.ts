/**
 * Economic Calendar Sync API
 * POST /api/economic/sync - Sync economic events from API
 * GET /api/economic/sync - Get upcoming economic events
 */

import { NextResponse } from 'next/server';
import {
  syncEconomicEvents,
  getUpcomingHighImpactEvents,
  getTodayEvents,
} from '@/lib/economic-calendar';

export async function POST(request: Request) {
  try {
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

export async function GET(request: Request) {
  try {
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
      // Debug: return all events
      const { getUpcomingEarnings } = await import('@/lib/economic-calendar');
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
