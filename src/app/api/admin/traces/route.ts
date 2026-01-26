/**
 * Admin Traces API
 *
 * Provides access to coaching and alert traces for debugging
 * and audit purposes. Admin-only access.
 */

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { getTraces, getTraceById, exportTraceAsJson, getTraceStats } from '@/lib/trace-service';
import type { TraceFilters } from '@/lib/trace-service';

/**
 * GET /api/admin/traces
 *
 * Query params:
 * - table: 'coaching' | 'alert' | 'all' (default: 'all')
 * - symbol: filter by symbol
 * - userId: filter by user ID
 * - traceType: filter by trace type
 * - startDate: ISO date string
 * - endDate: ISO date string
 * - usedFallback: 'true' | 'false'
 * - limit: number (default: 50)
 * - offset: number (default: 0)
 * - id: get single trace by ID (requires table param)
 * - export: 'true' to get JSON export format
 * - stats: 'true' to get stats only
 */
export async function GET(request: Request) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);

    // Check if requesting stats only
    if (searchParams.get('stats') === 'true') {
      const stats = await getTraceStats();
      return NextResponse.json(stats);
    }

    // Check if requesting single trace
    const traceId = searchParams.get('id');
    const table = searchParams.get('table') as 'coaching' | 'alert' | null;

    if (traceId && table) {
      const trace = await getTraceById(traceId, table);

      if (!trace) {
        return NextResponse.json({ error: 'Trace not found' }, { status: 404 });
      }

      // Check if export format requested
      if (searchParams.get('export') === 'true') {
        const exportData = await exportTraceAsJson(traceId, table);
        return NextResponse.json(exportData);
      }

      return NextResponse.json(trace);
    }

    // Build filters from query params
    const filters: TraceFilters = {
      table: (searchParams.get('table') as 'coaching' | 'alert' | 'all') || 'all',
      symbol: searchParams.get('symbol') || undefined,
      userId: searchParams.get('userId') || undefined,
      traceType: searchParams.get('traceType') || undefined,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      usedFallback: searchParams.get('usedFallback')
        ? searchParams.get('usedFallback') === 'true'
        : undefined,
      limit: parseInt(searchParams.get('limit') || '50', 10),
      offset: parseInt(searchParams.get('offset') || '0', 10),
    };

    const result = await getTraces(filters);

    return NextResponse.json({
      traces: result.traces,
      pagination: {
        total: result.total,
        hasMore: result.hasMore,
        limit: filters.limit,
        offset: filters.offset,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Admin')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    console.error('Traces API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
