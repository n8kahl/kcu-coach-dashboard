/**
 * Unified Learning Progress API Route
 *
 * Returns combined progress data from the native course_* schema.
 * This route now uses the unified native schema after migration 030.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  getUserCourseProgress,
  getUserLearningStats,
  getRecentLearningActivity,
  getModuleProgress,
} from '@/lib/learning-progress';

// ============================================
// GET /api/learning/progress/unified
// Get unified learning progress for authenticated user
// ============================================

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const session = await getSession();

    if (!session.user || !session.userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const userId = session.userId;
    const searchParams = request.nextUrl.searchParams;
    const include = searchParams.get('include')?.split(',') || ['stats', 'courses', 'modules', 'activity'];
    const activityLimit = parseInt(searchParams.get('activityLimit') || '10', 10);

    const result: Record<string, unknown> = {};

    // Fetch requested data in parallel
    const promises: Promise<void>[] = [];

    if (include.includes('stats')) {
      promises.push(
        getUserLearningStats(userId).then(stats => {
          result.stats = stats;
        })
      );
    }

    if (include.includes('courses')) {
      promises.push(
        getUserCourseProgress(userId).then(courses => {
          result.courses = courses;
        })
      );
    }

    if (include.includes('modules')) {
      promises.push(
        getModuleProgress(userId).then(modules => {
          result.modules = modules;
        })
      );
    }

    if (include.includes('activity')) {
      promises.push(
        getRecentLearningActivity(userId, activityLimit).then(activity => {
          result.recentActivity = activity;
        })
      );
    }

    await Promise.all(promises);

    return NextResponse.json({
      success: true,
      userId,
      ...result,
    });

  } catch (error) {
    console.error('Unified progress error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch learning progress' },
      { status: 500 }
    );
  }
}

// ============================================
// POST /api/learning/progress/unified
// No longer syncs from Thinkific - returns success for compatibility
// ============================================

export async function POST() {
  try {
    const session = await getSession();

    if (!session.user || !session.userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Thinkific sync has been removed - return success for backward compatibility
    return NextResponse.json({
      success: true,
      message: 'Progress is now tracked natively - no external sync needed',
    });

  } catch (error) {
    console.error('Progress sync error:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}
