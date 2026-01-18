/**
 * Admin Thinkific Sync API
 *
 * Endpoints for syncing Thinkific LMS content to local database.
 * Admin-only access.
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import {
  syncThinkificCourses,
  getThinkificSyncStatus,
  isThinkificConfigured,
  getThinkificCoursesForLearning,
} from '@/lib/thinkific-api';
import logger from '@/lib/logger';

/**
 * GET /api/admin/thinkific/sync
 * Get Thinkific sync status and statistics
 */
export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!session.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    // Check if Thinkific API is configured
    if (!isThinkificConfigured()) {
      return NextResponse.json({
        configured: false,
        error: 'Thinkific API not configured. Set THINKIFIC_API_KEY and THINKIFIC_SUBDOMAIN.',
      });
    }

    // Return sync status
    if (action === 'status') {
      const status = await getThinkificSyncStatus();

      // Get last sync log
      const { data: lastSync } = await supabaseAdmin
        .from('thinkific_sync_log')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(1)
        .single();

      return NextResponse.json({
        configured: true,
        ...status,
        last_sync_log: lastSync,
      });
    }

    // Return courses for preview
    if (action === 'courses') {
      const courses = await getThinkificCoursesForLearning();
      return NextResponse.json({
        configured: true,
        courses,
      });
    }

    // Default: return full status with courses
    const [status, courses] = await Promise.all([
      getThinkificSyncStatus(),
      getThinkificCoursesForLearning(),
    ]);

    // Get recent sync logs
    const { data: syncLogs } = await supabaseAdmin
      .from('thinkific_sync_log')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(5);

    return NextResponse.json({
      configured: true,
      ...status,
      courses,
      sync_logs: syncLogs || [],
    });

  } catch (error) {
    logger.error('Error in admin thinkific sync GET', error instanceof Error ? error : { message: String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/admin/thinkific/sync
 * Trigger Thinkific content sync
 */
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!session.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check if Thinkific is configured
    if (!isThinkificConfigured()) {
      return NextResponse.json({
        error: 'Thinkific API not configured',
        detail: 'Set THINKIFIC_API_KEY and THINKIFIC_SUBDOMAIN environment variables',
      }, { status: 503 });
    }

    const body = await request.json().catch(() => ({}));
    const { action = 'full' } = body;

    // Create sync log entry
    const { data: syncLog, error: logError } = await supabaseAdmin
      .from('thinkific_sync_log')
      .insert({
        sync_type: action,
        status: 'running',
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (logError) {
      logger.error('Error creating sync log', { error: logError.message });
    }

    logger.info('Starting Thinkific sync', {
      action,
      adminId: session.userId,
      syncLogId: syncLog?.id,
    });

    try {
      // Perform sync
      const result = await syncThinkificCourses();

      // Update sync log
      if (syncLog?.id) {
        await supabaseAdmin
          .from('thinkific_sync_log')
          .update({
            status: result.success ? 'completed' : 'failed',
            courses_synced: result.courses_synced,
            chapters_synced: result.chapters_synced,
            contents_synced: result.contents_synced,
            errors: result.errors,
            completed_at: new Date().toISOString(),
          })
          .eq('id', syncLog.id);
      }

      logger.info('Thinkific sync completed', {
        success: result.success,
        courses: result.courses_synced,
        chapters: result.chapters_synced,
        contents: result.contents_synced,
        errors: result.errors.length,
      });

      return NextResponse.json({
        ...result,
        message: result.success
          ? `Successfully synced ${result.courses_synced} courses, ${result.chapters_synced} chapters, ${result.contents_synced} contents`
          : `Sync completed with errors`,
      });

    } catch (syncError) {
      // Update sync log on error
      if (syncLog?.id) {
        await supabaseAdmin
          .from('thinkific_sync_log')
          .update({
            status: 'failed',
            errors: [syncError instanceof Error ? syncError.message : String(syncError)],
            completed_at: new Date().toISOString(),
          })
          .eq('id', syncLog.id);
      }

      throw syncError;
    }

  } catch (error) {
    logger.error('Error in admin thinkific sync POST', error instanceof Error ? error : { message: String(error) });
    return NextResponse.json({
      error: 'Sync failed',
      detail: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/thinkific/sync
 * Clear all synced Thinkific content
 */
export async function DELETE(request: Request) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!session.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    logger.info('Clearing Thinkific content', { adminId: session.userId });

    // Delete in order to respect foreign key constraints
    const { count: contentsDeleted } = await supabaseAdmin
      .from('thinkific_contents')
      .delete({ count: 'exact' })
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    const { count: chaptersDeleted } = await supabaseAdmin
      .from('thinkific_chapters')
      .delete({ count: 'exact' })
      .neq('id', '00000000-0000-0000-0000-000000000000');

    const { count: coursesDeleted } = await supabaseAdmin
      .from('thinkific_courses')
      .delete({ count: 'exact' })
      .neq('id', '00000000-0000-0000-0000-000000000000');

    return NextResponse.json({
      success: true,
      deleted: {
        courses: coursesDeleted || 0,
        chapters: chaptersDeleted || 0,
        contents: contentsDeleted || 0,
      },
    });

  } catch (error) {
    logger.error('Error in admin thinkific sync DELETE', error instanceof Error ? error : { message: String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
